// Role Permissions Management
// POST /api/roles/[id]/permissions - Assign permissions to a role
// DELETE /api/roles/[id]/permissions - Revoke permissions from a role

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { checkPermission, clearAllPermissionsCache } from '@/lib/rbac'

// POST /api/roles/[id]/permissions - Assign permissions to a role
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Check permission
    const hasPermission = await checkPermission(user.id, 'roles:update')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { permissionIds } = body

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return NextResponse.json(
        { error: 'permissionIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: id },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Prevent modifying system roles
    if (role.isSystem) {
      return NextResponse.json(
        { error: 'Cannot modify system roles' },
        { status: 403 }
      )
    }

    // Verify all permissions exist
    const permissions = await prisma.permission.findMany({
      where: {
        id: {
          in: permissionIds,
        },
      },
    })

    if (permissions.length !== permissionIds.length) {
      return NextResponse.json(
        { error: 'One or more permissions not found' },
        { status: 404 }
      )
    }

    // Assign permissions (upsert to avoid duplicates)
    const operations = permissionIds.map((permissionId) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: id,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId: id,
          permissionId,
        },
      })
    )

    await prisma.$transaction(operations)

    // Clear permissions cache for all users with this role
    clearAllPermissionsCache()

    // Fetch updated role with permissions
    const updatedRole = await prisma.role.findUnique({
      where: { id: id },
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
    })

    return NextResponse.json({
      success: true,
      message: `${permissionIds.length} permission(s) assigned to role`,
      role: {
        ...updatedRole,
        permissions: updatedRole?.permissions.map((rp) => rp.permission),
      },
    })
  } catch (error) {
    console.error('Error assigning permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/roles/[id]/permissions - Revoke permissions from a role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Check permission
    const hasPermission = await checkPermission(user.id, 'roles:update')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { permissionIds } = body

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return NextResponse.json(
        { error: 'permissionIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: id },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Prevent modifying system roles
    if (role.isSystem) {
      return NextResponse.json(
        { error: 'Cannot modify system roles' },
        { status: 403 }
      )
    }

    // Revoke permissions
    const result = await prisma.rolePermission.deleteMany({
      where: {
        roleId: id,
        permissionId: {
          in: permissionIds,
        },
      },
    })

    // Clear permissions cache for all users with this role
    clearAllPermissionsCache()

    // Fetch updated role
    const updatedRole = await prisma.role.findUnique({
      where: { id: id },
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
    })

    return NextResponse.json({
      success: true,
      message: `${result.count} permission(s) revoked from role`,
      role: {
        ...updatedRole,
        permissions: updatedRole?.permissions.map((rp) => rp.permission),
      },
    })
  } catch (error) {
    console.error('Error revoking permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
