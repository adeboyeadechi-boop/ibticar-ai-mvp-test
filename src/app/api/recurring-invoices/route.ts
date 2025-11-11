// API Route pour les factures récurrentes (PRD-02-US-005)
// GET /api/recurring-invoices - Liste des factures récurrentes
// POST /api/recurring-invoices - Créer une facture récurrente

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { RecurringFrequency } from '@/generated/prisma'

// GET /api/recurring-invoices - Liste des factures récurrentes
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customerId')
    const teamId = searchParams.get('teamId')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    if (customerId) where.customerId = customerId
    if (teamId) where.teamId = teamId
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    // Compter le total
    const total = await prisma.recurringInvoice.count({ where })

    // Récupérer les factures récurrentes
    const recurringInvoices = await prisma.recurringInvoice.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            companyName: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        nextInvoiceDate: 'asc',
      },
      skip,
      take: limit,
    })

    // Formater la réponse
    const formattedInvoices = recurringInvoices.map((ri) => {
      const template = ri.template as any
      return {
        id: ri.id,
        customer: {
          id: ri.customer.id,
          name: ri.customer.companyName ||
            `${ri.customer.firstName} ${ri.customer.lastName}`,
          email: ri.customer.email,
        },
        team: {
          id: ri.team.id,
          name: ri.team.name,
        },
        frequency: ri.frequency,
        nextInvoiceDate: ri.nextInvoiceDate,
        lastInvoiceDate: ri.lastInvoiceDate,
        endDate: ri.endDate,
        template: {
          amount: template.amount || 0,
          description: template.description || '',
          items: template.items || [],
        },
        isActive: ri.isActive,
        createdAt: ri.createdAt,
        updatedAt: ri.updatedAt,
      }
    })

    return NextResponse.json({
      recurringInvoices: formattedInvoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats: {
        active: await prisma.recurringInvoice.count({ where: { isActive: true } }),
        inactive: await prisma.recurringInvoice.count({ where: { isActive: false } }),
      },
    })
  } catch (error) {
    console.error('Error fetching recurring invoices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/recurring-invoices - Créer une facture récurrente
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent créer des factures récurrentes
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      customerId,
      teamId,
      frequency,
      startDate,
      endDate,
      template,
    } = body

    // Validation des champs requis
    if (!customerId || !teamId || !frequency || !template) {
      return NextResponse.json(
        { error: 'Missing required fields: customerId, teamId, frequency, template' },
        { status: 400 }
      )
    }

    // Validation de la fréquence
    const validFrequencies: RecurringFrequency[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
    }

    // Vérifier que le client existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Vérifier que l'équipe existe
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Validation du template
    if (typeof template !== 'object' || Array.isArray(template)) {
      return NextResponse.json(
        { error: 'Template must be a valid object' },
        { status: 400 }
      )
    }

    if (!template.items || !Array.isArray(template.items) || template.items.length === 0) {
      return NextResponse.json(
        { error: 'Template must contain at least one item' },
        { status: 400 }
      )
    }

    // Calculer la prochaine date de facturation
    const nextInvoiceDate = startDate ? new Date(startDate) : new Date()

    // Créer la facture récurrente
    const recurringInvoice = await prisma.recurringInvoice.create({
      data: {
        customerId,
        teamId,
        frequency,
        nextInvoiceDate,
        endDate: endDate ? new Date(endDate) : null,
        template,
        isActive: true,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            companyName: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'RecurringInvoice',
        entityId: recurringInvoice.id,
        changes: { created: recurringInvoice },
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Recurring invoice created successfully',
        recurringInvoice: {
          id: recurringInvoice.id,
          customer: recurringInvoice.customer,
          team: recurringInvoice.team,
          frequency: recurringInvoice.frequency,
          nextInvoiceDate: recurringInvoice.nextInvoiceDate,
          endDate: recurringInvoice.endDate,
          isActive: recurringInvoice.isActive,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating recurring invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
