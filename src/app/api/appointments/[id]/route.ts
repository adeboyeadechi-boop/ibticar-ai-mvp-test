// API Routes pour gestion individuelle des rendez-vous
// GET /api/appointments/[id] - Détails d'un rendez-vous
// PUT /api/appointments/[id] - Modifier un rendez-vous
// DELETE /api/appointments/[id] - Supprimer un rendez-vous

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { AppointmentType } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/appointments/[id] - Détails du rendez-vous
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: appointmentId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer le rendez-vous
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    return NextResponse.json({ appointment })
  } catch (error) {
    console.error('Error fetching appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/appointments/[id] - Modifier le rendez-vous
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: appointmentId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les données
    const body = await request.json()
    const { assignedToId, type, scheduledAt, duration, vehicleId, location, notes } = body

    // Vérifier que le rendez-vous existe
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    })

    if (!existingAppointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Ne peut pas modifier un rendez-vous complété ou annulé
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(existingAppointment.status)) {
      return NextResponse.json(
        { error: 'Cannot modify completed, cancelled, or no-show appointments' },
        { status: 400 }
      )
    }

    // Valider le type si fourni
    if (type) {
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
    }

    // Vérifier conflit d'horaire si date/durée/assigné change
    if (scheduledAt || duration || assignedToId) {
      const newScheduledAt = scheduledAt
        ? new Date(scheduledAt)
        : existingAppointment.scheduledAt
      const newDuration = duration || existingAppointment.duration
      const newAssignedToId = assignedToId || existingAppointment.assignedToId

      const endTime = new Date(newScheduledAt)
      endTime.setMinutes(endTime.getMinutes() + newDuration)

      const conflictingAppointments = await prisma.appointment.count({
        where: {
          id: { not: appointmentId },
          assignedToId: newAssignedToId,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          scheduledAt: {
            gte: newScheduledAt,
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
    }

    // Construire les données de mise à jour
    const updateData: any = {}
    if (assignedToId) updateData.assignedToId = assignedToId
    if (type) updateData.type = type as AppointmentType
    if (scheduledAt) updateData.scheduledAt = new Date(scheduledAt)
    if (duration) updateData.duration = duration
    if (vehicleId !== undefined) updateData.vehicleId = vehicleId
    if (location !== undefined) updateData.location = location
    if (notes !== undefined) updateData.notes = notes

    // Mettre à jour le rendez-vous
    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Appointment',
        entityId: appointmentId,
        changes: updateData,
      },
    })

    return NextResponse.json({
      success: true,
      appointment,
      message: 'Appointment updated successfully',
    })
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/appointments/[id] - Supprimer le rendez-vous
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: appointmentId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent supprimer des rendez-vous
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le rendez-vous existe
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Supprimer le rendez-vous
    await prisma.appointment.delete({
      where: { id: appointmentId },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'Appointment',
        entityId: appointmentId,
        changes: {
          deletedAppointment: {
            customerId: appointment.customerId,
            scheduledAt: appointment.scheduledAt,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Appointment deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
