// API Route pour obtenir les analytics d'une campagne
// GET /api/campaigns/[id]/analytics - Statistiques détaillées de la campagne

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/campaigns/[id]/analytics - Analytics de la campagne
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: campaignId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier que la campagne existe
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // 1. Statistiques globales de la campagne
    const recipientsStats = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    })

    const statusBreakdown = recipientsStats.reduce((acc: any, stat) => {
      acc[stat.status.toLowerCase()] = stat._count
      return acc
    }, {})

    const totalRecipients = recipientsStats.reduce((sum, stat) => sum + stat._count, 0)

    // 2. Taux de conversion
    const sent = statusBreakdown.sent || 0
    const delivered = statusBreakdown.delivered || 0
    const opened = statusBreakdown.opened || 0
    const clicked = statusBreakdown.clicked || 0
    const converted = statusBreakdown.converted || 0
    const failed = statusBreakdown.failed || 0
    const unsubscribed = statusBreakdown.unsubscribed || 0

    const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0
    const openRate = delivered > 0 ? (opened / delivered) * 100 : 0
    const clickRate = opened > 0 ? (clicked / opened) * 100 : 0
    const conversionRate = clicked > 0 ? (converted / clicked) * 100 : 0
    const unsubscribeRate = sent > 0 ? (unsubscribed / sent) * 100 : 0

    // 3. Évolution temporelle (par jour)
    const dailyAnalytics = await prisma.campaignAnalytics.findMany({
      where: { campaignId },
      orderBy: {
        date: 'asc',
      },
    })

    // 4. Revenus générés (si disponible)
    const totalRevenue = dailyAnalytics.reduce(
      (sum, day) => sum + Number(day.revenue || 0),
      0
    )

    // 5. ROI (si budget défini)
    const roi =
      campaign.budget && Number(campaign.budget) > 0
        ? ((totalRevenue - Number(campaign.budget)) / Number(campaign.budget)) * 100
        : null

    // 6. Top 10 destinataires par engagement (ceux qui ont cliqué/converti)
    const topRecipients = await prisma.campaignRecipient.findMany({
      where: {
        campaignId,
        status: { in: ['CLICKED', 'CONVERTED'] },
      },
      orderBy: {
        convertedAt: 'desc',
      },
      take: 10,
    })

    // 7. Mettre à jour les stats de la campagne
    await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        sent: statusBreakdown.sent || campaign.sent,
        opened: statusBreakdown.opened || campaign.opened,
        clicked: statusBreakdown.clicked || campaign.clicked,
        converted: statusBreakdown.converted || campaign.converted,
      },
    })

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        budget: campaign.budget,
      },
      summary: {
        totalRecipients,
        sent,
        delivered,
        opened,
        clicked,
        converted,
        failed,
        unsubscribed,
      },
      rates: {
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,
        unsubscribeRate: Math.round(unsubscribeRate * 100) / 100,
      },
      financial: {
        budget: campaign.budget ? Number(campaign.budget) : null,
        revenue: Math.round(totalRevenue * 100) / 100,
        roi: roi ? Math.round(roi * 100) / 100 : null,
      },
      statusBreakdown,
      dailyAnalytics: dailyAnalytics.slice(-30), // Last 30 days
      topRecipients,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching campaign analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
