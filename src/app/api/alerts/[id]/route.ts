// API Routes pour une alerte spécifique
// GET /api/alerts/[id] - Détails
// PATCH /api/alerts/[id] - Mettre à jour
// DELETE /api/alerts/[id] - Supprimer

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/alerts/[id] - Récupère une alerte
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const alert = await prisma.alert.findUnique({
      where: { id },
    })

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès
    if (alert.userId !== user.id && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(alert)
  } catch (error) {
    console.error('Error fetching alert:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/alerts/[id] - Met à jour une alerte
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const existingAlert = await prisma.alert.findUnique({
      where: { id },
    })

    if (!existingAlert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès
    if (existingAlert.userId !== user.id && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const { name, conditions, actions, isActive } = body

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (conditions !== undefined) updateData.conditions = conditions
    if (actions !== undefined) updateData.actions = actions
    if (isActive !== undefined) updateData.isActive = isActive

    // Mettre à jour
    const updatedAlert = await prisma.alert.update({
      where: { id },
      data: updateData,
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Alert',
        entityId: id,
        changes: {
          before: existingAlert,
          after: updatedAlert,
        },
      },
    })

    return NextResponse.json({
      success: true,
      alert: updatedAlert,
    })
  } catch (error) {
    console.error('Error updating alert:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/alerts/[id] - Supprime une alerte
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const alert = await prisma.alert.findUnique({
      where: { id },
    })

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès
    if (alert.userId !== user.id && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Supprimer
    await prisma.alert.delete({
      where: { id },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'Alert',
        entityId: id,
        changes: { deleted: alert },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Alert deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting alert:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
