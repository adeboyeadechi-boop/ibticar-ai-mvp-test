// API Route pour gérer une alerte spécifique (PRD-03-US-010)
// GET /api/marketplace/alerts/[id] - Récupérer une alerte
// PATCH /api/marketplace/alerts/[id] - Activer/désactiver une alerte
// DELETE /api/marketplace/alerts/[id] - Supprimer une alerte

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { AlertFrequency } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/marketplace/alerts/[id] - Récupérer une alerte
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    const alert = await prisma.marketplaceAlert.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        criteria: true,
        frequency: true,
        isActive: true,
        lastSentAt: true,
        createdAt: true,
        updatedAt: true,
        customerId: true,
      },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    // Fetch customer separately
    const customer = await prisma.customer.findUnique({
      where: { id: alert.customerId },
      select: {
        email: true,
      },
    })

    // Vérifier que l'email correspond (sécurité basique)
    if (email && customer && customer.email !== email) {
      return NextResponse.json(
        { error: 'Unauthorized to access this alert' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      id: alert.id,
      name: alert.name,
      criteria: alert.criteria,
      frequency: alert.frequency,
      isActive: alert.isActive,
      lastSentAt: alert.lastSentAt,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching alert:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/marketplace/alerts/[id] - Mettre à jour une alerte
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const { email, name, criteria, frequency, isActive } = body

    // Récupérer l'alerte
    const alert = await prisma.marketplaceAlert.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
      },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    // Fetch customer separately
    const customer = await prisma.customer.findUnique({
      where: { id: alert.customerId },
      select: {
        email: true,
      },
    })

    // Vérifier que l'email correspond
    if (email && customer && customer.email !== email) {
      return NextResponse.json(
        { error: 'Unauthorized to modify this alert' },
        { status: 403 }
      )
    }

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (criteria !== undefined) {
      if (typeof criteria !== 'object' || Array.isArray(criteria)) {
        return NextResponse.json(
          { error: 'Criteria must be a valid object' },
          { status: 400 }
        )
      }
      updateData.criteria = criteria
    }
    if (frequency !== undefined) {
      const validFrequencies: AlertFrequency[] = ['INSTANT', 'DAILY', 'WEEKLY']
      if (!validFrequencies.includes(frequency)) {
        return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
      }
      updateData.frequency = frequency
    }
    if (isActive !== undefined) updateData.isActive = isActive

    // Mettre à jour l'alerte
    const updatedAlert = await prisma.marketplaceAlert.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      message: 'Alert updated successfully',
      alert: {
        id: updatedAlert.id,
        name: updatedAlert.name,
        criteria: updatedAlert.criteria,
        frequency: updatedAlert.frequency,
        isActive: updatedAlert.isActive,
        updatedAt: updatedAlert.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error updating alert:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/marketplace/alerts/[id] - Supprimer une alerte
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    // Récupérer l'alerte
    const alert = await prisma.marketplaceAlert.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
      },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    // Fetch customer separately
    const customer = await prisma.customer.findUnique({
      where: { id: alert.customerId },
      select: {
        email: true,
      },
    })

    // Vérifier que l'email correspond
    if (email && customer && customer.email !== email) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this alert' },
        { status: 403 }
      )
    }

    // Supprimer l'alerte
    await prisma.marketplaceAlert.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Alert deleted successfully',
      alertId: id,
    })
  } catch (error) {
    console.error('Error deleting alert:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
