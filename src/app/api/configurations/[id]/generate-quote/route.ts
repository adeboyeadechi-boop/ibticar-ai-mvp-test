// API Route pour générer un devis détaillé à partir d'une configuration
// POST /api/configurations/[id]/generate-quote - Génère un devis formel

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/configurations/[id]/generate-quote - Générer un devis
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: configId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les données du devis
    const body = await request.json()
    const { customerId, validUntil, notes, teamId } = body

    // Vérifier que la configuration existe
    const configuration = await prisma.vehicleConfiguration.findUnique({
      where: { id: configId },
    })

    if (!configuration) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    // Fetch model and brand separately
    const model = await prisma.vehicleModel.findUnique({
      where: { id: configuration.vehicleModelId },
    })

    if (!model) {
      return NextResponse.json({ error: 'Vehicle model not found' }, { status: 404 })
    }

    const brand = await prisma.brand.findUnique({
      where: { id: model.brandId },
    })

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    // Vérifier le client si fourni
    let customer = null
    if (customerId) {
      customer = await prisma.customer.findUnique({
        where: { id: customerId },
      })
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }
    }

    // Générer un numéro de devis unique
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const count = await prisma.quote.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
        },
      },
    })
    const quoteNumber = `QT-${year}${month}-${String(count + 1).padStart(5, '0')}`

    // Calculer les détails du devis
    const options = configuration.options as any
    const breakdown: any = {
      basePrice: {
        label: `${configuration.trim} - Prix de base`,
        amount: Number(configuration.basePrice),
      },
      options: [],
      subtotal: Number(configuration.basePrice),
    }

    // Ajouter les options au détail
    if (options.exteriorColor && options.exteriorColor.price > 0) {
      breakdown.options.push({
        category: 'Couleur Extérieure',
        name: options.exteriorColor.name,
        price: Number(options.exteriorColor.price),
      })
      breakdown.subtotal += Number(options.exteriorColor.price)
    }

    if (options.interiorColor && options.interiorColor.price > 0) {
      breakdown.options.push({
        category: 'Couleur Intérieure',
        name: options.interiorColor.name,
        price: Number(options.interiorColor.price),
      })
      breakdown.subtotal += Number(options.interiorColor.price)
    }

    if (options.wheels && options.wheels.price > 0) {
      breakdown.options.push({
        category: 'Jantes',
        name: options.wheels.name,
        price: Number(options.wheels.price),
      })
      breakdown.subtotal += Number(options.wheels.price)
    }

    // Packages
    if (options.packages) {
      Object.values(options.packages).forEach((pkg: any) => {
        if (pkg.selected && pkg.price > 0) {
          breakdown.options.push({
            category: 'Pack',
            name: pkg.name,
            price: Number(pkg.price),
            features: pkg.features || [],
          })
          breakdown.subtotal += Number(pkg.price)
        }
      })
    }

    // Options individuelles
    if (options.individualOptions) {
      Object.values(options.individualOptions).forEach((opt: any) => {
        if (opt.selected && opt.price > 0) {
          breakdown.options.push({
            category: 'Option',
            name: opt.name,
            price: Number(opt.price),
          })
          breakdown.subtotal += Number(opt.price)
        }
      })
    }

    // Calculer les taxes (TVA 19% en Algérie)
    const taxRate = 0.19
    const taxAmount = breakdown.subtotal * taxRate
    breakdown.tax = {
      rate: taxRate,
      amount: Math.round(taxAmount * 100) / 100,
    }

    breakdown.total = Math.round((breakdown.subtotal + taxAmount) * 100) / 100

    // Date de validité (30 jours par défaut)
    const defaultValidUntil = new Date()
    defaultValidUntil.setDate(defaultValidUntil.getDate() + 30)

    // Créer le devis
    const quoteTerms = generateQuoteTerms()

    // Validate required fields
    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required to create a quote' },
        { status: 400 }
      )
    }

    if (!teamId) {
      return NextResponse.json(
        { error: 'teamId is required to create a quote' },
        { status: 400 }
      )
    }

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        customerId,
        teamId,
        vehicleId: null, // Optional vehicle reference
        status: 'DRAFT',
        subtotal: breakdown.subtotal,
        taxAmount: breakdown.tax.amount,
        discountAmount: 0,
        total: breakdown.total,
        validUntil: validUntil ? new Date(validUntil) : defaultValidUntil,
        terms: JSON.stringify(quoteTerms),
        notes,
        createdById: user.id,
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
          configurationId: configId,
          customerId,
          totalAmount: breakdown.total,
        },
      },
    })

    // Construire la réponse détaillée
    const quoteDetails = {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      createdAt: quote.createdAt,
      validUntil: quote.validUntil,
      status: quote.status,
      customer: customer
        ? {
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
          }
        : null,
      vehicle: {
        brand: brand.name,
        model: model.name,
        configuration: configuration.name,
        trim: configuration.trim,
        fuelType: model.fuelType,
        transmission: model.transmission,
      },
      pricing: breakdown,
      terms: quoteTerms,
      notes: quote.notes,
      availability: configuration.availability,
      deliveryTime: configuration.deliveryTime,
    }

    return NextResponse.json({
      success: true,
      quote: quoteDetails,
      message: 'Quote generated successfully',
    })
  } catch (error) {
    console.error('Error generating quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Générer les conditions générales du devis
function generateQuoteTerms(): string[] {
  return [
    'Ce devis est valable pour la durée indiquée',
    'Les prix sont exprimés en Dinars Algériens (DZD) TTC',
    'La TVA au taux en vigueur (19%) est incluse',
    'Un acompte de 30% est requis à la commande',
    'Le solde est payable à la livraison',
    'Les délais de livraison sont donnés à titre indicatif',
    'Les caractéristiques techniques peuvent être modifiées sans préavis',
    'Garantie constructeur selon les conditions en vigueur',
    'Immatriculation et frais administratifs non inclus',
    'Assurance non incluse',
  ]
}
