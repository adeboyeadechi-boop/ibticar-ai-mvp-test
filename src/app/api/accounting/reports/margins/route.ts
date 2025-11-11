// API Route pour rapports de marges et analyses financières
// GET /api/accounting/reports/margins - Analyse des marges par véhicule/équipe

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/accounting/reports/margins - Rapport de marges
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent voir les rapports financiers
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const teamId = searchParams.get('teamId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const vehicleId = searchParams.get('vehicleId')
    const groupBy = searchParams.get('groupBy') || 'vehicle' // vehicle, team, month

    // Construire les filtres
    const where: any = {
      status: 'SOLD',
      soldAt: { not: null },
    }

    if (teamId) where.teamId = teamId
    if (vehicleId) where.id = vehicleId

    if (fromDate || toDate) {
      where.soldAt = {}
      if (fromDate) where.soldAt.gte = new Date(fromDate)
      if (toDate) where.soldAt.lte = new Date(toDate)
    }

    // Récupérer les véhicules vendus avec calcul des marges
    const soldVehicles = await prisma.vehicle.findMany({
      where,
      select: {
        id: true,
        vin: true,
        purchasePrice: true,
        sellingPrice: true,
        currency: true,
        soldAt: true,
        teamId: true,
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
        team: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        soldAt: 'desc',
      },
      take: 500, // Limiter pour performance
    })

    // Calculer les marges pour chaque véhicule
    const vehiclesWithMargins = soldVehicles.map((vehicle) => {
      const purchasePrice = Number(vehicle.purchasePrice)
      const sellingPrice = Number(vehicle.sellingPrice)
      const margin = sellingPrice - purchasePrice
      const marginPercentage = purchasePrice > 0 ? (margin / purchasePrice) * 100 : 0

      return {
        vehicleId: vehicle.id,
        vin: vehicle.vin,
        brandName: vehicle.model.brand.name,
        modelName: vehicle.model.name,
        teamName: vehicle.team.name,
        teamCode: vehicle.team.code,
        teamId: vehicle.teamId,
        purchasePrice,
        sellingPrice,
        margin,
        marginPercentage: Math.round(marginPercentage * 100) / 100,
        currency: vehicle.currency,
        soldAt: vehicle.soldAt,
      }
    })

    // Calculs globaux
    const totalPurchase = vehiclesWithMargins.reduce((sum, v) => sum + v.purchasePrice, 0)
    const totalSales = vehiclesWithMargins.reduce((sum, v) => sum + v.sellingPrice, 0)
    const totalMargin = totalSales - totalPurchase
    const avgMarginPercentage = totalPurchase > 0 ? (totalMargin / totalPurchase) * 100 : 0

    // Groupement selon le paramètre
    let groupedData: any = {}

    if (groupBy === 'team') {
      // Grouper par équipe
      groupedData = vehiclesWithMargins.reduce((acc: any, vehicle) => {
        const key = vehicle.teamId
        if (!acc[key]) {
          acc[key] = {
            teamId: vehicle.teamId,
            teamName: vehicle.teamName,
            teamCode: vehicle.teamCode,
            totalPurchase: 0,
            totalSales: 0,
            totalMargin: 0,
            count: 0,
            vehicles: [],
          }
        }
        acc[key].totalPurchase += vehicle.purchasePrice
        acc[key].totalSales += vehicle.sellingPrice
        acc[key].totalMargin += vehicle.margin
        acc[key].count += 1
        acc[key].vehicles.push(vehicle)
        return acc
      }, {})

      // Calculer les pourcentages
      groupedData = Object.values(groupedData).map((team: any) => ({
        ...team,
        avgMarginPercentage:
          team.totalPurchase > 0
            ? Math.round(((team.totalMargin / team.totalPurchase) * 100) * 100) / 100
            : 0,
      }))
    } else if (groupBy === 'month') {
      // Grouper par mois
      groupedData = vehiclesWithMargins.reduce((acc: any, vehicle) => {
        const soldDate = new Date(vehicle.soldAt!)
        const key = `${soldDate.getFullYear()}-${String(soldDate.getMonth() + 1).padStart(2, '0')}`
        if (!acc[key]) {
          acc[key] = {
            month: key,
            totalPurchase: 0,
            totalSales: 0,
            totalMargin: 0,
            count: 0,
            vehicles: [],
          }
        }
        acc[key].totalPurchase += vehicle.purchasePrice
        acc[key].totalSales += vehicle.sellingPrice
        acc[key].totalMargin += vehicle.margin
        acc[key].count += 1
        acc[key].vehicles.push(vehicle)
        return acc
      }, {})

      // Calculer les pourcentages et trier par mois
      groupedData = Object.values(groupedData)
        .map((month: any) => ({
          ...month,
          avgMarginPercentage:
            month.totalPurchase > 0
              ? Math.round(((month.totalMargin / month.totalPurchase) * 100) * 100) / 100
              : 0,
        }))
        .sort((a: any, b: any) => a.month.localeCompare(b.month))
    }

    // Statistiques supplémentaires
    const marginRanges = {
      negative: vehiclesWithMargins.filter((v) => v.margin < 0).length,
      low: vehiclesWithMargins.filter((v) => v.margin >= 0 && v.marginPercentage < 10).length,
      medium: vehiclesWithMargins.filter((v) => v.marginPercentage >= 10 && v.marginPercentage < 20)
        .length,
      high: vehiclesWithMargins.filter((v) => v.marginPercentage >= 20).length,
    }

    // Top 5 meilleures marges
    const topMargins = [...vehiclesWithMargins]
      .sort((a, b) => b.marginPercentage - a.marginPercentage)
      .slice(0, 5)
      .map((v) => ({
        vehicleId: v.vehicleId,
        vin: v.vin,
        brandName: v.brandName,
        modelName: v.modelName,
        margin: v.margin,
        marginPercentage: v.marginPercentage,
      }))

    // Top 5 pires marges
    const worstMargins = [...vehiclesWithMargins]
      .sort((a, b) => a.marginPercentage - b.marginPercentage)
      .slice(0, 5)
      .map((v) => ({
        vehicleId: v.vehicleId,
        vin: v.vin,
        brandName: v.brandName,
        modelName: v.modelName,
        margin: v.margin,
        marginPercentage: v.marginPercentage,
      }))

    return NextResponse.json({
      summary: {
        totalVehiclesSold: vehiclesWithMargins.length,
        totalPurchase: Math.round(totalPurchase * 100) / 100,
        totalSales: Math.round(totalSales * 100) / 100,
        totalMargin: Math.round(totalMargin * 100) / 100,
        avgMarginPercentage: Math.round(avgMarginPercentage * 100) / 100,
      },
      marginRanges,
      topMargins,
      worstMargins,
      groupedData: groupBy === 'vehicle' ? vehiclesWithMargins : groupedData,
      filters: {
        teamId: teamId || 'all',
        fromDate: fromDate || null,
        toDate: toDate || null,
        groupBy,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error generating margin report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
