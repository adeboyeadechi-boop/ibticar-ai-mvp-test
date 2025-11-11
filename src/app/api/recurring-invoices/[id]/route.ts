// API Route pour gérer une facture récurrente spécifique (PRD-02-US-005)
// GET /api/recurring-invoices/[id] - Récupérer une facture récurrente
// PATCH /api/recurring-invoices/[id] - Mettre à jour une facture récurrente
// DELETE /api/recurring-invoices/[id] - Supprimer (désactiver) une facture récurrente

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { RecurringFrequency } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/recurring-invoices/[id] - Récupérer une facture récurrente
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const recurringInvoice = await prisma.recurringInvoice.findUnique({
      where: { id },
      include: {
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
        team: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!recurringInvoice) {
      return NextResponse.json({ error: 'Recurring invoice not found' }, { status: 404 })
    }

    return NextResponse.json(recurringInvoice)
  } catch (error) {
    console.error('Error fetching recurring invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/recurring-invoices/[id] - Mettre à jour une facture récurrente
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent modifier
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      frequency,
      nextInvoiceDate,
      endDate,
      template,
      isActive,
    } = body

    // Vérifier que la facture récurrente existe
    const existingInvoice = await prisma.recurringInvoice.findUnique({
      where: { id },
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Recurring invoice not found' }, { status: 404 })
    }

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (frequency !== undefined) {
      const validFrequencies: RecurringFrequency[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']
      if (!validFrequencies.includes(frequency)) {
        return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
      }
      updateData.frequency = frequency
    }

    if (nextInvoiceDate !== undefined) {
      updateData.nextInvoiceDate = new Date(nextInvoiceDate)
    }

    if (endDate !== undefined) {
      updateData.endDate = endDate ? new Date(endDate) : null
    }

    if (template !== undefined) {
      if (typeof template !== 'object' || Array.isArray(template)) {
        return NextResponse.json(
          { error: 'Template must be a valid object' },
          { status: 400 }
        )
      }
      updateData.template = template
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive
    }

    // Mettre à jour la facture récurrente
    const updatedInvoice = await prisma.recurringInvoice.update({
      where: { id },
      data: updateData,
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'RecurringInvoice',
        entityId: id,
        changes: {
          before: existingInvoice,
          after: updatedInvoice,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Recurring invoice updated successfully',
      recurringInvoice: updatedInvoice,
    })
  } catch (error) {
    console.error('Error updating recurring invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/recurring-invoices/[id] - Désactiver une facture récurrente
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent supprimer
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que la facture récurrente existe
    const existingInvoice = await prisma.recurringInvoice.findUnique({
      where: { id },
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Recurring invoice not found' }, { status: 404 })
    }

    // Soft delete: désactiver au lieu de supprimer
    await prisma.recurringInvoice.update({
      where: { id },
      data: { isActive: false },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'RecurringInvoice',
        entityId: id,
        changes: {
          action: 'DEACTIVATED',
          before: existingInvoice,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Recurring invoice deactivated successfully',
      recurringInvoiceId: id,
    })
  } catch (error) {
    console.error('Error deleting recurring invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
