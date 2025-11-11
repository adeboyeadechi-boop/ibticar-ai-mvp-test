// API Routes pour la gestion des paiements et acomptes (PRD-02-US-003)
// GET /api/payments - Liste des paiements
// POST /api/payments - Enregistrer un nouveau paiement

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { PaymentMethod, PaymentStatus, Currency, InvoiceStatus } from '@/generated/prisma'

// GET /api/payments - Liste des paiements
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const invoiceId = searchParams.get('invoiceId')
    const customerId = searchParams.get('customerId')
    const method = searchParams.get('method') as PaymentMethod | null
    const status = searchParams.get('status') as PaymentStatus | null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    if (invoiceId) where.invoiceId = invoiceId
    if (customerId) where.customerId = customerId
    if (method) where.method = method
    if (status) where.status = status

    // Recherche par numéro de paiement ou référence
    if (search) {
      where.OR = [
        {
          paymentNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          reference: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ]
    }

    // Filtrage par date de paiement
    if (startDate || endDate) {
      where.paymentDate = {}
      if (startDate) where.paymentDate.gte = new Date(startDate)
      if (endDate) where.paymentDate.lte = new Date(endDate)
    }

    // Compter le total
    const total = await prisma.payment.count({ where })

    // Récupérer les paiements
    const payments = await prisma.payment.findMany({
      where,
      orderBy: {
        paymentDate: 'desc',
      },
      skip,
      take: limit,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            companyName: true,
          },
        },
      },
    })

    // Statistiques par méthode de paiement
    const methodStats = await prisma.payment.groupBy({
      by: ['method'],
      where: { status: 'COMPLETED' },
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
      },
    })

    const stats: Record<string, any> = {}
    methodStats.forEach((stat) => {
      stats[stat.method] = {
        count: stat._count.id,
        totalAmount: stat._sum.amount ? Number(stat._sum.amount) : 0,
      }
    })

    return NextResponse.json({
      payments: payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
        invoice: payment.invoice
          ? {
              ...payment.invoice,
              total: Number(payment.invoice.total),
            }
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats,
    })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/payments - Enregistrer un paiement
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent enregistrer des paiements
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const {
      invoiceId,
      amount,
      method,
      reference,
      transactionId,
      paymentDate,
      notes,
    } = body

    // Valider les paramètres requis
    if (!invoiceId || !amount || !method) {
      return NextResponse.json(
        { error: 'invoiceId, amount, and method are required' },
        { status: 400 }
      )
    }

    // Valider le montant
    const paymentAmount = Number(amount)
    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Vérifier que la facture existe
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Ne pas accepter de paiement sur facture annulée
    if (invoice.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot add payment to cancelled invoice' },
        { status: 400 }
      )
    }

    // Ne pas accepter de paiement sur facture déjà payée
    if (invoice.status === 'PAID') {
      return NextResponse.json(
        { error: 'Invoice is already fully paid' },
        { status: 400 }
      )
    }

    // Vérifier que le montant ne dépasse pas le solde restant
    const remainingAmount = Number(invoice.amountDue)
    if (paymentAmount > remainingAmount) {
      return NextResponse.json(
        {
          error: 'Payment amount exceeds remaining balance',
          remainingAmount,
          attemptedAmount: paymentAmount,
        },
        { status: 400 }
      )
    }

    // Générer un numéro de paiement (format: PAY-YYYY-NNNNNN)
    const year = new Date().getFullYear()
    const count = await prisma.payment.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
        },
      },
    })
    const paymentNumber = `PAY-${year}-${String(count + 1).padStart(6, '0')}`

    // Calculer le nouveau solde
    const newAmountPaid = Number(invoice.amountPaid) + paymentAmount
    const newAmountDue = Number(invoice.total) - newAmountPaid

    // Déterminer le nouveau statut de la facture
    let newInvoiceStatus: InvoiceStatus = invoice.status
    if (newAmountDue <= 0) {
      newInvoiceStatus = 'PAID'
    } else if (newAmountPaid > 0) {
      newInvoiceStatus = 'PARTIALLY_PAID'
    }

    // Créer le paiement avec transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer le paiement
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId,
          customerId: invoice.customerId,
          amount: paymentAmount,
          currency: Currency.DZD,
          method: method as PaymentMethod,
          status: 'COMPLETED',
          reference,
          transactionId,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          notes,
          processedAt: new Date(),
        },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              total: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              companyName: true,
            },
          },
        },
      })

      // 2. Mettre à jour la facture
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newInvoiceStatus,
          paidAt: newInvoiceStatus === 'PAID' ? new Date() : invoice.paidAt,
        },
      })

      return payment
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Payment',
        entityId: result.id,
        changes: {
          paymentNumber: result.paymentNumber,
          invoiceId,
          amount: paymentAmount,
          method,
          newInvoiceStatus,
          remainingBalance: newAmountDue,
        },
      },
    })

    // TODO: Envoyer confirmation de paiement au client
    console.log('Payment confirmation:', {
      paymentNumber: result.paymentNumber,
      customerEmail: result.customer.email,
      amount: paymentAmount,
      invoiceNumber: result.invoice.invoiceNumber,
    })

    return NextResponse.json({
      success: true,
      payment: {
        ...result,
        amount: Number(result.amount),
        invoice: {
          ...result.invoice,
          total: Number(result.invoice.total),
        },
      },
      invoice: {
        id: invoiceId,
        status: newInvoiceStatus,
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        fullyPaid: newInvoiceStatus === 'PAID',
      },
      message: 'Payment recorded successfully',
    })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
