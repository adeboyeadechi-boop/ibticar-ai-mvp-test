// API Route pour créer une facture depuis un véhicule vendu
// POST /api/accounting/invoices/from-vehicle - Génère une facture directe lors de la vente

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// POST /api/accounting/invoices/from-vehicle - Créer facture depuis véhicule vendu
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent créer des factures
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les paramètres
    const body = await request.json()
    const {
      vehicleId,
      customerId,
      teamId,
      paymentDueDays = 30,
      discountRate = 0,
      taxRate = 19, // TVA Algérie par défaut: 19%
      notes,
      markAsSold = true, // Marquer le véhicule comme vendu automatiquement
    } = body

    // Valider les paramètres requis
    if (!vehicleId || !customerId || !teamId) {
      return NextResponse.json(
        { error: 'vehicleId, customerId, and teamId are required' },
        { status: 400 }
      )
    }

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        model: {
          include: {
            brand: true,
          },
        },
      },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    if (vehicle.status === 'SOLD') {
      return NextResponse.json(
        { error: 'Vehicle is already sold' },
        { status: 400 }
      )
    }

    // Vérifier que le client existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Générer le numéro de facture
    const year = new Date().getFullYear()
    const count = await prisma.invoice.count({
      where: {
        teamId,
        createdAt: {
          gte: new Date(`${year}-01-01`),
        },
      },
    })
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(6, '0')}`

    // Calculer les montants
    const unitPrice = Number(vehicle.sellingPrice)
    const quantity = 1
    const subtotal = unitPrice * quantity
    const discountAmount = subtotal * (discountRate / 100)
    const subtotalAfterDiscount = subtotal - discountAmount
    const taxAmount = subtotalAfterDiscount * (taxRate / 100)
    const total = subtotalAfterDiscount + taxAmount

    // Calculer la date d'échéance
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + paymentDueDays)

    // Créer la facture avec transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer la facture
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId,
          teamId,
          createdById: user.id,
          status: 'SENT',
          type: 'STANDARD',
          issueDate: new Date(),
          dueDate,
          subtotal,
          taxAmount,
          discountAmount,
          total,
          amountDue: total,
          currency: vehicle.currency,
          notes,
          sentAt: new Date(),
        },
      })

      // Créer la ligne de facture
      const invoiceItem = await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: `${vehicle.model.brand.name} ${vehicle.model.name} ${vehicle.year} - VIN: ${vehicle.vin}`,
          quantity,
          unitPrice,
          taxRate,
          discountRate,
          total: subtotalAfterDiscount + taxAmount,
          vehicleId,
          order: 1,
        },
      })

      // Marquer le véhicule comme vendu si demandé
      let updatedVehicle = null
      if (markAsSold) {
        updatedVehicle = await tx.vehicle.update({
          where: { id: vehicleId },
          data: {
            status: 'SOLD',
            soldAt: new Date(),
          },
        })
      }

      return { invoice, invoiceItem, updatedVehicle }
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Invoice',
        entityId: result.invoice.id,
        changes: {
          vehicleId,
          customerId,
          total,
          invoiceNumber: result.invoice.invoiceNumber,
          vehicleSold: markAsSold,
        },
      },
    })

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      vehicleSold: markAsSold,
      message: `Invoice ${result.invoice.invoiceNumber} created successfully`,
    })
  } catch (error) {
    console.error('Error creating invoice from vehicle:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
