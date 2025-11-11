/**
 * Link SuperAdmin User to Super Admin Role
 * POST /api/link-superadmin-role - Create missing UsersOnRoles link for superadmin
 * IMPORTANT: This is a one-time migration endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { clearAllPermissionsCache } from '@/lib/rbac'

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { user, error } = await getAuthenticatedUser(req)
    if (error) return error

    // Only SUPER_ADMIN can run this migration
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only SUPER_ADMIN can run this migration' },
        { status: 403 }
      )
    }

    console.log('🔗 Starting superadmin role linking migration...')

    // Find all users with SUPER_ADMIN role
    const superAdmins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
    })

    console.log(`Found ${superAdmins.length} SUPER_ADMIN users`)

    // Find Super Admin role
    const superAdminRole = await prisma.role.findFirst({
      where: {
        OR: [
          { name: 'Super Admin' },
          { name: 'SUPER_ADMIN' },
          { name: 'SuperAdmin' },
        ],
      },
    })

    if (!superAdminRole) {
      return NextResponse.json(
        { error: 'Super Admin role not found in database' },
        { status: 404 }
      )
    }

    console.log(`Found Super Admin role: ${superAdminRole.name} (${superAdminRole.id})`)

    const linkedUsers: string[] = []

    for (const admin of superAdmins) {
      // Check if link already exists
      const existingLink = await prisma.usersOnRoles.findUnique({
        where: {
          userId_roleId: {
            userId: admin.id,
            roleId: superAdminRole.id,
          },
        },
      })

      if (existingLink) {
        console.log(`User ${admin.email} already linked to role`)
        continue
      }

      // Create the link
      await prisma.usersOnRoles.create({
        data: {
          userId: admin.id,
          roleId: superAdminRole.id,
        },
      })

      linkedUsers.push(admin.email)
      console.log(`Linked ${admin.email} to Super Admin role`)
    }

    // Clear permissions cache
    console.log('🧹 Clearing permissions cache...')
    clearAllPermissionsCache()

    return NextResponse.json({
      success: true,
      message: `Successfully linked ${linkedUsers.length} superadmin user(s) to Super Admin role`,
      linkedUsers,
      roleName: superAdminRole.name,
      roleId: superAdminRole.id,
      cacheClear: true,
    })
  } catch (error: any) {
    console.error('❌ Migration error:', error)
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
