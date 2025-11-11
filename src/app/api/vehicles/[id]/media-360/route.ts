// API Route pour la galerie photos 360° (PRD-03-US-004)
// GET /api/vehicles/[id]/media-360 - Récupérer les médias 360° d'un véhicule
// POST /api/vehicles/[id]/media-360 - Ajouter un média 360°

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/vehicles/[id]/media-360 - Récupérer les médias 360°
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // Endpoint public - pas d'authentification requise pour la consultation
    // Vérifier que le véhicule existe
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

    // Récupérer tous les médias 360°
    const media360 = await prisma.vehicleMedia.findMany({
      where: {
        vehicleId,
        type: 'PHOTO_360',
      },
      orderBy: {
        order: 'asc',
      },
      select: {
        id: true,
        url: true,
        thumbnailUrl: true,
        caption: true,
        order: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      vehicleId,
      media360,
      count: media360.length,
      hasVirtualTour: media360.length > 0,
    })
  } catch (error) {
    console.error('Error fetching 360° media:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/vehicles/[id]/media-360 - Ajouter un média 360°
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent ajouter des médias
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { url, thumbnailUrl, caption, order } = body

    // Validation
    if (!url) {
      return NextResponse.json(
        { error: 'Missing required field: url' },
        { status: 400 }
      )
    }

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Déterminer l'ordre si non fourni
    let mediaOrder = order
    if (mediaOrder === undefined) {
      const lastMedia = await prisma.vehicleMedia.findFirst({
        where: {
          vehicleId,
          type: 'PHOTO_360',
        },
        orderBy: {
          order: 'desc',
        },
        select: {
          order: true,
        },
      })

      mediaOrder = lastMedia ? lastMedia.order + 1 : 0
    }

    // Créer le média 360°
    const media = await prisma.vehicleMedia.create({
      data: {
        vehicleId,
        type: 'PHOTO_360',
        url,
        thumbnailUrl: thumbnailUrl || null,
        caption: caption || null,
        order: mediaOrder,
        is360: true,
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'VehicleMedia',
        entityId: media.id,
        changes: {
          vehicleId,
          type: 'PHOTO_360',
          created: media,
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: '360° media added successfully',
        media: {
          id: media.id,
          url: media.url,
          thumbnailUrl: media.thumbnailUrl,
          caption: media.caption,
          order: media.order,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error adding 360° media:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
