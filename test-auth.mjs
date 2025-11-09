// Test script for authentication
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3003';

async function testAuth() {
  console.log('🧪 Testing Ibticar.AI Authentication...\n');

  // Test 1: Try to access protected endpoint without auth
  console.log('1️⃣  Test: Access /api/auth/me without session');
  const meResponse = await fetch(`${API_URL}/api/auth/me`);
  const meData = await meResponse.json();
  console.log(`Status: ${meResponse.status}`);
  console.log(`Response:`, meData);
  console.log('');

  // Test 2: Get CSRF token
  console.log('2️⃣  Test: Get CSRF token');
  const csrfResponse = await fetch(`${API_URL}/api/auth/csrf`);
  const csrfData = await csrfResponse.json();
  const csrfCookie = csrfResponse.headers.get('set-cookie');
  console.log(`CSRF Token:`, csrfData.csrfToken);
  console.log('');

  // Test 3: Sign in with credentials
  console.log('3️⃣  Test: Sign in with credentials');
  const signinBody = new URLSearchParams({
    email: 'admin@ibticar.ai',
    password: 'Password123!',
    csrfToken: csrfData.csrfToken,
    callbackUrl: `${API_URL}`,
    json: 'true'
  });

  const signinResponse = await fetch(`${API_URL}/api/auth/signin/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': csrfCookie || ''
    },
    body: signinBody,
    redirect: 'manual'
  });

  console.log(`Status: ${signinResponse.status}`);
  console.log(`Headers:`, Object.fromEntries(signinResponse.headers.entries()));

  // Get response body
  const signinText = await signinResponse.text();
  console.log(`Response body:`, signinText);

  // Get session cookies
  const cookies = signinResponse.headers.get('set-cookie');
  console.log(`Cookies:`, cookies);
  console.log('');

  if (cookies) {
    // Test 4: Access protected endpoint with session
    console.log('4️⃣  Test: Access /api/auth/me with session');
    const authMeResponse = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Cookie': cookies
      }
    });
    const authMeData = await authMeResponse.json();
    console.log(`Status: ${authMeResponse.status}`);
    console.log(`Response:`, authMeData);
    console.log('');

    // Test 5: List users (requires admin)
    console.log('5️⃣  Test: List users (admin only)');
    const usersResponse = await fetch(`${API_URL}/api/users`, {
      headers: {
        'Cookie': cookies
      }
    });
    const usersData = await usersResponse.json();
    console.log(`Status: ${usersResponse.status}`);
    console.log(`Response:`, JSON.stringify(usersData, null, 2));
  }

  console.log('\n✅ Tests completed!');
}

testAuth().catch(console.error);
