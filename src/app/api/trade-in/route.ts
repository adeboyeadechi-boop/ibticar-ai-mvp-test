// API Route pour gérer les estimations de reprise (ADMIN) (PRD-03-US-007)
// GET /api/trade-in - Liste toutes les estimations (ADMIN)
// PATCH /api/trade-in/[id] - Approuver/rejeter une estimation

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { EstimateStatus } from '@/generated/prisma'

// GET /api/trade-in - Liste des estimations pour gestion (ADMIN)
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent voir les estimations
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as EstimateStatus | null
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}
    if (status) where.status = status

    // Compter le total
    const total = await prisma.tradeInEstimate.count({ where })

    // Récupérer les estimations
    const estimates = await prisma.tradeInEstimate.findMany({
      where,
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
        vehicleModel: {
          select: {
            id: true,
            name: true,
            brand: {
              select: {
                name: true,
                logoUrl: true,
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

    // Marquer les estimations expirées
    const now = new Date()
    const formattedEstimates = estimates.map((est) => ({
      ...est,
      estimatedValue: Number(est.estimatedValue),
      isExpired: now > est.validUntil,
    }))

    return NextResponse.json({
      estimates: formattedEstimates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats: {
        pending: await prisma.tradeInEstimate.count({ where: { status: 'PENDING' } }),
        approved: await prisma.tradeInEstimate.count({ where: { status: 'APPROVED' } }),
        rejected: await prisma.tradeInEstimate.count({ where: { status: 'REJECTED' } }),
        expired: await prisma.tradeInEstimate.count({
          where: { validUntil: { lt: now } },
        }),
      },
    })
  } catch (error) {
    console.error('Error fetching trade-in estimates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
