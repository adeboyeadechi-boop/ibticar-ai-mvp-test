// API Route pour la visite virtuelle 360° (PRD-03-US-004)
// GET /api/marketplace/catalog/[id]/virtual-tour - Viewer 360° public

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/marketplace/catalog/[id]/virtual-tour - Récupérer la visite virtuelle
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // PAS D'AUTHENTIFICATION REQUISE - endpoint public

    // Vérifier que le véhicule existe et est disponible
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        model: {
          include: {
            brand: {
              select: {
                name: true,
                logoUrl: true,
              },
            },
          },
        },
        team: {
          select: {
            name: true,
            city: true,
            wilaya: true,
            phone: true,
            email: true,
          },
        },
      },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Vérifier que le véhicule est publié
    if (vehicle.status !== 'AVAILABLE' || !vehicle.availableForSale || !vehicle.publishedAt) {
      return NextResponse.json(
        { error: 'Vehicle is not available in marketplace' },
        { status: 404 }
      )
    }

    // Récupérer tous les médias du véhicule (photos normales + 360°)
    const allMedia = await prisma.vehicleMedia.findMany({
      where: { vehicleId },
      orderBy: {
        order: 'asc',
      },
      select: {
        id: true,
        type: true,
        url: true,
        thumbnailUrl: true,
        caption: true,
        order: true,
        is360: true,
      },
    })

    // Séparer les médias 360° et les photos normales
    const media360 = allMedia.filter((m) => m.type === 'PHOTO_360' || m.is360)
    const normalPhotos = allMedia.filter((m) => m.type === 'PHOTO' && !m.is360)
    const videos = allMedia.filter((m) => m.type === 'VIDEO')

    // Créer la configuration de la visite virtuelle
    const virtualTour = {
      vehicle: {
        id: vehicle.id,
        brand: vehicle.model.brand.name,
        brandLogo: vehicle.model.brand.logoUrl,
        model: vehicle.model.name,
        year: vehicle.year,
        color: vehicle.color,
        mileage: vehicle.mileage,
        price: Number(vehicle.sellingPrice),
        condition: vehicle.condition,
      },
      dealer: {
        name: vehicle.team.name,
        city: vehicle.team.city,
        wilaya: vehicle.team.wilaya,
        phone: vehicle.team.phone,
        email: vehicle.team.email,
      },
      virtualTour: {
        enabled: media360.length > 0,
        scenes: media360.map((m, index) => ({
          id: m.id,
          order: m.order,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl || m.url,
          caption: m.caption || `Vue ${index + 1}`,
          hotspots: generateHotspots(index, media360.length),
        })),
        initialScene: media360.length > 0 ? media360[0].id : null,
        config: {
          autoRotate: true,
          autoRotateSpeed: 2,
          initialView: {
            yaw: 0,
            pitch: 0,
            fov: 90,
          },
          compass: true,
          fullscreen: true,
          mouseZoom: true,
        },
      },
      gallery: {
        photos: normalPhotos.map((p) => ({
          id: p.id,
          url: p.url,
          thumbnailUrl: p.thumbnailUrl || p.url,
          caption: p.caption,
        })),
        videos: videos.map((v) => ({
          id: v.id,
          url: v.url,
          thumbnailUrl: v.thumbnailUrl,
          caption: v.caption,
        })),
      },
      features: {
        has360Tour: media360.length > 0,
        hasPhotos: normalPhotos.length > 0,
        hasVideos: videos.length > 0,
        totalMedia: allMedia.length,
      },
    }

    return NextResponse.json(virtualTour)
  } catch (error) {
    console.error('Error fetching virtual tour:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fonction helper pour générer des hotspots de navigation
function generateHotspots(currentIndex: number, totalScenes: number) {
  const hotspots = []

  // Hotspot vers la scène suivante
  if (currentIndex < totalScenes - 1) {
    hotspots.push({
      type: 'navigation',
      direction: 'next',
      yaw: 90,
      pitch: 0,
      tooltip: 'Vue suivante',
    })
  }

  // Hotspot vers la scène précédente
  if (currentIndex > 0) {
    hotspots.push({
      type: 'navigation',
      direction: 'previous',
      yaw: -90,
      pitch: 0,
      tooltip: 'Vue précédente',
    })
  }

  // Hotspot d'information (exemple: tableau de bord)
  if (currentIndex === 0) {
    hotspots.push({
      type: 'info',
      yaw: 0,
      pitch: -20,
      tooltip: 'Intérieur',
      content: 'Vue de l\'habitacle',
    })
  }

  return hotspots
}
