// API Route pour envoyer des rappels de rendez-vous
// POST /api/appointments/reminders - Identifie et envoie les rappels (cron job)

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// POST /api/appointments/reminders - Envoyer les rappels
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'autorisation cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dev-secret'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Trouver les rendez-vous qui nécessitent un rappel
    // Rappel 24h avant le rendez-vous
    const reminderTime = new Date()
    reminderTime.setHours(reminderTime.getHours() + 24)

    const appointmentsNeedingReminder = await prisma.appointment.findMany({
      where: {
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        reminderSent: false,
        scheduledAt: {
          gte: new Date(),
          lte: reminderTime,
        },
      },
      select: {
        id: true,
        customerId: true,
        assignedToId: true,
        type: true,
        scheduledAt: true,
        duration: true,
        location: true,
        vehicleId: true,
      },
    })

    let remindersCreated = 0
    const errors: any[] = []

    // Créer des notifications pour chaque rendez-vous
    for (const appointment of appointmentsNeedingReminder) {
      try {
        // Créer une notification pour le client
        await prisma.notification.create({
          data: {
            userId: appointment.customerId,
            type: 'APPOINTMENT',
            channel: 'EMAIL',
            priority: 'HIGH',
            title: 'Rappel de rendez-vous',
            message: `Votre rendez-vous de type ${appointment.type} est prévu le ${new Date(appointment.scheduledAt).toLocaleString('fr-DZ')}${appointment.location ? ` à ${appointment.location}` : ''}.`,
            data: {
              appointmentId: appointment.id,
              scheduledAt: appointment.scheduledAt,
              type: appointment.type,
            },
            status: 'PENDING',
          },
        })

        // Créer une notification pour l'utilisateur assigné
        await prisma.notification.create({
          data: {
            userId: appointment.assignedToId,
            type: 'APPOINTMENT',
            channel: 'IN_APP',
            priority: 'MEDIUM',
            title: 'Rendez-vous à venir',
            message: `Rappel: Rendez-vous prévu le ${new Date(appointment.scheduledAt).toLocaleString('fr-DZ')}`,
            data: {
              appointmentId: appointment.id,
              scheduledAt: appointment.scheduledAt,
              type: appointment.type,
            },
            status: 'PENDING',
          },
        })

        // Marquer le rappel comme envoyé
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { reminderSent: true },
        })

        remindersCreated++
      } catch (error) {
        errors.push({
          appointmentId: appointment.id,
          error: String(error),
        })
      }
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'CREATE',
        entityType: 'AppointmentReminder',
        entityId: null,
        changes: {
          action: 'cron_reminders_sent',
          remindersCreated,
          appointmentsProcessed: appointmentsNeedingReminder.length,
          errors: errors.length,
        },
      },
    })

    return NextResponse.json({
      success: true,
      remindersCreated,
      appointmentsProcessed: appointmentsNeedingReminder.length,
      errors,
      message: `${remindersCreated} reminders sent successfully`,
    })
  } catch (error) {
    console.error('Error sending appointment reminders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
