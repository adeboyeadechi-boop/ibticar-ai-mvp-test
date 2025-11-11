// Test complet des endpoints AI avec Node.js
import fetch from 'node-fetch';

const BASE_URL = 'https://ibticar-ai-mvp-test-a9g5gkrpd-adechi-adeboyes-projects.vercel.app/api';

async function main() {
  console.log('==========================================');
  console.log('  Test AI Endpoints - Ibticar.AI');
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

  // 2. Get or Create brand
  console.log('2. Getting brands...');
  let brandResponse = await fetch(`${BASE_URL}/brands`, { headers });
  let brandData = await brandResponse.json();
  let brandId = brandData.brands && brandData.brands[0] ? brandData.brands[0].id : null;

  if (!brandId) {
    console.log('No brands found, creating one...');
    brandResponse = await fetch(`${BASE_URL}/brands`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Toyota Test AI ' + Date.now(),
        country: 'Japan'
      })
    });
    brandData = await brandResponse.json();
    brandId = brandData.id;
  }

  if (!brandId) {
    console.error('ERROR with brand:', brandData);
    return;
  }
  console.log(`OK Brand ID: ${brandId}\n`);

  // 3. Get or Create model
  console.log('3. Getting models...');
  let modelResponse = await fetch(`${BASE_URL}/models?brandId=${brandId}`, { headers });
  let modelData = await modelResponse.json();
  let modelId = modelData.models && modelData.models[0] ? modelData.models[0].id : null;

  if (!modelId) {
    console.log('No models found, creating one...');
    modelResponse = await fetch(`${BASE_URL}/models`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        brandId,
        name: 'Corolla AI Test ' + Date.now(),
        slug: 'corolla-ai-test-' + Date.now(),
        category: 'SEDAN',
        bodyType: 'SEDAN',
        fuelType: 'GASOLINE',
        transmission: 'AUTOMATIC',
        engineCapacity: 1800,
        horsePower: 140,
        seats: 5,
        doors: 4
      })
    });
    modelData = await modelResponse.json();
    modelId = modelData.id;
  }

  if (!modelId) {
    console.error('ERROR with model:', modelData);
    return;
  }
  console.log(`OK Model ID: ${modelId}\n`);

  // 4. Create customer
  console.log('4. Creating customer...');
  const customerResponse = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'Ahmed',
      lastName: 'Test AI',
      email: 'ahmed.aitest' + Date.now() + '@test.dz',
      phone: '+213555123456',
      type: 'INDIVIDUAL'
    })
  });

  const customerData = await customerResponse.json();
  const customerId = customerData.id;
  console.log(`OK Customer created: ${customerId}\n`);

  console.log('==========================================');
  console.log('  Testing AI Endpoints');
  console.log('==========================================\n');

  // TEST 1: AI Recommendations (without vehicle - should work)
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
  console.log('Response:', recText.substring(0, 1500));
  console.log('\n');

  console.log('==========================================');
  console.log('  Tests Complete');
  console.log('==========================================');
  console.log('\nNote: AI endpoints tested without vehicle data.');
  console.log('Vehicle creation requires teamId which needs to be retrieved first.');
}

main().catch(console.error);
