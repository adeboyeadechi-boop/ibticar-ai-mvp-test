// API Routes pour gestion individuelle des tickets SAV
// GET /api/after-sales/[id] - Détails d'un ticket
// PUT /api/after-sales/[id] - Modifier un ticket
// DELETE /api/after-sales/[id] - Supprimer un ticket

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { ServiceType, ServiceStatus, Priority } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/after-sales/[id] - Détails du ticket
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: ticketId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer le ticket
    const ticket = await prisma.afterSalesService.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'After-sales ticket not found' }, { status: 404 })
    }

    return NextResponse.json({ ticket })
  } catch (error) {
    console.error('Error fetching after-sales ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/after-sales/[id] - Modifier le ticket
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: ticketId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les données
    const body = await request.json()
    const {
      type,
      status,
      priority,
      subject,
      description,
      assignedToId,
      scheduledAt,
      resolution,
      cost,
    } = body

    // Vérifier que le ticket existe
    const existingTicket = await prisma.afterSalesService.findUnique({
      where: { id: ticketId },
    })

    if (!existingTicket) {
      return NextResponse.json({ error: 'After-sales ticket not found' }, { status: 404 })
    }

    // Construire les données de mise à jour
    const updateData: any = {}
    if (type) updateData.type = type as ServiceType
    if (status) updateData.status = status as ServiceStatus
    if (priority) updateData.priority = priority as Priority
    if (subject) updateData.subject = subject
    if (description) updateData.description = description
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId
    if (scheduledAt !== undefined)
      updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null
    if (resolution !== undefined) updateData.resolution = resolution
    if (cost !== undefined) updateData.cost = cost ? Number(cost) : null

    // Si le statut passe à COMPLETED, enregistrer la date
    if (status === 'COMPLETED' && existingTicket.status !== 'COMPLETED') {
      updateData.completedAt = new Date()
    }

    // Mettre à jour le ticket
    const ticket = await prisma.afterSalesService.update({
      where: { id: ticketId },
      data: updateData,
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'AfterSalesService',
        entityId: ticketId,
        changes: updateData,
      },
    })

    return NextResponse.json({
      success: true,
      ticket,
      message: 'After-sales ticket updated successfully',
    })
  } catch (error) {
    console.error('Error updating after-sales ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/after-sales/[id] - Supprimer le ticket
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: ticketId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent supprimer
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le ticket existe
    const ticket = await prisma.afterSalesService.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'After-sales ticket not found' }, { status: 404 })
    }

    // Supprimer le ticket
    await prisma.afterSalesService.delete({
      where: { id: ticketId },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'AfterSalesService',
        entityId: ticketId,
        changes: {
          deletedTicket: {
            ticketNumber: ticket.ticketNumber,
            type: ticket.type,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'After-sales ticket deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting after-sales ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
