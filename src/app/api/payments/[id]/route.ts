// API Routes pour la gestion individuelle des paiements (PRD-02-US-003)
// GET /api/payments/[id] - Détails d'un paiement
// PUT /api/payments/[id] - Modifier un paiement
// DELETE /api/payments/[id] - Annuler un paiement

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/payments/[id] - Détails du paiement
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: paymentId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer le paiement
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true,
            dueDate: true,
            total: true,
            amountPaid: true,
            amountDue: true,
            status: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            companyName: true,
            address: true,
            city: true,
            wilaya: true,
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json({
      payment: {
        ...payment,
        amount: Number(payment.amount),
        invoice: payment.invoice
          ? {
              ...payment.invoice,
              total: Number(payment.invoice.total),
              amountPaid: Number(payment.invoice.amountPaid),
              amountDue: Number(payment.invoice.amountDue),
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/payments/[id] - Modifier un paiement
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: paymentId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent modifier des paiements
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const { reference, transactionId, notes, status } = body

    // Vérifier que le paiement existe
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
    })

    if (!existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Ne pas modifier un paiement annulé ou échoué
    if (['REFUNDED', 'FAILED'].includes(existingPayment.status)) {
      return NextResponse.json(
        { error: 'Cannot modify cancelled or failed payment' },
        { status: 400 }
      )
    }

    // Construire les données de mise à jour
    const updateData: any = {}

    if (reference !== undefined) updateData.reference = reference
    if (transactionId !== undefined) updateData.transactionId = transactionId
    if (notes !== undefined) updateData.notes = notes

    // Changement de statut limité
    if (status) {
      const allowedStatuses = ['PENDING', 'COMPLETED', 'FAILED']
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` },
          { status: 400 }
        )
      }

      updateData.status = status

      if (status === 'COMPLETED' && !existingPayment.processedAt) {
        updateData.processedAt = new Date()
      } else if (status === 'FAILED') {
        updateData.failedAt = new Date()
      }
    }

    // Mettre à jour le paiement
    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Payment',
        entityId: paymentId,
        changes: updateData,
      },
    })

    return NextResponse.json({
      success: true,
      payment: {
        ...payment,
        amount: Number(payment.amount),
      },
      message: 'Payment updated successfully',
    })
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/payments/[id] - Annuler un paiement
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: paymentId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent annuler des paiements
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer la raison d'annulation
    const body = await request.json().catch(() => ({}))
    const { reason } = body

    if (!reason) {
      return NextResponse.json(
        { error: 'Reason is required for cancellation' },
        { status: 400 }
      )
    }

    // Vérifier que le paiement existe
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: true,
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Ne pas annuler un paiement déjà annulé
    if (payment.status === 'REFUNDED') {
      return NextResponse.json(
        { error: 'Payment is already cancelled' },
        { status: 400 }
      )
    }

    // Calculer le nouveau solde de la facture
    const paymentAmount = Number(payment.amount)
    const newAmountPaid = Number(payment.invoice.amountPaid) - paymentAmount
    const newAmountDue = Number(payment.invoice.total) - newAmountPaid

    // Déterminer le nouveau statut de la facture
    let newInvoiceStatus = payment.invoice.status
    if (newAmountPaid <= 0) {
      newInvoiceStatus = 'SENT'
    } else if (newAmountDue > 0) {
      newInvoiceStatus = 'PARTIALLY_PAID'
    }

    // Annuler le paiement avec transaction
    await prisma.$transaction(async (tx) => {
      // 1. Annuler le paiement
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REFUNDED',
          notes: `${payment.notes || ''}\n\nAnnulation: ${reason}`.trim(),
        },
      })

      // 2. Mettre à jour la facture
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newInvoiceStatus,
          paidAt: newInvoiceStatus === 'PAID' ? new Date() : null,
        },
      })
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Payment',
        entityId: paymentId,
        changes: {
          action: 'CANCELLED',
          reason,
          cancelledBy: user.id,
          newInvoiceStatus,
          newAmountDue,
        },
      },
    })

    return NextResponse.json({
      success: true,
      payment: {
        id: paymentId,
        paymentNumber: payment.paymentNumber,
        status: 'REFUNDED',
        amount: paymentAmount,
      },
      invoice: {
        id: payment.invoiceId,
        status: newInvoiceStatus,
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
      },
      message: 'Payment cancelled successfully',
    })
  } catch (error) {
    console.error('Error cancelling payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
