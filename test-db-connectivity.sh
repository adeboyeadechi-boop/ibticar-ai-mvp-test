#!/bin/bash

BASE_URL="https://ibticar-ai-mvp-test-3mtyicgk4-adechi-adeboyes-projects.vercel.app"

echo "========================================================"
echo "  Tests de Connectivité Base de Données"
echo "========================================================"
echo ""
echo "URL: $BASE_URL"
echo "Date: $(date)"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Test 1: POST /api/auth/signin avec credentials${NC}"
echo "Tentative d'authentification (devrait accéder à la DB)..."
response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ibticar.ai","password":"admin123"}' \
  "$BASE_URL/api/auth/signin")

status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

echo "Status: $status"
echo "Response: $body"

if [ "$status" = "500" ]; then
  echo -e "${RED}❌ ERREUR 500 - Probablement problème de connexion DB${NC}"
elif [ "$status" = "401" ]; then
  echo -e "${YELLOW}⚠️  401 - DB accessible mais credentials invalides${NC}"
elif [ "$status" = "200" ]; then
  echo -e "${GREEN}✅ 200 - DB accessible et credentials valides${NC}"
fi
echo ""

echo -e "${BLUE}Test 2: POST /api/auth/signin avec autre email${NC}"
echo "Test avec email différent..."
response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' \
  "$BASE_URL/api/auth/signin")

status=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

echo "Status: $status"
echo "Response: $body"

if [ "$status" = "500" ]; then
  echo -e "${RED}❌ ERREUR 500 - Confirme le problème DB${NC}"
elif [ "$status" = "401" ]; then
  echo -e "${YELLOW}⚠️  401 - DB accessible${NC}"
fi
echo ""

echo -e "${BLUE}Test 3: Analyse des erreurs${NC}"
echo "Vérification du message d'erreur..."
error_msg=$(echo "$body" | grep -i "error")
echo "Message: $error_msg"
echo ""

echo "========================================================"
echo "  Diagnostic"
echo "========================================================"

if [ "$status" = "500" ]; then
  echo -e "${RED}PROBLÈME IDENTIFIÉ:${NC}"
  echo "- Les endpoints retournent 500 dès qu'ils tentent d'accéder à la DB"
  echo "- La validation des champs fonctionne (400 avant accès DB)"
  echo "- L'erreur se produit lors de la requête Prisma"
  echo ""
  echo "CAUSES PROBABLES:"
  echo "1. DATABASE_URL non configuré dans Vercel"
  echo "2. DATABASE_URL incorrect"
  echo "3. Base de données non accessible depuis Vercel"
  echo "4. Prisma Client non généré correctement"
  echo ""
  echo "ACTION REQUISE:"
  echo "→ Vérifier Vercel Dashboard → Settings → Environment Variables"
  echo "→ S'assurer que DATABASE_URL est configuré"
elif [ "$status" = "401" ]; then
  echo -e "${GREEN}BASE DE DONNÉES ACCESSIBLE ✅${NC}"
  echo "- La connexion à la DB fonctionne"
  echo "- Les credentials testés sont invalides"
  echo "- Le système fonctionne normalement"
else
  echo "Status inattendu: $status"
fi

echo ""
