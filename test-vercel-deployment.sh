#!/bin/bash

# Test script for Vercel deployment
# Usage: ./test-vercel-deployment.sh [BASE_URL]

BASE_URL="${1:-https://ibticar-ai-mvp-test-git-verceltest-adechi-adeboyes-projects.vercel.app}"

echo "================================================"
echo "  Ibticar.AI Backend - Vercel Deployment Tests"
echo "================================================"
echo ""
echo "Testing URL: $BASE_URL"
echo "Timestamp: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
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

    TOTAL=$((TOTAL + 1))
    echo "Test #$TOTAL: $name"
    echo "  Endpoint: $method $endpoint"

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            "$BASE_URL$endpoint" 2>&1)
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
        echo "  Response: $(echo "$body" | head -c 100)"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# Test 1: Homepage
echo "--- Frontend Tests ---"
run_test "Homepage accessibility" "GET" "/" "200"

# Test 2-6: Protected endpoints without auth
echo "--- API Security Tests (should return 401) ---"
run_test "GET /api/vehicles (no auth)" "GET" "/api/vehicles" "401"
run_test "GET /api/customers (no auth)" "GET" "/api/customers" "401"
run_test "GET /api/brands (no auth)" "GET" "/api/brands" "401"
run_test "GET /api/auth/me (no auth)" "GET" "/api/auth/me" "401"
run_test "GET /api/users (no auth)" "GET" "/api/users" "401"

# Test 7: Authentication endpoint
echo "--- Authentication Tests ---"
run_test "POST /api/auth/signin (invalid creds)" "POST" "/api/auth/signin" "401" '{"email":"test@example.com","password":"wrongpass"}'

# Test 8-10: Various HTTP methods
echo "--- HTTP Method Tests ---"
run_test "OPTIONS /api/vehicles (CORS)" "OPTIONS" "/api/vehicles" "200"
run_test "POST /api/vehicles (no auth)" "POST" "/api/vehicles" "401" '{}'
run_test "GET /api/models (no auth)" "GET" "/api/models" "401"

# Summary
echo "================================================"
echo "  Test Summary"
echo "================================================"
echo "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    PERCENTAGE=$((PASSED * 100 / TOTAL))
    echo -e "${YELLOW}Some tests failed - Success rate: $PERCENTAGE%${NC}"
    exit 1
fi
