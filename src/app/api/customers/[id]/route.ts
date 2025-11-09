// API Routes pour la gestion d'un client spécifique
// GET /api/customers/[id] - Récupère un client
// PATCH /api/customers/[id] - Met à jour un client
// DELETE /api/customers/[id] - Supprime un client

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/customers/[id] - Récupère un client avec tous ses détails
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer le client avec toutes ses relations
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        type: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        wilaya: true,
        postalCode: true,
        dateOfBirth: true,
        idType: true,
        idNumber: true,
        profession: true,
        companyName: true,
        taxId: true,
        status: true,
        source: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/customers/[id] - Met à jour un client
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification et permissions
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le client existe
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
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
      status,
      source,
      tags,
    } = body

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (type !== undefined) updateData.type = type
    if (firstName !== undefined) updateData.firstName = firstName
    if (lastName !== undefined) updateData.lastName = lastName
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (wilaya !== undefined) updateData.wilaya = wilaya
    if (postalCode !== undefined) updateData.postalCode = postalCode
    if (dateOfBirth !== undefined)
      updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null
    if (idType !== undefined) updateData.idType = idType
    if (idNumber !== undefined) updateData.idNumber = idNumber
    if (profession !== undefined) updateData.profession = profession
    if (companyName !== undefined) updateData.companyName = companyName
    if (taxId !== undefined) updateData.taxId = taxId
    if (status !== undefined) updateData.status = status
    if (source !== undefined) updateData.source = source
    if (tags !== undefined) updateData.tags = tags

    // Mettre à jour le client
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: updateData,
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
        updatedAt: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Customer',
        entityId: id,
        changes: {
          before: existingCustomer,
          after: updatedCustomer,
        },
      },
    })

    return NextResponse.json(updatedCustomer)
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/customers/[id] - Supprime un client
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification et permissions (seuls ADMIN et SUPER_ADMIN)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le client existe
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Supprimer le client
    await prisma.customer.delete({
      where: { id },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'Customer',
        entityId: id,
        changes: { deleted: existingCustomer },
      },
    })

    return NextResponse.json({
      message: 'Customer deleted successfully',
      customerId: id,
    })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
