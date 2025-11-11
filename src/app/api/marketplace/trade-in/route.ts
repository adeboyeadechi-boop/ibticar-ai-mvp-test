// API Route pour gérer les estimations de reprise (PRD-03-US-007)
// GET /api/marketplace/trade-in - Liste des estimations

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// GET /api/marketplace/trade-in - Récupérer les estimations
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({
        estimates: [],
        message: 'Email required to fetch estimates',
      })
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Trouver le client
    const customer = await prisma.customer.findUnique({
      where: { email },
    })

    if (!customer) {
      return NextResponse.json({
        estimates: [],
        message: 'No customer found with this email',
      })
    }

    // Récupérer les estimations
    const estimates = await prisma.tradeInEstimate.findMany({
      where: { customerId: customer.id },
      include: {
        vehicleModel: {
          select: {
            id: true,
            name: true,
            brand: {
              select: {
                name: true,
                logoUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Formater la réponse
    const formattedEstimates = estimates.map((est) => {
      const now = new Date()
      const isExpired = now > est.validUntil

      return {
        id: est.id,
        vehicle: {
          brand: est.vehicleModel?.brand.name || 'Unknown',
          brandLogo: est.vehicleModel?.brand.logoUrl,
          model: est.vehicleModel?.name || 'Unknown',
          year: est.year,
          mileage: est.mileage,
          condition: est.condition,
        },
        estimatedValue: Number(est.estimatedValue),
        minValue: Math.round(Number(est.estimatedValue) * 0.9),
        maxValue: Math.round(Number(est.estimatedValue) * 1.1),
        validUntil: est.validUntil,
        isExpired,
        status: isExpired ? 'EXPIRED' : est.status,
        notes: est.notes,
        createdAt: est.createdAt,
      }
    })

    return NextResponse.json({
      estimates: formattedEstimates,
      total: formattedEstimates.length,
    })
  } catch (error) {
    console.error('Error fetching trade-in estimates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
