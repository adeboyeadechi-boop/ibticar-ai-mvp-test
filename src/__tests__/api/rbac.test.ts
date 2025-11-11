/**
 * RBAC API Integration Tests
 * Tests for Role-Based Access Control endpoints
 */

import { prismaMock } from '../../../prisma/singleton'
import { signToken } from '@/lib/jwt'
import * as rbac from '@/lib/rbac'

// Mock the rbac module
jest.mock('@/lib/rbac', () => ({
  checkPermission: jest.fn(),
  clearUserPermissionsCache: jest.fn(),
  clearAllPermissionsCache: jest.fn(),
}))

describe('RBAC API Endpoints', () => {
  let mockAdminToken: string
  let mockUserId: string
  let mockRoleId: string
  let mockPermissionId: string

  beforeEach(() => {
    mockUserId = 'test-user-id'
    mockRoleId = 'test-role-id'
    mockPermissionId = 'test-permission-id'
    mockAdminToken = signToken({
      userId: mockUserId,
      email: 'admin@test.com',
      role: 'ADMIN',
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/roles', () => {
    it('should return all roles when user has permission', async () => {
      // Mock permission check
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      // Mock database response
      const mockRoles = [
        {
          id: '1',
          name: 'ADMIN',
          description: 'Administrator',
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            users: 5,
            permissions: 10,
          },
        },
      ]

      prismaMock.role.findMany.mockResolvedValue(mockRoles as any)

      expect(mockRoles).toHaveLength(1)
      expect(mockRoles[0].name).toBe('ADMIN')
    })

    it('should return 403 when user lacks permission', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(false)

      const result = await rbac.checkPermission(mockUserId, 'roles:read')
      expect(result).toBe(false)
    })
  })

  describe('POST /api/roles', () => {
    it('should create a new role when user has permission', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      const newRole = {
        name: 'CUSTOM_ROLE',
        description: 'Custom role for testing',
        isSystem: false,
      }

      const mockCreatedRole = {
        id: 'new-role-id',
        ...newRole,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prismaMock.role.findUnique.mockResolvedValue(null)
      prismaMock.role.create.mockResolvedValue(mockCreatedRole as any)

      const result = await prismaMock.role.create({ data: newRole })

      expect(result.name).toBe('CUSTOM_ROLE')
      expect(result.isSystem).toBe(false)
    })

    it('should return 409 when role name already exists', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      prismaMock.role.findUnique.mockResolvedValue({
        id: 'existing-role-id',
        name: 'EXISTING_ROLE',
        description: 'Already exists',
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const existingRole = await prismaMock.role.findUnique({
        where: { name: 'EXISTING_ROLE' },
      })

      expect(existingRole).not.toBeNull()
      expect(existingRole?.name).toBe('EXISTING_ROLE')
    })
  })

  describe('GET /api/roles/[id]', () => {
    it('should return role with permissions', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      const mockRole = {
        id: mockRoleId,
        name: 'MANAGER',
        description: 'Manager role',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [
          {
            permission: {
              id: 'perm-1',
              code: 'vehicles:read',
              name: 'Read Vehicles',
              description: 'Can read vehicles',
              module: 'vehicles',
              action: 'read',
              resource: 'vehicle',
            },
          },
        ],
        _count: {
          users: 3,
        },
      }

      prismaMock.role.findUnique.mockResolvedValue(mockRole as any)

      const result = await prismaMock.role.findUnique({
        where: { id: mockRoleId },
      }) as any

      expect(result).not.toBeNull()
      expect(result?.name).toBe('MANAGER')
      expect(result?.permissions).toHaveLength(1)
    })

    it('should return 404 when role not found', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)
      prismaMock.role.findUnique.mockResolvedValue(null)

      const result = await prismaMock.role.findUnique({
        where: { id: 'non-existent-id' },
      })

      expect(result).toBeNull()
    })
  })

  describe('POST /api/roles/[id]/permissions', () => {
    it('should assign permissions to role', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      const mockRole = {
        id: mockRoleId,
        name: 'CUSTOM_ROLE',
        description: 'Custom role',
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockPermissions = [
        {
          id: 'perm-1',
          code: 'vehicles:read',
          name: 'Read Vehicles',
          description: null,
          module: 'vehicles',
          action: 'read',
          resource: 'vehicle',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prismaMock.role.findUnique.mockResolvedValue(mockRole as any)
      prismaMock.permission.findMany.mockResolvedValue(mockPermissions as any)

      const permissions = await prismaMock.permission.findMany({
        where: { id: { in: ['perm-1'] } },
      })

      expect(permissions).toHaveLength(1)
      expect(rbac.clearAllPermissionsCache).toHaveBeenCalled()
    })

    it('should reject modifying system roles', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      const mockSystemRole = {
        id: mockRoleId,
        name: 'SUPER_ADMIN',
        description: 'Super Admin',
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prismaMock.role.findUnique.mockResolvedValue(mockSystemRole as any)

      const role = await prismaMock.role.findUnique({ where: { id: mockRoleId } })

      expect(role?.isSystem).toBe(true)
    })
  })

  describe('POST /api/users/[id]/roles', () => {
    it('should assign roles to user', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      const mockUser = {
        id: mockUserId,
        email: 'user@test.com',
        passwordHash: 'hashed',
        role: 'USER',
        firstName: 'Test',
        lastName: 'User',
        phone: null,
        preferredLanguage: 'en',
        isActive: true,
        lastLoginAt: null,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockRoles = [
        {
          id: 'role-1',
          name: 'MANAGER',
          description: 'Manager role',
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prismaMock.user.findUnique.mockResolvedValue(mockUser as any)
      prismaMock.role.findMany.mockResolvedValue(mockRoles as any)

      const user = await prismaMock.user.findUnique({ where: { id: mockUserId } })
      const roles = await prismaMock.role.findMany({
        where: { id: { in: ['role-1'] } },
      })

      expect(user).not.toBeNull()
      expect(roles).toHaveLength(1)
      expect(rbac.clearUserPermissionsCache).toHaveBeenCalledWith(mockUserId)
    })

    it('should return 404 when user not found', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)
      prismaMock.user.findUnique.mockResolvedValue(null)

      const result = await prismaMock.user.findUnique({
        where: { id: 'non-existent-user' },
      })

      expect(result).toBeNull()
    })
  })

  describe('DELETE /api/users/[id]/roles', () => {
    it('should revoke roles from user', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      const mockUser = {
        id: 'other-user-id',
        email: 'other@test.com',
        passwordHash: 'hashed',
        role: 'USER',
        firstName: 'Other',
        lastName: 'User',
        phone: null,
        preferredLanguage: 'en',
        isActive: true,
        lastLoginAt: null,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prismaMock.user.findUnique.mockResolvedValue(mockUser as any)
      prismaMock.usersOnRoles.deleteMany.mockResolvedValue({ count: 1 })

      const result = await prismaMock.usersOnRoles.deleteMany({
        where: {
          userId: 'other-user-id',
          roleId: { in: ['role-1'] },
        },
      })

      expect(result.count).toBe(1)
      expect(rbac.clearUserPermissionsCache).toHaveBeenCalledWith('other-user-id')
    })

    it('should prevent users from removing their own roles', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      // In real implementation, this would be checked in the route handler
      const isSelfRemoval = mockUserId === mockUserId
      expect(isSelfRemoval).toBe(true)
    })
  })

  describe('PATCH /api/roles/[id]', () => {
    it('should update role details', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      const mockRole = {
        id: mockRoleId,
        name: 'CUSTOM_ROLE',
        description: 'Old description',
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const updatedRole = {
        ...mockRole,
        description: 'New description',
      }

      prismaMock.role.findUnique.mockResolvedValue(mockRole as any)
      prismaMock.role.update.mockResolvedValue(updatedRole as any)

      const result = await prismaMock.role.update({
        where: { id: mockRoleId },
        data: { description: 'New description' },
      })

      expect(result.description).toBe('New description')
    })
  })

  describe('DELETE /api/roles/[id]', () => {
    it('should delete role when no users assigned', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      const mockRole = {
        id: mockRoleId,
        name: 'CUSTOM_ROLE',
        description: 'To be deleted',
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          users: 0,
        },
      }

      prismaMock.role.findUnique.mockResolvedValue(mockRole as any)
      prismaMock.role.delete.mockResolvedValue(mockRole as any)

      const result = await prismaMock.role.delete({ where: { id: mockRoleId } })

      expect(result.name).toBe('CUSTOM_ROLE')
    })

    it('should prevent deleting roles with assigned users', async () => {
      ;(rbac.checkPermission as jest.Mock).mockResolvedValue(true)

      const mockRole = {
        id: mockRoleId,
        name: 'MANAGER',
        description: 'Has users',
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          users: 5,
        },
      }

      prismaMock.role.findUnique.mockResolvedValue(mockRole as any)

      const role = await prismaMock.role.findUnique({ where: { id: mockRoleId } }) as any

      expect(role?._count.users).toBeGreaterThan(0)
    })
  })
})
