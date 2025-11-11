// API Routes pour la gestion des avoirs et remboursements (PRD-02-US-004)
// GET /api/credit-notes - Liste des avoirs
// POST /api/credit-notes - Créer un avoir

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { CreditNoteStatus, Currency } from '@/generated/prisma'

// GET /api/credit-notes - Liste des avoirs
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as CreditNoteStatus | null
    const invoiceId = searchParams.get('invoiceId')
    const customerId = searchParams.get('customerId')
    const search = searchParams.get('search')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    if (status) where.status = status
    if (invoiceId) where.invoiceId = invoiceId
    if (customerId) where.customerId = customerId

    // Recherche par numéro d'avoir
    if (search) {
      where.creditNoteNumber = {
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

    // Compter le total
    const total = await prisma.creditNote.count({ where })

    // Récupérer les avoirs
    const creditNotes = await prisma.creditNote.findMany({
      where,
      orderBy: {
        issueDate: 'desc',
      },
      skip,
      take: limit,
    })

    // Statistiques par statut
    const stats = await prisma.creditNote.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
      },
    })

    const statusStats: Record<string, any> = {}
    stats.forEach((stat) => {
      statusStats[stat.status] = {
        count: stat._count.id,
        totalAmount: stat._sum.amount ? Number(stat._sum.amount) : 0,
      }
    })

    return NextResponse.json({
      creditNotes: creditNotes.map((cn) => ({
        ...cn,
        amount: Number(cn.amount),
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
    console.error('Error fetching credit notes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/credit-notes - Créer un avoir
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent créer des avoirs
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const { invoiceId, amount, reason, notes, autoApply = false } = body

    // Valider les paramètres requis
    if (!invoiceId || !amount || !reason) {
      return NextResponse.json(
        { error: 'invoiceId, amount, and reason are required' },
        { status: 400 }
      )
    }

    // Valider le montant
    const creditAmount = Number(amount)
    if (creditAmount <= 0) {
      return NextResponse.json(
        { error: 'Credit note amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Vérifier que la facture existe
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        status: true,
        customerId: true,
        total: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Ne pas créer d'avoir sur facture annulée
    if (invoice.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot create credit note for cancelled invoice' },
        { status: 400 }
      )
    }

    // Fetch existing credit notes for this invoice
    const existingCreditNotes = await prisma.creditNote.findMany({
      where: {
        invoiceId,
        status: { not: 'CANCELLED' },
      },
      select: {
        amount: true,
      },
    })

    // Calculer le montant total des avoirs déjà émis
    const existingCredits = existingCreditNotes.reduce((sum, cn) => sum + Number(cn.amount), 0)

    // Vérifier que le montant ne dépasse pas le total de la facture
    const maxCreditAmount = Number(invoice.total) - existingCredits
    if (creditAmount > maxCreditAmount) {
      return NextResponse.json(
        {
          error: 'Credit note amount exceeds remaining invoice balance',
          invoiceTotal: Number(invoice.total),
          existingCredits,
          maxCreditAmount,
          attemptedAmount: creditAmount,
        },
        { status: 400 }
      )
    }

    // Générer un numéro d'avoir (format: AV-YYYY-NNNNNN ou CN-YYYY-NNNNNN)
    const year = new Date().getFullYear()
    const count = await prisma.creditNote.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
        },
      },
    })
    const creditNoteNumber = `AV-${year}-${String(count + 1).padStart(6, '0')}`

    // Créer l'avoir
    const creditNote = await prisma.creditNote.create({
      data: {
        creditNoteNumber,
        invoiceId,
        customerId: invoice.customerId,
        amount: creditAmount,
        currency: Currency.DZD,
        reason,
        status: autoApply ? 'ISSUED' : 'DRAFT',
        issueDate: new Date(),
        appliedAt: autoApply ? new Date() : null,
        notes,
      },
    })

    // Si auto-application, ajuster la facture
    if (autoApply) {
      // Re-fetch invoice with all needed fields for update
      const invoiceForUpdate = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          amountPaid: true,
          total: true,
          status: true,
        },
      })

      if (!invoiceForUpdate) {
        return NextResponse.json({ error: 'Invoice not found for update' }, { status: 404 })
      }

      const newAmountPaid = Number(invoiceForUpdate.amountPaid) + creditAmount
      const newAmountDue = Number(invoiceForUpdate.total) - newAmountPaid

      let newStatus = invoiceForUpdate.status
      if (newAmountDue <= 0) {
        newStatus = 'PAID'
      } else if (newAmountPaid > 0) {
        newStatus = 'PARTIALLY_PAID'
      }

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newStatus,
          paidAt: newStatus === 'PAID' ? new Date() : null,
        },
      })
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'CreditNote',
        entityId: creditNote.id,
        changes: {
          creditNoteNumber: creditNote.creditNoteNumber,
          invoiceId,
          amount: creditAmount,
          reason,
          autoApplied: autoApply,
        },
      },
    })

    // Fetch invoice and customer for response
    const invoiceForResponse = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        amountPaid: true,
        amountDue: true,
      },
    })

    const customerForResponse = await prisma.customer.findUnique({
      where: { id: invoice.customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        companyName: true,
      },
    })

    return NextResponse.json({
      success: true,
      creditNote: {
        ...creditNote,
        amount: Number(creditNote.amount),
        invoice: invoiceForResponse ? {
          ...invoiceForResponse,
          total: Number(invoiceForResponse.total),
          amountPaid: Number(invoiceForResponse.amountPaid),
          amountDue: Number(invoiceForResponse.amountDue),
        } : null,
        customer: customerForResponse,
      },
      message: 'Credit note created successfully',
      applied: autoApply,
    })
  } catch (error) {
    console.error('Error creating credit note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
