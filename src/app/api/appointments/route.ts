// API Routes pour gestion des rendez-vous
// GET /api/appointments - Liste des rendez-vous avec filtres
// POST /api/appointments - Créer un nouveau rendez-vous

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { AppointmentType, AppointmentStatus } from '@/generated/prisma'

// GET /api/appointments - Liste des rendez-vous
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customerId')
    const assignedToId = searchParams.get('assignedToId')
    const vehicleId = searchParams.get('vehicleId')
    const type = searchParams.get('type') as AppointmentType | null
    const status = searchParams.get('status') as AppointmentStatus | null
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    if (customerId) where.customerId = customerId
    if (assignedToId) where.assignedToId = assignedToId
    if (vehicleId) where.vehicleId = vehicleId
    if (type) where.type = type
    if (status) where.status = status

    if (fromDate || toDate) {
      where.scheduledAt = {}
      if (fromDate) where.scheduledAt.gte = new Date(fromDate)
      if (toDate) where.scheduledAt.lte = new Date(toDate)
    }

    // Compter le total
    const total = await prisma.appointment.count({ where })

    // Récupérer les rendez-vous
    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: {
        scheduledAt: 'asc',
      },
      skip,
      take: limit,
    })

    return NextResponse.json({
      appointments,
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
    console.error('Error fetching appointments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/appointments - Créer un rendez-vous
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les données
    const body = await request.json()
    const {
      customerId,
      assignedToId,
      type,
      scheduledAt,
      duration = 60, // Durée par défaut: 60 minutes
      vehicleId,
      location,
      notes,
    } = body

    // Valider les paramètres requis
    if (!customerId || !assignedToId || !type || !scheduledAt) {
      return NextResponse.json(
        { error: 'customerId, assignedToId, type, and scheduledAt are required' },
        { status: 400 }
      )
    }

    // Valider le type de rendez-vous
    const validTypes: AppointmentType[] = [
      'TEST_DRIVE',
      'CONSULTATION',
      'DELIVERY',
      'AFTER_SALES',
      'OTHER',
    ]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid appointment type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Vérifier que la date est dans le futur
    const appointmentDate = new Date(scheduledAt)
    if (appointmentDate < new Date()) {
      return NextResponse.json(
        { error: 'Appointment date must be in the future' },
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

    // Vérifier que l'utilisateur assigné existe
    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedToId },
    })

    if (!assignedUser) {
      return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 })
    }

    // Vérifier qu'il n'y a pas de conflit d'horaire
    const endTime = new Date(appointmentDate)
    endTime.setMinutes(endTime.getMinutes() + duration)

    const conflictingAppointments = await prisma.appointment.count({
      where: {
        assignedToId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: {
          gte: appointmentDate,
          lt: endTime,
        },
      },
    })

    if (conflictingAppointments > 0) {
      return NextResponse.json(
        { error: 'Time slot is already booked for the assigned user' },
        { status: 409 }
      )
    }

    // Créer le rendez-vous
    const appointment = await prisma.appointment.create({
      data: {
        customerId,
        assignedToId,
        type: type as AppointmentType,
        status: 'SCHEDULED',
        scheduledAt: appointmentDate,
        duration,
        vehicleId,
        location,
        notes,
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Appointment',
        entityId: appointment.id,
        changes: {
          customerId,
          assignedToId,
          type,
          scheduledAt: appointmentDate,
        },
      },
    })

    // TODO: Créer une notification pour l'utilisateur assigné
    // TODO: Envoyer un email/SMS de confirmation au client

    return NextResponse.json({
      success: true,
      appointment,
      message: 'Appointment created successfully',
    })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
