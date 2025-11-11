// API Route pour le tableau de bord fiscal (PRD-02-US-012)
// GET /api/fiscal/dashboard - Dashboard fiscal et conformité SCF (Algérie)

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/fiscal/dashboard - Tableau de bord fiscal
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER ont accès
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const teamId = searchParams.get('teamId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || 'month' // month, quarter, year

    // Définir la période par défaut
    const now = new Date()
    let periodStart: Date
    let periodEnd: Date = endDate ? new Date(endDate) : now

    if (startDate) {
      periodStart = new Date(startDate)
    } else {
      // Par défaut: période fiscale courante (année civile en Algérie)
      if (period === 'year') {
        periodStart = new Date(now.getFullYear(), 0, 1)
      } else if (period === 'quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3)
        periodStart = new Date(now.getFullYear(), currentQuarter * 3, 1)
      } else {
        // month
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      }
    }

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

    // 1. TVA COLLECTÉE (sur les ventes/factures) - 19% en Algérie
    const ALGERIAN_VAT_RATE = 0.19

    const invoicesAggregate = await prisma.invoice.aggregate({
      where: {
        ...baseWhere,
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
      },
      _sum: {
        subtotal: true,
        taxAmount: true,
        total: true,
        amountPaid: true,
      },
      _count: {
        id: true,
      },
    })

    const vatCollected = invoicesAggregate._sum.taxAmount
      ? Number(invoicesAggregate._sum.taxAmount)
      : 0

    const totalRevenue = invoicesAggregate._sum.total
      ? Number(invoicesAggregate._sum.total)
      : 0

    const revenueExclVat = invoicesAggregate._sum.subtotal
      ? Number(invoicesAggregate._sum.subtotal)
      : 0

    // 2. TVA DÉDUCTIBLE (sur les achats de véhicules)
    const vehiclePurchases = await prisma.vehicle.aggregate({
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
      _count: {
        id: true,
      },
    })

    const purchasesExclVat = vehiclePurchases._sum.purchasePrice
      ? Number(vehiclePurchases._sum.purchasePrice) / (1 + ALGERIAN_VAT_RATE)
      : 0

    const vatDeductible = purchasesExclVat * ALGERIAN_VAT_RATE

    // 3. TVA NETTE À PAYER
    const vatNet = vatCollected - vatDeductible

    // 4. CHIFFRE D'AFFAIRES (CA) PAR CATÉGORIE
    const salesByCategory = await prisma.invoice.groupBy({
      by: ['type'],
      where: {
        ...baseWhere,
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
      },
      _sum: {
        total: true,
        subtotal: true,
      },
      _count: {
        id: true,
      },
    })

    // 5. PAIEMENTS REÇUS PAR MÉTHODE (conformité)
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

    // Identifier les paiements cash > 500k DZD (limite légale en Algérie)
    const cashPayments = await prisma.payment.findMany({
      where: {
        ...baseWhere,
        method: 'CASH',
        status: 'COMPLETED',
      },
      select: {
        id: true,
        amount: true,
        invoiceId: true,
        paymentDate: true,
      },
    })

    const cashOverLimit = cashPayments.filter(
      (p) => Number(p.amount) > 500000
    )

    // 6. AVOIRS (CREDIT NOTES) - Impact fiscal
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

    const creditNotesValue = creditNotesAggregate._sum.amount
      ? Number(creditNotesAggregate._sum.amount)
      : 0

    // 7. MARGES ET RATIOS
    const vehiclesSold = await prisma.vehicle.findMany({
      where: {
        status: 'SOLD',
        updatedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        ...(teamId ? { teamId } : {}),
      },
      select: {
        purchasePrice: true,
        sellingPrice: true,
      },
    })

    let totalPurchaseValue = 0
    let totalSellingValue = 0

    vehiclesSold.forEach((v) => {
      totalPurchaseValue += Number(v.purchasePrice)
      totalSellingValue += Number(v.sellingPrice)
    })

    const grossMargin = totalSellingValue - totalPurchaseValue
    const grossMarginRate =
      totalSellingValue > 0 ? (grossMargin / totalSellingValue) * 100 : 0

    // 8. DOCUMENTS OBLIGATOIRES (conformité SCF)
    const documentsCompliance = {
      invoices: {
        total: invoicesAggregate._count.id,
        withTax: invoicesAggregate._count.id, // Toutes nos factures incluent la TVA
        compliant: invoicesAggregate._count.id,
      },
      creditNotes: {
        total: creditNotesAggregate._count.id,
        compliant: creditNotesAggregate._count.id,
      },
      cashPaymentsOverLimit: {
        count: cashOverLimit.length,
        totalAmount: cashOverLimit.reduce((sum, p) => sum + Number(p.amount), 0),
        warning: cashOverLimit.length > 0,
      },
    }

    // 9. OBLIGATIONS FISCALES (Algérie)
    const fiscalObligations = {
      tvaMonthly: {
        name: 'Déclaration TVA mensuelle (G50)',
        deadline: 'Avant le 20 du mois suivant',
        amount: vatNet,
        status: vatNet > 0 ? 'À PAYER' : 'CRÉDIT',
      },
      tvaQuarterly: {
        name: 'Déclaration TVA trimestrielle (petites entreprises)',
        deadline: 'Avant le 20 du mois suivant le trimestre',
        applicable: totalRevenue < 5000000, // Si CA < 5M DZD
      },
      ibs: {
        name: 'IBS (Impôt sur les Bénéfices des Sociétés)',
        rate: '26% des bénéfices',
        deadline: 'Avant le 30 avril (année N+1)',
        estimated: grossMargin * 0.26, // Estimation basique
      },
      tav: {
        name: 'TAV (Taxe sur l\'Activité Véhicule)',
        applicable: true,
        note: 'Applicable sur les véhicules de tourisme',
      },
    }

    // 10. TENDANCES FISCALES (3 derniers mois/trimestres)
    const trends = await generateFiscalTrends(period, teamId)

    return NextResponse.json({
      period: {
        start: periodStart,
        end: periodEnd,
        type: period,
        days: Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)),
      },
      vat: {
        collected: Math.round(vatCollected),
        deductible: Math.round(vatDeductible),
        net: Math.round(vatNet),
        rate: ALGERIAN_VAT_RATE,
        currency: 'DZD',
      },
      revenue: {
        total: Math.round(totalRevenue),
        exclVat: Math.round(revenueExclVat),
        creditNotes: Math.round(creditNotesValue),
        netRevenue: Math.round(totalRevenue - creditNotesValue),
        byCategory: salesByCategory.map((cat) => ({
          type: cat.type,
          total: Number(cat._sum.total || 0),
          exclVat: Number(cat._sum.subtotal || 0),
          count: cat._count.id,
        })),
      },
      purchases: {
        totalExclVat: Math.round(purchasesExclVat),
        vatAmount: Math.round(vatDeductible),
        vehicleCount: vehiclePurchases._count.id,
      },
      margin: {
        gross: Math.round(grossMargin),
        rate: Math.round(grossMarginRate * 100) / 100,
        vehiclesSold: vehiclesSold.length,
      },
      payments: {
        byMethod: paymentsByMethod.map((pm) => ({
          method: pm.method,
          amount: Number(pm._sum.amount || 0),
          count: pm._count.id,
        })),
      },
      compliance: {
        documents: documentsCompliance,
        obligations: fiscalObligations,
        alerts: [
          ...(cashOverLimit.length > 0
            ? [
                {
                  severity: 'HIGH',
                  message: `${cashOverLimit.length} paiement(s) cash > 500,000 DZD (limite légale dépassée)`,
                },
              ]
            : []),
          ...(vatNet > 1000000
            ? [
                {
                  severity: 'MEDIUM',
                  message: `TVA à payer: ${Math.round(vatNet).toLocaleString('fr-DZ')} DZD`,
                },
              ]
            : []),
        ],
      },
      trends,
      generatedAt: new Date(),
    })
  } catch (error) {
    console.error('Error generating fiscal dashboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fonction pour générer les tendances fiscales
async function generateFiscalTrends(period: string, teamId: string | null) {
  const trends = []
  const now = new Date()
  const intervals = period === 'year' ? 4 : 3 // 4 trimestres ou 3 mois

  for (let i = intervals - 1; i >= 0; i--) {
    let intervalStart: Date
    let intervalEnd: Date
    let label: string

    if (period === 'year') {
      // Trimestres
      const quarter = Math.floor(now.getMonth() / 3) - i
      intervalStart = new Date(now.getFullYear(), quarter * 3, 1)
      intervalEnd = new Date(now.getFullYear(), quarter * 3 + 3, 1)
      label = `T${quarter + 1} ${now.getFullYear()}`
    } else {
      // Mois
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

    const [invoices, payments] = await Promise.all([
      prisma.invoice.aggregate({
        where: { ...where, status: { in: ['PAID', 'PARTIALLY_PAID'] } },
        _sum: { subtotal: true, taxAmount: true },
      }),
      prisma.payment.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ])

    trends.push({
      period: label,
      start: intervalStart,
      end: intervalEnd,
      vatCollected: invoices._sum.taxAmount ? Number(invoices._sum.taxAmount) : 0,
      revenueExclVat: invoices._sum.subtotal ? Number(invoices._sum.subtotal) : 0,
      paymentsReceived: payments._sum.amount ? Number(payments._sum.amount) : 0,
    })
  }

  return trends
}
