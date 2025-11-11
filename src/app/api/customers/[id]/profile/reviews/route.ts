// API Routes pour les avis publics des clients
// GET /api/customers/[id]/profile/reviews - Liste des avis d'un client

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/customers/[id]/profile/reviews - Liste des avis du client
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: customerId } = await params

    // L'authentification n'est pas requise (avis publics)
    const { user } = await getAuthenticatedUser(request)
    const isOwner = user?.id === customerId
    const isAdmin = user && ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)

    // Vérifier que le client existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Paramètres de pagination
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50)
    const skip = (page - 1) * limit

    // Filtres optionnels
    const status = searchParams.get('status')
    const minRating = searchParams.get('minRating')

    // Construire les filtres
    const where: any = {
      customerId,
    }

    // Seul le propriétaire ou un admin peut voir les avis en attente
    if (!isOwner && !isAdmin) {
      where.status = 'APPROVED'
    } else if (status) {
      where.status = status
    }

    if (minRating) {
      where.rating = {
        gte: parseInt(minRating, 10),
      }
    }

    // Compter le total
    const total = await prisma.review.count({ where })

    // Récupérer les avis
    const reviews = await prisma.review.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        pros: true,
        cons: true,
        status: true,
        isVerified: true,
        publishedAt: true,
        vehicleId: true,
        orderId: true,
        createdAt: true,
      },
    })

    // Fetch vehicles, models, brands, and orders separately
    const vehicleIds = reviews.map(r => r.vehicleId).filter(Boolean) as string[]
    const orderIds = reviews.map(r => r.orderId).filter(Boolean) as string[]

    const [vehicles, orders] = await Promise.all([
      vehicleIds.length > 0
        ? prisma.vehicle.findMany({
            where: { id: { in: vehicleIds } },
            select: { id: true, vin: true, year: true, vehicleModelId: true },
          })
        : Promise.resolve([]),
      orderIds.length > 0
        ? prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, orderNumber: true },
          })
        : Promise.resolve([]),
    ])

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
    const orderMap = new Map(orders.map(o => [o.id, o]))
    const modelMap = new Map(models.map(m => [m.id, m]))
    const brandMap = new Map(brands.map(b => [b.id, b]))

    // Formater les résultats
    const formattedReviews = reviews.map((review) => {
      const vehicle = review.vehicleId ? vehicleMap.get(review.vehicleId) : null
      const model = vehicle ? modelMap.get(vehicle.vehicleModelId) : null
      const brand = model ? brandMap.get(model.brandId) : null
      const order = review.orderId ? orderMap.get(review.orderId) : null

      return {
        id: review.id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        pros: review.pros,
        cons: review.cons,
        status: review.status,
        isVerified: review.isVerified,
        publishedAt: review.publishedAt,
        createdAt: review.createdAt,
        vehicle: vehicle && model && brand
          ? {
              id: vehicle.id,
              vin: vehicle.vin,
              brand: brand.name,
              model: model.name,
              year: vehicle.year,
            }
          : null,
        order: order
          ? {
              id: order.id,
              orderNumber: order.orderNumber,
            }
          : null,
      }
    })

    // Calculer les statistiques des avis
    const stats = await prisma.review.aggregate({
      where: {
        customerId,
        status: 'APPROVED',
      },
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
    })

    // Répartition par étoiles
    const ratingDistribution = await Promise.all([
      prisma.review.count({ where: { customerId, status: 'APPROVED', rating: 5 } }),
      prisma.review.count({ where: { customerId, status: 'APPROVED', rating: 4 } }),
      prisma.review.count({ where: { customerId, status: 'APPROVED', rating: 3 } }),
      prisma.review.count({ where: { customerId, status: 'APPROVED', rating: 2 } }),
      prisma.review.count({ where: { customerId, status: 'APPROVED', rating: 1 } }),
    ])

    return NextResponse.json({
      reviews: formattedReviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats: {
        totalReviews: stats._count.id,
        averageRating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0,
        distribution: {
          5: ratingDistribution[0],
          4: ratingDistribution[1],
          3: ratingDistribution[2],
          2: ratingDistribution[3],
          1: ratingDistribution[4],
        },
      },
    })
  } catch (error) {
    console.error('Error fetching customer reviews:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
