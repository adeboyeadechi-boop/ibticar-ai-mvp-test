// Simple test endpoint to verify auth without special chars issues
// GET /api/auth/simple-test?email=X&password=Y

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import bcrypt from 'bcrypt'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const email = searchParams.get('email')
  const password = searchParams.get('password')

  const results: any = {
    timestamp: new Date().toISOString(),
    email,
    passwordReceived: !!password,
  }

  try {
    if (!email || !password) {
      results.error = 'Missing email or password query params'
      return NextResponse.json(results, { status: 400 })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        firstName: true,
        lastName: true,
      },
    })

    if (!user) {
      results.error = 'User not found'
      results.userExists = false
      return NextResponse.json(results, { status: 404 })
    }

    results.userExists = true
    results.userId = user.id
    results.hasPasswordHash = !!user.passwordHash

    if (!user.passwordHash) {
      results.error = 'User has no password hash'
      return NextResponse.json(results, { status: 500 })
    }

    // Test password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    results.passwordValid = isPasswordValid

    if (!isPasswordValid) {
      results.error = 'Invalid password'
      return NextResponse.json(results, { status: 401 })
    }

    // Try to update lastLoginAt
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      results.lastLoginUpdated = true
    } catch (error: any) {
      results.lastLoginUpdated = false
      results.lastLoginError = error.message
    }

    // Try to create refresh token
    try {
      const token = await prisma.refreshToken.create({
        data: {
          token: 'test-' + Date.now(),
          userId: user.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
      results.refreshTokenCreated = true
      results.refreshTokenId = token.id
    } catch (error: any) {
      results.refreshTokenCreated = false
      results.refreshTokenError = error.message
    }

    // Success - all steps completed
    results.success = true
    results.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: `${user.firstName} ${user.lastName}`,
    }

    return NextResponse.json(results, { status: 200 })
  } catch (error: any) {
    results.unexpectedError = error.message
    return NextResponse.json(results, { status: 500 })
  }
}
