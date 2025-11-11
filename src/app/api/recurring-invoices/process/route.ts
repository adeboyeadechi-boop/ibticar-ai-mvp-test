// API Route pour traiter les factures récurrentes (PRD-02-US-005)
// POST /api/recurring-invoices/process - Générer les factures dues

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { RecurringFrequency } from '@/generated/prisma'

// Fonction pour calculer la prochaine date selon la fréquence
function calculateNextDate(currentDate: Date, frequency: RecurringFrequency): Date {
  const nextDate = new Date(currentDate)

  switch (frequency) {
    case 'WEEKLY':
      nextDate.setDate(nextDate.getDate() + 7)
      break
    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + 1)
      break
    case 'QUARTERLY':
      nextDate.setMonth(nextDate.getMonth() + 3)
      break
    case 'YEARLY':
      nextDate.setFullYear(nextDate.getFullYear() + 1)
      break
  }

  return nextDate
}

// POST /api/recurring-invoices/process - Traiter les factures récurrentes dues
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent traiter les factures récurrentes
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer toutes les factures récurrentes actives dont la date est passée
    const now = new Date()
    const dueRecurringInvoices = await prisma.recurringInvoice.findMany({
      where: {
        isActive: true,
        nextInvoiceDate: {
          lte: now,
        },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 50, // Limiter à 50 par batch
    })

    const results = {
      processed: 0,
      failed: 0,
      details: [] as any[],
    }

    for (const recurringInvoice of dueRecurringInvoices) {
      try {
        // Générer le numéro de facture
        const year = new Date().getFullYear()
        const count = await prisma.invoice.count({
          where: { createdAt: { gte: new Date(`${year}-01-01`) } },
        })
        const invoiceNumber = `FA-${year}-${String(count + 1).padStart(6, '0')}`

        // Récupérer le template
        const template = recurringInvoice.template as any

        // Calculer les montants
        const ALGERIAN_VAT_RATE = 0.19
        let subtotal = 0
        const items: Array<{
          description: string
          quantity: number
          unitPrice: number
          taxRate: number
          discountRate: number
          total: number
          vehicleId: string | null
          order: number
        }> = []

        // Traiter les items du template
        for (const item of template.items || []) {
          const itemSubtotal = item.unitPrice * item.quantity
          const itemDiscount = itemSubtotal * (item.discountRate || 0)
          const itemSubtotalAfterDiscount = itemSubtotal - itemDiscount
          const itemTax = itemSubtotalAfterDiscount * (item.taxRate || ALGERIAN_VAT_RATE)
          const itemTotal = itemSubtotalAfterDiscount + itemTax

          subtotal += itemSubtotalAfterDiscount

          items.push({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate || ALGERIAN_VAT_RATE,
            discountRate: item.discountRate || 0,
            total: itemTotal,
            vehicleId: item.vehicleId || null,
            order: item.order || 0,
          })
        }

        const tax = subtotal * ALGERIAN_VAT_RATE
        const total = subtotal + tax

        // Calculer la date d'échéance (30 jours par défaut)
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + (template.paymentTermDays || 30))

        // Créer la facture dans une transaction
        const invoice = await prisma.$transaction(async (tx) => {
          // 1. Créer la facture
          const newInvoice = await tx.invoice.create({
            data: {
              invoiceNumber,
              customerId: recurringInvoice.customerId,
              teamId: recurringInvoice.teamId,
              createdById: user.id,
              type: 'STANDARD',
              status: 'PENDING',
              issueDate: new Date(),
              dueDate,
              subtotal,
              taxAmount: tax,
              total,
              amountPaid: 0,
              amountDue: total,
              currency: 'DZD',
              terms: template.terms || null,
              notes: `Facture générée automatiquement à partir de la facture récurrente #${recurringInvoice.id}`,
            },
          })

          // 2. Créer les lignes de facture
          for (const item of items) {
            await tx.invoiceItem.create({
              data: {
                invoiceId: newInvoice.id,
                ...item,
              },
            })
          }

          // 3. Mettre à jour la facture récurrente
          const nextDate = calculateNextDate(recurringInvoice.nextInvoiceDate, recurringInvoice.frequency)

          await tx.recurringInvoice.update({
            where: { id: recurringInvoice.id },
            data: {
              lastInvoiceDate: new Date(),
              nextInvoiceDate: nextDate,
            },
          })

          return newInvoice
        })

        results.processed++
        results.details.push({
          recurringInvoiceId: recurringInvoice.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerId: recurringInvoice.customerId,
          amount: Number(invoice.total),
          status: 'success',
        })

        // Log d'audit
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'CREATE',
            entityType: 'Invoice',
            entityId: invoice.id,
            changes: {
              action: 'GENERATED_FROM_RECURRING',
              recurringInvoiceId: recurringInvoice.id,
              invoice,
            },
          },
        })
      } catch (error) {
        results.failed++
        results.details.push({
          recurringInvoiceId: recurringInvoice.id,
          customerId: recurringInvoice.customerId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.processed} recurring invoices, ${results.failed} failed`,
    })
  } catch (error) {
    console.error('Error processing recurring invoices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
