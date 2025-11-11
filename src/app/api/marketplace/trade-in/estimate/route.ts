// API Route pour estimation de reprise (PRD-03-US-007)
// POST /api/marketplace/trade-in/estimate - Calculer une estimation de reprise

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { VehicleCondition } from '@/generated/prisma'

// Fonction pour calculer l'estimation basée sur plusieurs facteurs
function calculateTradeInValue(
  basePrice: number,
  year: number,
  mileage: number,
  condition: VehicleCondition
): number {
  const currentYear = new Date().getFullYear()
  const vehicleAge = currentYear - year

  // Dépréciation par année (10% par an en moyenne)
  const yearDepreciation = Math.min(vehicleAge * 0.1, 0.7) // Max 70% de dépréciation

  // Dépréciation par kilométrage
  // Algérie: ~15,000 km/an en moyenne
  const expectedMileage = vehicleAge * 15000
  const excessMileage = Math.max(0, mileage - expectedMileage)
  const mileageDepreciation = (excessMileage / 100000) * 0.1 // 10% par 100,000 km excédentaires

  // Facteur de condition
  const conditionFactors: Record<VehicleCondition, number> = {
    NEW: 1.0,
    USED_EXCELLENT: 0.95,
    USED_GOOD: 0.85,
    USED_FAIR: 0.70,
  }

  const conditionFactor = conditionFactors[condition] || 0.75

  // Calcul final
  let estimatedValue = basePrice * (1 - yearDepreciation) * (1 - mileageDepreciation) * conditionFactor

  // Valeur minimale: 10% du prix de base
  estimatedValue = Math.max(estimatedValue, basePrice * 0.1)

  return Math.round(estimatedValue)
}

