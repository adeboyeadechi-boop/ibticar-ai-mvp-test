// API Route pour gérer une estimation spécifique (ADMIN) (PRD-03-US-007)
// GET /api/trade-in/[id] - Récupérer une estimation
// PATCH /api/trade-in/[id] - Approuver/rejeter une estimation
// DELETE /api/trade-in/[id] - Supprimer une estimation

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { EstimateStatus } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/trade-in/[id] - Récupérer une estimation complète
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const estimate = await prisma.tradeInEstimate.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            companyName: true,
          },
        },
        vehicleModel: {
          select: {
            id: true,
            name: true,
            category: true,
            fuelType: true,
            transmission: true,
            brand: {
              select: {
                name: true,
                logoUrl: true,
                country: true,
              },
            },
          },
        },
      },
    })

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    const now = new Date()
    const isExpired = now > estimate.validUntil

    return NextResponse.json({
      ...estimate,
      estimatedValue: Number(estimate.estimatedValue),
      minValue: Math.round(Number(estimate.estimatedValue) * 0.9),
      maxValue: Math.round(Number(estimate.estimatedValue) * 1.1),
      isExpired,
    })
  } catch (error) {
    console.error('Error fetching estimate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/trade-in/[id] - Approuver/rejeter une estimation
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent modifier
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { status, estimatedValue, notes } = body

    // Validation du statut
    if (status && !Object.values(EstimateStatus).includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Vérifier que l'estimation existe
    const existingEstimate = await prisma.tradeInEstimate.findUnique({
      where: { id },
    })

    if (!existingEstimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (status) updateData.status = status
    if (estimatedValue !== undefined) updateData.estimatedValue = estimatedValue
    if (notes !== undefined) {
      // Append new notes to existing notes
      updateData.notes = existingEstimate.notes
        ? `${existingEstimate.notes}\n[${new Date().toISOString()}] ${notes}`
        : notes
    }

    // Mettre à jour l'estimation
    const updatedEstimate = await prisma.tradeInEstimate.update({
      where: { id },
      data: updateData,
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'TradeInEstimate',
        entityId: id,
        changes: {
          before: existingEstimate,
          after: updatedEstimate,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Estimate updated successfully',
      estimate: {
        id: updatedEstimate.id,
        status: updatedEstimate.status,
        estimatedValue: Number(updatedEstimate.estimatedValue),
        notes: updatedEstimate.notes,
      },
    })
  } catch (error) {
    console.error('Error updating estimate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/trade-in/[id] - Supprimer une estimation
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent supprimer
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que l'estimation existe
    const existingEstimate = await prisma.tradeInEstimate.findUnique({
      where: { id },
    })

    if (!existingEstimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    // Ne pas supprimer une estimation approuvée
    if (existingEstimate.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Cannot delete an approved estimate' },
        { status: 400 }
      )
    }

    // Supprimer l'estimation
    await prisma.tradeInEstimate.delete({
      where: { id },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'TradeInEstimate',
        entityId: id,
        changes: { deleted: existingEstimate },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Estimate deleted successfully',
      estimateId: id,
    })
  } catch (error) {
    console.error('Error deleting estimate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
