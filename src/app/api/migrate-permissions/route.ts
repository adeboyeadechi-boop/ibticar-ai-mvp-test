/**
 * Permission Migration Endpoint
 * POST /api/migrate-permissions - Migrate permission codes from dot to colon notation
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

    // Only SUPER_ADMIN can run migrations
    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only SUPER_ADMIN can run migrations' },
        { status: 403 }
      )
    }

    console.log('🔄 Starting permission codes migration...')

    // Get all permissions
    const permissions = await prisma.permission.findMany()

    console.log(`Found ${permissions.length} permissions to check`)

    const updates: { old: string; new: string }[] = []

    for (const permission of permissions) {
      if (permission.code.includes('.')) {
        const newCode = permission.code.replace(/\./g, ':')

        console.log(`Updating: ${permission.code} → ${newCode}`)

        await prisma.permission.update({
          where: { id: permission.id },
          data: { code: newCode },
        })

        updates.push({ old: permission.code, new: newCode })
      }
    }

    // Clear permissions cache after migration
    console.log('🧹 Clearing permissions cache...')
    clearAllPermissionsCache()

    return NextResponse.json({
      success: true,
      message: `Migration complete! Updated ${updates.length} permissions`,
      updated: updates.length,
      details: updates,
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
