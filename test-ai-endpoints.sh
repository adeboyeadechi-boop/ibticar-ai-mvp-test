#!/bin/bash

BASE_URL="https://ibticar-ai-mvp-test-c032sv3hj-adechi-adeboyes-projects.vercel.app/api"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWhzNWxyajcwMDBzano2cjA3enNpNW90IiwiZW1haWwiOiJzdXBlcmFkbWluQGlidGljYXIuYWkiLCJyb2xlIjoiU1VQRVJfQURNSU4iLCJpYXQiOjE3NjI3Mjk4NTQsImV4cCI6MTc2MjczMDc1NH0.uhpnCVUOSs14MiqndJUKRELmeOw-9kCqIAFGHjXVVyc"

echo "=========================================="
echo "  Test des endpoints AI - Ibticar.AI"
echo "=========================================="
echo ""

# Créer une marque
echo "1. Création d'une marque (Toyota)..."
BRAND_RESPONSE=$(curl -s -X POST "$BASE_URL/brands" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Toyota","country":"Japan"}')

echo "$BRAND_RESPONSE"
BRAND_ID=$(echo "$BRAND_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
echo "Brand ID: $BRAND_ID"
echo ""

# Créer un modèle
echo "2. Création d'un modèle (Corolla)..."
MODEL_RESPONSE=$(curl -s -X POST "$BASE_URL/models" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Corolla\",\"brandId\":\"$BRAND_ID\",\"year\":2023,\"bodyType\":\"Sedan\",\"fuelType\":\"GASOLINE\",\"transmission\":\"AUTOMATIC\",\"seats\":5}")

echo "$MODEL_RESPONSE"
MODEL_ID=$(echo "$MODEL_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
echo "Model ID: $MODEL_ID"
echo ""

# Créer un véhicule
echo "3. Création d'un véhicule..."
VEHICLE_RESPONSE=$(curl -s -X POST "$BASE_URL/vehicles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"vehicleModelId\":\"$MODEL_ID\",\"vin\":\"TEST123456789\",\"year\":2023,\"color\":\"White\",\"mileage\":5000,\"condition\":\"NEW\",\"purchasePrice\":20000,\"sellingPrice\":25000,\"status\":\"AVAILABLE\"}")

echo "$VEHICLE_RESPONSE"
VEHICLE_ID=$(echo "$VEHICLE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
echo "Vehicle ID: $VEHICLE_ID"
echo ""

# Créer un client
echo "4. Création d'un client..."
CUSTOMER_RESPONSE=$(curl -s -X POST "$BASE_URL/customers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Ahmed","lastName":"Ben Ali","email":"ahmed@test.dz","phone":"+213555123456","type":"INDIVIDUAL","status":"ACTIVE"}')

echo "$CUSTOMER_RESPONSE"
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
echo "Customer ID: $CUSTOMER_ID"
echo ""

echo "=========================================="
echo "  Tests des endpoints AI"
echo "=========================================="
echo ""

# Test 1: AI Recommendations
echo "TEST 1: POST /api/ai/recommendations"
echo "--------------------------------------"
curl -s -X POST "$BASE_URL/ai/recommendations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"$CUSTOMER_ID\",\"budget\":30000,\"preferences\":{\"bodyType\":\"Sedan\",\"fuelType\":\"GASOLINE\"}}" | head -c 1000
echo ""
echo ""

# Test 2: AI Pricing
echo "TEST 2: POST /api/ai/pricing"
echo "--------------------------------------"
curl -s -X POST "$BASE_URL/ai/pricing" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"vehicleId\":\"$VEHICLE_ID\",\"currentPrice\":25000,\"daysInStock\":10,\"marketData\":{\"averageMarketPrice\":24000,\"demandLevel\":\"medium\"}}" | head -c 1000
echo ""
echo ""

# Test 3: AI Rotation
echo "TEST 3: POST /api/ai/rotation"
echo "--------------------------------------"
curl -s -X POST "$BASE_URL/ai/rotation" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"vehicleId\":\"$VEHICLE_ID\",\"historicalData\":{\"averageDaysInStock\":30,\"similarVehiclesRotation\":[25,30,35]}}" | head -c 1000
echo ""
echo ""

echo "=========================================="
echo "  Tests terminés"
echo "=========================================="
