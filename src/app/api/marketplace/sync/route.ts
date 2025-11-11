// API Route pour synchroniser les véhicules vers le marketplace public
// POST /api/marketplace/sync - Synchronise les véhicules approuvés vers le marketplace

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// POST /api/marketplace/sync - Synchroniser vers marketplace (cron job)
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'autorisation cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dev-secret'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Trouver tous les véhicules publiés qui ne sont pas encore synchronisés
    const publishedVehicles = await prisma.vehicle.findMany({
      where: {
        status: { in: ['AVAILABLE', 'RESERVED'] },
        publishedAt: { not: null },
      },
      include: {
        model: {
          include: {
            brand: true,
          },
        },
        team: true,
        media: true,
      },
    })

    let syncSuccess = 0
    let syncFailed = 0
    const errors: any[] = []

    // Synchroniser chaque véhicule
    for (const vehicle of publishedVehicles) {
      try {
        // Vérifier si déjà synchronisé récemment (dernières 24h)
        const recentSync = await prisma.marketplaceSync.findFirst({
          where: {
            vehicleId: vehicle.id,
            status: 'SUCCESS',
            syncedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        })

        if (recentSync) {
          // Déjà synchronisé récemment, passer
          continue
        }

        // Construire les données de synchronisation
        const marketplaceData = {
          id: vehicle.id,
          vin: vehicle.vin,
          brand: vehicle.model.brand.name,
          model: vehicle.model.name,
          year: vehicle.year,
          color: vehicle.color,
          mileage: vehicle.mileage,
          price: Number(vehicle.sellingPrice),
          currency: vehicle.currency,
          condition: vehicle.condition,
          status: vehicle.status,
          fuelType: vehicle.model.fuelType,
          transmission: vehicle.model.transmission,
          horsePower: vehicle.model.horsePower,
          seats: vehicle.model.seats,
          doors: vehicle.model.doors,
          energyLabel: vehicle.energyClass,
          features: vehicle.features,
          media: vehicle.media.map((m) => ({
            type: m.type,
            url: m.url,
            thumbnailUrl: m.thumbnailUrl,
            is360: m.is360,
          })),
          location: {
            teamName: vehicle.team.name,
            city: vehicle.team.city,
            wilaya: vehicle.team.wilaya,
          },
          publishedAt: vehicle.publishedAt,
        }

        // Simuler la synchronisation vers un marketplace externe
        // Dans un vrai système, appeler l'API du marketplace (ex: Ouedkniss, Tayara, etc.)
        const syncResult = await syncToExternalMarketplace(marketplaceData)

        // Logger la synchronisation
        await prisma.marketplaceSync.create({
          data: {
            vehicleId: vehicle.id,
            teamId: vehicle.teamId,
            marketplace: 'PUBLIC_CATALOG', // Ou nom du marketplace externe
            direction: 'TO_MARKETPLACE',
            status: syncResult.success ? 'SUCCESS' : 'FAILED',
            action: 'SYNC_VEHICLE',
            requestData: marketplaceData,
            responseData: syncResult.response ?? undefined,
            errorMessage: syncResult.error,
          },
        })

        if (syncResult.success) {
          syncSuccess++
        } else {
          syncFailed++
          errors.push({
            vehicleId: vehicle.id,
            vin: vehicle.vin,
            error: syncResult.error,
          })
        }
      } catch (vehicleError) {
        syncFailed++
        errors.push({
          vehicleId: vehicle.id,
          error: String(vehicleError),
        })
      }
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'CREATE',
        entityType: 'MarketplaceSync',
        entityId: null,
        changes: {
          action: 'cron_marketplace_sync',
          vehiclesProcessed: publishedVehicles.length,
          syncSuccess,
          syncFailed,
          errors: errors.length,
        },
      },
    })

    return NextResponse.json({
      success: true,
      vehiclesProcessed: publishedVehicles.length,
      syncSuccess,
      syncFailed,
      errors,
      message: `${syncSuccess} vehicles synchronized successfully`,
    })
  } catch (error) {
    console.error('Error syncing marketplace:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fonction de synchronisation vers marketplace externe
async function syncToExternalMarketplace(vehicleData: any) {
  try {
    // Simuler un appel API externe
    // Dans un vrai système, remplacer par:
    // - API Ouedkniss: https://api.ouedkniss.com/v1/vehicles
    // - API Tayara: https://api.tayara.tn/v1/listings
    // - API interne: https://marketplace.ibticar.ai/api/vehicles

    // Simulation: 95% success rate
    const success = Math.random() > 0.05

    if (success) {
      return {
        success: true,
        response: {
          externalId: `EXT-${Date.now()}`,
          publishedUrl: `https://marketplace.ibticar.ai/vehicles/${vehicleData.id}`,
          status: 'published',
        },
        error: null,
      }
    } else {
      return {
        success: false,
        response: null,
        error: 'External marketplace API timeout',
      }
    }
  } catch (error) {
    return {
      success: false,
      response: null,
      error: String(error),
    }
  }
}
