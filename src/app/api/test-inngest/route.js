// app/api/test-inngest/route.js
import { triggerBusinessGeneration } from '@/lib/inngest-utils';

/**
 * Test endpoint to verify Inngest integration is working
 */
export async function GET() {
  try {
    console.log('=== TESTING INNGEST INTEGRATION ===');
    
    // Test data
    const testSessionId = 'test-session-' + Date.now();
    const testBusinessId = 'test-business-' + Date.now();
    const testFormData = {
      businessIdea: 'Test AI business',
      targetMarket: 'Test market',
      experience: 'beginner'
    };
    
    console.log('Triggering test business generation...');
    const result = await triggerBusinessGeneration(testSessionId, testBusinessId, testFormData);
    
    return Response.json({
      success: true,
      message: 'Inngest test triggered successfully',
      eventId: result.eventId,
      testData: {
        sessionId: testSessionId,
        businessId: testBusinessId
      }
    });
    
  } catch (error) {
    console.error('Inngest test failed:', error);
    
    return Response.json({
      success: false, 
      error: error.message,
      message: 'Inngest test failed'
    }, { status: 500 });
  }
}

export async function POST() {
  return Response.json({
    message: 'Use GET to test Inngest integration'
  });
}
