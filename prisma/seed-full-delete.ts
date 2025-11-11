import prisma from '../src/prisma/client'
import bcrypt from 'bcrypt'
import {
  UserRole,
  TeamType,
  CustomerType,
  LeadStatus,
  LeadSource,
  VehicleStatus,
  VehicleCondition,
  FuelType,
  TransmissionType,
  VehicleCategory,
  BodyType,
  SupplierType,
  TaxType
} from '../src/generated/prisma'

async function deleteAllData() {
  console.log('🗑️  Deleting all data...')

  // Delete in reverse dependency order (respecting FK constraints)
  await prisma.notification.deleteMany({})
  await prisma.notificationTemplate.deleteMany({})
  await prisma.activityLog.deleteMany({})
  await prisma.lead.deleteMany({})
  await prisma.vehicle.deleteMany({})
  await prisma.vehicleModel.deleteMany({})
  await prisma.brand.deleteMany({})
  await prisma.customer.deleteMany({})
  await prisma.supplier.deleteMany({})
  await prisma.taxConfiguration.deleteMany({})
  await prisma.session.deleteMany({})
  await prisma.usersOnRoles.deleteMany({})
  await prisma.rolePermission.deleteMany({})
  await prisma.permission.deleteMany({})
  await prisma.role.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.team.deleteMany({})

  console.log('✅ All data deleted')
}

