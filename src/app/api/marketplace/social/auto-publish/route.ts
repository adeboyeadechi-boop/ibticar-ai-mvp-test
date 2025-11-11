// API Route pour publication automatique sur les réseaux sociaux (PRD-03-US-024)
// POST /api/marketplace/social/auto-publish - Publier automatiquement les nouveaux véhicules

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// POST /api/marketplace/social/auto-publish - Publication automatique
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent configurer la publication auto
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { mode, vehicleId, filters, platforms, schedule } = body

    const results = {
      published: 0,
      scheduled: 0,
      failed: 0,
      details: [] as any[],
    }

    let vehiclesToPublish = []

    if (mode === 'single' && vehicleId) {
      // Mode: Publier un véhicule spécifique
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
      })

      if (!vehicle) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
      }

      vehiclesToPublish = [vehicle]
    } else if (mode === 'auto') {
      // Mode: Publier automatiquement les nouveaux véhicules
      const where: any = {
        status: 'AVAILABLE',
        availableForSale: true,
        publishedAt: { not: null },
      }

      // Filtres optionnels
      if (filters) {
        if (filters.minPrice) where.sellingPrice = { gte: filters.minPrice }
        if (filters.maxPrice) where.sellingPrice = { ...where.sellingPrice, lte: filters.maxPrice }
        if (filters.teamId) where.teamId = filters.teamId
        if (filters.publishedSince) {
          where.publishedAt = {
            ...where.publishedAt,
            gte: new Date(filters.publishedSince),
          }
        }
      }

      // Récupérer les véhicules publiés récemment (dernières 24h par défaut)
      if (!filters?.publishedSince) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        where.publishedAt = {
          ...where.publishedAt,
          gte: yesterday,
        }
      }

      vehiclesToPublish = await prisma.vehicle.findMany({
        where,
        take: 10, // Limiter à 10 véhicules par batch
        orderBy: {
          publishedAt: 'desc',
        },
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Use "single" or "auto"' },
        { status: 400 }
      )
    }

    // Publier chaque véhicule
    for (const vehicle of vehiclesToPublish) {
      try {
        const vehicleDetails = await prisma.vehicle.findUnique({
          where: { id: vehicle.id },
          include: {
            model: {
              include: {
                brand: true,
              },
            },
            team: true,
            media: {
              where: { type: 'PHOTO' },
              orderBy: { order: 'asc' },
              take: 4,
            },
          },
        })

        if (!vehicleDetails) continue

        // Générer le post
        const postContent = `🚗 ${vehicleDetails.model.brand.name} ${vehicleDetails.model.name} ${vehicleDetails.year}

💰 Prix: ${Number(vehicleDetails.sellingPrice).toLocaleString('fr-DZ')} DZD
📏 ${vehicleDetails.mileage ? vehicleDetails.mileage.toLocaleString('fr-DZ') : '0'} km
🎨 Couleur: ${vehicleDetails.color}
📍 ${vehicleDetails.team.city}, ${vehicleDetails.team.wilaya}

✅ Véhicule disponible maintenant!
📞 Contactez-nous pour plus d'informations

#${vehicleDetails.model.brand.name} #${vehicleDetails.model.name} #Algerie #VoitureOccasion`

        const socialPostData = {
          vehicleId: vehicle.id,
          content: postContent,
          platforms: platforms || ['FACEBOOK', 'INSTAGRAM'],
          images: vehicleDetails.media.map((m) => m.url),
          url: `https://ibticar.ai/marketplace/vehicles/${vehicle.id}`,
          scheduledAt: schedule?.publishAt ? new Date(schedule.publishAt) : null,
        }

        // TODO: Intégrer avec les APIs des réseaux sociaux
        // Pour l'instant, on simule la publication
        console.log('Publishing social post:', socialPostData)

        // Simuler la publication
        const published = true // await publishToSocialMedia(socialPostData)

        if (published) {
          if (schedule?.publishAt) {
            results.scheduled++
            results.details.push({
              vehicleId: vehicle.id,
              status: 'scheduled',
              scheduledAt: schedule.publishAt,
              platforms: socialPostData.platforms,
            })
          } else {
            results.published++
            results.details.push({
              vehicleId: vehicle.id,
              status: 'published',
              platforms: socialPostData.platforms,
              publishedAt: new Date(),
            })
          }

          // Log d'audit
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'CREATE',
              entityType: 'SocialPost',
              entityId: vehicle.id,
              changes: {
                action: 'SOCIAL_PUBLISH',
                vehicle: {
                  id: vehicle.id,
                  brand: vehicleDetails.model.brand.name,
                  model: vehicleDetails.model.name,
                },
                platforms: socialPostData.platforms,
              },
            },
          })
        } else {
          results.failed++
          results.details.push({
            vehicleId: vehicle.id,
            status: 'failed',
            reason: 'Failed to publish',
          })
        }
      } catch (error) {
        results.failed++
        results.details.push({
          vehicleId: vehicle.id,
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Published ${results.published}, Scheduled ${results.scheduled}, Failed ${results.failed}`,
      integration: {
        status: 'simulated',
        note: 'TODO: Integrate with Facebook Graph API, Instagram API, etc.',
        requiredCredentials: [
          'Facebook App ID and App Secret',
          'Instagram Business Account',
          'Access Tokens with publish_actions permission',
        ],
      },
    })
  } catch (error) {
    console.error('Error auto-publishing to social media:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
