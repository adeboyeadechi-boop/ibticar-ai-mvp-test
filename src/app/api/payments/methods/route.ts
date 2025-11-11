// API Route pour les méthodes de paiement disponibles en Algérie (PRD-02-US-003)
// GET /api/payments/methods - Liste des méthodes de paiement

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/payments/methods - Méthodes de paiement disponibles
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Méthodes de paiement spécifiques à l'Algérie
    const paymentMethods = [
      {
        code: 'CASH',
        name: 'Espèces (DZD)',
        description: 'Paiement en liquide au comptoir',
        icon: 'cash',
        isAvailable: true,
        processingTime: 'Immédiat',
        fees: 0,
        maxAmount: 500000, // 500k DZD limit pour cash
      },
      {
        code: 'CHECK',
        name: 'Chèque Bancaire',
        description: 'Chèque bancaire algérien',
        icon: 'check',
        isAvailable: true,
        processingTime: '2-5 jours ouvrables',
        fees: 0,
        maxAmount: null, // Pas de limite
        requiredInfo: ['Numéro de chèque', 'Banque émettrice', 'Date'],
      },
      {
        code: 'BANK_TRANSFER',
        name: 'Virement Bancaire',
        description: 'Virement depuis compte bancaire algérien',
        icon: 'bank',
        isAvailable: true,
        processingTime: '1-3 jours ouvrables',
        fees: 0,
        maxAmount: null,
        requiredInfo: ['RIB', 'Référence de virement'],
      },
      {
        code: 'CCP',
        name: 'CCP (Compte Chèque Postal)',
        description: 'Paiement via Algérie Poste CCP',
        icon: 'postal',
        isAvailable: true,
        processingTime: '1-2 jours ouvrables',
        fees: 0,
        maxAmount: null,
        requiredInfo: ['Numéro CCP', 'Clé'],
        website: 'https://www.poste.dz',
      },
      {
        code: 'DAHABIA',
        name: 'eDahabia',
        description: 'Carte de paiement électronique Algérie Poste',
        icon: 'card',
        isAvailable: true,
        processingTime: 'Immédiat',
        fees: 0,
        maxAmount: 200000, // 200k DZD per transaction
        requiredInfo: ['Numéro de carte (16 chiffres)', 'Date d\'expiration', 'CVV'],
        website: 'https://www.poste.dz/edahabia',
      },
      {
        code: 'CIB',
        name: 'CIB (Carte Interbancaire)',
        description: 'Carte bancaire interbancaire algérienne',
        icon: 'card',
        isAvailable: true,
        processingTime: 'Immédiat',
        fees: 0,
        maxAmount: 500000, // 500k DZD per transaction
        requiredInfo: ['Numéro de carte', 'Date d\'expiration', 'CVV'],
      },
      {
        code: 'BARIDI_MOB',
        name: 'BaridiMob',
        description: 'Paiement mobile Algérie Poste',
        icon: 'mobile',
        isAvailable: true,
        processingTime: 'Immédiat',
        fees: 0,
        maxAmount: 100000, // 100k DZD per transaction
        requiredInfo: ['Numéro de téléphone', 'Code PIN'],
        website: 'https://www.poste.dz/baridimob',
      },
      {
        code: 'CREDIT_CARD',
        name: 'Carte de Crédit Internationale',
        description: 'Visa, Mastercard (avec autorisation)',
        icon: 'card',
        isAvailable: false, // Nécessite autorisation Banque d'Algérie
        processingTime: 'Immédiat',
        fees: 0,
        maxAmount: null,
        note: 'Nécessite autorisation de la Banque d\'Algérie pour importation',
      },
      {
        code: 'INSTALLMENT',
        name: 'Paiement Échelonné',
        description: 'Paiement en plusieurs tranches',
        icon: 'calendar',
        isAvailable: true,
        processingTime: 'Selon échéancier',
        fees: 0,
        maxAmount: null,
        requiredInfo: ['Échéancier', 'Acompte initial (30% minimum)'],
      },
      {
        code: 'OTHER',
        name: 'Autre Méthode',
        description: 'Autre moyen de paiement convenu',
        icon: 'other',
        isAvailable: true,
        processingTime: 'Variable',
        fees: 0,
        maxAmount: null,
      },
    ]

    // Informations bancaires pour virements
    const bankingInfo = {
      supportedBanks: [
        'BNA - Banque Nationale d\'Algérie',
        'BEA - Banque Extérieure d\'Algérie',
        'BADR - Banque de l\'Agriculture et du Développement Rural',
        'BDL - Banque de Développement Local',
        'CPA - Crédit Populaire d\'Algérie',
        'CNEP - Caisse Nationale d\'Épargne et de Prévoyance',
        'AL BARAKA - Al Baraka Bank Algeria',
        'AL SALAM - Banque Al Salam Algeria',
        'ABC - Arab Banking Corporation',
        'NATIXIS - Natixis Algérie',
        'SOCIÉTÉ GÉNÉRALE - Société Générale Algérie',
        'BNP PARIBAS - BNP Paribas El Djazair',
        'TRUST - Trust Bank Algeria',
      ],
      ccpClé: 'Format: XXXXXXXXX Clé XX (11 chiffres + 2 chiffres)',
      ribFormat: 'Format: XX-XXXXX-XXXXXXXXXXX-XX (20 chiffres)',
    }

    // Réglementations algériennes
    const regulations = {
      cashLimit: 500000, // DZD
      cashLimitDescription: 'Limite de 500,000 DZD pour paiements en espèces (Loi de finances)',
      taxReporting: 'Tous les paiements >100,000 DZD doivent être déclarés',
      invoiceRequired: 'Facture obligatoire pour tous les paiements professionnels',
      receiptRequired: 'Reçu obligatoire pour tout paiement',
    }

    return NextResponse.json({
      paymentMethods,
      bankingInfo,
      regulations,
      currency: 'DZD',
      currencySymbol: 'دج',
      exchangeRate: {
        EUR: 145.50, // Example rate (to be fetched from API)
        USD: 135.20,
        lastUpdated: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error fetching payment methods:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
