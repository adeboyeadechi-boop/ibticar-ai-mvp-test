// API Routes pour la gestion des sessions utilisateur
// GET /api/users/[id]/sessions - Liste toutes les sessions actives
// DELETE /api/users/[id]/sessions - Révoque toutes les sessions (sauf courante)

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { extractBearerToken } from '@/lib/jwt'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/users/[id]/sessions - Liste les sessions actives d'un utilisateur
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: userId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier permissions (l'utilisateur peut voir ses propres sessions, ou ADMIN peut tout voir)
    if (user.id !== userId && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer toutes les sessions actives (non expirées)
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(), // Sessions non expirées
        },
      },
      select: {
        id: true,
        token: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Identifier la session courante
    const authHeader = request.headers.get('authorization')
    const currentToken = extractBearerToken(authHeader)

    const sessionsWithCurrent = sessions.map((session) => ({
      ...session,
      isCurrent: session.token === currentToken,
      // Masquer le token pour sécurité (sauf 8 derniers caractères)
      token: session.token.slice(-8),
    }))

    return NextResponse.json({
      userId,
      totalSessions: sessions.length,
      sessions: sessionsWithCurrent,
    })
  } catch (error) {
    console.error('Error fetching user sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id]/sessions - Révoque toutes les sessions (sauf courante)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: userId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier permissions
    if (user.id !== userId && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer le token de la session courante
    const authHeader = request.headers.get('authorization')
    const currentToken = extractBearerToken(authHeader)

    // Récupérer les paramètres query
    const searchParams = request.nextUrl.searchParams
    const revokeAll = searchParams.get('all') === 'true' // Inclure session courante

    // Construire la condition de suppression
    const where: any = { userId }

    if (!revokeAll && currentToken) {
      // Ne pas révoquer la session courante
      where.token = {
        not: currentToken,
      }
    }

    // Supprimer les sessions
    const result = await prisma.session.deleteMany({
      where,
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'Session',
        entityId: userId,
        changes: {
          revokedSessions: result.count,
          revokeAll,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `${result.count} session(s) revoked successfully`,
      revokedCount: result.count,
    })
  } catch (error) {
    console.error('Error revoking user sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
