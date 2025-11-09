// Custom signin endpoint for testing
// POST /api/auth/signin
// Supports 2FA and refresh tokens

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import bcrypt from 'bcrypt'
import { signToken } from '@/lib/jwt'
import { createRefreshToken } from '@/lib/refresh-token'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, twoFactorCode } = body

    console.log('🔐 Custom signin attempt:', {
      email,
      passwordLength: password?.length,
      has2FACode: !!twoFactorCode,
    })

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      console.log('❌ User not found')
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!user.passwordHash) {
      console.log('❌ User has no password hash')
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    console.log('🔑 Password validation:', isPasswordValid)

    if (!isPasswordValid) {
      console.log('❌ Invalid password')
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!twoFactorCode) {
        // Password is valid but 2FA code required
        return NextResponse.json(
          {
            requires2FA: true,
            message: 'Two-factor authentication code required',
          },
          { status: 200 }
        )
      }

      // Verify 2FA code
      const { verifyTOTP } = await import('@/lib/totp')
      const isCodeValid = verifyTOTP(user.twoFactorSecret, twoFactorCode)

      if (!isCodeValid) {
        // Check backup codes
        const backupCodes = (user.twoFactorBackupCodes as string[]) || []
        const bcrypt = await import('bcrypt')
        let isBackupCodeValid = false

        for (const hashedCode of backupCodes) {
          if (await bcrypt.compare(twoFactorCode, hashedCode)) {
            isBackupCodeValid = true
            // Remove used backup code
            const updatedCodes = backupCodes.filter((c) => c !== hashedCode)
            await prisma.user.update({
              where: { id: user.id },
              data: { twoFactorBackupCodes: updatedCodes },
            })
            break
          }
        }

        if (!isBackupCodeValid) {
          return NextResponse.json(
            { error: 'Invalid two-factor authentication code' },
            { status: 401 }
          )
        }
      }
    }

    console.log('✅ Authentication successful for:', user.email)

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Generate access token
    const accessToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    // Generate refresh token
    const refreshToken = await createRefreshToken(user.id)

    // Return success with tokens and user data
    return NextResponse.json({
      success: true,
      token: accessToken,
      refreshToken: refreshToken.token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    })
  } catch (error) {
    console.error('Error in custom signin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
