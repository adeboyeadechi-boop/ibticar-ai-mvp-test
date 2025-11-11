// API Route pour accepter un devis (PRD-02-US-001)
// POST /api/quotes/[id]/accept - Le client accepte le devis

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/quotes/[id]/accept - Accepter le devis
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: quoteId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les données optionnelles
    const body = await request.json().catch(() => ({}))
    const { notes } = body

    // Récupérer le devis
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Ne pas accepter si déjà converti en facture
    if (quote.convertedToInvoiceId) {
      return NextResponse.json(
        { error: 'Cannot accept quote that has been converted to invoice' },
        { status: 400 }
      )
    }

    // Ne pas accepter si déjà accepté
    if (quote.status === 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Quote is already accepted' },
        { status: 400 }
      )
    }

    // Ne pas accepter si rejeté
    if (quote.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Cannot accept rejected quote. Create a new quote instead.' },
        { status: 400 }
      )
    }

    // Vérifier que le devis est toujours valide
    if (new Date() > quote.validUntil) {
      return NextResponse.json(
        { error: 'Quote has expired. Please request a new quote.' },
        { status: 400 }
      )
    }

    // Mettre à jour le statut
    const updatedQuote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        notes: notes ? `${quote.notes || ''}\n\nAcceptation: ${notes}`.trim() : quote.notes,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    // Si un véhicule est associé, le réserver
    if (quote.vehicle && quote.vehicle.status === 'AVAILABLE') {
      await prisma.vehicle.update({
        where: { id: quote.vehicle.id },
        data: {
          status: 'RESERVED',
        },
      })
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Quote',
        entityId: quoteId,
        changes: {
          action: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedBy: user.id,
          notes,
        },
      },
    })

    // TODO: Envoyer une notification au vendeur
    console.log('Quote accepted notification:', {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      customerId: quote.customerId,
      total: Number(quote.total),
    })

    return NextResponse.json({
      success: true,
      quote: {
        ...updatedQuote,
        subtotal: Number(updatedQuote.subtotal),
        taxAmount: Number(updatedQuote.taxAmount),
        discountAmount: Number(updatedQuote.discountAmount),
        total: Number(updatedQuote.total),
        items: updatedQuote.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          discountRate: Number(item.discountRate),
          total: Number(item.total),
        })),
      },
      message: 'Quote accepted successfully',
      nextSteps: [
        'Convert quote to invoice',
        'Process deposit payment',
        'Schedule vehicle delivery',
      ],
    })
  } catch (error) {
    console.error('Error accepting quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
