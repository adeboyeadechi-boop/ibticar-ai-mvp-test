// API Routes pour la gestion individuelle des devis (PRD-02-US-001)
// GET /api/quotes/[id] - Détails d'un devis
// PUT /api/quotes/[id] - Modifier un devis
// DELETE /api/quotes/[id] - Supprimer un devis

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// GET /api/quotes/[id] - Détails du devis
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: quoteId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Récupérer le devis
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            wilaya: true,
            companyName: true,
            taxId: true,
            type: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            wilaya: true,
            phone: true,
            email: true,
            logoUrl: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            vin: true,
            registrationNumber: true,
            year: true,
            color: true,
            mileage: true,
            condition: true,
            sellingPrice: true,
            model: {
              select: {
                id: true,
                name: true,
                category: true,
                fuelType: true,
                transmission: true,
                brand: {
                  select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                  },
                },
              },
            },
            media: {
              where: {
                isPrimary: true,
              },
              take: 1,
            },
          },
        },
        items: {
          orderBy: {
            order: 'asc',
          },
          include: {
            vehicle: {
              select: {
                id: true,
                vin: true,
                model: {
                  select: {
                    name: true,
                    brand: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        convertedInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Marquer comme vu si status = SENT et jamais vu avant
    if (quote.status === 'SENT' && !quote.viewedAt) {
      await prisma.quote.update({
        where: { id: quoteId },
        data: {
          status: 'VIEWED',
          viewedAt: new Date(),
        },
      })
      quote.status = 'VIEWED'
      quote.viewedAt = new Date()
    }

    return NextResponse.json({
      quote: {
        ...quote,
        subtotal: Number(quote.subtotal),
        taxAmount: Number(quote.taxAmount),
        discountAmount: Number(quote.discountAmount),
        total: Number(quote.total),
        items: quote.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          discountRate: Number(item.discountRate),
          total: Number(item.total),
        })),
        vehicle: quote.vehicle
          ? {
              ...quote.vehicle,
              sellingPrice: Number(quote.vehicle.sellingPrice),
            }
          : null,
        convertedInvoice: quote.convertedInvoice
          ? {
              ...quote.convertedInvoice,
              total: Number(quote.convertedInvoice.total),
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Error fetching quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/quotes/[id] - Modifier le devis
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id: quoteId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent modifier
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les données
    const body = await request.json()
    const { items, validUntil, discountAmount, notes, terms, status } = body

    // Vérifier que le devis existe
    const existingQuote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        items: true,
      },
    })

    if (!existingQuote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Ne pas permettre la modification si le devis est déjà converti en facture
    if (existingQuote.convertedToInvoiceId) {
      return NextResponse.json(
        { error: 'Cannot modify quote that has been converted to invoice' },
        { status: 400 }
      )
    }

    // Ne pas permettre la modification si le devis est accepté ou rejeté
    if (['ACCEPTED', 'REJECTED'].includes(existingQuote.status)) {
      return NextResponse.json(
        { error: 'Cannot modify accepted or rejected quote' },
        { status: 400 }
      )
    }

    // Construire les données de mise à jour
    const updateData: any = {}

    if (validUntil) updateData.validUntil = new Date(validUntil)
    if (notes !== undefined) updateData.notes = notes
    if (terms !== undefined) updateData.terms = terms
    if (status && ['DRAFT', 'SENT'].includes(status)) {
      updateData.status = status
      if (status === 'SENT' && !existingQuote.sentAt) {
        updateData.sentAt = new Date()
      }
    }

    // Si des items sont fournis, recalculer le total
    if (items && Array.isArray(items)) {
      const ALGERIAN_VAT_RATE = 0.19

      let subtotal = 0
      let totalTaxAmount = 0

      const processedItems = items.map((item: any, index: number) => {
        const unitPrice = Number(item.unitPrice)
        const quantity = item.quantity || 1
        const taxRate = item.taxRate !== undefined ? Number(item.taxRate) : ALGERIAN_VAT_RATE
        const discountRate = Number(item.discountRate || 0)

        const itemSubtotal = unitPrice * quantity
        const itemDiscount = itemSubtotal * discountRate
        const itemSubtotalAfterDiscount = itemSubtotal - itemDiscount
        const itemTax = itemSubtotalAfterDiscount * taxRate
        const itemTotal = itemSubtotalAfterDiscount + itemTax

        subtotal += itemSubtotalAfterDiscount
        totalTaxAmount += itemTax

        return {
          description: item.description,
          quantity,
          unitPrice,
          taxRate,
          discountRate,
          total: itemTotal,
          vehicleId: item.vehicleId || null,
          order: item.order !== undefined ? item.order : index,
        }
      })

      const globalDiscountAmount = Number(discountAmount || 0)
      const subtotalAfterDiscount = subtotal - globalDiscountAmount

      if (globalDiscountAmount > 0) {
        totalTaxAmount = subtotalAfterDiscount * ALGERIAN_VAT_RATE
      }

      const total = subtotalAfterDiscount + totalTaxAmount

      updateData.subtotal = subtotal
      updateData.taxAmount = totalTaxAmount
      updateData.discountAmount = globalDiscountAmount
      updateData.total = total

      // Supprimer les anciens items et créer les nouveaux
      await prisma.quoteItem.deleteMany({
        where: { quoteId },
      })

      updateData.items = {
        create: processedItems,
      }
    } else if (discountAmount !== undefined) {
      // Si seule la réduction globale change, recalculer
      const globalDiscountAmount = Number(discountAmount)
      const currentSubtotal = Number(existingQuote.subtotal)
      const subtotalAfterDiscount = currentSubtotal - globalDiscountAmount
      const totalTaxAmount = subtotalAfterDiscount * 0.19
      const total = subtotalAfterDiscount + totalTaxAmount

      updateData.discountAmount = globalDiscountAmount
      updateData.taxAmount = totalTaxAmount
      updateData.total = total
    }

    // Mettre à jour le devis
    const quote = await prisma.quote.update({
      where: { id: quoteId },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Quote',
        entityId: quoteId,
        changes: updateData,
      },
    })

    return NextResponse.json({
      success: true,
      quote: {
        ...quote,
        subtotal: Number(quote.subtotal),
        taxAmount: Number(quote.taxAmount),
        discountAmount: Number(quote.discountAmount),
        total: Number(quote.total),
        items: quote.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          discountRate: Number(item.discountRate),
          total: Number(item.total),
        })),
      },
      message: 'Quote updated successfully',
    })
  } catch (error) {
    console.error('Error updating quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/quotes/[id] - Supprimer le devis
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: quoteId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN peuvent supprimer
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Vérifier que le devis existe
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Ne pas permettre la suppression si déjà converti en facture
    if (quote.convertedToInvoiceId) {
      return NextResponse.json(
        { error: 'Cannot delete quote that has been converted to invoice' },
        { status: 400 }
      )
    }

    // Ne pas permettre la suppression si accepté
    if (quote.status === 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Cannot delete accepted quote' },
        { status: 400 }
      )
    }

    // Supprimer les items d'abord (cascade)
    await prisma.quoteItem.deleteMany({
      where: { quoteId },
    })

    // Supprimer le devis
    await prisma.quote.delete({
      where: { id: quoteId },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'Quote',
        entityId: quoteId,
        changes: {
          quoteNumber: quote.quoteNumber,
          status: quote.status,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Quote deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
