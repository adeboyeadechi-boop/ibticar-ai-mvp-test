// Production seed - Only runs if database is empty
// Does NOT truncate existing data

import { PrismaClient, NotificationType, NotificationChannel, TeamType, TaxType, Language, VehicleStatus, LeadStatus, LeadSource, CustomerType, SupplierType, SupplierStatus, VehicleCondition, CustomerStatus } from '../src/generated/prisma'
import * as bcrypt from 'bcrypt'
import { Decimal } from '../src/generated/prisma/runtime/library'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting production seed (safe mode)...')

  // Check if data already exists
  const userCount = await prisma.user.count()

  if (userCount > 0) {
    console.log(`⚠️  Database already contains ${userCount} users. Skipping seed.`)
    console.log('   To re-seed, please manually truncate tables first.')
    return
  }

  console.log('✅ Database is empty. Proceeding with seed...')

  // Use the exact same seed logic as seed-complete.ts but without TRUNCATE
  // (copying the entire content from seed-complete.ts starting from line 29)

  // 1. Create Roles
  console.log('👥 Creating roles...')
  const superAdminRole = await prisma.role.create({
    data: {
      name: 'Super Admin',
      description: 'Administrateur système avec tous les privilèges',
      isSystem: true,
    },
  })

  const adminRole = await prisma.role.create({
    data: {
      name: 'Admin',
      description: 'Administrateur de concession',
      isSystem: true,
    },
  })

  const managerRole = await prisma.role.create({
    data: {
      name: 'Manager',
      description: 'Responsable d\'équipe',
      isSystem: true,
    },
  })

  const salesRole = await prisma.role.create({
    data: {
      name: 'Commercial',
      description: 'Agent commercial',
      isSystem: true,
    },
  })

  const userRole = await prisma.role.create({
    data: {
      name: 'User',
      description: 'Utilisateur standard',
      isSystem: true,
    },
  })

  // 2. Create Permissions
  console.log('🔐 Creating permissions...')
  const permissions = [
    // Users & Teams
    { code: 'users.view', name: 'Voir utilisateurs', module: 'users', action: 'view', resource: 'users' },
    { code: 'users.create', name: 'Créer utilisateurs', module: 'users', action: 'create', resource: 'users' },
    { code: 'users.update', name: 'Modifier utilisateurs', module: 'users', action: 'update', resource: 'users' },
    { code: 'users.delete', name: 'Supprimer utilisateurs', module: 'users', action: 'delete', resource: 'users' },
    { code: 'teams.manage', name: 'Gérer équipes', module: 'teams', action: 'manage', resource: 'teams' },

    // Vehicles & Stock
    { code: 'vehicles.view', name: 'Voir véhicules', module: 'stock', action: 'view', resource: 'vehicles' },
    { code: 'vehicles.create', name: 'Ajouter véhicules', module: 'stock', action: 'create', resource: 'vehicles' },
    { code: 'vehicles.update', name: 'Modifier véhicules', module: 'stock', action: 'update', resource: 'vehicles' },
    { code: 'vehicles.delete', name: 'Supprimer véhicules', module: 'stock', action: 'delete', resource: 'vehicles' },
    { code: 'stock.transfer', name: 'Transférer véhicules', module: 'stock', action: 'transfer', resource: 'vehicles' },

    // Customers & CRM
    { code: 'customers.view', name: 'Voir clients', module: 'crm', action: 'view', resource: 'customers' },
    { code: 'customers.create', name: 'Créer clients', module: 'crm', action: 'create', resource: 'customers' },
    { code: 'customers.update', name: 'Modifier clients', module: 'crm', action: 'update', resource: 'customers' },
    { code: 'leads.manage', name: 'Gérer prospects', module: 'crm', action: 'manage', resource: 'leads' },

    // Sales & Finance
    { code: 'quotes.manage', name: 'Gérer devis', module: 'finance', action: 'manage', resource: 'quotes' },
    { code: 'invoices.manage', name: 'Gérer factures', module: 'finance', action: 'manage', resource: 'invoices' },
    { code: 'payments.manage', name: 'Gérer paiements', module: 'finance', action: 'manage', resource: 'payments' },

    // Reports
    { code: 'reports.view', name: 'Voir rapports', module: 'reports', action: 'view', resource: 'reports' },
    { code: 'reports.export', name: 'Exporter rapports', module: 'reports', action: 'export', resource: 'reports' },

    // AI Features
    { code: 'ai.recommendations', name: 'Recommandations IA', module: 'ai', action: 'recommendations', resource: 'ai' },
    { code: 'ai.predictions', name: 'Prédictions IA', module: 'ai', action: 'predictions', resource: 'ai' },
    { code: 'ai.pricing', name: 'Pricing dynamique IA', module: 'ai', action: 'pricing', resource: 'ai' },
  ]

  for (const perm of permissions) {
    await prisma.permission.create({ data: perm })
  }

  // 3. Assign permissions to roles
  console.log('🔗 Assigning permissions to roles...')
  const allPermissions = await prisma.permission.findMany()

  // Super Admin gets all permissions
  for (const perm of allPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: superAdminRole.id,
        permissionId: perm.id,
      },
    })
  }

  // Admin gets most permissions except user management
  const adminPermissions = allPermissions.filter(p => !p.code.startsWith('users.delete'))
  for (const perm of adminPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    })
  }

  // Manager gets operational permissions
  const managerPermissions = allPermissions.filter(p =>
    p.code.startsWith('vehicles.') ||
    p.code.startsWith('customers.') ||
    p.code.startsWith('leads.') ||
    p.code.startsWith('reports.')
  )
  for (const perm of managerPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: managerRole.id,
        permissionId: perm.id,
      },
    })
  }

  // Sales gets basic CRM permissions
  const salesPermissions = allPermissions.filter(p =>
    p.action === 'view' ||
    p.code.startsWith('customers.') ||
    p.code.startsWith('leads.')
  )
  for (const perm of salesPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: salesRole.id,
        permissionId: perm.id,
      },
    })
  }

  // 4. Create Teams
  console.log('🏢 Creating teams...')
  const ibticarTeam = await prisma.team.create({
    data: {
      name: 'Ibticar HQ',
      type: TeamType.IBTICAR,
      code: 'IBTICAR-HQ',
      managerId: '',
      city: 'Alger',
      wilaya: 'Alger',
      phone: '+213 23 45 67 89',
      email: 'contact@ibticar.ai',
    },
  })

  // 5. Create Users (only superadmin for production)
  console.log('👤 Creating superadmin user...')
  const hashedPassword = await bcrypt.hash('Password123!', 10)

  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@ibticar.ai',
      passwordHash: hashedPassword,
      role: 'SUPER_ADMIN',
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+213 555 000 001',
      preferredLanguage: 'FR',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  })

  // Update team manager
  await prisma.team.update({
    where: { id: ibticarTeam.id },
    data: { managerId: superAdmin.id },
  })

  // 6. Create Tax Configuration
  console.log('💰 Creating tax configurations...')
  await prisma.taxConfiguration.create({
    data: {
      name: 'TVA Standard Algérie',
      rate: 19.0,
      type: TaxType.VAT,
      applicableTo: 'Vente de véhicules neufs',
      startDate: new Date('2024-01-01'),
      isActive: true,
    },
  })

  await prisma.taxConfiguration.create({
    data: {
      name: 'TAP Algérie',
      rate: 1.0,
      type: TaxType.TAP,
      applicableTo: 'Toutes transactions commerciales',
      startDate: new Date('2024-01-01'),
      isActive: true,
    },
  })

  console.log('\n✅ Production seed completed successfully!')
  console.log('\n📊 Summary:')
  console.log(`   - Roles: 5`)
  console.log(`   - Permissions: ${permissions.length}`)
  console.log(`   - Teams: 1`)
  console.log(`   - Users: 1 (superadmin)`)
  console.log(`   - Tax Configs: 2`)

  console.log('\n👤 Superadmin account created:')
  console.log(`   Email: superadmin@ibticar.ai`)
  console.log(`   Password: Password123!`)
  console.log(`\n⚠️  IMPORTANT: Change this password immediately after first login!`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
