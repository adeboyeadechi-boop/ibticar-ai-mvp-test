// API Route pour convertir un devis en facture (PRD-02-US-002)
// POST /api/quotes/[id]/convert-to-invoice - Conversion en un clic

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { Currency, InvoiceType } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/quotes/[id]/convert-to-invoice - Convertir en facture
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: quoteId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent convertir
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les options de conversion
    const body = await request.json().catch(() => ({}))
    const {
      dueDate,
      paymentTerms = 30, // Jours
      notes,
      depositAmount = 0,
    } = body

    // Récupérer le devis avec tous les détails
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
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
        vehicle: {
          select: {
            id: true,
            vin: true,
            status: true,
          },
        },
        items: {
          orderBy: {
            order: 'asc',
          },
          include: {
            vehicle: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Vérifier que le devis n'a pas déjà été converti
    if (quote.convertedToInvoiceId) {
      // Récupérer l'invoice existante
      const existingInvoice = await prisma.invoice.findUnique({
        where: { id: quote.convertedToInvoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
        },
      })

      return NextResponse.json(
        {
          error: 'Quote has already been converted to invoice',
          existingInvoice,
        },
        { status: 400 }
      )
    }

    // Vérifier que le devis est accepté
    if (quote.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Only accepted quotes can be converted to invoice' },
        { status: 400 }
      )
    }

    // Vérifier que le devis n'a pas expiré
    if (new Date() > quote.validUntil) {
      return NextResponse.json(
        { error: 'Quote has expired. Cannot convert to invoice.' },
        { status: 400 }
      )
    }

    // Générer un numéro de facture selon normes algériennes
    // Format: INV-YYYY-NNNNNN (ou FA-YYYY-NNNNNN pour "Facture Algérie")
    const year = new Date().getFullYear()
    const count = await prisma.invoice.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
        },
      },
    })
    const invoiceNumber = `FA-${year}-${String(count + 1).padStart(6, '0')}`

    // Date d'échéance (par défaut: 30 jours)
    const calculatedDueDate = dueDate
      ? new Date(dueDate)
      : new Date(Date.now() + paymentTerms * 24 * 60 * 60 * 1000)

    // Calculer le montant déjà versé (acomptes)
    const depositAmountDecimal = Number(depositAmount || 0)
    const totalAmount = Number(quote.total)
    const amountDue = Math.max(0, totalAmount - depositAmountDecimal)

    // Créer les items de facture depuis les items de devis
    const invoiceItems = quote.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discountRate: item.discountRate,
      total: item.total,
      vehicleId: item.vehicleId,
      order: item.order,
    }))

    // Créer la facture avec transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer la facture
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          quoteId,
          customerId: quote.customerId,
          teamId: quote.teamId,
          createdById: user.id,
          status: depositAmountDecimal > 0 ? 'PARTIALLY_PAID' : 'SENT',
          type: InvoiceType.STANDARD,
          issueDate: new Date(),
          dueDate: calculatedDueDate,
          subtotal: quote.subtotal,
          taxAmount: quote.taxAmount,
          discountAmount: quote.discountAmount,
          total: quote.total,
          amountPaid: depositAmountDecimal,
          amountDue,
          currency: Currency.DZD,
          terms: quote.terms,
          notes: notes || `Facture générée depuis le devis ${quote.quoteNumber}`,
          items: {
            create: invoiceItems,
          },
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
          items: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      })

      // 2. Mettre à jour le devis pour marquer la conversion
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          convertedToInvoiceId: invoice.id,
          convertedAt: new Date(),
        },
      })

      // 3. Si un acompte a été versé, créer l'enregistrement Payment
      if (depositAmountDecimal > 0) {
        const paymentCount = await tx.payment.count({
          where: {
            createdAt: {
              gte: new Date(`${new Date().getFullYear()}-01-01`),
            },
          },
        })
        const paymentNumber = `PAY-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(6, '0')}`

        await tx.payment.create({
          data: {
            paymentNumber,
            invoiceId: invoice.id,
            customerId: quote.customerId,
            amount: depositAmountDecimal,
            method: 'OTHER', // À spécifier par l'utilisateur
            paymentDate: new Date(),
            status: 'COMPLETED',
            reference: `Acompte pour facture ${invoiceNumber}`,
            notes: 'Acompte versé lors de la conversion du devis',
          },
        })
      }

      // 4. Mettre à jour le statut du véhicule principal si présent
      if (quote.vehicle && quote.vehicle.status !== 'SOLD') {
        await tx.vehicle.update({
          where: { id: quote.vehicle.id },
          data: {
            status: depositAmountDecimal >= totalAmount ? 'SOLD' : 'RESERVED',
            soldAt: depositAmountDecimal >= totalAmount ? new Date() : null,
          },
        })
      }

      // 5. Mettre à jour tous les véhicules dans les items
      for (const item of quote.items) {
        if (item.vehicleId && item.vehicle) {
          await tx.vehicle.update({
            where: { id: item.vehicleId },
            data: {
              status: depositAmountDecimal >= totalAmount ? 'SOLD' : 'RESERVED',
              soldAt: depositAmountDecimal >= totalAmount ? new Date() : null,
            },
          })
        }
      }

      return invoice
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Invoice',
        entityId: result.id,
        changes: {
          action: 'CONVERTED_FROM_QUOTE',
          quoteId,
          quoteNumber: quote.quoteNumber,
          invoiceNumber: result.invoiceNumber,
          depositAmount: depositAmountDecimal,
          vehicleStatus: quote.vehicle ? (depositAmountDecimal >= totalAmount ? 'SOLD' : 'RESERVED') : null,
        },
      },
    })

    return NextResponse.json({
      success: true,
      invoice: {
        ...result,
        subtotal: Number(result.subtotal),
        taxAmount: Number(result.taxAmount),
        discountAmount: Number(result.discountAmount),
        total: Number(result.total),
        amountPaid: Number(result.amountPaid),
        amountDue: Number(result.amountDue),
        items: result.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          discountRate: Number(item.discountRate),
          total: Number(item.total),
        })),
      },
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        convertedAt: new Date(),
      },
      message: 'Quote converted to invoice successfully',
      nextSteps: [
        depositAmountDecimal > 0 ? 'Process remaining payment' : 'Process deposit payment',
        'Send invoice to customer',
        'Schedule vehicle delivery',
      ],
    })
  } catch (error) {
    console.error('Error converting quote to invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
