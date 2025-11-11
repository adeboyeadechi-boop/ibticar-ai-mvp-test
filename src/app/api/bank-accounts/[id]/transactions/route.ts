// API Route pour les transactions bancaires (PRD-02-US-009)
// GET /api/bank-accounts/[id]/transactions - Liste des transactions
// POST /api/bank-accounts/[id]/transactions - Importer des transactions

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { TransactionType, Currency } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/bank-accounts/[id]/transactions - Liste des transactions
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: bankAccountId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const searchParams = request.nextUrl.searchParams
    const reconciled = searchParams.get('reconciled')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const skip = (page - 1) * limit

    // Vérifier que le compte bancaire existe
    const account = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    })

    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
    }

    // Construire les filtres
    const where: any = { bankAccountId }

    if (reconciled !== null && reconciled !== undefined) {
      where.reconciled = reconciled === 'true'
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    // Compter le total
    const total = await prisma.bankTransaction.count({ where })

    // Récupérer les transactions
    const transactions = await prisma.bankTransaction.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
      skip,
      take: limit,
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        reference: true,
        description: true,
        date: true,
        paymentId: true,
        reconciled: true,
        reconciledAt: true,
        createdAt: true,
      },
    })

    // Statistiques
    const stats = await prisma.bankTransaction.aggregate({
      where: { bankAccountId },
      _sum: {
        amount: true,
      },
    })

    const reconciledCount = await prisma.bankTransaction.count({
      where: { bankAccountId, reconciled: true },
    })

    const unreconciledCount = await prisma.bankTransaction.count({
      where: { bankAccountId, reconciled: false },
    })

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats: {
        totalTransactions: total,
        totalAmount: stats._sum.amount ? Number(stats._sum.amount) : 0,
        reconciled: reconciledCount,
        unreconciled: unreconciledCount,
      },
    })
  } catch (error) {
    console.error('Error fetching bank transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/bank-accounts/[id]/transactions - Importer des transactions
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: bankAccountId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent importer
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
    const { transactions } = body

    // Validation
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: 'transactions array is required and must not be empty' },
        { status: 400 }
      )
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[],
    }

    // Importer chaque transaction
    for (const txn of transactions) {
      try {
        const { type, amount, reference, description, date, currency } = txn

        // Validation des champs requis
        if (!type || !amount || !description || !date) {
          results.errors++
          results.details.push({
            transaction: txn,
            status: 'error',
            reason: 'Missing required fields',
          })
          continue
        }

        // Vérifier si la transaction existe déjà (par référence et date)
        if (reference) {
          const existing = await prisma.bankTransaction.findFirst({
            where: {
              bankAccountId,
              reference,
              date: new Date(date),
            },
          })

          if (existing) {
            results.skipped++
            results.details.push({
              transaction: txn,
              status: 'skipped',
              reason: 'Transaction already exists',
            })
            continue
          }
        }

        // Créer la transaction
        const created = await prisma.bankTransaction.create({
          data: {
            bankAccountId,
            type: type as TransactionType,
            amount: parseFloat(amount),
            currency: (currency || account.currency) as Currency,
            reference: reference || null,
            description,
            date: new Date(date),
            reconciled: false,
          },
        })

        // Mettre à jour le solde du compte
        const balanceChange = type === 'EARN' ? parseFloat(amount) : -parseFloat(amount)
        await prisma.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            balance: {
              increment: balanceChange,
            },
          },
        })

        results.imported++
        results.details.push({
          transaction: created,
          status: 'imported',
        })
      } catch (error) {
        results.errors++
        results.details.push({
          transaction: txn,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'BankTransaction',
        entityId: bankAccountId,
        changes: {
          action: 'IMPORT',
          results,
        },
      },
    })

    return NextResponse.json({
      success: true,
      results,
      message: `Imported ${results.imported} transactions, ${results.skipped} skipped, ${results.errors} errors`,
    })
  } catch (error) {
    console.error('Error importing bank transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
