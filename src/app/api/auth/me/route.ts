// API Route pour récupérer l'utilisateur connecté
// GET /api/auth/me - Récupère les informations de l'utilisateur connecté

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/prisma/client'

export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer les informations complètes de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        preferredLanguage: true,
        isActive: true,
        lastLoginAt: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching current user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
