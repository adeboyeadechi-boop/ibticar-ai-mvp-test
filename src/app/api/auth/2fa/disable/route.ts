// 2FA Disable Endpoint
// POST /api/auth/2fa/disable
// Disable two-factor authentication for the authenticated user

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { verifyTOTP } from '@/lib/totp'
import prisma from '@/prisma/client'
import bcrypt from 'bcrypt'

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const body = await request.json()
    const { password, code } = body

    if (!password) {
      return NextResponse.json(
        { error: 'Password required to disable 2FA' },
        { status: 400 }
      )
    }

    // Verify password
    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, twoFactorSecret: true, twoFactorEnabled: true, twoFactorBackupCodes: true },
    })

    if (!userWithPassword) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      userWithPassword.passwordHash
    )

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // If 2FA is enabled, require code
    if (userWithPassword.twoFactorEnabled && userWithPassword.twoFactorSecret) {
      if (!code) {
        return NextResponse.json(
          { error: 'Two-factor authentication code required' },
          { status: 400 }
        )
      }

      // Verify TOTP code
      const isCodeValid = verifyTOTP(userWithPassword.twoFactorSecret, code)

      if (!isCodeValid) {
        // Try backup codes
        const backupCodes = (userWithPassword.twoFactorBackupCodes as string[]) || []
        let isBackupCodeValid = false

        for (const hashedCode of backupCodes) {
          if (await bcrypt.compare(code, hashedCode)) {
            isBackupCodeValid = true
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

    // Disable 2FA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication disabled successfully',
    })
  } catch (error) {
    console.error('Error disabling 2FA:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
