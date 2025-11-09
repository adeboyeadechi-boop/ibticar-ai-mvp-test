#!/bin/bash

# Comprehensive test script for all Vercel-deployed routes
# Usage: ./test-all-routes-vercel.sh

BASE_URL="https://ibticar-ai-mvp-test-git-verceltest-adechi-adeboyes-projects.vercel.app"

echo "========================================================"
echo "  Ibticar.AI Backend - Complete Route Testing"
echo "========================================================"
echo ""
echo "Testing URL: $BASE_URL"
echo "Timestamp: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
TOTAL=0

# Function to run a test
run_test() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local data="$5"
    local headers="$6"

    TOTAL=$((TOTAL + 1))
    echo "Test #$TOTAL: $name"
    echo "  Endpoint: $method $endpoint"

    if [ -n "$data" ]; then
        if [ -n "$headers" ]; then
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                -H "Content-Type: application/json" \
                -H "$headers" \
                -d "$data" \
                "$BASE_URL$endpoint" 2>&1)
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$BASE_URL$endpoint" 2>&1)
        fi
    else
        if [ -n "$headers" ]; then
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                -H "Content-Type: application/json" \
                -H "$headers" \
                "$BASE_URL$endpoint" 2>&1)
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                -H "Content-Type: application/json" \
                "$BASE_URL$endpoint" 2>&1)
        fi
    fi

    # Extract status code (last line)
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    echo "  Expected: $expected_status"
    echo "  Got: $status"

    if [ "$status" = "$expected_status" ]; then
        echo -e "  ${GREEN}✓ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "  ${RED}✗ FAILED${NC}"
        echo "  Response: $(echo "$body" | head -c 150)"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# ===== FRONTEND TESTS =====
echo -e "${BLUE}===== FRONTEND TESTS =====${NC}"
run_test "Homepage accessibility" "GET" "/" "200"
run_test "Not found page" "GET" "/nonexistent-page" "404"

# ===== AUTHENTICATION TESTS =====
echo -e "${BLUE}===== AUTHENTICATION TESTS =====${NC}"
run_test "GET NextAuth providers" "GET" "/api/auth/providers" "200"
run_test "POST signin (no body)" "POST" "/api/auth/signin" "500"
run_test "POST signin (empty body)" "POST" "/api/auth/signin" "400" '{}'
run_test "POST signin (email only)" "POST" "/api/auth/signin" "400" '{"email":"test@test.com"}'
run_test "POST signin (password only)" "POST" "/api/auth/signin" "400" '{"password":"test123"}'
run_test "POST signin (invalid credentials)" "POST" "/api/auth/signin" "500" '{"email":"test@test.com","password":"wrongpass"}'
run_test "GET /api/auth/me (no auth)" "GET" "/api/auth/me" "401"
run_test "POST refresh token (no auth)" "POST" "/api/auth/refresh" "401"
run_test "OPTIONS signin (CORS)" "OPTIONS" "/api/auth/signin" "200"

# ===== 2FA TESTS (without auth) =====
echo -e "${BLUE}===== 2FA ENDPOINTS (No Auth) =====${NC}"
run_test "POST 2FA setup (no auth)" "POST" "/api/auth/2fa/setup" "401"
run_test "POST 2FA verify (no auth)" "POST" "/api/auth/2fa/verify" "401"
run_test "POST 2FA disable (no auth)" "POST" "/api/auth/2fa/disable" "401"

# ===== VEHICLE ENDPOINTS =====
echo -e "${BLUE}===== VEHICLE ENDPOINTS (No Auth) =====${NC}"
run_test "GET /api/vehicles (no auth)" "GET" "/api/vehicles" "401"
run_test "POST /api/vehicles (no auth)" "POST" "/api/vehicles" "401" '{}'
run_test "GET /api/vehicles/123 (no auth)" "GET" "/api/vehicles/123" "401"
run_test "PUT /api/vehicles/123 (no auth)" "PUT" "/api/vehicles/123" "401" '{}'
run_test "DELETE /api/vehicles/123 (no auth)" "DELETE" "/api/vehicles/123" "401"
run_test "OPTIONS /api/vehicles (CORS)" "OPTIONS" "/api/vehicles" "200"

# ===== CUSTOMER ENDPOINTS =====
echo -e "${BLUE}===== CUSTOMER ENDPOINTS (No Auth) =====${NC}"
run_test "GET /api/customers (no auth)" "GET" "/api/customers" "401"
run_test "POST /api/customers (no auth)" "POST" "/api/customers" "401" '{}'
run_test "GET /api/customers/123 (no auth)" "GET" "/api/customers/123" "401"
run_test "PUT /api/customers/123 (no auth)" "PUT" "/api/customers/123" "401" '{}'
run_test "DELETE /api/customers/123 (no auth)" "DELETE" "/api/customers/123" "401"

