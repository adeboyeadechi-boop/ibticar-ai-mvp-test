// API Route pour le tableau de bord analytics
// GET /api/analytics/dashboard - Récupère les KPIs principaux

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/analytics/dashboard - Tableau de bord avec KPIs
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Permissions: tous les utilisateurs authentifiés peuvent voir le dashboard
    // mais les données seront filtrées selon leur rôle si nécessaire

    // Récupérer les statistiques en parallèle pour optimiser les performances
    const [
      totalVehicles,
      vehiclesByStatus,
      totalCustomers,
      customersByStatus,
      totalLeads,
      leadsByStatus,
      totalSuppliers,
      activeSuppliers,
      pendingTransfers,
      totalUsers,
    ] = await Promise.all([
      // Statistiques véhicules
      prisma.vehicle.count(),
      prisma.vehicle.groupBy({
        by: ['status'],
        _count: { status: true },
      }),

      // Statistiques clients
      prisma.customer.count(),
      prisma.customer.groupBy({
        by: ['status'],
        _count: { status: true },
      }),

      // Statistiques leads
      prisma.lead.count(),
      prisma.lead.groupBy({
        by: ['status'],
        _count: { status: true },
      }),

      // Statistiques fournisseurs
      prisma.supplier.count(),
      prisma.supplier.count({
        where: { status: 'ACTIVE' },
      }),

      // Statistiques transferts
      prisma.stockTransfer.count({
        where: {
          status: {
            in: ['PENDING', 'IN_TRANSIT'],
          },
        },
      }),

      // Statistiques utilisateurs
      prisma.user.count({
        where: { isActive: true },
      }),
    ])

    // Calculer la valeur totale du stock
    const stockValue = await prisma.vehicle.aggregate({
      where: {
        status: {
          in: ['AVAILABLE'],
        },
      },
      _sum: {
        purchasePrice: true,
        sellingPrice: true,
      },
      _avg: {
        purchasePrice: true,
      },
    })

    // Formatter les statistiques par statut
    const vehiclesStats = vehiclesByStatus.reduce(
      (acc, stat) => {
        acc[stat.status] = stat._count.status
        return acc
      },
      {} as Record<string, number>
    )

    const customersStats = customersByStatus.reduce(
      (acc, stat) => {
        acc[stat.status] = stat._count.status
        return acc
      },
      {} as Record<string, number>
    )

    const leadsStats = leadsByStatus.reduce(
      (acc, stat) => {
        acc[stat.status] = stat._count.status
        return acc
      },
      {} as Record<string, number>
    )

    // Construire la réponse
    const dashboard = {
      summary: {
        totalVehicles,
        totalCustomers,
        totalLeads,
        totalSuppliers,
        activeSuppliers,
        pendingTransfers,
        totalUsers,
      },
      vehicles: {
        total: totalVehicles,
        byStatus: vehiclesStats,
        stockValue: {
          totalPurchase: stockValue._sum.purchasePrice || 0,
          totalSelling: stockValue._sum.sellingPrice || 0,
          avgPurchasePrice: stockValue._avg.purchasePrice || 0,
        },
      },
      customers: {
        total: totalCustomers,
        byStatus: customersStats,
      },
      leads: {
        total: totalLeads,
        byStatus: leadsStats,
      },
      suppliers: {
        total: totalSuppliers,
        active: activeSuppliers,
        inactive: totalSuppliers - activeSuppliers,
      },
      transfers: {
        pending: pendingTransfers,
      },
    }

    return NextResponse.json(dashboard)
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
