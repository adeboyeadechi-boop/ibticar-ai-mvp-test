// API Routes pour une réclamation spécifique
// GET /api/complaints/[id] - Détails
// PATCH /api/complaints/[id] - Mettre à jour
// DELETE /api/complaints/[id] - Supprimer

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { ComplaintStatus, Priority } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/complaints/[id] - Récupère une réclamation
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: {
        id: true,
        complaintNumber: true,
        customerId: true,
        orderId: true,
        type: true,
        status: true,
        priority: true,
        subject: true,
        description: true,
        assignedToId: true,
        resolution: true,
        resolvedAt: true,
        satisfactionRating: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!complaint) {
      return NextResponse.json(
        { error: 'Complaint not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(complaint)
  } catch (error) {
    console.error('Error fetching complaint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/complaints/[id] - Met à jour une réclamation
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Permissions: ADMIN, SUPER_ADMIN, MANAGER, ou assigné à la réclamation
    const existingComplaint = await prisma.complaint.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        assignedToId: true,
      },
    })

    if (!existingComplaint) {
      return NextResponse.json(
        { error: 'Complaint not found' },
        { status: 404 }
      )
    }

    const canEdit =
      ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role) ||
      existingComplaint.assignedToId === user.id

    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const {
      status,
      priority,
      subject,
      description,
      assignedToId,
      resolution,
      satisfactionRating,
    } = body

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (status !== undefined) {
      updateData.status = status as ComplaintStatus

      // Si résolu, enregistrer la date
      if (status === 'RESOLVED' && !existingComplaint.status || existingComplaint.status !== 'RESOLVED') {
        updateData.resolvedAt = new Date()
      }
    }
    if (priority !== undefined) updateData.priority = priority as Priority
    if (subject !== undefined) updateData.subject = subject
    if (description !== undefined) updateData.description = description
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId
    if (resolution !== undefined) updateData.resolution = resolution
    if (satisfactionRating !== undefined) {
      // Validation 1-5
      const rating = parseInt(satisfactionRating, 10)
      if (rating >= 1 && rating <= 5) {
        updateData.satisfactionRating = rating
      }
    }

    // Mettre à jour
    const updatedComplaint = await prisma.complaint.update({
      where: { id },
      data: updateData,
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Complaint',
        entityId: id,
        changes: {
          before: existingComplaint,
          after: updatedComplaint,
        },
      },
    })

    return NextResponse.json({
      success: true,
      complaint: updatedComplaint,
    })
  } catch (error) {
    console.error('Error updating complaint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/complaints/[id] - Supprime une réclamation
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN et SUPER_ADMIN peuvent supprimer
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id },
    })

    if (!complaint) {
      return NextResponse.json(
        { error: 'Complaint not found' },
        { status: 404 }
      )
    }

    // Supprimer
    await prisma.complaint.delete({
      where: { id },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'Complaint',
        entityId: id,
        changes: { deleted: complaint },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Complaint deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting complaint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
