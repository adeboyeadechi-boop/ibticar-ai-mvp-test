#!/usr/bin/env node
/**
 * Force Database Initialization Script
 *
 * Ce script force la création des tables en utilisant db push
 * Utile quand les migrations échouent sur Vercel
 */

import { execSync } from 'child_process'

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

async function main() {
  log('\n' + '='.repeat(60), colors.blue)
  log('🚀 FORCE DATABASE INITIALIZATION', colors.blue)
  log('='.repeat(60) + '\n', colors.blue)

  if (!process.env.DATABASE_URL) {
    log('❌ DATABASE_URL not defined', colors.red)
    process.exit(1)
  }

  log('✓ DATABASE_URL configured', colors.green)

  // Étape 1 : Générer le client Prisma
  try {
    log('\n🔧 Generating Prisma Client...', colors.cyan)
    execSync('npx prisma generate', { stdio: 'inherit' })
    log('✓ Prisma Client generated', colors.green)
  } catch (error) {
    log('❌ Failed to generate Prisma Client', colors.red)
    process.exit(1)
  }

  // Étape 2 : Utiliser db push pour créer les tables
  try {
    log('\n📊 Pushing schema to database...', colors.cyan)
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      stdio: 'inherit'
    })
    log('✓ Database schema pushed successfully', colors.green)
  } catch (error) {
    log('❌ Failed to push schema', colors.red)
    process.exit(1)
  }

  // Étape 3 : Seed (optionnel)
  try {
    log('\n🌱 Seeding database...', colors.cyan)
    execSync('npx prisma db seed', { stdio: 'inherit' })
    log('✓ Database seeded', colors.green)
  } catch (error) {
    log('⚠️  Seed failed (non-critical)', colors.yellow)
  }

  log('\n' + '='.repeat(60), colors.green)
  log('✅ DATABASE INITIALIZED SUCCESSFULLY!', colors.green)
  log('='.repeat(60) + '\n', colors.green)
}

main().catch((error) => {
  log('\n❌ Initialization failed', colors.red)
  console.error(error)
  process.exit(1)
})
