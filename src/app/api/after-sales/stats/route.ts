// API Route pour statistiques SAV
// GET /api/after-sales/stats - Statistiques du service après-vente

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/after-sales/stats - Statistiques SAV
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent voir les stats
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    // Construire les filtres
    const where: any = {}
    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) where.createdAt.gte = new Date(fromDate)
      if (toDate) where.createdAt.lte = new Date(toDate)
    }

    // 1. Comptage par statut
    const [totalTickets, openTickets, scheduledTickets, inProgressTickets, completedTickets] =
      await Promise.all([
        prisma.afterSalesService.count({ where }),
        prisma.afterSalesService.count({ where: { ...where, status: 'OPEN' } }),
        prisma.afterSalesService.count({ where: { ...where, status: 'SCHEDULED' } }),
        prisma.afterSalesService.count({ where: { ...where, status: 'IN_PROGRESS' } }),
        prisma.afterSalesService.count({ where: { ...where, status: 'COMPLETED' } }),
      ])

    // 2. Répartition par type de service
    const ticketsByType = await prisma.afterSalesService.groupBy({
      by: ['type'],
      where,
      _count: true,
    })

    const typeBreakdown = ticketsByType.map((item) => ({
      type: item.type,
      count: item._count,
    }))

    // 3. Répartition par priorité
    const ticketsByPriority = await prisma.afterSalesService.groupBy({
      by: ['priority'],
      where,
      _count: true,
    })

    const priorityBreakdown = ticketsByPriority.map((item) => ({
      priority: item.priority,
      count: item._count,
    }))

    // 4. Coût total des interventions
    const costAggregate = await prisma.afterSalesService.aggregate({
      where: {
        ...where,
        status: 'COMPLETED',
        cost: { not: null },
      },
      _sum: {
        cost: true,
      },
      _avg: {
        cost: true,
      },
    })

    const totalCost = Number(costAggregate._sum.cost || 0)
    const avgCost = Number(costAggregate._avg.cost || 0)

    // 5. Temps moyen de résolution
    const completedTicketsWithTime = await prisma.afterSalesService.findMany({
      where: {
        ...where,
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      select: {
        createdAt: true,
        completedAt: true,
      },
    })

    const resolutionTimes = completedTicketsWithTime.map((ticket) => {
      const created = new Date(ticket.createdAt).getTime()
      const completed = new Date(ticket.completedAt!).getTime()
      return Math.floor((completed - created) / (1000 * 60 * 60)) // Heures
    })

    const avgResolutionTime =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
        : 0

    // 6. Top 5 techniciens par nombre d'interventions
    const topTechnicians = await prisma.afterSalesService.groupBy({
      by: ['assignedToId'],
      where: {
        ...where,
        assignedToId: { not: null },
      },
      _count: true,
      orderBy: {
        _count: {
          assignedToId: 'desc',
        },
      },
      take: 5,
    })

    // Enrichir avec les noms des techniciens
    const technicianIds = topTechnicians
      .map((t) => t.assignedToId)
      .filter((id): id is string => id !== null)

    const technicians = await prisma.user.findMany({
      where: { id: { in: technicianIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    })

    const techniciansMap = new Map(technicians.map((t) => [t.id, t]))

    const topTechniciansWithDetails = topTechnicians
      .filter((t) => t.assignedToId !== null)
      .map((tech) => {
        const techInfo = techniciansMap.get(tech.assignedToId!)
        return {
          technicianId: tech.assignedToId,
          technicianName: techInfo
            ? `${techInfo.firstName} ${techInfo.lastName}`
            : 'Unknown',
          email: techInfo?.email,
          ticketsHandled: tech._count,
        }
      })

    // 7. Taux de satisfaction (si disponible dans les données)
    const completionRate = totalTickets > 0 ? (completedTickets / totalTickets) * 100 : 0

    return NextResponse.json({
      summary: {
        totalTickets,
        openTickets,
        scheduledTickets,
        inProgressTickets,
        completedTickets,
        completionRate: Math.round(completionRate * 100) / 100,
      },
      breakdown: {
        byType: typeBreakdown,
        byPriority: priorityBreakdown,
      },
      financial: {
        totalCost: Math.round(totalCost * 100) / 100,
        avgCost: Math.round(avgCost * 100) / 100,
        currency: 'DZD',
      },
      performance: {
        avgResolutionTimeHours: Math.round(avgResolutionTime * 10) / 10,
        topTechnicians: topTechniciansWithDetails,
      },
      filters: {
        fromDate: fromDate || null,
        toDate: toDate || null,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching after-sales stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
