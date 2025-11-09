// /src/app/api/health/route.ts
/**
 * Health Check Endpoint
 *
 * GET /api/health - Vérifie l'état de l'application et de la DB
 */

import { NextResponse } from 'next/server'
import prisma from '@/prisma/client'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: {
    application: {
      status: 'up'
      version: string
      environment: string
    }
    database: {
      status: 'connected' | 'disconnected' | 'error'
      responseTime?: number
      error?: string
    }
  }
  uptime: number
}

/**
 * Vérifie la connexion à la base de données
 */
async function checkDatabaseConnection(): Promise<{
  status: 'connected' | 'disconnected' | 'error'
  responseTime?: number
  error?: string
}> {
  const startTime = Date.now()

  try {
    // Test de connexion simple
    await prisma.$queryRaw`SELECT 1`

    const responseTime = Date.now() - startTime

    return {
      status: 'connected',
      responseTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return {
      status: 'error',
      responseTime: Date.now() - startTime,
      error: errorMessage,
    }
  }
}

/**
 * GET /api/health
 * Retourne l'état de santé de l'application
 */
export async function GET() {
  const startTime = Date.now()

  // Vérifier la base de données
  const dbHealth = await checkDatabaseConnection()

  // Déterminer le statut global
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

  if (dbHealth.status === 'error') {
    overallStatus = 'unhealthy'
  } else if (dbHealth.status === 'disconnected') {
    overallStatus = 'degraded'
  }

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      application: {
        status: 'up',
        version: process.env.npm_package_version || '0.1.0',
        environment: process.env.NODE_ENV || 'development',
      },
      database: dbHealth,
    },
    uptime: process.uptime(),
  }

  // Statut HTTP basé sur l'état de santé
  const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 503 : 500

  return NextResponse.json(healthStatus, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': `${Date.now() - startTime}ms`,
    },
  })
}

/**
 * HEAD /api/health
 * Version allégée pour les load balancers
 */
export async function HEAD() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}

/**
 * OPTIONS /api/health
 * CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}
