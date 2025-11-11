// API Routes pour la gestion des devis clients (PRD-02-US-001)
// GET /api/quotes - Liste des devis avec filtres
// POST /api/quotes - Créer un nouveau devis

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { QuoteStatus, Currency } from '@/generated/prisma'

// Configuration des taxes algériennes
const ALGERIAN_VAT_RATE = 0.19 // TVA 19%

// GET /api/quotes - Liste des devis
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as QuoteStatus | null
    const customerId = searchParams.get('customerId')
    const teamId = searchParams.get('teamId')
    const search = searchParams.get('search')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    if (status) where.status = status
    if (customerId) where.customerId = customerId
    if (teamId) where.teamId = teamId

    // Recherche textuelle (par numéro de devis)
    if (search) {
      where.quoteNumber = {
        contains: search,
        mode: 'insensitive',
      }
    }

    // Filtrage par date de création
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // Compter le total
    const total = await prisma.quote.count({ where })

    // Récupérer les devis avec relations
    const quotes = await prisma.quote.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
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
            city: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            vin: true,
            registrationNumber: true,
            year: true,
            color: true,
            mileage: true,
            model: {
              select: {
                id: true,
                name: true,
                brand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        items: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    // Statistiques par statut
    const stats = await prisma.quote.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
      where: teamId ? { teamId } : {},
    })

    const statusCounts: Record<string, number> = {}
    stats.forEach((stat) => {
      statusCounts[stat.status] = stat._count.id
    })

    return NextResponse.json({
      quotes: quotes.map((quote) => ({
        ...quote,
        subtotal: Number(quote.subtotal),
        taxAmount: Number(quote.taxAmount),
        discountAmount: Number(quote.discountAmount),
        total: Number(quote.total),
        items: quote.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          discountRate: Number(item.discountRate),
          total: Number(item.total),
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats: statusCounts,
    })
  } catch (error) {
    console.error('Error fetching quotes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/quotes - Créer un nouveau devis
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent créer des devis
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const {
      customerId,
      teamId,
      vehicleId,
      items = [],
      validityDays = 30,
      discountAmount = 0,
      notes,
      terms,
    } = body

    // Valider les paramètres requis
    if (!customerId || !teamId) {
      return NextResponse.json(
        { error: 'customerId and teamId are required' },
        { status: 400 }
      )
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
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

    // Vérifier que l'équipe existe
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Si vehicleId fourni, vérifier qu'il existe
    let vehicle = null
    if (vehicleId) {
      vehicle = await prisma.vehicle.findUnique({
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

      // Ajouter automatiquement le véhicule aux items s'il n'est pas déjà présent
      const vehicleInItems = items.some((item: any) => item.vehicleId === vehicleId)
      if (!vehicleInItems) {
        items.unshift({
          description: `${vehicle.model.brand.name} ${vehicle.model.name} ${vehicle.year} - VIN: ${vehicle.vin}`,
          quantity: 1,
          unitPrice: Number(vehicle.sellingPrice),
          taxRate: ALGERIAN_VAT_RATE,
          discountRate: 0,
          vehicleId: vehicle.id,
          order: 0,
        })
      }
    }

    // Calculer le sous-total et les taxes
    let subtotal = 0
    let totalTaxAmount = 0

    const processedItems = items.map((item: any, index: number) => {
      const unitPrice = Number(item.unitPrice)
      const quantity = item.quantity || 1
      const taxRate = item.taxRate !== undefined ? Number(item.taxRate) : ALGERIAN_VAT_RATE
      const discountRate = Number(item.discountRate || 0)

      // Calcul: (prix unitaire * quantité) - réduction
      const itemSubtotal = unitPrice * quantity
      const itemDiscount = itemSubtotal * discountRate
      const itemSubtotalAfterDiscount = itemSubtotal - itemDiscount

      // Taxe appliquée sur le montant après réduction
      const itemTax = itemSubtotalAfterDiscount * taxRate
      const itemTotal = itemSubtotalAfterDiscount + itemTax

      subtotal += itemSubtotalAfterDiscount
      totalTaxAmount += itemTax

      return {
        description: item.description,
        quantity,
        unitPrice,
        taxRate,
        discountRate,
        total: itemTotal,
        vehicleId: item.vehicleId || null,
        order: item.order !== undefined ? item.order : index,
      }
    })

    // Appliquer la réduction globale
    const globalDiscountAmount = Number(discountAmount || 0)
    const subtotalAfterDiscount = subtotal - globalDiscountAmount

    // Recalculer les taxes si une réduction globale est appliquée
    if (globalDiscountAmount > 0) {
      totalTaxAmount = subtotalAfterDiscount * ALGERIAN_VAT_RATE
    }

    const total = subtotalAfterDiscount + totalTaxAmount

    // Générer un numéro de devis unique (format: QT-YYYY-NNNNNN)
    const year = new Date().getFullYear()
    const count = await prisma.quote.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
        },
      },
    })
    const quoteNumber = `QT-${year}-${String(count + 1).padStart(6, '0')}`

    // Date de validité
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + validityDays)

    // Termes par défaut si non fournis
    const defaultTerms = terms || [
      'Ce devis est valable pour la durée indiquée',
      'Les prix sont exprimés en Dinars Algériens (DZD) TTC',
      'La TVA au taux en vigueur (19%) est incluse',
      'Un acompte de 30% est requis à la signature',
      'Le solde est payable à la livraison',
      'Garantie constructeur selon les conditions en vigueur',
    ].join('\n')

    // Créer le devis avec ses items
    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        customerId,
        teamId,
        createdById: user.id,
        vehicleId: vehicleId || null,
        status: 'DRAFT',
        validUntil,
        subtotal,
        taxAmount: totalTaxAmount,
        discountAmount: globalDiscountAmount,
        total,
        currency: Currency.DZD,
        terms: defaultTerms,
        notes,
        items: {
          create: processedItems,
        },
      },
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
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            vin: true,
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
        },
        items: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Quote',
        entityId: quote.id,
        changes: {
          quoteNumber: quote.quoteNumber,
          customerId,
          vehicleId,
          total: Number(total),
        },
      },
    })

    return NextResponse.json({
      success: true,
      quote: {
        ...quote,
        subtotal: Number(quote.subtotal),
        taxAmount: Number(quote.taxAmount),
        discountAmount: Number(quote.discountAmount),
        total: Number(quote.total),
        items: quote.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          discountRate: Number(item.discountRate),
          total: Number(item.total),
        })),
      },
      message: 'Quote created successfully',
    })
  } catch (error) {
    console.error('Error creating quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
