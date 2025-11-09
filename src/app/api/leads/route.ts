// API Routes pour la gestion des leads (prospects commerciaux)
// GET /api/leads - Liste tous les leads
// POST /api/leads - Crée un nouveau lead

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { LeadSource, LeadStatus } from '@/generated/prisma'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/leads - Liste tous les leads
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les paramètres de requête
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') as LeadStatus | null
    const source = searchParams.get('source') as LeadSource | null
    const assignedToId = searchParams.get('assignedToId') || null

    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    if (status) where.status = status
    if (source) where.source = source
    if (assignedToId) where.assignedToId = assignedToId

    // Récupérer les leads
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
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
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.lead.count({ where }),
    ])

    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/leads - Crée un nouveau lead
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification et permissions
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données du body
    const body = await request.json()
    const {
      customerId,
      assignedToId,
      source,
      status,
      score,
      interestedVehicleId,
      budget,
      timeline,
      notes,
      nextFollowUpDate,
    } = body

    // Validation des champs requis
    if (!customerId || !source) {
      return NextResponse.json(
        {
          error: 'Missing required fields: customerId, source',
        },
        { status: 400 }
      )
    }

    // Vérifier que le customer existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Vérifier que l'assigné existe si fourni
    if (assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
      })

      if (!assignedUser) {
        return NextResponse.json(
          { error: 'Assigned user not found' },
          { status: 404 }
        )
      }
    }

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

    // Créer le lead
    const newLead = await prisma.lead.create({
      data: {
        customerId,
        assignedToId: assignedToId || user.id,
        source,
        status: status || 'NEW',
        score,
        interestedVehicleId,
        budget,
        timeline,
        notes,
        lastContactDate: new Date(),
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
      },
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
        createdAt: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Lead',
        entityId: newLead.id,
        changes: { created: newLead },
      },
    })

    return NextResponse.json(newLead, { status: 201 })
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
