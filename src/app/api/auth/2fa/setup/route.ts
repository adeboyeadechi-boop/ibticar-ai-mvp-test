// 2FA Setup Endpoint
// POST /api/auth/2fa/setup
// Generate TOTP secret and QR code for the authenticated user

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { generateTOTPSecret, generateQRCode } from '@/lib/totp'
import prisma from '@/prisma/client'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled' },
        { status: 400 }
      )
    }

    // Generate TOTP secret
    const { secret, otpauthUrl } = generateTOTPSecret(user.email)

    // Generate QR code
    const qrCode = await generateQRCode(otpauthUrl!)

    // Store secret temporarily (not enabled yet until verified)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: false, // Not enabled until verified
      },
    })

    return NextResponse.json({
      success: true,
      secret,
      qrCode,
      message:
        'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.) and verify with a code',
    })
  } catch (error) {
    console.error('Error setting up 2FA:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
