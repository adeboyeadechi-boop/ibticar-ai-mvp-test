// API Routes pour gestion individuelle des configurations
// GET /api/configurations/[id] - Détails d'une configuration
// PUT /api/configurations/[id] - Modifier une configuration
// DELETE /api/configurations/[id] - Supprimer une configuration

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/configurations/[id] - Détails de la configuration
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: configId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer la configuration
    const configuration = await prisma.vehicleConfiguration.findUnique({
      where: { id: configId },
    })

    if (!configuration) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    // Enrichir avec les données du modèle
    const model = await prisma.vehicleModel.findUnique({
      where: { id: configuration.vehicleModelId },
      include: {
        brand: true,
      },
    })

    return NextResponse.json({
      configuration: {
        ...configuration,
        model: model
          ? {
              id: model.id,
              brand: model.brand.name,
              name: model.name,
              category: model.category,
              fuelType: model.fuelType,
              transmission: model.transmission,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Error fetching configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/configurations/[id] - Modifier la configuration
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: configId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent modifier
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const {
      name,
      trim,
      basePrice,
      options,
      totalPrice,
      availability,
      deliveryTime,
    } = body

    // Vérifier que la configuration existe
    const existingConfig = await prisma.vehicleConfiguration.findUnique({
      where: { id: configId },
    })

    if (!existingConfig) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    // Construire les données de mise à jour
    const updateData: any = {}
    if (name) updateData.name = name
    if (trim) updateData.trim = trim
    if (basePrice) updateData.basePrice = Number(basePrice)
    if (options) updateData.options = options
    if (totalPrice) updateData.totalPrice = Number(totalPrice)
    if (availability !== undefined) updateData.availability = availability
    if (deliveryTime !== undefined) updateData.deliveryTime = deliveryTime

    // Mettre à jour la configuration
    const configuration = await prisma.vehicleConfiguration.update({
      where: { id: configId },
      data: updateData,
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'VehicleConfiguration',
        entityId: configId,
        changes: updateData,
      },
    })

    return NextResponse.json({
      success: true,
      configuration,
      message: 'Configuration updated successfully',
    })
  } catch (error) {
    console.error('Error updating configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/configurations/[id] - Supprimer la configuration
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: configId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent supprimer
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que la configuration existe
    const configuration = await prisma.vehicleConfiguration.findUnique({
      where: { id: configId },
    })

    if (!configuration) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    // Supprimer la configuration
    await prisma.vehicleConfiguration.delete({
      where: { id: configId },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'VehicleConfiguration',
        entityId: configId,
        changes: {
          deletedConfiguration: {
            name: configuration.name,
            trim: configuration.trim,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
