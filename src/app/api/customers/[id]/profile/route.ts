// API Routes pour les profils publics des clients
// GET /api/customers/[id]/profile - Voir le profil public d'un client
// PUT /api/customers/[id]/profile - Mettre à jour son propre profil

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/customers/[id]/profile - Profil public du client
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: customerId } = await params

    // L'authentification n'est pas requise pour voir les profils publics
    // Mais on vérifie si l'utilisateur est authentifié pour afficher plus d'infos
    const { user } = await getAuthenticatedUser(request)
    const isOwner = user?.id === customerId
    const isAdmin = user && ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)

    // Récupérer le client
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Vérifier les paramètres de confidentialité
    const privacy = (customer.preferences as any)?.privacy || {}
    const showEmail = privacy.showEmail !== false
    const showPhone = privacy.showPhone !== false
    const showAddress = privacy.showAddress !== false
    const showPurchases = privacy.showPurchases !== false

    // Statistiques du client
    const [totalOrders, totalPurchases, totalReviews] = await Promise.all([
      prisma.order.count({
        where: { customerId },
      }),
      prisma.order.count({
        where: {
          customerId,
          completedAt: { not: null },
        },
      }),
      prisma.review.count({
        where: { customerId },
      }),
    ])

    // Note: favoriteVehicle model does not exist in schema
    const favoriteCount = 0

    // Profil de base (toujours visible)
    const publicProfile: any = {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      createdAt: customer.createdAt,
      // Note: Customer model does not have team relation
      team: null,
      stats: {
        totalOrders,
        totalPurchases,
        totalReviews,
        favoriteCount,
        memberSince: customer.createdAt,
      },
    }

    // Informations conditionnelles selon les paramètres de confidentialité
    // Ou si c'est le propriétaire du profil ou un admin
    if (isOwner || isAdmin || showEmail) {
      publicProfile.email = customer.email
    }

    if (isOwner || isAdmin || showPhone) {
      publicProfile.phone = customer.phone
    }

    if (isOwner || isAdmin || showAddress) {
      publicProfile.address = customer.address
      publicProfile.city = customer.city
      publicProfile.wilaya = customer.wilaya
    }

    // Informations complètes pour le propriétaire ou admin
    if (isOwner || isAdmin) {
      publicProfile.preferences = customer.preferences
      publicProfile.type = customer.type
      publicProfile.companyName = customer.companyName
      publicProfile.taxId = customer.taxId
      // Note: loyaltyPoints field does not exist in Customer model
    }

    // Récupérer les achats récents si autorisé
    if (isOwner || isAdmin || showPurchases) {
      const recentPurchases = await prisma.order.findMany({
        where: {
          customerId,
          completedAt: { not: null },
        },
        orderBy: {
          completedAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          completedAt: true,
          vehicleId: true,
        },
      })

      // Fetch vehicles for these orders
      const vehicleIds = recentPurchases.map(o => o.vehicleId).filter(Boolean) as string[]
      const vehicles = vehicleIds.length > 0
        ? await prisma.vehicle.findMany({
            where: { id: { in: vehicleIds } },
            select: { id: true, year: true, vehicleModelId: true },
          })
        : []

      const modelIds = [...new Set(vehicles.map(v => v.vehicleModelId))]
      const models = modelIds.length > 0
        ? await prisma.vehicleModel.findMany({
            where: { id: { in: modelIds } },
            select: { id: true, name: true, brandId: true },
          })
        : []

      const brandIds = [...new Set(models.map(m => m.brandId))]
      const brands = brandIds.length > 0
        ? await prisma.brand.findMany({
            where: { id: { in: brandIds } },
            select: { id: true, name: true },
          })
        : []

      // Create lookup maps
      const vehicleMap = new Map(vehicles.map(v => [v.id, v]))
      const modelMap = new Map(models.map(m => [m.id, m]))
      const brandMap = new Map(brands.map(b => [b.id, b]))

      publicProfile.recentPurchases = recentPurchases.map((order) => {
        const vehicle = order.vehicleId ? vehicleMap.get(order.vehicleId) : null
        const model = vehicle ? modelMap.get(vehicle.vehicleModelId) : null
        const brand = model ? brandMap.get(model.brandId) : null

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          date: order.completedAt,
          vehicle: vehicle && model && brand ? {
            brand: brand.name,
            model: model.name,
            year: vehicle.year,
          } : null,
        }
      })
    }

    // Récupérer les avis récents (toujours publics)
    const recentReviews = await prisma.review.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        vehicleId: true,
      },
    })

    // Fetch vehicles for reviews
    const reviewVehicleIds = recentReviews.map(r => r.vehicleId).filter(Boolean) as string[]
    const reviewVehicles = reviewVehicleIds.length > 0
      ? await prisma.vehicle.findMany({
          where: { id: { in: reviewVehicleIds } },
          select: { id: true, year: true, vehicleModelId: true },
        })
      : []

    const reviewModelIds = [...new Set(reviewVehicles.map(v => v.vehicleModelId))]
    const reviewModels = reviewModelIds.length > 0
      ? await prisma.vehicleModel.findMany({
          where: { id: { in: reviewModelIds } },
          select: { id: true, name: true, brandId: true },
        })
      : []

    const reviewBrandIds = [...new Set(reviewModels.map(m => m.brandId))]
    const reviewBrands = reviewBrandIds.length > 0
      ? await prisma.brand.findMany({
          where: { id: { in: reviewBrandIds } },
          select: { id: true, name: true },
        })
      : []

    // Create lookup maps for reviews
    const reviewVehicleMap = new Map(reviewVehicles.map(v => [v.id, v]))
    const reviewModelMap = new Map(reviewModels.map(m => [m.id, m]))
    const reviewBrandMap = new Map(reviewBrands.map(b => [b.id, b]))

    publicProfile.recentReviews = recentReviews.map((review) => {
      const vehicle = review.vehicleId ? reviewVehicleMap.get(review.vehicleId) : null
      const model = vehicle ? reviewModelMap.get(vehicle.vehicleModelId) : null
      const brand = model ? reviewBrandMap.get(model.brandId) : null

      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        vehicle: vehicle && model && brand ? {
          brand: brand.name,
          model: model.name,
          year: vehicle.year,
        } : null,
      }
    })

    return NextResponse.json({
      profile: publicProfile,
      isOwner,
    })
  } catch (error) {
    console.error('Error fetching customer profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/customers/[id]/profile - Mettre à jour son profil
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: customerId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier que c'est bien le propriétaire du profil ou un admin
    const isOwner = user.id === customerId
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role)

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only update your own profile' },
        { status: 403 }
      )
    }

    // Récupérer les données
    const body = await request.json()
    const { firstName, lastName, phone, address, city, wilaya, preferences } = body

    // Construire les données de mise à jour
    const updateData: any = {}
    if (firstName) updateData.firstName = firstName
    if (lastName) updateData.lastName = lastName
    if (phone) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (city) updateData.city = city
    if (wilaya) updateData.wilaya = wilaya
    if (preferences) updateData.preferences = preferences

    // Mettre à jour le profil
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Customer',
        entityId: customerId,
        changes: updateData,
      },
    })

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        wilaya: customer.wilaya,
        preferences: customer.preferences,
      },
      message: 'Profile updated successfully',
    })
  } catch (error) {
    console.error('Error updating customer profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
