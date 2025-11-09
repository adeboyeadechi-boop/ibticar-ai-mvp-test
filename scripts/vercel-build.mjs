#!/usr/bin/env node
/**
 * Script de build pour Vercel avec initialisation automatique de la DB
 *
 * Ce script s'exécute pendant le build Vercel et :
 * 1. Génère le Prisma Client
 * 2. Applique les migrations (si DB accessible)
 * 3. Seed la DB (si nécessaire)
 * 4. Build Next.js
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
            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
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

function execCommand(command, description, required = true) {
  try {
    log(`\n${description}...`, colors.cyan)
    execSync(command, { stdio: 'inherit' })
    log(`✓ ${description} - Succès`, colors.green)
    return true
  } catch (error) {
    if (required) {
      log(`✗ ${description} - Échec (CRITIQUE)`, colors.red)
      throw error
    } else {
      log(`⚠ ${description} - Échec (non-critique)`, colors.yellow)
      return false
    }
  }
}

async function main() {
  log('\n' + '='.repeat(60), colors.blue)
  log('🚀 BUILD VERCEL - IBTICAR.AI', colors.blue)
  log('='.repeat(60) + '\n', colors.blue)

  // Étape 1 : Vérifier DATABASE_URL
  if (!process.env.DATABASE_URL) {
    log('⚠️  DATABASE_URL non défini', colors.yellow)
    log('   La base de données ne sera pas initialisée', colors.yellow)
    log('   L\'application fonctionnera en mode dégradé', colors.yellow)
  } else {
    log('✓ DATABASE_URL configuré', colors.green)
  }

  // Étape 2 : Générer le Prisma Client (REQUIS)
  execCommand(
    'npx prisma generate',
    '🔧 Génération du Prisma Client',
    true // Requis
  )

  // Étape 3 : Appliquer les migrations (si DB accessible)
  if (process.env.DATABASE_URL) {
    try {
      execCommand(
        'npx prisma migrate deploy',
        '📊 Application des migrations',
        false // Non-critique, peut échouer si DB pas encore créée
      )
    } catch (error) {
      log('⚠️  Migrations non appliquées - DB peut-être inaccessible', colors.yellow)

      // Tentative avec db push (crée les tables sans migrations)
      try {
        log('\n🔄 Tentative avec db push...', colors.cyan)
        execCommand(
          'npx prisma db push --skip-generate --accept-data-loss',
          '📊 Création des tables (db push)',
          false
        )
      } catch (pushError) {
        log('⚠️  db push a également échoué', colors.yellow)
        log('   Les tables devront être créées manuellement', colors.yellow)
      }
    }

    // Étape 4 : Seed la base de données (optionnel)
    try {
      execCommand(
        'npx prisma db seed',
        '🌱 Seed de la base de données',
        false // Non-critique
      )
    } catch (error) {
      log('⚠️  Seed ignoré (peut-être déjà effectué)', colors.yellow)
    }
  } else {
    log('\n⏭️  Étapes DB ignorées (DATABASE_URL manquant)', colors.yellow)
  }

  // Étape 5 : Build Next.js (REQUIS)
  execCommand(
    'next build',
    '🏗️  Build Next.js',
    true // Requis
  )

  // Succès !
  log('\n' + '='.repeat(60), colors.green)
  log('✅ BUILD TERMINÉ AVEC SUCCÈS !', colors.green)
  log('='.repeat(60) + '\n', colors.green)
}

// Exécuter le script
main().catch((error) => {
  log('\n✗ Build échoué', colors.red)
  console.error(error)
  process.exit(1)
})
