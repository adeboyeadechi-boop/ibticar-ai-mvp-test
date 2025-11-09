// User Roles Management
// GET /api/users/[id]/roles - Get user's roles
// POST /api/users/[id]/roles - Assign roles to a user
// DELETE /api/users/[id]/roles - Revoke roles from a user

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { checkPermission, clearUserPermissionsCache } from '@/lib/rbac'

// GET /api/users/[id]/roles - Get all roles for a user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Check permission (users can view their own roles, or need users:read permission)
    const isSelf = user.id === params.id
    if (!isSelf) {
      const hasPermission = await checkPermission(user.id, 'users:read')
      if (!hasPermission) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, firstName: true, lastName: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch user's roles with permissions
    const userRoles = await prisma.usersOnRoles.findMany({
      where: { userId: params.id },
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
            _count: {
              select: {
                permissions: true,
              },
            },
          },
        },
      },
    })

    // Transform response
    const roles = userRoles.map((ur) => ({
      ...ur.role,
      assignedAt: ur.assignedAt,
      permissions: ur.role.permissions.map((rp) => rp.permission),
    }))

    return NextResponse.json({
      user: targetUser,
      roles,
    })
  } catch (error) {
    console.error('Error fetching user roles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/users/[id]/roles - Assign roles to a user
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Check permission
    const hasPermission = await checkPermission(user.id, 'users:update')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { roleIds } = body

    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return NextResponse.json(
        { error: 'roleIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify all roles exist
    const roles = await prisma.role.findMany({
      where: {
        id: {
          in: roleIds,
        },
      },
    })

    if (roles.length !== roleIds.length) {
      return NextResponse.json(
        { error: 'One or more roles not found' },
        { status: 404 }
      )
    }

    // Assign roles (upsert to avoid duplicates)
    const operations = roleIds.map((roleId) =>
      prisma.usersOnRoles.upsert({
        where: {
          userId_roleId: {
            userId: params.id,
            roleId,
          },
        },
        update: {
          assignedAt: new Date(),
        },
        create: {
          userId: params.id,
          roleId,
        },
      })
    )

    await prisma.$transaction(operations)

    // Clear permissions cache for this user
    clearUserPermissionsCache(params.id)

    // Fetch updated user roles
    const updatedUserRoles = await prisma.usersOnRoles.findMany({
      where: { userId: params.id },
      include: {
        role: {
          include: {
            _count: {
              select: {
                permissions: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `${roleIds.length} role(s) assigned to user`,
      roles: updatedUserRoles.map((ur) => ({
        ...ur.role,
        assignedAt: ur.assignedAt,
      })),
    })
  } catch (error) {
    console.error('Error assigning roles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id]/roles - Revoke roles from a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Check permission
    const hasPermission = await checkPermission(user.id, 'users:update')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { roleIds } = body

    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return NextResponse.json(
        { error: 'roleIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent users from removing their own roles
    if (user.id === params.id) {
      return NextResponse.json(
        { error: 'Cannot remove your own roles' },
        { status: 403 }
      )
    }

    // Revoke roles
    const result = await prisma.usersOnRoles.deleteMany({
      where: {
        userId: params.id,
        roleId: {
          in: roleIds,
        },
      },
    })

    // Clear permissions cache for this user
    clearUserPermissionsCache(params.id)

    // Fetch remaining roles
    const remainingRoles = await prisma.usersOnRoles.findMany({
      where: { userId: params.id },
      include: {
        role: {
          include: {
            _count: {
              select: {
                permissions: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `${result.count} role(s) revoked from user`,
      roles: remainingRoles.map((ur) => ({
        ...ur.role,
        assignedAt: ur.assignedAt,
      })),
    })
  } catch (error) {
    console.error('Error revoking roles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
