// Full seed with TRUNCATE - Initializes DB with test data matching actual schema
// WARNING: This will DELETE all existing data!

import { PrismaClient, NotificationType, NotificationChannel, TeamType, TaxType, FuelType, TransmissionType, VehicleCondition, VehicleStatus, CustomerType, CustomerStatus, LeadStatus, LeadSource, SupplierType, SupplierStatus } from '../src/generated/prisma'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

/**
 * Truncate all tables in correct order (respecting FK constraints)
 */
async function truncateAllTables() {
  console.log('🗑️  Truncating all tables...')

  // Disable FK checks temporarily
  await prisma.$executeRawUnsafe('SET session_replication_role = replica;')

  try {
    // Delete in reverse dependency order
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Notification" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "NotificationTemplate" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "StockTransfer" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Lead" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Customer" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "VehicleMedia" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Vehicle" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "VehicleModel" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Brand" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Supplier" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "TaxConfiguration" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "UsersOnRoles" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "RolePermission" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Permission" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Role" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Team" CASCADE')

    console.log('✅ All tables truncated')
  } finally {
    // Re-enable FK checks
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;')
  }
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('🌱 FULL DATABASE SEED - WITH TRUNCATE')
  console.log('📄 Based on actual Prisma schema')
  console.log('='.repeat(60) + '\n')

  // TRUNCATE all tables
  await truncateAllTables()

  console.log('\n📦 Starting data creation...\n')

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

  console.log('✓ 5 roles created')

  // 2. Create Permissions
  console.log('🔐 Creating permissions...')
  const permissions = [
    // Users & Teams
    { code: 'users:view', name: 'Voir utilisateurs', module: 'users', action: 'view', resource: 'users' },
    { code: 'users:create', name: 'Créer utilisateurs', module: 'users', action: 'create', resource: 'users' },
    { code: 'users:update', name: 'Modifier utilisateurs', module: 'users', action: 'update', resource: 'users' },
    { code: 'users:delete', name: 'Supprimer utilisateurs', module: 'users', action: 'delete', resource: 'users' },
    { code: 'teams:manage', name: 'Gérer équipes', module: 'teams', action: 'manage', resource: 'teams' },

    // Vehicles & Stock
    { code: 'vehicles:view', name: 'Voir véhicules', module: 'stock', action: 'view', resource: 'vehicles' },
    { code: 'vehicles:create', name: 'Ajouter véhicules', module: 'stock', action: 'create', resource: 'vehicles' },
    { code: 'vehicles:update', name: 'Modifier véhicules', module: 'stock', action: 'update', resource: 'vehicles' },
    { code: 'vehicles:delete', name: 'Supprimer véhicules', module: 'stock', action: 'delete', resource: 'vehicles' },
    { code: 'stock:transfer', name: 'Transférer véhicules', module: 'stock', action: 'transfer', resource: 'vehicles' },

    // Customers & CRM
    { code: 'customers:view', name: 'Voir clients', module: 'crm', action: 'view', resource: 'customers' },
    { code: 'customers:create', name: 'Créer clients', module: 'crm', action: 'create', resource: 'customers' },
    { code: 'customers:update', name: 'Modifier clients', module: 'crm', action: 'update', resource: 'customers' },
    { code: 'leads:manage', name: 'Gérer prospects', module: 'crm', action: 'manage', resource: 'leads' },

    // Sales & Finance
    { code: 'quotes:manage', name: 'Gérer devis', module: 'finance', action: 'manage', resource: 'quotes' },
    { code: 'invoices:manage', name: 'Gérer factures', module: 'finance', action: 'manage', resource: 'invoices' },
    { code: 'payments:manage', name: 'Gérer paiements', module: 'finance', action: 'manage', resource: 'payments' },

    // Reports
    { code: 'reports:view', name: 'Voir rapports', module: 'reports', action: 'view', resource: 'reports' },
    { code: 'reports:export', name: 'Exporter rapports', module: 'reports', action: 'export', resource: 'reports' },

    // AI Features
    { code: 'ai:recommendations', name: 'Recommandations IA', module: 'ai', action: 'recommendations', resource: 'ai' },
    { code: 'ai:predictions', name: 'Prédictions IA', module: 'ai', action: 'predictions', resource: 'ai' },
    { code: 'ai:pricing', name: 'Pricing dynamique IA', module: 'ai', action: 'pricing', resource: 'ai' },
  ]

  for (const perm of permissions) {
    await prisma.permission.create({ data: perm })
  }

  console.log(`✓ ${permissions.length} permissions created`)

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

  // Admin gets most permissions except user delete
  const adminPermissions = allPermissions.filter(p => p.code !== 'users:delete')
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
    p.code.startsWith('vehicles:') ||
    p.code.startsWith('customers:') ||
    p.code.startsWith('leads:') ||
    p.code.startsWith('reports:')
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
    p.code.startsWith('customers:') ||
    p.code.startsWith('leads:')
  )
  for (const perm of salesPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: salesRole.id,
        permissionId: perm.id,
      },
    })
  }

  console.log('✓ Permissions assigned to roles')

  // 4. Create Teams
  console.log('🏢 Creating teams...')
  const ibticarTeam = await prisma.team.create({
    data: {
      name: 'Ibticar HQ',
      type: TeamType.IBTICAR,
      code: 'IBTICAR-HQ',
      managerId: '', // Will update later
      city: 'Alger',
      wilaya: 'Alger',
      phone: '+213 23 45 67 89',
      email: 'contact@ibticar.ai',
    },
  })

  const algerTeam = await prisma.team.create({
    data: {
      name: 'Concessionnaire Alger Centre',
      type: TeamType.DEALER,
      code: 'DEALER-ALG-01',
      managerId: '', // Will update later
      city: 'Alger',
      wilaya: 'Alger',
      phone: '+213 23 45 67 90',
      email: 'alger@dealer.com',
    },
  })

  const oranTeam = await prisma.team.create({
    data: {
      name: 'Concessionnaire Oran',
      type: TeamType.DEALER,
      code: 'DEALER-ORA-01',
      managerId: '', // Will update later
      city: 'Oran',
      wilaya: 'Oran',
      phone: '+213 41 12 34 56',
      email: 'oran@dealer.com',
    },
  })

  console.log('✓ 3 teams created')

  // 5. Create Users (all 5 accounts)
  console.log('👤 Creating users...')
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

  const admin = await prisma.user.create({
    data: {
      email: 'admin@ibticar.ai',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      firstName: 'Mohamed',
      lastName: 'Belaidi',
      phone: '+213 555 000 002',
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
      phone: '+213 555 000 003',
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
      phone: '+213 555 000 004',
      preferredLanguage: 'FR',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  })

  const user = await prisma.user.create({
    data: {
      email: 'user@dealer.com',
      passwordHash: hashedPassword,
      role: 'USER',
      firstName: 'Fatima',
      lastName: 'Zouaoui',
      phone: '+213 555 000 005',
      preferredLanguage: 'FR',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  })

  console.log('✓ 5 users created')

  // Update team managers
  await prisma.team.update({
    where: { id: ibticarTeam.id },
    data: { managerId: superAdmin.id },
  })

  await prisma.team.update({
    where: { id: algerTeam.id },
    data: { managerId: manager.id },
  })

  await prisma.team.update({
    where: { id: oranTeam.id },
    data: { managerId: admin.id },
  })

  // Link users to roles
  console.log('🔗 Linking users to roles...')
  await prisma.usersOnRoles.create({
    data: { userId: superAdmin.id, roleId: superAdminRole.id },
  })
  await prisma.usersOnRoles.create({
    data: { userId: admin.id, roleId: adminRole.id },
  })
  await prisma.usersOnRoles.create({
    data: { userId: manager.id, roleId: managerRole.id },
  })
  await prisma.usersOnRoles.create({
    data: { userId: sales.id, roleId: salesRole.id },
  })
  await prisma.usersOnRoles.create({
    data: { userId: user.id, roleId: userRole.id },
  })

  console.log('✓ Users linked to roles')

  // 6. Create Brands (10 brands)
  console.log('🚗 Creating brands...')
  const renault = await prisma.brand.create({
    data: { name: 'Renault', slug: 'renault', country: 'France' },
  })
  const peugeot = await prisma.brand.create({
    data: { name: 'Peugeot', slug: 'peugeot', country: 'France' },
  })
  const volkswagen = await prisma.brand.create({
    data: { name: 'Volkswagen', slug: 'volkswagen', country: 'Allemagne' },
  })
  const toyota = await prisma.brand.create({
    data: { name: 'Toyota', slug: 'toyota', country: 'Japon' },
  })
  const hyundai = await prisma.brand.create({
    data: { name: 'Hyundai', slug: 'hyundai', country: 'Corée du Sud' },
  })
  const kia = await prisma.brand.create({
    data: { name: 'Kia', slug: 'kia', country: 'Corée du Sud' },
  })
  const seat = await prisma.brand.create({
    data: { name: 'Seat', slug: 'seat', country: 'Espagne' },
  })
  const skoda = await prisma.brand.create({
    data: { name: 'Skoda', slug: 'skoda', country: 'République Tchèque' },
  })
  const mercedes = await prisma.brand.create({
    data: { name: 'Mercedes-Benz', slug: 'mercedes-benz', country: 'Allemagne' },
  })
  const bmw = await prisma.brand.create({
    data: { name: 'BMW', slug: 'bmw', country: 'Allemagne' },
  })

  console.log('✓ 10 brands created')

  // 7. Create Vehicle Models (7 models)
  console.log('🏎️  Creating vehicle models...')
  const clio5 = await prisma.vehicleModel.create({
    data: {
      brandId: renault.id,
      name: 'Clio 5',
      slug: 'renault-clio-5',
      category: 'HATCHBACK',
      bodyType: 'HATCHBACK',
      fuelType: FuelType.GASOLINE,
      transmission: TransmissionType.MANUAL,
      engineCapacity: 1000,
      horsePower: 100,
      co2Emission: 120,
      seats: 5,
      doors: 5,
    },
  })

  const captur = await prisma.vehicleModel.create({
    data: {
      brandId: renault.id,
      name: 'Captur',
      slug: 'renault-captur',
      category: 'SUV',
      bodyType: 'SUV',
      fuelType: FuelType.DIESEL,
      transmission: TransmissionType.AUTOMATIC,
      engineCapacity: 1500,
      horsePower: 115,
      co2Emission: 130,
      seats: 5,
      doors: 5,
    },
  })

  const megane = await prisma.vehicleModel.create({
    data: {
      brandId: renault.id,
      name: 'Megane',
      slug: 'renault-megane',
      category: 'SEDAN',
      bodyType: 'SEDAN',
      fuelType: FuelType.DIESEL,
      transmission: TransmissionType.MANUAL,
      engineCapacity: 1500,
      horsePower: 110,
      co2Emission: 125,
      seats: 5,
      doors: 4,
    },
  })

  const peugeot208 = await prisma.vehicleModel.create({
    data: {
      brandId: peugeot.id,
      name: '208',
      slug: 'peugeot-208',
      category: 'HATCHBACK',
      bodyType: 'HATCHBACK',
      fuelType: FuelType.GASOLINE,
      transmission: TransmissionType.MANUAL,
      engineCapacity: 1200,
      horsePower: 110,
      co2Emission: 115,
      seats: 5,
      doors: 5,
    },
  })

  const peugeot3008 = await prisma.vehicleModel.create({
    data: {
      brandId: peugeot.id,
      name: '3008',
      slug: 'peugeot-3008',
      category: 'SUV',
      bodyType: 'SUV',
      fuelType: FuelType.DIESEL,
      transmission: TransmissionType.AUTOMATIC,
      engineCapacity: 1600,
      horsePower: 130,
      co2Emission: 135,
      seats: 5,
      doors: 5,
    },
  })

  const corolla = await prisma.vehicleModel.create({
    data: {
      brandId: toyota.id,
      name: 'Corolla',
      slug: 'toyota-corolla',
      category: 'SEDAN',
      bodyType: 'SEDAN',
      fuelType: FuelType.HYBRID,
      transmission: TransmissionType.AUTOMATIC,
      engineCapacity: 1800,
      horsePower: 122,
      co2Emission: 95,
      seats: 5,
      doors: 4,
    },
  })

  const i20 = await prisma.vehicleModel.create({
    data: {
      brandId: hyundai.id,
      name: 'i20',
      slug: 'hyundai-i20',
      category: 'HATCHBACK',
      bodyType: 'HATCHBACK',
      fuelType: FuelType.GASOLINE,
      transmission: TransmissionType.MANUAL,
      engineCapacity: 1000,
      horsePower: 84,
      co2Emission: 118,
      seats: 5,
      doors: 5,
    },
  })

  console.log('✓ 7 models created')

  // 8. Create Vehicles (5 vehicles)
  console.log('🚙 Creating vehicles in stock...')
  await prisma.vehicle.create({
    data: {
      vin: 'VF1RJA00068123456',
      vehicleModelId: clio5.id,
      teamId: algerTeam.id,
      status: VehicleStatus.AVAILABLE,
      condition: VehicleCondition.NEW,
      year: 2024,
      mileage: 10,
      color: 'Bleu Cosmos',
      interiorColor: 'Noir',
      purchasePrice: 2500000,
      sellingPrice: 2950000,
      currency: 'DZD',
      purchaseDate: new Date('2024-01-15'),
      location: 'Showroom Alger Centre',
      notes: 'Véhicule neuf',
    },
  })

  await prisma.vehicle.create({
    data: {
      vin: 'VF1RJB00068234567',
      vehicleModelId: captur.id,
      teamId: algerTeam.id,
      status: VehicleStatus.AVAILABLE,
      condition: VehicleCondition.NEW,
      year: 2024,
      mileage: 5,
      color: 'Rouge Flamme',
      interiorColor: 'Noir',
      purchasePrice: 3200000,
      sellingPrice: 3750000,
      currency: 'DZD',
      purchaseDate: new Date('2024-02-01'),
      location: 'Showroom Alger Centre',
      notes: 'Véhicule neuf',
    },
  })

  await prisma.vehicle.create({
    data: {
      vin: 'VF1RJC00068345678',
      vehicleModelId: megane.id,
      teamId: algerTeam.id,
      status: VehicleStatus.RESERVED,
      condition: VehicleCondition.NEW,
      year: 2024,
      mileage: 8,
      color: 'Gris Titanium',
      interiorColor: 'Gris',
      purchasePrice: 2800000,
      sellingPrice: 3300000,
      currency: 'DZD',
      purchaseDate: new Date('2024-02-10'),
      location: 'Showroom Alger Centre',
      notes: 'Réservé',
    },
  })

  await prisma.vehicle.create({
    data: {
      vin: 'VF3ABCDEF12456789',
      vehicleModelId: peugeot208.id,
      teamId: oranTeam.id,
      status: VehicleStatus.AVAILABLE,
      condition: VehicleCondition.NEW,
      year: 2024,
      mileage: 15,
      color: 'Blanc Nacré',
      interiorColor: 'Gris',
      purchasePrice: 2400000,
      sellingPrice: 2850000,
      currency: 'DZD',
      purchaseDate: new Date('2024-01-20'),
      location: 'Showroom Oran',
      notes: 'Véhicule neuf',
    },
  })

  await prisma.vehicle.create({
    data: {
      vin: 'VF3ABCDEF12567890',
      vehicleModelId: peugeot3008.id,
      teamId: oranTeam.id,
      status: VehicleStatus.AVAILABLE,
      condition: VehicleCondition.USED_GOOD,
      year: 2023,
      mileage: 12000,
      color: 'Noir Perla Nera',
      interiorColor: 'Noir',
      purchasePrice: 3500000,
      sellingPrice: 3950000,
      currency: 'DZD',
      purchaseDate: new Date('2023-12-15'),
      location: 'Showroom Oran',
      notes: 'Occasion récente',
    },
  })

  console.log('✓ 5 vehicles created')

  // 9. Create Customers (4 customers - matching actual schema)
  console.log('👥 Creating customers...')
  const customer1 = await prisma.customer.create({
    data: {
      type: CustomerType.INDIVIDUAL,
      firstName: 'Amina',
      lastName: 'Boumediene',
      email: 'amina.boumediene@email.dz',
      phone: '+213 550 123 456',
      address: '15 Rue Didouche Mourad',
      city: 'Alger',
      wilaya: 'Alger',
      postalCode: '16000',
      status: CustomerStatus.ACTIVE,
      source: 'Website',
    },
  })

  const customer2 = await prisma.customer.create({
    data: {
      type: CustomerType.INDIVIDUAL,
      firstName: 'Yacine',
      lastName: 'Brahimi',
      email: 'y.brahimi@email.dz',
      phone: '+213 660 234 567',
      address: '20 Boulevard de la Révolution',
      city: 'Oran',
      wilaya: 'Oran',
      postalCode: '31000',
      status: CustomerStatus.ACTIVE,
      source: 'Referral',
    },
  })

  const customer3 = await prisma.customer.create({
    data: {
      type: CustomerType.BUSINESS,
      firstName: 'Contact',
      lastName: 'Transport',
      companyName: 'SARL Transport',
      email: 'contact@transport-sarl.dz',
      phone: '+213 21 55 44 33',
      address: '5 Zone Industrielle',
      city: 'Alger',
      wilaya: 'Alger',
      postalCode: '16050',
      taxId: '123456789012345',
      status: CustomerStatus.ACTIVE,
      source: 'Phone',
    },
  })

  const customer4 = await prisma.customer.create({
    data: {
      type: CustomerType.INDIVIDUAL,
      firstName: 'Leila',
      lastName: 'Hamidi',
      email: 'leila.h@email.dz',
      phone: '+213 770 345 678',
      address: '12 Rue Larbi Ben Mhidi',
      city: 'Constantine',
      wilaya: 'Constantine',
      postalCode: '25000',
      status: CustomerStatus.PROSPECT,
      source: 'Walk-in',
    },
  })

  console.log('✓ 4 customers created')

  // 10. Create Leads (4 leads - matching actual schema)
  console.log('📊 Creating leads...')
  await prisma.lead.create({
    data: {
      customerId: customer1.id,
      assignedToId: sales.id,
      source: LeadSource.WEBSITE,
      status: LeadStatus.NEW,
      score: 60,
      budget: 3000000,
      notes: 'Intéressée par Captur',
      lastContactDate: new Date(),
    },
  })

  await prisma.lead.create({
    data: {
      customerId: customer2.id,
      assignedToId: sales.id,
      source: LeadSource.REFERRAL,
      status: LeadStatus.CONTACTED,
      score: 70,
      budget: 3500000,
      notes: 'Référé par client existant',
      lastContactDate: new Date(),
    },
  })

  await prisma.lead.create({
    data: {
      customerId: customer3.id,
      assignedToId: manager.id,
      source: LeadSource.PHONE,
      status: LeadStatus.QUALIFIED,
      score: 90,
      budget: 15000000,
      notes: 'Commande flotte de 5 véhicules',
      lastContactDate: new Date(),
    },
  })

  await prisma.lead.create({
    data: {
      customerId: customer4.id,
      assignedToId: sales.id,
      source: LeadSource.WALK_IN,
      status: LeadStatus.NEW,
      score: 50,
      budget: 2800000,
      notes: 'Visite showroom',
      lastContactDate: new Date(),
    },
  })

  console.log('✓ 4 leads created')

  // 11. Create Suppliers (2 suppliers)
  console.log('🏭 Creating suppliers...')
  await prisma.supplier.create({
    data: {
      name: 'Import Auto Algérie',
      code: 'SUP-001',
      type: SupplierType.MANUFACTURER,
      status: SupplierStatus.ACTIVE,
      email: 'contact@importauto.dz',
      phone: '+213 21 12 34 56',
      country: 'Algérie',
      city: 'Alger',
      notes: 'Importateur officiel Renault',
    },
  })

  await prisma.supplier.create({
    data: {
      name: 'Auto Distribution',
      code: 'SUP-002',
      type: SupplierType.DISTRIBUTOR,
      status: SupplierStatus.ACTIVE,
      email: 'info@autodist.dz',
      phone: '+213 21 98 76 54',
      country: 'Algérie',
      city: 'Oran',
      notes: 'Distributeur multi-marques',
    },
  })

  console.log('✓ 2 suppliers created')

  // 12. Create Tax Configurations (3 taxes)
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

  await prisma.taxConfiguration.create({
    data: {
      name: 'TVA Réduite',
      rate: 9.0,
      type: TaxType.VAT,
      applicableTo: 'Véhicules utilitaires',
      startDate: new Date('2024-01-01'),
      isActive: true,
    },
  })

  console.log('✓ 3 tax configurations created')

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('✅ FULL SEED COMPLETED SUCCESSFULLY!')
  console.log('='.repeat(60))
  console.log('\n📊 Summary:')
  console.log(`   - Roles: 5`)
  console.log(`   - Permissions: ${permissions.length}`)
  console.log(`   - Teams: 3`)
  console.log(`   - Users: 5`)
  console.log(`   - Brands: 10`)
  console.log(`   - Models: 7`)
  console.log(`   - Vehicles: 5`)
  console.log(`   - Customers: 4`)
  console.log(`   - Leads: 4`)
  console.log(`   - Suppliers: 2`)
  console.log(`   - Tax Configs: 3`)

  console.log('\n👤 Test accounts (password: Password123!):')
  console.log(`   - superadmin@ibticar.ai (SUPER_ADMIN)`)
  console.log(`   - admin@ibticar.ai (ADMIN)`)
  console.log(`   - manager@dealer.com (MANAGER)`)
  console.log(`   - commercial@dealer.com (SALES)`)
  console.log(`   - user@dealer.com (USER)`)

  console.log('\n⚠️  IMPORTANT: Change passwords in production!')
  console.log('='.repeat(60) + '\n')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
