#!/bin/bash
# Script de test des APIs Vercel
# Usage: ./test-vercel-api.sh

# Configuration
BASE_URL="https://ibticar-ai-mvp-test-git-main-adechi-adeboyes-projects.vercel.app/api"
ADMIN_EMAIL="admin@ibticar.ai"
ADMIN_PASSWORD="Password123!"

# Couleurs pour les logs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🧪 Tests API Backend Vercel${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test 1: Page d'accueil
echo -e "${YELLOW}Test 1: Page d'accueil${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://ibticar-ai-mvp-test-git-main-adechi-adeboyes-projects.vercel.app/)
if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✅ SUCCÈS${NC} - Code: $HTTP_CODE"
else
  echo -e "${RED}❌ ÉCHEC${NC} - Code: $HTTP_CODE"
fi
echo ""

# Test 2: GET /api/auth/me (sans token)
echo -e "${YELLOW}Test 2: GET /api/auth/me (sans token)${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/auth/me" -H "Content-Type: application/json")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "401" ]; then
  echo -e "${GREEN}✅ SUCCÈS${NC} - Code: $HTTP_CODE (Unauthorized attendu)"
  echo "Réponse: $BODY"
elif [ "$HTTP_CODE" == "404" ]; then
  echo -e "${RED}❌ ÉCHEC${NC} - Code: $HTTP_CODE (Route non trouvée)"
  echo "Problème: L'endpoint n'existe pas sur Vercel"
else
  echo -e "${YELLOW}⚠️  INATTENDU${NC} - Code: $HTTP_CODE"
  echo "Réponse: $BODY"
fi
echo ""

# Test 3: POST /api/auth/signin
echo -e "${YELLOW}Test 3: POST /api/auth/signin${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✅ SUCCÈS${NC} - Code: $HTTP_CODE"
  echo "Réponse: $BODY" | jq '.' 2>/dev/null || echo "$BODY"

  # Extraire le token pour les tests suivants
  ACCESS_TOKEN=$(echo "$BODY" | jq -r '.data.accessToken' 2>/dev/null)

elif [ "$HTTP_CODE" == "401" ]; then
  echo -e "${RED}❌ ÉCHEC${NC} - Code: $HTTP_CODE (Credentials invalides)"
  echo "Réponse: $BODY"
elif [ "$HTTP_CODE" == "404" ]; then
  echo -e "${RED}❌ ÉCHEC${NC} - Code: $HTTP_CODE (Route non trouvée)"
  echo "Problème: L'endpoint n'existe pas sur Vercel"
elif [ "$HTTP_CODE" == "405" ]; then
  echo -e "${RED}❌ ÉCHEC${NC} - Code: $HTTP_CODE (Method Not Allowed)"
  echo "Problème: La méthode POST n'est pas supportée"
else
  echo -e "${YELLOW}⚠️  INATTENDU${NC} - Code: $HTTP_CODE"
  echo "Réponse: $BODY"
fi
echo ""

# Test 4: GET /api/auth/me (avec token)
if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
  echo -e "${YELLOW}Test 4: GET /api/auth/me (avec token)${NC}"
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/auth/me" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ SUCCÈS${NC} - Code: $HTTP_CODE"
    echo "Réponse: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  else
    echo -e "${RED}❌ ÉCHEC${NC} - Code: $HTTP_CODE"
    echo "Réponse: $BODY"
  fi
  echo ""

  # Test 5: GET /api/users (endpoint protégé)
  echo -e "${YELLOW}Test 5: GET /api/users (avec token)${NC}"
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/users?limit=5" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ SUCCÈS${NC} - Code: $HTTP_CODE"
    echo "Réponse: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  else
    echo -e "${RED}❌ ÉCHEC${NC} - Code: $HTTP_CODE"
    echo "Réponse: $BODY"
  fi
  echo ""

  # Test 6: GET /api/vehicles
  echo -e "${YELLOW}Test 6: GET /api/vehicles (avec token)${NC}"
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/vehicles?limit=5" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ SUCCÈS${NC} - Code: $HTTP_CODE"
    echo "Réponse: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
  else
    echo -e "${RED}❌ ÉCHEC${NC} - Code: $HTTP_CODE"
    echo "Réponse: $BODY"
  fi
  echo ""
else
  echo -e "${YELLOW}⚠️  Tests avec authentification ignorés (pas de token)${NC}"
  echo ""
fi

# Résumé
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 Résumé des Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "✅ Si tous les tests passent, le backend est opérationnel"
echo "❌ Si certains tests échouent avec 404/405, vérifier:"
echo "   - Variables d'environnement sur Vercel"
echo "   - Base de données configurée"
echo "   - Logs de build Vercel"
echo ""
echo "📄 Rapport détaillé: VERCEL_TEST_REPORT.md"
