// API Route pour préparation dossier de financement (PRD-03-US-022)
// POST /api/marketplace/financing/application - Soumettre un dossier de crédit

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// POST /api/marketplace/financing/application - Soumettre une demande de financement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      vehicleId,
      simulationId,
      applicant,
      employment,
      income,
      existingLoans,
      documents,
    } = body

    // Validation des champs requis
    if (!email || !vehicleId || !applicant) {
      return NextResponse.json(
        { error: 'Missing required fields: email, vehicleId, applicant' },
        { status: 400 }
      )
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
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

    // Trouver ou créer le client
    let customer = await prisma.customer.findUnique({
      where: { email },
    })

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          type: applicant.companyName ? 'BUSINESS' : 'INDIVIDUAL',
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          email,
          phone: applicant.phone,
          address: applicant.address || null,
          city: applicant.city || null,
          wilaya: applicant.wilaya || null,
          dateOfBirth: applicant.dateOfBirth ? new Date(applicant.dateOfBirth) : null,
          idType: applicant.idType || null,
          idNumber: applicant.idNumber || null,
          profession: employment?.profession || null,
          companyName: applicant.companyName || null,
          taxId: applicant.taxId || null,
          status: 'PROSPECT',
          source: 'MARKETPLACE',
        },
      })
    }

    // Calculer le score de crédit basique
    const creditScore = calculateCreditScore(applicant, employment, income, existingLoans)

    // Déterminer l'éligibilité
    const eligibility = determineCreditEligibility(
      creditScore,
      income,
      existingLoans,
      Number(vehicle.sellingPrice)
    )

    // Créer le lead avec les informations de financement
    const lead = await prisma.lead.create({
      data: {
        customerId: customer.id,
        assignedToId: await getDefaultAdmin(),
        source: 'WEBSITE',
        status: 'NEW',
        interestedVehicleId: vehicleId,
        budget: income?.monthlyIncome ? parseFloat(income.monthlyIncome) * 36 : null, // Budget estimé basé sur 36 mois
        timeline: 'IMMEDIATE',
        notes: `Demande de financement

Informations emploi:
- Profession: ${employment?.profession || 'N/A'}
- Type contrat: ${employment?.contractType || 'N/A'}
- Employeur: ${employment?.employer || 'N/A'}
- Ancienneté: ${employment?.yearsInJob || 'N/A'} ans

Revenus:
- Revenu mensuel: ${income?.monthlyIncome ? Number(income.monthlyIncome).toLocaleString('fr-DZ') : 'N/A'} DZD
- Autres revenus: ${income?.otherIncome ? Number(income.otherIncome).toLocaleString('fr-DZ') : 0} DZD

Crédit existants:
- ${existingLoans?.hasExistingLoans ? 'Oui' : 'Non'}
- Mensualité totale: ${existingLoans?.totalMonthlyPayment ? Number(existingLoans.totalMonthlyPayment).toLocaleString('fr-DZ') : 0} DZD

Score de crédit: ${creditScore}/100
Éligibilité: ${eligibility.eligible ? 'ÉLIGIBLE' : 'NON ÉLIGIBLE'}`,
      },
    })

    // Créer une simulation si un simulationId est fourni
    let financingSimulation = null
    if (simulationId) {
      financingSimulation = await prisma.financingSimulation.findUnique({
        where: { id: simulationId },
      })
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Financing application submitted successfully',
        application: {
          id: lead.id,
          customerId: customer.id,
          vehicle: {
            id: vehicle.id,
            brand: vehicle.model.brand.name,
            model: vehicle.model.name,
            year: vehicle.year,
            price: Number(vehicle.sellingPrice),
          },
          creditScore,
          eligibility: {
            ...eligibility,
            recommendations: generateRecommendations(eligibility, income, existingLoans, Number(vehicle.sellingPrice)),
          },
          simulation: financingSimulation ? {
            id: financingSimulation.id,
            monthlyPayment: Number(financingSimulation.monthlyPayment),
            term: financingSimulation.term,
          } : null,
          nextSteps: [
            'Notre équipe va étudier votre dossier sous 48h',
            'Préparez les documents requis: pièce d\'identité, bulletin de salaire (3 derniers mois), relevé bancaire',
            eligibility.eligible ? 'Vous serez contacté pour finaliser votre dossier' : 'Un conseiller vous contactera pour discuter des options',
          ],
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error submitting financing application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fonction pour calculer le score de crédit (simplifié)
function calculateCreditScore(applicant: any, employment: any, income: any, existingLoans: any): number {
  let score = 50 // Score de base

  // Emploi stable (+20)
  if (employment?.contractType === 'CDI') score += 20
  else if (employment?.contractType === 'CDD') score += 10

  if (employment?.yearsInJob >= 5) score += 10
  else if (employment?.yearsInJob >= 2) score += 5

  // Revenus suffisants (+20)
  const monthlyIncome = income?.monthlyIncome ? parseFloat(income.monthlyIncome) : 0
  if (monthlyIncome >= 100000) score += 20
  else if (monthlyIncome >= 60000) score += 15
  else if (monthlyIncome >= 40000) score += 10

  // Autres revenus (+5)
  if (income?.otherIncome && parseFloat(income.otherIncome) > 0) score += 5

  // Crédits existants (-10 à -30)
  if (existingLoans?.hasExistingLoans) {
    const totalPayment = existingLoans.totalMonthlyPayment ? parseFloat(existingLoans.totalMonthlyPayment) : 0
    const debtRatio = monthlyIncome > 0 ? (totalPayment / monthlyIncome) * 100 : 100

    if (debtRatio > 50) score -= 30
    else if (debtRatio > 35) score -= 20
    else if (debtRatio > 25) score -= 10
  } else {
    score += 10 // Bonus si pas de crédit existant
  }

  // Documents fournis (+5)
  if (applicant.idNumber) score += 5

  return Math.max(0, Math.min(100, score))
}

// Fonction pour déterminer l'éligibilité
function determineCreditEligibility(score: number, income: any, existingLoans: any, vehiclePrice: number) {
  const monthlyIncome = income?.monthlyIncome ? parseFloat(income.monthlyIncome) : 0
  const totalPayment = existingLoans?.totalMonthlyPayment ? parseFloat(existingLoans.totalMonthlyPayment) : 0

  // Taux d'endettement maximum: 35% (standard algérien)
  const maxDebtRatio = 0.35
  const availableForLoan = monthlyIncome * maxDebtRatio - totalPayment

  // Estimation mensualité (60 mois, 5.5%)
  const estimatedMonthlyPayment = (vehiclePrice * 0.8 * 0.055 / 12) / (1 - Math.pow(1 + 0.055/12, -60))

  const debtRatio = monthlyIncome > 0 ? ((totalPayment + estimatedMonthlyPayment) / monthlyIncome) * 100 : 100

  const eligible = score >= 50 && debtRatio <= 35 && monthlyIncome >= 40000

  return {
    eligible,
    score,
    debtRatio: Math.round(debtRatio * 10) / 10,
    maxLoanAmount: Math.round(availableForLoan * 60), // Sur 60 mois
    estimatedMonthlyPayment: Math.round(estimatedMonthlyPayment),
    reasons: [
      ...(score < 50 ? ['Score de crédit insuffisant'] : []),
      ...(debtRatio > 35 ? [`Taux d'endettement trop élevé (${Math.round(debtRatio)}%)`] : []),
      ...(monthlyIncome < 40000 ? ['Revenu mensuel insuffisant'] : []),
    ],
  }
}

// Fonction pour générer des recommandations
function generateRecommendations(eligibility: any, income: any, existingLoans: any, vehiclePrice: number) {
  const recommendations = []

  if (!eligibility.eligible) {
    if (eligibility.debtRatio > 35) {
      recommendations.push('Réduisez vos crédits existants avant de faire une nouvelle demande')
      recommendations.push(`Augmentez votre apport personnel (minimum 30% recommandé)`)
    }

    if (income?.monthlyIncome && parseFloat(income.monthlyIncome) < 40000) {
      recommendations.push('Considérez un co-emprunteur pour augmenter la capacité de remboursement')
    }

    recommendations.push(`Optez pour un véhicule moins cher (budget recommandé: ${eligibility.maxLoanAmount.toLocaleString('fr-DZ')} DZD)`)
  } else {
    recommendations.push('Votre dossier est éligible!')
    recommendations.push(`Mensualité estimée: ${eligibility.estimatedMonthlyPayment.toLocaleString('fr-DZ')} DZD`)
    recommendations.push('Préparez vos documents pour accélérer le traitement')
  }

  return recommendations
}

// Helper functions
async function getTeamManager(teamId: string): Promise<string> {
  // TODO: Filter by team once User-Team relation is added to schema
  const manager = await prisma.user.findFirst({
    where: {
      role: { in: ['MANAGER', 'ADMIN'] },
      isActive: true,
    },
  })
  return manager?.id || (await getDefaultAdmin())
}

async function getDefaultAdmin(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
  })
  return admin?.id || ''
}
