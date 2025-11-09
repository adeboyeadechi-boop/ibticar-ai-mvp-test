// API Routes pour la gestion d'un lead spécifique
// GET /api/leads/[id] - Récupère un lead
// PATCH /api/leads/[id] - Met à jour un lead
// DELETE /api/leads/[id] - Supprime un lead

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { LeadStatus } from '@/generated/prisma'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/leads/[id] - Récupère un lead avec tous ses détails
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer le lead
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        assignedToId: true,
        source: true,
        status: true,
        score: true,
        interestedVehicleId: true,
        budget: true,
        timeline: true,
        notes: true,
        lastContactDate: true,
        nextFollowUpDate: true,
        convertedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error fetching lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/leads/[id] - Met à jour un lead
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification et permissions
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le lead existe
    const existingLead = await prisma.lead.findUnique({
      where: { id },
    })

    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Récupérer les données du body
    const body = await request.json()
    const {
      assignedToId,
      status,
      score,
      interestedVehicleId,
      budget,
      timeline,
      notes,
      lastContactDate,
      nextFollowUpDate,
      converted,
    } = body

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (assignedToId !== undefined) {
      // Vérifier que l'utilisateur existe
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
      })
      if (!assignedUser) {
        return NextResponse.json(
          { error: 'Assigned user not found' },
          { status: 404 }
        )
      }
      updateData.assignedToId = assignedToId
    }

    if (status !== undefined) {
      updateData.status = status
      // Si converti en vente, mettre à jour la date
      if (status === LeadStatus.WON && !existingLead.convertedAt) {
        updateData.convertedAt = new Date()
      }
    }

    if (score !== undefined) updateData.score = score
    if (interestedVehicleId !== undefined) {
      // Vérifier que le véhicule existe si fourni
      if (interestedVehicleId) {
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: interestedVehicleId },
        })
        if (!vehicle) {
          return NextResponse.json(
            { error: 'Vehicle not found' },
            { status: 404 }
          )
        }
      }
      updateData.interestedVehicleId = interestedVehicleId
    }
    if (budget !== undefined) updateData.budget = budget
    if (timeline !== undefined) updateData.timeline = timeline
    if (notes !== undefined) updateData.notes = notes
    if (lastContactDate !== undefined)
      updateData.lastContactDate = lastContactDate
        ? new Date(lastContactDate)
        : null
    if (nextFollowUpDate !== undefined)
      updateData.nextFollowUpDate = nextFollowUpDate
        ? new Date(nextFollowUpDate)
        : null

    // Gérer la conversion manuelle
    if (converted === true && !existingLead.convertedAt) {
      updateData.status = 'CONVERTED'
      updateData.convertedAt = new Date()
    }

    // Mettre à jour le lead
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        customerId: true,
        assignedToId: true,
        source: true,
        status: true,
        score: true,
        interestedVehicleId: true,
        budget: true,
        timeline: true,
        lastContactDate: true,
        nextFollowUpDate: true,
        convertedAt: true,
        updatedAt: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Lead',
        entityId: id,
        changes: {
          before: existingLead,
          after: updatedLead,
        },
      },
    })

    return NextResponse.json(updatedLead)
  } catch (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/leads/[id] - Supprime un lead
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification et permissions
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le lead existe
    const existingLead = await prisma.lead.findUnique({
      where: { id },
    })

    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Ne pas supprimer un lead converti (gagné)
    if (existingLead.status === LeadStatus.WON) {
      return NextResponse.json(
        { error: 'Cannot delete a converted lead' },
        { status: 400 }
      )
    }

    // Supprimer le lead
    await prisma.lead.delete({
      where: { id },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'Lead',
        entityId: id,
        changes: { deleted: existingLead },
      },
    })

    return NextResponse.json({
      message: 'Lead deleted successfully',
      leadId: id,
    })
  } catch (error) {
    console.error('Error deleting lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
