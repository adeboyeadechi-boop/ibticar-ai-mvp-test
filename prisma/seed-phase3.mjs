#!/usr/bin/env node
/**
 * Seed Phase 3 - RBAC Permissions and Roles
 * Run with: node prisma/seed-phase3.mjs
 */

import { PrismaClient } from '../src/generated/prisma/index.js'

const prisma = new PrismaClient()

// Base permissions structure
const permissionsData = [
  // Vehicles
  { code: 'vehicles:create', name: 'Create Vehicle', module: 'vehicles', action: 'create', resource: 'vehicle' },
  { code: 'vehicles:read', name: 'Read Vehicle', module: 'vehicles', action: 'read', resource: 'vehicle' },
  { code: 'vehicles:update', name: 'Update Vehicle', module: 'vehicles', action: 'update', resource: 'vehicle' },
  { code: 'vehicles:delete', name: 'Delete Vehicle', module: 'vehicles', action: 'delete', resource: 'vehicle' },
  { code: 'vehicles:publish', name: 'Publish Vehicle', module: 'vehicles', action: 'publish', resource: 'vehicle' },

  // Customers
  { code: 'customers:create', name: 'Create Customer', module: 'customers', action: 'create', resource: 'customer' },
  { code: 'customers:read', name: 'Read Customer', module: 'customers', action: 'read', resource: 'customer' },
  { code: 'customers:update', name: 'Update Customer', module: 'customers', action: 'update', resource: 'customer' },
  { code: 'customers:delete', name: 'Delete Customer', module: 'customers', action: 'delete', resource: 'customer' },

  // Leads
  { code: 'leads:create', name: 'Create Lead', module: 'leads', action: 'create', resource: 'lead' },
  { code: 'leads:read', name: 'Read Lead', module: 'leads', action: 'read', resource: 'lead' },
  { code: 'leads:update', name: 'Update Lead', module: 'leads', action: 'update', resource: 'lead' },
  { code: 'leads:delete', name: 'Delete Lead', module: 'leads', action: 'delete', resource: 'lead' },
  { code: 'leads:convert', name: 'Convert Lead', module: 'leads', action: 'convert', resource: 'lead' },

  // Suppliers
  { code: 'suppliers:create', name: 'Create Supplier', module: 'suppliers', action: 'create', resource: 'supplier' },
  { code: 'suppliers:read', name: 'Read Supplier', module: 'suppliers', action: 'read', resource: 'supplier' },
  { code: 'suppliers:update', name: 'Update Supplier', module: 'suppliers', action: 'update', resource: 'supplier' },
  { code: 'suppliers:delete', name: 'Delete Supplier', module: 'suppliers', action: 'delete', resource: 'supplier' },

  // Users
  { code: 'users:create', name: 'Create User', module: 'users', action: 'create', resource: 'user' },
  { code: 'users:read', name: 'Read User', module: 'users', action: 'read', resource: 'user' },
  { code: 'users:update', name: 'Update User', module: 'users', action: 'update', resource: 'user' },
  { code: 'users:delete', name: 'Delete User', module: 'users', action: 'delete', resource: 'user' },

  // Roles & Permissions
  { code: 'roles:create', name: 'Create Role', module: 'roles', action: 'create', resource: 'role' },
  { code: 'roles:read', name: 'Read Role', module: 'roles', action: 'read', resource: 'role' },
  { code: 'roles:update', name: 'Update Role', module: 'roles', action: 'update', resource: 'role' },
  { code: 'roles:delete', name: 'Delete Role', module: 'roles', action: 'delete', resource: 'role' },
  { code: 'permissions:create', name: 'Create Permission', module: 'permissions', action: 'create', resource: 'permission' },
  { code: 'permissions:read', name: 'Read Permission', module: 'permissions', action: 'read', resource: 'permission' },

  // Reports
  { code: 'reports:read', name: 'Read Reports', module: 'reports', action: 'read', resource: 'report' },
  { code: 'reports:export', name: 'Export Reports', module: 'reports', action: 'export', resource: 'report' },

  // Super Admin wildcard
  { code: '*:*', name: 'All Permissions', module: '*', action: '*', resource: '*', description: 'Super Admin - All permissions' },
]

// Roles configuration
const rolesConfig = {
  SUPER_ADMIN: ['*:*'],
  ADMIN: [
    'vehicles:*', 'customers:*', 'leads:*', 'suppliers:*',
    'users:read', 'users:update', 'reports:*'
  ],
  MANAGER: [
    'vehicles:read', 'vehicles:update', 'customers:*', 'leads:*',
    'suppliers:read', 'reports:read'
  ],
  SALES: [
    'vehicles:read', 'customers:create', 'customers:read', 'customers:update',
    'leads:*'
  ],
  USER: [
    'vehicles:read', 'customers:read', 'leads:read'
  ],
}

async function main() {
  console.log('🌱 Seeding Phase 3 - RBAC Permissions and Roles...\n')

  // 1. Create permissions
  console.log('📝 Creating permissions...')
  for (const perm of permissionsData) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: perm,
      create: perm,
    })
  }
  console.log(`✅ Created ${permissionsData.length} permissions\n`)

  // 2. Create roles and assign permissions
  console.log('👥 Creating roles...')
  for (const [roleName, permissionCodes] of Object.entries(rolesConfig)) {
    // Create or get role
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { isSystem: true },
      create: {
        name: roleName,
        description: `System role: ${roleName}`,
        isSystem: true,
      },
    })

    // Get permissions
    const permissions = await prisma.permission.findMany({
      where: {
        OR: permissionCodes.map(code => {
          // Handle wildcards like "vehicles:*"
          if (code.endsWith(':*')) {
            const module = code.split(':')[0]
            return module === '*' ? {} : { module }
          }
          return { code }
        })
      }
    })

    // Assign permissions to role
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      })
    }

    console.log(`  ✅ ${roleName}: ${permissions.length} permissions`)
  }

  console.log('\n🎉 Phase 3 seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
