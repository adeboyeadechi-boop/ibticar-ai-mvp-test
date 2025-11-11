// API Route pour le catalogue public marketplace (PRD-03-US-001)
// GET /api/marketplace/catalog - Catalogue véhicules disponibles (PUBLIC)

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { VehicleStatus } from '@/generated/prisma'

// GET /api/marketplace/catalog - Catalogue public
export async function GET(request: NextRequest) {
  try {
    // PAS D'AUTHENTIFICATION REQUISE - endpoint public

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams

    // Filtres de base
    const search = searchParams.get('search')
    const brandId = searchParams.get('brandId')
    const modelId = searchParams.get('modelId')
    const year = searchParams.get('year')
    const minYear = searchParams.get('minYear')
    const maxYear = searchParams.get('maxYear')
    const condition = searchParams.get('condition')
    const fuelType = searchParams.get('fuelType')
    const transmission = searchParams.get('transmission')
    const bodyType = searchParams.get('bodyType')

    // Filtres de prix
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')

    // Filtres de kilométrage
    const minMileage = searchParams.get('minMileage')
    const maxMileage = searchParams.get('maxMileage')

    // Filtre par ville/wilaya
    const city = searchParams.get('city')
    const wilaya = searchParams.get('wilaya')

    // Options de tri
    const sortBy = searchParams.get('sortBy') || 'publishedAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '24', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {
      status: VehicleStatus.AVAILABLE, // Seulement véhicules disponibles
      availableForSale: true, // Seulement véhicules publiés
      publishedAt: { not: null }, // Publiés sur marketplace
    }

    // Recherche textuelle multi-champs
    if (search) {
      where.OR = [
        {
          vin: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          registrationNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          color: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          model: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          model: {
            brand: {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ]
    }

    // Filtres pour le modèle (consolidés)
    const modelFilters: any = {}
    if (brandId) modelFilters.brandId = brandId
    if (fuelType) modelFilters.fuelType = fuelType
    if (transmission) modelFilters.transmission = transmission
    if (bodyType) modelFilters.category = bodyType

    // Appliquer les filtres du modèle si nécessaire
    if (Object.keys(modelFilters).length > 0) {
      where.model = modelFilters
    }

    // Filtre par modèle
    if (modelId) {
      where.vehicleModelId = modelId
    }

    // Filtre par année
    if (year) {
      where.year = parseInt(year, 10)
    } else {
      if (minYear) where.year = { ...where.year, gte: parseInt(minYear, 10) }
      if (maxYear) where.year = { ...where.year, lte: parseInt(maxYear, 10) }
    }

    // Filtre par condition
    if (condition) {
      where.condition = condition
    }

    // Filtre par prix
    if (minPrice || maxPrice) {
      where.sellingPrice = {}
      if (minPrice) where.sellingPrice.gte = Number(minPrice)
      if (maxPrice) where.sellingPrice.lte = Number(maxPrice)
    }

    // Filtre par kilométrage
    if (minMileage || maxMileage) {
      where.mileage = {}
      if (minMileage) where.mileage.gte = parseInt(minMileage, 10)
      if (maxMileage) where.mileage.lte = parseInt(maxMileage, 10)
    }

    // Filtre par localisation
    if (city || wilaya) {
      where.team = {}
      if (city) where.team.city = city
      if (wilaya) where.team.wilaya = wilaya
    }

    // Définir le tri
    const orderBy: any = {}
    if (sortBy === 'price') {
      orderBy.sellingPrice = sortOrder
    } else if (sortBy === 'year') {
      orderBy.year = sortOrder
    } else if (sortBy === 'mileage') {
      orderBy.mileage = sortOrder
    } else {
      orderBy.publishedAt = sortOrder
    }

    // Compter le total
    const total = await prisma.vehicle.count({ where })

    // Récupérer les véhicules
    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        model: {
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            city: true,
            wilaya: true,
            phone: true,
            email: true,
          },
        },
        media: {
          orderBy: {
            order: 'asc',
          },
          take: 5, // Limiter à 5 photos pour la liste
        },
      },
    })

    // Formater les résultats pour le marketplace
    const formattedVehicles = vehicles.map((vehicle) => ({
      id: vehicle.id,
      vin: vehicle.vin,
      brand: vehicle.model.brand.name,
      brandLogo: vehicle.model.brand.logoUrl,
      model: vehicle.model.name,
      year: vehicle.year,
      mileage: vehicle.mileage,
      color: vehicle.color,
      condition: vehicle.condition,
      price: Number(vehicle.sellingPrice),
      currency: 'DZD',
      fuelType: vehicle.model.fuelType,
      transmission: vehicle.model.transmission,
      horsePower: vehicle.model.horsePower,
      doors: vehicle.model.doors,
      seats: vehicle.model.seats,
      bodyType: vehicle.model.category,
      energyLabel: vehicle.energyClass,
      location: {
        city: vehicle.team.city,
        wilaya: vehicle.team.wilaya,
        dealer: vehicle.team.name,
      },
      images: vehicle.media.map((m) => ({
        url: m.url,
        isPrimary: m.isPrimary,
      })),
      mainImage: vehicle.media.find((m) => m.isPrimary)?.url || vehicle.media[0]?.url,
      publishedAt: vehicle.publishedAt,
    }))

    // Statistiques du catalogue (pour filtres)
    const stats = await generateCatalogStats()

    return NextResponse.json({
      vehicles: formattedVehicles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      filters: stats,
    })
  } catch (error) {
    console.error('Error fetching marketplace catalog:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Générer les statistiques pour les filtres
async function generateCatalogStats() {
  const baseWhere = {
    status: VehicleStatus.AVAILABLE,
    availableForSale: true,
    publishedAt: { not: null },
  }

  const [priceRange, yearRange, mileageRange, brands] = await Promise.all([
    prisma.vehicle.aggregate({
      where: baseWhere,
      _min: { sellingPrice: true },
      _max: { sellingPrice: true },
    }),
    prisma.vehicle.aggregate({
      where: baseWhere,
      _min: { year: true },
      _max: { year: true },
    }),
    prisma.vehicle.aggregate({
      where: baseWhere,
      _min: { mileage: true },
      _max: { mileage: true },
    }),
    prisma.vehicle.groupBy({
      by: ['vehicleModelId'],
      where: baseWhere,
      _count: {
        id: true,
      },
    }),
  ])

  // Compter par marque
  const brandCounts = await prisma.brand.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          models: {
            where: {
              vehicles: {
                some: baseWhere,
              },
            },
          },
        },
      },
    },
  })

  return {
    priceRange: {
      min: priceRange._min.sellingPrice ? Number(priceRange._min.sellingPrice) : 0,
      max: priceRange._max.sellingPrice ? Number(priceRange._max.sellingPrice) : 0,
    },
    yearRange: {
      min: yearRange._min.year || new Date().getFullYear() - 20,
      max: yearRange._max.year || new Date().getFullYear(),
    },
    mileageRange: {
      min: mileageRange._min.mileage || 0,
      max: mileageRange._max.mileage || 300000,
    },
    totalVehicles: brands.reduce((sum, b) => sum + b._count.id, 0),
    brands: brandCounts
      .filter((b) => b._count.models > 0)
      .map((b) => ({
        id: b.id,
        name: b.name,
        count: b._count.models,
      })),
  }
}
