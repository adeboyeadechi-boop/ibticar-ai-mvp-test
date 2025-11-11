// API Route pour créer un devis depuis un véhicule
// POST /api/accounting/quotes/from-vehicle - Génère un devis à partir d'un véhicule

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// POST /api/accounting/quotes/from-vehicle - Créer devis depuis véhicule
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent créer des devis
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les paramètres
    const body = await request.json()
    const {
      vehicleId,
      customerId,
      teamId,
      validityDays = 30,
      discountRate = 0,
      taxRate = 19, // TVA Algérie par défaut: 19%
      notes,
    } = body

    // Valider les paramètres requis
    if (!vehicleId || !customerId || !teamId) {
      return NextResponse.json(
        { error: 'vehicleId, customerId, and teamId are required' },
        { status: 400 }
      )
    }

    // Vérifier que le véhicule existe et est disponible
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

    if (vehicle.status !== 'AVAILABLE') {
      return NextResponse.json(
        { error: 'Vehicle is not available for quotation' },
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

    // Générer le numéro de devis
    const year = new Date().getFullYear()
    const count = await prisma.quote.count({
      where: {
        teamId,
        createdAt: {
          gte: new Date(`${year}-01-01`),
        },
      },
    })
    const quoteNumber = `QUOTE-${year}-${String(count + 1).padStart(6, '0')}`

    // Calculer les montants
    const unitPrice = Number(vehicle.sellingPrice)
    const quantity = 1
    const subtotal = unitPrice * quantity
    const discountAmount = subtotal * (discountRate / 100)
    const subtotalAfterDiscount = subtotal - discountAmount
    const taxAmount = subtotalAfterDiscount * (taxRate / 100)
    const total = subtotalAfterDiscount + taxAmount

    // Calculer la date de validité
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + validityDays)

    // Créer le devis avec transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer le devis
      const quote = await tx.quote.create({
        data: {
          quoteNumber,
          customerId,
          teamId,
          createdById: user.id,
          status: 'DRAFT',
          validUntil,
          vehicleId,
          subtotal,
          taxAmount,
          discountAmount,
          total,
          currency: vehicle.currency,
          notes,
        },
      })

      // Créer la ligne de devis
      const quoteItem = await tx.quoteItem.create({
        data: {
          quoteId: quote.id,
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

      return { quote, quoteItem }
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Quote',
        entityId: result.quote.id,
        changes: {
          vehicleId,
          customerId,
          total,
          quoteNumber: result.quote.quoteNumber,
        },
      },
    })

    return NextResponse.json({
      success: true,
      quote: result.quote,
      message: `Quote ${result.quote.quoteNumber} created successfully`,
    })
  } catch (error) {
    console.error('Error creating quote from vehicle:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
