// API Route pour l'historique d'achats privé du client
// GET /api/customers/[id]/profile/purchases - Historique complet des achats

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/customers/[id]/profile/purchases - Historique d'achats (privé)
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: customerId } = await params

    // Vérifier l'authentification (REQUIS - données privées)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Vérifier que c'est le propriétaire ou un admin
    const isOwner = user.id === customerId
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only view your own purchase history' },
        { status: 403 }
      )
    }

    // Vérifier que le client existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Paramètres de pagination et filtres
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit
    const status = searchParams.get('status')

    // Construire les filtres
    const where: any = { customerId }
    if (status) {
      where.status = status
    }

    // Compter le total
    const total = await prisma.order.count({ where })

    // Récupérer les commandes (Note: Order has vehicleId, not orderItems)
    const orders = await prisma.order.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        orderDate: true,
        deliveryDate: true,
        completedAt: true,
        cancelledAt: true,
        cancellationReason: true,
        vehicleId: true,
        notes: true,
        createdAt: true,
      },
    })

    // Fetch vehicles for all orders
    const vehicleIds = orders.map(o => o.vehicleId).filter(Boolean)
    const vehicles = await prisma.vehicle.findMany({
      where: {
        id: { in: vehicleIds },
      },
      select: {
        id: true,
        vin: true,
        year: true,
        color: true,
        mileage: true,
        condition: true,
        vehicleModelId: true,
      },
    })

    // Fetch vehicle models
    const modelIds = [...new Set(vehicles.map(v => v.vehicleModelId))]
    const models = await prisma.vehicleModel.findMany({
      where: {
        id: { in: modelIds },
      },
      select: {
        id: true,
        name: true,
        brandId: true,
        fuelType: true,
        transmission: true,
      },
    })

    // Fetch brands
    const brandIds = [...new Set(models.map(m => m.brandId))]
    const brands = await prisma.brand.findMany({
      where: {
        id: { in: brandIds },
      },
      select: {
        id: true,
        name: true,
      },
    })

    // Create lookup maps
    const vehicleMap = new Map(vehicles.map(v => [v.id, v]))
    const modelMap = new Map(models.map(m => [m.id, m]))
    const brandMap = new Map(brands.map(b => [b.id, b]))

    // Formater les résultats
    const formattedOrders = orders.map((order) => {
      const vehicle = order.vehicleId ? vehicleMap.get(order.vehicleId) : null
      const model = vehicle ? modelMap.get(vehicle.vehicleModelId) : null
      const brand = model ? brandMap.get(model.brandId) : null

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        orderDate: order.orderDate,
        deliveryDate: order.deliveryDate,
        completedAt: order.completedAt,
        cancelledAt: order.cancelledAt,
        cancellationReason: order.cancellationReason,
        notes: order.notes,
        createdAt: order.createdAt,
        vehicle: vehicle && model && brand ? {
          id: vehicle.id,
          vin: vehicle.vin,
          brand: brand.name,
          model: model.name,
          year: vehicle.year,
          color: vehicle.color,
          mileage: vehicle.mileage,
          condition: vehicle.condition,
          fuelType: model.fuelType,
          transmission: model.transmission,
        } : null,
      }
    })

    // Statistiques d'achat
    const stats = await prisma.order.aggregate({
      where: { customerId },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    })

    const [
      completedOrders,
      pendingOrders,
      cancelledOrders,
    ] = await Promise.all([
      prisma.order.count({
        where: { customerId, completedAt: { not: null } },
      }),
      prisma.order.count({
        where: { customerId, status: { in: ['PENDING'] }, completedAt: null },
      }),
      prisma.order.count({
        where: { customerId, status: 'CANCELLED' },
      }),
    ])

    // Total vehicles purchased = completed orders (since each order has one vehicleId)
    const totalVehiclesPurchased = completedOrders

    // Group by status instead of paymentStatus (which doesn't exist)
    const statusStats = await prisma.order.groupBy({
      by: ['status'],
      where: { customerId },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    })

    return NextResponse.json({
      purchases: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats: {
        totalOrders: stats._count.id,
        completedOrders,
        pendingOrders,
        cancelledOrders,
        totalVehiclesPurchased,
        totalSpent: stats._sum.totalAmount ? Number(stats._sum.totalAmount) : 0,
        statusBreakdown: statusStats.map((stat) => ({
          status: stat.status,
          count: stat._count.id,
          amount: stat._sum.totalAmount ? Number(stat._sum.totalAmount) : 0,
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching customer purchases:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