// POST /api/marketplace/trade-in/estimate - Créer une estimation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      brandName,
      modelName,
      vehicleModelId, // Optionnel si le modèle existe dans notre base
      year,
      mileage,
      condition,
      color,
      hasAccidents,
      hasServiceHistory,
      modifications,
      notes,
    } = body

    // Validation des champs requis
    if (!email || !year || !mileage || !condition) {
      return NextResponse.json(
        { error: 'Missing required fields: email, year, mileage, condition' },
        { status: 400 }
      )
    }

    if (!vehicleModelId && (!brandName || !modelName)) {
      return NextResponse.json(
        { error: 'Either vehicleModelId or both brandName and modelName are required' },
        { status: 400 }
      )
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validation de l'année
    const currentYear = new Date().getFullYear()
    if (year < 1980 || year > currentYear + 1) {
      return NextResponse.json(
        { error: `Year must be between 1980 and ${currentYear + 1}` },
        { status: 400 }
      )
    }

    // Validation du kilométrage
    if (mileage < 0 || mileage > 1000000) {
      return NextResponse.json(
        { error: 'Mileage must be between 0 and 1,000,000 km' },
        { status: 400 }
      )
    }

    // Validation de la condition
    const validConditions: VehicleCondition[] = ['NEW', 'USED_EXCELLENT', 'USED_GOOD', 'USED_FAIR']
    if (!validConditions.includes(condition)) {
      return NextResponse.json({ error: 'Invalid condition' }, { status: 400 })
    }

    // Trouver ou créer le client
    let customer = await prisma.customer.findUnique({
      where: { email },
    })

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          type: 'INDIVIDUAL',
          firstName: 'Guest',
          lastName: 'User',
          email,
          phone: '0000000000',
          status: 'PROSPECT',
          source: 'MARKETPLACE',
        },
      })
    }

    // Rechercher le modèle dans la base
    let vehicleModel = null
    let basePrice = 0

    if (vehicleModelId) {
      vehicleModel = await prisma.vehicleModel.findUnique({
        where: { id: vehicleModelId },
        include: {
          brand: {
            select: {
              name: true,
            },
          },
        },
      })

      if (!vehicleModel) {
        return NextResponse.json({ error: 'Vehicle model not found' }, { status: 404 })
      }

      // Essayer de trouver un véhicule similaire pour le prix de base
      const similarVehicle = await prisma.vehicle.findFirst({
        where: {
          vehicleModelId: vehicleModelId,
          year: { gte: year - 2, lte: year + 2 },
          condition: 'NEW',
        },
        orderBy: {
          purchasePrice: 'desc',
        },
      })

      if (similarVehicle) {
        basePrice = Number(similarVehicle.purchasePrice)
      }
    } else {
      // Rechercher par nom de marque et modèle
      vehicleModel = await prisma.vehicleModel.findFirst({
        where: {
          name: {
            contains: modelName,
            mode: 'insensitive',
          },
          brand: {
            name: {
              contains: brandName,
              mode: 'insensitive',
            },
          },
        },
        include: {
          brand: {
            select: {
              name: true,
            },
          },
        },
      })
    }

    // Si pas de prix de base trouvé, utiliser une estimation générique
    if (basePrice === 0) {
      // Prix moyen en Algérie selon l'année (estimation simplifiée)
      const yearsPassed = currentYear - year
      basePrice = 2000000 - yearsPassed * 150000 // Prix de base décroissant
      basePrice = Math.max(basePrice, 500000) // Minimum 500k DZD
    }

    // Calculer l'estimation
    let estimatedValue = calculateTradeInValue(basePrice, year, mileage, condition)

    // Ajustements additionnels
    if (hasAccidents === true) {
      estimatedValue *= 0.85 // -15% si accidents
    }

    if (hasServiceHistory === true) {
      estimatedValue *= 1.05 // +5% si historique d'entretien
    }

    if (modifications) {
      // Les modifications peuvent diminuer la valeur (-5%)
      estimatedValue *= 0.95
    }

    // Arrondir au millier
    estimatedValue = Math.round(estimatedValue / 1000) * 1000

    // Fourchette d'estimation (±10%)
    const minValue = Math.round(estimatedValue * 0.9)
    const maxValue = Math.round(estimatedValue * 1.1)

    // Validité de l'estimation: 30 jours
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 30)

    // Construire les notes d'estimation
    const estimationNotes = []
    if (hasAccidents) estimationNotes.push('Véhicule accidenté détecté')
    if (hasServiceHistory) estimationNotes.push('Historique d\'entretien complet')
    if (modifications) estimationNotes.push('Modifications détectées')
    if (mileage > (currentYear - year) * 15000) {
      estimationNotes.push('Kilométrage élevé par rapport à l\'âge')
    }
    if (notes) estimationNotes.push(notes)

    // Sauvegarder l'estimation seulement si un modèle correspondant est trouvé
    if (!vehicleModel) {
      return NextResponse.json(
        {
          error: 'Modèle de véhicule non trouvé',
          message: `Impossible de trouver le modèle ${brandName} ${modelName} dans notre base de données`,
        },
        { status: 404 }
      )
    }

    const estimate = await prisma.tradeInEstimate.create({
      data: {
        customerId: customer.id,
        vehicleModelId: vehicleModel.id,
        year,
        mileage,
        condition,
        estimatedValue,
        validUntil,
        status: 'PENDING',
        notes: estimationNotes.join('; '),
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Trade-in estimate calculated successfully',
        estimate: {
          id: estimate.id,
          vehicle: {
            brand: vehicleModel?.brand.name || brandName,
            model: vehicleModel?.name || modelName,
            year,
            mileage,
            condition,
            color,
          },
          valuation: {
            estimatedValue,
            minValue,
            maxValue,
            currency: 'DZD',
            validUntil,
          },
          factors: {
            hasAccidents,
            hasServiceHistory,
            modifications: !!modifications,
            notes: estimationNotes,
          },
          status: estimate.status,
          disclaimer:
            'Cette estimation est indicative et peut varier selon l\'inspection physique du véhicule. Valable 30 jours.',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error calculating trade-in estimate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
