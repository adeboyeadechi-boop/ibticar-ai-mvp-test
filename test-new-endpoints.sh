#!/bin/bash

BASE_URL="https://ibticar-ai-mvp-test-1zokutlkb-adechi-adeboyes-projects.vercel.app"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}========================================================"
echo "  Test du Nouveau Déploiement Vercel"
echo "========================================================${NC}"
echo ""
echo "URL: $BASE_URL"
echo "Date: $(date)"
echo ""

# Test 1: Health Check
echo -e "${CYAN}=== TEST 1: Health Check Endpoint ===${NC}"
echo "GET /api/health"
echo ""
response=$(curl -s "$BASE_URL/api/health")
echo "$response" | head -c 500
echo ""
echo ""

status=$(echo "$response" | grep -o '"status":"[^"]*"' | head -1)
db_status=$(echo "$response" | grep -o '"database":{[^}]*}' | head -1)

if [[ $status == *"healthy"* ]]; then
    echo -e "${GREEN}✅ Status: HEALTHY${NC}"
elif [[ $status == *"degraded"* ]]; then
    echo -e "${YELLOW}⚠️  Status: DEGRADED${NC}"
else
    echo -e "${RED}❌ Status: UNHEALTHY${NC}"
fi

if [[ $db_status == *"connected"* ]]; then
    echo -e "${GREEN}✅ Database: CONNECTED${NC}"
else
    echo -e "${RED}❌ Database: DISCONNECTED${NC}"
fi
echo ""

# Test 2: Setup Status
echo -e "${CYAN}=== TEST 2: Setup Status Endpoint ===${NC}"
echo "GET /api/setup"
echo ""
response=$(curl -s "$BASE_URL/api/setup")
echo "$response" | head -c 500
echo ""
echo ""

ready=$(echo "$response" | grep -o '"ready":[^,]*' | head -1)
tables=$(echo "$response" | grep -o '"tablesExist":[^,]*' | head -1)

if [[ $ready == *"true"* ]]; then
    echo -e "${GREEN}✅ Database: READY${NC}"
else
    echo -e "${YELLOW}⚠️  Database: NOT READY${NC}"
fi

if [[ $tables == *"true"* ]]; then
    echo -e "${GREEN}✅ Tables: EXIST${NC}"
else
    echo -e "${RED}❌ Tables: DO NOT EXIST${NC}"
fi
echo ""

# Test 3: Authentication avec credentials
echo -e "${CYAN}=== TEST 3: Authentication Test ===${NC}"
echo "POST /api/auth/signin (with credentials)"
echo ""
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ibticar.ai","password":"admin123"}' \
  "$BASE_URL/api/auth/signin")
echo "$response"
echo ""

if [[ $response == *"\"error\":\"Internal server error\""* ]]; then
    echo -e "${RED}❌ Status: 500 - Database connection issue${NC}"
elif [[ $response == *"\"error\":\"Invalid credentials\""* ]]; then
    echo -e "${YELLOW}⚠️  Status: 401 - DB accessible, invalid credentials${NC}"
elif [[ $response == *"token"* ]]; then
    echo -e "${GREEN}✅ Status: 200 - Authentication successful${NC}"
else
    echo -e "${YELLOW}⚠️  Status: Unknown response${NC}"
fi
echo ""

# Test 4: CORS
echo -e "${CYAN}=== TEST 4: CORS Test ===${NC}"
echo "OPTIONS /api/health"
status_code=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE_URL/api/health")
echo "Status: $status_code"
if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ CORS: Working${NC}"
else
    echo -e "${RED}❌ CORS: Failed${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}========================================================"
echo "  Résumé"
echo "========================================================${NC}"
echo ""

if [[ $status == *"healthy"* ]] && [[ $db_status == *"connected"* ]] && [[ $tables == *"true"* ]]; then
    echo -e "${GREEN}🎉 EXCELLENT ! Le déploiement est ENTIÈREMENT FONCTIONNEL${NC}"
    echo ""
    echo "✅ Application en ligne"
    echo "✅ Base de données connectée"
    echo "✅ Tables créées"
    echo "✅ Endpoints de monitoring fonctionnels"
elif [[ $status == *"healthy"* ]] && [[ $db_status == *"connected"* ]]; then
    echo -e "${YELLOW}⚠️  BON - Database accessible mais tables manquantes${NC}"
    echo ""
    echo "✅ Application en ligne"
    echo "✅ Base de données connectée"
    echo "❌ Tables non créées"
    echo ""
    echo -e "${CYAN}Action requise: Initialiser les tables${NC}"
    echo "curl -X POST -H \"Authorization: Bearer \$NEXTAUTH_SECRET\" $BASE_URL/api/setup"
else
    echo -e "${RED}❌ PROBLÈME - Database non accessible${NC}"
    echo ""
    echo "✅ Application en ligne"
    echo "❌ Base de données non connectée"
    echo ""
    echo -e "${CYAN}Action requise: Vérifier DATABASE_URL dans Vercel${NC}"
fi

echo ""
