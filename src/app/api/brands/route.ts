// API Routes pour la gestion des marques de véhicules
// GET /api/brands - Liste toutes les marques
// POST /api/brands - Crée une nouvelle marque

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/brands - Liste toutes les marques
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les paramètres de requête
    const searchParams = request.nextUrl.searchParams
    const includeModels = searchParams.get('includeModels') === 'true'
    const search = searchParams.get('search') || ''

    // Construire les filtres
    const where: any = {}
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    // Récupérer les marques
    const brands = await prisma.brand.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        country: true,
        isActive: true,
        ...(includeModels && {
          models: {
            select: {
              id: true,
              name: true,
              category: true,
              isActive: true,
            },
            where: {
              isActive: true,
            },
            orderBy: {
              name: 'asc',
            },
          },
          _count: {
            select: {
              models: true,
            },
          },
        }),
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ brands })
  } catch (error) {
    console.error('Error fetching brands:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/brands - Crée une nouvelle marque
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
    const { name, logo, country } = body

    // Validation
    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      )
    }

    // Vérifier si la marque existe déjà
    const existingBrand = await prisma.brand.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    })

    if (existingBrand) {
      return NextResponse.json(
        { error: 'Brand with this name already exists' },
        { status: 409 }
      )
    }

    // Créer un slug depuis le nom
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // Créer la marque
    const newBrand = await prisma.brand.create({
      data: {
        name,
        slug,
        logo,
        country,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        country: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Brand',
        entityId: newBrand.id,
        changes: { created: newBrand },
      },
    })

    return NextResponse.json(newBrand, { status: 201 })
  } catch (error) {
    console.error('Error creating brand:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
