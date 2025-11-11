// API Route pour la gestion des comptes bancaires (PRD-02-US-009)
// GET /api/bank-accounts - Liste des comptes bancaires
// POST /api/bank-accounts - Ajouter un compte bancaire

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { Currency } from '@/generated/prisma'

// GET /api/bank-accounts - Liste des comptes bancaires
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    const searchParams = request.nextUrl.searchParams
    const teamId = searchParams.get('teamId')
    const isActive = searchParams.get('isActive')

    // Construire les filtres
    const where: any = {}
    if (teamId) where.teamId = teamId
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    // Récupérer les comptes bancaires
    const accounts = await prisma.bankAccount.findMany({
      where,
      orderBy: {
        bankName: 'asc',
      },
    })

    return NextResponse.json({
      accounts: accounts.map((acc) => ({
        ...acc,
        balance: Number(acc.balance),
      })),
      total: accounts.length,
    })
  } catch (error) {
    console.error('Error fetching bank accounts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/bank-accounts - Créer un compte bancaire
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent créer des comptes bancaires
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      teamId,
      bankName,
      accountNumber,
      rib,
      swift,
      currency,
      balance,
    } = body

    // Validation des champs requis
    if (!teamId || !bankName || !accountNumber || !rib) {
      return NextResponse.json(
        { error: 'Missing required fields: teamId, bankName, accountNumber, rib' },
        { status: 400 }
      )
    }

    // Vérifier que l'équipe existe
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Validation du RIB (Algérie: 20 chiffres)
    if (!/^\d{20}$/.test(rib.replace(/\s/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid RIB format. Expected 20 digits.' },
        { status: 400 }
      )
    }

    // Validation de la devise
    const validCurrencies: Currency[] = ['DZD', 'EUR', 'USD']
    const accountCurrency: Currency =
      currency && validCurrencies.includes(currency) ? currency : 'DZD'

    // Créer le compte bancaire
    const account = await prisma.bankAccount.create({
      data: {
        teamId,
        bankName,
        accountNumber,
        rib: rib.replace(/\s/g, ''),
        swift: swift || null,
        currency: accountCurrency,
        balance: balance ? parseFloat(balance) : 0,
        isActive: true,
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'BankAccount',
        entityId: account.id,
        changes: { created: account },
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Bank account created successfully',
        account: {
          ...account,
          balance: Number(account.balance),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating bank account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
