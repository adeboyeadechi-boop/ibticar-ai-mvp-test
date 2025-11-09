// API Routes pour la gestion d'un utilisateur spécifique
// GET /api/users/[id] - Récupère un utilisateur
// PATCH /api/users/[id] - Met à jour un utilisateur
// DELETE /api/users/[id] - Supprime un utilisateur

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/prisma/client'
import bcrypt from 'bcrypt'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/users/[id] - Récupère un utilisateur
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Un utilisateur peut voir ses propres infos, ou être ADMIN/SUPER_ADMIN
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (
      !currentUser ||
      (currentUser.id !== id &&
        !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role))
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id },
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
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/users/[id] - Met à jour un utilisateur
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Un utilisateur peut modifier ses propres infos (limitées), ou être ADMIN/SUPER_ADMIN
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)
    const isSelf = currentUser.id === id

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Récupérer les données du body
    const body = await request.json()
    const {
      email,
      password,
      role,
      firstName,
      lastName,
      phone,
      preferredLanguage,
      isActive,
    } = body

    // Préparer les données à mettre à jour
    const updateData: any = {}

    // Les utilisateurs non-admins ne peuvent modifier que certains champs
    if (isSelf && !isAdmin) {
      if (firstName) updateData.firstName = firstName
      if (lastName) updateData.lastName = lastName
      if (phone) updateData.phone = phone
      if (preferredLanguage) updateData.preferredLanguage = preferredLanguage
      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10)
      }
    } else if (isAdmin) {
      // Les admins peuvent tout modifier
      if (email) updateData.email = email
      if (firstName) updateData.firstName = firstName
      if (lastName) updateData.lastName = lastName
      if (phone) updateData.phone = phone
      if (preferredLanguage) updateData.preferredLanguage = preferredLanguage
      if (role) updateData.role = role
      if (typeof isActive === 'boolean') updateData.isActive = isActive
      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10)
      }
    }

    // Vérifier si l'email existe déjà (si changé)
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      })
      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        )
      }
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'User',
        entityId: id,
        changes: {
          before: existingUser,
          after: updatedUser,
        },
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id] - Supprime un utilisateur
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Seuls les SUPER_ADMIN peuvent supprimer des utilisateurs
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Empêcher la suppression de son propre compte
    if (currentUser.id === id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Plutôt que de supprimer, on désactive l'utilisateur (soft delete)
    const deletedUser = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'User',
        entityId: id,
        changes: { deleted: existingUser },
      },
    })

    return NextResponse.json({
      message: 'User deactivated successfully',
      user: deletedUser,
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
