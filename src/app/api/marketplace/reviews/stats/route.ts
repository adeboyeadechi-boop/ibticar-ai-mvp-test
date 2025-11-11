// API Route pour les statistiques d'avis (PRD-03-US-009)
// GET /api/marketplace/reviews/stats - Statistiques des avis pour un véhicule

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// GET /api/marketplace/reviews/stats - Statistiques des avis
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const vehicleId = searchParams.get('vehicleId')

    if (!vehicleId) {
      return NextResponse.json(
        { error: 'Missing required parameter: vehicleId' },
        { status: 400 }
      )
    }

    // Vérifier que le véhicule existe
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        model: {
          select: {
            name: true,
            brand: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Récupérer tous les avis approuvés pour ce véhicule
    const reviews = await prisma.review.findMany({
      where: {
        vehicleId,
        status: 'APPROVED',
      },
      select: {
        rating: true,
        isVerified: true,
      },
    })

    // Calculer les statistiques
    const totalReviews = reviews.length

    if (totalReviews === 0) {
      return NextResponse.json({
        vehicleId,
        vehicle: {
          brand: vehicle.model.brand.name,
          model: vehicle.model.name,
        },
        stats: {
          totalReviews: 0,
          averageRating: 0,
          verifiedReviews: 0,
          ratingDistribution: {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0,
          },
        },
      })
    }

    // Calculer la moyenne
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)
    const averageRating = totalRating / totalReviews

    // Compter les avis vérifiés
    const verifiedReviews = reviews.filter((r) => r.isVerified).length

    // Distribution des notes
    const ratingDistribution = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    }

    // Calculer les pourcentages
    const ratingPercentages = {
      5: totalReviews > 0 ? (ratingDistribution[5] / totalReviews) * 100 : 0,
      4: totalReviews > 0 ? (ratingDistribution[4] / totalReviews) * 100 : 0,
      3: totalReviews > 0 ? (ratingDistribution[3] / totalReviews) * 100 : 0,
      2: totalReviews > 0 ? (ratingDistribution[2] / totalReviews) * 100 : 0,
      1: totalReviews > 0 ? (ratingDistribution[1] / totalReviews) * 100 : 0,
    }

    // Calculer le score de recommandation (% de 4-5 étoiles)
    const recommendationScore =
      totalReviews > 0
        ? ((ratingDistribution[4] + ratingDistribution[5]) / totalReviews) * 100
        : 0

    return NextResponse.json({
      vehicleId,
      vehicle: {
        brand: vehicle.model.brand.name,
        model: vehicle.model.name,
      },
      stats: {
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10, // Arrondi à 1 décimale
        verifiedReviews,
        verifiedPercentage:
          totalReviews > 0 ? (verifiedReviews / totalReviews) * 100 : 0,
        recommendationScore: Math.round(recommendationScore),
        ratingDistribution,
        ratingPercentages: {
          5: Math.round(ratingPercentages[5]),
          4: Math.round(ratingPercentages[4]),
          3: Math.round(ratingPercentages[3]),
          2: Math.round(ratingPercentages[2]),
          1: Math.round(ratingPercentages[1]),
        },
      },
    })
  } catch (error) {
    console.error('Error fetching review stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
