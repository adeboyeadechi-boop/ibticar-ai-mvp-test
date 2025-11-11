// API Route pour supprimer un véhicule des favoris (PRD-03-US-006)
// DELETE /api/marketplace/favorites/[vehicleId] - Retirer des favoris

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

type Params = {
  params: Promise<{ vehicleId: string }>
}

// Helper pour obtenir le customerId depuis l'email
async function getCustomerIdFromEmail(email: string): Promise<string | null> {
  const customer = await prisma.customer.findUnique({
    where: { email },
  })
  return customer?.id || null
}

// DELETE /api/marketplace/favorites/[vehicleId] - Supprimer des favoris
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { vehicleId } = await params

    // Récupérer l'email depuis query params
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        {
          success: true,
          message: 'Remove from local storage',
          requiresLocalStorage: true,
        },
        { status: 200 }
      )
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

    // Trouver et supprimer le favori
    const favorite = await prisma.favorite.findFirst({
      where: {
        customerId,
        vehicleId,
      },
    })

    if (!favorite) {
      return NextResponse.json(
        { error: 'Favorite not found' },
        { status: 404 }
      )
    }

    await prisma.favorite.delete({
      where: { id: favorite.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Vehicle removed from favorites',
      vehicleId,
    })
  } catch (error) {
    console.error('Error removing favorite:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
