#!/usr/bin/env node
/**
 * Script de démarrage avec vérification de la base de données
 *
 * Ce script vérifie et initialise la base de données avant de démarrer l'application Next.js
 */

import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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

async function runScript(scriptPath, description) {
  return new Promise((resolve, reject) => {
    log(`\n${description}...`, colors.cyan)

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: join(__dirname, '..'),
      shell: true,
    })

    child.on('close', (code) => {
      if (code === 0) {
        log(`✓ ${description} - Succès`, colors.green)
        resolve(true)
      } else {
        log(`✗ ${description} - Échec (code: ${code})`, colors.red)
        reject(new Error(`${description} a échoué avec le code ${code}`))
      }
    })

    child.on('error', (error) => {
      log(`✗ ${description} - Erreur`, colors.red)
      reject(error)
    })
  })
}

async function startNextServer() {
  return new Promise((resolve, reject) => {
    log('\n🚀 Démarrage du serveur Next.js...', colors.blue)

    const isProduction = process.env.NODE_ENV === 'production'
    const command = isProduction ? 'npm' : 'npm'
    const args = isProduction ? ['start'] : ['run', 'dev']

    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: join(__dirname, '..'),
      shell: true,
    })

    child.on('error', (error) => {
      log('✗ Erreur lors du démarrage du serveur', colors.red)
      reject(error)
    })

    // Le serveur Next.js ne se termine pas normalement, on résout immédiatement
    resolve(true)
  })
}

async function main() {
  try {
    log('\n' + '='.repeat(60), colors.blue)
    log('🚀 DÉMARRAGE DE L\'APPLICATION IBTICAR.AI', colors.blue)
    log('='.repeat(60) + '\n', colors.blue)

    // Étape 1 : Vérifier et initialiser la base de données
    const initDbScript = join(__dirname, 'init-db.mjs')
    await runScript(initDbScript, '📊 Vérification de la base de données')

    // Étape 2 : Démarrer le serveur Next.js
    await startNextServer()
  } catch (error) {
    log('\n✗ Échec du démarrage de l\'application', colors.red)
    console.error(error)
    process.exit(1)
  }
}

// Exécuter le script
main()
