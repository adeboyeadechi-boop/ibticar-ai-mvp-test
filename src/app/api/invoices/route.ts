// API Routes pour la gestion des factures (PRD-02-US-002)
// GET /api/invoices - Liste des factures
// POST /api/invoices - Créer une facture manuelle (sans devis)

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { InvoiceStatus, Currency, InvoiceType } from '@/generated/prisma'

// Configuration TVA Algérie
const ALGERIAN_VAT_RATE = 0.19

// GET /api/invoices - Liste des factures
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as InvoiceStatus | null
    const type = searchParams.get('type') as InvoiceType | null
    const customerId = searchParams.get('customerId')
    const teamId = searchParams.get('teamId')
    const search = searchParams.get('search')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const overdue = searchParams.get('overdue') === 'true'

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    if (status) where.status = status
    if (type) where.type = type
    if (customerId) where.customerId = customerId
    if (teamId) where.teamId = teamId

    // Recherche textuelle (par numéro de facture)
    if (search) {
      where.invoiceNumber = {
        contains: search,
        mode: 'insensitive',
      }
    }

    // Filtrage par date d'émission
    if (startDate || endDate) {
      where.issueDate = {}
      if (startDate) where.issueDate.gte = new Date(startDate)
      if (endDate) where.issueDate.lte = new Date(endDate)
    }

    // Factures en retard
    if (overdue) {
      where.status = {
        in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'],
      }
      where.dueDate = {
        lt: new Date(),
      }
    }

    // Compter le total
    const total = await prisma.invoice.count({ where })

    // Récupérer les factures
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: {
        issueDate: 'desc',
      },
      skip,
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        quoteId: true,
        customerId: true,
        teamId: true,
        createdById: true,
        status: true,
        type: true,
        issueDate: true,
        dueDate: true,
        subtotal: true,
        taxAmount: true,
        discountAmount: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        currency: true,
        terms: true,
        notes: true,
        sentAt: true,
        paidAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Fetch related data separately
    const customerIds = [...new Set(invoices.map(i => i.customerId))]
    const teamIds = [...new Set(invoices.map(i => i.teamId))]
    const createdByIds = [...new Set(invoices.map(i => i.createdById))]
    const quoteIds = [...new Set(invoices.map(i => i.quoteId).filter(Boolean))] as string[]
    const invoiceIds = invoices.map(i => i.id)

    const [customers, teams, createdByUsers, quotes, payments, items] = await Promise.all([
      prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          companyName: true,
        },
      }),
      prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: {
          id: true,
          name: true,
          city: true,
        },
      }),
      prisma.user.findMany({
        where: { id: { in: createdByIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      }),
      quoteIds.length > 0
        ? prisma.quote.findMany({
            where: { id: { in: quoteIds } },
            select: {
              id: true,
              quoteNumber: true,
            },
          })
        : Promise.resolve([]),
      prisma.payment.findMany({
        where: { invoiceId: { in: invoiceIds } },
        orderBy: {
          paymentDate: 'desc',
        },
      }),
      prisma.invoiceItem.findMany({
        where: { invoiceId: { in: invoiceIds } },
        orderBy: {
          order: 'asc',
        },
      }),
    ])

    // Create lookup maps
    const customerMap = new Map(customers.map(c => [c.id, c]))
    const teamMap = new Map(teams.map(t => [t.id, t]))
    const createdByMap = new Map(createdByUsers.map(u => [u.id, u]))
    const quoteMap = new Map(quotes.map(q => [q.id, q]))

    // Group payments and items by invoiceId
    const paymentsByInvoice = new Map<string, typeof payments>()
    payments.forEach(payment => {
      if (!paymentsByInvoice.has(payment.invoiceId)) {
        paymentsByInvoice.set(payment.invoiceId, [])
      }
      paymentsByInvoice.get(payment.invoiceId)!.push(payment)
    })

    const itemsByInvoice = new Map<string, typeof items>()
    items.forEach(item => {
      if (!itemsByInvoice.has(item.invoiceId)) {
        itemsByInvoice.set(item.invoiceId, [])
      }
      itemsByInvoice.get(item.invoiceId)!.push(item)
    })

    // Combine data
    const invoicesWithRelations = invoices.map(invoice => ({
      ...invoice,
      customer: customerMap.get(invoice.customerId) || null,
      team: teamMap.get(invoice.teamId) || null,
      createdBy: createdByMap.get(invoice.createdById) || null,
      quote: invoice.quoteId ? quoteMap.get(invoice.quoteId) || null : null,
      payments: (paymentsByInvoice.get(invoice.id) || []).slice(0, 3),
      items: itemsByInvoice.get(invoice.id) || [],
    }))

    // Statistiques par statut
    const stats = await prisma.invoice.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
      _sum: {
        total: true,
        amountPaid: true,
        amountDue: true,
      },
      where: teamId ? { teamId } : {},
    })

    const statusStats: Record<string, any> = {}
    stats.forEach((stat) => {
      statusStats[stat.status] = {
        count: stat._count.id,
        totalAmount: stat._sum.total ? Number(stat._sum.total) : 0,
        amountPaid: stat._sum.amountPaid ? Number(stat._sum.amountPaid) : 0,
        amountDue: stat._sum.amountDue ? Number(stat._sum.amountDue) : 0,
      }
    })

    return NextResponse.json({
      invoices: invoicesWithRelations.map((invoice) => ({
        ...invoice,
        subtotal: Number(invoice.subtotal),
        taxAmount: Number(invoice.taxAmount),
        discountAmount: Number(invoice.discountAmount),
        total: Number(invoice.total),
        amountPaid: Number(invoice.amountPaid),
        amountDue: Number(invoice.amountDue),
        payments: invoice.payments.map((payment) => ({
          ...payment,
          amount: Number(payment.amount),
        })),
        items: invoice.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          discountRate: Number(item.discountRate),
          total: Number(item.total),
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats: statusStats,
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/invoices - Créer une facture manuelle (sans devis)
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent créer des factures
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const {
      customerId,
      teamId,
      items = [],
      dueDate,
      paymentTerms = 30,
      discountAmount = 0,
      notes,
      terms,
      type = 'STANDARD',
    } = body

    // Valider les paramètres requis
    if (!customerId || !teamId) {
      return NextResponse.json(
        { error: 'customerId and teamId are required' },
        { status: 400 }
      )
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      )
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

    // Calculer le sous-total et les taxes
    let subtotal = 0
    let totalTaxAmount = 0

    const processedItems = items.map((item: any, index: number) => {
      const unitPrice = Number(item.unitPrice)
      const quantity = item.quantity || 1
      const taxRate = item.taxRate !== undefined ? Number(item.taxRate) : ALGERIAN_VAT_RATE
      const discountRate = Number(item.discountRate || 0)

      const itemSubtotal = unitPrice * quantity
      const itemDiscount = itemSubtotal * discountRate
      const itemSubtotalAfterDiscount = itemSubtotal - itemDiscount
      const itemTax = itemSubtotalAfterDiscount * taxRate
      const itemTotal = itemSubtotalAfterDiscount + itemTax

      subtotal += itemSubtotalAfterDiscount
      totalTaxAmount += itemTax

      return {
        description: item.description,
        quantity,
        unitPrice,
        taxRate,
        discountRate,
        total: itemTotal,
        vehicleId: item.vehicleId || null,
        order: item.order !== undefined ? item.order : index,
      }
    })

    // Appliquer la réduction globale
    const globalDiscountAmount = Number(discountAmount || 0)
    const subtotalAfterDiscount = subtotal - globalDiscountAmount

    if (globalDiscountAmount > 0) {
      totalTaxAmount = subtotalAfterDiscount * ALGERIAN_VAT_RATE
    }

    const total = subtotalAfterDiscount + totalTaxAmount

    // Générer un numéro de facture
    const year = new Date().getFullYear()
    const count = await prisma.invoice.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
        },
      },
    })
    const invoiceNumber = `FA-${year}-${String(count + 1).padStart(6, '0')}`

    // Date d'échéance
    const calculatedDueDate = dueDate
      ? new Date(dueDate)
      : new Date(Date.now() + paymentTerms * 24 * 60 * 60 * 1000)

    // Termes par défaut
    const defaultTerms = terms || [
      'Facture payable selon les conditions convenues',
      'TVA au taux en vigueur (19%) incluse',
      'Pénalités de retard applicables après échéance',
      'Règlement par virement bancaire ou autres moyens convenus',
    ].join('\n')

    // Créer la facture
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId,
        teamId,
        createdById: user.id,
        status: InvoiceStatus.SENT,
        type: type as InvoiceType,
        issueDate: new Date(),
        dueDate: calculatedDueDate,
        subtotal,
        taxAmount: totalTaxAmount,
        discountAmount: globalDiscountAmount,
        total,
        amountPaid: 0,
        amountDue: total,
        currency: Currency.DZD,
        terms: defaultTerms,
        notes,
      },
    })

    // Create invoice items separately
    const itemsData = await Promise.all(
      processedItems.map((item: any) =>
        prisma.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            discountRate: item.discountRate,
            total: item.total,
            vehicleId: item.vehicleId,
            order: item.order,
          },
        })
      )
    )

    // Fetch related data
    const [customerData, teamData] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          companyName: true,
        },
      }),
      prisma.team.findUnique({
        where: { id: teamId },
        select: {
          id: true,
          name: true,
        },
      }),
    ])

    // Combine data
    const invoiceWithRelations = {
      ...invoice,
      customer: customerData,
      team: teamData,
      items: itemsData,
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Invoice',
        entityId: invoice.id,
        changes: {
          invoiceNumber: invoice.invoiceNumber,
          customerId,
          type,
          total: Number(total),
        },
      },
    })

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoiceWithRelations,
        subtotal: Number(invoiceWithRelations.subtotal),
        taxAmount: Number(invoiceWithRelations.taxAmount),
        discountAmount: Number(invoiceWithRelations.discountAmount),
        total: Number(invoiceWithRelations.total),
        amountPaid: Number(invoiceWithRelations.amountPaid),
        amountDue: Number(invoiceWithRelations.amountDue),
        items: invoiceWithRelations.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          discountRate: Number(item.discountRate),
          total: Number(item.total),
        })),
      },
      message: 'Invoice created successfully',
    })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
