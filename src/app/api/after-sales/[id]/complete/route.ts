// API Route pour marquer un ticket SAV comme complété
// POST /api/after-sales/[id]/complete - Marque le ticket comme terminé

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/after-sales/[id]/complete - Compléter le ticket
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: ticketId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les données
    const body = await request.json()
    const { resolution, cost } = body

    if (!resolution) {
      return NextResponse.json(
        { error: 'Resolution description is required' },
        { status: 400 }
      )
    }

    // Vérifier que le ticket existe
    const ticket = await prisma.afterSalesService.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'After-sales ticket not found' }, { status: 404 })
    }

    // Vérifier que le statut permet la complétion
    if (ticket.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Ticket is already completed' },
        { status: 400 }
      )
    }

    if (ticket.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot complete a cancelled ticket' },
        { status: 400 }
      )
    }

    // Marquer comme complété
    const updatedTicket = await prisma.afterSalesService.update({
      where: { id: ticketId },
      data: {
        status: 'COMPLETED',
        resolution,
        cost: cost ? Number(cost) : null,
        completedAt: new Date(),
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'AfterSalesService',
        entityId: ticketId,
        changes: {
          action: 'completed',
          previousStatus: ticket.status,
          newStatus: 'COMPLETED',
          resolution,
          cost: cost ? Number(cost) : null,
        },
      },
    })

    // TODO: Créer notification pour le client

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: 'After-sales ticket completed successfully',
    })
  } catch (error) {
    console.error('Error completing after-sales ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
