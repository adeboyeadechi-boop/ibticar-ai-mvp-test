// API Route pour la gestion des avis (ADMIN) (PRD-03-US-009)
// GET /api/reviews - Liste tous les avis (avec filtres de statut)
// PATCH /api/reviews/bulk - Approuver/rejeter en masse

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { ReviewStatus } from '@/generated/prisma'

// GET /api/reviews - Liste des avis pour modération (ADMIN)
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent modérer les avis
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as ReviewStatus | null
    const vehicleId = searchParams.get('vehicleId')
    const customerId = searchParams.get('customerId')
    const rating = searchParams.get('rating')
    const isVerified = searchParams.get('isVerified')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    if (status) where.status = status
    if (vehicleId) where.vehicleId = vehicleId
    if (customerId) where.customerId = customerId
    if (rating) where.rating = parseInt(rating, 10)
    if (isVerified !== null && isVerified !== undefined) {
      where.isVerified = isVerified === 'true'
    }

    // Compter le total
    const total = await prisma.review.count({ where })

    // Récupérer les avis
    const reviews = await prisma.review.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            companyName: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            vin: true,
            year: true,
            color: true,
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
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats: {
        pending: await prisma.review.count({ where: { status: 'PENDING' } }),
        approved: await prisma.review.count({ where: { status: 'APPROVED' } }),
        rejected: await prisma.review.count({ where: { status: 'REJECTED' } }),
      },
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
