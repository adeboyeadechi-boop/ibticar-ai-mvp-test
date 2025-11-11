// API Routes pour les véhicules favoris des clients
// GET /api/customers/[id]/profile/vehicles - Liste des favoris
// POST /api/customers/[id]/profile/vehicles - Ajouter un favori
//
// Note: FavoriteVehicle model does not exist in the schema
// These endpoints return 501 Not Implemented

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/customers/[id]/profile/vehicles - Liste des véhicules favoris
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: customerId } = await params

    // Vérifier l'authentification (optionnel pour les profils publics)
    const { user } = await getAuthenticatedUser(request)
    const isOwner = user?.id === customerId
    const isAdmin = user && ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)

    // Vérifier que le client existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Vérifier les paramètres de confidentialité
    const privacy = (customer.preferences as any)?.privacy || {}
    const showFavorites = privacy.showFavorites !== false

    // Si ce n'est pas le propriétaire, un admin, et que les favoris sont privés
    if (!isOwner && !isAdmin && !showFavorites) {
      return NextResponse.json(
        { error: 'Favorite vehicles are private' },
        { status: 403 }
      )
    }

    // Note: FavoriteVehicle model does not exist in the Prisma schema
    return NextResponse.json(
      {
        error: 'Favorite vehicles feature not implemented',
        message: 'The FavoriteVehicle model does not exist in the database schema',
        favorites: [],
        total: 0,
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error fetching favorite vehicles:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/customers/[id]/profile/vehicles - Ajouter un véhicule aux favoris
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: customerId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier que c'est bien le propriétaire du profil
    if (user.id !== customerId) {
      return NextResponse.json(
        { error: 'You can only add favorites to your own profile' },
        { status: 403 }
      )
    }

    // Récupérer les données
    const body = await request.json()
    const { vehicleId } = body

    if (!vehicleId) {
      return NextResponse.json({ error: 'vehicleId is required' }, { status: 400 })
    }

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Note: FavoriteVehicle model does not exist in the Prisma schema
    return NextResponse.json(
      {
        error: 'Favorite vehicles feature not implemented',
        message: 'The FavoriteVehicle model does not exist in the database schema',
      },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error adding favorite vehicle:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
