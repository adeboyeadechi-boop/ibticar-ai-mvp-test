// Refresh Token Endpoint
// POST /api/auth/refresh
// Exchange a refresh token for a new access token + new refresh token

import { NextRequest, NextResponse } from 'next/server'
import { verifyRefreshToken } from '@/lib/jwt'
import {
  validateRefreshToken,
  rotateRefreshToken,
} from '@/lib/refresh-token'
import { signToken } from '@/lib/jwt'
import prisma from '@/prisma/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token required' },
        { status: 400 }
      )
    }

    // Verify JWT signature and decode
    const decoded = verifyRefreshToken(refreshToken)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      )
    }

    // Validate refresh token in database (not revoked, not expired)
    const validation = await validateRefreshToken(decoded.tokenId)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid refresh token' },
        { status: 401 }
      )
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 401 }
      )
    }

    // Rotate refresh token (revoke old, create new)
    const newRefreshToken = await rotateRefreshToken(
      decoded.tokenId,
      user.id
    )

    // Generate new access token
    const newAccessToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    return NextResponse.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken.token,
    })
  } catch (error) {
    console.error('Error refreshing token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
