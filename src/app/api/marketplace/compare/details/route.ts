// API Route pour les détails de comparaison de véhicules (PRD-03-US-006)
// GET /api/marketplace/compare/details - Comparaison détaillée des véhicules

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// GET /api/marketplace/compare/details - Récupérer la comparaison détaillée
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Support de deux méthodes:
    // 1. Via email (pour utilisateurs avec compte)
    // 2. Via vehicleIds directement (pour invités)
    const email = searchParams.get('email')
    const vehicleIdsParam = searchParams.get('vehicleIds')

    let vehicleIds: string[] = []

    // Méthode 1: Récupérer depuis la base de données via email
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }

      const customer = await prisma.customer.findUnique({
        where: { email },
      })

      if (customer) {
        const comparison = await prisma.comparison.findFirst({
          where: { customerId: customer.id },
          orderBy: { createdAt: 'desc' },
        })

        if (comparison && Array.isArray(comparison.vehicles)) {
          vehicleIds = comparison.vehicles as string[]
        }
      }
    }

    // Méthode 2: Utiliser les vehicleIds fournis directement
    if (!vehicleIds.length && vehicleIdsParam) {
      try {
        vehicleIds = JSON.parse(vehicleIdsParam)
      } catch {
        vehicleIds = vehicleIdsParam.split(',')
      }
    }

    if (!vehicleIds.length) {
      return NextResponse.json({
        vehicles: [],
        message: 'No vehicles to compare',
      })
    }

    // Limiter à 4 véhicules
    if (vehicleIds.length > 4) {
      vehicleIds = vehicleIds.slice(0, 4)
    }

    // Récupérer les détails complets des véhicules
    const vehicles = await prisma.vehicle.findMany({
      where: {
        id: { in: vehicleIds },
        status: 'AVAILABLE',
        availableForSale: true,
        publishedAt: { not: null },
      },
      include: {
        model: {
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
                country: true,
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
            logoUrl: true,
          },
        },
        media: {
          where: {
            isPrimary: true,
          },
          take: 1,
        },
      },
    })

    // Formater pour comparaison côte à côte
    const comparison = vehicles.map((vehicle) => ({
      id: vehicle.id,
      vin: vehicle.vin,

      // Informations de base
      brand: {
        name: vehicle.model.brand.name,
        logo: vehicle.model.brand.logoUrl,
        country: vehicle.model.brand.country,
      },
      model: {
        name: vehicle.model.name,
        category: vehicle.model.category,
      },

      // Année et état
      year: vehicle.year,
      mileage: vehicle.mileage,
      color: vehicle.color,
      condition: vehicle.condition,

      // Prix
      price: {
        selling: Number(vehicle.sellingPrice),
        currency: 'DZD',
      },

      // Caractéristiques techniques
      specifications: {
        fuelType: vehicle.model.fuelType,
        transmission: vehicle.model.transmission,
        horsePower: vehicle.model.horsePower,
        engineSize: vehicle.model.engineCapacity,
        doors: vehicle.model.doors,
        seats: vehicle.model.seats,
        co2Emissions: vehicle.model.co2Emission,
      },

      // Équipements
      features: vehicle.features || [],
      energyClass: vehicle.energyClass,

      // Vendeur
      dealer: {
        name: vehicle.team.name,
        city: vehicle.team.city,
        wilaya: vehicle.team.wilaya,
        phone: vehicle.team.phone,
      },

      // Image principale
      image: vehicle.media[0]?.url || null,

      // Statistiques
      viewCount: vehicle.viewCount || 0,
      publishedAt: vehicle.publishedAt,
    }))

    // Générer une matrice de différences pour faciliter la comparaison
    const differences = generateComparisonMatrix(comparison)

    return NextResponse.json({
      vehicles: comparison,
      count: comparison.length,
      differences,
      comparisonMetrics: {
        priceRange: {
          min: Math.min(...comparison.map((v) => v.price.selling)),
          max: Math.max(...comparison.map((v) => v.price.selling)),
          average:
            comparison.reduce((sum, v) => sum + v.price.selling, 0) / comparison.length,
        },
        mileageRange: {
          min: Math.min(...comparison.map((v) => v.mileage).filter((m): m is number => m !== null)),
          max: Math.max(...comparison.map((v) => v.mileage).filter((m): m is number => m !== null)),
        },
        yearRange: {
          min: Math.min(...comparison.map((v) => v.year)),
          max: Math.max(...comparison.map((v) => v.year)),
        },
      },
    })
  } catch (error) {
    console.error('Error fetching comparison details:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fonction helper pour générer une matrice de différences
function generateComparisonMatrix(vehicles: any[]) {
  if (vehicles.length < 2) return {}

  const matrix: any = {
    price: {},
    mileage: {},
    year: {},
    horsePower: {},
    fuelType: {},
    transmission: {},
  }

  // Prix
  const prices = vehicles.map((v) => v.price.selling)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  vehicles.forEach((v, i) => {
    if (v.price.selling === minPrice) {
      matrix.price[i] = 'lowest'
    } else if (v.price.selling === maxPrice) {
      matrix.price[i] = 'highest'
    } else {
      matrix.price[i] = 'medium'
    }
  })

  // Kilométrage (moins = mieux)
  const mileages = vehicles.map((v) => v.mileage)
  const minMileage = Math.min(...mileages)
  const maxMileage = Math.max(...mileages)
  vehicles.forEach((v, i) => {
    if (v.mileage === minMileage) {
      matrix.mileage[i] = 'best'
    } else if (v.mileage === maxMileage) {
      matrix.mileage[i] = 'worst'
    } else {
      matrix.mileage[i] = 'medium'
    }
  })

  // Année (plus récent = mieux)
  const years = vehicles.map((v) => v.year)
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)
  vehicles.forEach((v, i) => {
    if (v.year === maxYear) {
      matrix.year[i] = 'newest'
    } else if (v.year === minYear) {
      matrix.year[i] = 'oldest'
    } else {
      matrix.year[i] = 'medium'
    }
  })

  // Puissance (plus = mieux)
  const horsePowers = vehicles.map((v) => v.specifications.horsePower || 0)
  const minHP = Math.min(...horsePowers)
  const maxHP = Math.max(...horsePowers)
  vehicles.forEach((v, i) => {
    const hp = v.specifications.horsePower || 0
    if (hp === maxHP) {
      matrix.horsePower[i] = 'highest'
    } else if (hp === minHP) {
      matrix.horsePower[i] = 'lowest'
    } else {
      matrix.horsePower[i] = 'medium'
    }
  })

  return matrix
}
