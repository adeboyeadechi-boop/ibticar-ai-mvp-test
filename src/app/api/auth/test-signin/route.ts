// Diagnostic endpoint to test authentication step by step
// POST /api/auth/test-signin

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import bcrypt from 'bcrypt'

export async function POST(request: NextRequest) {
  const results: any = {
    step1_parseBody: 'pending',
    step2_findUser: 'pending',
    step3_checkPasswordHash: 'pending',
    step4_verifyPassword: 'pending',
    step5_updateLastLogin: 'pending',
    step6_createRefreshToken: 'pending',
  }

  try {
    // Step 1: Parse body
    const body = await request.json()
    const { email, password } = body
    results.step1_parseBody = 'success'
    results.email = email
    results.passwordLength = password?.length

    if (!email || !password) {
      results.error = 'Missing credentials'
      return NextResponse.json(results, { status: 400 })
    }

    // Step 2: Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        firstName: true,
        lastName: true,
        lastLoginAt: true,
      },
    })
    results.step2_findUser = user ? 'success' : 'failed'
    results.userFound = !!user

    if (!user) {
      results.error = 'User not found'
      return NextResponse.json(results, { status: 404 })
    }

    // Step 3: Check password hash
    results.step3_checkPasswordHash = user.passwordHash ? 'success' : 'failed'
    results.hasPasswordHash = !!user.passwordHash

    if (!user.passwordHash) {
      results.error = 'User has no password hash'
      return NextResponse.json(results, { status: 500 })
    }

    // Step 4: Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    results.step4_verifyPassword = isPasswordValid ? 'success' : 'failed'
    results.passwordValid = isPasswordValid

    if (!isPasswordValid) {
      results.error = 'Invalid password'
      return NextResponse.json(results, { status: 401 })
    }

    // Step 5: Update last login (this is where the error might be)
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      results.step5_updateLastLogin = 'success'
    } catch (error: any) {
      results.step5_updateLastLogin = 'failed'
      results.updateLastLoginError = error.message
      // Continue anyway
    }

    // Step 6: Try to create refresh token
    try {
      const refreshToken = await prisma.refreshToken.create({
        data: {
          token: 'test-token-' + Date.now(),
          userId: user.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
      results.step6_createRefreshToken = 'success'
      results.refreshTokenId = refreshToken.id
    } catch (error: any) {
      results.step6_createRefreshToken = 'failed'
      results.createRefreshTokenError = error.message
    }

    // Success
    results.allStepsCompleted = true
    return NextResponse.json(results, { status: 200 })
  } catch (error: any) {
    results.unexpectedError = error.message
    results.errorStack = error.stack
    return NextResponse.json(results, { status: 500 })
  }
}
