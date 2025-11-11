// API Route pour prédictions IA rotation stock
// POST /api/ai/predict - Génère des prédictions de rotation stock

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { PredictionType } from '@/generated/prisma'

// POST /api/ai/predict - Génère prédictions
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent générer des prédictions
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les paramètres
    const body = await request.json()
    const { type, teamId, vehicleId, period } = body

    // Valider le type
    const validTypes: PredictionType[] = ['SALES', 'PRICE', 'DEMAND', 'ROTATION']
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid prediction type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Générer la prédiction selon le type
    let prediction
    switch (type) {
      case 'ROTATION':
        prediction = await predictRotation(teamId, vehicleId, period)
        break
      case 'SALES':
        prediction = await predictSales(teamId, period)
        break
      case 'PRICE':
        prediction = await predictOptimalPrice(vehicleId)
        break
      case 'DEMAND':
        prediction = await predictDemand(teamId, period)
        break
      default:
        return NextResponse.json({ error: 'Unsupported prediction type' }, { status: 400 })
    }

    // Sauvegarder la prédiction
    const savedPrediction = await prisma.aIPrediction.create({
      data: {
        type: type as PredictionType,
        entityType: vehicleId ? 'Vehicle' : 'Team',
        entityId: vehicleId || teamId,
        prediction: prediction.result,
        confidence: prediction.confidence,
        features: prediction.features,
        period: period ? new Date(period) : new Date(),
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'AIPrediction',
        entityId: savedPrediction.id,
        changes: {
          type,
          entityId: vehicleId || teamId,
        },
      },
    })

    return NextResponse.json({
      success: true,
      prediction: savedPrediction,
    })
  } catch (error) {
    console.error('Error generating AI prediction:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Prédire la rotation stock d'un véhicule spécifique ou d'une équipe
async function predictRotation(teamId?: string, vehicleId?: string, period?: string) {
  // Récupérer les données historiques
  const where: any = {}
  if (teamId) where.teamId = teamId
  if (vehicleId) where.id = vehicleId

  const vehicles = await prisma.vehicle.findMany({
    where,
    select: {
      id: true,
      vin: true,
      year: true,
      mileage: true,
      purchasePrice: true,
      sellingPrice: true,
      condition: true,
      status: true,
      soldAt: true,
      createdAt: true,
      model: {
        select: {
          name: true,
          brand: {
            select: { name: true },
          },
        },
      },
    },
    take: 100, // Limiter pour performance
  })

  // Calculer des métriques
  const totalVehicles = vehicles.length
  const soldVehicles = vehicles.filter(v => v.status === 'SOLD').length
  const avgDaysToSell = vehicles
    .filter(v => v.soldAt)
    .map(v => {
      const days = Math.floor(
        (new Date(v.soldAt!).getTime() - new Date(v.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      return days
    })
    .reduce((sum, days) => sum + days, 0) / soldVehicles || 0

  // Analyser les véhicules disponibles
  const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE')
  const slowMovers = availableVehicles.filter(v => {
    const daysInStock = Math.floor(
      (new Date().getTime() - new Date(v.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
    return daysInStock > 90
  })

  const fastMovers = availableVehicles.filter(v => {
    const daysInStock = Math.floor(
      (new Date().getTime() - new Date(v.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
    return daysInStock < 30
  })

  // Calculer les prédictions
  const rotationRate = totalVehicles > 0 ? (soldVehicles / totalVehicles) * 100 : 0
  const predictedSalesNext30Days = Math.round((soldVehicles / 90) * 30) // Estimation basée sur 90 derniers jours

  // Construire la prédiction
  const result = {
    rotationRate: Math.round(rotationRate * 100) / 100,
    avgDaysToSell: Math.round(avgDaysToSell),
    slowMovers: slowMovers.length,
    fastMovers: fastMovers.length,
    predictedSalesNext30Days,
    recommendations: [
      slowMovers.length > 5 ? 'Consider price reductions for slow-moving vehicles' : null,
      fastMovers.length > 10 ? 'Stock more vehicles similar to fast-movers' : null,
      avgDaysToSell > 60 ? 'Improve marketing and promotion strategies' : null,
    ].filter(Boolean),
  }

  // Confiance basée sur la taille de l'échantillon
  const confidence = Math.min(0.95, totalVehicles / 100)

  return {
    result,
    confidence,
    features: {
      totalVehicles,
      soldVehicles,
      availableVehicles: availableVehicles.length,
      period: period || 'last_90_days',
    },
  }
}

// Prédire les ventes futures
async function predictSales(teamId?: string, period?: string) {
  const where: any = {
    status: 'SOLD',
  }
  if (teamId) where.teamId = teamId

  // Récupérer l'historique des ventes (3 derniers mois)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  where.soldAt = {
    gte: threeMonthsAgo,
  }

  const salesHistory = await prisma.vehicle.findMany({
    where,
    select: {
      soldAt: true,
      sellingPrice: true,
    },
  })

  const totalSales = salesHistory.length
  const totalRevenue = salesHistory.reduce((sum, v) => sum + Number(v.sellingPrice), 0)

  // Prédiction simple: tendance linéaire
  const avgSalesPerMonth = totalSales / 3
  const predictedSalesNextMonth = Math.round(avgSalesPerMonth)
  const predictedRevenueNextMonth = Math.round((totalRevenue / 3))

  return {
    result: {
      predictedSalesNextMonth,
      predictedRevenueNextMonth,
      trend: avgSalesPerMonth > 10 ? 'increasing' : 'stable',
    },
    confidence: 0.75,
    features: {
      historicalSales: totalSales,
      historicalRevenue: totalRevenue,
      period: '3_months',
    },
  }
}

// Prédire le prix optimal pour un véhicule
async function predictOptimalPrice(vehicleId?: string) {
  if (!vehicleId) {
    throw new Error('vehicleId is required for price prediction')
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      model: {
        include: {
          brand: true,
        },
      },
    },
  })

  if (!vehicle) {
    throw new Error('Vehicle not found')
  }

  // Trouver des véhicules similaires vendus
  const similarVehicles = await prisma.vehicle.findMany({
    where: {
      vehicleModelId: vehicle.vehicleModelId,
      status: 'SOLD',
      year: {
        gte: vehicle.year - 2,
        lte: vehicle.year + 2,
      },
    },
    select: {
      sellingPrice: true,
      mileage: true,
      soldAt: true,
    },
    take: 50,
  })

  if (similarVehicles.length === 0) {
    // Pas assez de données, utiliser le prix actuel
    return {
      result: {
        currentPrice: Number(vehicle.sellingPrice),
        optimalPrice: Number(vehicle.sellingPrice),
        confidence: 'low',
        reason: 'Insufficient market data for this model',
      },
      confidence: 0.3,
      features: {
        similarVehiclesFound: 0,
      },
    }
  }

  // Calculer le prix moyen des véhicules similaires
  const avgSellingPrice = similarVehicles.reduce((sum, v) => sum + Number(v.sellingPrice), 0) / similarVehicles.length

  // Ajuster selon le kilométrage
  const avgMileage = similarVehicles.reduce((sum, v) => sum + (v.mileage || 0), 0) / similarVehicles.length
  const mileageFactor = vehicle.mileage ? (avgMileage - vehicle.mileage) / avgMileage : 0
  const mileageAdjustment = avgSellingPrice * mileageFactor * 0.1 // 10% impact max

  const optimalPrice = Math.round(avgSellingPrice + mileageAdjustment)

  return {
    result: {
      currentPrice: Number(vehicle.sellingPrice),
      optimalPrice,
      marketAverage: Math.round(avgSellingPrice),
      recommendation: optimalPrice > Number(vehicle.sellingPrice) ? 'increase_price' : 'decrease_price',
      potentialGain: optimalPrice - Number(vehicle.sellingPrice),
    },
    confidence: 0.85,
    features: {
      similarVehiclesFound: similarVehicles.length,
      avgMileage,
      vehicleMileage: vehicle.mileage,
    },
  }
}

// Prédire la demande future
async function predictDemand(teamId?: string, period?: string) {
  // Analyser les leads et recherches récentes (approximation)
  // Pour l'instant, retourner des données simulées
  return {
    result: {
      predictedDemandScore: 75,
      trendingCategories: ['SUV', 'SEDAN'],
      recommendedStock: 'increase_suv',
    },
    confidence: 0.70,
    features: {
      period: period || 'next_30_days',
    },
  }
}

// GET /api/ai/predict - Liste des prédictions récentes
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as PredictionType | null
    const entityId = searchParams.get('entityId')

    // Construire les filtres
    const where: any = {}
    if (type) where.type = type
    if (entityId) where.entityId = entityId

    // Récupérer les prédictions
    const predictions = await prisma.aIPrediction.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    })

    return NextResponse.json({
      predictions,
    })
  } catch (error) {
    console.error('Error fetching predictions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
