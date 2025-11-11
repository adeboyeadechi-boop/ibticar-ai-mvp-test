// API Route pour les statistiques publiques du profil client
// GET /api/customers/[id]/profile/stats - Résumé statistique du profil

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/customers/[id]/profile/stats - Statistiques du profil
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: customerId } = await params

    // L'authentification n'est pas requise pour les stats publiques
    const { user } = await getAuthenticatedUser(request)
    const isOwner = user?.id === customerId
    const isAdmin = user && ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)

    // Vérifier que le client existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        preferences: true,
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Vérifier les paramètres de confidentialité
    const privacy = (customer.preferences as any)?.privacy || {}
    const showPurchases = privacy.showPurchases !== false

    // Récupérer les statistiques de base (toujours publiques)
    const [totalOrders, completedOrders, totalReviews, avgRating] =
      await Promise.all([
        prisma.order.count({
          where: { customerId },
        }),
        prisma.order.count({
          where: {
            customerId,
            completedAt: { not: null },
          },
        }),
        prisma.review.count({
          where: {
            customerId,
            status: 'APPROVED',
          },
        }),
        prisma.review.aggregate({
          where: {
            customerId,
            status: 'APPROVED',
          },
          _avg: {
            rating: true,
          },
        }),
      ])

    // Note: favoriteVehicle model does not exist in schema
    const favoriteCount = 0

    // Statistiques de base
    const basicStats: any = {
      memberSince: customer.createdAt,
      totalReviews,
      favoriteCount,
      averageRating: avgRating._avg.rating
        ? Math.round(avgRating._avg.rating * 10) / 10
        : 0,
    }

    // Ajouter les stats d'achat si autorisé ou si propriétaire/admin
    if (isOwner || isAdmin || showPurchases) {
      basicStats.totalOrders = totalOrders
      basicStats.completedOrders = completedOrders

      // Nombre de véhicules achetés (each order has one vehicleId)
      basicStats.vehiclesPurchased = completedOrders
    }

    // Statistiques détaillées (propriétaire ou admin seulement)
    let detailedStats = null
    if (isOwner || isAdmin) {
      const [pendingOrders, cancelledOrders, totalSpent, statusStats] = await Promise.all([
        prisma.order.count({
          where: {
            customerId,
            status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
          },
        }),
        prisma.order.count({
          where: {
            customerId,
            status: 'CANCELLED',
          },
        }),
        prisma.order.aggregate({
          where: {
            customerId,
            completedAt: { not: null },
          },
          _sum: {
            totalAmount: true,
          },
        }),
        prisma.order.groupBy({
          by: ['status'],
          where: { customerId },
          _count: {
            id: true,
          },
        }),
      ])

      // Répartition des avis par note
      const reviewDistribution = await Promise.all([
        prisma.review.count({ where: { customerId, status: 'APPROVED', rating: 5 } }),
        prisma.review.count({ where: { customerId, status: 'APPROVED', rating: 4 } }),
        prisma.review.count({ where: { customerId, status: 'APPROVED', rating: 3 } }),
        prisma.review.count({ where: { customerId, status: 'APPROVED', rating: 2 } }),
        prisma.review.count({ where: { customerId, status: 'APPROVED', rating: 1 } }),
      ])

      // Activité récente (derniers 30 jours)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const [recentOrders, recentReviews] = await Promise.all([
        prisma.order.count({
          where: {
            customerId,
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.review.count({
          where: {
            customerId,
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
      ])

      // Note: favoriteVehicle model does not exist in schema
      const recentFavorites = 0

      detailedStats = {
        orders: {
          total: totalOrders,
          completed: completedOrders,
          pending: pendingOrders,
          cancelled: cancelledOrders,
        },
        financial: {
          totalSpent: totalSpent._sum.totalAmount ? Number(totalSpent._sum.totalAmount) : 0,
          statusBreakdown: statusStats.map((stat) => ({
            status: stat.status,
            count: stat._count.id,
          })),
        },
        reviews: {
          total: totalReviews,
          averageRating: basicStats.averageRating,
          distribution: {
            5: reviewDistribution[0],
            4: reviewDistribution[1],
            3: reviewDistribution[2],
            2: reviewDistribution[3],
            1: reviewDistribution[4],
          },
        },
        activity: {
          last30Days: {
            orders: recentOrders,
            reviews: recentReviews,
            favorites: recentFavorites,
          },
        },
      }
    }

    // Badges et accomplissements
    const badges: string[] = []
    if (completedOrders >= 1) badges.push('FIRST_PURCHASE')
    if (completedOrders >= 5) badges.push('LOYAL_CUSTOMER')
    if (completedOrders >= 10) badges.push('VIP_CUSTOMER')
    if (totalReviews >= 5) badges.push('ACTIVE_REVIEWER')
    if (basicStats.averageRating >= 4.5 && totalReviews >= 3)
      badges.push('QUALITY_REVIEWER')

    return NextResponse.json({
      customerId: customer.id,
      name: `${customer.firstName} ${customer.lastName}`,
      basicStats,
      badges,
      detailedStats,
      isOwner,
    })
  } catch (error) {
    console.error('Error fetching profile stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
