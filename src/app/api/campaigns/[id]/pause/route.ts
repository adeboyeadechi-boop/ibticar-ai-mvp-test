// API Route pour mettre en pause une campagne
// POST /api/campaigns/[id]/pause - Met en pause une campagne en cours

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/campaigns/[id]/pause - Mettre en pause
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: campaignId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent mettre en pause
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

    // Vérifier que la campagne est en cours
    if (campaign.status !== 'RUNNING') {
      return NextResponse.json(
        { error: 'Only running campaigns can be paused' },
        { status: 400 }
      )
    }

    // Mettre en pause
    const updatedCampaign = await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'PAUSED',
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
          action: 'paused',
          previousStatus: 'RUNNING',
          newStatus: 'PAUSED',
        },
      },
    })

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      message: 'Campaign paused successfully',
    })
  } catch (error) {
    console.error('Error pausing campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
