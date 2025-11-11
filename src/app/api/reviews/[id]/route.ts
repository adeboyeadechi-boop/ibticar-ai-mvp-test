// API Route pour gérer un avis spécifique (ADMIN) (PRD-03-US-009)
// GET /api/reviews/[id] - Récupérer un avis
// PATCH /api/reviews/[id] - Approuver/rejeter un avis
// DELETE /api/reviews/[id] - Supprimer un avis

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { ReviewStatus } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/reviews/[id] - Récupérer un avis complet
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            companyName: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            vin: true,
            year: true,
            color: true,
            mileage: true,
            sellingPrice: true,
            model: {
              select: {
                name: true,
                brand: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    return NextResponse.json(review)
  } catch (error) {
    console.error('Error fetching review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/reviews/[id] - Approuver/rejeter un avis
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent modérer
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { status } = body

    // Validation du statut
    if (!status || !Object.values(ReviewStatus).includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Vérifier que l'avis existe
    const existingReview = await prisma.review.findUnique({
      where: { id },
    })

    if (!existingReview) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Mettre à jour l'avis
    const updateData: any = {
      status,
    }

    // Si approuvé, définir la date de publication
    if (status === 'APPROVED' && !existingReview.publishedAt) {
      updateData.publishedAt = new Date()
    }

    // Si rejeté ou repasse en attente, retirer la date de publication
    if (status !== 'APPROVED' && existingReview.publishedAt) {
      updateData.publishedAt = null
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: updateData,
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Review',
        entityId: id,
        changes: {
          before: { status: existingReview.status },
          after: { status: updatedReview.status },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `Review ${status.toLowerCase()} successfully`,
      review: {
        id: updatedReview.id,
        status: updatedReview.status,
        publishedAt: updatedReview.publishedAt,
      },
    })
  } catch (error) {
    console.error('Error updating review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/reviews/[id] - Supprimer un avis
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent supprimer
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que l'avis existe
    const existingReview = await prisma.review.findUnique({
      where: { id },
    })

    if (!existingReview) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Supprimer l'avis
    await prisma.review.delete({
      where: { id },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'Review',
        entityId: id,
        changes: { deleted: existingReview },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Review deleted successfully',
      reviewId: id,
    })
  } catch (error) {
    console.error('Error deleting review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
