// API Route pour confirmer un rendez-vous
// POST /api/appointments/[id]/confirm - Confirme un rendez-vous programmé

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/appointments/[id]/confirm - Confirmer le rendez-vous
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: appointmentId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier que le rendez-vous existe
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Vérifier que le statut est SCHEDULED
    if (appointment.status !== 'SCHEDULED') {
      return NextResponse.json(
        { error: 'Only scheduled appointments can be confirmed' },
        { status: 400 }
      )
    }

    // Confirmer le rendez-vous
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CONFIRMED',
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Appointment',
        entityId: appointmentId,
        changes: {
          action: 'confirmed',
          previousStatus: 'SCHEDULED',
          newStatus: 'CONFIRMED',
        },
      },
    })

    // TODO: Envoyer notification de confirmation au client

    return NextResponse.json({
      success: true,
      appointment: updatedAppointment,
      message: 'Appointment confirmed successfully',
    })
  } catch (error) {
    console.error('Error confirming appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
