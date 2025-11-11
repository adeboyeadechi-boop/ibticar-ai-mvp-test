// API Route pour simulation de financement (PRD-03-US-008)
// POST /api/marketplace/financing/simulate - Calculer une simulation de financement

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// Fonction pour calculer le paiement mensuel
// Formule: P * [r(1+r)^n] / [(1+r)^n - 1]
function calculateMonthlyPayment(
  loanAmount: number,
  annualInterestRate: number,
  termMonths: number
): number {
  if (annualInterestRate === 0) {
    // Si taux d'intérêt = 0, paiement mensuel simple
    return loanAmount / termMonths
  }

  const monthlyRate = annualInterestRate / 100 / 12
  const numerator = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1

  return numerator / denominator
}

// POST /api/marketplace/financing/simulate - Créer une simulation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      vehicleId,
      downPaymentPercent, // Pourcentage d'apport (ex: 20 pour 20%)
      downPaymentAmount, // Montant d'apport (alternative au pourcentage)
      term, // Durée en mois
      interestRate, // Taux d'intérêt annuel (ex: 5.5 pour 5.5%)
      email, // Optionnel pour sauvegarder
      save, // Boolean pour indiquer si on sauvegarde
    } = body

    // Validation
    if (!vehicleId || !term) {
      return NextResponse.json(
        { error: 'Missing required fields: vehicleId, term' },
        { status: 400 }
      )
    }

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        sellingPrice: true,
        status: true,
        availableForSale: true,
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
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const vehiclePrice = Number(vehicle.sellingPrice)

    // Calculer l'apport initial
    let downPayment: number
    if (downPaymentAmount !== undefined) {
      downPayment = Number(downPaymentAmount)
    } else if (downPaymentPercent !== undefined) {
      downPayment = (vehiclePrice * Number(downPaymentPercent)) / 100
    } else {
      // Par défaut, 20% d'apport
      downPayment = vehiclePrice * 0.2
    }

    // Validation du montant d'apport
    if (downPayment < 0 || downPayment > vehiclePrice) {
      return NextResponse.json(
        { error: 'Invalid down payment amount' },
        { status: 400 }
      )
    }

    // Calculer le montant du prêt
    const loanAmount = vehiclePrice - downPayment

    if (loanAmount <= 0) {
      return NextResponse.json(
        { error: 'Loan amount must be positive. Adjust down payment.' },
        { status: 400 }
      )
    }

    // Validation de la durée (entre 12 et 84 mois - 1 à 7 ans)
    if (term < 12 || term > 84) {
      return NextResponse.json(
        { error: 'Loan term must be between 12 and 84 months' },
        { status: 400 }
      )
    }

    // Taux d'intérêt par défaut si non fourni (5.5% en Algérie)
    const effectiveInterestRate =
      interestRate !== undefined ? Number(interestRate) : 5.5

    // Validation du taux d'intérêt (entre 0 et 25%)
    if (effectiveInterestRate < 0 || effectiveInterestRate > 25) {
      return NextResponse.json(
        { error: 'Interest rate must be between 0 and 25%' },
        { status: 400 }
      )
    }

    // Calculer le paiement mensuel
    const monthlyPayment = calculateMonthlyPayment(
      loanAmount,
      effectiveInterestRate,
      term
    )

    // Calculer le montant total à rembourser
    const totalPayment = monthlyPayment * term

    // Calculer le coût total du crédit
    const totalInterest = totalPayment - loanAmount

    // Calculer le TAEG (Taux Annuel Effectif Global) - simplifié
    const taeg = effectiveInterestRate // Dans un vrai système, inclure les frais de dossier, assurance, etc.

    // Générer le tableau d'amortissement (première et dernière année)
    const amortizationSchedule = generateAmortizationSample(
      loanAmount,
      effectiveInterestRate,
      term,
      monthlyPayment
    )

    const simulationResult = {
      vehicle: {
        id: vehicle.id,
        brand: vehicle.model.brand.name,
        model: vehicle.model.name,
        price: vehiclePrice,
      },
      financing: {
        vehiclePrice,
        downPayment,
        downPaymentPercent: (downPayment / vehiclePrice) * 100,
        loanAmount,
        interestRate: effectiveInterestRate,
        taeg,
        term,
        termYears: term / 12,
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        totalPayment: Math.round(totalPayment * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
        totalCost: Math.round((vehiclePrice + totalInterest) * 100) / 100,
      },
      amortizationSchedule,
      calculatedAt: new Date(),
    }

    // Si l'utilisateur veut sauvegarder la simulation
    if (save && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
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

      // Sauvegarder la simulation
      const simulation = await prisma.financingSimulation.create({
        data: {
          customerId: customer.id,
          vehicleId,
          vehiclePrice,
          downPayment,
          loanAmount,
          interestRate: effectiveInterestRate,
          term,
          monthlyPayment,
          totalPayment,
          status: 'DRAFT',
        },
      })

      return NextResponse.json({
        success: true,
        simulation: simulationResult,
        savedSimulationId: simulation.id,
        message: 'Simulation calculated and saved successfully',
      })
    }

    // Retourner seulement les calculs sans sauvegarder
    return NextResponse.json({
      success: true,
      simulation: simulationResult,
      message: 'Simulation calculated successfully',
    })
  } catch (error) {
    console.error('Error calculating financing simulation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Générer un échantillon du tableau d'amortissement (premiers et derniers mois)
function generateAmortizationSample(
  loanAmount: number,
  annualInterestRate: number,
  termMonths: number,
  monthlyPayment: number
) {
  const schedule = []
  const monthlyRate = annualInterestRate / 100 / 12
  let remainingBalance = loanAmount

  // Générer les 3 premiers mois
  for (let month = 1; month <= Math.min(3, termMonths); month++) {
    const interestPayment = remainingBalance * monthlyRate
    const principalPayment = monthlyPayment - interestPayment
    remainingBalance -= principalPayment

    schedule.push({
      month,
      payment: Math.round(monthlyPayment * 100) / 100,
      principal: Math.round(principalPayment * 100) / 100,
      interest: Math.round(interestPayment * 100) / 100,
      balance: Math.round(remainingBalance * 100) / 100,
    })
  }

  // Si plus de 6 mois, ajouter une ellipse et les 3 derniers mois
  if (termMonths > 6) {
    // Recalculer pour les derniers mois
    remainingBalance = loanAmount
    const fullSchedule = []

    for (let month = 1; month <= termMonths; month++) {
      const interestPayment = remainingBalance * monthlyRate
      const principalPayment = monthlyPayment - interestPayment
      remainingBalance -= principalPayment

      fullSchedule.push({
        month,
        payment: Math.round(monthlyPayment * 100) / 100,
        principal: Math.round(principalPayment * 100) / 100,
        interest: Math.round(interestPayment * 100) / 100,
        balance: Math.round(Math.max(0, remainingBalance) * 100) / 100,
      })
    }

    // Ajouter les 3 derniers mois
    schedule.push({ ellipsis: true })
    schedule.push(...fullSchedule.slice(-3))
  }

  return schedule
}
