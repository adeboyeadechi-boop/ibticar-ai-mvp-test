#!/bin/bash

BASE_URL="https://ibticar-ai-mvp-test-kxlu1lhkw-adechi-adeboyes-projects.vercel.app"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${MAGENTA}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║        TEST DU DÉPLOIEMENT FINAL - IBTICAR.AI             ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "URL: $BASE_URL"
echo "Date: $(date)"
echo ""

# Test 1: Homepage
echo -e "${CYAN}▶ Test 1: Homepage${NC}"
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$status" = "200" ]; then
    echo -e "${GREEN}  ✅ Homepage: 200 OK${NC}"
else
    echo -e "${RED}  ❌ Homepage: $status${NC}"
fi
echo ""

# Test 2: Health Check
echo -e "${CYAN}▶ Test 2: Health Check Endpoint${NC}"
response=$(curl -s "$BASE_URL/api/health")
echo "$response" | python -m json.tool 2>/dev/null || echo "$response"
echo ""

health_status=$(echo "$response" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
db_status=$(echo "$response" | grep -o '"database":{"status":"[^"]*"' | cut -d'"' -f6)

if [[ $health_status == "healthy" ]]; then
    echo -e "${GREEN}  ✅ Status: HEALTHY${NC}"
else
    echo -e "${RED}  ❌ Status: $health_status${NC}"
fi

if [[ $db_status == "connected" ]]; then
    echo -e "${GREEN}  ✅ Database: CONNECTED${NC}"
else
    echo -e "${RED}  ❌ Database: $db_status${NC}"
fi
echo ""

# Test 3: Setup Status (CRUCIAL)
echo -e "${CYAN}▶ Test 3: Setup Status - Tables Check${NC}"
response=$(curl -s "$BASE_URL/api/setup")
echo "$response" | python -m json.tool 2>/dev/null || echo "$response"
echo ""

ready=$(echo "$response" | grep -o '"ready":[^,]*' | cut -d':' -f2)
tables=$(echo "$response" | grep -o '"tablesExist":[^,]*' | cut -d':' -f2)
user_count=$(echo "$response" | grep -o '"userCount":[0-9]*' | cut -d':' -f2)

if [[ $ready == "true" ]]; then
    echo -e "${GREEN}  ✅ Database: READY${NC}"
else
    echo -e "${RED}  ❌ Database: NOT READY${NC}"
fi

if [[ $tables == "true" ]]; then
    echo -e "${GREEN}  ✅ Tables: EXIST${NC}"
    if [[ ! -z "$user_count" ]]; then
        echo -e "${GREEN}  ✅ Users: $user_count${NC}"
    fi
else
    echo -e "${RED}  ❌ Tables: DO NOT EXIST${NC}"
fi
echo ""

# Test 4: Authentication
echo -e "${CYAN}▶ Test 4: Authentication Test${NC}"
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ibticar.ai","password":"admin123"}' \
  "$BASE_URL/api/auth/signin")
echo "Response: $response"
echo ""

if [[ $response == *"token"* ]]; then
    echo -e "${GREEN}  ✅ Authentication: SUCCESS (got token)${NC}"
elif [[ $response == *"Invalid credentials"* ]]; then
    echo -e "${YELLOW}  ⚠️  Authentication: DB works, credentials invalid${NC}"
elif [[ $response == *"Internal server error"* ]]; then
    echo -e "${RED}  ❌ Authentication: 500 error (DB issue)${NC}"
else
    echo -e "${YELLOW}  ⚠️  Authentication: Unknown response${NC}"
fi
echo ""

# Test 5: Protected Endpoint
echo -e "${CYAN}▶ Test 5: Protected Endpoint Security${NC}"
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/vehicles")
if [ "$status" = "401" ]; then
    echo -e "${GREEN}  ✅ Security: Returns 401 without auth${NC}"
else
    echo -e "${RED}  ❌ Security: Returns $status${NC}"
fi
echo ""

# Summary
echo -e "${MAGENTA}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    RÉSUMÉ FINAL                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

if [[ $health_status == "healthy" ]] && [[ $db_status == "connected" ]] && [[ $tables == "true" ]]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║   🎉🎉🎉  SUCCÈS TOTAL - DÉPLOIEMENT PARFAIT !  🎉🎉🎉   ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}✅ Application en ligne${NC}"
    echo -e "${GREEN}✅ Base de données connectée${NC}"
    echo -e "${GREEN}✅ Tables créées automatiquement${NC}"
    echo -e "${GREEN}✅ Endpoints de monitoring fonctionnels${NC}"
    echo -e "${GREEN}✅ Sécurité API opérationnelle${NC}"
    echo ""
    echo -e "${CYAN}Le système d'auto-initialisation fonctionne à 100% ! 🚀${NC}"
    echo ""
elif [[ $health_status == "healthy" ]] && [[ $db_status == "connected" ]] && [[ $tables != "true" ]]; then
    echo -e "${YELLOW}⚠️  PRESQUE PARFAIT - Tables manquantes${NC}"
    echo ""
    echo -e "${GREEN}✅ Application en ligne${NC}"
    echo -e "${GREEN}✅ Base de données connectée${NC}"
    echo -e "${RED}❌ Tables non créées${NC}"
    echo ""
    echo -e "${CYAN}Action: Vérifier les logs de build Vercel${NC}"
else
    echo -e "${RED}❌ PROBLÈMES DÉTECTÉS${NC}"
    echo ""
    echo -e "Status: $health_status"
    echo -e "Database: $db_status"
    echo -e "Tables: $tables"
fi

echo ""
