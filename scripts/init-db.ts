#!/usr/bin/env tsx
/**
 * Script d'initialisation et de vérification de la base de données
 *
 * Ce script vérifie que la base de données est opérationnelle et correctement
 * configurée avec Prisma. Si nécessaire, il initialise automatiquement :
 * - La connexion à la base de données
 * - Les migrations Prisma
 * - Le client Prisma
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function execCommand(command: string, description: string): boolean {
  try {
    log(`\n${description}...`, colors.cyan)
    execSync(command, { stdio: 'inherit' })
    log(`✓ ${description} - Succès`, colors.green)
    return true
  } catch (error) {
    log(`✗ ${description} - Échec`, colors.red)
    return false
  }
}

async function checkDatabaseConnection(): Promise<boolean> {
  try {
    log('\n📊 Vérification de la connexion à la base de données...', colors.cyan)

    // Utiliser Prisma pour vérifier la connexion
    const { PrismaClient } = await import('../src/generated/prisma')
    const prisma = new PrismaClient()

    await prisma.$connect()
    await prisma.$disconnect()

    log('✓ Connexion à la base de données établie', colors.green)
    return true
  } catch (error) {
    log('✗ Impossible de se connecter à la base de données', colors.red)
    if (error instanceof Error) {
      log(`  Erreur: ${error.message}`, colors.red)
    }
    return false
  }
}

function checkPrismaClientExists(): boolean {
  const prismaClientPath = join(process.cwd(), 'src', 'generated', 'prisma')
  const exists = existsSync(prismaClientPath)

  if (exists) {
    log('✓ Client Prisma trouvé', colors.green)
  } else {
    log('✗ Client Prisma non trouvé', colors.yellow)
  }

  return exists
}

function generatePrismaClient(): boolean {
  return execCommand(
    'npx prisma generate',
    '🔧 Génération du client Prisma'
  )
}

async function checkMigrationsStatus(): Promise<boolean> {
  try {
    log('\n📋 Vérification du statut des migrations...', colors.cyan)
    execSync('npx prisma migrate status', { stdio: 'inherit' })
    log('✓ Migrations à jour', colors.green)
    return true
  } catch (error) {
    log('⚠ Des migrations sont en attente', colors.yellow)
    return false
  }
}

function applyMigrations(): boolean {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    // En production, utiliser migrate deploy (pas de modifications de schéma)
    return execCommand(
      'npx prisma migrate deploy',
      '🚀 Application des migrations (production)'
    )
  } else {
    // En développement, utiliser migrate dev
    return execCommand(
      'npx prisma migrate dev',
      '🛠️ Application des migrations (développement)'
    )
  }
}

async function main() {
  log('\n' + '='.repeat(60), colors.blue)
  log('🚀 INITIALISATION DE LA BASE DE DONNÉES', colors.blue)
  log('='.repeat(60) + '\n', colors.blue)

  // Étape 1 : Vérifier si DATABASE_URL est défini
  if (!process.env.DATABASE_URL) {
    log('✗ DATABASE_URL n\'est pas défini dans les variables d\'environnement', colors.red)
    log('  Veuillez configurer DATABASE_URL dans votre fichier .env', colors.yellow)
    process.exit(1)
  }
  log('✓ DATABASE_URL configuré', colors.green)

  // Étape 2 : Vérifier et générer le client Prisma si nécessaire
  if (!checkPrismaClientExists()) {
    log('\n⚠ Le client Prisma n\'existe pas, génération en cours...', colors.yellow)
    if (!generatePrismaClient()) {
      log('\n✗ Échec de la génération du client Prisma', colors.red)
      process.exit(1)
    }
  }

  // Étape 3 : Vérifier la connexion à la base de données
  const isConnected = await checkDatabaseConnection()
  if (!isConnected) {
    log('\n⚠ La base de données n\'est pas accessible', colors.yellow)
    log('  Assurez-vous que PostgreSQL est démarré et accessible', colors.yellow)
    log('  Pour Docker: docker-compose up -d', colors.cyan)
    process.exit(1)
  }

  // Étape 4 : Vérifier et appliquer les migrations si nécessaire
  const migrationsUpToDate = await checkMigrationsStatus()
  if (!migrationsUpToDate) {
    log('\n⚠ Application des migrations nécessaire...', colors.yellow)
    if (!applyMigrations()) {
      log('\n✗ Échec de l\'application des migrations', colors.red)
      process.exit(1)
    }
  }

  // Étape 5 : Vérification finale
  const finalCheck = await checkDatabaseConnection()
  if (!finalCheck) {
    log('\n✗ La vérification finale a échoué', colors.red)
    process.exit(1)
  }

  // Succès !
  log('\n' + '='.repeat(60), colors.green)
  log('✅ BASE DE DONNÉES PRÊTE !', colors.green)
  log('='.repeat(60) + '\n', colors.green)
  process.exit(0)
}

// Exécuter le script
main().catch((error) => {
  log('\n✗ Erreur inattendue lors de l\'initialisation', colors.red)
  console.error(error)
  process.exit(1)
})
