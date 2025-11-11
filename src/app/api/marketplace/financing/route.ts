// API Route pour gérer les simulations de financement sauvegardées (PRD-03-US-008)
// GET /api/marketplace/financing - Liste des simulations sauvegardées

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// GET /api/marketplace/financing - Récupérer les simulations d'un utilisateur
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({
        simulations: [],
        message: 'Email required to fetch saved simulations',
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
        simulations: [],
        message: 'No customer found with this email',
      })
    }

    // Récupérer les simulations
    const simulations = await prisma.financingSimulation.findMany({
      where: { customerId: customer.id },
      include: {
        vehicle: {
          select: {
            id: true,
            year: true,
            color: true,
            sellingPrice: true,
            status: true,
            availableForSale: true,
            model: {
              select: {
                name: true,
                brand: {
                  select: {
                    name: true,
                    logoUrl: true,
                  },
                },
              },
            },
            media: {
              where: {
                isPrimary: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Formater la réponse
    const formattedSimulations = simulations.map((sim) => ({
      id: sim.id,
      vehicle: {
        id: sim.vehicle.id,
        brand: sim.vehicle.model.brand.name,
        brandLogo: sim.vehicle.model.brand.logoUrl,
        model: sim.vehicle.model.name,
        year: sim.vehicle.year,
        color: sim.vehicle.color,
        price: Number(sim.vehiclePrice),
        image: sim.vehicle.media[0]?.url || null,
        isAvailable:
          sim.vehicle.status === 'AVAILABLE' && sim.vehicle.availableForSale,
      },
      financing: {
        vehiclePrice: Number(sim.vehiclePrice),
        downPayment: Number(sim.downPayment),
        downPaymentPercent:
          (Number(sim.downPayment) / Number(sim.vehiclePrice)) * 100,
        loanAmount: Number(sim.loanAmount),
        interestRate: Number(sim.interestRate),
        term: sim.term,
        termYears: sim.term / 12,
        monthlyPayment: Number(sim.monthlyPayment),
        totalPayment: Number(sim.totalPayment),
        totalInterest: Number(sim.totalPayment) - Number(sim.loanAmount),
      },
      status: sim.status,
      createdAt: sim.createdAt,
    }))

    return NextResponse.json({
      simulations: formattedSimulations,
      total: formattedSimulations.length,
    })
  } catch (error) {
    console.error('Error fetching financing simulations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
