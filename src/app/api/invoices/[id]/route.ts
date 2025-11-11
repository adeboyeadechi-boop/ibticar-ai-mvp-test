// API Routes pour la gestion individuelle des factures (PRD-02-US-002)
// GET /api/invoices/[id] - Détails d'une facture
// PUT /api/invoices/[id] - Modifier une facture
// DELETE /api/invoices/[id] - Annuler une facture

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/invoices/[id] - Détails de la facture
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: invoiceId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer la facture
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        quoteId: true,
        customerId: true,
        teamId: true,
        createdById: true,
        status: true,
        type: true,
        issueDate: true,
        dueDate: true,
        subtotal: true,
        taxAmount: true,
        discountAmount: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        currency: true,
        terms: true,
        notes: true,
        sentAt: true,
        paidAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Fetch related data
    const [customer, team, createdBy, quote, items, payments, creditNotes] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: invoice.customerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          wilaya: true,
          companyName: true,
          taxId: true,
          type: true,
        },
      }),
      prisma.team.findUnique({
        where: { id: invoice.teamId },
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          wilaya: true,
          phone: true,
          email: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: invoice.createdById },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      }),
      invoice.quoteId
        ? prisma.quote.findUnique({
            where: { id: invoice.quoteId },
            select: {
              id: true,
              quoteNumber: true,
              createdAt: true,
              validUntil: true,
            },
          })
        : Promise.resolve(null),
      prisma.invoiceItem.findMany({
        where: { invoiceId },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          taxRate: true,
          discountRate: true,
          total: true,
          vehicleId: true,
          order: true,
        },
      }),
      prisma.payment.findMany({
        where: { invoiceId },
        orderBy: { paymentDate: 'desc' },
      }),
      prisma.creditNote.findMany({
        where: { invoiceId },
        select: {
          id: true,
          creditNoteNumber: true,
          amount: true,
          reason: true,
          status: true,
          issueDate: true,
        },
      }),
    ])

    // Fetch vehicles for items
    const vehicleIds = items.map(i => i.vehicleId).filter(Boolean) as string[]
    const vehicles = vehicleIds.length > 0
      ? await prisma.vehicle.findMany({
          where: { id: { in: vehicleIds } },
          select: {
            id: true,
            vin: true,
            year: true,
            color: true,
            vehicleModelId: true,
          },
        })
      : []

    const modelIds = [...new Set(vehicles.map(v => v.vehicleModelId))]
    const models = modelIds.length > 0
      ? await prisma.vehicleModel.findMany({
          where: { id: { in: modelIds } },
          select: {
            id: true,
            name: true,
            brandId: true,
          },
        })
      : []

    const brandIds = [...new Set(models.map(m => m.brandId))]
    const brands = brandIds.length > 0
      ? await prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: {
            id: true,
            name: true,
          },
        })
      : []

    // Create lookup maps
    const vehicleMap = new Map(vehicles.map(v => [v.id, v]))
    const modelMap = new Map(models.map(m => [m.id, m]))
    const brandMap = new Map(brands.map(b => [b.id, b]))

    return NextResponse.json({
      invoice: {
        ...invoice,
        subtotal: Number(invoice.subtotal),
        taxAmount: Number(invoice.taxAmount),
        discountAmount: Number(invoice.discountAmount),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        amountDue: Number(invoice.amountDue),
        customer,
        team,
        createdBy,
        quote,
        items: items.map((item) => {
          const vehicle = item.vehicleId ? vehicleMap.get(item.vehicleId) : null
          const model = vehicle ? modelMap.get(vehicle.vehicleModelId) : null
          const brand = model ? brandMap.get(model.brandId) : null

          return {
            ...item,
            unitPrice: Number(item.unitPrice),
            taxRate: Number(item.taxRate),
            discountRate: Number(item.discountRate),
            total: Number(item.total),
            vehicle: vehicle && model && brand ? {
              id: vehicle.id,
              vin: vehicle.vin,
              year: vehicle.year,
              color: vehicle.color,
              model: {
                name: model.name,
                brand: {
                  name: brand.name,
                },
              },
            } : null,
          }
        }),
        payments: payments.map((payment) => ({
          ...payment,
          amount: Number(payment.amount),
        })),
        creditNotes: creditNotes.map((cn) => ({
          ...cn,
          amount: Number(cn.amount),
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/invoices/[id] - Modifier la facture
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: invoiceId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent modifier
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const { dueDate, notes, terms, status } = body

    // Vérifier que la facture existe
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Ne pas permettre la modification si la facture est annulée ou payée
    if (['CANCELLED', 'PAID'].includes(existingInvoice.status)) {
      return NextResponse.json(
        { error: 'Cannot modify cancelled or fully paid invoice' },
        { status: 400 }
      )
    }

    // Construire les données de mise à jour
    const updateData: any = {}

    if (dueDate) updateData.dueDate = new Date(dueDate)
    if (notes !== undefined) updateData.notes = notes
    if (terms !== undefined) updateData.terms = terms

    // Seuls certains changements de statut sont permis
    if (status) {
      const allowedTransitions: Record<string, string[]> = {
        DRAFT: ['UNPAID', 'CANCELLED'],
        UNPAID: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
        PARTIALLY_PAID: ['PAID', 'OVERDUE', 'CANCELLED'],
        OVERDUE: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
      }

      const currentStatus = existingInvoice.status
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

      if (status === 'PAID') {
        updateData.paidAt = new Date()
      } else if (status === 'CANCELLED') {
        updateData.cancelledAt = new Date()
      }
    }

    // Mettre à jour la facture
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    })

    // Fetch related data
    const [customer, team, items] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: invoice.customerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      }),
      prisma.team.findUnique({
        where: { id: invoice.teamId },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.invoiceItem.findMany({
        where: { invoiceId },
        orderBy: { order: 'asc' },
      }),
    ])

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Invoice',
        entityId: invoiceId,
        changes: updateData,
      },
    })

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        subtotal: Number(invoice.subtotal),
        taxAmount: Number(invoice.taxAmount),
        discountAmount: Number(invoice.discountAmount),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        amountDue: Number(invoice.amountDue),
        customer,
        team,
        items: items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          discountRate: Number(item.discountRate),
          total: Number(item.total),
        })),
      },
      message: 'Invoice updated successfully',
    })
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/invoices/[id] - Annuler la facture
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: invoiceId } = await params

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

    // Vérifier que la facture existe
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Ne pas annuler si déjà annulée
    if (invoice.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Invoice is already cancelled' },
        { status: 400 }
      )
    }

    // Ne pas annuler si déjà payée
    if (invoice.status === 'PAID') {
      return NextResponse.json(
        { error: 'Cannot cancel fully paid invoice. Create a credit note instead.' },
        { status: 400 }
      )
    }

    // Fetch payments separately
    const payments = await prisma.payment.findMany({
      where: { invoiceId },
    })

    // Si des paiements ont été effectués, prévenir l'utilisateur
    const totalPayments = payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    )

    if (totalPayments > 0) {
      return NextResponse.json(
        {
          error: 'Cannot cancel invoice with payments. Create a credit note for refund.',
          amountPaid: totalPayments,
        },
        { status: 400 }
      )
    }

    // Annuler la facture (soft delete - changement de statut)
    const cancelledInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        notes: `${invoice.notes || ''}\n\nAnnulation: ${reason}`.trim(),
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Invoice',
        entityId: invoiceId,
        changes: {
          action: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: user.id,
          reason,
        },
      },
    })

    return NextResponse.json({
      success: true,
      invoice: {
        id: cancelledInvoice.id,
        invoiceNumber: cancelledInvoice.invoiceNumber,
        status: cancelledInvoice.status,
        cancelledAt: cancelledInvoice.cancelledAt,
      },
      message: 'Invoice cancelled successfully',
    })
  } catch (error) {
    console.error('Error cancelling invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
