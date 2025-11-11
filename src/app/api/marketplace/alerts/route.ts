// API Route pour les alertes nouveautés marketplace (PRD-03-US-010)
// GET /api/marketplace/alerts - Liste des alertes
// POST /api/marketplace/alerts - Créer une alerte

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { AlertFrequency } from '@/generated/prisma'

// Helper pour obtenir le customerId depuis l'email
async function getCustomerIdFromEmail(email: string): Promise<string | null> {
  const customer = await prisma.customer.findUnique({
    where: { email },
  })
  return customer?.id || null
}

// GET /api/marketplace/alerts - Récupérer les alertes
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({
        alerts: [],
        message: 'Email required to fetch alerts',
      })
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Obtenir le customerId
    const customerId = await getCustomerIdFromEmail(email)

    if (!customerId) {
      return NextResponse.json({
        alerts: [],
        message: 'No customer found with this email',
      })
    }

    // Récupérer les alertes
    const alerts = await prisma.marketplaceAlert.findMany({
      where: { customerId },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      alerts: alerts.map((alert) => ({
        id: alert.id,
        name: alert.name,
        criteria: alert.criteria,
        frequency: alert.frequency,
        isActive: alert.isActive,
        lastSentAt: alert.lastSentAt,
        createdAt: alert.createdAt,
      })),
      total: alerts.length,
    })
  } catch (error) {
    console.error('Error fetching marketplace alerts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/marketplace/alerts - Créer une alerte
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, criteria, frequency } = body

    // Validation des champs requis
    if (!email || !name || !criteria) {
      return NextResponse.json(
        { error: 'Missing required fields: email, name, criteria' },
        { status: 400 }
      )
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validation de la fréquence
    const validFrequencies: AlertFrequency[] = ['INSTANT', 'DAILY', 'WEEKLY']
    const alertFrequency: AlertFrequency =
      frequency && validFrequencies.includes(frequency) ? frequency : 'DAILY'

    // Validation des critères (doit être un objet JSON)
    if (typeof criteria !== 'object' || Array.isArray(criteria)) {
      return NextResponse.json(
        { error: 'Criteria must be a valid object' },
        { status: 400 }
      )
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

    // Limiter à 5 alertes par client
    const existingAlertsCount = await prisma.marketplaceAlert.count({
      where: { customerId: customer.id },
    })

    if (existingAlertsCount >= 5) {
      return NextResponse.json(
        {
          error: 'Maximum 5 alerts per customer. Please delete an existing alert first.',
        },
        { status: 400 }
      )
    }

    // Créer l'alerte
    const alert = await prisma.marketplaceAlert.create({
      data: {
        customerId: customer.id,
        name,
        criteria,
        frequency: alertFrequency,
        isActive: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Alert created successfully',
        alert: {
          id: alert.id,
          name: alert.name,
          criteria: alert.criteria,
          frequency: alert.frequency,
          isActive: alert.isActive,
          createdAt: alert.createdAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating marketplace alert:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
