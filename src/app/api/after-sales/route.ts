// API Routes pour Service Après-Vente (SAV)
// GET /api/after-sales - Liste des tickets SAV
// POST /api/after-sales - Créer un ticket SAV

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { ServiceType, ServiceStatus, Priority } from '@/generated/prisma'

// GET /api/after-sales - Liste des tickets SAV
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customerId')
    const vehicleId = searchParams.get('vehicleId')
    const orderId = searchParams.get('orderId')
    const type = searchParams.get('type') as ServiceType | null
    const status = searchParams.get('status') as ServiceStatus | null
    const priority = searchParams.get('priority') as Priority | null
    const assignedToId = searchParams.get('assignedToId')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}
    if (customerId) where.customerId = customerId
    if (vehicleId) where.vehicleId = vehicleId
    if (orderId) where.orderId = orderId
    if (type) where.type = type
    if (status) where.status = status
    if (priority) where.priority = priority
    if (assignedToId) where.assignedToId = assignedToId

    // Compter le total
    const total = await prisma.afterSalesService.count({ where })

    // Récupérer les tickets
    const tickets = await prisma.afterSalesService.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    })

    return NextResponse.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('Error fetching after-sales tickets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/after-sales - Créer un ticket SAV
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les données
    const body = await request.json()
    const {
      orderId,
      customerId,
      vehicleId,
      type,
      priority = 'MEDIUM',
      subject,
      description,
      assignedToId,
      scheduledAt,
    } = body

    // Valider les paramètres requis
    if (!orderId || !customerId || !vehicleId || !type || !subject || !description) {
      return NextResponse.json(
        {
          error:
            'orderId, customerId, vehicleId, type, subject, and description are required',
        },
        { status: 400 }
      )
    }

    // Valider le type de service
    const validTypes: ServiceType[] = [
      'WARRANTY',
      'MAINTENANCE',
      'REPAIR',
      'INSPECTION',
      'OTHER',
    ]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid service type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Vérifier que le client existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Générer le numéro de ticket
    const year = new Date().getFullYear()
    const count = await prisma.afterSalesService.count()
    const ticketNumber = `SAV-${year}-${String(count + 1).padStart(6, '0')}`

    // Créer le ticket SAV
    const ticket = await prisma.afterSalesService.create({
      data: {
        ticketNumber,
        orderId,
        customerId,
        vehicleId,
        type: type as ServiceType,
        status: 'OPEN',
        priority: priority as Priority,
        subject,
        description,
        assignedToId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'AfterSalesService',
        entityId: ticket.id,
        changes: {
          ticketNumber: ticket.ticketNumber,
          type,
          customerId,
          vehicleId,
        },
      },
    })

    // TODO: Créer notification pour le client et le technicien assigné

    return NextResponse.json({
      success: true,
      ticket,
      message: `After-sales ticket ${ticket.ticketNumber} created successfully`,
    })
  } catch (error) {
    console.error('Error creating after-sales ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
