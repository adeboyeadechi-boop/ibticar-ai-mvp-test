// Final AI test: Link role, then test AI endpoints
import fetch from 'node-fetch';

const BASE_URL = 'https://ibticar-ai-mvp-test-87q7629hc-adechi-adeboyes-projects.vercel.app/api';

async function main() {
  console.log('==========================================');
  console.log('  Final AI Test - Ibticar.AI');
  console.log('  with Google Gemini Support');
  console.log('==========================================\n');

  // 1. Sign in
  console.log('1. Signing in as superadmin...');
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
  console.log('✅ Signed in successfully\n');

  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };

  // 2. Link superadmin to role
  console.log('2. Linking superadmin to Super Admin role...');
  const linkResponse = await fetch(`${BASE_URL}/link-superadmin-role`, {
    method: 'POST',
    headers
  });

  const linkData = await linkResponse.json();
  console.log('Link result:', JSON.stringify(linkData, null, 2));
  console.log('');

  if (!linkData.success && linkResponse.status !== 200) {
    console.error('WARNING: Role linking may have failed, but continuing...\n');
  }

  // 3. Get existing data
  console.log('3. Getting existing data for tests...');
  const customersResponse = await fetch(`${BASE_URL}/customers`, { headers });
  const customersData = await customersResponse.json();
  let customerId = customersData.customers && customersData.customers[0] ? customersData.customers[0].id : null;

  if (!customerId) {
    console.log('Creating test customer...');
    const createCustomerResponse = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        firstName: 'Ahmed',
        lastName: 'AI Test Final',
        email: 'ahmed.final' + Date.now() + '@test.dz',
        phone: '+213555999888',
        type: 'INDIVIDUAL'
      })
    });
    const customerData = await createCustomerResponse.json();
    customerId = customerData.id;
  }
  console.log(`✅ Customer ID: ${customerId}\n`);

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

  console.log('Status:', recResponse.status);

  if (recResponse.status === 200) {
    const recData = await recResponse.json();
    console.log('✅ SUCCESS! AI Recommendations working!');
    console.log('Response preview:', JSON.stringify(recData, null, 2).substring(0, 800));
  } else {
    const recText = await recResponse.text();
    console.log('❌ FAILED');
    console.log('Error:', recText);
  }
  console.log('\n');

  // TEST 2: Check if AI provider is configured
  console.log('TEST 2: Check AI Provider Configuration');
  console.log('--------------------------------------');
  console.log('Note: To use Google Gemini, set these environment variables in Vercel:');
  console.log('  AI_PROVIDER=gemini');
  console.log('  GOOGLE_API_KEY=your-google-ai-studio-key');
  console.log('');
  console.log('To use Claude (default):');
  console.log('  AI_PROVIDER=claude');
  console.log('  ANTHROPIC_API_KEY=your-anthropic-key');
  console.log('');

  console.log('==========================================');
  console.log('  Tests Complete');
  console.log('==========================================');
}

main().catch(console.error);
