// /src/app/api/setup/route.ts
/**
 * Endpoint de vérification et d'initialisation de la base de données
 *
 * GET  /api/setup - Vérifie l'état de la DB
 * POST /api/setup - Initialise la DB (migrations + seed)
 *
 * Sécurisé : Nécessite un token secret pour l'initialisation
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { execSync } from 'child_process'

// Token de sécurité pour l'initialisation (doit être défini en variable d'env)
const SETUP_TOKEN = process.env.SETUP_TOKEN || process.env.NEXTAUTH_SECRET

interface DatabaseStatus {
  connected: boolean
  tablesExist: boolean
  userCount?: number
  error?: string
}

/**
 * Vérifie l'état de la base de données
 */
async function checkDatabaseStatus(): Promise<DatabaseStatus> {
  try {
    // Tester la connexion
    await prisma.$connect()

    // Vérifier si des tables existent en comptant les utilisateurs
    const userCount = await prisma.user.count()

    await prisma.$disconnect()

    return {
      connected: true,
      tablesExist: true,
      userCount,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Déterminer le type d'erreur
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      return {
        connected: true,
        tablesExist: false,
        error: 'Tables do not exist',
      }
    }

    return {
      connected: false,
      tablesExist: false,
      error: errorMessage,
    }
  }
}

/**
 * Initialise la base de données
 */
async function initializeDatabase(): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const status = await checkDatabaseStatus()

    // Si déjà initialisée
    if (status.connected && status.tablesExist && (status.userCount ?? 0) > 0) {
      return {
        success: true,
        message: 'Database already initialized',
        details: { userCount: status.userCount },
      }
    }

    const results = {
      migrations: false,
      seed: false,
    }

    // Appliquer les migrations
    if (!status.tablesExist) {
      try {
        execSync('npx prisma migrate deploy', { stdio: 'pipe' })
        results.migrations = true
      } catch (migrateError) {
        // Fallback: utiliser db push
        try {
          execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'pipe' })
          results.migrations = true
        } catch (pushError) {
          throw new Error('Failed to create database tables')
        }
      }
    }

    // Seed la base de données
    if ((status.userCount ?? 0) === 0) {
      try {
        execSync('npx prisma db seed', { stdio: 'pipe' })
        results.seed = true
      } catch (seedError) {
        // Seed non critique
        console.warn('Seed failed:', seedError)
      }
    }

    // Vérification finale
    const finalStatus = await checkDatabaseStatus()

    return {
      success: finalStatus.connected && finalStatus.tablesExist,
      message: 'Database initialized successfully',
      details: {
        migrations: results.migrations,
        seed: results.seed,
        userCount: finalStatus.userCount,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: 'Database initialization failed',
      details: { error: errorMessage },
    }
  }
}

/**
 * GET /api/setup
 * Vérifie l'état de la base de données
 */
export async function GET() {
  try {
    const status = await checkDatabaseStatus()

    return NextResponse.json(
      {
        status: status.connected ? 'connected' : 'disconnected',
        ready: status.connected && status.tablesExist,
        details: {
          databaseConnected: status.connected,
          tablesExist: status.tablesExist,
          userCount: status.userCount,
          error: status.error,
        },
        timestamp: new Date().toISOString(),
      },
      { status: status.connected ? 200 : 503 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        status: 'error',
        ready: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/setup
 * Initialise la base de données (nécessite authentification)
 */
export async function POST(request: NextRequest) {
  // Vérifier le token d'authentification
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token || token !== SETUP_TOKEN) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Valid setup token required',
      },
      { status: 401 }
    )
  }

  try {
    const result = await initializeDatabase()

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        details: result.details,
        timestamp: new Date().toISOString(),
      },
      { status: result.success ? 200 : 500 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/setup
 * CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}
