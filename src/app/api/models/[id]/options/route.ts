// API Route pour les options disponibles d'un modèle de véhicule
// GET /api/models/[id]/options - Options et packages disponibles

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/models/[id]/options - Options disponibles pour le modèle
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: modelId } = await params

    // Vérifier que le modèle existe
    const model = await prisma.vehicleModel.findUnique({
      where: { id: modelId },
      include: {
        brand: true,
      },
    })

    if (!model) {
      return NextResponse.json({ error: 'Vehicle model not found' }, { status: 404 })
    }

    // Récupérer les configurations existantes pour ce modèle
    const existingConfigurations = await prisma.vehicleConfiguration.findMany({
      where: { vehicleModelId: modelId },
      orderBy: { basePrice: 'asc' },
    })

    // Générer les options disponibles (données statiques pour l'exemple)
    // Dans un vrai système, ces données viendraient d'une table Options
    const availableOptions = generateOptionsForModel(model)

    return NextResponse.json({
      model: {
        id: model.id,
        brand: model.brand.name,
        name: model.name,
        basePrice: 0, // À définir selon le trim
        fuelType: model.fuelType,
        transmission: model.transmission,
      },
      trims: generateTrimsForModel(model),
      options: availableOptions,
      existingConfigurations: existingConfigurations.map((config) => ({
        id: config.id,
        name: config.name,
        trim: config.trim,
        totalPrice: Number(config.totalPrice),
        availability: config.availability,
        deliveryTime: config.deliveryTime,
      })),
    })
  } catch (error) {
    console.error('Error fetching model options:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Générer les trims/finitions disponibles pour un modèle
function generateTrimsForModel(model: any) {
  // Dans un vrai système, ces données viendraient de la base de données
  return [
    {
      id: 'base',
      name: 'Base',
      description: 'Version de base',
      basePrice: 3000000, // 3M DZD
      features: [
        'Climatisation manuelle',
        'Radio Bluetooth',
        'Direction assistée',
        'Vitres électriques avant',
      ],
    },
    {
      id: 'comfort',
      name: 'Comfort',
      description: 'Version confort',
      basePrice: 3500000, // 3.5M DZD
      features: [
        'Climatisation automatique',
        'Écran tactile 7"',
        'Sièges en tissu premium',
        'Vitres électriques',
        'Régulateur de vitesse',
      ],
    },
    {
      id: 'premium',
      name: 'Premium',
      description: 'Version haut de gamme',
      basePrice: 4200000, // 4.2M DZD
      features: [
        'Climatisation bi-zone',
        'Écran tactile 10"',
        'Sièges en cuir',
        'Navigation GPS',
        'Caméra de recul',
        'Capteurs de stationnement',
      ],
    },
  ]
}

// Générer les options disponibles pour un modèle
function generateOptionsForModel(model: any) {
  return {
    exteriorColors: [
      { id: 'white', name: 'Blanc Glacier', price: 0, hex: '#FFFFFF' },
      { id: 'black', name: 'Noir Métallisé', price: 50000, hex: '#000000' },
      { id: 'silver', name: 'Argent', price: 50000, hex: '#C0C0C0' },
      { id: 'blue', name: 'Bleu Océan', price: 75000, hex: '#0066CC' },
      { id: 'red', name: 'Rouge Passion', price: 75000, hex: '#CC0000' },
    ],
    interiorColors: [
      { id: 'black', name: 'Noir', price: 0 },
      { id: 'beige', name: 'Beige', price: 30000 },
      { id: 'brown', name: 'Marron', price: 30000 },
    ],
    wheels: [
      {
        id: '16-standard',
        name: 'Jantes 16" Standard',
        price: 0,
        description: 'Jantes en acier 16 pouces',
      },
      {
        id: '17-alloy',
        name: 'Jantes Alliage 17"',
        price: 120000,
        description: 'Jantes en alliage léger 17 pouces',
      },
      {
        id: '18-sport',
        name: 'Jantes Sport 18"',
        price: 200000,
        description: 'Jantes sport 18 pouces bi-ton',
      },
    ],
    packages: [
      {
        id: 'winter',
        name: 'Pack Hiver',
        price: 150000,
        description: 'Sièges chauffants, rétroviseurs chauffants, pare-brise chauffant',
        features: ['Sièges chauffants avant', 'Rétroviseurs chauffants', 'Pare-brise chauffant'],
      },
      {
        id: 'safety',
        name: 'Pack Sécurité',
        price: 250000,
        description: 'Aide au stationnement, régulateur adaptatif, détection angle mort',
        features: [
          'Aide au stationnement avant/arrière',
          'Régulateur de vitesse adaptatif',
          'Détection angle mort',
          'Alerte de franchissement de ligne',
        ],
      },
      {
        id: 'multimedia',
        name: 'Pack Multimédia',
        price: 180000,
        description: 'Système audio premium, navigation, connectivité',
        features: [
          'Système audio Bose 10 haut-parleurs',
          'Navigation GPS Premium',
          'Apple CarPlay / Android Auto',
          'Chargeur sans fil',
        ],
      },
    ],
    individualOptions: [
      {
        id: 'sunroof',
        name: 'Toit Ouvrant Panoramique',
        price: 350000,
        description: 'Grand toit ouvrant panoramique électrique',
      },
      {
        id: 'leather',
        name: 'Sièges Cuir Chauffants',
        price: 200000,
        description: 'Sièges avant en cuir avec fonction chauffante',
      },
      {
        id: 'camera360',
        name: 'Caméra 360°',
        price: 180000,
        description: 'Système de caméras à vision panoramique 360°',
      },
      {
        id: 'headup',
        name: 'Affichage Tête Haute',
        price: 150000,
        description: 'Affichage des informations sur le pare-brise',
      },
      {
        id: 'led',
        name: 'Phares LED Matrix',
        price: 220000,
        description: 'Phares LED adaptatifs avec éclairage matriciel',
      },
    ],
  }
}
