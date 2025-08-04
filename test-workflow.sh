#!/bin/bash

# End-to-End Workflow Test Script
# Tests the complete flow from user creation to cold email outreach

echo "🚀 Starting Launchfly Workflow Test"
echo "=================================="

BASE_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make API calls and check results
test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    
    echo -e "${BLUE}Testing: $name${NC}"
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s "$url")
    fi
    
    if echo "$response" | grep -q "success.*true\|configured.*true"; then
        echo -e "${GREEN}✅ $name: PASSED${NC}"
        echo "Response: $response"
    else
        echo -e "${RED}❌ $name: FAILED${NC}"
        echo "Response: $response"
    fi
    echo ""
}

# 1. Test Inngest Configuration
echo "Step 1: Testing Inngest Configuration"
test_endpoint "Inngest Config" "GET" "$BASE_URL/api/test-inngest"

# 2. Test Business Generation Trigger
echo "Step 2: Testing Business Generation"
test_business_id="test-business-$(date +%s)"
test_endpoint "Business Generation" "POST" "$BASE_URL/api/test-inngest" \
    "{\"action\": \"test-business-generation\", \"businessId\": \"$test_business_id\"}"

# 3. Test Growth Strategy Trigger  
echo "Step 3: Testing Growth Strategy"
test_endpoint "Growth Strategy" "POST" "$BASE_URL/api/test-inngest" \
    "{\"action\": \"test-growth-strategy\", \"businessId\": \"$test_business_id\"}"

# 4. Test Cold Email Campaign
echo "Step 4: Testing Cold Email Campaign"
test_endpoint "Cold Email Campaign" "POST" "$BASE_URL/api/test-inngest" \
    "{\"action\": \"test-cold-email\", \"businessId\": \"$test_business_id\"}"

# 5. Test Growth API Endpoint
echo "Step 5: Testing Growth API"
test_endpoint "Growth API" "POST" "$BASE_URL/api/growth/start" \
    "{\"businessId\": \"$test_business_id\", \"strategies\": [\"cold-outreach\"]}"

# 6. Test Complete Business Generation Flow
echo "Step 6: Testing Complete Business Generation Flow"
session_id="test-session-$(date +%s)"
business_id="test-business-full-$(date +%s)"

test_endpoint "Full Business Generation" "POST" "$BASE_URL/api/generate-business" \
    "{\"sessionId\": \"$session_id\", \"businessId\": \"$business_id\", \"formData\": {\"name\": \"Test User\", \"skills\": \"Marketing\", \"experience\": \"Professional\", \"industry\": \"Technology\"}}"

echo ""
echo "🎉 Workflow Test Complete!"
echo "=========================="
echo "Test Business ID: $test_business_id"
echo "Test Session ID: $session_id" 
echo "Full Business ID: $business_id"
echo ""
echo "Note: To see the actual Inngest job execution, you'll need to:"
echo "1. Install Inngest CLI: npm install -g inngest"
echo "2. Run: inngest dev"
echo "3. Visit: http://localhost:8288"
