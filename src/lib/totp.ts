// TOTP (Time-based One-Time Password) utilities for 2FA
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { randomBytes } from 'crypto'
import bcrypt from 'bcrypt'

/**
 * Generate a new TOTP secret for a user
 */
export function generateTOTPSecret(userEmail: string) {
  const secret = speakeasy.generateSecret({
    name: `Ibticar.AI (${userEmail})`,
    issuer: 'Ibticar.AI',
    length: 32,
  })

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
  }
}

/**
 * Generate QR code image data URL from otpauth URL
 */
export async function generateQRCode(otpauthUrl: string): Promise<string> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)
    return qrCodeDataUrl
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw new Error('Failed to generate QR code')
  }
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTP(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2, // Allow 2 time steps before/after for clock drift
  })
}

/**
 * Generate backup codes for 2FA recovery
 * Returns an array of { code: string, hashed: string }
 */
export async function generateBackupCodes(count: number = 10) {
  const codes: Array<{ code: string; hashed: string }> = []

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = randomBytes(4).toString('hex').toUpperCase()
    // Hash it for storage
    const hashed = await bcrypt.hash(code, 10)
    codes.push({ code, hashed })
  }

  return codes
}

/**
 * Verify a backup code against hashed codes
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; matchedHash?: string }> {
  for (const hashedCode of hashedCodes) {
    const isValid = await bcrypt.compare(code, hashedCode)
    if (isValid) {
      return { valid: true, matchedHash: hashedCode }
    }
  }
  return { valid: false }
}
