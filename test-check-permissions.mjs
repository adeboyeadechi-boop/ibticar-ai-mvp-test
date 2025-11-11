// Check user permissions directly
import fetch from 'node-fetch';

const BASE_URL = 'https://ibticar-ai-mvp-test-cv6jl7mor-adechi-adeboyes-projects.vercel.app/api';

async function main() {
  console.log('==========================================');
  console.log('  Check User Permissions');
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
  console.log('OK Signed in successfully');
  console.log('User:', signInData.user);
  console.log('');

  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };

  // 2. Get user info
  console.log('2. Getting user info...');
  const meResponse = await fetch(`${BASE_URL}/auth/me`, { headers });
  const meData = await meResponse.json();
  console.log('User data:', JSON.stringify(meData, null, 2));
  console.log('');

  // 3. Get all permissions
  console.log('3. Getting all permissions...');
  const permissionsResponse = await fetch(`${BASE_URL}/permissions`, { headers });
  const permissionsData = await permissionsResponse.json();
  console.log('Total permissions:', permissionsData.permissions?.length || 0);
  console.log('AI permissions:', permissionsData.permissions?.filter(p => p.code.startsWith('ai:')).map(p => p.code));
  console.log('');

  // 4. Get all roles
  console.log('4. Getting all roles...');
  const rolesResponse = await fetch(`${BASE_URL}/roles`, { headers });
  const rolesData = await rolesResponse.json();
  console.log('Total roles:', rolesData.roles?.length || 0);
  console.log('Roles:', rolesData.roles?.map(r => ({ id: r.id, name: r.name })));
  console.log('');

  // 5. Get users
  console.log('5. Getting users...');
  const usersResponse = await fetch(`${BASE_URL}/users`, { headers });
  const usersData = await usersResponse.json();
  console.log('Users response status:', usersResponse.status);
  console.log('Users data preview:', JSON.stringify(usersData, null, 2).substring(0, 500));
}

main().catch(console.error);
