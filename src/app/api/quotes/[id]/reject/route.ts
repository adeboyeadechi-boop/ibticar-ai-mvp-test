// API Route pour rejeter un devis (PRD-02-US-001)
// POST /api/quotes/[id]/reject - Le client rejette le devis

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/quotes/[id]/reject - Rejeter le devis
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: quoteId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer la raison du rejet
    const body = await request.json()
    const { reason } = body

    if (!reason) {
      return NextResponse.json(
        { error: 'Reason is required for rejection' },
        { status: 400 }
      )
    }

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
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Ne pas rejeter si déjà converti en facture
    if (quote.convertedToInvoiceId) {
      return NextResponse.json(
        { error: 'Cannot reject quote that has been converted to invoice' },
        { status: 400 }
      )
    }

    // Ne pas rejeter si déjà rejeté
    if (quote.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Quote is already rejected' },
        { status: 400 }
      )
    }

    // Ne pas rejeter si déjà accepté
    if (quote.status === 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Cannot reject accepted quote' },
        { status: 400 }
      )
    }

    // Mettre à jour le statut
    const updatedQuote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        notes: `${quote.notes || ''}\n\nRaison du rejet: ${reason}`.trim(),
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
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Quote',
        entityId: quoteId,
        changes: {
          action: 'REJECTED',
          rejectedAt: new Date(),
          rejectedBy: user.id,
          reason,
        },
      },
    })

    // TODO: Envoyer une notification au vendeur
    console.log('Quote rejected notification:', {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      customerId: quote.customerId,
      reason,
    })

    return NextResponse.json({
      success: true,
      quote: {
        id: updatedQuote.id,
        quoteNumber: updatedQuote.quoteNumber,
        status: updatedQuote.status,
        rejectedAt: updatedQuote.rejectedAt,
        notes: updatedQuote.notes,
        customer: updatedQuote.customer,
        team: updatedQuote.team,
      },
      message: 'Quote rejected',
      suggestions: [
        'Analyze rejection reason',
        'Contact customer for feedback',
        'Create revised quote with adjustments',
      ],
    })
  } catch (error) {
    console.error('Error rejecting quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
