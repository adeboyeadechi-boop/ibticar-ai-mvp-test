// API Routes pour la gestion des réclamations clients
// POST /api/complaints - Créer une réclamation
// GET /api/complaints - Liste avec filtres et pagination

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { ComplaintType, ComplaintStatus, Priority } from '@/generated/prisma'

// POST /api/complaints - Créer une nouvelle réclamation
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les données
    const body = await request.json()
    const {
      customerId,
      orderId,
      type,
      priority,
      subject,
      description,
      assignedToId,
    } = body

    // Validation
    if (!customerId || !type || !subject || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: customerId, type, subject, description' },
        { status: 400 }
      )
    }

    // Vérifier que le client existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Générer un numéro de réclamation unique
    const year = new Date().getFullYear()
    const count = await prisma.complaint.count()
    const complaintNumber = `REC-${year}-${String(count + 1).padStart(6, '0')}`

    // Créer la réclamation
    const complaint = await prisma.complaint.create({
      data: {
        complaintNumber,
        customerId,
        orderId: orderId || null,
        type: type as ComplaintType,
        status: 'NEW',
        priority: priority || 'MEDIUM',
        subject,
        description,
        assignedToId: assignedToId || null,
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Complaint',
        entityId: complaint.id,
        changes: { created: complaint },
      },
    })

    return NextResponse.json({
      success: true,
      complaint,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating complaint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/complaints - Liste des réclamations avec filtres
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customerId')
    const orderId = searchParams.get('orderId')
    const status = searchParams.get('status') as ComplaintStatus | null
    const type = searchParams.get('type') as ComplaintType | null
    const priority = searchParams.get('priority') as Priority | null
    const assignedToId = searchParams.get('assignedToId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const search = searchParams.get('search')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    if (customerId) where.customerId = customerId
    if (orderId) where.orderId = orderId
    if (status) where.status = status
    if (type) where.type = type
    if (priority) where.priority = priority
    if (assignedToId) where.assignedToId = assignedToId

    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) where.createdAt.gte = new Date(fromDate)
      if (toDate) where.createdAt.lte = new Date(toDate)
    }

    // Recherche textuelle
    if (search) {
      where.OR = [
        { complaintNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Compter le total
    const total = await prisma.complaint.count({ where })

    // Récupérer les réclamations
    const complaints = await prisma.complaint.findMany({
      where,
      select: {
        id: true,
        complaintNumber: true,
        customerId: true,
        orderId: true,
        type: true,
        status: true,
        priority: true,
        subject: true,
        description: true,
        assignedToId: true,
        resolution: true,
        resolvedAt: true,
        satisfactionRating: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    return NextResponse.json({
      complaints,
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
    console.error('Error fetching complaints:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
