#!/bin/bash

# Script de test des API Ibticar.AI
# Usage: bash test-api.sh

API_URL="http://localhost:3000"
echo "🧪 Testing Ibticar.AI APIs..."
echo "API URL: $API_URL"
echo ""

# Test 1: Connexion avec un utilisateur
echo "1️⃣  Test: Login with admin@ibticar.ai"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@ibticar.ai", "password": "Password123!"}')

echo "Response: $LOGIN_RESPONSE"
echo ""

# Extraire le cookie de session (Note: cette approche est simplifiée)
# Dans une vraie application, on utiliserait un client HTTP qui gère les cookies

# Test 2: Récupérer l'utilisateur connecté (requiert une session)
echo "2️⃣  Test: Get current user (without session - should fail)"
ME_RESPONSE=$(curl -s -X GET "$API_URL/api/auth/me")
echo "Response: $ME_RESPONSE"
echo ""

# Test 3: Lister les utilisateurs (sans auth - should fail)
echo "3️⃣  Test: List users (without auth - should fail)"
USERS_RESPONSE=$(curl -s -X GET "$API_URL/api/users")
echo "Response: $USERS_RESPONSE"
echo ""

# Test 4: Vérifier que le serveur répond
echo "4️⃣  Test: Check if server is running"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL")
echo "HTTP Status: $HEALTH_RESPONSE"
echo ""

# Test 5: Essayer de créer un utilisateur sans auth
echo "5️⃣  Test: Create user (without auth - should fail)"
CREATE_USER_RESPONSE=$(curl -s -X POST "$API_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+213 555 000 999"
  }')
echo "Response: $CREATE_USER_RESPONSE"
echo ""

echo "✅ Tests completed!"
echo ""
echo "📝 Notes:"
echo "- For authenticated requests, you need to implement a proper HTTP client with cookie support"
echo "- Or use tools like Postman/Insomnia to test the APIs interactively"
echo "- The authentication uses HTTP-only cookies for security"
