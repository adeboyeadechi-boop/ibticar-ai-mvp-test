// API Route pour générer des posts sociaux automatiquement (PRD-03-US-024)
// POST /api/marketplace/social/generate-post - Générer un post pour un véhicule

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// POST /api/marketplace/social/generate-post - Générer un post social
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent générer des posts
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { vehicleId, platforms, template, customMessage } = body

    // Validation
    if (!vehicleId) {
      return NextResponse.json(
        { error: 'Missing required field: vehicleId' },
        { status: 400 }
      )
    }

    // Récupérer le véhicule avec tous ses détails
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        model: {
          include: {
            brand: {
              select: {
                name: true,
                logoUrl: true,
              },
            },
          },
        },
        team: {
          select: {
            name: true,
            city: true,
            wilaya: true,
            phone: true,
            website: true,
          },
        },
        media: {
          where: {
            type: 'PHOTO',
          },
          orderBy: {
            order: 'asc',
          },
          take: 4,
        },
      },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Générer le contenu du post selon le template
    const postContent = generatePostContent(vehicle, template, customMessage)

    // Sélectionner les plateformes (par défaut: Facebook, Instagram)
    const targetPlatforms = platforms || ['FACEBOOK', 'INSTAGRAM']

    // Générer les variantes de post pour chaque plateforme
    const socialPosts = targetPlatforms.map((platform: string) => {
      const post = generatePlatformSpecificPost(platform, postContent, vehicle)
      return {
        platform,
        ...post,
      }
    })

    return NextResponse.json({
      success: true,
      vehicle: {
        id: vehicle.id,
        brand: vehicle.model.brand.name,
        model: vehicle.model.name,
        year: vehicle.year,
        price: Number(vehicle.sellingPrice),
      },
      posts: socialPosts,
      message: 'Social media posts generated successfully',
    })
  } catch (error) {
    console.error('Error generating social post:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fonction pour générer le contenu du post
function generatePostContent(vehicle: any, template?: string, customMessage?: string) {
  if (customMessage) {
    return customMessage
  }

  const brand = vehicle.model.brand.name
  const model = vehicle.model.name
  const year = vehicle.year
  const price = Number(vehicle.sellingPrice).toLocaleString('fr-DZ')
  const color = vehicle.color
  const mileage = vehicle.mileage.toLocaleString('fr-DZ')
  const city = vehicle.team.city
  const wilaya = vehicle.team.wilaya

  // Templates prédéfinis
  const templates = {
    standard: `🚗 ${brand} ${model} ${year} 🚗

⭐️ État: ${vehicle.condition === 'USED_EXCELLENT' ? 'Excellent' : vehicle.condition === 'USED_GOOD' ? 'Bon' : 'Neuf'}
🎨 Couleur: ${color}
📏 Kilométrage: ${mileage} km
💰 Prix: ${price} DZD

📍 Disponible à ${city}, ${wilaya}

✅ Véhicule contrôlé et garantie
📞 Contactez-nous pour plus d'informations

#${brand} #${model} #VoitureOccasion #Algérie #${wilaya.replace(/\s/g, '')}`,

    promotional: `🔥 OFFRE SPÉCIALE 🔥

${brand} ${model} ${year}
💸 Prix: ${price} DZD

✨ Caractéristiques:
• ${mileage} km
• ${color}
• ${vehicle.model.fuelType}
• ${vehicle.model.transmission}

📍 ${city} - ${wilaya}

⏰ Offre limitée - Ne manquez pas cette opportunité!

#PromoAuto #${brand} #OccasionAlgerie`,

    luxury: `✨ ${brand} ${model} ${year} ✨

Un véhicule d'exception vous attend!

🌟 Caractéristiques premium:
• Année: ${year}
• Kilométrage: ${mileage} km
• Couleur: ${color}
• ${vehicle.model.horsePower} CV

💎 Prix: ${price} DZD

📞 Réservez votre essai dès aujourd'hui!

#Luxury #${brand} #VoiturePremium`,

    brief: `${brand} ${model} ${year} - ${mileage} km
💰 ${price} DZD
📍 ${city}
📞 Contactez-nous!`,
  }

  return templates[template as keyof typeof templates] || templates.standard
}

// Fonction pour adapter le post à chaque plateforme
function generatePlatformSpecificPost(platform: string, content: string, vehicle: any) {
  const images = vehicle.media.map((m: any) => m.url)
  const mainImage = images[0] || null

  const basePost = {
    content,
    images,
    mainImage,
    url: `https://ibticar.ai/marketplace/vehicles/${vehicle.id}`,
    hashtags: [
      vehicle.model.brand.name,
      vehicle.model.name,
      'Algerie',
      vehicle.team.wilaya.replace(/\s/g, ''),
      'VoitureOccasion',
    ],
  }

  switch (platform.toUpperCase()) {
    case 'FACEBOOK':
      return {
        ...basePost,
        type: 'post',
        recommendedFormat: 'image_carousel',
        characterLimit: 63206,
        tips: [
          'Utilisez jusqu\'à 10 images',
          'Ajoutez un call-to-action "En savoir plus"',
          'Programmez aux heures de pointe (18h-21h)',
        ],
      }

    case 'INSTAGRAM':
      // Instagram a une limite de caractères plus stricte
      const shortContent = content.length > 2200 ? content.substring(0, 2197) + '...' : content
      return {
        ...basePost,
        content: shortContent,
        type: 'feed_post',
        recommendedFormat: 'carousel',
        characterLimit: 2200,
        tips: [
          'Maximum 10 images en carousel',
          'Utilisez des hashtags pertinents (max 30)',
          'Stories pour engagement immédiat',
        ],
        storyVersion: {
          content: `${vehicle.model.brand.name} ${vehicle.model.name} ${vehicle.year}\n${Number(vehicle.sellingPrice).toLocaleString('fr-DZ')} DZD\n\nSwipe up! 👆`,
          image: mainImage,
        },
      }

    case 'TWITTER':
    case 'X':
      // Twitter/X a une limite stricte de 280 caractères
      const twitterContent = `🚗 ${vehicle.model.brand.name} ${vehicle.model.name} ${vehicle.year}
${vehicle.mileage.toLocaleString('fr-DZ')} km - ${Number(vehicle.sellingPrice).toLocaleString('fr-DZ')} DZD
📍 ${vehicle.team.city}
🔗 Détails:`
      return {
        ...basePost,
        content: twitterContent,
        type: 'tweet',
        characterLimit: 280,
        tips: [
          'Maximum 4 images par tweet',
          'Utilisez des hashtags concis',
          'Ajoutez un lien vers la fiche produit',
        ],
      }

    case 'LINKEDIN':
      return {
        ...basePost,
        type: 'post',
        characterLimit: 3000,
        tips: [
          'Ton professionnel',
          'Mentionnez les aspects business',
          'Idéal pour les véhicules professionnels',
        ],
      }

    default:
      return basePost
  }
}
