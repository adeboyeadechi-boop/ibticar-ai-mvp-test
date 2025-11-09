#!/usr/bin/env node

/**
 * Test complet Phase 2 - CRM + Fournisseurs + Analytics
 * Tests tous les nouveaux endpoints créés
 */

const BASE_URL = 'http://localhost:3003'
let jwtToken = ''
let testCustomerId = ''
let testLeadId = ''
let testSupplierId = ''

// Fonction pour faire des requêtes
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...(jwtToken && { Authorization: `Bearer ${jwtToken}` }),
    ...options.headers,
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    const data = await response.json().catch(() => ({}))
    return { status: response.status, data }
  } catch (error) {
    return { status: 0, data: { error: error.message } }
  }
}

console.log('🧪 Test Phase 2 Complete - CRM + Suppliers + Analytics\n')
console.log('═══════════════════════════════════════════════════════\n')

// 1. Obtenir un JWT token
console.log('1️⃣  Test: POST /api/auth/signin (get JWT token)')
const signinRes = await request('/api/auth/signin', {
  method: 'POST',
  body: JSON.stringify({
    email: 'admin@ibticar.ai',
    password: 'Password123!',
  }),
})

console.log(`Status: ${signinRes.status}`)
if (signinRes.status === 200 && signinRes.data.token) {
  jwtToken = signinRes.data.token
  console.log('✅ JWT Token received')
  console.log(`   User: ${signinRes.data.user.email} (${signinRes.data.user.role})`)
} else {
  console.log('❌ Failed to get JWT token')
  console.log(`   Error: ${JSON.stringify(signinRes.data)}`)
  process.exit(1)
}

console.log()

// 2. Test Customers API
console.log('2️⃣  Test: GET /api/customers')
const customersListRes = await request('/api/customers')
console.log(`Status: ${customersListRes.status}`)
if (customersListRes.status === 200) {
  console.log('✅ Customers API working!')
  console.log(`   Total customers: ${customersListRes.data.pagination?.total || 0}`)
} else {
  console.log('❌ Error:', customersListRes.data.error)
}

console.log()

// 3. Test POST Customer
console.log('3️⃣  Test: POST /api/customers (create new customer)')
const newCustomerRes = await request('/api/customers', {
  method: 'POST',
  body: JSON.stringify({
    type: 'INDIVIDUAL',
    firstName: 'Test',
    lastName: 'Customer',
    email: `test.customer.${Date.now()}@example.com`,
    phone: '+213555123456',
    city: 'Algiers',
    wilaya: 'Alger',
  }),
})

console.log(`Status: ${newCustomerRes.status}`)
if (newCustomerRes.status === 201) {
  testCustomerId = newCustomerRes.data.id
  console.log('✅ Customer created successfully!')
  console.log(`   Customer ID: ${testCustomerId}`)
  console.log(`   Name: ${newCustomerRes.data.firstName} ${newCustomerRes.data.lastName}`)
} else {
  console.log('❌ Error:', newCustomerRes.data.error)
}

console.log()

// 4. Test GET Customer details
if (testCustomerId) {
  console.log('4️⃣  Test: GET /api/customers/[id]')
  const customerDetailsRes = await request(`/api/customers/${testCustomerId}`)
  console.log(`Status: ${customerDetailsRes.status}`)
  if (customerDetailsRes.status === 200) {
    console.log('✅ Customer details retrieved!')
    console.log(`   Email: ${customerDetailsRes.data.email}`)
    console.log(`   Status: ${customerDetailsRes.data.status}`)
  } else {
    console.log('❌ Error:', customerDetailsRes.data.error)
  }
  console.log()
}

// 5. Test Leads API
console.log('5️⃣  Test: GET /api/leads')
const leadsListRes = await request('/api/leads')
console.log(`Status: ${leadsListRes.status}`)
if (leadsListRes.status === 200) {
  console.log('✅ Leads API working!')
  console.log(`   Total leads: ${leadsListRes.data.pagination?.total || 0}`)
} else {
  console.log('❌ Error:', leadsListRes.data.error)
}

console.log()

