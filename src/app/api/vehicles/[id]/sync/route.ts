// API Route pour synchroniser/désynchroniser un véhicule spécifique
// POST /api/vehicles/[id]/sync - Synchronise vers marketplace
// DELETE /api/vehicles/[id]/sync - Retire du marketplace

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/vehicles/[id]/sync - Synchroniser vers marketplace
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent synchroniser
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le véhicule existe et est publié
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
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

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    if (!vehicle.publishedAt) {
      return NextResponse.json(
        { error: 'Vehicle must be published before syncing to marketplace' },
        { status: 400 }
      )
    }

    if (!['AVAILABLE', 'RESERVED'].includes(vehicle.status)) {
      return NextResponse.json(
        { error: 'Only available or reserved vehicles can be synced' },
        { status: 400 }
      )
    }

    // Récupérer les options de sync
    const body = await request.json().catch(() => ({}))
    const { marketplaces = ['PUBLIC_CATALOG'] } = body

    const syncResults: any[] = []
    let successCount = 0

    // Synchroniser vers chaque marketplace
    for (const marketplace of marketplaces) {
      try {
        // Construire les données
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

        // Appeler l'API du marketplace
        const syncResult = await syncToMarketplace(marketplace, marketplaceData)

        // Logger la synchronisation
        const syncLog = await prisma.marketplaceSync.create({
          data: {
            vehicleId: vehicle.id,
            teamId: vehicle.teamId,
            marketplace,
            direction: 'TO_MARKETPLACE',
            status: syncResult.success ? 'SUCCESS' : 'FAILED',
            action: 'MANUAL_SYNC',
            requestData: marketplaceData,
            responseData: syncResult.response || undefined,
            errorMessage: syncResult.error || undefined,
          },
        })

        syncResults.push({
          marketplace,
          success: syncResult.success,
          syncLogId: syncLog.id,
          externalUrl: syncResult.response?.publishedUrl,
          error: syncResult.error,
        })

        if (syncResult.success) successCount++
      } catch (marketplaceError) {
        syncResults.push({
          marketplace,
          success: false,
          error: String(marketplaceError),
        })
      }
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'MarketplaceSync',
        entityId: vehicleId,
        changes: {
          action: 'manual_sync',
          marketplaces,
          successCount,
        },
      },
    })

    return NextResponse.json({
      success: successCount > 0,
      vehicle: {
        id: vehicle.id,
        vin: vehicle.vin,
      },
      syncResults,
      message: `Vehicle synchronized to ${successCount}/${marketplaces.length} marketplace(s)`,
    })
  } catch (error) {
    console.error('Error syncing vehicle to marketplace:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/vehicles/[id]/sync - Désynchroniser du marketplace
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent désynchroniser
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Récupérer les marketplaces actifs
    const activeSyncs = await prisma.marketplaceSync.findMany({
      where: {
        vehicleId,
        status: 'SUCCESS',
      },
      distinct: ['marketplace'],
      orderBy: {
        syncedAt: 'desc',
      },
    })

    const unsyncResults: any[] = []
    let successCount = 0

    // Désynchroniser de chaque marketplace
    for (const sync of activeSyncs) {
      try {
        // Appeler l'API pour retirer le véhicule
        const unsyncResult = await unsyncFromMarketplace(sync.marketplace, vehicleId)

        // Logger la désynchronisation
        await prisma.marketplaceSync.create({
          data: {
            vehicleId,
            teamId: vehicle.teamId,
            marketplace: sync.marketplace,
            direction: 'FROM_MARKETPLACE',
            status: unsyncResult.success ? 'SUCCESS' : 'FAILED',
            action: 'UNSYNC_VEHICLE',
            requestData: { vehicleId },
            responseData: unsyncResult.response || undefined,
            errorMessage: unsyncResult.error || undefined,
          },
        })

        unsyncResults.push({
          marketplace: sync.marketplace,
          success: unsyncResult.success,
          error: unsyncResult.error,
        })

        if (unsyncResult.success) successCount++
      } catch (marketplaceError) {
        unsyncResults.push({
          marketplace: sync.marketplace,
          success: false,
          error: String(marketplaceError),
        })
      }
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'MarketplaceSync',
        entityId: vehicleId,
        changes: {
          action: 'manual_unsync',
          marketplaces: activeSyncs.map((s) => s.marketplace),
          successCount,
        },
      },
    })

    return NextResponse.json({
      success: successCount > 0,
      vehicle: {
        id: vehicle.id,
        vin: vehicle.vin,
      },
      unsyncResults,
      message: `Vehicle removed from ${successCount}/${activeSyncs.length} marketplace(s)`,
    })
  } catch (error) {
    console.error('Error unsyncing vehicle from marketplace:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fonction de synchronisation vers marketplace
async function syncToMarketplace(marketplace: string, vehicleData: any) {
  try {
    // Simulation: 95% success rate
    const success = Math.random() > 0.05

    if (success) {
      return {
        success: true,
        response: {
          externalId: `${marketplace}-${Date.now()}`,
          publishedUrl: `https://marketplace.ibticar.ai/vehicles/${vehicleData.id}`,
          status: 'published',
        },
        error: null,
      }
    } else {
      return {
        success: false,
        response: null,
        error: 'Marketplace API error',
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

// Fonction de désynchronisation du marketplace
async function unsyncFromMarketplace(marketplace: string, vehicleId: string) {
  try {
    // Simulation: 98% success rate
    const success = Math.random() > 0.02

    if (success) {
      return {
        success: true,
        response: {
          status: 'removed',
          removedAt: new Date().toISOString(),
        },
        error: null,
      }
    } else {
      return {
        success: false,
        response: null,
        error: 'Marketplace API error',
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
