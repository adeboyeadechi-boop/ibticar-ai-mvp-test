// API Route pour gérer les templates de campagnes
// GET /api/campaigns/templates - Liste des templates disponibles

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// Templates de campagnes prédéfinis
const campaignTemplates = [
  {
    id: 'welcome-new-customers',
    name: 'Bienvenue aux nouveaux clients',
    type: 'EMAIL',
    channel: 'EMAIL',
    description: 'Email de bienvenue pour les nouveaux clients inscrits',
    message:
      'Bienvenue chez Ibticar.AI ! Nous sommes ravis de vous compter parmi nos clients. Découvrez notre sélection de véhicules de qualité et bénéficiez de 10% de réduction sur votre premier achat.',
    targetAudience: {
      status: 'PROSPECT',
    },
    suggestedDuration: 7, // jours
  },
  {
    id: 'new-inventory-alert',
    name: 'Nouveaux véhicules en stock',
    type: 'EMAIL',
    channel: 'EMAIL',
    description: 'Notification des nouveaux véhicules disponibles',
    message:
      'De nouveaux véhicules viennent d\'arriver dans notre showroom ! Découvrez notre dernière sélection avant qu\'il ne soit trop tard. Visitez notre site ou contactez-nous pour plus d\'informations.',
    targetAudience: {
      status: 'ACTIVE',
    },
    suggestedDuration: 3,
  },
  {
    id: 'special-offer-vip',
    name: 'Offre spéciale VIP',
    type: 'SMS',
    channel: 'SMS',
    description: 'Offre exclusive pour les clients VIP',
    message:
      'OFFRE VIP : En tant que client privilégié, bénéficiez de 15% de réduction sur une sélection de véhicules premium. Offre valable 48h. Appelez-nous au 0XXX pour en profiter.',
    targetAudience: {
      status: 'VIP',
    },
    suggestedDuration: 2,
  },
  {
    id: 'reactivation-inactive',
    name: 'Réactivation clients inactifs',
    type: 'EMAIL',
    channel: 'EMAIL',
    description: 'Campagne de réactivation pour clients inactifs',
    message:
      'Vous nous manquez ! Revenez découvrir nos dernières offres et bénéficiez d\'une remise exceptionnelle de 12% sur votre prochain achat. Votre satisfaction est notre priorité.',
    targetAudience: {
      status: 'INACTIVE',
    },
    suggestedDuration: 14,
  },
  {
    id: 'seasonal-promotion',
    name: 'Promotion saisonnière',
    type: 'MULTI_CHANNEL',
    channel: 'EMAIL',
    description: 'Campagne pour les promotions saisonnières',
    message:
      'SOLDES D\'ÉTÉ ! Profitez de remises allant jusqu\'à 20% sur une large sélection de véhicules. Offre limitée dans le temps. Visitez notre showroom ou notre site web dès maintenant !',
    targetAudience: {},
    suggestedDuration: 30,
  },
  {
    id: 'test-drive-invitation',
    name: 'Invitation essai routier',
    type: 'SMS',
    channel: 'SMS',
    description: 'Invitation pour un essai routier gratuit',
    message:
      'Essai routier GRATUIT ! Testez le véhicule de vos rêves sans engagement. Réservez votre créneau dès maintenant en nous contactant. Équipe Ibticar.AI',
    targetAudience: {
      status: 'PROSPECT',
    },
    suggestedDuration: 7,
  },
  {
    id: 'feedback-request',
    name: 'Demande de feedback',
    type: 'EMAIL',
    channel: 'EMAIL',
    description: 'Demande d\'avis clients après achat',
    message:
      'Votre avis compte ! Nous aimerions connaître votre expérience avec Ibticar.AI. Prenez 2 minutes pour répondre à notre sondage et aidez-nous à nous améliorer.',
    targetAudience: {
      status: 'ACTIVE',
    },
    suggestedDuration: 5,
  },
  {
    id: 'loyalty-rewards',
    name: 'Programme de fidélité',
    type: 'EMAIL',
    channel: 'EMAIL',
    description: 'Communication sur le programme de fidélité',
    message:
      'Gagnez des points à chaque achat et profitez d\'avantages exclusifs ! Rejoignez notre programme de fidélité Ibticar.AI et accumulez des récompenses à chaque transaction.',
    targetAudience: {
      status: 'ACTIVE',
    },
    suggestedDuration: 60,
  },
]

// GET /api/campaigns/templates - Liste des templates
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Filtrage optionnel
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const channel = searchParams.get('channel')

    let filteredTemplates = campaignTemplates

    if (type) {
      filteredTemplates = filteredTemplates.filter((t) => t.type === type)
    }

    if (channel) {
      filteredTemplates = filteredTemplates.filter((t) => t.channel === channel)
    }

    return NextResponse.json({
      templates: filteredTemplates,
      total: filteredTemplates.length,
    })
  } catch (error) {
    console.error('Error fetching campaign templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
