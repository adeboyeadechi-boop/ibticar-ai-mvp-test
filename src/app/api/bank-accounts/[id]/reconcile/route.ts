// API Route pour la réconciliation bancaire (PRD-02-US-009)
// POST /api/bank-accounts/[id]/reconcile - Rapprochement automatique

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/bank-accounts/[id]/reconcile - Rapprochement bancaire automatique
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: bankAccountId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent réconcilier
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le compte bancaire existe
    const account = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    })

    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
    }

    const body = await request.json()
    const { autoReconcile, transactionIds, paymentIds } = body

    const results = {
      reconciled: 0,
      failed: 0,
      details: [] as any[],
    }

    if (autoReconcile) {
      // Mode automatique: rapprocher par montant et date
      const unreconciledTransactions = await prisma.bankTransaction.findMany({
        where: {
          bankAccountId,
          reconciled: false,
        },
        orderBy: {
          date: 'desc',
        },
        take: 100, // Limiter à 100 par batch
      })

      for (const transaction of unreconciledTransactions) {
        try {
          // Rechercher un paiement correspondant
          // Critères: montant exact, date proche (±3 jours)
          const transactionDate = new Date(transaction.date)
          const dateStart = new Date(transactionDate)
          dateStart.setDate(dateStart.getDate() - 3)
          const dateEnd = new Date(transactionDate)
          dateEnd.setDate(dateEnd.getDate() + 3)

          const matchingPayment = await prisma.payment.findFirst({
            where: {
              amount: transaction.amount,
              paymentDate: {
                gte: dateStart,
                lte: dateEnd,
              },
              status: 'COMPLETED',
              // Vérifier que le paiement n'est pas déjà lié à une transaction
              NOT: {
                id: {
                  in: await prisma.bankTransaction
                    .findMany({
                      where: { reconciled: true },
                      select: { paymentId: true },
                    })
                    .then((txns) =>
                      txns.map((t) => t.paymentId).filter((id) => id !== null) as string[]
                    ),
                },
              },
            },
          })

          if (matchingPayment) {
            // Récupérer le numéro de facture
            const invoice = await prisma.invoice.findUnique({
              where: { id: matchingPayment.invoiceId },
              select: { invoiceNumber: true },
            })

            // Rapprocher la transaction avec le paiement
            await prisma.bankTransaction.update({
              where: { id: transaction.id },
              data: {
                paymentId: matchingPayment.id,
                reconciled: true,
                reconciledAt: new Date(),
              },
            })

            results.reconciled++
            results.details.push({
              transactionId: transaction.id,
              paymentId: matchingPayment.id,
              invoiceNumber: invoice?.invoiceNumber,
              amount: Number(transaction.amount),
              status: 'reconciled',
              method: 'auto',
            })
          } else {
            results.failed++
            results.details.push({
              transactionId: transaction.id,
              amount: Number(transaction.amount),
              date: transaction.date,
              status: 'no_match',
              reason: 'No matching payment found',
            })
          }
        } catch (error) {
          results.failed++
          results.details.push({
            transactionId: transaction.id,
            status: 'error',
            reason: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    } else if (transactionIds && paymentIds) {
      // Mode manuel: rapprocher les IDs fournis
      if (!Array.isArray(transactionIds) || !Array.isArray(paymentIds)) {
        return NextResponse.json(
          { error: 'transactionIds and paymentIds must be arrays' },
          { status: 400 }
        )
      }

      if (transactionIds.length !== paymentIds.length) {
        return NextResponse.json(
          { error: 'transactionIds and paymentIds must have the same length' },
          { status: 400 }
        )
      }

      for (let i = 0; i < transactionIds.length; i++) {
        const transactionId = transactionIds[i]
        const paymentId = paymentIds[i]

        try {
          // Vérifier que la transaction existe
          const transaction = await prisma.bankTransaction.findUnique({
            where: { id: transactionId },
          })

          if (!transaction) {
            results.failed++
            results.details.push({
              transactionId,
              status: 'error',
              reason: 'Transaction not found',
            })
            continue
          }

          if (transaction.bankAccountId !== bankAccountId) {
            results.failed++
            results.details.push({
              transactionId,
              status: 'error',
              reason: 'Transaction does not belong to this account',
            })
            continue
          }

          // Vérifier que le paiement existe
          const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
          })

          if (!payment) {
            results.failed++
            results.details.push({
              transactionId,
              paymentId,
              status: 'error',
              reason: 'Payment not found',
            })
            continue
          }

          // Récupérer le numéro de facture
          const invoice2 = await prisma.invoice.findUnique({
            where: { id: payment.invoiceId },
            select: { invoiceNumber: true },
          })

          // Rapprocher
          await prisma.bankTransaction.update({
            where: { id: transactionId },
            data: {
              paymentId: payment.id,
              reconciled: true,
              reconciledAt: new Date(),
            },
          })

          results.reconciled++
          results.details.push({
            transactionId,
            paymentId: payment.id,
            invoiceNumber: invoice2?.invoiceNumber,
            amount: Number(transaction.amount),
            status: 'reconciled',
            method: 'manual',
          })
        } catch (error) {
          results.failed++
          results.details.push({
            transactionId,
            paymentId,
            status: 'error',
            reason: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    } else {
      return NextResponse.json(
        {
          error:
            'Either autoReconcile must be true or transactionIds and paymentIds must be provided',
        },
        { status: 400 }
      )
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'BankTransaction',
        entityId: bankAccountId,
        changes: {
          action: 'RECONCILE',
          results,
        },
      },
    })

    return NextResponse.json({
      success: true,
      results,
      message: `Reconciled ${results.reconciled} transactions, ${results.failed} failed`,
    })
  } catch (error) {
    console.error('Error reconciling bank transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
