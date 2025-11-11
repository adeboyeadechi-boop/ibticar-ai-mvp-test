// API Route pour exporter les données fiscales (PRD-02-US-012)
// GET /api/fiscal/export - Exporter les données pour déclarations fiscales

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/fiscal/export - Exporter les données fiscales
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN ont accès
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const exportType = searchParams.get('type') || 'vat-g50' // vat-g50, ibs, ledger
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const teamId = searchParams.get('teamId')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    const periodStart = new Date(startDate)
    const periodEnd = new Date(endDate)

    const baseWhere: any = {
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    }

    if (teamId) {
      baseWhere.teamId = teamId
    }

    switch (exportType) {
      case 'vat-g50': {
        // Déclaration TVA mensuelle G50 (Algérie)
        const ALGERIAN_VAT_RATE = 0.19

        // Ventes (TVA collectée)
        const sales = await prisma.invoice.findMany({
          where: {
            ...baseWhere,
            status: { in: ['PAID', 'PARTIALLY_PAID'] },
          },
          select: {
            invoiceNumber: true,
            issueDate: true,
            subtotal: true,
            taxAmount: true,
            total: true,
            customerId: true,
          },
          orderBy: {
            issueDate: 'asc',
          },
        })

        // Fetch customers for sales
        const customerIds = [...new Set(sales.map(s => s.customerId))]
        const customers = await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            taxId: true,
          },
        })
        const customerMap = new Map(customers.map(c => [c.id, c]))

        // Achats (TVA déductible)
        // Note: Vehicle model does not have supplierId field
        const purchases = await prisma.vehicle.findMany({
          where: {
            purchaseDate: {
              gte: periodStart,
              lte: periodEnd,
            },
            ...(teamId ? { teamId } : {}),
          },
          select: {
            vin: true,
            purchaseDate: true,
            purchasePrice: true,
          },
          orderBy: {
            purchaseDate: 'asc',
          },
        })

        const salesData = sales.map((s) => {
          const customer = customerMap.get(s.customerId)
          const customerName = customer?.companyName ||
            `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || 'Unknown'

          return {
            invoiceNumber: s.invoiceNumber,
            date: s.issueDate,
            customer: customerName,
            customerTaxId: customer?.taxId || 'N/A',
            baseAmount: Number(s.subtotal),
            vatAmount: Number(s.taxAmount),
            totalAmount: Number(s.total),
          }
        })

        const purchasesData = purchases.map((p) => {
          const baseAmount = Number(p.purchasePrice) / (1 + ALGERIAN_VAT_RATE)
          const vatAmount = baseAmount * ALGERIAN_VAT_RATE

          return {
            reference: p.vin,
            date: p.purchaseDate,
            supplier: 'N/A', // Vehicle model does not have supplier information
            supplierTaxId: 'N/A',
            baseAmount: Math.round(baseAmount),
            vatAmount: Math.round(vatAmount),
            totalAmount: Number(p.purchasePrice),
          }
        })

        const totalVatCollected = salesData.reduce((sum, s) => sum + s.vatAmount, 0)
        const totalVatDeductible = purchasesData.reduce((sum, p) => sum + p.vatAmount, 0)
        const vatNet = totalVatCollected - totalVatDeductible

        return NextResponse.json({
          exportType: 'vat-g50',
          period: {
            start: periodStart,
            end: periodEnd,
          },
          summary: {
            totalVatCollected: Math.round(totalVatCollected),
            totalVatDeductible: Math.round(totalVatDeductible),
            vatNet: Math.round(vatNet),
            currency: 'DZD',
          },
          sales: salesData,
          purchases: purchasesData,
          generatedAt: new Date(),
          disclaimer:
            'Ce document est généré automatiquement. Vérifier les montants avant soumission à l\'administration fiscale.',
        })
      }

      case 'ibs': {
        // Données pour déclaration IBS (Impôt sur les Bénéfices des Sociétés)
        const revenue = await prisma.invoice.aggregate({
          where: {
            ...baseWhere,
            status: { in: ['PAID', 'PARTIALLY_PAID'] },
          },
          _sum: {
            subtotal: true,
            taxAmount: true,
          },
        })

        const expenses = await prisma.vehicle.aggregate({
          where: {
            purchaseDate: {
              gte: periodStart,
              lte: periodEnd,
            },
            ...(teamId ? { teamId } : {}),
          },
          _sum: {
            purchasePrice: true,
          },
        })

        const revenueAmount = revenue._sum.subtotal
          ? Number(revenue._sum.subtotal)
          : 0
        const expensesAmount = expenses._sum.purchasePrice
          ? Number(expenses._sum.purchasePrice)
          : 0

        const profit = revenueAmount - expensesAmount
        const ibsAmount = profit > 0 ? profit * 0.26 : 0 // IBS = 26% en Algérie

        return NextResponse.json({
          exportType: 'ibs',
          period: {
            start: periodStart,
            end: periodEnd,
          },
          summary: {
            revenue: Math.round(revenueAmount),
            expenses: Math.round(expensesAmount),
            profit: Math.round(profit),
            ibsRate: 0.26,
            ibsAmount: Math.round(ibsAmount),
            currency: 'DZD',
          },
          generatedAt: new Date(),
        })
      }

      case 'ledger': {
        // Grand livre (Ledger) - Toutes les transactions
        const invoices = await prisma.invoice.findMany({
          where: baseWhere,
          select: {
            invoiceNumber: true,
            issueDate: true,
            type: true,
            status: true,
            subtotal: true,
            taxAmount: true,
            total: true,
            customerId: true,
          },
          orderBy: {
            issueDate: 'asc',
          },
        })

        // Fetch customers for invoices
        const invoiceCustomerIds = [...new Set(invoices.map(i => i.customerId))]
        const invoiceCustomers = await prisma.customer.findMany({
          where: { id: { in: invoiceCustomerIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        })
        const invoiceCustomerMap = new Map(invoiceCustomers.map(c => [c.id, c]))

        const payments = await prisma.payment.findMany({
          where: {
            ...baseWhere,
            status: 'COMPLETED',
          },
          select: {
            paymentNumber: true,
            paymentDate: true,
            method: true,
            amount: true,
            invoiceId: true,
          },
          orderBy: {
            paymentDate: 'asc',
          },
        })

        // Fetch invoices for payments
        const paymentInvoiceIds = [...new Set(payments.map(p => p.invoiceId))]
        const paymentInvoices = await prisma.invoice.findMany({
          where: { id: { in: paymentInvoiceIds } },
          select: {
            id: true,
            invoiceNumber: true,
          },
        })
        const paymentInvoiceMap = new Map(paymentInvoices.map(i => [i.id, i]))

        const creditNotes = await prisma.creditNote.findMany({
          where: {
            ...baseWhere,
            status: { in: ['ISSUED', 'APPLIED'] },
          },
          select: {
            creditNoteNumber: true,
            issueDate: true,
            amount: true,
            reason: true,
          },
          orderBy: {
            issueDate: 'asc',
          },
        })

        return NextResponse.json({
          exportType: 'ledger',
          period: {
            start: periodStart,
            end: periodEnd,
          },
          transactions: {
            invoices: invoices.map((i) => {
              const customer = invoiceCustomerMap.get(i.customerId)
              const customerName = customer?.companyName ||
                `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || 'Unknown'

              return {
                type: 'INVOICE',
                reference: i.invoiceNumber,
                date: i.issueDate,
                customer: customerName,
                amount: Number(i.total),
                status: i.status,
              }
            }),
            payments: payments.map((p) => {
              const invoice = paymentInvoiceMap.get(p.invoiceId)

              return {
                type: 'PAYMENT',
                reference: p.paymentNumber,
                date: p.paymentDate,
                method: p.method,
                amount: Number(p.amount),
                invoiceRef: invoice?.invoiceNumber || 'N/A',
              }
            }),
            creditNotes: creditNotes.map((cn) => ({
              type: 'CREDIT_NOTE',
              reference: cn.creditNoteNumber,
              date: cn.issueDate,
              amount: Number(cn.amount),
              reason: cn.reason,
            })),
          },
          generatedAt: new Date(),
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error exporting fiscal data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
