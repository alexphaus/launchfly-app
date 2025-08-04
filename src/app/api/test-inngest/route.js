/**
 * Test API Route for Inngest Integration
 * 
 * This endpoint can be used to test the Inngest system is working correctly
 */

import { sendEvent, EventTypes } from '@/lib/inngest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { action = 'test', businessId } = await request.json();
    
    switch (action) {
      case 'test-business-generation':
        if (!businessId) {
          return Response.json({ error: 'businessId required for business generation test' }, { status: 400 });
        }
        
        await sendEvent(EventTypes.BUSINESS_GENERATION_STARTED, {
          sessionId: `test-session-${Date.now()}`,
          businessId,
          userData: {
            name: 'Test User',
            skills: 'Testing',
            experience: 'Professional',
            industry: 'Technology'
          },
          formData: {
            name: 'Test User',
            skills: 'Testing'
          },
          triggeredAt: new Date().toISOString(),
          source: 'test-api'
        });
        
        return Response.json({
          success: true,
          message: 'Business generation test triggered',
          action,
          businessId
        });
        
      case 'test-growth-strategy':
        if (!businessId) {
          return Response.json({ error: 'businessId required for growth strategy test' }, { status: 400 });
        }
        
        await sendEvent(EventTypes.GROWTH_STRATEGY_STARTED, {
          businessId,
          businessData: {
            business_data: {
              industry: 'Technology',
              businessName: 'Test Business'
            }
          },
          strategies: ['customer-acquisition'],
          triggeredAt: new Date().toISOString(),
          source: 'test-api'
        });
        
        return Response.json({
          success: true,
          message: 'Growth strategy test triggered',
          action,
          businessId
        });
        
      case 'test-cold-email':
        if (!businessId) {
          return Response.json({ error: 'businessId required for cold email test' }, { status: 400 });
        }
        
        await sendEvent(EventTypes.COLD_EMAIL_CAMPAIGN_STARTED, {
          businessId,
          businessData: {
            business_data: {
              industry: 'Technology',
              businessName: 'Test Business',
              painPoint: 'Low productivity'
            }
          },
          campaign: {
            type: 'test-campaign',
            targetSize: 10,
            industry: 'Technology'
          },
          triggeredAt: new Date().toISOString(),
          source: 'test-api'
        });
        
        return Response.json({
          success: true,
          message: 'Cold email campaign test triggered',
          action,
          businessId
        });
        
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Test API error:', error);
    
    return Response.json({
      error: error.message,
      code: error.code,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    message: 'Inngest Test API',
    methods: ['POST'],
    description: 'Test Inngest integration and workflows',
    availableActions: [
      'test-business-generation',
      'test-growth-strategy', 
      'test-cold-email'
    ],
    usage: 'POST with { "action": "test-business-generation", "businessId": "your-business-id" }',
    inngestStatus: {
      eventKey: !!process.env.INNGEST_EVENT_KEY,
      signingKey: !!process.env.INNGEST_SIGNING_KEY,
      configured: !!(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY)
    }
  });
}
