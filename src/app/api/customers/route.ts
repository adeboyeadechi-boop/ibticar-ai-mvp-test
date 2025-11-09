// API Routes pour la gestion des clients
// GET /api/customers - Liste tous les clients
// POST /api/customers - Crée un nouveau client

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { CustomerType, CustomerStatus } from '@/generated/prisma'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// GET /api/customers - Liste tous les clients
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
    const status = searchParams.get('status') as CustomerStatus | null
    const type = searchParams.get('type') as CustomerType | null

    const skip = (page - 1) * limit

    // Construire les filtres
    const where: any = {}

    // Recherche textuelle
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Filtres spécifiques
    if (status) where.status = status
    if (type) where.type = type

    // Récupérer les clients
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          type: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          wilaya: true,
          companyName: true,
          status: true,
          source: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.customer.count({ where }),
    ])

    return NextResponse.json({
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/customers - Crée un nouveau client
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification et permissions
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données du body
    const body = await request.json()
    const {
      type,
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      wilaya,
      postalCode,
      dateOfBirth,
      idType,
      idNumber,
      profession,
      companyName,
      taxId,
      source,
      tags,
    } = body

    // Validation des champs requis
    if (!type || !firstName || !lastName || !email || !phone) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: type, firstName, lastName, email, phone',
        },
        { status: 400 }
      )
    }

    // Vérifier si l'email existe déjà
    const existingCustomer = await prisma.customer.findUnique({
      where: { email },
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'Customer with this email already exists' },
        { status: 409 }
      )
    }

    // Créer le client
    const newCustomer = await prisma.customer.create({
      data: {
        type,
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        wilaya,
        postalCode,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        idType,
        idNumber,
        profession,
        companyName,
        taxId,
        status: 'PROSPECT',
        source,
        tags: tags || {},
      },
      select: {
        id: true,
        type: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        wilaya: true,
        companyName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'Customer',
        entityId: newCustomer.id,
        changes: { created: newCustomer },
      },
    })

    return NextResponse.json(newCustomer, { status: 201 })
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