# ===== LEAD ENDPOINTS =====
echo -e "${BLUE}===== LEAD ENDPOINTS (No Auth) =====${NC}"
run_test "GET /api/leads (no auth)" "GET" "/api/leads" "401"
run_test "POST /api/leads (no auth)" "POST" "/api/leads" "401" '{}'
run_test "GET /api/leads/123 (no auth)" "GET" "/api/leads/123" "401"
run_test "PUT /api/leads/123 (no auth)" "PUT" "/api/leads/123" "401" '{}'
run_test "DELETE /api/leads/123 (no auth)" "DELETE" "/api/leads/123" "401"

# ===== SUPPLIER ENDPOINTS =====
echo -e "${BLUE}===== SUPPLIER ENDPOINTS (No Auth) =====${NC}"
run_test "GET /api/suppliers (no auth)" "GET" "/api/suppliers" "401"
run_test "POST /api/suppliers (no auth)" "POST" "/api/suppliers" "401" '{}'
run_test "GET /api/suppliers/123 (no auth)" "GET" "/api/suppliers/123" "401"
run_test "PUT /api/suppliers/123 (no auth)" "PUT" "/api/suppliers/123" "401" '{}'
run_test "DELETE /api/suppliers/123 (no auth)" "DELETE" "/api/suppliers/123" "401"

# ===== USER MANAGEMENT ENDPOINTS =====
echo -e "${BLUE}===== USER MANAGEMENT ENDPOINTS (No Auth) =====${NC}"
run_test "GET /api/users (no auth)" "GET" "/api/users" "401"
run_test "POST /api/users (no auth)" "POST" "/api/users" "401" '{}'
run_test "GET /api/users/123 (no auth)" "GET" "/api/users/123" "401"
run_test "PUT /api/users/123 (no auth)" "PUT" "/api/users/123" "401" '{}'
run_test "DELETE /api/users/123 (no auth)" "DELETE" "/api/users/123" "401"
run_test "GET /api/users/123/roles (no auth)" "GET" "/api/users/123/roles" "401"

# ===== ROLE & PERMISSION ENDPOINTS =====
echo -e "${BLUE}===== ROLE & PERMISSION ENDPOINTS (No Auth) =====${NC}"
run_test "GET /api/roles (no auth)" "GET" "/api/roles" "401"
run_test "POST /api/roles (no auth)" "POST" "/api/roles" "401" '{}'
run_test "GET /api/roles/123 (no auth)" "GET" "/api/roles/123" "401"
run_test "PUT /api/roles/123 (no auth)" "PUT" "/api/roles/123" "401" '{}'
run_test "DELETE /api/roles/123 (no auth)" "DELETE" "/api/roles/123" "401"
run_test "GET /api/roles/123/permissions (no auth)" "GET" "/api/roles/123/permissions" "401"
run_test "GET /api/permissions (no auth)" "GET" "/api/permissions" "401"

# ===== BRAND & MODEL ENDPOINTS =====
echo -e "${BLUE}===== BRAND & MODEL ENDPOINTS (No Auth) =====${NC}"
run_test "GET /api/brands (no auth)" "GET" "/api/brands" "401"
run_test "POST /api/brands (no auth)" "POST" "/api/brands" "401" '{}'
run_test "GET /api/models (no auth)" "GET" "/api/models" "401"
run_test "POST /api/models (no auth)" "POST" "/api/models" "401" '{}'

# ===== STOCK MANAGEMENT ENDPOINTS =====
echo -e "${BLUE}===== STOCK MANAGEMENT ENDPOINTS (No Auth) =====${NC}"
run_test "GET /api/stock/transfers (no auth)" "GET" "/api/stock/transfers" "401"
run_test "POST /api/stock/transfers (no auth)" "POST" "/api/stock/transfers" "401" '{}'
run_test "GET /api/stock/transfers/123 (no auth)" "GET" "/api/stock/transfers/123" "401"
run_test "PUT /api/stock/transfers/123 (no auth)" "PUT" "/api/stock/transfers/123" "401" '{}'

# ===== AI ENDPOINTS =====
echo -e "${BLUE}===== AI ENDPOINTS (No Auth) =====${NC}"
run_test "POST /api/ai/pricing (no auth)" "POST" "/api/ai/pricing" "401" '{}'
run_test "POST /api/ai/recommendations (no auth)" "POST" "/api/ai/recommendations" "401" '{}'
run_test "POST /api/ai/rotation (no auth)" "POST" "/api/ai/rotation" "401" '{}'

# ===== ANALYTICS ENDPOINTS =====
echo -e "${BLUE}===== ANALYTICS ENDPOINTS (No Auth) =====${NC}"
run_test "GET /api/analytics/dashboard (no auth)" "GET" "/api/analytics/dashboard" "401"

# Summary
echo "========================================================"
echo "  Test Summary"
echo "========================================================"
echo "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    PERCENTAGE=$((PASSED * 100 / TOTAL))
    echo -e "${YELLOW}Success rate: $PERCENTAGE%${NC}"

    if [ $PERCENTAGE -ge 90 ]; then
        echo -e "${GREEN}Excellent! Most routes working correctly.${NC}"
    elif [ $PERCENTAGE -ge 70 ]; then
        echo -e "${YELLOW}Good, but some issues to address.${NC}"
    else
        echo -e "${RED}Significant issues detected.${NC}"
    fi

    exit 1
fi
