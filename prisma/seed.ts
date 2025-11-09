// Seed script for Ibticar.AI MVP
// Generates initial test data for development

import { PrismaClient } from '@/generated/prisma'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clean existing data (optional - comment out in production)
  console.log('🧹 Cleaning existing data...')
  await prisma.$executeRaw`TRUNCATE TABLE "User" CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE "Team" CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE "Role" CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE "Permission" CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE "Brand" CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE "TaxConfiguration" CASCADE`
  await prisma.$executeRaw`TRUNCATE TABLE "NotificationTemplate" CASCADE`

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

  // 4. Create Teams
  console.log('🏢 Creating teams...')
  const ibticarTeam = await prisma.team.create({
    data: {
      name: 'Ibticar HQ',
      type: 'IBTICAR',
      code: 'IBTICAR-HQ',
      managerId: '', // Will be updated after creating users
      city: 'Alger',
      wilaya: 'Alger',
      phone: '+213 23 45 67 89',
      email: 'contact@ibticar.ai',
    },
  })

  const dealerTeam = await prisma.team.create({
    data: {
      name: 'Concessionnaire Alger Centre',
      type: 'DEALER',
      code: 'DEALER-ALG-01',
      managerId: '',
      city: 'Alger',
      wilaya: 'Alger',
      phone: '+213 23 45 67 90',
      email: 'alger@dealer.com',
    },
  })

  // 5. Create Users
  console.log('👤 Creating users...')
  const hashedPassword = await bcrypt.hash('Password123!', 10)

  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@ibticar.ai',
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

  const manager = await prisma.user.create({
    data: {
      email: 'manager@dealer.com',
      passwordHash: hashedPassword,
      role: 'MANAGER',
      firstName: 'Ahmed',
      lastName: 'Benali',
      phone: '+213 555 000 002',
      preferredLanguage: 'FR',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  })

  const sales = await prisma.user.create({
    data: {
      email: 'commercial@dealer.com',
      passwordHash: hashedPassword,
      role: 'SALES',
      firstName: 'Karim',
      lastName: 'Meziane',
      phone: '+213 555 000 003',
      preferredLanguage: 'FR',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  })

  // Update team managers
  await prisma.team.update({
    where: { id: ibticarTeam.id },
    data: { managerId: superAdmin.id },
  })

  await prisma.team.update({
    where: { id: dealerTeam.id },
    data: { managerId: manager.id },
  })

  // 6. Create Vehicle Brands
  console.log('🚗 Creating vehicle brands...')
  const brands = [
    { name: 'Renault', slug: 'renault', country: 'France' },
    { name: 'Peugeot', slug: 'peugeot', country: 'France' },
    { name: 'Volkswagen', slug: 'volkswagen', country: 'Allemagne' },
    { name: 'Toyota', slug: 'toyota', country: 'Japon' },
    { name: 'Hyundai', slug: 'hyundai', country: 'Corée du Sud' },
    { name: 'Kia', slug: 'kia', country: 'Corée du Sud' },
    { name: 'Seat', slug: 'seat', country: 'Espagne' },
    { name: 'Skoda', slug: 'skoda', country: 'République Tchèque' },
  ]

  for (const brand of brands) {
    await prisma.brand.create({ data: brand })
  }

  // 7. Create Vehicle Models
  console.log('🏎️ Creating vehicle models...')
  const renault = await prisma.brand.findUnique({ where: { slug: 'renault' } })
  const peugeot = await prisma.brand.findUnique({ where: { slug: 'peugeot' } })

  if (renault) {
    await prisma.vehicleModel.create({
      data: {
        brandId: renault.id,
        name: 'Clio 5',
        slug: 'renault-clio-5',
        category: 'HATCHBACK',
        bodyType: 'HATCHBACK',
        fuelType: 'GASOLINE',
        transmission: 'MANUAL',
        engineCapacity: 1000,
        horsePower: 100,
        co2Emission: 120,
        seats: 5,
        doors: 5,
      },
    })

    await prisma.vehicleModel.create({
      data: {
        brandId: renault.id,
        name: 'Captur',
        slug: 'renault-captur',
        category: 'SUV',
        bodyType: 'SUV',
        fuelType: 'DIESEL',
        transmission: 'AUTOMATIC',
        engineCapacity: 1500,
        horsePower: 115,
        co2Emission: 110,
        seats: 5,
        doors: 5,
      },
    })
  }

  if (peugeot) {
    await prisma.vehicleModel.create({
      data: {
        brandId: peugeot.id,
        name: '208',
        slug: 'peugeot-208',
        category: 'HATCHBACK',
        bodyType: 'HATCHBACK',
        fuelType: 'GASOLINE',
        transmission: 'MANUAL',
        engineCapacity: 1200,
        horsePower: 110,
        co2Emission: 115,
        seats: 5,
        doors: 5,
      },
    })
  }

  // 8. Create Tax Configuration (Algeria)
  console.log('💰 Creating tax configurations...')
  await prisma.taxConfiguration.create({
    data: {
      name: 'TVA Standard Algérie',
      rate: 19.0,
      type: 'VAT',
      applicableTo: 'Vente de véhicules neufs',
      startDate: new Date('2024-01-01'),
      isActive: true,
    },
  })

  await prisma.taxConfiguration.create({
    data: {
      name: 'TAP Algérie',
      rate: 1.0,
      type: 'TAP',
      applicableTo: 'Toutes transactions commerciales',
      startDate: new Date('2024-01-01'),
      isActive: true,
    },
  })

  // 9. Create Notification Templates
  console.log('📧 Creating notification templates...')
  const notificationTemplates = [
    {
      code: 'WELCOME_EMAIL',
      name: 'Email de bienvenue',
      type: 'SYSTEM',
      channel: 'EMAIL',
      language: 'FR',
      subject: 'Bienvenue sur Ibticar.AI',
      template: 'Bonjour {{firstName}},\n\nBienvenue sur Ibticar.AI...',
      isActive: true,
    },
    {
      code: 'ORDER_CONFIRMATION',
      name: 'Confirmation de commande',
      type: 'ORDER',
      channel: 'EMAIL',
      language: 'FR',
      subject: 'Confirmation de votre commande #{{orderNumber}}',
      template: 'Votre commande a été confirmée...',
      isActive: true,
    },
    {
      code: 'PAYMENT_REMINDER',
      name: 'Rappel de paiement',
      type: 'PAYMENT',
      channel: 'EMAIL',
      language: 'FR',
      subject: 'Rappel: Facture #{{invoiceNumber}} en attente',
      template: 'Nous vous rappelons que la facture...',
      isActive: true,
    },
  ]

  for (const template of notificationTemplates) {
    await prisma.notificationTemplate.create({ data: template })
  }

  console.log('✅ Database seeded successfully!')
  console.log('\n📊 Summary:')
  console.log(`   - Roles: 4`)
  console.log(`   - Permissions: ${permissions.length}`)
  console.log(`   - Teams: 2`)
  console.log(`   - Users: 3`)
  console.log(`   - Brands: ${brands.length}`)
  console.log(`   - Vehicle Models: 3`)
  console.log(`   - Tax Configs: 2`)
  console.log(`   - Notification Templates: ${notificationTemplates.length}`)
  console.log('\n👤 Test users created:')
  console.log(`   - admin@ibticar.ai (Super Admin) - Password: Password123!`)
  console.log(`   - manager@dealer.com (Manager) - Password: Password123!`)
  console.log(`   - commercial@dealer.com (Sales) - Password: Password123!`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
