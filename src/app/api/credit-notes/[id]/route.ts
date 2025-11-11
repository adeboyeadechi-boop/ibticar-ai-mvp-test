// API Routes pour la gestion individuelle des avoirs (PRD-02-US-004)
// GET /api/credit-notes/[id] - Détails d'un avoir
// PUT /api/credit-notes/[id] - Modifier un avoir
// DELETE /api/credit-notes/[id] - Annuler un avoir

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/credit-notes/[id] - Détails de l'avoir
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: creditNoteId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer l'avoir
    const creditNote = await prisma.creditNote.findUnique({
      where: { id: creditNoteId },
    })

    if (!creditNote) {
      return NextResponse.json({ error: 'Credit note not found' }, { status: 404 })
    }

    // Fetch related invoice and customer separately
    const invoice = await prisma.invoice.findUnique({
      where: { id: creditNote.invoiceId },
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
    })

    const customer = await prisma.customer.findUnique({
      where: { id: creditNote.customerId },
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
    })

    return NextResponse.json({
      creditNote: {
        ...creditNote,
        amount: Number(creditNote.amount),
        invoice: invoice ? {
          ...invoice,
          total: Number(invoice.total),
          amountPaid: Number(invoice.amountPaid),
          amountDue: Number(invoice.amountDue),
        } : null,
        customer,
      },
    })
  } catch (error) {
    console.error('Error fetching credit note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/credit-notes/[id] - Modifier l'avoir
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: creditNoteId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent modifier
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const { reason, notes, status } = body

    // Vérifier que l'avoir existe
    const existingCreditNote = await prisma.creditNote.findUnique({
      where: { id: creditNoteId },
    })

    if (!existingCreditNote) {
      return NextResponse.json({ error: 'Credit note not found' }, { status: 404 })
    }

    // Ne pas modifier un avoir appliqué ou annulé
    if (['APPLIED', 'CANCELLED'].includes(existingCreditNote.status)) {
      return NextResponse.json(
        { error: 'Cannot modify applied or cancelled credit note' },
        { status: 400 }
      )
    }

    // Construire les données de mise à jour
    const updateData: any = {}

    if (reason !== undefined) updateData.reason = reason
    if (notes !== undefined) updateData.notes = notes

    // Changement de statut
    if (status) {
      const allowedTransitions: Record<string, string[]> = {
        DRAFT: ['ISSUED', 'CANCELLED'],
        ISSUED: ['APPLIED', 'CANCELLED'],
      }

      const currentStatus = existingCreditNote.status
      if (!allowedTransitions[currentStatus]?.includes(status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${currentStatus} to ${status}`,
            allowedTransitions: allowedTransitions[currentStatus] || [],
          },
          { status: 400 }
        )
      }

      updateData.status = status

      // Si passage à APPLIED, ajuster la facture
      if (status === 'APPLIED') {
        updateData.appliedAt = new Date()

        // Fetch the invoice to update it
        const invoice = await prisma.invoice.findUnique({
          where: { id: existingCreditNote.invoiceId },
          select: {
            amountPaid: true,
            total: true,
            status: true,
            paidAt: true,
          },
        })

        if (!invoice) {
          return NextResponse.json({ error: 'Associated invoice not found' }, { status: 404 })
        }

        const creditAmount = Number(existingCreditNote.amount)
        const newAmountPaid = Number(invoice.amountPaid) + creditAmount
        const newAmountDue = Number(invoice.total) - newAmountPaid

        let newInvoiceStatus = invoice.status
        if (newAmountDue <= 0) {
          newInvoiceStatus = 'PAID'
        } else if (newAmountPaid > 0) {
          newInvoiceStatus = 'PARTIALLY_PAID'
        }

        await prisma.invoice.update({
          where: { id: existingCreditNote.invoiceId },
          data: {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newInvoiceStatus,
            paidAt: newInvoiceStatus === 'PAID' ? new Date() : invoice.paidAt,
          },
        })
      }
    }

    // Mettre à jour l'avoir
    const creditNote = await prisma.creditNote.update({
      where: { id: creditNoteId },
      data: updateData,
    })

    // Fetch invoice and customer for response
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: creditNote.invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        status: true,
      },
    })

    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: creditNote.customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'CreditNote',
        entityId: creditNoteId,
        changes: updateData,
      },
    })

    return NextResponse.json({
      success: true,
      creditNote: {
        ...creditNote,
        amount: Number(creditNote.amount),
        invoice: updatedInvoice ? {
          ...updatedInvoice,
          total: Number(updatedInvoice.total),
          amountPaid: Number(updatedInvoice.amountPaid),
          amountDue: Number(updatedInvoice.amountDue),
        } : null,
        customer: updatedCustomer,
      },
      message: 'Credit note updated successfully',
    })
  } catch (error) {
    console.error('Error updating credit note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/credit-notes/[id] - Annuler l'avoir
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: creditNoteId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent annuler
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

    // Vérifier que l'avoir existe
    const creditNote = await prisma.creditNote.findUnique({
      where: { id: creditNoteId },
    })

    if (!creditNote) {
      return NextResponse.json({ error: 'Credit note not found' }, { status: 404 })
    }

    // Ne pas annuler un avoir déjà annulé
    if (creditNote.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Credit note is already cancelled' },
        { status: 400 }
      )
    }

    // Si l'avoir a été appliqué, il faut reverser l'effet sur la facture
    if (creditNote.status === 'APPLIED') {
      // Fetch the invoice to reverse the credit note effect
      const invoice = await prisma.invoice.findUnique({
        where: { id: creditNote.invoiceId },
        select: {
          amountPaid: true,
          total: true,
          status: true,
        },
      })

      if (!invoice) {
        return NextResponse.json({ error: 'Associated invoice not found' }, { status: 404 })
      }

      const creditAmount = Number(creditNote.amount)
      const newAmountPaid = Number(invoice.amountPaid) - creditAmount
      const newAmountDue = Number(invoice.total) - newAmountPaid

      let newInvoiceStatus = invoice.status
      if (newAmountPaid <= 0) {
        newInvoiceStatus = 'PENDING'
      } else if (newAmountDue > 0) {
        newInvoiceStatus = 'PARTIALLY_PAID'
      }

      await prisma.invoice.update({
        where: { id: creditNote.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newInvoiceStatus,
          paidAt: newInvoiceStatus === 'PAID' ? new Date() : null,
        },
      })
    }

    // Annuler l'avoir
    const cancelledCreditNote = await prisma.creditNote.update({
      where: { id: creditNoteId },
      data: {
        status: 'CANCELLED',
        notes: `${creditNote.notes || ''}\n\nAnnulation: ${reason}`.trim(),
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'CreditNote',
        entityId: creditNoteId,
        changes: {
          action: 'CANCELLED',
          reason,
          cancelledBy: user.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      creditNote: {
        id: cancelledCreditNote.id,
        creditNoteNumber: cancelledCreditNote.creditNoteNumber,
        status: cancelledCreditNote.status,
        amount: Number(cancelledCreditNote.amount),
      },
      message: 'Credit note cancelled successfully',
    })
  } catch (error) {
    console.error('Error cancelling credit note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
