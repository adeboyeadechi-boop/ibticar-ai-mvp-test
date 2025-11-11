// Complete AI test: Migrate permissions then test AI endpoints
import fetch from 'node-fetch';

const BASE_URL = 'https://ibticar-ai-mvp-test-cv6jl7mor-adechi-adeboyes-projects.vercel.app/api';

async function main() {
  console.log('==========================================');
  console.log('  Complete AI Test - Ibticar.AI');
  console.log('==========================================\n');

  // 1. Sign in
  console.log('1. Signing in...');
  const signInResponse = await fetch(`${BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@ibticar.ai',
      password: 'Password123!'
    })
  });

  const signInData = await signInResponse.json();
  if (!signInData.success) {
    console.error('ERROR Sign in failed:', signInData);
    return;
  }

  const TOKEN = signInData.token;
  console.log('OK Signed in successfully\n');

  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };

  // 2. Run migration
  console.log('2. Running permissions migration...');
  const migrationResponse = await fetch(`${BASE_URL}/migrate-permissions`, {
    method: 'POST',
    headers
  });

  const migrationData = await migrationResponse.json();
  console.log('Migration result:', JSON.stringify(migrationData, null, 2));
  console.log('');

  if (!migrationData.success && migrationResponse.status !== 200) {
    console.error('WARNING: Migration may have failed, but continuing with tests...\n');
  }

  // 3. Get existing data
  console.log('3. Getting existing data...');
  const brandsResponse = await fetch(`${BASE_URL}/brands`, { headers });
  const brandsData = await brandsResponse.json();
  const brandId = brandsData.brands && brandsData.brands[0] ? brandsData.brands[0].id : null;

  if (!brandId) {
    console.error('ERROR: No brands found in database');
    return;
  }
  console.log(`OK Brand ID: ${brandId}`);

  const modelsResponse = await fetch(`${BASE_URL}/models?brandId=${brandId}`, { headers });
  const modelsData = await modelsResponse.json();
  const modelId = modelsData.models && modelsData.models[0] ? modelsData.models[0].id : null;

  if (!modelId) {
    console.error('ERROR: No models found for this brand');
    return;
  }
  console.log(`OK Model ID: ${modelId}`);

  const customersResponse = await fetch(`${BASE_URL}/customers`, { headers });
  const customersData = await customersResponse.json();
  const customerId = customersData.customers && customersData.customers[0] ? customersData.customers[0].id : null;

  if (!customerId) {
    console.log('No customers found, creating one...');
    const createCustomerResponse = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        firstName: 'Ahmed',
        lastName: 'AI Test',
        email: 'ahmed.test' + Date.now() + '@test.dz',
        phone: '+213555123456',
        type: 'INDIVIDUAL'
      })
    });
    const customerData = await createCustomerResponse.json();
    const customerId = customerData.id;
    console.log(`OK Customer created: ${customerId}`);
  } else {
    console.log(`OK Customer ID: ${customerId}`);
  }
  console.log('');

  console.log('==========================================');
  console.log('  Testing AI Endpoints');
  console.log('==========================================\n');

  // TEST 1: AI Recommendations
  console.log('TEST 1: POST /api/ai/recommendations');
  console.log('--------------------------------------');
  const recResponse = await fetch(`${BASE_URL}/ai/recommendations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customerId,
      budget: 30000,
      preferences: {
        bodyType: 'Sedan',
        fuelType: 'GASOLINE'
      }
    })
  });

  const recText = await recResponse.text();
  console.log('Status:', recResponse.status);
  if (recResponse.status === 200) {
    console.log('✅ SUCCESS!');
    console.log('Response preview:', recText.substring(0, 500));
  } else {
    console.log('❌ FAILED');
    console.log('Error:', recText);
  }
  console.log('\n');

  console.log('==========================================');
  console.log('  Tests Complete');
  console.log('==========================================');
}

main().catch(console.error);
