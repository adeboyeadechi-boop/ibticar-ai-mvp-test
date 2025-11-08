// jest.config.js

const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Indique le chemin vers votre application Next.js 
  // pour charger next.config.js et .env
  dir: './',
})

// Configuration Jest personnalisée
/** @type {import('jest').Config} */
const customJestConfig = {
  // Indique à Jest d'utiliser ts-jest pour les fichiers .ts/.tsx
  preset: 'ts-jest',
  
  // Définit l'environnement de test sur node, ce qui est crucial pour un backend
  testEnvironment: 'node',
  
  // Gère les alias d'importation (ex: @/lib/...)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // Ignore les node_modules et le .next
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  
  // Fichiers à exécuter avant tous les tests (nous l'utiliserons pour Prisma)
  setupFilesAfterEnv: ['<rootDir>/prisma/singleton.ts'],
}

// Exporte la configuration en la wrappant avec createJestConfig
module.exports = createJestConfig(customJestConfig)