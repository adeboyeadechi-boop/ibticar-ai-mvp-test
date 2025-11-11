// API Route pour assigner un ticket SAV à un technicien
// POST /api/after-sales/[id]/assign - Assigne le ticket à un technicien

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/after-sales/[id]/assign - Assigner le ticket
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: ticketId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent assigner
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const { assignedToId, scheduledAt } = body

    if (!assignedToId) {
      return NextResponse.json({ error: 'assignedToId is required' }, { status: 400 })
    }

    // Vérifier que le ticket existe
    const ticket = await prisma.afterSalesService.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'After-sales ticket not found' }, { status: 404 })
    }

    // Vérifier que le technicien existe
    const technician = await prisma.user.findUnique({
      where: { id: assignedToId },
    })

    if (!technician) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
    }

    // Assigner le ticket
    const updatedTicket = await prisma.afterSalesService.update({
      where: { id: ticketId },
      data: {
        assignedToId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: ticket.status === 'OPEN' ? 'SCHEDULED' : ticket.status,
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
          action: 'assigned',
          assignedToId,
          scheduledAt,
        },
      },
    })

    // TODO: Créer notification pour le technicien assigné

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: 'After-sales ticket assigned successfully',
    })
  } catch (error) {
    console.error('Error assigning after-sales ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
