#!/usr/bin/env node
/**
 * Script d'initialisation et de vérification de la base de données (Version JS)
 *
 * Ce script vérifie que la base de données est opérationnelle et correctement
 * configurée avec Prisma. Si nécessaire, il initialise automatiquement.
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Charger les variables d'environnement depuis .env si elles ne sont pas déjà chargées
function loadEnv() {
  if (!process.env.DATABASE_URL) {
    const envPath = join(__dirname, '..', '.env')
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf-8')
      envContent.split('\n').forEach((line) => {
        line = line.trim()
        if (line && !line.startsWith('#')) {
          const match = line.match(/^([^=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            let value = match[2].trim()
            // Supprimer les guillemets entourants si présents
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1)
            }
            // Ne pas écraser les variables déjà définies
            if (!process.env[key]) {
              process.env[key] = value
            }
          }
        }
      })
    }
  }
}

// Charger les variables d'environnement au démarrage
loadEnv()

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function execCommand(command, description) {
  try {
    log(`\n${description}...`, colors.cyan)
    execSync(command, { stdio: 'inherit', cwd: join(__dirname, '..') })
    log(`✓ ${description} - Succès`, colors.green)
    return true
  } catch (error) {
    log(`✗ ${description} - Échec`, colors.red)
    return false
  }
}

function checkPrismaClientExists() {
  const prismaClientPath = join(__dirname, '..', 'src', 'generated', 'prisma')
  const exists = existsSync(prismaClientPath)

  if (exists) {
    log('✓ Client Prisma trouvé', colors.green)
  } else {
    log('✗ Client Prisma non trouvé', colors.yellow)
  }

  return exists
}

function generatePrismaClient() {
  return execCommand('npx prisma generate', '🔧 Génération du client Prisma')
}

function checkMigrationsStatus() {
  try {
    log('\n📋 Vérification du statut des migrations...', colors.cyan)
    execSync('npx prisma migrate status', {
      stdio: 'inherit',
      cwd: join(__dirname, '..'),
    })
    log('✓ Migrations à jour', colors.green)
    return true
  } catch (error) {
    log('⚠ Des migrations sont en attente', colors.yellow)
    return false
  }
}

function applyMigrations() {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    // En production, utiliser migrate deploy
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

async function checkDatabaseConnection() {
  try {
    log('\n📊 Vérification de la connexion à la base de données...', colors.cyan)

    // Tenter de se connecter avec Prisma
    const prismaClientPath = join(
      __dirname,
      '..',
      'src',
      'generated',
      'prisma',
      'index.js'
    )

    if (!existsSync(prismaClientPath)) {
      log('⚠ Client Prisma non trouvé, génération nécessaire', colors.yellow)
      return false
    }

    // Convertir le chemin Windows en file:// URL pour ESM
    const prismaClientUrl = new URL(`file:///${prismaClientPath.replace(/\\/g, '/')}`).href

    const { PrismaClient } = await import(prismaClientUrl)
    const prisma = new PrismaClient()

    await prisma.$connect()
    await prisma.$disconnect()

    log('✓ Connexion à la base de données établie', colors.green)
    return true
  } catch (error) {
    log('✗ Impossible de se connecter à la base de données', colors.red)
    if (error && error.message) {
      log(`  Erreur: ${error.message}`, colors.red)
    }
    return false
  }
}

async function main() {
  log('\n' + '='.repeat(60), colors.blue)
  log('🚀 INITIALISATION DE LA BASE DE DONNÉES', colors.blue)
  log('='.repeat(60) + '\n', colors.blue)

  // Étape 1 : Vérifier si DATABASE_URL est défini
  if (!process.env.DATABASE_URL) {
    log(
      "✗ DATABASE_URL n'est pas défini dans les variables d'environnement",
      colors.red
    )
    log('  Veuillez configurer DATABASE_URL dans votre fichier .env', colors.yellow)
    process.exit(1)
  }
  log('✓ DATABASE_URL configuré', colors.green)

  // Étape 2 : Vérifier et générer le client Prisma si nécessaire
  if (!checkPrismaClientExists()) {
    log("\n⚠ Le client Prisma n'existe pas, génération en cours...", colors.yellow)
    if (!generatePrismaClient()) {
      log('\n✗ Échec de la génération du client Prisma', colors.red)
      process.exit(1)
    }
  }

  // Étape 3 : Vérifier la connexion à la base de données
  const isConnected = await checkDatabaseConnection()
  if (!isConnected) {
    log("\n⚠ La base de données n'est pas accessible", colors.yellow)
    log('  Assurez-vous que PostgreSQL est démarré et accessible', colors.yellow)
    log('  Pour Docker: docker-compose up -d', colors.cyan)
    process.exit(1)
  }

  // Étape 4 : Vérifier et appliquer les migrations si nécessaire
  const migrationsUpToDate = checkMigrationsStatus()
  if (!migrationsUpToDate) {
    log('\n⚠ Application des migrations nécessaire...', colors.yellow)
    if (!applyMigrations()) {
      log("\n✗ Échec de l'application des migrations", colors.red)
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
  log("\n✗ Erreur inattendue lors de l'initialisation", colors.red)
  console.error(error)
  process.exit(1)
})
