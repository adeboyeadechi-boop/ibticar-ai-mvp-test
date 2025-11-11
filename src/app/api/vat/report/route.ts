// API Route pour rapports TVA détaillés (PRD-02-US-007)
// GET /api/vat/report - Rapport TVA complet

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/vat/report - Générer un rapport TVA détaillé
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const teamId = searchParams.get('teamId')
    const reportType = searchParams.get('type') || 'standard' // standard, detailed, g50

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    const periodStart = new Date(startDate)
    const periodEnd = new Date(endDate)

    // Taux TVA Algérie
    const ALGERIAN_VAT_RATE = 0.19

    // Construire les filtres
    const baseWhere: any = {
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    }

    if (teamId) {
      baseWhere.teamId = teamId
    }

    // 1. TVA COLLECTÉE (Ventes)
    const salesInvoices = await prisma.invoice.findMany({
      where: {
        ...baseWhere,
        status: { in: ['PAID', 'PARTIALLY_PAID', 'PENDING', 'SENT'] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        type: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        status: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            companyName: true,
            taxId: true,
          },
        },
      },
      orderBy: {
        issueDate: 'asc',
      },
    })

    const vatCollectedByRate = new Map<number, number>()
    salesInvoices.forEach((invoice) => {
      const vatRate = ALGERIAN_VAT_RATE * 100 // 19%
      const currentVat = vatCollectedByRate.get(vatRate) || 0
      vatCollectedByRate.set(vatRate, currentVat + Number(invoice.taxAmount))
    })

    // 2. TVA DÉDUCTIBLE (Achats)
    const vehiclePurchases = await prisma.vehicle.findMany({
      where: {
        purchaseDate: {
          gte: periodStart,
          lte: periodEnd,
        },
        ...(teamId ? { teamId } : {}),
      },
      select: {
        id: true,
        vin: true,
        purchaseDate: true,
        purchasePrice: true,
        notes: true,
        model: {
          select: {
            name: true,
            brand: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        purchaseDate: 'asc',
      },
    })

    const purchasesWithVAT = vehiclePurchases.map((purchase) => {
      const totalWithVAT = Number(purchase.purchasePrice)
      const baseAmount = totalWithVAT / (1 + ALGERIAN_VAT_RATE)
      const vatAmount = baseAmount * ALGERIAN_VAT_RATE

      return {
        id: purchase.id,
        reference: purchase.vin,
        date: purchase.purchaseDate,
        supplier: 'N/A', // Vehicle doesn't have direct supplier relation
        supplierTaxId: null,
        description: `${purchase.model.brand.name} ${purchase.model.name}`,
        baseAmount: Math.round(baseAmount),
        vatRate: ALGERIAN_VAT_RATE * 100,
        vatAmount: Math.round(vatAmount),
        totalAmount: totalWithVAT,
      }
    })

    // 3. AVOIRS (Impact sur TVA)
    const creditNotes = await prisma.creditNote.findMany({
      where: {
        ...baseWhere,
        status: { in: ['ISSUED', 'APPLIED'] },
      },
      select: {
        id: true,
        creditNoteNumber: true,
        issueDate: true,
        amount: true,
        reason: true,
        invoiceId: true,
        invoice: {
          select: {
            invoiceNumber: true,
            taxAmount: true,
          },
        },
      },
    })

    const creditNotesWithVAT = creditNotes.map((cn) => {
      const totalAmount = Number(cn.amount)
      const baseAmount = totalAmount / (1 + ALGERIAN_VAT_RATE)
      const vatAmount = baseAmount * ALGERIAN_VAT_RATE

      return {
        id: cn.id,
        creditNoteNumber: cn.creditNoteNumber,
        date: cn.issueDate,
        invoiceNumber: cn.invoice?.invoiceNumber,
        baseAmount: Math.round(baseAmount),
        vatAmount: Math.round(vatAmount),
        totalAmount,
        reason: cn.reason,
      }
    })

    // 4. CALCULS TOTAUX
    const totalVATCollected = salesInvoices.reduce((sum, inv) => sum + Number(inv.taxAmount), 0)
    const totalVATDeductible = purchasesWithVAT.reduce((sum, p) => sum + p.vatAmount, 0)
    const totalVATCreditNotes = creditNotesWithVAT.reduce((sum, cn) => sum + cn.vatAmount, 0)
    const netVAT = totalVATCollected - totalVATDeductible - totalVATCreditNotes

    // 5. RAPPORT PAR TYPE
    let detailedReport = {}

    if (reportType === 'detailed' || reportType === 'g50') {
      detailedReport = {
        salesByType: salesInvoices.reduce((acc: any, inv) => {
          const type = inv.type || 'STANDARD'
          if (!acc[type]) {
            acc[type] = {
              count: 0,
              baseAmount: 0,
              vatAmount: 0,
              totalAmount: 0,
            }
          }
          acc[type].count++
          acc[type].baseAmount += Number(inv.subtotal)
          acc[type].vatAmount += Number(inv.taxAmount)
          acc[type].totalAmount += Number(inv.total)
          return acc
        }, {}),

        purchasesBySupplier: purchasesWithVAT.reduce((acc: any, p) => {
          const supplier = p.supplier || 'Unknown'
          if (!acc[supplier]) {
            acc[supplier] = {
              count: 0,
              baseAmount: 0,
              vatAmount: 0,
              totalAmount: 0,
            }
          }
          acc[supplier].count++
          acc[supplier].baseAmount += p.baseAmount
          acc[supplier].vatAmount += p.vatAmount
          acc[supplier].totalAmount += p.totalAmount
          return acc
        }, {}),
      }
    }

    // 6. FORMAT G50 (Déclaration TVA Algérie)
    let g50Format = null
    if (reportType === 'g50') {
      g50Format = {
        periode: {
          debut: periodStart,
          fin: periodEnd,
          mois: periodStart.toLocaleDateString('fr-DZ', { month: 'long', year: 'numeric' }),
        },
        lignes: {
          // Ligne 01: Ventes et prestations taxables
          ligne01: {
            description: 'Ventes et prestations taxables 19%',
            montantHT: Math.round(salesInvoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0)),
            tauxTVA: 19,
            montantTVA: Math.round(totalVATCollected),
          },
          // Ligne 11: Achats de biens et services
          ligne11: {
            description: 'Achats de véhicules (TVA déductible)',
            montantHT: Math.round(purchasesWithVAT.reduce((sum, p) => sum + p.baseAmount, 0)),
            tauxTVA: 19,
            montantTVA: Math.round(totalVATDeductible),
          },
          // Ligne 21: Avoirs
          ligne21: {
            description: 'Avoirs émis',
            montantHT: Math.round(creditNotesWithVAT.reduce((sum, cn) => sum + cn.baseAmount, 0)),
            montantTVA: Math.round(totalVATCreditNotes),
          },
          // Ligne 25: TVA nette à payer
          ligne25: {
            description: 'TVA nette à payer (ou crédit)',
            montant: Math.round(netVAT),
            type: netVAT > 0 ? 'À PAYER' : 'CRÉDIT',
          },
        },
        signature: {
          date: new Date(),
          etablissementName: 'IBTICAR AI',
          nif: 'TBD', // À renseigner
        },
      }
    }

    return NextResponse.json({
      period: {
        start: periodStart,
        end: periodEnd,
        days: Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)),
      },
      summary: {
        vatCollected: Math.round(totalVATCollected),
        vatDeductible: Math.round(totalVATDeductible),
        vatCreditNotes: Math.round(totalVATCreditNotes),
        netVAT: Math.round(netVAT),
        vatRate: ALGERIAN_VAT_RATE * 100,
        currency: 'DZD',
      },
      sales: {
        count: salesInvoices.length,
        baseAmount: Math.round(salesInvoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0)),
        vatAmount: Math.round(totalVATCollected),
        totalAmount: Math.round(salesInvoices.reduce((sum, inv) => sum + Number(inv.total), 0)),
        invoices: salesInvoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          date: inv.issueDate,
          customer: inv.customer.companyName || `${inv.customer.firstName} ${inv.customer.lastName}`,
          customerTaxId: inv.customer.taxId,
          baseAmount: Number(inv.subtotal),
          vatAmount: Number(inv.taxAmount),
          totalAmount: Number(inv.total),
          status: inv.status,
        })),
      },
      purchases: {
        count: purchasesWithVAT.length,
        baseAmount: Math.round(purchasesWithVAT.reduce((sum, p) => sum + p.baseAmount, 0)),
        vatAmount: Math.round(totalVATDeductible),
        totalAmount: Math.round(purchasesWithVAT.reduce((sum, p) => sum + p.totalAmount, 0)),
        items: purchasesWithVAT,
      },
      creditNotes: {
        count: creditNotesWithVAT.length,
        baseAmount: Math.round(creditNotesWithVAT.reduce((sum, cn) => sum + cn.baseAmount, 0)),
        vatAmount: Math.round(totalVATCreditNotes),
        items: creditNotesWithVAT,
      },
      ...detailedReport,
      g50: g50Format,
      generatedAt: new Date(),
    })
  } catch (error) {
    console.error('Error generating VAT report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
