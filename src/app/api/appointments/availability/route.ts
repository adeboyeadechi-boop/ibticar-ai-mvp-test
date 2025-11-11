// API Route pour vérifier la disponibilité des créneaux horaires
// GET /api/appointments/availability - Retourne les créneaux disponibles

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/appointments/availability - Vérifier la disponibilité
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres
    const searchParams = request.nextUrl.searchParams
    const assignedToId = searchParams.get('assignedToId')
    const date = searchParams.get('date') // Format: YYYY-MM-DD
    const duration = parseInt(searchParams.get('duration') || '60', 10) // Minutes

    if (!assignedToId || !date) {
      return NextResponse.json(
        { error: 'assignedToId and date are required' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur existe
    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedToId },
    })

    if (!assignedUser) {
      return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 })
    }

    // Calculer le début et la fin de la journée
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // Récupérer tous les rendez-vous du jour
    const appointments = await prisma.appointment.findMany({
      where: {
        assignedToId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        scheduledAt: true,
        duration: true,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    })

    // Configurer les heures de travail (8h-18h par défaut)
    const workStartHour = 8
    const workEndHour = 18
    const slotDuration = 30 // Créneaux de 30 minutes

    // Générer tous les créneaux possibles
    const allSlots: any[] = []
    const currentDate = new Date(startOfDay)
    currentDate.setHours(workStartHour, 0, 0, 0)

    const workEnd = new Date(startOfDay)
    workEnd.setHours(workEndHour, 0, 0, 0)

    while (currentDate < workEnd) {
      const slotEnd = new Date(currentDate)
      slotEnd.setMinutes(slotEnd.getMinutes() + duration)

      // Ne pas dépasser la fin de journée
      if (slotEnd <= workEnd) {
        allSlots.push({
          start: new Date(currentDate),
          end: slotEnd,
          available: true,
        })
      }

      currentDate.setMinutes(currentDate.getMinutes() + slotDuration)
    }

    // Marquer les créneaux occupés
    const availableSlots = allSlots.map((slot) => {
      // Vérifier si ce créneau chevauche un rendez-vous existant
      const isOccupied = appointments.some((appointment) => {
        const appointmentStart = new Date(appointment.scheduledAt)
        const appointmentEnd = new Date(appointmentStart)
        appointmentEnd.setMinutes(appointmentEnd.getMinutes() + appointment.duration)

        // Vérifier le chevauchement
        return (
          (slot.start >= appointmentStart && slot.start < appointmentEnd) ||
          (slot.end > appointmentStart && slot.end <= appointmentEnd) ||
          (slot.start <= appointmentStart && slot.end >= appointmentEnd)
        )
      })

      return {
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        available: !isOccupied,
      }
    })

    // Filtrer pour ne retourner que les créneaux disponibles
    const onlyAvailable = availableSlots.filter((slot) => slot.available)

    return NextResponse.json({
      assignedToId,
      date,
      duration,
      workHours: {
        start: workStartHour,
        end: workEndHour,
      },
      totalSlots: allSlots.length,
      availableSlots: onlyAvailable.length,
      bookedSlots: allSlots.length - onlyAvailable.length,
      slots: availableSlots,
    })
  } catch (error) {
    console.error('Error checking availability:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
