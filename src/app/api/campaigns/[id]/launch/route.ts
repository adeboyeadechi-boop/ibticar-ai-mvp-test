// API Route pour lancer une campagne
// POST /api/campaigns/[id]/launch - Lance une campagne programmée

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/campaigns/[id]/launch - Lancer la campagne
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: campaignId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent lancer des campagnes
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que la campagne existe
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Vérifier que la campagne peut être lancée
    if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Only draft, scheduled, or paused campaigns can be launched' },
        { status: 400 }
      )
    }

    // Vérifier que la date de début est valide
    const now = new Date()
    if (campaign.startDate > now) {
      // Si la date de début est dans le futur, programmer la campagne
      const updatedCampaign = await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'SCHEDULED',
        },
      })

      return NextResponse.json({
        success: true,
        campaign: updatedCampaign,
        message: `Campaign scheduled to start on ${campaign.startDate.toISOString()}`,
      })
    }

    // Sinon, lancer immédiatement
    // 1. Construire la liste des destinataires basée sur targetAudience
    const targetAudience = campaign.targetAudience as any

    // Filtres de ciblage
    const customerFilters: any = {}
    if (targetAudience?.status) {
      customerFilters.status = targetAudience.status
    }
    if (targetAudience?.city) {
      customerFilters.city = targetAudience.city
    }
    if (targetAudience?.wilaya) {
      customerFilters.wilaya = targetAudience.wilaya
    }

    // Récupérer les clients ciblés
    const targetedCustomers = await prisma.customer.findMany({
      where: customerFilters,
      select: {
        id: true,
      },
      take: 10000, // Limiter pour éviter les surcharges
    })

    if (targetedCustomers.length === 0) {
      return NextResponse.json(
        { error: 'No customers match the target audience criteria' },
        { status: 400 }
      )
    }

    // 2. Créer les destinataires de campagne
    const recipients = await Promise.all(
      targetedCustomers.map((customer) =>
        prisma.campaignRecipient.create({
          data: {
            campaignId,
            customerId: customer.id,
            status: 'PENDING',
          },
        })
      )
    )

    // 3. Mettre à jour le statut de la campagne
    const updatedCampaign = await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'RUNNING',
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'MarketingCampaign',
        entityId: campaignId,
        changes: {
          action: 'launched',
          previousStatus: campaign.status,
          newStatus: 'RUNNING',
          recipientsAdded: recipients.length,
        },
      },
    })

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      recipientsAdded: recipients.length,
      message: 'Campaign launched successfully',
    })
  } catch (error) {
    console.error('Error launching campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
