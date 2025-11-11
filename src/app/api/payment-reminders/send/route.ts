// API Route pour envoyer les relances en attente (PRD-02-US-008)
// POST /api/payment-reminders/send - Traitement et envoi des relances

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'

// POST /api/payment-reminders/send - Envoyer les relances en attente
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Seuls ADMIN, SUPER_ADMIN, MANAGER peuvent envoyer des relances
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer les relances en attente dont la date est passée
    const now = new Date()
    const pendingReminders = await prisma.paymentReminder.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lte: now,
        },
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true,
            dueDate: true,
            total: true,
            amountPaid: true,
            amountDue: true,
            status: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            companyName: true,
          },
        },
      },
      take: 50, // Limiter à 50 par batch
    })

    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[],
    }

    for (const reminder of pendingReminders) {
      // Vérifier si la facture est toujours en retard
      if (['PAID', 'CANCELLED'].includes(reminder.invoice.status)) {
        // Marquer la relance comme annulée
        await prisma.paymentReminder.update({
          where: { id: reminder.id },
          data: {
            status: 'CANCELLED',
          },
        })

        results.skipped++
        results.details.push({
          reminderId: reminder.id,
          invoiceNumber: reminder.invoice.invoiceNumber,
          status: 'skipped',
          reason: 'Invoice is no longer overdue',
        })
        continue
      }

      // Préparer le message selon le type de relance
      const customerName =
        reminder.customer.companyName ||
        `${reminder.customer.firstName} ${reminder.customer.lastName}`

      let emailSubject = ''
      let emailMessage = ''

      const daysOverdue = Math.ceil(
        (now.getTime() - reminder.invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      switch (reminder.type) {
        case 'FIRST':
          emailSubject = `Rappel amical - Facture ${reminder.invoice.invoiceNumber}`
          emailMessage = `
Bonjour ${customerName},

Nous espérons que vous allez bien.

Nous vous rappelons que la facture ${reminder.invoice.invoiceNumber} d'un montant de ${Number(reminder.invoice.amountDue).toLocaleString('fr-DZ')} DZD est échue depuis ${daysOverdue} jour(s).

Montant dû: ${Number(reminder.invoice.amountDue).toLocaleString('fr-DZ')} DZD
Date d'échéance: ${new Date(reminder.invoice.dueDate).toLocaleDateString('fr-DZ')}

Si vous avez déjà effectué le paiement, veuillez ignorer ce message. Sinon, nous vous remercions de bien vouloir régulariser votre situation dans les plus brefs délais.

Cordialement,
          `.trim()
          break

        case 'SECOND':
          emailSubject = `Rappel de paiement - Facture ${reminder.invoice.invoiceNumber}`
          emailMessage = `
${customerName},

Nous constatons que malgré notre précédent rappel, la facture ${reminder.invoice.invoiceNumber} reste impayée depuis ${daysOverdue} jours.

Montant dû: ${Number(reminder.invoice.amountDue).toLocaleString('fr-DZ')} DZD
Date d'échéance: ${new Date(reminder.invoice.dueDate).toLocaleDateString('fr-DZ')}

Nous vous demandons de bien vouloir procéder au règlement dans un délai de 7 jours.

En cas de difficultés de paiement, merci de nous contacter pour trouver une solution.

Cordialement,
          `.trim()
          break

        case 'FINAL':
          emailSubject = `DERNIER RAPPEL - Facture ${reminder.invoice.invoiceNumber}`
          emailMessage = `
${customerName},

Malgré nos multiples relances, la facture ${reminder.invoice.invoiceNumber} demeure impayée depuis ${daysOverdue} jours.

Montant dû: ${Number(reminder.invoice.amountDue).toLocaleString('fr-DZ')} DZD TTC
Date d'échéance: ${new Date(reminder.invoice.dueDate).toLocaleDateString('fr-DZ')}

Ceci constitue notre dernier rappel avant engagement de procédures de recouvrement.

Nous vous demandons de régulariser votre situation sous 48 heures.

Pour tout renseignement ou arrangement de paiement, contactez-nous immédiatement.

Cordialement,
          `.trim()
          break

        default:
          emailSubject = `Rappel de paiement - Facture ${reminder.invoice.invoiceNumber}`
          emailMessage = `Veuillez procéder au paiement de la facture ${reminder.invoice.invoiceNumber}`
      }

      // TODO: Intégrer avec service d'email (SendGrid, AWS SES, etc.)
      console.log('Sending payment reminder:', {
        to: reminder.customer.email,
        subject: emailSubject,
        reminderId: reminder.id,
        invoiceNumber: reminder.invoice.invoiceNumber,
        type: reminder.type,
      })

      // Simuler l'envoi (à remplacer par vraie intégration)
      const emailSent = true // await sendEmail(...)

      if (emailSent) {
        // Marquer comme envoyée
        await prisma.paymentReminder.update({
          where: { id: reminder.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        })

        results.sent++
        results.details.push({
          reminderId: reminder.id,
          invoiceNumber: reminder.invoice.invoiceNumber,
          customerEmail: reminder.customer.email,
          type: reminder.type,
          status: 'sent',
        })

        // Log d'audit
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'UPDATE',
            entityType: 'PaymentReminder',
            entityId: reminder.id,
            changes: {
              action: 'SENT',
              sentTo: reminder.customer.email,
              sentAt: new Date(),
            },
          },
        })
      } else {
        results.failed++
        results.details.push({
          reminderId: reminder.id,
          invoiceNumber: reminder.invoice.invoiceNumber,
          status: 'failed',
          reason: 'Email sending failed',
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Reminders processed: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`,
    })
  } catch (error) {
    console.error('Error sending payment reminders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
