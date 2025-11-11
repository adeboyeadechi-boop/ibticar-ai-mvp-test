// API Route pour gérer une simulation spécifique (PRD-03-US-008)
// GET /api/marketplace/financing/[id] - Récupérer une simulation
// PATCH /api/marketplace/financing/[id] - Mettre à jour le statut
// DELETE /api/marketplace/financing/[id] - Supprimer une simulation

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { SimulationStatus } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/marketplace/financing/[id] - Récupérer une simulation complète
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    const simulation = await prisma.financingSimulation.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            companyName: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            year: true,
            color: true,
            mileage: true,
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
    })

    if (!simulation) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 })
    }

    // Formater la réponse
    const formattedSimulation = {
      id: simulation.id,
      customer: {
        id: simulation.customer.id,
        name: simulation.customer.companyName ||
          `${simulation.customer.firstName} ${simulation.customer.lastName}`,
        email: simulation.customer.email,
      },
      vehicle: {
        id: simulation.vehicle.id,
        brand: simulation.vehicle.model.brand.name,
        brandLogo: simulation.vehicle.model.brand.logoUrl,
        model: simulation.vehicle.model.name,
        year: simulation.vehicle.year,
        color: simulation.vehicle.color,
        mileage: simulation.vehicle.mileage,
        price: Number(simulation.vehiclePrice),
        image: simulation.vehicle.media[0]?.url || null,
        isAvailable:
          simulation.vehicle.status === 'AVAILABLE' &&
          simulation.vehicle.availableForSale,
      },
      financing: {
        vehiclePrice: Number(simulation.vehiclePrice),
        downPayment: Number(simulation.downPayment),
        downPaymentPercent:
          (Number(simulation.downPayment) / Number(simulation.vehiclePrice)) * 100,
        loanAmount: Number(simulation.loanAmount),
        interestRate: Number(simulation.interestRate),
        term: simulation.term,
        termYears: simulation.term / 12,
        monthlyPayment: Number(simulation.monthlyPayment),
        totalPayment: Number(simulation.totalPayment),
        totalInterest: Number(simulation.totalPayment) - Number(simulation.loanAmount),
        totalCost:
          Number(simulation.vehiclePrice) +
          (Number(simulation.totalPayment) - Number(simulation.loanAmount)),
      },
      status: simulation.status,
      createdAt: simulation.createdAt,
    }

    return NextResponse.json(formattedSimulation)
  } catch (error) {
    console.error('Error fetching simulation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/marketplace/financing/[id] - Mettre à jour le statut
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, email } = body

    // Validation
    if (!status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      )
    }

    // Vérifier que le statut est valide
    if (!Object.values(SimulationStatus).includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Récupérer la simulation
    const simulation = await prisma.financingSimulation.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    })

    if (!simulation) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 })
    }

    // Vérifier que l'email correspond (sécurité basique)
    if (email && simulation.customer.email !== email) {
      return NextResponse.json(
        { error: 'Unauthorized to modify this simulation' },
        { status: 403 }
      )
    }

    // Mettre à jour le statut
    const updatedSimulation = await prisma.financingSimulation.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json({
      success: true,
      message: 'Simulation status updated',
      simulation: {
        id: updatedSimulation.id,
        status: updatedSimulation.status,
      },
    })
  } catch (error) {
    console.error('Error updating simulation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/marketplace/financing/[id] - Supprimer une simulation
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    // Récupérer la simulation
    const simulation = await prisma.financingSimulation.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    })

    if (!simulation) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 })
    }

    // Vérifier que l'email correspond (sécurité basique)
    if (email && simulation.customer.email !== email) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this simulation' },
        { status: 403 }
      )
    }

    // Ne pas supprimer une simulation convertie
    if (simulation.status === 'CONVERTED') {
      return NextResponse.json(
        { error: 'Cannot delete a converted simulation' },
        { status: 400 }
      )
    }

    // Supprimer la simulation
    await prisma.financingSimulation.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Simulation deleted successfully',
      simulationId: id,
    })
  } catch (error) {
    console.error('Error deleting simulation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
