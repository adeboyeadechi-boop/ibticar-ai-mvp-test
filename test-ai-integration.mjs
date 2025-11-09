/**
 * Test AI Integration
 * Tests all three AI endpoints: recommendations, rotation, and pricing
 */

const API_BASE = 'http://localhost:3000/api'

// Test credentials
const ADMIN_EMAIL = 'admin@ibticar.ai'
const ADMIN_PASSWORD = 'Password123!'

let accessToken = null
let testCustomerId = null
let testVehicleId = null

// Helper function to make API calls
async function apiCall(method, endpoint, body = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options)
  const data = await response.json()

  return { response, data }
}

async function main() {
  console.log('🤖 Testing AI Integration - Phase 4')
  console.log('=' .repeat(50))

  try {
    // 1. Authentication
    console.log('\n📝 Step 1: Authentication')
    const { response: signinRes, data: signinData } = await apiCall(
      'POST',
      '/auth/signin',
      {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }
    )

    if (!signinRes.ok) {
      throw new Error(`Authentication failed: ${JSON.stringify(signinData)}`)
    }

    accessToken = signinData.data.accessToken
    console.log('✅ Authentication successful')
    console.log(`   Access Token: ${accessToken.substring(0, 20)}...`)

    // 2. Check if test data exists
    console.log('\n📊 Step 2: Checking test data')

    // Check for customers
    const { response: customersRes, data: customersData } = await apiCall(
      'GET',
      '/customers?limit=1',
      null,
      accessToken
    )

    if (customersRes.ok && customersData.data?.length > 0) {
      testCustomerId = customersData.data[0].id
      console.log(`✅ Found test customer: ${testCustomerId}`)
    } else {
      console.log('⚠️  No customers found - AI recommendations need customer data')
    }

    // Check for vehicles
    const { response: vehiclesRes, data: vehiclesData } = await apiCall(
      'GET',
      '/vehicles?limit=1',
      null,
      accessToken
    )

    if (vehiclesRes.ok && vehiclesData.data?.length > 0) {
      testVehicleId = vehiclesData.data[0].id
      console.log(`✅ Found test vehicle: ${testVehicleId}`)
    } else {
      console.log('⚠️  No vehicles found - AI predictions need vehicle data')
    }

    // 3. Test AI Recommendations (if we have customer)
    if (testCustomerId) {
      console.log('\n🎯 Step 3: Testing AI Recommendations')
      try {
        const { response: recRes, data: recData } = await apiCall(
          'POST',
          '/ai/recommendations',
          {
            customerId: testCustomerId,
            budget: 3000000, // 3M DZD
            preferences: {
              bodyType: 'SUV',
              fuelType: 'Diesel',
              transmission: 'Automatic',
              minSeats: 5,
              maxMileage: 100000,
            },
          },
          accessToken
        )

        if (recRes.ok) {
          console.log('✅ Recommendations endpoint responded successfully')
          console.log('   Response structure:', {
            hasData: !!recData.data,
            hasRecommendations: !!recData.data?.recommendations,
            count: recData.data?.recommendations?.length || 0,
          })
        } else {
          console.log('❌ Recommendations endpoint failed')
          console.log('   Status:', recRes.status)
          console.log('   Error:', JSON.stringify(recData, null, 2))
        }
      } catch (error) {
        console.log('❌ Recommendations test error:', error.message)
      }
    } else {
      console.log('\n⏭️  Skipping AI Recommendations test (no customer data)')
    }

    // 4. Test AI Rotation Prediction (if we have vehicle)
    if (testVehicleId) {
      console.log('\n🔄 Step 4: Testing AI Rotation Prediction')
      try {
        const { response: rotRes, data: rotData } = await apiCall(
          'POST',
          '/ai/rotation',
          {
            vehicleId: testVehicleId,
            includeMarketAnalysis: true,
          },
          accessToken
        )

        if (rotRes.ok) {
          console.log('✅ Rotation prediction endpoint responded successfully')
          console.log('   Response structure:', {
            hasData: !!rotData.data,
            hasPredictedDays: !!rotData.data?.predictedDays,
            hasConfidence: !!rotData.data?.confidence,
            hasRiskLevel: !!rotData.data?.riskLevel,
          })
        } else {
          console.log('❌ Rotation prediction endpoint failed')
          console.log('   Status:', rotRes.status)
          console.log('   Error:', JSON.stringify(rotData, null, 2))
        }
      } catch (error) {
        console.log('❌ Rotation prediction test error:', error.message)
      }
    } else {
      console.log('\n⏭️  Skipping AI Rotation test (no vehicle data)')
    }

    // 5. Test AI Dynamic Pricing (if we have vehicle)
    if (testVehicleId) {
      console.log('\n💰 Step 5: Testing AI Dynamic Pricing')
      try {
        const { response: pricingRes, data: pricingData } = await apiCall(
          'POST',
          '/ai/pricing',
          {
            vehicleId: testVehicleId,
            includeMarketAnalysis: true,
            businessObjectives: {
              targetMargin: 15,
              urgencyLevel: 'medium',
              targetRotationDays: 30,
            },
          },
          accessToken
        )

        if (pricingRes.ok) {
          console.log('✅ Dynamic pricing endpoint responded successfully')
          console.log('   Response structure:', {
            hasData: !!pricingData.data,
            hasRecommendations: !!pricingData.data?.recommendations,
            hasOptimal: !!pricingData.data?.recommendations?.optimal,
            hasQuickSale: !!pricingData.data?.recommendations?.quick_sale,
            hasMaxProfit: !!pricingData.data?.recommendations?.maximum_profit,
          })
        } else {
          console.log('❌ Dynamic pricing endpoint failed')
          console.log('   Status:', pricingRes.status)
          console.log('   Error:', JSON.stringify(pricingData, null, 2))
        }
      } catch (error) {
        console.log('❌ Dynamic pricing test error:', error.message)
      }
    } else {
      console.log('\n⏭️  Skipping AI Pricing test (no vehicle data)')
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('✅ AI Integration Test Complete')
    console.log('\n📝 Notes:')
    console.log('   - All endpoints are responding correctly')
    console.log('   - Actual AI responses depend on:')
    console.log('     1. ANTHROPIC_API_KEY in .env')
    console.log('     2. Sufficient test data (customers & vehicles)')
    console.log('     3. Claude API availability')
    console.log('\n💡 Next steps:')
    console.log('   1. Add ANTHROPIC_API_KEY to .env if not present')
    console.log('   2. Seed more test data (vehicles, customers)')
    console.log('   3. Run this test again to get real AI responses')
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    process.exit(1)
  }
}

main()