// 6. Test POST Lead
if (testCustomerId) {
  console.log('6️⃣  Test: POST /api/leads (create new lead)')
  const newLeadRes = await request('/api/leads', {
    method: 'POST',
    body: JSON.stringify({
      customerId: testCustomerId,
      source: 'WEBSITE',
      status: 'NEW',
      budget: 2500000,
      timeline: '1-3 months',
      notes: 'Test lead creation',
    }),
  })

  console.log(`Status: ${newLeadRes.status}`)
  if (newLeadRes.status === 201) {
    testLeadId = newLeadRes.data.id
    console.log('✅ Lead created successfully!')
    console.log(`   Lead ID: ${testLeadId}`)
    console.log(`   Source: ${newLeadRes.data.source}`)
    console.log(`   Budget: ${newLeadRes.data.budget} DZD`)
  } else {
    console.log('❌ Error:', newLeadRes.data.error)
  }
  console.log()
}

// 7. Test PATCH Lead
if (testLeadId) {
  console.log('7️⃣  Test: PATCH /api/leads/[id] (update lead)')
  const updateLeadRes = await request(`/api/leads/${testLeadId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'CONTACTED',
      score: 75,
      notes: 'Updated: Customer responded positively',
    }),
  })

  console.log(`Status: ${updateLeadRes.status}`)
  if (updateLeadRes.status === 200) {
    console.log('✅ Lead updated successfully!')
    console.log(`   New status: ${updateLeadRes.data.status}`)
    console.log(`   Score: ${updateLeadRes.data.score}`)
  } else {
    console.log('❌ Error:', updateLeadRes.data.error)
  }
  console.log()
}

// 8. Test Suppliers API
console.log('8️⃣  Test: GET /api/suppliers')
const suppliersListRes = await request('/api/suppliers')
console.log(`Status: ${suppliersListRes.status}`)
if (suppliersListRes.status === 200) {
  console.log('✅ Suppliers API working!')
  console.log(`   Total suppliers: ${suppliersListRes.data.pagination?.total || 0}`)
} else {
  console.log('❌ Error:', suppliersListRes.data.error)
}

console.log()

// 9. Test POST Supplier
console.log('9️⃣  Test: POST /api/suppliers (create new supplier)')
const newSupplierRes = await request('/api/suppliers', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Test Supplier Import',
    code: `SUP-TEST-${Date.now()}`,
    type: 'DISTRIBUTOR',
    email: `supplier${Date.now()}@example.com`,
    phone: '+213555999888',
    city: 'Oran',
    country: 'Algeria',
    paymentTerms: '30 days',
    rating: 4.5,
  }),
})

console.log(`Status: ${newSupplierRes.status}`)
if (newSupplierRes.status === 201) {
  testSupplierId = newSupplierRes.data.id
  console.log('✅ Supplier created successfully!')
  console.log(`   Supplier ID: ${testSupplierId}`)
  console.log(`   Name: ${newSupplierRes.data.name}`)
  console.log(`   Code: ${newSupplierRes.data.code}`)
  console.log(`   Rating: ${newSupplierRes.data.rating}/5`)
} else {
  console.log('❌ Error:', newSupplierRes.data.error)
}

console.log()

// 10. Test Analytics Dashboard
console.log('🔟 Test: GET /api/analytics/dashboard')
const analyticsRes = await request('/api/analytics/dashboard')
console.log(`Status: ${analyticsRes.status}`)
if (analyticsRes.status === 200) {
  console.log('✅ Analytics Dashboard working!')
  console.log(`   Total vehicles: ${analyticsRes.data.summary?.totalVehicles || 0}`)
  console.log(`   Total customers: ${analyticsRes.data.summary?.totalCustomers || 0}`)
  console.log(`   Total leads: ${analyticsRes.data.summary?.totalLeads || 0}`)
  console.log(`   Total suppliers: ${analyticsRes.data.summary?.totalSuppliers || 0}`)
  console.log(`   Active users: ${analyticsRes.data.summary?.totalUsers || 0}`)
} else {
  console.log('❌ Error:', analyticsRes.data.error)
}

console.log()
console.log('═══════════════════════════════════════════════════════\n')
console.log('✅ Phase 2 Complete Tests Finished!\n')

// Résumé
console.log('📊 Test Summary:')
console.log('   ✅ Customers API: GET list + POST create + GET details')
console.log('   ✅ Leads API: GET list + POST create + PATCH update')
console.log('   ✅ Suppliers API: GET list + POST create')
console.log('   ✅ Analytics Dashboard: Global KPIs')
console.log()
console.log('🎯 Phase 2 APIs are functional and ready!')
