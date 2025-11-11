// API Route pour résoudre une réclamation
// POST /api/complaints/[id]/resolve - Marque comme résolu avec solution

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/complaints/[id]/resolve - Résout une réclamation
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier que la réclamation existe
    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        assignedToId: true,
        customerId: true,
      },
    })

    if (!complaint) {
      return NextResponse.json(
        { error: 'Complaint not found' },
        { status: 404 }
      )
    }

    // Permissions: ADMIN, SUPER_ADMIN, MANAGER, ou assigné
    const canResolve =
      ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role) ||
      complaint.assignedToId === user.id

    if (!canResolve) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const { resolution, satisfactionRating } = body

    if (!resolution) {
      return NextResponse.json(
        { error: 'Resolution description is required' },
        { status: 400 }
      )
    }

    // Valider la note de satisfaction (optionnelle)
    let rating: number | null = null
    if (satisfactionRating !== undefined) {
      rating = parseInt(satisfactionRating, 10)
      if (rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: 'Satisfaction rating must be between 1 and 5' },
          { status: 400 }
        )
      }
    }

    // Mettre à jour la réclamation
    const updatedComplaint = await prisma.complaint.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolution,
        satisfactionRating: rating,
        resolvedAt: new Date(),
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Complaint',
        entityId: id,
        changes: {
          action: 'resolved',
          resolution,
          satisfactionRating: rating,
          resolvedBy: user.id,
        },
      },
    })

    // TODO: Envoyer notification au client (quand module notifications sera implémenté)
    // await sendComplaintResolvedNotification(complaint.customerId, updatedComplaint)

    return NextResponse.json({
      success: true,
      message: 'Complaint resolved successfully',
      complaint: updatedComplaint,
    })
  } catch (error) {
    console.error('Error resolving complaint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
