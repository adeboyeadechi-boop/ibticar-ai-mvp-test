// API Route pour envoyer les campagnes en attente
// POST /api/campaigns/send - Traite et envoie les campagnes actives (cron job)

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// POST /api/campaigns/send - Envoyer les campagnes
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'autorisation cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dev-secret'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Trouver les campagnes programmées dont la date de début est passée
    const now = new Date()
    const scheduledCampaigns = await prisma.marketingCampaign.findMany({
      where: {
        status: 'SCHEDULED',
        startDate: {
          lte: now,
        },
      },
    })

    // Lancer automatiquement les campagnes programmées
    for (const campaign of scheduledCampaigns) {
      await prisma.marketingCampaign.update({
        where: { id: campaign.id },
        data: { status: 'RUNNING' },
      })
    }

    // 2. Trouver les campagnes en cours
    const runningCampaigns = await prisma.marketingCampaign.findMany({
      where: {
        status: 'RUNNING',
        OR: [
          { endDate: null },
          {
            endDate: {
              gte: now,
            },
          },
        ],
      },
    })

    let totalSent = 0
    let totalFailed = 0
    const errors: any[] = []

    // 3. Pour chaque campagne en cours, envoyer aux destinataires en attente
    for (const campaign of runningCampaigns) {
      try {
        // Récupérer les destinataires en attente (batch de 100)
        const pendingRecipients = await prisma.campaignRecipient.findMany({
          where: {
            campaignId: campaign.id,
            status: 'PENDING',
          },
          take: 100, // Traiter par lots
        })

        if (pendingRecipients.length === 0) {
          // Si plus de destinataires en attente, marquer la campagne comme terminée
          await prisma.marketingCampaign.update({
            where: { id: campaign.id },
            data: { status: 'COMPLETED' },
          })
          continue
        }

        // Envoyer à chaque destinataire
        for (const recipient of pendingRecipients) {
          try {
            // Simuler l'envoi (dans un vrai système, utiliser un service d'emailing/SMS)
            const sendSuccess = Math.random() > 0.1 // 90% success rate

            if (sendSuccess) {
              // Créer une notification
              // Map campaign channel to notification channel
              let notificationChannel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP' = 'EMAIL'
              if (campaign.channel === 'EMAIL') notificationChannel = 'EMAIL'
              else if (campaign.channel === 'SMS') notificationChannel = 'SMS'
              else if (campaign.channel === 'WHATSAPP') notificationChannel = 'SMS' // Map WhatsApp to SMS for now

              await prisma.notification.create({
                data: {
                  userId: recipient.customerId,
                  type: 'MARKETING',
                  channel: notificationChannel,
                  priority: 'LOW',
                  title: campaign.name,
                  message: campaign.message,
                  data: {
                    campaignId: campaign.id,
                  },
                  status: 'SENT',
                  sentAt: new Date(),
                },
              })

              // Marquer comme envoyé
              await prisma.campaignRecipient.update({
                where: { id: recipient.id },
                data: {
                  status: 'SENT',
                  sentAt: new Date(),
                },
              })

              totalSent++
            } else {
              // Marquer comme échoué
              await prisma.campaignRecipient.update({
                where: { id: recipient.id },
                data: {
                  status: 'FAILED',
                },
              })

              totalFailed++
            }
          } catch (recipientError) {
            errors.push({
              campaignId: campaign.id,
              recipientId: recipient.id,
              error: String(recipientError),
            })
            totalFailed++
          }
        }

        // Mettre à jour les statistiques de la campagne
        const stats = await prisma.campaignRecipient.groupBy({
          by: ['status'],
          where: { campaignId: campaign.id },
          _count: true,
        })

        const sent = stats.find((s) => s.status === 'SENT')?._count || 0
        const opened = stats.find((s) => s.status === 'OPENED')?._count || 0
        const clicked = stats.find((s) => s.status === 'CLICKED')?._count || 0
        const converted = stats.find((s) => s.status === 'CONVERTED')?._count || 0

        await prisma.marketingCampaign.update({
          where: { id: campaign.id },
          data: { sent, opened, clicked, converted },
        })
      } catch (campaignError) {
        errors.push({
          campaignId: campaign.id,
          error: String(campaignError),
        })
      }
    }

    // 4. Vérifier les campagnes dont la date de fin est passée
    const expiredCampaigns = await prisma.marketingCampaign.findMany({
      where: {
        status: 'RUNNING',
        endDate: {
          not: null,
          lt: now,
        },
      },
    })

    for (const campaign of expiredCampaigns) {
      await prisma.marketingCampaign.update({
        where: { id: campaign.id },
        data: { status: 'COMPLETED' },
      })
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'CREATE',
        entityType: 'CampaignSend',
        entityId: null,
        changes: {
          action: 'cron_campaigns_sent',
          totalSent,
          totalFailed,
          scheduledLaunched: scheduledCampaigns.length,
          campaignsProcessed: runningCampaigns.length,
          campaignsCompleted: expiredCampaigns.length,
          errors: errors.length,
        },
      },
    })

    return NextResponse.json({
      success: true,
      totalSent,
      totalFailed,
      scheduledLaunched: scheduledCampaigns.length,
      campaignsProcessed: runningCampaigns.length,
      campaignsCompleted: expiredCampaigns.length,
      errors,
      message: `${totalSent} messages sent successfully`,
    })
  } catch (error) {
    console.error('Error sending campaigns:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
