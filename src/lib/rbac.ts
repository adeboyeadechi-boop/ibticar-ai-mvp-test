// Role-Based Access Control (RBAC) utilities
import prisma from '@/prisma/client'

// Permission cache (in-memory, TTL 5 minutes)
const permissionsCache = new Map<
  string,
  { permissions: Set<string>; timestamp: number }
>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get all permissions for a user (from their roles)
 * Results are cached for performance
 */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  // Check cache
  const cached = permissionsCache.get(userId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions
  }

  // Fetch from database
  const userRoles = await prisma.usersOnRoles.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  })

  const permissions = new Set<string>()

  for (const userRole of userRoles) {
    for (const rolePermission of userRole.role.permissions) {
      permissions.add(rolePermission.permission.code)
    }
  }

  // Cache the result
  permissionsCache.set(userId, {
    permissions,
    timestamp: Date.now(),
  })

  return permissions
}

/**
 * Check if a user has a specific permission
 * Supports wildcards (e.g., "vehicles:*" matches "vehicles:create", "vehicles:read", etc.)
 */
export async function checkPermission(
  userId: string,
  requiredPermission: string
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)

  // Direct match
  if (userPermissions.has(requiredPermission)) {
    return true
  }

  // Check wildcards
  const [module, action] = requiredPermission.split(':')
  const wildcardPermission = `${module}:*`

  if (userPermissions.has(wildcardPermission)) {
    return true
  }

  // Check super admin wildcard
  if (userPermissions.has('*:*')) {
    return true
  }

  return false
}

/**
 * Check if user has ALL of the required permissions
 */
export async function checkAllPermissions(
  userId: string,
  requiredPermissions: string[]
): Promise<boolean> {
  for (const permission of requiredPermissions) {
    const hasPermission = await checkPermission(userId, permission)
    if (!hasPermission) {
      return false
    }
  }
  return true
}

/**
 * Check if user has ANY of the required permissions
 */
export async function checkAnyPermission(
  userId: string,
  requiredPermissions: string[]
): Promise<boolean> {
  for (const permission of requiredPermissions) {
    const hasPermission = await checkPermission(userId, permission)
    if (hasPermission) {
      return true
    }
  }
  return false
}

/**
 * Clear permissions cache for a user (call when roles/permissions change)
 */
export function clearUserPermissionsCache(userId: string) {
  permissionsCache.delete(userId)
}

/**
 * Clear all permissions cache
 */
export function clearAllPermissionsCache() {
  permissionsCache.clear()
}

/**
 * Get all permissions with their details for a user
 */
export async function getUserPermissionsDetails(userId: string) {
  const userRoles = await prisma.usersOnRoles.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  description: true,
                  module: true,
                  action: true,
                  resource: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const permissions: Array<{
    code: string
    name: string
    description: string | null
    module: string
    action: string
    resource: string
    fromRole: string
  }> = []

  for (const userRole of userRoles) {
    for (const rolePermission of userRole.role.permissions) {
      permissions.push({
        ...rolePermission.permission,
        fromRole: userRole.role.name,
      })
    }
  }

  return permissions
}
