// Refresh Token Management
import prisma from '@/prisma/client'
import { signRefreshToken } from './jwt'
import { randomBytes } from 'crypto'

/**
 * Generate a unique refresh token string
 */
function generateTokenString(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Create a new refresh token for a user
 */
export async function createRefreshToken(userId: string) {
  const tokenString = generateTokenString()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30) // 30 days

  const refreshToken = await prisma.refreshToken.create({
    data: {
      token: tokenString,
      userId,
      expiresAt,
    },
  })

  // Sign JWT with tokenId for validation
  const signedToken = signRefreshToken({
    userId,
    tokenId: refreshToken.id,
  })

  return { id: refreshToken.id, token: signedToken }
}

/**
 * Validate a refresh token (check if exists, not revoked, not expired)
 */
export async function validateRefreshToken(tokenId: string): Promise<{
  valid: boolean
  userId?: string
  error?: string
}> {
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { id: tokenId },
  })

  if (!refreshToken) {
    return { valid: false, error: 'Refresh token not found' }
  }

  if (refreshToken.revokedAt) {
    return { valid: false, error: 'Refresh token has been revoked' }
  }

  if (refreshToken.expiresAt < new Date()) {
    return { valid: false, error: 'Refresh token has expired' }
  }

  return { valid: true, userId: refreshToken.userId }
}

/**
 * Rotate refresh token (revoke old, create new)
 */
export async function rotateRefreshToken(oldTokenId: string, userId: string) {
  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: oldTokenId },
    data: { revokedAt: new Date() },
  })

  // Create new token
  const newToken = await createRefreshToken(userId)

  // Link old token to new one
  await prisma.refreshToken.update({
    where: { id: oldTokenId },
    data: { replacedBy: newToken.id },
  })

  return newToken
}

/**
 * Revoke a refresh token
 */
export async function revokeRefreshToken(tokenId: string) {
  await prisma.refreshToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  })
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  })
}

/**
 * Clean up expired tokens (run periodically)
 */
export async function cleanupExpiredTokens() {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
  return result.count
}
