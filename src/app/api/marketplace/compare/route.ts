// API Route pour la comparaison de véhicules (PRD-03-US-006)
// GET /api/marketplace/compare - Récupérer la liste de comparaison
// POST /api/marketplace/compare - Ajouter/Mettre à jour la comparaison
// DELETE /api/marketplace/compare - Vider la comparaison

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// Helper pour obtenir le customerId depuis l'email
async function getCustomerIdFromEmail(email: string): Promise<string | null> {
  const customer = await prisma.customer.findUnique({
    where: { email },
  })
  return customer?.id || null
}

// GET /api/marketplace/compare - Récupérer la comparaison actuelle
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({
        comparison: null,
        message: 'Use local storage for guest comparisons',
        isGuest: true,
      })
    }

    // Obtenir le customerId
    const customerId = await getCustomerIdFromEmail(email)

    if (!customerId) {
      return NextResponse.json({
        comparison: null,
        message: 'Customer not found',
        isGuest: true,
      })
    }

    // Récupérer la dernière comparaison
    const comparison = await prisma.comparison.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    })

    if (!comparison) {
      return NextResponse.json({
        comparison: null,
        vehicleIds: [],
        count: 0,
      })
    }

    // Le champ vehicles est un JSON array d'IDs
    const vehicleIds = Array.isArray(comparison.vehicles)
      ? comparison.vehicles
      : []

    return NextResponse.json({
      comparison: {
        id: comparison.id,
        vehicleIds,
        createdAt: comparison.createdAt,
      },
      vehicleIds,
      count: vehicleIds.length,
    })
  } catch (error) {
    console.error('Error fetching comparison:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/marketplace/compare - Ajouter/mettre à jour la comparaison
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vehicleIds, email } = body

    // Validation
    if (!vehicleIds || !Array.isArray(vehicleIds)) {
      return NextResponse.json(
        { error: 'vehicleIds must be an array' },
        { status: 400 }
      )
    }

    // Limiter à 4 véhicules maximum pour la comparaison
    if (vehicleIds.length > 4) {
      return NextResponse.json(
        { error: 'Maximum 4 vehicles can be compared at once' },
        { status: 400 }
      )
    }

    // Vérifier que tous les véhicules existent
    if (vehicleIds.length > 0) {
      const vehicles = await prisma.vehicle.findMany({
        where: {
          id: { in: vehicleIds },
          status: 'AVAILABLE',
          availableForSale: true,
          publishedAt: { not: null },
        },
        select: { id: true },
      })

      if (vehicles.length !== vehicleIds.length) {
        return NextResponse.json(
          { error: 'One or more vehicles not found or not available' },
          { status: 404 }
        )
      }
    }

    // Si pas d'email, retourner un message pour gérer côté client
    if (!email) {
      return NextResponse.json({
        success: true,
        message: 'Comparison can be managed in local storage',
        vehicleIds,
        requiresLocalStorage: true,
      })
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Trouver ou créer le client
    let customer = await prisma.customer.findUnique({
      where: { email },
    })

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          type: 'INDIVIDUAL',
          firstName: 'Guest',
          lastName: 'User',
          email,
          phone: '0000000000',
          status: 'PROSPECT',
          source: 'MARKETPLACE',
        },
      })
    }

    // Chercher une comparaison existante récente (moins de 30 jours)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const existingComparison = await prisma.comparison.findFirst({
      where: {
        customerId: customer.id,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
    })

    let comparison

    if (existingComparison) {
      // Mettre à jour la comparaison existante
      comparison = await prisma.comparison.update({
        where: { id: existingComparison.id },
        data: {
          vehicles: vehicleIds,
        },
      })
    } else {
      // Créer une nouvelle comparaison
      comparison = await prisma.comparison.create({
        data: {
          customerId: customer.id,
          vehicles: vehicleIds,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Comparison updated successfully',
      comparison: {
        id: comparison.id,
        vehicleIds,
        createdAt: comparison.createdAt,
      },
      count: vehicleIds.length,
    })
  } catch (error) {
    console.error('Error updating comparison:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/marketplace/compare - Vider la comparaison
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({
        success: true,
        message: 'Clear local storage',
        requiresLocalStorage: true,
      })
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Obtenir le customerId
    const customerId = await getCustomerIdFromEmail(email)

    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Supprimer toutes les comparaisons de ce client
    const deleteResult = await prisma.comparison.deleteMany({
      where: { customerId },
    })

    return NextResponse.json({
      success: true,
      message: 'Comparison cleared',
      deletedCount: deleteResult.count,
    })
  } catch (error) {
    console.error('Error clearing comparison:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
