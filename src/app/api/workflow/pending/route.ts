// API Route pour consulter les validations en attente
// GET /api/workflow/pending - Liste des véhicules en attente de validation

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { WorkflowStage } from '@/generated/prisma'

// GET /api/workflow/pending - Récupère les validations en attente
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent voir les validations en attente
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const workflowStage = searchParams.get('stage') as WorkflowStage | null
    const entityType = searchParams.get('entityType')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {
      status: 'PENDING',
    }

    if (workflowStage) where.workflowStage = workflowStage
    if (entityType) where.entityType = entityType

    // Compter le total
    const total = await prisma.workflowValidation.count({ where })

    // Récupérer les validations
    const validations = await prisma.workflowValidation.findMany({
      where,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        workflowStage: true,
        status: true,
        comments: true,
        aiScore: true,
        aiRecommendation: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc', // Plus anciennes en premier
      },
      skip,
      take: limit,
    })

    // Enrichir avec les données des véhicules
    const vehicleIds = validations
      .filter(v => v.entityType === 'Vehicle')
      .map(v => v.entityId)

    const vehicles = await prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: {
        id: true,
        vin: true,
        year: true,
        color: true,
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
          },
        },
      },
    })

    const vehiclesMap = new Map(vehicles.map(v => [v.id, v]))

    const enrichedValidations = validations.map(validation => ({
      ...validation,
      entity: validation.entityType === 'Vehicle'
        ? vehiclesMap.get(validation.entityId)
        : null,
    }))

    return NextResponse.json({
      validations: enrichedValidations,
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
    console.error('Error fetching pending validations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
