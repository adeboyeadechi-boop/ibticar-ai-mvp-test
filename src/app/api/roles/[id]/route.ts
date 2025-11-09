// Role Management - Individual Role Operations
// GET /api/roles/[id] - Get a specific role
// PATCH /api/roles/[id] - Update a role
// DELETE /api/roles/[id] - Delete a role

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { checkPermission } from '@/lib/rbac'

// GET /api/roles/[id] - Get a specific role with its permissions and user count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Check permission
    const hasPermission = await checkPermission(user.id, 'roles:read')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const role = await prisma.role.findUnique({
      where: { id },
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
            users: true,
          },
        },
      },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Transform permissions for cleaner response
    const roleWithPermissions = {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    }

    return NextResponse.json({ role: roleWithPermissions })
  } catch (error) {
    console.error('Error fetching role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/roles/[id] - Update a role
export async function PATCH(
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
    const { name, description } = body

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id },
    })

    if (!existingRole) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Prevent editing system roles
    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: 'Cannot modify system roles' },
        { status: 403 }
      )
    }

    // Check if name is already taken (if changing name)
    if (name && name !== existingRole.name) {
      const duplicate = await prisma.role.findUnique({
        where: { name },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Role name already exists' },
          { status: 409 }
        )
      }
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      include: {
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
      },
    })

    return NextResponse.json({ role: updatedRole })
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/roles/[id] - Delete a role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Check permission
    const hasPermission = await checkPermission(user.id, 'roles:delete')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Prevent deleting system roles
    if (role.isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system roles' },
        { status: 403 }
      )
    }

    // Check if role is assigned to users
    if (role._count.users > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete role: ${role._count.users} user(s) are assigned to this role`,
        },
        { status: 409 }
      )
    }

    // Delete role (cascade will delete role permissions)
    await prisma.role.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
