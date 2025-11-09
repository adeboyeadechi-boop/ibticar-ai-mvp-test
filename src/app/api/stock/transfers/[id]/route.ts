// API Routes pour la gestion d'un transfert spécifique
// GET /api/stock/transfers/[id] - Récupère un transfert
// PATCH /api/stock/transfers/[id] - Met à jour un transfert (statut)

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { TransferStatus } from '@/generated/prisma'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/stock/transfers/[id] - Récupère un transfert
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer le transfert
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
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
                brand: { select: { name: true, logo: true } },
              },
            },
          },
        },
        fromTeamId: true,
        fromTeam: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
        toTeamId: true,
        toTeam: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
        status: true,
        initiatedById: true,
        initiatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    return NextResponse.json(transfer)
  } catch (error) {
    console.error('Error fetching transfer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/stock/transfers/[id] - Met à jour un transfert
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification et permissions
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer le transfert existant
    const existingTransfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        vehicle: true,
      },
    })

    if (!existingTransfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // Récupérer les données du body
    const body = await request.json()
    const {
      action, // 'approve', 'depart', 'arrive', 'complete', 'cancel'
      cancellationReason,
    } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    let newStatus: TransferStatus | null = null

    // Gérer les différentes actions
    switch (action) {
      case 'approve':
        if (existingTransfer.status !== 'PENDING') {
          return NextResponse.json(
            { error: 'Can only approve pending transfers' },
            { status: 400 }
          )
        }
        newStatus = 'IN_TRANSIT'
        updateData.approvedById = user.id
        updateData.departedAt = new Date()
        break

      case 'arrive':
        if (existingTransfer.status !== 'IN_TRANSIT') {
          return NextResponse.json(
            { error: 'Can only mark arrived for in-transit transfers' },
            { status: 400 }
          )
        }
        updateData.arrivedAt = new Date()
        break

      case 'complete':
        if (existingTransfer.status !== 'IN_TRANSIT') {
          return NextResponse.json(
            { error: 'Can only complete in-transit transfers' },
            { status: 400 }
          )
        }
        newStatus = 'COMPLETED'
        updateData.completedAt = new Date()
        updateData.receivedById = user.id

        // Mettre à jour l'équipe du véhicule
        await prisma.vehicle.update({
          where: { id: existingTransfer.vehicleId },
          data: {
            teamId: existingTransfer.toTeamId,
          },
        })
        break

      case 'cancel':
        if (!['PENDING', 'IN_TRANSIT'].includes(existingTransfer.status)) {
          return NextResponse.json(
            { error: 'Can only cancel pending or in-transit transfers' },
            { status: 400 }
          )
        }
        if (!cancellationReason) {
          return NextResponse.json(
            { error: 'Cancellation reason is required' },
            { status: 400 }
          )
        }
        newStatus = 'CANCELLED'
        updateData.cancelledAt = new Date()
        updateData.cancellationReason = cancellationReason
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: approve, arrive, complete, or cancel' },
          { status: 400 }
        )
    }

    if (newStatus) {
      updateData.status = newStatus
    }

    // Mettre à jour le transfert
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id },
      data: updateData,
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
            team: { select: { name: true } },
          },
        },
        fromTeam: { select: { name: true } },
        toTeam: { select: { name: true } },
        status: true,
        departedAt: true,
        arrivedAt: true,
        completedAt: true,
        cancelledAt: true,
        updatedAt: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'StockTransfer',
        entityId: id,
        changes: {
          action,
          before: existingTransfer,
          after: updatedTransfer,
        },
      },
    })

    return NextResponse.json(updatedTransfer)
  } catch (error) {
    console.error('Error updating transfer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
