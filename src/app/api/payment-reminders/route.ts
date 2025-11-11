// API Routes pour les relances automatiques (PRD-02-US-008)
// GET /api/payment-reminders - Liste des relances
// POST /api/payment-reminders - Créer/planifier des relances

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { ReminderType, ReminderStatus } from '@/generated/prisma'

// GET /api/payment-reminders - Liste des relances
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const invoiceId = searchParams.get('invoiceId')
    const customerId = searchParams.get('customerId')
    const type = searchParams.get('type') as ReminderType | null
    const status = searchParams.get('status') as ReminderStatus | null

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    if (invoiceId) where.invoiceId = invoiceId
    if (customerId) where.customerId = customerId
    if (type) where.type = type
    if (status) where.status = status

    // Compter le total
    const total = await prisma.paymentReminder.count({ where })

    // Récupérer les relances
    const reminders = await prisma.paymentReminder.findMany({
      where,
      orderBy: {
        scheduledAt: 'desc',
      },
      skip,
      take: limit,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            amountDue: true,
            dueDate: true,
            status: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            companyName: true,
          },
        },
      },
    })

    return NextResponse.json({
      reminders: reminders.map((r) => ({
        ...r,
        invoice: r.invoice
          ? {
              ...r.invoice,
              total: Number(r.invoice.total),
              amountDue: Number(r.invoice.amountDue),
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
    })
  } catch (error) {
    console.error('Error fetching payment reminders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/payment-reminders - Créer/planifier des relances
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent créer des relances
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const { invoiceId, type, scheduledAt, autoCreate } = body

    if (autoCreate) {
      // Mode automatique: créer des relances pour toutes les factures en retard
      const now = new Date()
      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          status: { in: ['SENT', 'OVERDUE', 'PARTIALLY_PAID'] },
          dueDate: { lt: now },
        },
        include: {
          customer: {
            select: {
              id: true,
            },
          },
        },
      })

      const reminders = []

      for (const invoice of overdueInvoices) {
        // Vérifier si une relance n'existe pas déjà
        const existingReminder = await prisma.paymentReminder.findFirst({
          where: {
            invoiceId: invoice.id,
            status: { in: ['SCHEDULED', 'SENT'] },
          },
        })

        if (existingReminder) continue

        // Déterminer le type de relance selon l'ancienneté du retard
        const daysOverdue = Math.ceil(
          (now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        let reminderType: ReminderType
        if (daysOverdue <= 7) {
          reminderType = 'FIRST'
        } else if (daysOverdue <= 30) {
          reminderType = 'SECOND'
        } else {
          reminderType = 'FINAL'
        }

        const reminder = await prisma.paymentReminder.create({
          data: {
            invoiceId: invoice.id,
            customerId: invoice.customerId,
            type: reminderType,
            status: 'SCHEDULED',
            scheduledAt: now,
          },
        })

        reminders.push(reminder)
      }

      return NextResponse.json({
        success: true,
        reminders,
        count: reminders.length,
        message: `${reminders.length} reminders created for overdue invoices`,
      })
    } else {
      // Mode manuel: créer une relance spécifique
      if (!invoiceId || !type) {
        return NextResponse.json(
          { error: 'invoiceId and type are required' },
          { status: 400 }
        )
      }

      // Vérifier que la facture existe
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      })

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }

      // Ne pas créer de relance pour facture payée ou annulée
      if (['PAID', 'CANCELLED'].includes(invoice.status)) {
        return NextResponse.json(
          { error: 'Cannot create reminder for paid or cancelled invoice' },
          { status: 400 }
        )
      }

      // Créer la relance
      const reminder = await prisma.paymentReminder.create({
        data: {
          invoiceId,
          customerId: invoice.customerId,
          type: type as ReminderType,
          status: 'SCHEDULED',
          scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              total: true,
              amountDue: true,
            },
          },
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

      // Log d'audit
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entityType: 'PaymentReminder',
          entityId: reminder.id,
          changes: {
            invoiceId,
            type,
            scheduledAt: reminder.scheduledAt,
          },
        },
      })

      return NextResponse.json({
        success: true,
        reminder: {
          ...reminder,
          invoice: reminder.invoice
            ? {
                ...reminder.invoice,
                total: Number(reminder.invoice.total),
                amountDue: Number(reminder.invoice.amountDue),
              }
            : null,
        },
        message: 'Payment reminder created successfully',
      })
    }
  } catch (error) {
    console.error('Error creating payment reminder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
