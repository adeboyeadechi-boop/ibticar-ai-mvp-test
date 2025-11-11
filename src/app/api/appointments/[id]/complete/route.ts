// API Route pour marquer un rendez-vous comme complété
// POST /api/appointments/[id]/complete - Marque un rendez-vous comme terminé

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/appointments/[id]/complete - Compléter le rendez-vous
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: appointmentId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les notes optionnelles
    const body = await request.json()
    const { notes } = body

    // Vérifier que le rendez-vous existe
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Vérifier que le statut permet la complétion
    if (!['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) {
      return NextResponse.json(
        { error: 'Only scheduled or confirmed appointments can be completed' },
        { status: 400 }
      )
    }

    // Marquer comme complété
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes: notes || appointment.notes,
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
          action: 'completed',
          previousStatus: appointment.status,
          newStatus: 'COMPLETED',
          completedAt: new Date(),
        },
      },
    })

    // TODO: Demander feedback/satisfaction au client

    return NextResponse.json({
      success: true,
      appointment: updatedAppointment,
      message: 'Appointment marked as completed',
    })
  } catch (error) {
    console.error('Error completing appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
