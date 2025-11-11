// Test RBAC and database initialization on deployed backend
import fetch from 'node-fetch';

const BASE_URL = 'https://ibticar-ai-mvp-test-l0x1tsvsz-adechi-adeboyes-projects.vercel.app/api';

async function main() {
  console.log('==========================================');
  console.log('  Test RBAC & Database Initialization');
  console.log('  Ibticar.AI Backend');
  console.log('==========================================\n');

  console.log('Base URL:', BASE_URL);
  console.log('');

  // Test 1: Signin avec superadmin
  console.log('1. Test: Signin avec superadmin@ibticar.ai');
  console.log('--------------------------------------');
  try {
    const signInResponse = await fetch(`${BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'superadmin@ibticar.ai',
        password: 'Password123!'
      })
    });

    const signInData = await signInResponse.json();

    if (signInResponse.status === 200 && signInData.success) {
      console.log('✅ Signin réussi');
      console.log('   User ID:', signInData.user.id);
      console.log('   Role:', signInData.user.role);
      console.log('   Email:', signInData.user.email);
      console.log('');

      const TOKEN = signInData.token;
      const headers = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      };

      // Test 2: Vérifier les permissions de l'utilisateur
      console.log('2. Test: Récupérer les permissions de superadmin');
      console.log('--------------------------------------');
      const rolesResponse = await fetch(`${BASE_URL}/users/${signInData.user.id}/roles`, {
        headers
      });

      if (rolesResponse.status === 200) {
        const rolesData = await rolesResponse.json();
        console.log('✅ Permissions récupérées');
        console.log('   Rôles assignés:', rolesData.roles?.length || 0);
        if (rolesData.roles && rolesData.roles.length > 0) {
          rolesData.roles.forEach(role => {
            console.log(`   - ${role.name}`);
          });
        }
      } else {
        const errorData = await rolesResponse.json();
        console.log('❌ Échec récupération permissions');
        console.log('   Status:', rolesResponse.status);
        console.log('   Error:', errorData.error || errorData);
      }
      console.log('');

      // Test 3: Tester un endpoint protégé (vehicles)
      console.log('3. Test: Accès endpoint /api/vehicles (RBAC)');
      console.log('--------------------------------------');
      const vehiclesResponse = await fetch(`${BASE_URL}/vehicles`, { headers });

      if (vehiclesResponse.status === 200) {
        const vehiclesData = await vehiclesResponse.json();
        console.log('✅ Accès autorisé aux véhicules');
        console.log('   Véhicules trouvés:', vehiclesData.vehicles?.length || 0);
      } else if (vehiclesResponse.status === 403) {
        console.log('❌ Accès refusé (403 Forbidden)');
        console.log('   PROBLÈME: Le RBAC refuse l\'accès au superadmin!');
      } else {
        const errorData = await vehiclesResponse.json();
        console.log('⚠️  Erreur inattendue');
        console.log('   Status:', vehiclesResponse.status);
        console.log('   Error:', errorData.error || errorData);
      }
      console.log('');

      // Test 4: Vérifier les données initiales (brands, models, etc)
      console.log('4. Test: Vérifier données initiales (brands)');
      console.log('--------------------------------------');
      const brandsResponse = await fetch(`${BASE_URL}/brands`, { headers });

      if (brandsResponse.status === 200) {
        const brandsData = await brandsResponse.json();
        console.log('✅ Données brands récupérées');
        console.log('   Marques trouvées:', brandsData.brands?.length || 0);
        if (brandsData.brands && brandsData.brands.length > 0) {
          console.log('   Exemples:');
          brandsData.brands.slice(0, 3).forEach(brand => {
            console.log(`   - ${brand.name} (${brand.country || 'N/A'})`);
          });
        }
      } else {
        console.log('⚠️  Pas de données brands');
        console.log('   Status:', brandsResponse.status);
      }
      console.log('');

      // Test 5: Tester les customers
      console.log('5. Test: Vérifier données customers');
      console.log('--------------------------------------');
      const customersResponse = await fetch(`${BASE_URL}/customers`, { headers });

      if (customersResponse.status === 200) {
        const customersData = await customersResponse.json();
        console.log('✅ Données customers récupérées');
        console.log('   Clients trouvés:', customersData.customers?.length || 0);
      } else {
        console.log('⚠️  Pas de données customers');
        console.log('   Status:', customersResponse.status);
      }
      console.log('');

      // Test 6: Tester endpoint AI (nécessite permissions spéciales)
      console.log('6. Test: Accès endpoint AI (permissions spécifiques)');
      console.log('--------------------------------------');

      // On a besoin d'un customer ID pour tester
      const customersForAI = await fetch(`${BASE_URL}/customers`, { headers });
      const customersAIData = await customersForAI.json();

      if (customersAIData.customers && customersAIData.customers.length > 0) {
        const customerId = customersAIData.customers[0].id;

        const aiResponse = await fetch(`${BASE_URL}/ai/recommendations`, {
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

        if (aiResponse.status === 200) {
          console.log('✅ Accès autorisé aux endpoints AI');
          console.log('   Permission ai:recommendations fonctionnelle');
        } else if (aiResponse.status === 403) {
          console.log('❌ Accès refusé aux endpoints AI (403)');
          console.log('   PROBLÈME: Permission ai:recommendations manquante!');
        } else if (aiResponse.status === 500) {
          console.log('⚠️  Service AI non configuré (normal)');
          console.log('   Permission OK, mais AI provider manquant');
        } else {
          console.log('⚠️  Erreur inattendue');
          console.log('   Status:', aiResponse.status);
        }
      } else {
        console.log('⏭️  Pas de customer pour tester AI');
      }
      console.log('');

    } else {
      console.log('❌ Signin échoué');
      console.log('   Status:', signInResponse.status);
      console.log('   Response:', signInData);
      console.log('');
      console.log('PROBLÈME: Le compte superadmin n\'existe pas dans la DB!');
      console.log('La base de données n\'a PAS été initialisée avec les données de bdd_init.txt');
    }

  } catch (error) {
    console.log('❌ Erreur lors du test');
    console.error(error);
  }

  console.log('');
  console.log('==========================================');
  console.log('  Résumé des Tests');
  console.log('==========================================');
  console.log('');
  console.log('Ce test vérifie:');
  console.log('1. ✓ Si le compte superadmin existe (bdd_init.txt)');
  console.log('2. ✓ Si les rôles sont correctement liés (UsersOnRoles)');
  console.log('3. ✓ Si les permissions RBAC fonctionnent');
  console.log('4. ✓ Si les données initiales existent (brands, customers)');
  console.log('5. ✓ Si les permissions AI spécifiques fonctionnent');
  console.log('');
}

main().catch(console.error);
