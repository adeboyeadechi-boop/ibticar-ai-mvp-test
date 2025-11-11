// API Route pour le tableau de bord financier (PRD-02-US-006)
// GET /api/financial/dashboard - Analytics et KPIs financiers

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/financial/dashboard - Tableau de bord financier
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const teamId = searchParams.get('teamId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || 'month' // day, week, month, quarter, year

    // Définir la période par défaut (30 derniers jours)
    const now = new Date()
    const periodStart = startDate
      ? new Date(startDate)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const periodEnd = endDate ? new Date(endDate) : now

    // Filtres communs
    const baseWhere: any = {
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    }

    if (teamId) {
      baseWhere.teamId = teamId
    }

    // 1. STATISTIQUES DEVIS
    const [totalQuotes, draftQuotes, sentQuotes, acceptedQuotes, rejectedQuotes] =
      await Promise.all([
        prisma.quote.count({ where: baseWhere }),
        prisma.quote.count({ where: { ...baseWhere, status: 'DRAFT' } }),
        prisma.quote.count({ where: { ...baseWhere, status: 'SENT' } }),
        prisma.quote.count({ where: { ...baseWhere, status: 'ACCEPTED' } }),
        prisma.quote.count({ where: { ...baseWhere, status: 'REJECTED' } }),
      ])

    const quotesStats = {
      total: totalQuotes,
      draft: draftQuotes,
      sent: sentQuotes,
      accepted: acceptedQuotes,
      rejected: rejectedQuotes,
      conversionRate: totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0,
    }

    // Montant total des devis
    const quotesAggregate = await prisma.quote.aggregate({
      where: baseWhere,
      _sum: {
        total: true,
      },
    })

    const quotesTotalValue = quotesAggregate._sum.total ? Number(quotesAggregate._sum.total) : 0

    // 2. STATISTIQUES FACTURES
    const [totalInvoices, unpaidInvoices, partiallyPaidInvoices, paidInvoices, overdueInvoices] =
      await Promise.all([
        prisma.invoice.count({ where: baseWhere }),
        prisma.invoice.count({ where: { ...baseWhere, status: 'UNPAID' } }),
        prisma.invoice.count({ where: { ...baseWhere, status: 'PARTIALLY_PAID' } }),
        prisma.invoice.count({ where: { ...baseWhere, status: 'PAID' } }),
        prisma.invoice.count({
          where: {
            ...baseWhere,
            status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
            dueDate: { lt: now },
          },
        }),
      ])

    const invoicesStats = {
      total: totalInvoices,
      unpaid: unpaidInvoices,
      partiallyPaid: partiallyPaidInvoices,
      paid: paidInvoices,
      overdue: overdueInvoices,
      paymentRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0,
    }

    // Montants des factures
    const invoicesAggregate = await prisma.invoice.aggregate({
      where: baseWhere,
      _sum: {
        total: true,
        amountPaid: true,
        amountDue: true,
      },
    })

    const invoicesTotalValue = invoicesAggregate._sum.total
      ? Number(invoicesAggregate._sum.total)
      : 0
    const invoicesAmountPaid = invoicesAggregate._sum.amountPaid
      ? Number(invoicesAggregate._sum.amountPaid)
      : 0
    const invoicesAmountDue = invoicesAggregate._sum.amountDue
      ? Number(invoicesAggregate._sum.amountDue)
      : 0

    // 3. STATISTIQUES PAIEMENTS
    const paymentsAggregate = await prisma.payment.aggregate({
      where: {
        ...baseWhere,
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    })

    const totalPayments = paymentsAggregate._count.id
    const paymentsReceived = paymentsAggregate._sum.amount
      ? Number(paymentsAggregate._sum.amount)
      : 0

    // Paiements par méthode
    const paymentsByMethod = await prisma.payment.groupBy({
      by: ['method'],
      where: {
        ...baseWhere,
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    })

    const paymentMethodsBreakdown = paymentsByMethod.map((pm) => ({
      method: pm.method,
      count: pm._count.id,
      amount: pm._sum.amount ? Number(pm._sum.amount) : 0,
    }))

    // 4. STATISTIQUES AVOIRS
    const creditNotesAggregate = await prisma.creditNote.aggregate({
      where: {
        ...baseWhere,
        status: { in: ['ISSUED', 'APPLIED'] },
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    })

    const totalCreditNotes = creditNotesAggregate._count.id
    const creditNotesValue = creditNotesAggregate._sum.amount
      ? Number(creditNotesAggregate._sum.amount)
      : 0

    // 5. TRÉSORERIE (CASH FLOW)
    const cashFlow = {
      paymentsReceived,
      creditNotesIssued: creditNotesValue,
      netCashFlow: paymentsReceived - creditNotesValue,
      expectedRevenue: invoicesAmountDue, // À recevoir
    }

    // 6. CHIFFRE D'AFFAIRES
    const revenue = {
      totalInvoiced: invoicesTotalValue,
      collected: invoicesAmountPaid,
      outstanding: invoicesAmountDue,
      collectionRate: invoicesTotalValue > 0 ? (invoicesAmountPaid / invoicesTotalValue) * 100 : 0,
    }

    // 7. TENDANCES TEMPORELLES (derniers 7 jours/semaines/mois selon période)
    const trendsInterval = period === 'day' ? 7 : period === 'week' ? 8 : 12
    const trends = await generateTrends(trendsInterval, period, teamId)

    // 8. TOP CLIENTS (par CA)
    const topCustomers = await prisma.invoice.groupBy({
      by: ['customerId'],
      where: {
        ...baseWhere,
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
      },
      _sum: {
        amountPaid: true,
      },
      orderBy: {
        _sum: {
          amountPaid: 'desc',
        },
      },
      take: 5,
    })

    const topCustomersData = await Promise.all(
      topCustomers.map(async (tc) => {
        const customer = await prisma.customer.findUnique({
          where: { id: tc.customerId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            email: true,
          },
        })

        return {
          customer,
          totalPaid: tc._sum.amountPaid ? Number(tc._sum.amountPaid) : 0,
        }
      })
    )

    // 9. RATIOS FINANCIERS
    const ratios = {
      dso: calculateDSO(invoicesTotalValue, paymentsReceived, 30), // Days Sales Outstanding
      collectionEfficiency: revenue.collectionRate,
      quoteToInvoiceRatio: totalQuotes > 0 ? (totalInvoices / totalQuotes) * 100 : 0,
    }

    return NextResponse.json({
      period: {
        start: periodStart,
        end: periodEnd,
        days: Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)),
      },
      quotes: {
        ...quotesStats,
        totalValue: quotesTotalValue,
      },
      invoices: {
        ...invoicesStats,
        totalValue: invoicesTotalValue,
        amountPaid: invoicesAmountPaid,
        amountDue: invoicesAmountDue,
      },
      payments: {
        total: totalPayments,
        received: paymentsReceived,
        byMethod: paymentMethodsBreakdown,
      },
      creditNotes: {
        total: totalCreditNotes,
        value: creditNotesValue,
      },
      cashFlow,
      revenue,
      ratios,
      trends,
      topCustomers: topCustomersData,
      generatedAt: new Date(),
    })
  } catch (error) {
    console.error('Error generating financial dashboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fonction pour générer les tendances temporelles
async function generateTrends(intervals: number, period: string, teamId: string | null) {
  const trends = []
  const now = new Date()

  for (let i = intervals - 1; i >= 0; i--) {
    let intervalStart: Date
    let intervalEnd: Date
    let label: string

    if (period === 'day') {
      intervalStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      intervalStart.setHours(0, 0, 0, 0)
      intervalEnd = new Date(intervalStart.getTime() + 24 * 60 * 60 * 1000)
      label = intervalStart.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
    } else if (period === 'week') {
      intervalStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      intervalStart.setHours(0, 0, 0, 0)
      intervalEnd = new Date(intervalStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      label = `S${Math.ceil(intervalStart.getDate() / 7)}`
    } else {
      // month
      intervalStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      intervalEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      label = intervalStart.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    }

    const where: any = {
      createdAt: {
        gte: intervalStart,
        lt: intervalEnd,
      },
    }

    if (teamId) where.teamId = teamId

    const [quotes, invoices, payments] = await Promise.all([
      prisma.quote.aggregate({
        where,
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where,
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ])

    trends.push({
      period: label,
      start: intervalStart,
      end: intervalEnd,
      quotes: {
        count: quotes._count.id,
        value: quotes._sum.total ? Number(quotes._sum.total) : 0,
      },
      invoices: {
        count: invoices._count.id,
        value: invoices._sum.total ? Number(invoices._sum.total) : 0,
      },
      payments: {
        count: payments._count.id,
        value: payments._sum.amount ? Number(payments._sum.amount) : 0,
      },
    })
  }

  return trends
}

// Calculer le DSO (Days Sales Outstanding)
function calculateDSO(totalInvoiced: number, totalCollected: number, days: number): number {
  if (totalInvoiced === 0) return 0
  const averageDailyRevenue = totalInvoiced / days
  const accountsReceivable = totalInvoiced - totalCollected
  return averageDailyRevenue > 0 ? accountsReceivable / averageDailyRevenue : 0
}
