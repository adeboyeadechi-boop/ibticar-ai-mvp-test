// API Routes pour la gestion d'un média spécifique
// DELETE /api/vehicles/[id]/media/[mediaId] - Supprime un média

import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string; mediaId: string }>
}

// DELETE /api/vehicles/[id]/media/[mediaId] - Supprime un média spécifique
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId, mediaId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier les permissions (ADMIN, SUPER_ADMIN, MANAGER)
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le média existe et appartient au véhicule
    const media = await prisma.vehicleMedia.findUnique({
      where: { id: mediaId },
      include: {
        vehicle: {
          select: {
            id: true,
            vin: true,
          },
        },
      },
    })

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }

    if (media.vehicleId !== vehicleId) {
      return NextResponse.json(
        { error: 'Media does not belong to this vehicle' },
        { status: 400 }
      )
    }

    try {
      // Supprimer le fichier de Vercel Blob
      await del(media.url)
    } catch (blobError) {
      console.error('Error deleting from Vercel Blob:', blobError)
      // Continue même si la suppression du blob échoue (fichier peut-être déjà supprimé)
    }

    // Supprimer l'enregistrement de la base de données
    await prisma.vehicleMedia.delete({
      where: { id: mediaId },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'VehicleMedia',
        entityId: mediaId,
        changes: {
          deleted: {
            mediaId,
            vehicleId,
            url: media.url,
            type: media.type,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Media deleted successfully',
      mediaId,
    })
  } catch (error) {
    console.error('Error deleting vehicle media:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/vehicles/[id]/media/[mediaId] - Met à jour un média (caption, order)
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId, mediaId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier les permissions
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le média existe et appartient au véhicule
    const existingMedia = await prisma.vehicleMedia.findUnique({
      where: { id: mediaId },
    })

    if (!existingMedia) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }

    if (existingMedia.vehicleId !== vehicleId) {
      return NextResponse.json(
        { error: 'Media does not belong to this vehicle' },
        { status: 400 }
      )
    }

    // Récupérer les données du body
    const body = await request.json()
    const { caption, order } = body

    // Préparer les données à mettre à jour
    const updateData: any = {}
    if (caption !== undefined) updateData.caption = caption
    if (order !== undefined) updateData.order = order

    // Mettre à jour le média
    const updatedMedia = await prisma.vehicleMedia.update({
      where: { id: mediaId },
      data: updateData,
    })

    // Créer un log d'audit
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
      media: updatedMedia,
    })
  } catch (error) {
    console.error('Error updating vehicle media:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
