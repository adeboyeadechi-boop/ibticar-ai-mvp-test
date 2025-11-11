// API Route pour annuler une campagne
// POST /api/campaigns/[id]/cancel - Annule une campagne

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/campaigns/[id]/cancel - Annuler la campagne
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: campaignId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent annuler
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

    // Vérifier que la campagne peut être annulée
    if (['COMPLETED', 'CANCELLED'].includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Cannot cancel a completed or already cancelled campaign' },
        { status: 400 }
      )
    }

    // Annuler la campagne
    const updatedCampaign = await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'CANCELLED',
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
          action: 'cancelled',
          previousStatus: campaign.status,
          newStatus: 'CANCELLED',
        },
      },
    })

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      message: 'Campaign cancelled successfully',
    })
  } catch (error) {
    console.error('Error cancelling campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
