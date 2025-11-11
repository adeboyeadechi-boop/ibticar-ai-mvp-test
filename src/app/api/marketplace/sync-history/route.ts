// API Route pour consulter l'historique de synchronisation marketplace
// GET /api/marketplace/sync-history - Liste des synchronisations

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/marketplace/sync-history - Historique de synchronisation
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const vehicleId = searchParams.get('vehicleId')
    const teamId = searchParams.get('teamId')
    const marketplace = searchParams.get('marketplace')
    const status = searchParams.get('status')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}
    if (vehicleId) where.vehicleId = vehicleId
    if (teamId) where.teamId = teamId
    if (marketplace) where.marketplace = marketplace
    if (status) where.status = status

    // Compter le total
    const total = await prisma.marketplaceSync.count({ where })

    // Récupérer l'historique
    const syncHistory = await prisma.marketplaceSync.findMany({
      where,
      orderBy: {
        syncedAt: 'desc',
      },
      skip,
      take: limit,
    })

    // Statistiques
    const stats = await prisma.marketplaceSync.groupBy({
      by: ['status', 'marketplace'],
      where,
      _count: true,
    })

    const statusBreakdown = stats.reduce((acc: any, stat) => {
      if (!acc[stat.marketplace]) {
        acc[stat.marketplace] = {}
      }
      acc[stat.marketplace][stat.status] = stat._count
      return acc
    }, {})

    return NextResponse.json({
      syncHistory,
      stats: statusBreakdown,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('Error fetching sync history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
