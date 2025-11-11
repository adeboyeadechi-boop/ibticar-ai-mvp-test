// API Route pour rapports financiers consolidés
// GET /api/accounting/reports/financials - Vue d'ensemble comptable (factures, paiements, créances)

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/accounting/reports/financials - Rapport financier consolidé
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent voir les rapports financiers
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const teamId = searchParams.get('teamId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    // Construire les filtres
    const where: any = {}
    if (teamId) where.teamId = teamId

    const dateFilter: any = {}
    if (fromDate) dateFilter.gte = new Date(fromDate)
    if (toDate) dateFilter.lte = new Date(toDate)

    if (fromDate || toDate) {
      where.createdAt = dateFilter
    }

    // 1. Statistiques des factures
    const [
      totalInvoices,
      draftInvoices,
      sentInvoices,
      paidInvoices,
      overdueInvoices,
      cancelledInvoices,
    ] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.count({ where: { ...where, status: 'DRAFT' } }),
      prisma.invoice.count({ where: { ...where, status: 'SENT' } }),
      prisma.invoice.count({ where: { ...where, status: 'PAID' } }),
      prisma.invoice.count({ where: { ...where, status: 'OVERDUE' } }),
      prisma.invoice.count({ where: { ...where, status: 'CANCELLED' } }),
    ])

    // 2. Montants des factures
    const invoiceAmounts = await prisma.invoice.aggregate({
      where,
      _sum: {
        total: true,
        amountPaid: true,
        amountDue: true,
      },
    })

    const totalInvoiced = Number(invoiceAmounts._sum.total || 0)
    const totalPaid = Number(invoiceAmounts._sum.amountPaid || 0)
    const totalDue = Number(invoiceAmounts._sum.amountDue || 0)

    // 3. Statistiques des paiements
    const [totalPayments, completedPayments, pendingPayments, failedPayments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.payment.count({ where: { ...where, status: 'PENDING' } }),
      prisma.payment.count({ where: { ...where, status: 'FAILED' } }),
    ])

    // 4. Montants des paiements
    const paymentAmounts = await prisma.payment.aggregate({
      where: { ...where, status: 'COMPLETED' },
      _sum: {
        amount: true,
      },
    })

    const totalPaymentAmount = Number(paymentAmounts._sum.amount || 0)

    // 5. Répartition par méthode de paiement
    const paymentsByMethod = await prisma.payment.groupBy({
      by: ['method'],
      where: { ...where, status: 'COMPLETED' },
      _count: true,
      _sum: {
        amount: true,
      },
    })

    const paymentMethodsBreakdown = paymentsByMethod.map((method) => ({
      method: method.method,
      count: method._count,
      total: Number(method._sum.amount || 0),
    }))

    // 6. Statistiques des devis
    const [totalQuotes, draftQuotes, sentQuotes, acceptedQuotes, rejectedQuotes, expiredQuotes] =
      await Promise.all([
        prisma.quote.count({ where }),
        prisma.quote.count({ where: { ...where, status: 'DRAFT' } }),
        prisma.quote.count({ where: { ...where, status: 'SENT' } }),
        prisma.quote.count({ where: { ...where, status: 'ACCEPTED' } }),
        prisma.quote.count({ where: { ...where, status: 'REJECTED' } }),
        prisma.quote.count({ where: { ...where, status: 'EXPIRED' } }),
      ])

    // 7. Taux de conversion devis → factures
    const convertedQuotes = await prisma.quote.count({
      where: { ...where, status: 'CONVERTED' },
    })
    const conversionRate = totalQuotes > 0 ? (convertedQuotes / totalQuotes) * 100 : 0

    // 8. Factures en retard (overdue)
    const overdueInvoicesList = await prisma.invoice.findMany({
      where: {
        ...where,
        status: 'OVERDUE',
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        total: true,
        amountDue: true,
        dueDate: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
      take: 10,
    })

    const overdueAmount = overdueInvoicesList.reduce((sum, inv) => sum + Number(inv.amountDue), 0)

    // 9. Top 5 clients par chiffre d'affaires
    const topCustomers = await prisma.invoice.groupBy({
      by: ['customerId'],
      where: { ...where, status: { in: ['PAID', 'PARTIALLY_PAID'] } },
      _sum: {
        amountPaid: true,
      },
      _count: true,
      orderBy: {
        _sum: {
          amountPaid: 'desc',
        },
      },
      take: 5,
    })

    // Enrichir avec les infos clients
    const customerIds = topCustomers.map((c) => c.customerId)
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    })

    const customersMap = new Map(customers.map((c) => [c.id, c]))

    const topCustomersWithDetails = topCustomers.map((customer) => {
      const customerInfo = customersMap.get(customer.customerId)
      return {
        customerId: customer.customerId,
        customerName: customerInfo
          ? `${customerInfo.firstName} ${customerInfo.lastName}`
          : 'Unknown',
        email: customerInfo?.email,
        totalPaid: Number(customer._sum.amountPaid || 0),
        invoiceCount: customer._count,
      }
    })

    // 10. Tendance mensuelle (derniers 6 mois)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyInvoices = await prisma.invoice.findMany({
      where: {
        ...where,
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        createdAt: true,
        total: true,
        status: true,
      },
    })

    const monthlyTrend = monthlyInvoices.reduce((acc: any, invoice) => {
      const month = new Date(invoice.createdAt).toISOString().slice(0, 7) // YYYY-MM
      if (!acc[month]) {
        acc[month] = { month, invoiced: 0, count: 0 }
      }
      acc[month].invoiced += Number(invoice.total)
      acc[month].count += 1
      return acc
    }, {})

    const monthlyTrendArray = Object.values(monthlyTrend).sort((a: any, b: any) =>
      a.month.localeCompare(b.month)
    )

    return NextResponse.json({
      invoices: {
        total: totalInvoices,
        draft: draftInvoices,
        sent: sentInvoices,
        paid: paidInvoices,
        overdue: overdueInvoices,
        cancelled: cancelledInvoices,
        totalInvoiced,
        totalPaid,
        totalDue,
        overdueAmount,
      },
      payments: {
        total: totalPayments,
        completed: completedPayments,
        pending: pendingPayments,
        failed: failedPayments,
        totalAmount: totalPaymentAmount,
        byMethod: paymentMethodsBreakdown,
      },
      quotes: {
        total: totalQuotes,
        draft: draftQuotes,
        sent: sentQuotes,
        accepted: acceptedQuotes,
        rejected: rejectedQuotes,
        expired: expiredQuotes,
        converted: convertedQuotes,
        conversionRate: Math.round(conversionRate * 100) / 100,
      },
      topCustomers: topCustomersWithDetails,
      overdueInvoices: overdueInvoicesList.slice(0, 5), // Top 5 plus urgentes
      monthlyTrend: monthlyTrendArray,
      filters: {
        teamId: teamId || 'all',
        fromDate: fromDate || null,
        toDate: toDate || null,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error generating financial report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