async function main() {
  console.log('==========================================')
  console.log('  Full Seed with DELETE (Vercel-safe)')
  console.log('==========================================\n')

  // Step 1: Delete all existing data
  await deleteAllData()

  console.log('\n🌱 Creating fresh data...\n')

  // Step 2: Create Roles
  console.log('Creating roles...')
  const superAdminRole = await prisma.role.create({
    data: {
      name: 'SUPER_ADMIN',
      description: 'Accès complet au système',
      isSystem: true
    }
  })

  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      description: 'Administrateur avec accès étendu',
      isSystem: true
    }
  })

  const managerRole = await prisma.role.create({
    data: {
      name: 'MANAGER',
      description: 'Gestionnaire de concession',
      isSystem: true
    }
  })

  const salesRole = await prisma.role.create({
    data: {
      name: 'SALES',
      description: 'Commercial vendeur',
      isSystem: true
    }
  })

  const userRole = await prisma.role.create({
    data: {
      name: 'USER',
      description: 'Utilisateur standard',
      isSystem: true
    }
  })

  console.log('✅ 5 roles created')

  // Step 3: Create Permissions
  console.log('Creating permissions...')
  const permissions = [
    // Users management
    { module: 'users', action: 'view' },
    { module: 'users', action: 'create' },
    { module: 'users', action: 'edit' },
    { module: 'users', action: 'delete' },
    // Vehicles
    { module: 'vehicles', action: 'view' },
    { module: 'vehicles', action: 'create' },
    { module: 'vehicles', action: 'edit' },
    { module: 'vehicles', action: 'delete' },
    // Stock
    { module: 'stock', action: 'view' },
    { module: 'stock', action: 'manage' },
    // Customers & Leads
    { module: 'customers', action: 'view' },
    { module: 'customers', action: 'edit' },
    { module: 'leads', action: 'view' },
    { module: 'leads', action: 'edit' },
    // Sales
    { module: 'sales', action: 'view' },
    { module: 'sales', action: 'create' },
    // Reports
    { module: 'reports', action: 'view' },
    { module: 'reports', action: 'export' },
    // AI features
    { module: 'ai', action: 'recommendations' },
    { module: 'ai', action: 'pricing' },
    { module: 'ai', action: 'predictions' },
    // Settings
    { module: 'settings', action: 'manage' }
  ]

  const createdPermissions = await Promise.all(
    permissions.map(p =>
      prisma.permission.create({
        data: {
          module: p.module,
          action: p.action,
          code: `${p.module}:${p.action}`,
          name: `${p.action} ${p.module}`,
          resource: p.module,
          description: `Permission pour ${p.action} ${p.module}`
        }
      })
    )
  )

  console.log('✅ 22 permissions created')

  // Step 4: Assign Permissions to Roles
  console.log('Assigning permissions to roles...')

  // Super Admin gets all permissions
  await Promise.all(
    createdPermissions.map(p =>
      prisma.rolePermission.create({
        data: {
          roleId: superAdminRole.id,
          permissionId: p.id
        }
      })
    )
  )

  // Admin gets all except user deletion
  const adminPermissions = createdPermissions.filter(
    p => p.code !== 'users:delete'
  )
  await Promise.all(
    adminPermissions.map(p =>
      prisma.rolePermission.create({
        data: {
          roleId: adminRole.id,
          permissionId: p.id
        }
      })
    )
  )

  // Manager gets operational permissions
  const managerPermissionKeys = [
    'vehicles:view',
    'vehicles:edit',
    'stock:view',
    'stock:manage',
    'customers:view',
    'customers:edit',
    'leads:view',
    'leads:edit',
    'sales:view',
    'sales:create',
    'reports:view',
    'reports:export'
  ]
  const managerPermissions = createdPermissions.filter(p =>
    managerPermissionKeys.includes(p.code)
  )
  await Promise.all(
    managerPermissions.map(p =>
      prisma.rolePermission.create({
        data: {
          roleId: managerRole.id,
          permissionId: p.id
        }
      })
    )
  )

  // Sales gets CRM permissions
  const salesPermissionKeys = [
    'vehicles:view',
    'customers:view',
    'customers:edit',
    'leads:view',
    'leads:edit',
    'sales:view',
    'sales:create',
    'ai:recommendations'
  ]
  const salesPermissions = createdPermissions.filter(p =>
    salesPermissionKeys.includes(p.code)
  )
  await Promise.all(
    salesPermissions.map(p =>
      prisma.rolePermission.create({
        data: {
          roleId: salesRole.id,
          permissionId: p.id
        }
      })
    )
  )

  // User gets read-only permissions
  const userPermissionKeys = [
    'vehicles:view',
    'customers:view',
    'leads:view',
    'sales:view',
    'reports:view'
  ]
  const userPermissions = createdPermissions.filter(p =>
    userPermissionKeys.includes(p.code)
  )
  await Promise.all(
    userPermissions.map(p =>
      prisma.rolePermission.create({
        data: {
          roleId: userRole.id,
          permissionId: p.id
        }
      })
    )
  )

  console.log('✅ Permissions assigned to roles')

  // Step 5: Create placeholder teams (will update managers later)
  console.log('Creating teams...')
  // We need to create a temporary manager ID first
  const tempManagerId = 'temp-manager-id'

  const hqTeam = await prisma.team.create({
    data: {
      name: 'Ibticar HQ',
      type: TeamType.IBTICAR,
      code: 'HQ-001',
      managerId: tempManagerId,
      address: 'Alger',
      city: 'Alger',
      wilaya: 'Alger',
      email: 'contact@ibticar.ai',
      phone: '+213 23 45 67 89'
    }
  })

  const algerTeam = await prisma.team.create({
    data: {
      name: 'Concessionnaire Alger Centre',
      type: TeamType.DEALER,
      code: 'DEALER-ALG-01',
      managerId: tempManagerId,
      address: '123 Rue Didouche Mourad',
      city: 'Alger',
      wilaya: 'Alger',
      email: 'alger@dealer.com',
      phone: '+213 21 12 34 56'
    }
  })

  const oranTeam = await prisma.team.create({
    data: {
      name: 'Concessionnaire Oran',
      type: TeamType.DEALER,
      code: 'DEALER-ORA-01',
      managerId: tempManagerId,
      address: '45 Boulevard de la République',
      city: 'Oran',
      wilaya: 'Oran',
      email: 'oran@dealer.com',
      phone: '+213 41 23 45 67'
    }
  })

  console.log('✅ 3 teams created')

  // Step 6: Create Users
  console.log('Creating users...')
  const hashedPassword = await bcrypt.hash('Password123!', 10)

  const superadmin = await prisma.user.create({
    data: {
      email: 'superadmin@ibticar.ai',
      passwordHash: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      phone: '+213 555 000 001'
    }
  })

  await prisma.usersOnRoles.create({
    data: {
      userId: superadmin.id,
      roleId: superAdminRole.id
    }
  })

  const admin = await prisma.user.create({
    data: {
      email: 'admin@ibticar.ai',
      passwordHash: hashedPassword,
      firstName: 'Mohamed',
      lastName: 'Belaidi',
      role: UserRole.ADMIN,
      phone: '+213 555 000 002'
    }
  })

  await prisma.usersOnRoles.create({
    data: {
      userId: admin.id,
      roleId: adminRole.id
    }
  })

  // Update team managers
  await prisma.team.update({
    where: { id: oranTeam.id },
    data: { managerId: admin.id }
  })

  const manager = await prisma.user.create({
    data: {
      email: 'manager@dealer.com',
      passwordHash: hashedPassword,
      firstName: 'Ahmed',
      lastName: 'Benali',
      role: UserRole.MANAGER,
      phone: '+213 555 000 003'
    }
  })

  await prisma.usersOnRoles.create({
    data: {
      userId: manager.id,
      roleId: managerRole.id
    }
  })

  await prisma.team.update({
    where: { id: algerTeam.id },
    data: { managerId: manager.id }
  })

  await prisma.team.update({
    where: { id: hqTeam.id },
    data: { managerId: superadmin.id }
  })

  const sales = await prisma.user.create({
    data: {
      email: 'commercial@dealer.com',
      passwordHash: hashedPassword,
      firstName: 'Karim',
      lastName: 'Meziane',
      role: UserRole.SALES,
      phone: '+213 555 000 004'
    }
  })

  await prisma.usersOnRoles.create({
    data: {
      userId: sales.id,
      roleId: salesRole.id
    }
  })

  const user = await prisma.user.create({
    data: {
      email: 'user@dealer.com',
      passwordHash: hashedPassword,
      firstName: 'Fatima',
      lastName: 'Zouaoui',
      role: UserRole.USER,
      phone: '+213 555 000 005'
    }
  })

  await prisma.usersOnRoles.create({
    data: {
      userId: user.id,
      roleId: userRole.id
    }
  })

  console.log('✅ 5 users created with roles')

  // Step 7: Create Brands
  console.log('Creating brands...')
  const renault = await prisma.brand.create({
    data: {
      name: 'Renault',
      slug: 'renault',
      country: 'France',
      logo: 'https://www.carlogos.org/logo/Renault-logo.png'
    }
  })

  const peugeot = await prisma.brand.create({
    data: {
      name: 'Peugeot',
      slug: 'peugeot',
      country: 'France',
      logo: 'https://www.carlogos.org/logo/Peugeot-logo.png'
    }
  })

  const vw = await prisma.brand.create({
    data: {
      name: 'Volkswagen',
      slug: 'volkswagen',
      country: 'Allemagne'
    }
  })

  const toyota = await prisma.brand.create({
    data: {
      name: 'Toyota',
      slug: 'toyota',
      country: 'Japon'
    }
  })

  const hyundai = await prisma.brand.create({
    data: {
      name: 'Hyundai',
      slug: 'hyundai',
      country: 'Corée du Sud'
    }
  })

  const kia = await prisma.brand.create({
    data: {
      name: 'Kia',
      slug: 'kia',
      country: 'Corée du Sud'
    }
  })

  const seat = await prisma.brand.create({
    data: {
      name: 'Seat',
      slug: 'seat',
      country: 'Espagne'
    }
  })

  const skoda = await prisma.brand.create({
    data: {
      name: 'Skoda',
      slug: 'skoda',
      country: 'République Tchèque'
    }
  })

  const mercedes = await prisma.brand.create({
    data: {
      name: 'Mercedes-Benz',
      slug: 'mercedes-benz',
      country: 'Allemagne'
    }
  })

  const bmw = await prisma.brand.create({
    data: {
      name: 'BMW',
      slug: 'bmw',
      country: 'Allemagne'
    }
  })

  console.log('✅ 10 brands created')

  // Step 8: Create Models
  console.log('Creating models...')
  const clio5 = await prisma.vehicleModel.create({
    data: {
      name: 'Clio 5',
      slug: 'clio-5',
      brandId: renault.id,
      category: VehicleCategory.HATCHBACK,
      bodyType: BodyType.HATCHBACK,
      fuelType: FuelType.GASOLINE,
      transmission: TransmissionType.MANUAL,
      horsePower: 100
    }
  })

  const captur = await prisma.vehicleModel.create({
    data: {
      name: 'Captur',
      slug: 'captur',
      brandId: renault.id,
      category: VehicleCategory.SUV,
      bodyType: BodyType.SUV,
      fuelType: FuelType.DIESEL,
      transmission: TransmissionType.AUTOMATIC,
      horsePower: 115
    }
  })

  const megane = await prisma.vehicleModel.create({
    data: {
      name: 'Megane',
      slug: 'megane',
      brandId: renault.id,
      category: VehicleCategory.SEDAN,
      bodyType: BodyType.SEDAN,
      fuelType: FuelType.DIESEL,
      transmission: TransmissionType.MANUAL,
      horsePower: 110
    }
  })

  const peugeot208 = await prisma.vehicleModel.create({
    data: {
      name: '208',
      slug: '208',
      brandId: peugeot.id,
      category: VehicleCategory.HATCHBACK,
      bodyType: BodyType.HATCHBACK,
      fuelType: FuelType.GASOLINE,
      transmission: TransmissionType.MANUAL,
      horsePower: 110
    }
  })

  const peugeot3008 = await prisma.vehicleModel.create({
    data: {
      name: '3008',
      slug: '3008',
      brandId: peugeot.id,
      category: VehicleCategory.SUV,
      bodyType: BodyType.SUV,
      fuelType: FuelType.DIESEL,
      transmission: TransmissionType.AUTOMATIC,
      horsePower: 130
    }
  })

  const corolla = await prisma.vehicleModel.create({
    data: {
      name: 'Corolla',
      slug: 'corolla',
      brandId: toyota.id,
      category: VehicleCategory.SEDAN,
      bodyType: BodyType.SEDAN,
      fuelType: FuelType.HYBRID,
      transmission: TransmissionType.AUTOMATIC,
      horsePower: 122
    }
  })

  const i20 = await prisma.vehicleModel.create({
    data: {
      name: 'i20',
      slug: 'i20',
      brandId: hyundai.id,
      category: VehicleCategory.HATCHBACK,
      bodyType: BodyType.HATCHBACK,
      fuelType: FuelType.GASOLINE,
      transmission: TransmissionType.MANUAL,
      horsePower: 84
    }
  })

  console.log('✅ 7 models created')

  // Step 9: Create Vehicles
  console.log('Creating vehicles...')
  await prisma.vehicle.create({
    data: {
      vin: 'VF1RJA00068123456',
      vehicleModelId: clio5.id,
      teamId: algerTeam.id,
      color: 'Bleu Cosmos',
      year: 2024,
      sellingPrice: 2950000,
      purchasePrice: 2500000,
      status: VehicleStatus.AVAILABLE,
      condition: VehicleCondition.NEW,
      mileage: 0
    }
  })

  await prisma.vehicle.create({
    data: {
      vin: 'VF1RJB00068234567',
      vehicleModelId: captur.id,
      teamId: algerTeam.id,
      color: 'Rouge Flamme',
      year: 2024,
      sellingPrice: 3750000,
      purchasePrice: 3200000,
      status: VehicleStatus.AVAILABLE,
      condition: VehicleCondition.NEW,
      mileage: 0
    }
  })

  await prisma.vehicle.create({
    data: {
      vin: 'VF1RJC00068345678',
      vehicleModelId: megane.id,
      teamId: algerTeam.id,
      color: 'Gris Titanium',
      year: 2024,
      sellingPrice: 3300000,
      purchasePrice: 2800000,
      status: VehicleStatus.RESERVED,
      condition: VehicleCondition.NEW,
      mileage: 0
    }
  })

  await prisma.vehicle.create({
    data: {
      vin: 'VF3ABCDEF12456789',
      vehicleModelId: peugeot208.id,
      teamId: oranTeam.id,
      color: 'Blanc Nacré',
      year: 2024,
      sellingPrice: 2850000,
      purchasePrice: 2400000,
      status: VehicleStatus.AVAILABLE,
      condition: VehicleCondition.NEW,
      mileage: 0
    }
  })

  await prisma.vehicle.create({
    data: {
      vin: 'VF3ABCDEF12567890',
      vehicleModelId: peugeot3008.id,
      teamId: oranTeam.id,
      color: 'Noir Perla Nera',
      year: 2023,
      sellingPrice: 3950000,
      purchasePrice: 3300000,
      status: VehicleStatus.AVAILABLE,
      condition: VehicleCondition.USED_GOOD,
      mileage: 15000
    }
  })

  console.log('✅ 5 vehicles created')

  // Step 10: Create Customers
  console.log('Creating customers...')
  const customer1 = await prisma.customer.create({
    data: {
      type: CustomerType.INDIVIDUAL,
      firstName: 'Amina',
      lastName: 'Boumediene',
      email: 'amina.boumediene@email.dz',
      phone: '+213 550 123 456',
      city: 'Alger',
      wilaya: 'Alger'
    }
  })

  const customer2 = await prisma.customer.create({
    data: {
      type: CustomerType.INDIVIDUAL,
      firstName: 'Yacine',
      lastName: 'Brahimi',
      email: 'y.brahimi@email.dz',
      phone: '+213 660 234 567',
      city: 'Oran',
      wilaya: 'Oran'
    }
  })

  const customer3 = await prisma.customer.create({
    data: {
      type: CustomerType.BUSINESS,
      firstName: 'SARL',
      lastName: 'Transport',
      companyName: 'SARL Transport',
      email: 'contact@transport-sarl.dz',
      phone: '+213 21 55 44 33',
      taxId: '123456789012345',
      city: 'Alger',
      wilaya: 'Alger'
    }
  })

  const customer4 = await prisma.customer.create({
    data: {
      type: CustomerType.INDIVIDUAL,
      firstName: 'Leila',
      lastName: 'Hamidi',
      email: 'leila.h@email.dz',
      phone: '+213 770 345 678',
      city: 'Constantine',
      wilaya: 'Constantine'
    }
  })

  console.log('✅ 4 customers created')

  // Step 11: Create Leads
  console.log('Creating leads...')
  const vehicle1 = await prisma.vehicle.findFirst({ where: { vin: 'VF1RJA00068123456' } })
  const vehicle2 = await prisma.vehicle.findFirst({ where: { vin: 'VF1RJB00068234567' } })

  await prisma.lead.create({
    data: {
      customerId: customer1.id,
      status: LeadStatus.NEW,
      source: LeadSource.WEBSITE,
      budget: 3000000,
      interestedVehicleId: vehicle1?.id,
      assignedToId: sales.id
    }
  })

  await prisma.lead.create({
    data: {
      customerId: customer2.id,
      status: LeadStatus.CONTACTED,
      source: LeadSource.REFERRAL,
      budget: 3500000,
      interestedVehicleId: vehicle2?.id,
      assignedToId: sales.id
    }
  })

  await prisma.lead.create({
    data: {
      customerId: customer3.id,
      status: LeadStatus.QUALIFIED,
      source: LeadSource.PHONE,
      budget: 15000000,
      assignedToId: manager.id
    }
  })

  await prisma.lead.create({
    data: {
      customerId: customer4.id,
      status: LeadStatus.NEW,
      source: LeadSource.WALK_IN,
      budget: 2800000,
      assignedToId: sales.id
    }
  })

  console.log('✅ 4 leads created')

  // Step 12: Create Suppliers
  console.log('Creating suppliers...')
  await prisma.supplier.create({
    data: {
      name: 'Import Auto Algérie',
      code: 'SUP-001',
      type: SupplierType.DISTRIBUTOR,
      email: 'contact@importauto.dz',
      phone: '+213 21 45 67 89',
      address: 'Zone Industrielle, Rouiba, Alger',
      city: 'Rouiba',
      country: 'Algérie'
    }
  })

  await prisma.supplier.create({
    data: {
      name: 'Auto Distribution',
      code: 'SUP-002',
      type: SupplierType.WHOLESALER,
      email: 'info@autodist.dz',
      phone: '+213 21 23 45 67',
      address: 'Route Nationale 5, Oran',
      city: 'Oran',
      country: 'Algérie'
    }
  })

  console.log('✅ 2 suppliers created')

  // Step 13: Create Tax Configurations
  console.log('Creating tax configurations...')
  await prisma.taxConfiguration.create({
    data: {
      name: 'TVA Standard Algérie',
      type: TaxType.VAT,
      rate: 19.0,
      applicableTo: 'ALL',
      startDate: new Date('2024-01-01')
    }
  })

  await prisma.taxConfiguration.create({
    data: {
      name: 'TAP Algérie',
      type: TaxType.TAP,
      rate: 1.0,
      applicableTo: 'BUSINESS',
      startDate: new Date('2024-01-01')
    }
  })

  await prisma.taxConfiguration.create({
    data: {
      name: 'TVA Réduite',
      type: TaxType.VAT,
      rate: 9.0,
      applicableTo: 'SERVICES',
      startDate: new Date('2024-01-01')
    }
  })

  console.log('✅ 3 tax configurations created')

  console.log('\n==========================================')
  console.log('  Seed Complete!')
  console.log('==========================================\n')
  console.log('Summary:')
  console.log('  - 5 Roles')
  console.log('  - 22 Permissions')
  console.log('  - 3 Teams')
  console.log('  - 5 Users')
  console.log('  - 10 Brands')
  console.log('  - 7 Models')
  console.log('  - 5 Vehicles')
  console.log('  - 4 Customers')
  console.log('  - 4 Leads')
  console.log('  - 2 Suppliers')
  console.log('  - 3 Tax Configurations')
  console.log('\n  Total: ~58 entities\n')
  console.log('Test accounts (Password: Password123!):')
  console.log('  - superadmin@ibticar.ai (SUPER_ADMIN)')
  console.log('  - admin@ibticar.ai (ADMIN)')
  console.log('  - manager@dealer.com (MANAGER)')
  console.log('  - commercial@dealer.com (SALES)')
  console.log('  - user@dealer.com (USER)\n')
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
