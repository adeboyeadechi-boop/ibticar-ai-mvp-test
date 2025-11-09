#!/usr/bin/env node
/**
 * Assign SUPER_ADMIN role to admin user
 */

import { PrismaClient } from './src/generated/prisma/index.js'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Assigning SUPER_ADMIN role to admin user...\n')

  // Find admin user
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@ibticar.ai' },
  })

  if (!admin) {
    console.error('❌ Admin user not found')
    process.exit(1)
  }

  // Find SUPER_ADMIN role
  const superAdminRole = await prisma.role.findUnique({
    where: { name: 'SUPER_ADMIN' },
  })

  if (!superAdminRole) {
    console.error('❌ SUPER_ADMIN role not found')
    process.exit(1)
  }

  // Check if already assigned
  const existing = await prisma.usersOnRoles.findUnique({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: superAdminRole.id,
      },
    },
  })

  if (existing) {
    console.log('ℹ️  Admin already has SUPER_ADMIN role')
  } else {
    // Assign role
    await prisma.usersOnRoles.create({
      data: {
        userId: admin.id,
        roleId: superAdminRole.id,
      },
    })
    console.log('✅ SUPER_ADMIN role assigned to admin@ibticar.ai')
  }

  // Verify permissions
  const permissions = await prisma.permission.findMany({
    where: {
      roles: {
        some: {
          role: {
            users: {
              some: {
                userId: admin.id,
              },
            },
          },
        },
      },
    },
  })

  console.log(`\n📋 Admin now has ${permissions.length} permissions`)
  console.log('🎉 Setup complete!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
