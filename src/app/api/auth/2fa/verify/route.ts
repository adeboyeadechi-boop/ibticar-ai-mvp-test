// 2FA Verify Endpoint
// POST /api/auth/2fa/verify
// Verify TOTP code and enable 2FA, generate backup codes

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { verifyTOTP, generateBackupCodes } from '@/lib/totp'
import prisma from '@/prisma/client'

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code required' },
        { status: 400 }
      )
    }

    // Check if user has a secret (from setup)
    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Two-factor authentication not set up. Call /api/auth/2fa/setup first' },
        { status: 400 }
      )
    }

    // Verify the code
    const isValid = verifyTOTP(user.twoFactorSecret, code)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 401 }
      )
    }

    // Generate backup codes
    const backupCodesData = await generateBackupCodes(10)
    const backupCodes = backupCodesData.map((c) => c.code)
    const hashedBackupCodes = backupCodesData.map((c) => c.hashed)

    // Enable 2FA and store backup codes
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: hashedBackupCodes,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
      backupCodes,
      warning:
        'Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.',
    })
  } catch (error) {
    console.error('Error verifying 2FA:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
