// API Route pour vérifier et déclencher les alertes stock
// POST /api/alerts/check - Vérifie toutes les alertes actives (cron job)

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'

// POST /api/alerts/check - Vérifie et déclenche les alertes
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'autorisation cron (via header secret ou auth)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dev-secret'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer toutes les alertes actives
    const alerts = await prisma.alert.findMany({
      where: {
        isActive: true,
      },
    })

    const triggeredAlerts: string[] = []
    const errors: string[] = []

    // Vérifier chaque alerte
    for (const alert of alerts) {
      try {
        const shouldTrigger = await checkAlertCondition(alert)

        if (shouldTrigger) {
          // Déclencher les actions de l'alerte
          await executeAlertActions(alert)

          // Mettre à jour lastTriggeredAt
          await prisma.alert.update({
            where: { id: alert.id },
            data: {
              lastTriggeredAt: new Date(),
            },
          })

          triggeredAlerts.push(alert.id)
        }
      } catch (err: any) {
        errors.push(`Alert ${alert.id}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${alerts.length} alerts, triggered ${triggeredAlerts.length}`,
      summary: {
        totalAlerts: alerts.length,
        triggeredCount: triggeredAlerts.length,
        errorCount: errors.length,
        triggeredAlerts,
        errors,
      },
    })
  } catch (error) {
    console.error('Error checking alerts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Fonction helper pour vérifier une condition d'alerte
async function checkAlertCondition(alert: any): Promise<boolean> {
  const { type, conditions } = alert

  switch (type) {
    case 'STOCK_LEVEL':
      return await checkStockLevelAlert(conditions)

    case 'PRICE_CHANGE':
      return await checkPriceChangeAlert(conditions)

    case 'DOCUMENT_EXPIRY':
      return await checkDocumentExpiryAlert(conditions)

    case 'CUSTOM':
      // Custom logic basée sur les conditions JSON
      return await checkCustomAlert(conditions)

    default:
      return false
  }
}

// Vérifier alerte stock bas
async function checkStockLevelAlert(conditions: any): Promise<boolean> {
  const { teamId, threshold, status } = conditions

  const where: any = {}
  if (teamId) where.teamId = teamId
  if (status) where.status = status

  const count = await prisma.vehicle.count({ where })

  return count <= (threshold || 10)
}

// Vérifier alerte changement de prix
async function checkPriceChangeAlert(conditions: any): Promise<boolean> {
  const { vehicleId, minMarginPercentage } = conditions

  if (!vehicleId) return false

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      purchasePrice: true,
      sellingPrice: true,
    },
  })

  if (!vehicle) return false

  const margin = Number(vehicle.sellingPrice) - Number(vehicle.purchasePrice)
  const marginPercentage = (margin / Number(vehicle.purchasePrice)) * 100

  return marginPercentage < (minMarginPercentage || 10)
}

// Vérifier alerte expiration documents
async function checkDocumentExpiryAlert(conditions: any): Promise<boolean> {
  const { daysBeforeExpiry } = conditions
  const days = daysBeforeExpiry || 30

  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + days)

  // Vérifier documents qui expirent bientôt
  const documents = await prisma.document.count({
    where: {
      expiresAt: {
        lte: expiryDate,
        gte: new Date(),
      },
      isActive: true,
    },
  })

  return documents > 0
}

// Vérifier alerte personnalisée
async function checkCustomAlert(conditions: any): Promise<boolean> {
  // Implémenter logique custom basée sur les conditions
  // Pour l'instant, retourner false
  return false
}

// Fonction helper pour exécuter les actions d'une alerte
async function executeAlertActions(alert: any) {
  const { actions, userId } = alert

  // Actions possibles : email, SMS, notification in-app, webhook

  if (actions.notification) {
    // Créer une notification in-app
    await prisma.notification.create({
      data: {
        userId,
        type: 'STOCK_ALERT',
        channel: 'IN_APP',
        priority: actions.priority || 'MEDIUM',
        title: alert.name,
        message: actions.message || `Alert ${alert.name} triggered`,
        data: {
          alertId: alert.id,
          conditions: alert.conditions,
        },
        status: 'PENDING',
      },
    })
  }

  if (actions.email) {
    // TODO: Envoyer email via SendGrid/Resend
    // await sendEmail(userId, alert)
  }

  if (actions.sms) {
    // TODO: Envoyer SMS via Twilio
    // await sendSMS(userId, alert)
  }

  if (actions.webhook) {
    // TODO: Appeler webhook
    // await callWebhook(actions.webhook, alert)
  }
}

// GET /api/alerts/check - Pour tester manuellement (dev only)
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  return POST(request)
}
