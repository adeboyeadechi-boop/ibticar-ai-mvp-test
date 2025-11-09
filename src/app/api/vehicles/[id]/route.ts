// API Routes pour la gestion d'un véhicule spécifique
// GET /api/vehicles/[id] - Récupère un véhicule
// PATCH /api/vehicles/[id] - Met à jour un véhicule
// DELETE /api/vehicles/[id] - Supprime un véhicule

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/vehicles/[id] - Récupère un véhicule avec tous ses détails
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer le véhicule avec toutes ses relations
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: {
        id: true,
        vin: true,
        status: true,
        condition: true,
        year: true,
        mileage: true,
        color: true,
        interiorColor: true,
        purchasePrice: true,
        sellingPrice: true,
        currency: true,
        purchaseDate: true,
        location: true,
        publishedAt: true,
        soldAt: true,
        archivedAt: true,
        features: true,
        notes: true,
        model: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            bodyType: true,
            fuelType: true,
            transmission: true,
            engineCapacity: true,
            horsePower: true,
            co2Emission: true,
            energyLabel: true,
            seats: true,
            doors: true,
            specifications: true,
            brand: {
              select: {
                id: true,
                name: true,
                logo: true,
                country: true,
              },
            },
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
            phone: true,
          },
        },
        media: {
          select: {
            id: true,
            url: true,
            type: true,
            is360: true,
            caption: true,
            order: true,
            createdAt: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    return NextResponse.json(vehicle)
  } catch (error) {
    console.error('Error fetching vehicle:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/vehicles/[id] - Met à jour un véhicule
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification et permissions
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le véhicule existe
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id },
    })

    if (!existingVehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Récupérer les données du body
    const body = await request.json()
    const {
      vin,
      status,
      condition,
      year,
      mileage,
      color,
      interiorColor,
      purchasePrice,
      sellingPrice,
      currency,
      purchaseDate,
      location,
      features,
      notes,
      publish, // Boolean pour publier/dépublier le véhicule
    } = body

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (vin !== undefined) updateData.vin = vin
    if (status !== undefined) {
      updateData.status = status

      // Mettre à jour les dates selon le statut
      if (status === 'SOLD' && !existingVehicle.soldAt) {
        updateData.soldAt = new Date()
      }
      if (status === 'ARCHIVED' && !existingVehicle.archivedAt) {
        updateData.archivedAt = new Date()
      }
    }
    if (condition !== undefined) updateData.condition = condition
    if (year !== undefined) updateData.year = year
    if (mileage !== undefined) updateData.mileage = mileage
    if (color !== undefined) updateData.color = color
    if (interiorColor !== undefined) updateData.interiorColor = interiorColor
    if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice
    if (sellingPrice !== undefined) updateData.sellingPrice = sellingPrice
    if (currency !== undefined) updateData.currency = currency
    if (purchaseDate !== undefined)
      updateData.purchaseDate = purchaseDate ? new Date(purchaseDate) : null
    if (location !== undefined) updateData.location = location
    if (features !== undefined) updateData.features = features
    if (notes !== undefined) updateData.notes = notes

    // Gérer la publication du véhicule
    if (typeof publish === 'boolean') {
      if (publish && !existingVehicle.publishedAt) {
        updateData.publishedAt = new Date()
      } else if (!publish && existingVehicle.publishedAt) {
        updateData.publishedAt = null
      }
    }

    // Mettre à jour le véhicule
    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        vin: true,
        status: true,
        condition: true,
        year: true,
        mileage: true,
        color: true,
        interiorColor: true,
        purchasePrice: true,
        sellingPrice: true,
        currency: true,
        publishedAt: true,
        soldAt: true,
        model: {
          select: {
            id: true,
            name: true,
            slug: true,
            brand: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        updatedAt: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Vehicle',
        entityId: id,
        changes: {
          before: existingVehicle,
          after: updatedVehicle,
        },
      },
    })

    return NextResponse.json(updatedVehicle)
  } catch (error) {
    console.error('Error updating vehicle:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/vehicles/[id] - Supprime un véhicule
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification et permissions (seuls ADMIN et SUPER_ADMIN)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le véhicule existe
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id },
    })

    if (!existingVehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Vérifier que le véhicule n'est pas vendu ou réservé
    if (existingVehicle.status === 'SOLD') {
      return NextResponse.json(
        { error: 'Cannot delete a sold vehicle' },
        { status: 400 }
      )
    }

    if (existingVehicle.status === 'RESERVED') {
      return NextResponse.json(
        { error: 'Cannot delete a reserved vehicle. Please cancel the reservation first.' },
        { status: 400 }
      )
    }

    // Supprimer le véhicule (hard delete car pas de champ isActive)
    await prisma.vehicle.delete({
      where: { id },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'Vehicle',
        entityId: id,
        changes: { deleted: existingVehicle },
      },
    })

    return NextResponse.json({
      message: 'Vehicle deleted successfully',
      vehicleId: id,
    })
  } catch (error) {
    console.error('Error deleting vehicle:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
