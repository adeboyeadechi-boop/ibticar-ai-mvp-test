// API Route pour vérifier les véhicules correspondant à une alerte (PRD-03-US-010)
// GET /api/marketplace/alerts/[id]/check - Trouver les véhicules correspondants

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/marketplace/alerts/[id]/check - Vérifier les correspondances
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50)

    // Récupérer l'alerte
    const alert = await prisma.marketplaceAlert.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        criteria: true,
        customerId: true,
      },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    // Fetch customer separately
    const customer = await prisma.customer.findUnique({
      where: { id: alert.customerId },
      select: {
        email: true,
      },
    })

    // Vérifier que l'email correspond
    if (email && customer && customer.email !== email) {
      return NextResponse.json(
        { error: 'Unauthorized to check this alert' },
        { status: 403 }
      )
    }

    // Construire les filtres basés sur les critères de l'alerte
    const criteria = alert.criteria as any
    const where: any = {
      status: 'AVAILABLE',
      availableForSale: true,
      publishedAt: { not: null },
    }

    // Appliquer les critères
    if (criteria.brandId) {
      where.model = { ...where.model, brandId: criteria.brandId }
    }

    if (criteria.modelId) {
      where.modelId = criteria.modelId
    }

    if (criteria.minYear || criteria.maxYear) {
      where.year = {}
      if (criteria.minYear) where.year.gte = criteria.minYear
      if (criteria.maxYear) where.year.lte = criteria.maxYear
    }

    if (criteria.minPrice || criteria.maxPrice) {
      where.sellingPrice = {}
      if (criteria.minPrice) where.sellingPrice.gte = criteria.minPrice
      if (criteria.maxPrice) where.sellingPrice.lte = criteria.maxPrice
    }

    if (criteria.minMileage || criteria.maxMileage) {
      where.mileage = {}
      if (criteria.minMileage) where.mileage.gte = criteria.minMileage
      if (criteria.maxMileage) where.mileage.lte = criteria.maxMileage
    }

    if (criteria.fuelType) {
      where.model = { ...where.model, fuelType: criteria.fuelType }
    }

    if (criteria.transmission) {
      where.model = { ...where.model, transmission: criteria.transmission }
    }

    if (criteria.condition) {
      where.condition = criteria.condition
    }

    if (criteria.city) {
      where.team = { ...where.team, city: criteria.city }
    }

    if (criteria.wilaya) {
      where.team = { ...where.team, wilaya: criteria.wilaya }
    }

    // Filtrer par date de publication (nouveautés uniquement)
    // Par défaut, véhicules publiés dans les 7 derniers jours
    const daysBack = criteria.daysBack || 7
    const publishedAfter = new Date()
    publishedAfter.setDate(publishedAfter.getDate() - daysBack)

    where.publishedAt = {
      ...where.publishedAt,
      gte: publishedAfter,
    }

    // Récupérer les véhicules correspondants
    const vehicles = await prisma.vehicle.findMany({
      where,
      select: {
        id: true,
        year: true,
        mileage: true,
        color: true,
        sellingPrice: true,
        condition: true,
        publishedAt: true,
        vehicleModelId: true,
        teamId: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: limit,
    })

    // Fetch related data separately
    const modelIds = [...new Set(vehicles.map(v => v.vehicleModelId))]
    const teamIds = [...new Set(vehicles.map(v => v.teamId))]

    const [models, teams] = await Promise.all([
      prisma.vehicleModel.findMany({
        where: { id: { in: modelIds } },
        select: {
          id: true,
          name: true,
          fuelType: true,
          transmission: true,
          brandId: true,
        },
      }),
      prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: {
          id: true,
          name: true,
          city: true,
          wilaya: true,
        },
      }),
    ])

    // Fetch brands for models
    const brandIds = [...new Set(models.map(m => m.brandId))]
    const brands = await prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: {
        id: true,
        name: true,
      },
    })

    // Create lookup maps
    const modelMap = new Map(models.map(m => [m.id, m]))
    const teamMap = new Map(teams.map(t => [t.id, t]))
    const brandMap = new Map(brands.map(b => [b.id, b]))

    // Formater les résultats
    // Note: Media model does not exist in the schema
    const matchingVehicles = vehicles.map((vehicle) => {
      const model = modelMap.get(vehicle.vehicleModelId)
      const team = teamMap.get(vehicle.teamId)
      const brand = model ? brandMap.get(model.brandId) : null

      return {
        id: vehicle.id,
        brand: brand?.name || 'Unknown',
        brandLogo: null, // Brand model does not have logoUrl field
        model: model?.name || 'Unknown',
        year: vehicle.year,
        mileage: vehicle.mileage,
        color: vehicle.color,
        price: Number(vehicle.sellingPrice),
        condition: vehicle.condition,
        fuelType: model?.fuelType || null,
        transmission: model?.transmission || null,
        location: {
          city: team?.city || null,
          wilaya: team?.wilaya || null,
          dealer: team?.name || 'Unknown',
        },
        image: null, // Media model does not exist
        publishedAt: vehicle.publishedAt,
      }
    })

    return NextResponse.json({
      alert: {
        id: alert.id,
        name: alert.name,
        criteria: alert.criteria,
      },
      matches: matchingVehicles,
      count: matchingVehicles.length,
      message:
        matchingVehicles.length > 0
          ? `Found ${matchingVehicles.length} matching vehicle(s)`
          : 'No matching vehicles found',
    })
  } catch (error) {
    console.error('Error checking alert matches:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
