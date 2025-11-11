// API Route pour révoquer une session spécifique
// DELETE /api/users/[id]/sessions/[sessionId] - Révoque une session

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string; sessionId: string }>
}

// DELETE /api/users/[id]/sessions/[sessionId] - Révoque une session spécifique
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: userId, sessionId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier permissions
    if (user.id !== userId && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que la session existe et appartient à l'utilisateur
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        ipAddress: true,
        createdAt: true,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (session.userId !== userId) {
      return NextResponse.json(
        { error: 'Session does not belong to this user' },
        { status: 400 }
      )
    }

    // Supprimer la session
    await prisma.session.delete({
      where: { id: sessionId },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'Session',
        entityId: sessionId,
        changes: {
          sessionId,
          targetUserId: userId,
          ipAddress: session.ipAddress,
          createdAt: session.createdAt,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
      sessionId,
    })
  } catch (error) {
    console.error('Error revoking session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
