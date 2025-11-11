// API Routes pour l'historique complet d'un véhicule (Carfax-like)
// GET /api/vehicles/[id]/history - Timeline complète du véhicule
// POST /api/vehicles/[id]/history - Ajouter un événement à l'historique

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { VehicleEventType } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/vehicles/[id]/history - Récupérer l'historique complet
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        model: {
          include: {
            brand: true,
          },
        },
        team: true,
      },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Récupérer l'historique du véhicule
    const history = await prisma.vehicleHistory.findMany({
      where: { vehicleId },
      orderBy: {
        eventDate: 'desc',
      },
    })

    // Construire la timeline complète avec toutes les sources
    const timeline: any[] = []

    // 1. Historique explicite (VehicleHistory)
    history.forEach((event) => {
      timeline.push({
        id: event.id,
        type: event.eventType,
        date: event.eventDate,
        description: event.description,
        performedBy: event.performedBy,
        documents: event.documents,
        cost: event.cost ? Number(event.cost) : null,
        mileage: event.mileage,
        source: 'VEHICLE_HISTORY',
        createdAt: event.createdAt,
      })
    })

    // 2. Événements de transfert
    const transfers = await prisma.stockTransfer.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
      include: {
        fromTeam: { select: { name: true } },
        toTeam: { select: { name: true } },
      },
    })

    transfers.forEach((transfer) => {
      timeline.push({
        id: transfer.id,
        type: 'TRANSFER',
        date: transfer.completedAt || transfer.createdAt,
        description: `Transféré de ${transfer.fromTeam.name} vers ${transfer.toTeam.name}`,
        status: transfer.status,
        source: 'STOCK_TRANSFER',
        createdAt: transfer.createdAt,
      })
    })

    // 3. Événements SAV
    const savTickets = await prisma.afterSalesService.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    })

    savTickets.forEach((ticket) => {
      timeline.push({
        id: ticket.id,
        type: 'MAINTENANCE',
        date: ticket.completedAt || ticket.scheduledAt || ticket.createdAt,
        description: `${ticket.type}: ${ticket.subject}`,
        status: ticket.status,
        cost: ticket.cost ? Number(ticket.cost) : null,
        resolution: ticket.resolution,
        source: 'AFTER_SALES',
        createdAt: ticket.createdAt,
      })
    })

    // 4. Événement de création
    timeline.push({
      id: vehicle.id,
      type: 'PURCHASE',
      date: vehicle.purchaseDate || vehicle.createdAt,
      description: `Véhicule ajouté au stock - ${vehicle.model.brand.name} ${vehicle.model.name} ${vehicle.year}`,
      mileage: vehicle.mileage,
      cost: Number(vehicle.purchasePrice),
      source: 'VEHICLE_CREATION',
      createdAt: vehicle.createdAt,
    })

    // 5. Événement de vente (si vendu)
    if (vehicle.status === 'SOLD' && vehicle.soldAt) {
      timeline.push({
        id: `${vehicle.id}-sale`,
        type: 'SALE',
        date: vehicle.soldAt,
        description: `Véhicule vendu`,
        cost: Number(vehicle.sellingPrice),
        source: 'VEHICLE_SALE',
        createdAt: vehicle.soldAt,
      })
    }

    // Trier la timeline par date (plus récent en premier)
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Calculer des statistiques
    const maintenanceEvents = timeline.filter((e) => e.type === 'MAINTENANCE')
    const totalMaintenanceCost = maintenanceEvents.reduce(
      (sum, e) => sum + (e.cost || 0),
      0
    )

    const stats = {
      totalEvents: timeline.length,
      maintenanceCount: maintenanceEvents.length,
      transferCount: transfers.length,
      totalMaintenanceCost,
      lastMaintenanceDate:
        maintenanceEvents.length > 0 ? maintenanceEvents[0].date : null,
    }

    return NextResponse.json({
      vehicle: {
        id: vehicle.id,
        vin: vehicle.vin,
        brand: vehicle.model.brand.name,
        model: vehicle.model.name,
        year: vehicle.year,
        status: vehicle.status,
        currentMileage: vehicle.mileage,
        currentLocation: vehicle.team.name,
      },
      timeline,
      stats,
    })
  } catch (error) {
    console.error('Error fetching vehicle history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/vehicles/[id]/history - Ajouter un événement à l'historique
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les données
    const body = await request.json()
    const { eventType, eventDate, description, performedBy, documents, cost, mileage } = body

    // Valider les paramètres requis
    if (!eventType || !eventDate || !description) {
      return NextResponse.json(
        { error: 'eventType, eventDate, and description are required' },
        { status: 400 }
      )
    }

    // Valider le type d'événement
    const validTypes: VehicleEventType[] = [
      'PURCHASE',
      'SALE',
      'MAINTENANCE',
      'REPAIR',
      'INSPECTION',
      'ACCIDENT',
      'MODIFICATION',
    ]
    if (!validTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid event type. Must be one of: ${validTypes.join(', ')}` },
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

    // Créer l'événement d'historique
    const historyEvent = await prisma.vehicleHistory.create({
      data: {
        vehicleId,
        eventType: eventType as VehicleEventType,
        eventDate: new Date(eventDate),
        description,
        performedBy,
        documents,
        cost: cost ? Number(cost) : null,
        mileage,
      },
    })

    // Mettre à jour le kilométrage du véhicule si fourni
    if (mileage && mileage > (vehicle.mileage || 0)) {
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: { mileage },
      })
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'VehicleHistory',
        entityId: historyEvent.id,
        changes: {
          vehicleId,
          eventType,
          eventDate,
        },
      },
    })

    return NextResponse.json({
      success: true,
      historyEvent,
      message: 'Vehicle history event created successfully',
    })
  } catch (error) {
    console.error('Error creating vehicle history event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
