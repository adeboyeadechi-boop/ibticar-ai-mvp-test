// API Route pour les avis clients du marketplace (PRD-03-US-009)
// GET /api/marketplace/reviews - Liste des avis approuvés (PUBLIC)
// POST /api/marketplace/reviews - Soumettre un avis (PUBLIC)

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// GET /api/marketplace/reviews - Récupérer les avis approuvés
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const vehicleId = searchParams.get('vehicleId')
    const rating = searchParams.get('rating')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {
      status: 'APPROVED', // Seulement les avis approuvés
    }

    if (vehicleId) {
      where.vehicleId = vehicleId
    }

    if (rating) {
      where.rating = parseInt(rating, 10)
    }

    // Compter le total
    const total = await prisma.review.count({ where })

    // Récupérer les avis
    const reviews = await prisma.review.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            year: true,
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
        },
      },
      orderBy: {
        publishedAt: 'desc',
      },
      skip,
      take: limit,
    })

    // Formater la réponse
    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      customer: {
        name: review.customer.companyName ||
          `${review.customer.firstName} ${review.customer.lastName.charAt(0)}.`, // Masquer le nom complet
        isVerified: review.isVerified,
      },
      vehicle: review.vehicle
        ? {
            id: review.vehicle.id,
            brand: review.vehicle.model.brand.name,
            model: review.vehicle.model.name,
            year: review.vehicle.year,
          }
        : null,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      pros: review.pros,
      cons: review.cons,
      publishedAt: review.publishedAt,
      createdAt: review.createdAt,
    }))

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
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/marketplace/reviews - Soumettre un avis
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      vehicleId,
      orderId,
      rating,
      title,
      comment,
      pros,
      cons,
    } = body

    // Validation des champs requis
    if (!email || !rating) {
      return NextResponse.json(
        { error: 'Missing required fields: email, rating' },
        { status: 400 }
      )
    }

    // Au moins un de vehicleId ou orderId doit être fourni
    if (!vehicleId && !orderId) {
      return NextResponse.json(
        { error: 'Either vehicleId or orderId must be provided' },
        { status: 400 }
      )
    }

    // Validation du rating (1-5)
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Vérifier que le client existe
    const customer = await prisma.customer.findUnique({
      where: { email },
    })

    if (!customer) {
      return NextResponse.json(
        {
          error:
            'Customer not found. You must be registered to leave a review.',
        },
        { status: 404 }
      )
    }

    // Vérifier que le véhicule existe si fourni
    if (vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
      })

      if (!vehicle) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
      }
    }

    // Vérifier si le client a déjà laissé un avis pour ce véhicule
    if (vehicleId) {
      const existingReview = await prisma.review.findFirst({
        where: {
          customerId: customer.id,
          vehicleId,
        },
      })

      if (existingReview) {
        return NextResponse.json(
          {
            error: 'You have already submitted a review for this vehicle',
            existingReviewId: existingReview.id,
          },
          { status: 400 }
        )
      }
    }

    // Vérifier si le client a acheté le véhicule (pour marquer comme vérifié)
    let isVerified = false
    if (orderId) {
      // TODO: Vérifier l'existence de la commande et que le client l'a passée
      // Pour l'instant, on suppose que fournir un orderId = vérifié
      isVerified = true
    }

    // Créer l'avis
    const review = await prisma.review.create({
      data: {
        customerId: customer.id,
        vehicleId: vehicleId || null,
        orderId: orderId || null,
        rating,
        title: title || null,
        comment: comment || null,
        pros: pros || null,
        cons: cons || null,
        status: 'PENDING', // Nécessite approbation
        isVerified,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message:
          'Your review has been submitted successfully and is pending approval',
        review: {
          id: review.id,
          rating: review.rating,
          status: review.status,
          isVerified: review.isVerified,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error submitting review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
