// API Routes pour la gestion des médias (photos/vidéos) des véhicules
// POST /api/vehicles/[id]/media - Upload photos/vidéos
// GET /api/vehicles/[id]/media - Liste tous les médias d'un véhicule

import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { MediaType } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/vehicles/[id]/media - Upload photos/vidéos pour un véhicule
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier les permissions (ADMIN, SUPER_ADMIN, MANAGER)
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, vin: true },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    // Récupérer le FormData avec les fichiers
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const mediaType = (formData.get('type') as string) || 'PHOTO'
    const is360 = formData.get('is360') === 'true'
    const captions = formData.getAll('captions') as string[]

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Valider le type de média
    const validMediaTypes: MediaType[] = ['PHOTO', 'VIDEO', 'PHOTO_360']
    if (!validMediaTypes.includes(mediaType as MediaType)) {
      return NextResponse.json(
        { error: 'Invalid media type. Must be PHOTO, VIDEO, or PHOTO_360' },
        { status: 400 }
      )
    }

    // Déterminer le dernier ordre existant pour ce véhicule
    const lastMedia = await prisma.vehicleMedia.findFirst({
      where: { vehicleId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    let currentOrder = lastMedia ? lastMedia.order + 1 : 0

    // Upload de chaque fichier vers Vercel Blob et création des enregistrements
    const uploadedMedia = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const caption = captions[i] || null

      // Vérifier la taille du fichier (max 10MB pour photos, 50MB pour vidéos)
      const maxSize = mediaType === 'VIDEO' ? 50 * 1024 * 1024 : 10 * 1024 * 1024
      if (file.size > maxSize) {
        return NextResponse.json(
          {
            error: `File ${file.name} exceeds maximum size (${mediaType === 'VIDEO' ? '50MB' : '10MB'})`,
          },
          { status: 400 }
        )
      }

      // Générer un nom de fichier unique
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)
      const extension = file.name.split('.').pop()
      const filename = `vehicles/${vehicle.vin}/${timestamp}_${randomStr}.${extension}`

      try {
        // Upload vers Vercel Blob
        const blob = await put(filename, file, {
          access: 'public',
          addRandomSuffix: false,
        })

        // Créer l'enregistrement VehicleMedia
        const vehicleMedia = await prisma.vehicleMedia.create({
          data: {
            vehicleId,
            type: is360 ? 'PHOTO_360' : (mediaType as MediaType),
            url: blob.url,
            thumbnailUrl: blob.url, // Vercel Blob génère automatiquement des thumbnails via URL params
            order: currentOrder,
            is360: is360 || mediaType === 'PHOTO_360',
            caption,
          },
        })

        uploadedMedia.push(vehicleMedia)
        currentOrder++
      } catch (uploadError) {
        console.error(`Error uploading file ${file.name}:`, uploadError)
        return NextResponse.json(
          { error: `Failed to upload file ${file.name}` },
          { status: 500 }
        )
      }
    }

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'VehicleMedia',
        entityId: vehicleId,
        changes: {
          uploaded: uploadedMedia.length,
          files: uploadedMedia.map((m) => m.id),
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `${uploadedMedia.length} file(s) uploaded successfully`,
      media: uploadedMedia,
    })
  } catch (error) {
    console.error('Error uploading vehicle media:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/vehicles/[id]/media - Liste tous les médias d'un véhicule
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    // Récupérer tous les médias du véhicule
    const media = await prisma.vehicleMedia.findMany({
      where: { vehicleId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        type: true,
        url: true,
        thumbnailUrl: true,
        order: true,
        is360: true,
        caption: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      vehicleId,
      count: media.length,
      media,
    })
  } catch (error) {
    console.error('Error fetching vehicle media:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
