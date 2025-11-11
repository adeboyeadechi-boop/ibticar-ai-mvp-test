// API Route pour les favoris du marketplace (PRD-03-US-006)
// GET /api/marketplace/favorites - Liste des véhicules favoris
// POST /api/marketplace/favorites - Ajouter un véhicule aux favoris

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// Helper pour obtenir le customerId depuis l'email (support invités et authentifiés)
async function getCustomerIdFromRequest(
  request: NextRequest
): Promise<string | null> {
  // Pour les utilisateurs non authentifiés, on peut utiliser l'email dans les query params
  // ou dans un cookie de session
  const searchParams = request.nextUrl.searchParams
  const email = searchParams.get('email')

  if (!email) return null

  // Vérifier si le client existe
  const customer = await prisma.customer.findUnique({
    where: { email },
  })

  return customer?.id || null
}

// GET /api/marketplace/favorites - Récupérer les favoris
export async function GET(request: NextRequest) {
  try {
    // Support invités via email dans query params
    const customerId = await getCustomerIdFromRequest(request)

    if (!customerId) {
      // Si pas de customerId, retourner une liste vide
      // Le client gérera les favoris localement (localStorage)
      return NextResponse.json({
        favorites: [],
        message: 'No customer found. Use local storage for guest favorites.',
        isGuest: true,
      })
    }

    // Récupérer les favoris depuis la base de données
    const favorites = await prisma.favorite.findMany({
      where: { customerId },
      include: {
        vehicle: {
          select: {
            id: true,
            year: true,
            color: true,
            mileage: true,
            sellingPrice: true,
            status: true,
            availableForSale: true,
            publishedAt: true,
            model: {
              select: {
                name: true,
                brand: {
                  select: {
                    name: true,
                    logoUrl: true,
                  },
                },
              },
            },
            media: {
              where: {
                isPrimary: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Formatter la réponse
    const formattedFavorites = favorites.map((fav) => ({
      id: fav.id,
      vehicleId: fav.vehicleId,
      vehicle: {
        id: fav.vehicle.id,
        brand: fav.vehicle.model.brand.name,
        brandLogo: fav.vehicle.model.brand.logoUrl,
        model: fav.vehicle.model.name,
        year: fav.vehicle.year,
        price: Number(fav.vehicle.sellingPrice),
        mileage: fav.vehicle.mileage,
        color: fav.vehicle.color,
        image: fav.vehicle.media[0]?.url || null,
        isAvailable:
          fav.vehicle.status === 'AVAILABLE' &&
          fav.vehicle.availableForSale &&
          !!fav.vehicle.publishedAt,
      },
      addedAt: fav.createdAt,
    }))

    return NextResponse.json({
      favorites: formattedFavorites,
      total: formattedFavorites.length,
      isGuest: false,
    })
  } catch (error) {
    console.error('Error fetching favorites:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/marketplace/favorites - Ajouter un véhicule aux favoris
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vehicleId, email } = body

    // Validation
    if (!vehicleId) {
      return NextResponse.json(
        { error: 'Missing required field: vehicleId' },
        { status: 400 }
      )
    }

    // Vérifier que le véhicule existe et est disponible
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        status: true,
        availableForSale: true,
        publishedAt: true,
      },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Si pas d'email, retourner un message pour gérer côté client
    if (!email) {
      return NextResponse.json({
        success: true,
        message: 'Vehicle can be added to local favorites',
        vehicleId,
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
      // Créer un client prospect basique
      customer = await prisma.customer.create({
        data: {
          type: 'INDIVIDUAL',
          firstName: 'Guest',
          lastName: 'User',
          email,
          phone: '0000000000', // Placeholder
          status: 'PROSPECT',
          source: 'MARKETPLACE',
        },
      })
    }

    // Vérifier si déjà en favoris
    const existingFavorite = await prisma.favorite.findFirst({
      where: {
        customerId: customer.id,
        vehicleId,
      },
    })

    if (existingFavorite) {
      return NextResponse.json({
        success: true,
        message: 'Vehicle is already in favorites',
        favoriteId: existingFavorite.id,
        alreadyExists: true,
      })
    }

    // Ajouter aux favoris
    const favorite = await prisma.favorite.create({
      data: {
        customerId: customer.id,
        vehicleId,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Vehicle added to favorites',
        favoriteId: favorite.id,
        vehicleId,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error adding favorite:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
