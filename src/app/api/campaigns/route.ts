// API Routes pour gestion des campagnes marketing
// GET /api/campaigns - Liste des campagnes
// POST /api/campaigns - Créer une campagne

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { CampaignType, CampaignStatus, CommunicationChannel } from '@/generated/prisma'

// GET /api/campaigns - Liste des campagnes
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent voir les campagnes
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as CampaignType | null
    const status = searchParams.get('status') as CampaignStatus | null
    const channel = searchParams.get('channel') as CommunicationChannel | null

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status
    if (channel) where.channel = channel

    // Compter le total
    const total = await prisma.marketingCampaign.count({ where })

    // Récupérer les campagnes
    const campaigns = await prisma.marketingCampaign.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/campaigns - Créer une campagne
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent créer des campagnes
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const {
      name,
      type,
      channel,
      startDate,
      endDate,
      targetAudience,
      message,
      budget,
    } = body

    // Valider les paramètres requis
    if (!name || !type || !channel || !startDate || !message) {
      return NextResponse.json(
        { error: 'name, type, channel, startDate, and message are required' },
        { status: 400 }
      )
    }

    // Valider le type de campagne
    const validTypes: CampaignType[] = ['EMAIL', 'SMS', 'SOCIAL', 'MULTI_CHANNEL']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid campaign type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Valider le canal
    const validChannels: CommunicationChannel[] = [
      'EMAIL',
      'SMS',
      'WHATSAPP',
      'PUSH',
      'IN_APP',
      'PHONE',
      'SOCIAL',
    ]
    if (!validChannels.includes(channel)) {
      return NextResponse.json(
        { error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` },
        { status: 400 }
      )
    }

    // Valider les dates
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : null

    if (end && end < start) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // Créer la campagne
    const campaign = await prisma.marketingCampaign.create({
      data: {
        name,
        type: type as CampaignType,
        channel: channel as CommunicationChannel,
        status: 'DRAFT',
        startDate: start,
        endDate: end,
        targetAudience,
        message,
        budget: budget ? Number(budget) : null,
        createdById: user.id,
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'MarketingCampaign',
        entityId: campaign.id,
        changes: {
          name,
          type,
          channel,
          startDate: start,
        },
      },
    })

    return NextResponse.json({
      success: true,
      campaign,
      message: 'Campaign created successfully',
    })
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
