// Utilitaires d'authentification et d'autorisation

import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { UserRole } from '@/generated/prisma'
import { extractBearerToken, verifyToken } from '@/lib/jwt'

/**
 * Vérifie si l'utilisateur est authentifié (NextAuth session OU Bearer token)
 * Retourne l'utilisateur ou une réponse d'erreur
 */
export async function requireAuth(request?: NextRequest) {
  // Essayer d'abord avec Bearer token (pour API)
  if (request) {
    const authHeader = request.headers.get('authorization')
    const token = extractBearerToken(authHeader)

    if (token) {
      const payload = verifyToken(token)
      if (payload) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
        })

        if (user && user.isActive) {
          return { user, error: null }
        }
      }
    }
  }

  // Fallback sur NextAuth session (pour web)
  const session = await auth()

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user || !user.isActive) {
    return {
      error: NextResponse.json({ error: 'User not found or inactive' }, { status: 401 }),
      user: null,
    }
  }

  return { user, error: null }
}

/**
 * Vérifie si l'utilisateur a un rôle spécifique
 */
export async function requireRole(roles: UserRole | UserRole[], request?: NextRequest) {
  const { user, error } = await requireAuth(request)

  if (error) return { error, user: null }

  const allowedRoles = Array.isArray(roles) ? roles : [roles]

  if (!allowedRoles.includes(user!.role)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      user: null,
    }
  }

  return { user, error: null }
}

/**
 * Vérifie si l'utilisateur a une permission spécifique
 */
export async function requirePermission(permissionCode: string, request?: NextRequest) {
  const { user, error } = await requireAuth(request)

  if (error) return { error, user: null, hasPermission: false }

  // Super Admin a toutes les permissions
  if (user!.role === 'SUPER_ADMIN') {
    return { user, error: null, hasPermission: true }
  }

  // Vérifier les permissions via les rôles
  const userRoles = await prisma.usersOnRoles.findMany({
    where: { userId: user!.id },
    include: {
      roleId: true,
    },
  })

  // TODO: Implémenter la vérification complète des permissions
  // Pour l'instant, on donne accès aux ADMIN
  if (user!.role === 'ADMIN') {
    return { user, error: null, hasPermission: true }
  }

  return {
    error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    user: null,
    hasPermission: false,
  }
}

/**
 * Vérifie si l'utilisateur peut accéder à une ressource
 * (soit il est propriétaire, soit il a le rôle requis)
 */
export async function requireOwnerOrRole(
  ownerId: string,
  roles: UserRole | UserRole[],
  request?: NextRequest
) {
  const { user, error } = await requireAuth(request)

  if (error) return { error, user: null }

  // Vérifier si c'est le propriétaire
  if (user!.id === ownerId) {
    return { user, error: null }
  }

  // Sinon, vérifier le rôle
  const allowedRoles = Array.isArray(roles) ? roles : [roles]

  if (!allowedRoles.includes(user!.role)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      user: null,
    }
  }

  return { user, error: null }
}

/**
 * Helper simplifié pour extraire l'utilisateur authentifié depuis une requête
 * Supporte NextAuth session ET Bearer token JWT
 *
 * Usage dans un endpoint:
 * const { user, error } = await getAuthenticatedUser(request)
 * if (error) return error
 */
export async function getAuthenticatedUser(request: NextRequest) {
  return requireAuth(request)
}

/**
 * Helper pour vérifier l'authentification avec validation de rôles
 *
 * Usage:
 * const { user, error } = await getAuthenticatedUserWithRole(request, ['ADMIN', 'SUPER_ADMIN'])
 * if (error) return error
 */
export async function getAuthenticatedUserWithRole(
  request: NextRequest,
  roles: UserRole | UserRole[]
) {
  return requireRole(roles, request)
}
