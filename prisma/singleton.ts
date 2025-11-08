// prisma/singleton.ts

import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended'
import prisma from './client' // Importez votre client Prisma réel

// Dites à Jest de simuler le client Prisma
jest.mock('./client', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}))

// Assurez-vous que le mock est réinitialisé avant chaque test
beforeEach(() => {
  mockReset(prismaMock)
})

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>