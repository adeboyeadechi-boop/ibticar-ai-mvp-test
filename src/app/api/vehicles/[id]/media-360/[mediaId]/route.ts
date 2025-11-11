// API Route pour gérer un média 360° spécifique (PRD-03-US-004)
// PATCH /api/vehicles/[id]/media-360/[mediaId] - Mettre à jour
// DELETE /api/vehicles/[id]/media-360/[mediaId] - Supprimer

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string; mediaId: string }>
}

// PATCH /api/vehicles/[id]/media-360/[mediaId] - Mettre à jour un média 360°
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId, mediaId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent modifier
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { url, thumbnailUrl, caption, order } = body

    // Vérifier que le média existe et appartient au véhicule
    const existingMedia = await prisma.vehicleMedia.findUnique({
      where: { id: mediaId },
    })

    if (!existingMedia) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    if (existingMedia.vehicleId !== vehicleId) {
      return NextResponse.json(
        { error: 'Media does not belong to this vehicle' },
        { status: 400 }
      )
    }

    if (existingMedia.type !== 'PHOTO_360') {
      return NextResponse.json(
        { error: 'Media is not a 360° photo' },
        { status: 400 }
      )
    }

    // Préparer les données à mettre à jour
    const updateData: any = {}
    if (url !== undefined) updateData.url = url
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl
    if (caption !== undefined) updateData.caption = caption
    if (order !== undefined) updateData.order = order

    // Mettre à jour le média
    const updatedMedia = await prisma.vehicleMedia.update({
      where: { id: mediaId },
      data: updateData,
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'VehicleMedia',
        entityId: mediaId,
        changes: {
          before: existingMedia,
          after: updatedMedia,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: '360° media updated successfully',
      media: updatedMedia,
    })
  } catch (error) {
    console.error('Error updating 360° media:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/vehicles/[id]/media-360/[mediaId] - Supprimer un média 360°
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId, mediaId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent supprimer
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le média existe et appartient au véhicule
    const existingMedia = await prisma.vehicleMedia.findUnique({
      where: { id: mediaId },
    })

    if (!existingMedia) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    if (existingMedia.vehicleId !== vehicleId) {
      return NextResponse.json(
        { error: 'Media does not belong to this vehicle' },
        { status: 400 }
      )
    }

    if (existingMedia.type !== 'PHOTO_360') {
      return NextResponse.json(
        { error: 'Media is not a 360° photo' },
        { status: 400 }
      )
    }

    // Supprimer le média
    await prisma.vehicleMedia.delete({
      where: { id: mediaId },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'VehicleMedia',
        entityId: mediaId,
        changes: {
          deleted: existingMedia,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: '360° media deleted successfully',
      mediaId,
    })
  } catch (error) {
    console.error('Error deleting 360° media:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
