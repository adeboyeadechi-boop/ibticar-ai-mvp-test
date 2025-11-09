// API Routes pour la gestion des fournisseurs
// GET /api/suppliers - Liste tous les fournisseurs
// POST /api/suppliers - Crée un nouveau fournisseur

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { SupplierType, SupplierStatus } from '@/generated/prisma'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/suppliers - Liste tous les fournisseurs
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer les paramètres de requête
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') as SupplierStatus | null
    const type = searchParams.get('type') as SupplierType | null

    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    // Recherche textuelle
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Filtres spécifiques
    if (status) where.status = status
    if (type) where.type = type

    // Récupérer les fournisseurs
    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          status: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          country: true,
          contactPerson: true,
          paymentTerms: true,
          rating: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.supplier.count({ where }),
    ])

    return NextResponse.json({
      suppliers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/suppliers - Crée un nouveau fournisseur
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification et permissions
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données du body
    const body = await request.json()
    const {
      name,
      code,
      type,
      email,
      phone,
      address,
      city,
      country,
      taxId,
      contactPerson,
      paymentTerms,
      rating,
      notes,
    } = body

    // Validation des champs requis
    if (!name || !code || !type || !email || !phone) {
      return NextResponse.json(
        {
          error: 'Missing required fields: name, code, type, email, phone',
        },
        { status: 400 }
      )
    }

    // Vérifier si le code existe déjà
    const existingSupplier = await prisma.supplier.findUnique({
      where: { code },
    })

    if (existingSupplier) {
      return NextResponse.json(
        { error: 'Supplier with this code already exists' },
        { status: 409 }
      )
    }

    // Créer le fournisseur
    const newSupplier = await prisma.supplier.create({
      data: {
        name,
        code,
        type,
        status: 'ACTIVE',
        email,
        phone,
        address,
        city,
        country,
        taxId,
        contactPerson,
        paymentTerms,
        rating,
        notes,
      },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        status: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        country: true,
        contactPerson: true,
        paymentTerms: true,
        rating: true,
        createdAt: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Supplier',
        entityId: newSupplier.id,
        changes: { created: newSupplier },
      },
    })

    return NextResponse.json(newSupplier, { status: 201 })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
