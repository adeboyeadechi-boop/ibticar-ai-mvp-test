// API Route pour la gestion des paramètres de confidentialité
// GET /api/customers/[id]/profile/privacy - Voir les paramètres
// PUT /api/customers/[id]/profile/privacy - Modifier les paramètres

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/customers/[id]/profile/privacy - Paramètres de confidentialité
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: customerId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier que c'est le propriétaire ou un admin
    const isOwner = user.id === customerId
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role)

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only view your own privacy settings' },
        { status: 403 }
      )
    }

    // Récupérer le client
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        preferences: true,
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Extraire les paramètres de confidentialité
    const preferences = customer.preferences as any
    const privacy = preferences?.privacy || {}

    // Paramètres par défaut
    const privacySettings = {
      showEmail: privacy.showEmail !== false, // true par défaut
      showPhone: privacy.showPhone !== false, // true par défaut
      showAddress: privacy.showAddress !== false, // true par défaut
      showPurchases: privacy.showPurchases !== false, // true par défaut
      showFavorites: privacy.showFavorites !== false, // true par défaut
      allowContactFromDealers: privacy.allowContactFromDealers !== false, // true par défaut
      allowNewsletters: privacy.allowNewsletters !== false, // true par défaut
    }

    return NextResponse.json({
      customerId: customer.id,
      privacy: privacySettings,
    })
  } catch (error) {
    console.error('Error fetching privacy settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/customers/[id]/profile/privacy - Modifier les paramètres
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: customerId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier que c'est le propriétaire
    if (user.id !== customerId) {
      return NextResponse.json(
        { error: 'You can only update your own privacy settings' },
        { status: 403 }
      )
    }

    // Récupérer les nouvelles valeurs
    const body = await request.json()
    const {
      showEmail,
      showPhone,
      showAddress,
      showPurchases,
      showFavorites,
      allowContactFromDealers,
      allowNewsletters,
    } = body

    // Récupérer les préférences actuelles
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { preferences: true },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Construire les nouvelles préférences
    const currentPreferences = (customer.preferences as any) || {}
    const updatedPrivacy: any = currentPreferences.privacy || {}

    // Mettre à jour seulement les champs fournis
    if (showEmail !== undefined) updatedPrivacy.showEmail = showEmail
    if (showPhone !== undefined) updatedPrivacy.showPhone = showPhone
    if (showAddress !== undefined) updatedPrivacy.showAddress = showAddress
    if (showPurchases !== undefined) updatedPrivacy.showPurchases = showPurchases
    if (showFavorites !== undefined) updatedPrivacy.showFavorites = showFavorites
    if (allowContactFromDealers !== undefined)
      updatedPrivacy.allowContactFromDealers = allowContactFromDealers
    if (allowNewsletters !== undefined) updatedPrivacy.allowNewsletters = allowNewsletters

    // Mettre à jour les préférences
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        preferences: {
          ...currentPreferences,
          privacy: updatedPrivacy,
        },
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Customer',
        entityId: customerId,
        changes: {
          privacy: updatedPrivacy,
        },
      },
    })

    return NextResponse.json({
      success: true,
      privacy: updatedPrivacy,
      message: 'Privacy settings updated successfully',
    })
  } catch (error) {
    console.error('Error updating privacy settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
