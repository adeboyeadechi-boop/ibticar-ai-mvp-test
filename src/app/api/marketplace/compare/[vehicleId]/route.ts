// API Route pour retirer un véhicule de la comparaison (PRD-03-US-006)
// DELETE /api/marketplace/compare/[vehicleId] - Retirer un véhicule

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

type Params = {
  params: Promise<{ vehicleId: string }>
}

// DELETE /api/marketplace/compare/[vehicleId] - Retirer un véhicule de la comparaison
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { vehicleId } = await params

    // Récupérer l'email depuis query params
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({
        success: true,
        message: 'Remove from local storage',
        vehicleId,
        requiresLocalStorage: true,
      })
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Obtenir le customer
    const customer = await prisma.customer.findUnique({
      where: { email },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Récupérer la comparaison actuelle
    const comparison = await prisma.comparison.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    })

    if (!comparison) {
      return NextResponse.json({ error: 'Comparison not found' }, { status: 404 })
    }

    // Retirer le véhicule de la liste
    const currentVehicles = Array.isArray(comparison.vehicles)
      ? comparison.vehicles
      : []
    const updatedVehicles = currentVehicles.filter((id) => id !== vehicleId)

    // Mettre à jour ou supprimer la comparaison
    if (updatedVehicles.length === 0) {
      // Si plus de véhicules, supprimer la comparaison
      await prisma.comparison.delete({
        where: { id: comparison.id },
      })

      return NextResponse.json({
        success: true,
        message: 'Last vehicle removed, comparison deleted',
        vehicleId,
        remainingCount: 0,
      })
    } else {
      // Mettre à jour la liste
      await prisma.comparison.update({
        where: { id: comparison.id },
        data: {
          vehicles: updatedVehicles,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Vehicle removed from comparison',
        vehicleId,
        remainingCount: updatedVehicles.length,
        remainingVehicleIds: updatedVehicles,
      })
    }
  } catch (error) {
    console.error('Error removing vehicle from comparison:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
