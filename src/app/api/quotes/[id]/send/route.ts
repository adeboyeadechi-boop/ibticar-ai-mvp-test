// API Route pour envoyer un devis par email (PRD-02-US-001)
// POST /api/quotes/[id]/send - Envoyer le devis au client

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

type Params = {
  params: Promise<{ id: string }>
}

// POST /api/quotes/[id]/send - Envoyer le devis
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: quoteId } = await params

    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER, SALES peuvent envoyer
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SALES'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les options d'envoi
    const body = await request.json()
    const {
      emailTo,
      emailCc,
      emailSubject,
      emailMessage,
      sendCopy = false,
    } = body

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
            companyName: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            email: true,
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
        items: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Ne pas envoyer si déjà converti en facture
    if (quote.convertedToInvoiceId) {
      return NextResponse.json(
        { error: 'Cannot send quote that has been converted to invoice' },
        { status: 400 }
      )
    }

    // Ne pas envoyer si déjà accepté ou rejeté
    if (['ACCEPTED', 'REJECTED'].includes(quote.status)) {
      return NextResponse.json(
        { error: 'Cannot send accepted or rejected quote' },
        { status: 400 }
      )
    }

    // Vérifier que le devis est valide
    if (new Date() > quote.validUntil) {
      return NextResponse.json(
        { error: 'Quote has expired. Please update validity date.' },
        { status: 400 }
      )
    }

    // Destinataire par défaut: email du client
    const recipientEmail = emailTo || quote.customer.email

    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'Customer email is required. Please provide emailTo or update customer profile.' },
        { status: 400 }
      )
    }

    // Préparer les données pour l'email
    const customerName = quote.customer.companyName || `${quote.customer.firstName} ${quote.customer.lastName}`

    const defaultSubject = emailSubject || `Devis ${quote.quoteNumber} - ${quote.team.name}`

    const defaultMessage = emailMessage || `
Bonjour ${customerName},

Veuillez trouver ci-joint votre devis ${quote.quoteNumber}.

Ce devis est valable jusqu'au ${new Date(quote.validUntil).toLocaleDateString('fr-DZ')}.

Montant total: ${Number(quote.total).toLocaleString('fr-DZ')} DZD TTC

${quote.vehicle ? `Véhicule concerné: ${quote.vehicle.model.brand.name} ${quote.vehicle.model.name} (VIN: ${quote.vehicle.vin})` : ''}

N'hésitez pas à nous contacter pour toute question.

Cordialement,
${quote.team.name}
${quote.team.email}
    `.trim()

    // TODO: Intégrer avec un service d'email (SendGrid, AWS SES, etc.)
    // Pour l'instant, on simule l'envoi
    console.log('Sending quote email:', {
      to: recipientEmail,
      cc: emailCc,
      subject: defaultSubject,
      message: defaultMessage,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
    })

    // Simuler l'envoi (à remplacer par vraie intégration)
    const emailSent = true // await sendEmail(...)

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      )
    }

    // Mettre à jour le statut du devis
    const updatedQuote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    })

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Quote',
        entityId: quoteId,
        changes: {
          action: 'SENT_EMAIL',
          sentTo: recipientEmail,
          sentCc: emailCc,
          sentAt: new Date(),
        },
      },
    })

    // Si copie demandée, enregistrer aussi pour l'utilisateur
    if (sendCopy) {
      console.log('Sending copy to:', user.email)
      // TODO: Envoyer copie
    }

    return NextResponse.json({
      success: true,
      quote: {
        id: updatedQuote.id,
        quoteNumber: updatedQuote.quoteNumber,
        status: updatedQuote.status,
        sentAt: updatedQuote.sentAt,
      },
      email: {
        to: recipientEmail,
        cc: emailCc,
        subject: defaultSubject,
      },
      message: 'Quote sent successfully',
    })
  } catch (error) {
    console.error('Error sending quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
