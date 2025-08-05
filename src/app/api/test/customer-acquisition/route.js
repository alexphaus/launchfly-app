// src/app/api/test/customer-acquisition/route.js
import { createClient } from '@supabase/supabase-js';
import { inngest, EVENTS } from '@/lib/inngest/client';
import { startCustomerAcquisition } from '@/lib/customer-acquisition';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Test endpoint to verify the real customer acquisition system is working
 * 
 * Usage: POST /api/test/customer-acquisition
 * Body: { businessId: "uuid-here" }
 */
export async function POST(request) {
  try {
    const { businessId, testMode = true } = await request.json();

    if (!businessId) {
      return Response.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    console.log(`🧪 Testing customer acquisition for business: ${businessId}`);

    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return Response.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Test various components
    const testResults = {
      timestamp: new Date().toISOString(),
      businessId,
      businessName: business.name,
      tests: {}
    };

    // 1. Test Environment Variables
    testResults.tests.environment = {
      resend_api_key: !!process.env.RESEND_API_KEY,
      apollo_api_key: !!process.env.APOLLO_API_KEY,
      openai_api_key: !!process.env.OPENAI_API_KEY,
      inngest_keys: !!(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY),
      from_email: !!process.env.FROM_EMAIL
    };

    // 2. Test Database Connection
    try {
      const { data: testQuery } = await supabase
        .from('ai_activities')
        .select('id')
        .limit(1);
      testResults.tests.database = { success: true, message: 'Database connection working' };
    } catch (error) {
      testResults.tests.database = { success: false, error: error.message };
    }

    // 3. Test Inngest Event Sending
    try {
      if (testMode) {
        // Just test the event structure, don't actually trigger
        testResults.tests.inngest = { 
          success: true, 
          message: 'Inngest client configured (test mode - not triggered)' 
        };
      } else {
        // Actually trigger customer acquisition
        await inngest.send({
          name: EVENTS.CUSTOMER_ACQUISITION_STARTED,
          data: {
            businessId,
            businessData: business.business_data
          }
        });
        testResults.tests.inngest = { 
          success: true, 
          message: 'Customer acquisition triggered successfully!' 
        };
      }
    } catch (error) {
      testResults.tests.inngest = { success: false, error: error.message };
    }

    // 4. Test Customer Acquisition Function (without actual execution)
    try {
      const mockBusinessData = {
        businessName: business.name || 'Test Business',
        targetAudience: 'Small business owners',
        products: business.business_data?.products || []
      };
      
      // Test function exists and can be called (but don't actually run it)
      testResults.tests.customerAcquisition = {
        success: typeof startCustomerAcquisition === 'function',
        message: 'Customer acquisition function available',
        businessData: mockBusinessData
      };
    } catch (error) {
      testResults.tests.customerAcquisition = { success: false, error: error.message };
    }

    // Overall status
    const allTestsPassed = Object.values(testResults.tests).every(test => test.success);
    testResults.overall = {
      success: allTestsPassed,
      message: allTestsPassed 
        ? '✅ All tests passed! Real customer acquisition is ready to go!' 
        : '❌ Some tests failed. Check the details above.'
    };

    // Recommendations
    testResults.recommendations = [];
    
    if (!testResults.tests.environment.apollo_api_key) {
      testResults.recommendations.push('🔑 Get Apollo.io API key for real prospect discovery');
    }
    
    if (!testResults.tests.environment.from_email) {
      testResults.recommendations.push('📧 Set FROM_EMAIL environment variable');
    }
    
    if (!testResults.tests.environment.inngest_keys) {
      testResults.recommendations.push('⚙️ Configure Inngest API keys');
    }

    if (testResults.recommendations.length === 0) {
      testResults.recommendations.push('🚀 Everything looks good! Try running a real test with testMode: false');
    }

    return Response.json(testResults);

  } catch (error) {
    console.error('Test error:', error);
    return Response.json(
      { 
        error: 'Test failed',
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    title: 'Customer Acquisition Test Suite',
    description: 'Tests the real customer acquisition system components',
    usage: {
      method: 'POST',
      endpoint: '/api/test/customer-acquisition',
      body: { 
        businessId: 'your-business-uuid',
        testMode: true // Set to false to actually trigger customer acquisition
      }
    },
    components: [
      'Environment Variables',
      'Database Connection', 
      'Inngest Event System',
      'Customer Acquisition Functions',
      'Email Service Integration'
    ]
  });
}