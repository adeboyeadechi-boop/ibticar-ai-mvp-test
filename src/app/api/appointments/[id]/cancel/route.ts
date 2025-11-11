// API Route pour annuler un rendez-vous
// POST /api/appointments/[id]/cancel - Annule un rendez-vous

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/appointments/[id]/cancel - Annuler le rendez-vous
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: appointmentId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer la raison d'annulation (obligatoire)
    const body = await request.json()
    const { cancellationReason } = body

    if (!cancellationReason) {
      return NextResponse.json(
        { error: 'Cancellation reason is required' },
        { status: 400 }
      )
    }

    // Vérifier que le rendez-vous existe
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Vérifier que le statut permet l'annulation
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status)) {
      return NextResponse.json(
        { error: 'Cannot cancel an appointment that is already completed, cancelled, or marked as no-show' },
        { status: 400 }
      )
    }

    // Annuler le rendez-vous
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason,
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
          action: 'cancelled',
          previousStatus: appointment.status,
          newStatus: 'CANCELLED',
          cancellationReason,
        },
      },
    })

    // TODO: Envoyer notification d'annulation au client et à l'utilisateur assigné

    return NextResponse.json({
      success: true,
      appointment: updatedAppointment,
      message: 'Appointment cancelled successfully',
    })
  } catch (error) {
    console.error('Error cancelling appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
