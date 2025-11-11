// API Route pour la fiche détaillée d'un véhicule (PRD-03-US-002)
// GET /api/marketplace/catalog/[id] - Page détail véhicule (PUBLIC)

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/marketplace/catalog/[id] - Fiche détaillée publique
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // PAS D'AUTHENTIFICATION REQUISE - endpoint public

    // Récupérer le véhicule avec toutes les informations
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        model: {
          include: {
            brand: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
                country: true,
                website: true,
              },
            },
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            wilaya: true,
            phone: true,
            email: true,
            website: true,
            logoUrl: true,
            businessHours: true,
          },
        },
        media: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Vérifier que le véhicule est disponible et publié
    if (vehicle.status !== 'AVAILABLE' || !vehicle.availableForSale || !vehicle.publishedAt) {
      return NextResponse.json(
        { error: 'Vehicle is not available in marketplace' },
        { status: 404 }
      )
    }

    // Incrémenter le compteur de vues
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })

    // Récupérer des véhicules similaires (même marque/modèle ou prix similaire)
    const similarVehicles = await prisma.vehicle.findMany({
      where: {
        id: { not: vehicleId },
        status: 'AVAILABLE',
        availableForSale: true,
        publishedAt: { not: null },
        OR: [
          { vehicleModelId: vehicle.vehicleModelId },
          {
            sellingPrice: {
              gte: Number(vehicle.sellingPrice) * 0.8,
              lte: Number(vehicle.sellingPrice) * 1.2,
            },
          },
        ],
      },
      take: 6,
      select: {
        id: true,
        year: true,
        color: true,
        mileage: true,
        sellingPrice: true,
        model: {
          select: {
            name: true,
            brand: {
              select: {
                name: true,
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
    })

    // Formater la réponse détaillée
    const detailedVehicle = {
      id: vehicle.id,
      vin: vehicle.vin,
      registrationNumber: vehicle.registrationNumber,

      // Informations de base
      brand: {
        id: vehicle.model.brand.id,
        name: vehicle.model.brand.name,
        logo: vehicle.model.brand.logoUrl,
        country: vehicle.model.brand.country,
        website: vehicle.model.brand.website,
      },
      model: {
        id: vehicle.model.id,
        name: vehicle.model.name,
        category: vehicle.model.category,
      },

      year: vehicle.year,
      mileage: vehicle.mileage,
      color: vehicle.color,
      condition: vehicle.condition,

      // Prix
      price: {
        selling: Number(vehicle.sellingPrice),
        purchase: Number(vehicle.purchasePrice), // Pour calcul de marge (optionnel)
        currency: 'DZD',
        negotiable: true, // Peut être configuré
      },

      // Caractéristiques techniques
      specifications: {
        fuelType: vehicle.model.fuelType,
        transmission: vehicle.model.transmission,
        horsePower: vehicle.model.horsePower,
        engineSize: vehicle.model.engineCapacity,
        doors: vehicle.model.doors,
        seats: vehicle.model.seats,
        energyLabel: vehicle.energyClass,
        co2Emissions: vehicle.model.co2Emission,
      },

      // Équipements et options
      features: vehicle.features || [],

      // Description
      description: vehicle.description,

      // Localisation et vendeur
      dealer: {
        id: vehicle.team.id,
        name: vehicle.team.name,
        address: vehicle.team.address,
        city: vehicle.team.city,
        wilaya: vehicle.team.wilaya,
        phone: vehicle.team.phone,
        email: vehicle.team.email,
        website: vehicle.team.website,
        logo: vehicle.team.logoUrl,
        businessHours: vehicle.team.businessHours,
      },

      // Médias
      images: vehicle.media
        .filter((m) => m.type === 'PHOTO')
        .map((m) => ({
          id: m.id,
          url: m.url,
          isPrimary: m.isPrimary,
          order: m.order,
        })),
      videos: vehicle.media
        .filter((m) => m.type === 'VIDEO')
        .map((m) => ({
          id: m.id,
          url: m.url,
        })),

      // Informations complémentaires
      availability: {
        status: vehicle.status,
        availableForSale: vehicle.availableForSale,
        availableForRent: vehicle.availableForRent,
      },

      // Dates
      publishedAt: vehicle.publishedAt,
      purchaseDate: vehicle.purchaseDate,

      // Statistiques
      viewCount: (vehicle.viewCount || 0) + 1,

      // Véhicules similaires
      similarVehicles: similarVehicles.map((sv) => ({
        id: sv.id,
        brand: sv.model.brand.name,
        model: sv.model.name,
        year: sv.year,
        price: Number(sv.sellingPrice),
        mileage: sv.mileage,
        image: sv.media[0]?.url,
      })),
    }

    return NextResponse.json({
      vehicle: detailedVehicle,
    })
  } catch (error) {
    console.error('Error fetching vehicle details:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
