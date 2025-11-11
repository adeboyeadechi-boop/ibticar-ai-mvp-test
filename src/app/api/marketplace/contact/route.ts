// API Route pour contacter un vendeur depuis le marketplace (PRD-03-US-005)
// POST /api/marketplace/contact - Formulaire de contact public

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { CustomerType, LeadSource } from '@/generated/prisma'

// POST /api/marketplace/contact - Soumettre une demande de contact (PUBLIC)
export async function POST(request: NextRequest) {
  try {
    // PAS D'AUTHENTIFICATION REQUISE - endpoint public

    // Récupérer les données du formulaire
    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      message,
      vehicleId,
      budget,
      timeline,
      companyName, // Optionnel pour entreprises
    } = body

    // Validation des champs requis
    if (!firstName || !lastName || !email || !phone) {
      return NextResponse.json(
        {
          error: 'Missing required fields: firstName, lastName, email, phone',
        },
        { status: 400 }
      )
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validation du format téléphone (Algérie: +213, 0, etc.)
    const phoneRegex = /^(\+213|0)[1-9]\d{8}$/
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return NextResponse.json(
        {
          error: 'Invalid phone format. Expected Algerian format: +213XXXXXXXXX or 0XXXXXXXXX',
        },
        { status: 400 }
      )
    }

    // Vérifier que le véhicule existe et est disponible (si fourni)
    let vehicle = null
    let dealerTeamId = null
    let assignedUserId = null

    if (vehicleId) {
      vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      if (!vehicle) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
      }

      // Vérifier que le véhicule est disponible à la vente
      if (
        vehicle.status !== 'AVAILABLE' ||
        !vehicle.availableForSale ||
        !vehicle.publishedAt
      ) {
        return NextResponse.json(
          { error: 'Vehicle is not available for sale' },
          { status: 400 }
        )
      }

      dealerTeamId = vehicle.teamId

      // Trouver un utilisateur SALES ou MANAGER pour assigner le lead
      // TODO: Filter by team once User-Team relation is added to schema
      const teamUser = await prisma.user.findFirst({
        where: {
          role: { in: ['SALES', 'MANAGER', 'ADMIN'] },
          isActive: true,
        },
        orderBy: {
          role: 'desc', // Prioriser ADMIN > MANAGER > SALES
        },
      })

      assignedUserId = teamUser?.id
    }

    // Si pas de véhicule ou pas d'utilisateur trouvé, assigner à un admin système
    if (!assignedUserId) {
      const systemAdmin = await prisma.user.findFirst({
        where: {
          role: { in: ['SUPER_ADMIN', 'ADMIN'] },
        },
      })

      if (!systemAdmin) {
        return NextResponse.json(
          { error: 'No available user to assign lead' },
          { status: 500 }
        )
      }

      assignedUserId = systemAdmin.id
    }

    // Rechercher ou créer le client
    let customer = await prisma.customer.findUnique({
      where: { email },
    })

    if (!customer) {
      // Créer un nouveau client prospect
      customer = await prisma.customer.create({
        data: {
          type: companyName ? CustomerType.BUSINESS : CustomerType.INDIVIDUAL,
          firstName,
          lastName,
          email,
          phone,
          companyName: companyName || null,
          status: 'PROSPECT',
          source: 'MARKETPLACE',
        },
      })
    } else {
      // Mettre à jour les informations si elles ont changé
      const updateData: any = {}
      if (customer.firstName !== firstName) updateData.firstName = firstName
      if (customer.lastName !== lastName) updateData.lastName = lastName
      if (customer.phone !== phone) updateData.phone = phone
      if (companyName && customer.companyName !== companyName) {
        updateData.companyName = companyName
        updateData.type = CustomerType.BUSINESS
      }

      if (Object.keys(updateData).length > 0) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: updateData,
        })
      }
    }

    // Vérifier si un lead similaire existe déjà (même client + même véhicule + moins de 7 jours)
    if (vehicleId) {
      const existingLead = await prisma.lead.findFirst({
        where: {
          customerId: customer.id,
          interestedVehicleId: vehicleId,
          status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 jours
          },
        },
      })

      if (existingLead) {
        // Mettre à jour le lead existant avec le nouveau message
        const updatedLead = await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            notes: existingLead.notes
              ? `${existingLead.notes}\n\n[${new Date().toISOString()}] ${message}`
              : message,
            lastContactDate: new Date(),
            budget: budget ? parseFloat(budget) : existingLead.budget,
            timeline: timeline || existingLead.timeline,
          },
        })

        return NextResponse.json({
          success: true,
          message: 'Your contact request has been updated',
          leadId: updatedLead.id,
          customerId: customer.id,
          isNew: false,
        })
      }
    }

    // Créer un nouveau lead
    const newLead = await prisma.lead.create({
      data: {
        customerId: customer.id,
        assignedToId: assignedUserId,
        source: LeadSource.WEBSITE,
        status: 'NEW',
        interestedVehicleId: vehicleId || null,
        budget: budget ? parseFloat(budget) : null,
        timeline: timeline || null,
        notes: message || 'Contact depuis marketplace',
        lastContactDate: new Date(),
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
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        interestedVehicle: {
          select: {
            id: true,
            year: true,
            color: true,
            sellingPrice: true,
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
      },
    })

    // TODO: Envoyer notification email au vendeur assigné
    console.log('New marketplace lead created:', {
      leadId: newLead.id,
      customerId: customer.id,
      assignedToId: assignedUserId,
      vehicleId: vehicleId || 'none',
      source: 'WEBSITE',
    })

    // TODO: Envoyer email de confirmation au client
    console.log('Sending confirmation email to customer:', {
      email: customer.email,
      firstName: customer.firstName,
      vehicleId: vehicleId || 'none',
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Your contact request has been sent successfully',
        leadId: newLead.id,
        customerId: customer.id,
        contactInfo: {
          dealerName: vehicle?.team?.name || 'Ibticar.AI',
          expectedResponseTime: '24-48 heures',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error processing marketplace contact:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
