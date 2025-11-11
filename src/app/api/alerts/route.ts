// API Routes pour la gestion des alertes stock
// POST /api/alerts - Créer une alerte
// GET /api/alerts - Liste des alertes

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { AlertType, AlertFrequency } from '@/generated/prisma'

// POST /api/alerts - Créer une nouvelle alerte
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent créer des alertes
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const { type, name, conditions, actions } = body

    // Validation
    if (!type || !name || !conditions || !actions) {
      return NextResponse.json(
        { error: 'Missing required fields: type, name, conditions, actions' },
        { status: 400 }
      )
    }

    // Valider le type d'alerte
    const validTypes: AlertType[] = [
      'STOCK_LEVEL',
      'PRICE_CHANGE',
      'DOCUMENT_EXPIRY',
      'PAYMENT_DUE',
      'CUSTOM',
    ]

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid alert type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Créer l'alerte
    const alert = await prisma.alert.create({
      data: {
        userId: user.id,
        type: type as AlertType,
        name,
        conditions,
        actions,
        isActive: true,
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Alert',
        entityId: alert.id,
        changes: { created: alert },
      },
    })

    return NextResponse.json({
      success: true,
      alert,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating alert:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/alerts - Liste des alertes avec filtres
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Paramètres de filtrage
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as AlertType | null
    const isActive = searchParams.get('isActive')
    const userId = searchParams.get('userId')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    // Filtrer par utilisateur (admins peuvent voir tout, autres voient leurs alertes)
    if (['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      if (userId) where.userId = userId
    } else {
      where.userId = user.id
    }

    if (type) where.type = type
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    // Compter le total
    const total = await prisma.alert.count({ where })

    // Récupérer les alertes
    const alerts = await prisma.alert.findMany({
      where,
      select: {
        id: true,
        userId: true,
        type: true,
        name: true,
        conditions: true,
        actions: true,
        isActive: true,
        lastTriggeredAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    return NextResponse.json({
      alerts,
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
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
