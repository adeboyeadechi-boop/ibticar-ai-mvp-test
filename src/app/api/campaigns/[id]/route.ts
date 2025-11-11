// API Routes pour gestion individuelle des campagnes
// GET /api/campaigns/[id] - Détails d'une campagne
// PUT /api/campaigns/[id] - Modifier une campagne
// DELETE /api/campaigns/[id] - Supprimer une campagne

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { CampaignType, CommunicationChannel } from '@/generated/prisma'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/campaigns/[id] - Détails de la campagne
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: campaignId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer la campagne avec statistiques
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Compter les destinataires
    const recipientsStats = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    })

    const recipients = recipientsStats.map((stat) => ({
      status: stat.status,
      count: stat._count,
    }))

    return NextResponse.json({
      campaign,
      recipients,
    })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/campaigns/[id] - Modifier la campagne
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: campaignId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent modifier
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const { name, type, channel, startDate, endDate, targetAudience, message, budget } = body

    // Vérifier que la campagne existe
    const existingCampaign = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
    })

    if (!existingCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Ne peut pas modifier une campagne en cours ou terminée
    if (['RUNNING', 'COMPLETED'].includes(existingCampaign.status)) {
      return NextResponse.json(
        { error: 'Cannot modify running or completed campaigns' },
        { status: 400 }
      )
    }

    // Construire les données de mise à jour
    const updateData: any = {}
    if (name) updateData.name = name
    if (type) updateData.type = type as CampaignType
    if (channel) updateData.channel = channel as CommunicationChannel
    if (startDate) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience
    if (message) updateData.message = message
    if (budget !== undefined) updateData.budget = budget ? Number(budget) : null

    // Mettre à jour la campagne
    const campaign = await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: updateData,
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'MarketingCampaign',
        entityId: campaignId,
        changes: updateData,
      },
    })

    return NextResponse.json({
      success: true,
      campaign,
      message: 'Campaign updated successfully',
    })
  } catch (error) {
    console.error('Error updating campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id] - Supprimer la campagne
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: campaignId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent supprimer
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que la campagne existe
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Ne peut pas supprimer une campagne en cours
    if (campaign.status === 'RUNNING') {
      return NextResponse.json(
        { error: 'Cannot delete a running campaign. Pause or cancel it first.' },
        { status: 400 }
      )
    }

    // Supprimer la campagne
    await prisma.marketingCampaign.delete({
      where: { id: campaignId },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'MarketingCampaign',
        entityId: campaignId,
        changes: {
          deletedCampaign: {
            name: campaign.name,
            type: campaign.type,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
