// API Routes pour la gestion d'un fournisseur spécifique
// GET /api/suppliers/[id] - Récupère un fournisseur
// PATCH /api/suppliers/[id] - Met à jour un fournisseur
// DELETE /api/suppliers/[id] - Supprime un fournisseur

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/suppliers/[id] - Récupère un fournisseur avec tous ses détails
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification (supporte NextAuth ET Bearer token)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer le fournisseur
    const supplier = await prisma.supplier.findUnique({
      where: { id },
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
        taxId: true,
        contactPerson: true,
        paymentTerms: true,
        rating: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Error fetching supplier:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/suppliers/[id] - Met à jour un fournisseur
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification et permissions
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le fournisseur existe
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    })

    if (!existingSupplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Récupérer les données du body
    const body = await request.json()
    const {
      name,
      type,
      status,
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

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (type !== undefined) updateData.type = type
    if (status !== undefined) updateData.status = status
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (country !== undefined) updateData.country = country
    if (taxId !== undefined) updateData.taxId = taxId
    if (contactPerson !== undefined) updateData.contactPerson = contactPerson
    if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms
    if (rating !== undefined) updateData.rating = rating
    if (notes !== undefined) updateData.notes = notes

    // Mettre à jour le fournisseur
    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: updateData,
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
        updatedAt: true,
      },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Supplier',
        entityId: id,
        changes: {
          before: existingSupplier,
          after: updatedSupplier,
        },
      },
    })

    return NextResponse.json(updatedSupplier)
  } catch (error) {
    console.error('Error updating supplier:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/suppliers/[id] - Supprime un fournisseur
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Vérifier l'authentification et permissions (seuls ADMIN et SUPER_ADMIN)
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le fournisseur existe
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    })

    if (!existingSupplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Supprimer le fournisseur
    await prisma.supplier.delete({
      where: { id },
    })

    // Créer un log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'Supplier',
        entityId: id,
        changes: { deleted: existingSupplier },
      },
    })

    return NextResponse.json({
      message: 'Supplier deleted successfully',
      supplierId: id,
    })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
