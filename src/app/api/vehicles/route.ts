// API Routes pour la gestion des véhicules
// GET /api/vehicles - Liste tous les véhicules avec filtres avancés
// POST /api/vehicles - Crée un nouveau véhicule

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { VehicleStatus, FuelType, Transmission } from '@/generated/prisma'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/vehicles - Liste tous les véhicules
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les paramètres de requête
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''

    // Filtres
    const status = searchParams.get('status') as VehicleStatus | null
    const brandId = searchParams.get('brandId') || null
    const modelId = searchParams.get('modelId') || null
    const fuelType = searchParams.get('fuelType') as FuelType | null
    const transmission = searchParams.get('transmission') as Transmission | null
    const teamId = searchParams.get('teamId') || null
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : null
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : null
    const minYear = searchParams.get('minYear') ? parseInt(searchParams.get('minYear')!) : null
    const maxYear = searchParams.get('maxYear') ? parseInt(searchParams.get('maxYear')!) : null
    const minMileage = searchParams.get('minMileage') ? parseInt(searchParams.get('minMileage')!) : null
    const maxMileage = searchParams.get('maxMileage') ? parseInt(searchParams.get('maxMileage')!) : null

    // Tri
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    // Recherche textuelle
    if (search) {
      where.OR = [
        { vin: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { color: { contains: search, mode: 'insensitive' } },
        { model: { name: { contains: search, mode: 'insensitive' } } },
        { brand: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Filtres spécifiques
    if (status) where.status = status
    if (brandId) where.brandId = brandId
    if (modelId) where.modelId = modelId
    if (fuelType) where.fuelType = fuelType
    if (transmission) where.transmission = transmission
    if (teamId) where.currentTeamId = teamId

    // Filtres de prix
    if (minPrice !== null || maxPrice !== null) {
      where.sellingPrice = {}
      if (minPrice !== null) where.sellingPrice.gte = minPrice
      if (maxPrice !== null) where.sellingPrice.lte = maxPrice
    }

    // Filtres d'année
    if (minYear !== null || maxYear !== null) {
      where.year = {}
      if (minYear !== null) where.year.gte = minYear
      if (maxYear !== null) where.year.lte = maxYear
    }

    // Filtres de kilométrage
    if (minMileage !== null || maxMileage !== null) {
      where.mileage = {}
      if (minMileage !== null) where.mileage.gte = minMileage
      if (maxMileage !== null) where.mileage.lte = maxMileage
    }

    // Construire le tri
    const orderBy: any = {}
    orderBy[sortBy] = sortOrder

    // Récupérer les véhicules
    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        select: {
          id: true,
          vin: true,
          status: true,
          condition: true,
          year: true,
          mileage: true,
          color: true,
          interiorColor: true,
          purchasePrice: true,
          sellingPrice: true,
          currency: true,
          purchaseDate: true,
          location: true,
          publishedAt: true,
          soldAt: true,
          model: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: true,
              bodyType: true,
              fuelType: true,
              transmission: true,
              seats: true,
              doors: true,
              brand: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                },
              },
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          media: {
            select: {
              id: true,
              url: true,
              type: true,
              order: true,
            },
            take: 1,
            orderBy: {
              order: 'asc',
            },
          },
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.vehicle.count({ where }),
    ])

    // Calculer les statistiques
    const stats = await prisma.vehicle.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
    })

    return NextResponse.json({
      vehicles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status
        return acc
      }, {} as Record<string, number>),
    })
  } catch (error) {
    console.error('Error fetching vehicles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/vehicles - Crée un nouveau véhicule
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification et permissions
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données du body
    const body = await request.json()
    const {
      vin,
      vehicleModelId,
      teamId,
      condition,
      year,
      mileage,
      color,
      interiorColor,
      purchasePrice,
      sellingPrice,
      currency,
      purchaseDate,
      location,
      features,
      notes,
    } = body

    // Validation des champs requis
    if (!vin || !vehicleModelId || !teamId || !year || !condition || !purchasePrice || !sellingPrice) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: vin, vehicleModelId, teamId, year, condition, purchasePrice, sellingPrice',
        },
        { status: 400 }
      )
    }

    // Vérifier si le VIN existe déjà
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { vin },
    })

    if (existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle with this VIN already exists' },
        { status: 409 }
      )
    }

    // Vérifier que le modèle existe
    const vehicleModel = await prisma.vehicleModel.findUnique({
      where: { id: vehicleModelId },
      include: {
        brand: true,
      },
    })

    if (!vehicleModel) {
      return NextResponse.json({ error: 'Vehicle model not found' }, { status: 404 })
    }

    // Vérifier que l'équipe existe
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Créer le véhicule
    const newVehicle = await prisma.vehicle.create({
      data: {
        vin,
        vehicleModelId,
        teamId,
        condition,
        year,
        mileage: mileage || 0,
        color,
        interiorColor,
        purchasePrice,
        sellingPrice,
        currency: currency || 'DZD',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        location,
        status: 'AVAILABLE',
        features: features || {},
        notes,
      },
      select: {
        id: true,
        vin: true,
        status: true,
        condition: true,
        year: true,
        mileage: true,
        color: true,
        interiorColor: true,
        purchasePrice: true,
        sellingPrice: true,
        currency: true,
        purchaseDate: true,
        location: true,
        model: {
          select: {
            id: true,
            name: true,
            slug: true,
            brand: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Vehicle',
        entityId: newVehicle.id,
        changes: { created: newVehicle },
      },
    })

    return NextResponse.json(newVehicle, { status: 201 })
  } catch (error) {
    console.error('Error creating vehicle:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
