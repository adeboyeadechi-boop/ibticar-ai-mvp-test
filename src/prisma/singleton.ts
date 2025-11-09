// Mock Prisma Client for Jest tests
// This file runs before all tests and provides a mocked Prisma client

import { PrismaClient } from '@/generated/prisma'
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended'

import prisma from './client'

jest.mock('./client', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}))

beforeEach(() => {
  mockReset(prismaMock)
})

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
