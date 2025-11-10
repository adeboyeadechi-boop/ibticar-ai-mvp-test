// Seed complet avec données fictives pour tests
// Version complète avec tous les modules

import { PrismaClient, NotificationType, NotificationChannel, TeamType, TaxType, Language, VehicleStatus, LeadStatus, LeadSource, CustomerType, SupplierType, SupplierStatus, VehicleCondition, CustomerStatus } from '../src/generated/prisma'
import * as bcrypt from 'bcrypt'
import { Decimal } from '../src/generated/prisma/runtime/library'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting complete database seed with test data...')

  // Clean existing data (using DELETE for Vercel compatibility)
  console.log('🧹 Cleaning existing data...')
  await prisma.notificationTemplate.deleteMany({})
  await prisma.lead.deleteMany({})
  await prisma.customer.deleteMany({})
  await prisma.vehicle.deleteMany({})
  await prisma.vehicleModel.deleteMany({})
  await prisma.brand.deleteMany({})
  await prisma.supplier.deleteMany({})
  await prisma.taxConfiguration.deleteMany({})
  await prisma.session.deleteMany({})
  await prisma.usersOnRoles.deleteMany({})
  await prisma.rolePermission.deleteMany({})
  await prisma.permission.deleteMany({})
  await prisma.role.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.team.deleteMany({})

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

  const dealerTeam = await prisma.team.create({
    data: {
      name: 'Concessionnaire Alger Centre',
      type: TeamType.DEALER,
      code: 'DEALER-ALG-01',
      managerId: '',
      city: 'Alger',
      wilaya: 'Alger',
      phone: '+213 23 45 67 90',
      email: 'alger@dealer.com',
    },
  })

  const dealerOran = await prisma.team.create({
    data: {
      name: 'Concessionnaire Oran',
      type: TeamType.DEALER,
      code: 'DEALER-ORA-01',
      managerId: '',
      city: 'Oran',
      wilaya: 'Oran',
      phone: '+213 41 12 34 56',
      email: 'oran@dealer.com',
    },
  })

  // 5. Create Users (one for each role)
  console.log('👤 Creating users for each role...')
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

  // Update team managers
  await prisma.team.update({
    where: { id: ibticarTeam.id },
    data: { managerId: superAdmin.id },
  })

  await prisma.team.update({
    where: { id: dealerTeam.id },
    data: { managerId: manager.id },
  })

  await prisma.team.update({
    where: { id: dealerOran.id },
    data: { managerId: admin.id },
  })

  // 5b. Link users to their roles
  console.log('🔗 Linking users to roles...')
  await prisma.usersOnRoles.create({
    data: {
      userId: superAdmin.id,
      roleId: superAdminRole.id,
    },
  })

  await prisma.usersOnRoles.create({
    data: {
      userId: admin.id,
      roleId: adminRole.id,
    },
  })

  await prisma.usersOnRoles.create({
    data: {
      userId: manager.id,
      roleId: managerRole.id,
    },
  })

  await prisma.usersOnRoles.create({
    data: {
      userId: sales.id,
      roleId: salesRole.id,
    },
  })

  await prisma.usersOnRoles.create({
    data: {
      userId: user.id,
      roleId: userRole.id,
    },
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
    { name: 'Mercedes-Benz', slug: 'mercedes-benz', country: 'Allemagne' },
    { name: 'BMW', slug: 'bmw', country: 'Allemagne' },
  ]

  for (const brand of brands) {
    await prisma.brand.create({ data: brand })
  }

  // 7. Create Vehicle Models
  console.log('🏎️ Creating vehicle models...')
  const renault = await prisma.brand.findUnique({ where: { slug: 'renault' } })
  const peugeot = await prisma.brand.findUnique({ where: { slug: 'peugeot' } })
  const toyota = await prisma.brand.findUnique({ where: { slug: 'toyota' } })
  const hyundai = await prisma.brand.findUnique({ where: { slug: 'hyundai' } })

  const models: any[] = []

  if (renault) {
    const clio = await prisma.vehicleModel.create({
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
    models.push(clio)

    const captur = await prisma.vehicleModel.create({
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
    models.push(captur)

    const megane = await prisma.vehicleModel.create({
      data: {
        brandId: renault.id,
        name: 'Megane',
        slug: 'renault-megane',
        category: 'SEDAN',
        bodyType: 'SEDAN',
        fuelType: 'DIESEL',
        transmission: 'MANUAL',
        engineCapacity: 1500,
        horsePower: 110,
        co2Emission: 115,
        seats: 5,
        doors: 4,
      },
    })
    models.push(megane)
  }

  if (peugeot) {
    const p208 = await prisma.vehicleModel.create({
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
    models.push(p208)

    const p3008 = await prisma.vehicleModel.create({
      data: {
        brandId: peugeot.id,
        name: '3008',
        slug: 'peugeot-3008',
        category: 'SUV',
        bodyType: 'SUV',
        fuelType: 'DIESEL',
        transmission: 'AUTOMATIC',
        engineCapacity: 1600,
        horsePower: 130,
        co2Emission: 120,
        seats: 5,
        doors: 5,
      },
    })
    models.push(p3008)
  }

  if (toyota) {
    const corolla = await prisma.vehicleModel.create({
      data: {
        brandId: toyota.id,
        name: 'Corolla',
        slug: 'toyota-corolla',
        category: 'SEDAN',
        bodyType: 'SEDAN',
        fuelType: 'HYBRID',
        transmission: 'AUTOMATIC',
        engineCapacity: 1800,
        horsePower: 122,
        co2Emission: 95,
        seats: 5,
        doors: 4,
      },
    })
    models.push(corolla)
  }

  if (hyundai) {
    const i20 = await prisma.vehicleModel.create({
      data: {
        brandId: hyundai.id,
        name: 'i20',
        slug: 'hyundai-i20',
        category: 'HATCHBACK',
        bodyType: 'HATCHBACK',
        fuelType: 'GASOLINE',
        transmission: 'MANUAL',
        engineCapacity: 1200,
        horsePower: 84,
        co2Emission: 110,
        seats: 5,
        doors: 5,
      },
    })
    models.push(i20)
  }

  // 8. Create Suppliers
  console.log('🏭 Creating suppliers...')
  const supplier1 = await prisma.supplier.create({
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

  const supplier2 = await prisma.supplier.create({
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

  // 9. Create Vehicles
  console.log('🚙 Creating vehicles in stock...')
  const vehicles = [
    {
      vehicleModelId: models[0].id, // Clio
      vin: 'VF1RJA00068123456',
      color: 'Bleu Cosmos',
      year: 2024,
      mileage: 10,
      condition: VehicleCondition.NEW,
      purchasePrice: new Decimal(2500000), // 2,500,000 DZD
      sellingPrice: new Decimal(2950000),
      status: VehicleStatus.AVAILABLE,
      teamId: dealerTeam.id,
      location: 'Showroom Alger Centre',
      purchaseDate: new Date('2024-01-15'),
      notes: 'Véhicule neuf, importé par Import Auto Algérie',
    },
    {
      vehicleModelId: models[1].id, // Captur
      vin: 'VF1RJB00068234567',
      color: 'Rouge Flamme',
      year: 2024,
      mileage: 5,
      condition: VehicleCondition.NEW,
      purchasePrice: new Decimal(3200000),
      sellingPrice: new Decimal(3750000),
      status: VehicleStatus.AVAILABLE,
      teamId: dealerTeam.id,
      location: 'Showroom Alger Centre',
      purchaseDate: new Date('2024-02-01'),
      notes: 'Véhicule neuf, importé par Import Auto Algérie',
    },
    {
      vehicleModelId: models[2].id, // Megane
      vin: 'VF1RJC00068345678',
      color: 'Gris Titanium',
      interiorColor: 'Noir',
      year: 2024,
      mileage: 8,
      condition: VehicleCondition.NEW,
      purchasePrice: new Decimal(2800000),
      sellingPrice: new Decimal(3300000),
      status: VehicleStatus.RESERVED,
      teamId: dealerTeam.id,
      location: 'Showroom Alger Centre',
      purchaseDate: new Date('2024-02-10'),
      notes: 'Réservé pour Amina Boumediene',
    },
    {
      vehicleModelId: models[3].id, // 208
      vin: 'VF3ABCDEF12456789',
      color: 'Blanc Nacré',
      year: 2024,
      mileage: 15,
      condition: VehicleCondition.NEW,
      purchasePrice: new Decimal(2400000),
      sellingPrice: new Decimal(2850000),
      status: VehicleStatus.AVAILABLE,
      teamId: dealerOran.id,
      location: 'Showroom Oran',
      purchaseDate: new Date('2024-01-20'),
      notes: 'Véhicule neuf, importé par Auto Distribution',
    },
    {
      vehicleModelId: models[4].id, // 3008
      vin: 'VF3ABCDEF12567890',
      color: 'Noir Perla Nera',
      interiorColor: 'Beige',
      year: 2023,
      mileage: 12000,
      condition: VehicleCondition.USED_EXCELLENT,
      purchasePrice: new Decimal(3500000),
      sellingPrice: new Decimal(3950000),
      status: VehicleStatus.AVAILABLE,
      teamId: dealerOran.id,
      location: 'Showroom Oran',
      purchaseDate: new Date('2023-12-15'),
      notes: 'Véhicule d\'occasion en excellent état, révision complète effectuée',
    },
  ]

  for (const vehicle of vehicles) {
    await prisma.vehicle.create({ data: vehicle })
  }

  // 10. Create Customers
  console.log('👥 Creating customers...')
  const customers = [
    {
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
    {
      type: CustomerType.INDIVIDUAL,
      firstName: 'Yacine',
      lastName: 'Brahimi',
      email: 'y.brahimi@email.dz',
      phone: '+213 660 234 567',
      address: '23 Boulevard de la Révolution',
      city: 'Oran',
      wilaya: 'Oran',
      postalCode: '31000',
      status: CustomerStatus.PROSPECT,
      source: 'Referral',
    },
    {
      type: CustomerType.BUSINESS,
      firstName: 'Ahmed',
      lastName: 'Benmoussa',
      companyName: 'Entreprise SARL Transport',
      email: 'contact@transport-sarl.dz',
      phone: '+213 21 55 44 33',
      address: 'Zone Industrielle Rouiba',
      city: 'Alger',
      wilaya: 'Alger',
      postalCode: '16012',
      taxId: '123456789012345',
      status: CustomerStatus.ACTIVE,
      source: 'Phone',
    },
    {
      type: CustomerType.INDIVIDUAL,
      firstName: 'Leila',
      lastName: 'Hamidi',
      email: 'leila.h@email.dz',
      phone: '+213 770 345 678',
      address: '8 Rue Larbi Ben M\'hidi',
      city: 'Constantine',
      wilaya: 'Constantine',
      postalCode: '25000',
      status: CustomerStatus.PROSPECT,
      source: 'Walk-in',
    },
  ]

  for (const customer of customers) {
    await prisma.customer.create({ data: customer })
  }

  // 11. Create Leads
  console.log('📊 Creating leads...')
  const allCustomers = await prisma.customer.findMany()

  const leads = [
    {
      customerId: allCustomers[0].id,
      source: LeadSource.WEBSITE,
      status: LeadStatus.NEW,
      budget: new Decimal(3000000),
      notes: 'Intéressée par Captur',
      assignedToId: sales.id,
      lastContactDate: new Date(),
    },
    {
      customerId: allCustomers[1].id,
      source: LeadSource.REFERRAL,
      status: LeadStatus.CONTACTED,
      budget: new Decimal(3500000),
      notes: 'Référé par client existant',
      assignedToId: sales.id,
      lastContactDate: new Date(),
      nextFollowUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
    },
    {
      customerId: allCustomers[2].id,
      source: LeadSource.PHONE,
      status: LeadStatus.QUALIFIED,
      budget: new Decimal(15000000),
      notes: 'Commande flotte de 5 véhicules',
      assignedToId: manager.id,
      lastContactDate: new Date(),
      nextFollowUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // +3 days
      score: 95,
    },
    {
      customerId: allCustomers[3].id,
      source: LeadSource.WALK_IN,
      status: LeadStatus.NEW,
      budget: new Decimal(2800000),
      notes: 'Visite showroom',
      assignedToId: sales.id,
      lastContactDate: new Date(),
      score: 60,
    },
  ]

  for (const lead of leads) {
    await prisma.lead.create({ data: lead })
  }

  // 12. Create Tax Configuration
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

  // 13. Create Notification Templates
  console.log('📧 Creating notification templates...')
  const notificationTemplates = [
    {
      code: 'WELCOME_EMAIL',
      name: 'Email de bienvenue',
      type: NotificationType.SYSTEM,
      channel: NotificationChannel.EMAIL,
      language: Language.FR,
      subject: 'Bienvenue sur Ibticar.AI',
      template: 'Bonjour {{firstName}},\n\nBienvenue sur Ibticar.AI, votre plateforme de gestion automobile intelligente...',
      isActive: true,
    },
    {
      code: 'ORDER_CONFIRMATION',
      name: 'Confirmation de commande',
      type: NotificationType.ORDER,
      channel: NotificationChannel.EMAIL,
      language: Language.FR,
      subject: 'Confirmation de votre commande #{{orderNumber}}',
      template: 'Votre commande de véhicule a été confirmée. Référence: {{orderNumber}}',
      isActive: true,
    },
    {
      code: 'PAYMENT_REMINDER',
      name: 'Rappel de paiement',
      type: NotificationType.PAYMENT,
      channel: NotificationChannel.EMAIL,
      language: Language.FR,
      subject: 'Rappel: Facture #{{invoiceNumber}} en attente',
      template: 'Nous vous rappelons que la facture #{{invoiceNumber}} est en attente de paiement.',
      isActive: true,
    },
    {
      code: 'LEAD_ASSIGNED',
      name: 'Prospect assigné',
      type: NotificationType.SYSTEM,
      channel: NotificationChannel.EMAIL,
      language: Language.FR,
      subject: 'Nouveau prospect assigné',
      template: 'Un nouveau prospect vous a été assigné. Nom: {{customerName}}',
      isActive: true,
    },
    {
      code: 'VEHICLE_AVAILABLE',
      name: 'Véhicule disponible',
      type: NotificationType.STOCK_ALERT,
      channel: NotificationChannel.SMS,
      language: Language.FR,
      subject: 'Véhicule disponible',
      template: 'Le véhicule {{vehicleModel}} est maintenant disponible.',
      isActive: true,
    },
  ]

  for (const template of notificationTemplates) {
    await prisma.notificationTemplate.create({ data: template })
  }

  console.log('\n✅ Database seeded successfully with complete test data!')
  console.log('\n📊 Summary:')
  console.log(`   - Roles: 5`)
  console.log(`   - Permissions: ${permissions.length}`)
  console.log(`   - Teams: 3`)
  console.log(`   - Users: 5 (one per role)`)
  console.log(`   - Brands: ${brands.length}`)
  console.log(`   - Vehicle Models: ${models.length}`)
  console.log(`   - Vehicles: ${vehicles.length}`)
  console.log(`   - Customers: ${customers.length}`)
  console.log(`   - Leads: ${leads.length}`)
  console.log(`   - Suppliers: 2`)
  console.log(`   - Tax Configs: 3`)
  console.log(`   - Notification Templates: ${notificationTemplates.length}`)

  console.log('\n👤 Test users created (Password: Password123! for all):')
  console.log(`   1. superadmin@ibticar.ai (SUPER_ADMIN)`)
  console.log(`   2. admin@ibticar.ai (ADMIN)`)
  console.log(`   3. manager@dealer.com (MANAGER)`)
  console.log(`   4. commercial@dealer.com (SALES)`)
  console.log(`   5. user@dealer.com (USER)`)

  console.log('\n🔑 Credentials saved to bdd_init.txt')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
