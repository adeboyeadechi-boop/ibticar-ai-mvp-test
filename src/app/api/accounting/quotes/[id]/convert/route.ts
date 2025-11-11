// API Route pour convertir un devis en facture
// POST /api/accounting/quotes/[id]/convert - Convertit un devis accepté en facture

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/accounting/quotes/[id]/convert - Convertir en facture
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: quoteId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent convertir des devis
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les paramètres optionnels
    const body = await request.json()
    const { paymentDueDays = 30, notes } = body

    // Vérifier que le devis existe et peut être converti
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
    })

    // Récupérer les items séparément
    const quoteItems = await prisma.quoteItem.findMany({
      where: { quoteId },
      orderBy: { order: 'asc' },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Only accepted quotes can be converted to invoices' },
        { status: 400 }
      )
    }

    if (quote.convertedToInvoiceId) {
      return NextResponse.json(
        { error: 'Quote has already been converted to an invoice' },
        { status: 400 }
      )
    }

    // Générer le numéro de facture
    const year = new Date().getFullYear()
    const count = await prisma.invoice.count({
      where: {
        teamId: quote.teamId,
        createdAt: {
          gte: new Date(`${year}-01-01`),
        },
      },
    })
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(6, '0')}`

    // Calculer la date d'échéance
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + paymentDueDays)

    // Créer la facture avec transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer la facture
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          quoteId: quote.id,
          customerId: quote.customerId,
          teamId: quote.teamId,
          createdById: user.id,
          status: 'SENT',
          type: 'STANDARD',
          issueDate: new Date(),
          dueDate,
          subtotal: quote.subtotal,
          taxAmount: quote.taxAmount,
          discountAmount: quote.discountAmount,
          total: quote.total,
          amountDue: quote.total,
          currency: quote.currency,
          notes: notes || quote.notes,
          sentAt: new Date(),
        },
      })

      // Copier les lignes du devis vers la facture
      const invoiceItems = await Promise.all(
        quoteItems.map((quoteItem: any) =>
          tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              description: quoteItem.description,
              quantity: quoteItem.quantity,
              unitPrice: quoteItem.unitPrice,
              taxRate: quoteItem.taxRate,
              discountRate: quoteItem.discountRate,
              total: quoteItem.total,
              vehicleId: quoteItem.vehicleId,
              order: quoteItem.order,
            },
          })
        )
      )

      // Marquer le devis comme converti
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          status: 'CONVERTED',
          convertedToInvoiceId: invoice.id,
          convertedAt: new Date(),
        },
      })

      // Si le devis contenait un véhicule, le réserver
      if (quote.vehicleId) {
        await tx.vehicle.update({
          where: { id: quote.vehicleId },
          data: { status: 'RESERVED' },
        })
      }

      return { invoice, invoiceItems }
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Invoice',
        entityId: result.invoice.id,
        changes: {
          convertedFromQuoteId: quoteId,
          invoiceNumber: result.invoice.invoiceNumber,
          total: Number(result.invoice.total),
        },
      },
    })

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      message: `Quote ${quote.quoteNumber} converted to invoice ${result.invoice.invoiceNumber}`,
    })
  } catch (error) {
    console.error('Error converting quote to invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
