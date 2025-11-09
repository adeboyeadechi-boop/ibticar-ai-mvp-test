// Permissions API - List and Create Permissions
// GET /api/permissions - List all permissions
// POST /api/permissions - Create a new permission

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { checkPermission } from '@/lib/rbac'

// GET /api/permissions - List all permissions
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Check permission
    const hasPermission = await checkPermission(user.id, 'permissions:read')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const module = searchParams.get('module')

    const where = module ? { module } : {}

    const permissions = await prisma.permission.findMany({
      where,
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    })

    return NextResponse.json({ permissions })
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/permissions - Create a new permission
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthenticatedUser(request)
    if (error) return error

    // Check permission
    const hasPermission = await checkPermission(user.id, 'permissions:create')
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { code, name, description, module, action, resource } = body

    if (!code || !name || !module || !action || !resource) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: code, name, module, action, resource',
        },
        { status: 400 }
      )
    }

    // Check if permission already exists
    const existingPermission = await prisma.permission.findUnique({
      where: { code },
    })

    if (existingPermission) {
      return NextResponse.json(
        { error: 'Permission with this code already exists' },
        { status: 409 }
      )
    }

    const permission = await prisma.permission.create({
      data: {
        code,
        name,
        description,
        module,
        action,
        resource,
      },
    })

    return NextResponse.json({ permission }, { status: 201 })
  } catch (error) {
    console.error('Error creating permission:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
