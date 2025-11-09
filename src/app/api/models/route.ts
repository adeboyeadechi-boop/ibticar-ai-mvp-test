// API Routes pour la gestion des modèles de véhicules
// GET /api/models - Liste tous les modèles
// POST /api/models - Crée un nouveau modèle

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/models - Liste tous les modèles
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les paramètres de requête
    const searchParams = request.nextUrl.searchParams
    const brandId = searchParams.get('brandId') || null
    const category = searchParams.get('category') || null
    const search = searchParams.get('search') || ''

    // Construire les filtres
    const where: any = {}
    if (brandId) where.brandId = brandId
    if (category) where.category = category
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    // Récupérer les modèles
    const models = await prisma.vehicleModel.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        bodyType: true,
        fuelType: true,
        transmission: true,
        engineCapacity: true,
        horsePower: true,
        seats: true,
        doors: true,
        specifications: true,
        isActive: true,
        brand: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        _count: {
          select: {
            vehicles: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { brand: { name: 'asc' } },
        { name: 'asc' },
      ],
    })

    return NextResponse.json({ models })
  } catch (error) {
    console.error('Error fetching models:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/models - Crée un nouveau modèle
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification et permissions
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données du body
    const body = await request.json()
    const {
      brandId,
      name,
      slug,
      category,
      bodyType,
      fuelType,
      transmission,
      engineCapacity,
      horsePower,
      co2Emission,
      energyLabel,
      seats,
      doors,
      specifications,
      translations,
    } = body

    // Validation
    if (!brandId || !name || !slug || !category || !bodyType || !fuelType || !transmission) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: brandId, name, slug, category, bodyType, fuelType, transmission',
        },
        { status: 400 }
      )
    }

    // Vérifier que la marque existe
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      )
    }

    // Vérifier si le slug existe déjà
    const existingSlug = await prisma.vehicleModel.findUnique({
      where: { slug },
    })

    if (existingSlug) {
      return NextResponse.json(
        { error: 'Model with this slug already exists' },
        { status: 409 }
      )
    }

    // Vérifier si le modèle existe déjà pour cette marque
    const existingModel = await prisma.vehicleModel.findFirst({
      where: {
        brandId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    })

    if (existingModel) {
      return NextResponse.json(
        { error: 'Model with this name already exists for this brand' },
        { status: 409 }
      )
    }

    // Créer le modèle
    const newModel = await prisma.vehicleModel.create({
      data: {
        brandId,
        name,
        slug,
        category,
        bodyType,
        fuelType,
        transmission,
        engineCapacity,
        horsePower,
        co2Emission,
        energyLabel,
        seats,
        doors,
        specifications,
        translations,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        bodyType: true,
        fuelType: true,
        transmission: true,
        engineCapacity: true,
        horsePower: true,
        co2Emission: true,
        energyLabel: true,
        seats: true,
        doors: true,
        specifications: true,
        isActive: true,
        brand: {
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
        entityType: 'VehicleModel',
        entityId: newModel.id,
        changes: { created: newModel },
      },
    })

    return NextResponse.json(newModel, { status: 201 })
  } catch (error) {
    console.error('Error creating model:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
