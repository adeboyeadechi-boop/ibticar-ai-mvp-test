// API Route pour dashboard consolidé multi-sites
// GET /api/dashboard/consolidated - Agrège les données de stock de tous les sites

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { VehicleStatus } from '@/generated/prisma'

// GET /api/dashboard/consolidated - Dashboard consolidé
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent voir le dashboard consolidé
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Paramètres de filtrage optionnels
    const searchParams = request.nextUrl.searchParams
    const teamIds = searchParams.get('teamIds')?.split(',')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    // Construire les filtres
    const where: any = {}

    if (teamIds && teamIds.length > 0) {
      where.teamId = { in: teamIds }
    }

    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) where.createdAt.gte = new Date(fromDate)
      if (toDate) where.createdAt.lte = new Date(toDate)
    }

    // 1. Statistiques globales
    const [
      totalVehicles,
      availableVehicles,
      reservedVehicles,
      soldVehicles,
      teams,
    ] = await Promise.all([
      prisma.vehicle.count({ where }),
      prisma.vehicle.count({ where: { ...where, status: 'AVAILABLE' } }),
      prisma.vehicle.count({ where: { ...where, status: 'RESERVED' } }),
      prisma.vehicle.count({ where: { ...where, status: 'SOLD' } }),
      prisma.team.findMany({
        select: { id: true, name: true, type: true, city: true, wilaya: true },
      }),
    ])

    // 2. Calcul valeur totale du stock (véhicules disponibles + réservés)
    const stockValue = await prisma.vehicle.aggregate({
      where: {
        ...where,
        status: { in: ['AVAILABLE', 'RESERVED'] },
      },
      _sum: {
        purchasePrice: true,
        sellingPrice: true,
      },
    })

    const totalPurchaseValue = Number(stockValue._sum.purchasePrice || 0)
    const totalSellingValue = Number(stockValue._sum.sellingPrice || 0)
    const totalMargin = totalSellingValue - totalPurchaseValue
    const avgMarginPercentage = totalPurchaseValue > 0
      ? (totalMargin / totalPurchaseValue) * 100
      : 0

    // 3. Répartition par site (team)
    const vehiclesByTeam = await prisma.vehicle.groupBy({
      by: ['teamId', 'status'],
      where,
      _count: true,
    })

    // Agréger par team avec tous les statuts
    const teamsMap = new Map(teams.map(t => [t.id, { ...t, stats: {} as any }]))

    vehiclesByTeam.forEach(group => {
      const team = teamsMap.get(group.teamId)
      if (team) {
        if (!team.stats[group.status]) {
          team.stats[group.status] = 0
        }
        team.stats[group.status] = group._count
      }
    })

    const teamsSummary = Array.from(teamsMap.values()).map(team => ({
      ...team,
      total: Object.values(team.stats).reduce((sum: number, count: any) => sum + count, 0),
    }))

    // 4. Top marques
    const topBrands = await prisma.vehicle.groupBy({
      by: ['vehicleModelId'],
      where,
      _count: true,
      orderBy: {
        _count: {
          vehicleModelId: 'desc',
        },
      },
      take: 10,
    })

    // Enrichir avec les noms de marques/modèles
    const modelIds = topBrands.map(b => b.vehicleModelId)
    const models = await prisma.vehicleModel.findMany({
      where: { id: { in: modelIds } },
      include: {
        brand: {
          select: { name: true },
        },
      },
    })

    const modelsMap = new Map(models.map(m => [m.id, m]))

    const topModels = topBrands.map(item => {
      const model = modelsMap.get(item.vehicleModelId)
      return {
        brandName: model?.brand.name || 'Unknown',
        modelName: model?.name || 'Unknown',
        count: item._count,
      }
    })

    // 5. Véhicules immobilisés (>90 jours sans vente)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const staleVehicles = await prisma.vehicle.count({
      where: {
        ...where,
        status: 'AVAILABLE',
        createdAt: {
          lte: ninetyDaysAgo,
        },
      },
    })

    // 6. Taux de rotation (véhicules vendus / stock moyen) - approximation
    const rotationRate = totalVehicles > 0
      ? (soldVehicles / totalVehicles) * 100
      : 0

    // 7. Véhicules par condition
    const vehiclesByCondition = await prisma.vehicle.groupBy({
      by: ['condition'],
      where,
      _count: true,
    })

    const conditionSummary = vehiclesByCondition.map(item => ({
      condition: item.condition,
      count: item._count,
    }))

    // 8. Véhicules par année (top 5 années)
    const vehiclesByYear = await prisma.vehicle.groupBy({
      by: ['year'],
      where,
      _count: true,
      orderBy: {
        _count: {
          year: 'desc',
        },
      },
      take: 5,
    })

    const yearSummary = vehiclesByYear.map(item => ({
      year: item.year,
      count: item._count,
    }))

    // Retourner le dashboard consolidé
    return NextResponse.json({
      summary: {
        totalVehicles,
        availableVehicles,
        reservedVehicles,
        soldVehicles,
        staleVehicles,
        totalSites: teams.length,
      },
      financials: {
        totalPurchaseValue,
        totalSellingValue,
        totalMargin,
        avgMarginPercentage: Math.round(avgMarginPercentage * 100) / 100,
      },
      performance: {
        rotationRate: Math.round(rotationRate * 100) / 100,
        avgDaysToSell: null, // TODO: Calculer avec historique ventes
      },
      breakdown: {
        byTeam: teamsSummary,
        byCondition: conditionSummary,
        byYear: yearSummary,
        topModels,
      },
      filters: {
        teamIds: teamIds || 'all',
        fromDate: fromDate || null,
        toDate: toDate || null,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error generating consolidated dashboard:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
