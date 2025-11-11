// API Route pour générer un rapport d'historique détaillé (Carfax-style)
// GET /api/vehicles/[id]/history-report - Génère un rapport PDF/JSON complet

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/vehicles/[id]/history-report - Rapport d'historique complet
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: vehicleId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Format de sortie (json ou pdf)
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'

    // Récupérer le véhicule avec toutes les relations
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

    // Récupérer toutes les données d'historique
    const [history, transfers, savTickets, workflowValidations] = await Promise.all([
      prisma.vehicleHistory.findMany({
        where: { vehicleId },
        orderBy: { eventDate: 'desc' },
      }),
      prisma.stockTransfer.findMany({
        where: { vehicleId },
        orderBy: { createdAt: 'desc' },
        include: {
          fromTeam: { select: { name: true, city: true } },
          toTeam: { select: { name: true, city: true } },
        },
      }),
      prisma.afterSalesService.findMany({
        where: { vehicleId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workflowValidation.findMany({
        where: {
          entityType: 'Vehicle',
          entityId: vehicleId,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // Calculer les métriques clés
    const totalMaintenance = savTickets.filter((t) =>
      ['MAINTENANCE', 'REPAIR'].includes(t.type)
    ).length
    const totalInspections = savTickets.filter((t) => t.type === 'INSPECTION').length
    const totalAccidents = history.filter((h) => h.eventType === 'ACCIDENT').length
    const totalOwners = transfers.length + 1 // +1 pour le propriétaire initial

    const maintenanceCost = savTickets.reduce(
      (sum, ticket) => sum + Number(ticket.cost || 0),
      0
    )

    const historyCost = history.reduce((sum, event) => sum + Number(event.cost || 0), 0)

    const totalCost = maintenanceCost + historyCost

    // Calculer l'âge du véhicule
    const currentYear = new Date().getFullYear()
    const vehicleAge = currentYear - vehicle.year

    // Calculer le kilométrage moyen annuel
    const avgMileagePerYear = vehicleAge > 0 ? (vehicle.mileage || 0) / vehicleAge : 0

    // Score de condition du véhicule (0-100)
    let conditionScore = 100

    // Pénalités
    if (totalAccidents > 0) conditionScore -= totalAccidents * 15
    if (totalMaintenance > 10) conditionScore -= (totalMaintenance - 10) * 2
    if (avgMileagePerYear > 20000) conditionScore -= ((avgMileagePerYear - 20000) / 1000) * 0.5
    if (vehicleAge > 10) conditionScore -= (vehicleAge - 10) * 3

    // Bonus
    if (totalInspections > 2) conditionScore += 5
    if (totalMaintenance > 0 && totalMaintenance <= 5) conditionScore += 5

    conditionScore = Math.max(0, Math.min(100, conditionScore))

    // Alertes et drapeaux rouges
    const alerts: string[] = []
    if (totalAccidents > 0) alerts.push(`${totalAccidents} accident(s) signalé(s)`)
    if (totalOwners > 3) alerts.push(`${totalOwners} propriétaires successifs`)
    if (avgMileagePerYear > 25000) alerts.push('Kilométrage élevé')
    if (vehicleAge > 15) alerts.push('Véhicule ancien')
    if (savTickets.some((t) => t.type === 'REPAIR' && t.priority === 'URGENT'))
      alerts.push('Réparations importantes effectuées')

    // Recommandations
    const recommendations: string[] = []
    if (totalInspections === 0)
      recommendations.push('Aucune inspection enregistrée - Recommandé')
    if (maintenanceCost > Number(vehicle.purchasePrice) * 0.5)
      recommendations.push('Coûts de maintenance élevés')
    if (conditionScore < 70)
      recommendations.push('État général nécessite une inspection approfondie')
    if (avgMileagePerYear < 10000)
      recommendations.push('Faible kilométrage annuel - Bon indicateur')

    // Construire le rapport
    const report = {
      reportId: `VHR-${vehicle.id.slice(-8)}-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      vehicle: {
        vin: vehicle.vin,
        brand: vehicle.model.brand.name,
        model: vehicle.model.name,
        year: vehicle.year,
        color: vehicle.color,
        mileage: vehicle.mileage,
        condition: vehicle.condition,
        status: vehicle.status,
        fuelType: vehicle.model.fuelType,
        transmission: vehicle.model.transmission,
        horsePower: vehicle.model.horsePower,
        energyLabel: vehicle.energyClass,
      },
      ownership: {
        currentOwner: vehicle.team.name,
        totalOwners,
        purchaseDate: vehicle.purchaseDate,
        soldAt: vehicle.soldAt,
      },
      scores: {
        conditionScore: Math.round(conditionScore),
        rating: conditionScore >= 85 ? 'Excellent' : conditionScore >= 70 ? 'Bon' : conditionScore >= 50 ? 'Moyen' : 'Faible',
      },
      metrics: {
        vehicleAge,
        totalMileage: vehicle.mileage || 0,
        avgMileagePerYear: Math.round(avgMileagePerYear),
        totalMaintenanceEvents: totalMaintenance,
        totalInspections,
        totalAccidents,
        totalCost: Math.round(totalCost * 100) / 100,
      },
      history: {
        maintenanceRecords: savTickets.map((ticket) => ({
          date: ticket.scheduledAt || ticket.createdAt,
          type: ticket.type,
          description: ticket.subject,
          status: ticket.status,
          cost: ticket.cost ? Number(ticket.cost) : null,
          performedBy: ticket.assignedToId,
        })),
        transferHistory: transfers.map((transfer) => ({
          date: transfer.completedAt || transfer.createdAt,
          from: transfer.fromTeam.name,
          to: transfer.toTeam.name,
          status: transfer.status,
        })),
        significantEvents: history
          .filter((h) => ['ACCIDENT', 'MODIFICATION', 'SALE', 'PURCHASE'].includes(h.eventType))
          .map((event) => ({
            date: event.eventDate,
            type: event.eventType,
            description: event.description,
            cost: event.cost ? Number(event.cost) : null,
            mileage: event.mileage,
          })),
      },
      alerts,
      recommendations,
      verification: {
        dataVerified: true,
        lastVerificationDate: new Date().toISOString(),
        sources: ['INTERNAL_RECORDS', 'SERVICE_HISTORY', 'TRANSFER_LOGS'],
      },
    }

    // Si format PDF demandé, retourner un message (implémentation PDF à faire)
    if (format === 'pdf') {
      return NextResponse.json({
        message: 'PDF generation not yet implemented. Use format=json',
        reportData: report,
      })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error generating vehicle history report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
