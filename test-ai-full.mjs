// Test complet des endpoints AI avec Node.js
import fetch from 'node-fetch';

const BASE_URL = 'https://ibticar-ai-mvp-test-c032sv3hj-adechi-adeboyes-projects.vercel.app/api';

async function main() {
  console.log('==========================================');
  console.log('  Test des endpoints AI - Ibticar.AI');
  console.log('==========================================\n');

  // 1. Se connecter
  console.log('1. Connexion...');
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
    console.error('❌ Erreur de connexion:', signInData);
    return;
  }

  const TOKEN = signInData.token;
  console.log('✅ Connecté avec succès\n');

  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };

  // 2. Récupérer l'utilisateur courant pour avoir le teamId
  console.log('2. Récupération des informations utilisateur...');
  const meResponse = await fetch(`${BASE_URL}/users`, { headers });
  const usersData = await meResponse.json();
  console.log('Users data:', JSON.stringify(usersData, null, 2).substring(0, 500));

  // Trouver un teamId en interrogeant directement la base via un endpoint
  // Utilisons l'endpoint brands d'abord pour tester

  // 3. Creer une marque
  console.log('\n3. Creation d\'une marque (Toyota)...');
  const brandResponse = await fetch(`${BASE_URL}/brands`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Toyota Test',
      country: 'Japan'
    })
  });

  const brandData = await brandResponse.json();
  console.log('Brand:', brandData);
  const brandId = brandData.id;

  if (!brandId) {
    console.error('❌ Erreur création marque');
    return;
  }
  console.log(`OK Marque creee: ${brandId}\n`);

  // 4. Creer un modele
  console.log('4. Creation d\'un modele (Corolla)...');
  const modelResponse = await fetch(`${BASE_URL}/models`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brandId,
      name: 'Corolla Test',
      slug: 'corolla-test',
      category: 'SEDAN',
      bodyType: 'Sedan',
      fuelType: 'GASOLINE',
      transmission: 'AUTOMATIC',
      year: 2023,
      seats: 5,
      doors: 4,
      engine: '1.8L'
    })
  });

  const modelData = await modelResponse.json();
  console.log('Model:', modelData);
  const modelId = modelData.id;

  if (!modelId) {
    console.error('❌ Erreur création modèle:', modelData);
    return;
  }
  console.log(`✅ Modèle créé: ${modelId}\n`);

  // 5. Récupérer le teamId du superadmin
  // On sait que le seed crée une team "Ibticar HQ"
  // Essayons avec un teamId fictif ou retrouvons-le
  const TEAM_ID = 'cmhs5lrj6000rjz6rf9v1g9g9'; // A ajuster selon seed

  // 6. Créer un véhicule
  console.log('5. Création d'un véhicule...');
  const vehicleResponse = await fetch(`${BASE_URL}/vehicles`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      vin: 'TESTVIN' + Date.now(),
      vehicleModelId: modelId,
      teamId: TEAM_ID,
      year: 2023,
      color: 'White',
      mileage: 5000,
      condition: 'NEW',
      purchasePrice: 20000,
      sellingPrice: 25000,
      status: 'AVAILABLE'
    })
  });

  const vehicleData = await vehicleResponse.json();
  console.log('Vehicle:', JSON.stringify(vehicleData, null, 2).substring(0, 500));
  const vehicleId = vehicleData.id;

  if (!vehicleId) {
    console.error('⚠️  Impossible de créer le véhicule (problème teamId?). Continuons quand même...\n');
  } else {
    console.log(`✅ Véhicule créé: ${vehicleId}\n`);
  }

  // 7. Créer un client
  console.log('6. Création d'un client...');
  const customerResponse = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'Ahmed',
      lastName: 'Ben Ali',
      email: 'ahmed.test' + Date.now() + '@test.dz',
      phone: '+213555123456',
      type: 'INDIVIDUAL',
      status: 'ACTIVE'
    })
  });

  const customerData = await customerResponse.json();
  console.log('Customer:', customerData);
  const customerId = customerData.id;
  console.log(`✅ Client créé: ${customerId}\n`);

  console.log('==========================================');
  console.log('  Tests des endpoints AI');
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

  const recData = await recResponse.json();
  console.log('Status:', recResponse.status);
  console.log('Response:', JSON.stringify(recData, null, 2).substring(0, 1000));
  console.log('\n');

  // TEST 2: AI Pricing (si on a un vehicleId)
  if (vehicleId) {
    console.log('TEST 2: POST /api/ai/pricing');
    console.log('--------------------------------------');
    const pricingResponse = await fetch(`${BASE_URL}/ai/pricing`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vehicleId,
        currentPrice: 25000,
        daysInStock: 10,
        marketData: {
          averageMarketPrice: 24000,
          demandLevel: 'medium'
        }
      })
    });

    const pricingData = await pricingResponse.json();
    console.log('Status:', pricingResponse.status);
    console.log('Response:', JSON.stringify(pricingData, null, 2).substring(0, 1000));
    console.log('\n');

    // TEST 3: AI Rotation
    console.log('TEST 3: POST /api/ai/rotation');
    console.log('--------------------------------------');
    const rotationResponse = await fetch(`${BASE_URL}/ai/rotation`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vehicleId,
        historicalData: {
          averageDaysInStock: 30,
          similarVehiclesRotation: [25, 30, 35]
        }
      })
    });

    const rotationData = await rotationResponse.json();
    console.log('Status:', rotationResponse.status);
    console.log('Response:', JSON.stringify(rotationData, null, 2).substring(0, 1000));
    console.log('\n');
  }

  console.log('==========================================');
  console.log('  Tests terminés');
  console.log('==========================================');
}

main().catch(console.error);
