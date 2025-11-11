// API Routes pour le configurateur de véhicules neufs
// GET /api/configurations - Liste des configurations disponibles
// POST /api/configurations - Créer une configuration personnalisée

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/configurations - Liste des configurations
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const vehicleModelId = searchParams.get('vehicleModelId')
    const customerId = searchParams.get('customerId')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}
    if (vehicleModelId) where.vehicleModelId = vehicleModelId

    // Compter le total
    const total = await prisma.vehicleConfiguration.count({ where })

    // Récupérer les configurations
    const configurations = await prisma.vehicleConfiguration.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    return NextResponse.json({
      configurations,
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
    console.error('Error fetching configurations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/configurations - Créer une configuration
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les données
    const body = await request.json()
    const {
      vehicleModelId,
      name,
      trim,
      basePrice,
      options,
      totalPrice,
      availability,
      deliveryTime,
    } = body

    // Valider les paramètres requis
    if (!vehicleModelId || !name || !trim || !basePrice || !totalPrice) {
      return NextResponse.json(
        { error: 'vehicleModelId, name, trim, basePrice, and totalPrice are required' },
        { status: 400 }
      )
    }

    // Vérifier que le modèle existe
    const model = await prisma.vehicleModel.findUnique({
      where: { id: vehicleModelId },
      include: {
        brand: true,
      },
    })

    if (!model) {
      return NextResponse.json({ error: 'Vehicle model not found' }, { status: 404 })
    }

    // Valider le prix total
    const calculatedTotal = calculateTotalPrice(Number(basePrice), options || {})
    if (Math.abs(calculatedTotal - Number(totalPrice)) > 1000) {
      return NextResponse.json(
        {
          error: 'Total price mismatch. Calculated total does not match provided total',
          calculatedTotal,
        },
        { status: 400 }
      )
    }

    // Créer la configuration
    const configuration = await prisma.vehicleConfiguration.create({
      data: {
        vehicleModelId,
        name,
        trim,
        basePrice: Number(basePrice),
        options: options || {},
        totalPrice: Number(totalPrice),
        availability,
        deliveryTime,
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'VehicleConfiguration',
        entityId: configuration.id,
        changes: {
          vehicleModelId,
          name,
          trim,
          totalPrice,
        },
      },
    })

    return NextResponse.json({
      success: true,
      configuration,
      message: 'Vehicle configuration created successfully',
    })
  } catch (error) {
    console.error('Error creating configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fonction pour calculer le prix total avec options
function calculateTotalPrice(basePrice: number, options: any): number {
  let total = basePrice

  // Options de couleur
  if (options.exteriorColor?.price) {
    total += Number(options.exteriorColor.price)
  }
  if (options.interiorColor?.price) {
    total += Number(options.interiorColor.price)
  }

  // Options de roues
  if (options.wheels?.price) {
    total += Number(options.wheels.price)
  }

  // Packages
  if (options.packages) {
    Object.values(options.packages).forEach((pkg: any) => {
      if (pkg.selected && pkg.price) {
        total += Number(pkg.price)
      }
    })
  }

  // Options individuelles
  if (options.individualOptions) {
    Object.values(options.individualOptions).forEach((opt: any) => {
      if (opt.selected && opt.price) {
        total += Number(opt.price)
      }
    })
  }

  return total
}
