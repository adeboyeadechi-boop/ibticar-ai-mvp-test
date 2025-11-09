// API Routes pour la gestion des transferts de stock
// GET /api/stock/transfers - Liste tous les transferts
// POST /api/stock/transfers - Crée un nouveau transfert

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { TransferStatus, VehicleStatus } from '@/generated/prisma'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/stock/transfers - Liste tous les transferts
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les paramètres de requête
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') as TransferStatus | null
    const vehicleId = searchParams.get('vehicleId') || null
    const fromTeamId = searchParams.get('fromTeamId') || null
    const toTeamId = searchParams.get('toTeamId') || null

    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}
    if (status) where.status = status
    if (vehicleId) where.vehicleId = vehicleId
    if (fromTeamId) where.fromTeamId = fromTeamId
    if (toTeamId) where.toTeamId = toTeamId

    // Récupérer les transferts
    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        select: {
          id: true,
          vehicleId: true,
          vehicle: {
            select: {
              id: true,
              vin: true,
              year: true,
              color: true,
              model: {
                select: {
                  name: true,
                  slug: true,
                  brand: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          fromTeamId: true,
          fromTeam: {
            select: {
              id: true,
              name: true,
            },
          },
          toTeamId: true,
          toTeam: {
            select: {
              id: true,
              name: true,
            },
          },
          status: true,
          initiatedById: true,
          initiatedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          approvedById: true,
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          receivedById: true,
          receivedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          reason: true,
          notes: true,
          scheduledAt: true,
          departedAt: true,
          arrivedAt: true,
          completedAt: true,
          cancelledAt: true,
          cancellationReason: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.stockTransfer.count({ where }),
    ])

    return NextResponse.json({
      transfers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching transfers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/stock/transfers - Crée un nouveau transfert
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
      vehicleId,
      fromTeamId,
      toTeamId,
      reason,
      notes,
      scheduledAt,
    } = body

    // Validation
    if (!vehicleId || !fromTeamId || !toTeamId) {
      return NextResponse.json(
        { error: 'Missing required fields: vehicleId, fromTeamId, toTeamId' },
        { status: 400 }
      )
    }

    if (fromTeamId === toTeamId) {
      return NextResponse.json(
        { error: 'Cannot transfer vehicle to the same team' },
        { status: 400 }
      )
    }

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    // Vérifier que le véhicule est actuellement dans l'équipe source
    if (vehicle.teamId !== fromTeamId) {
      return NextResponse.json(
        { error: 'Vehicle is not currently in the source team' },
        { status: 400 }
      )
    }

    // Vérifier que le véhicule n'est pas vendu ou réservé
    if (vehicle.status === VehicleStatus.SOLD) {
      return NextResponse.json(
        { error: 'Cannot transfer a sold vehicle' },
        { status: 400 }
      )
    }

    if (vehicle.status === VehicleStatus.RESERVED) {
      return NextResponse.json(
        { error: 'Cannot transfer a reserved vehicle' },
        { status: 400 }
      )
    }

    // Vérifier que les équipes existent
    const [fromTeam, toTeam] = await Promise.all([
      prisma.team.findUnique({ where: { id: fromTeamId } }),
      prisma.team.findUnique({ where: { id: toTeamId } }),
    ])

    if (!fromTeam || !toTeam) {
      return NextResponse.json(
        { error: 'Source or destination team not found' },
        { status: 404 }
      )
    }

    // Vérifier qu'il n'y a pas déjà un transfert en cours pour ce véhicule
    const existingTransfer = await prisma.stockTransfer.findFirst({
      where: {
        vehicleId,
        status: {
          in: ['PENDING', 'IN_TRANSIT'],
        },
      },
    })

    if (existingTransfer) {
      return NextResponse.json(
        { error: 'Vehicle already has a pending or in-transit transfer' },
        { status: 409 }
      )
    }

    // Créer le transfert
    const newTransfer = await prisma.stockTransfer.create({
      data: {
        vehicleId,
        fromTeamId,
        toTeamId,
        status: 'PENDING',
        initiatedById: user.id,
        reason,
        notes,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
      select: {
        id: true,
        vehicleId: true,
        vehicle: {
          select: {
            vin: true,
            year: true,
            color: true,
            model: {
              select: {
                name: true,
                slug: true,
                brand: { select: { name: true } },
              },
            },
          },
        },
        fromTeam: {
          select: {
            id: true,
            name: true,
          },
        },
        toTeam: {
          select: {
            id: true,
            name: true,
          },
        },
        status: true,
        scheduledAt: true,
        createdAt: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'StockTransfer',
        entityId: newTransfer.id,
        changes: { created: newTransfer },
      },
    })

    return NextResponse.json(newTransfer, { status: 201 })
  } catch (error) {
    console.error('Error creating transfer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
