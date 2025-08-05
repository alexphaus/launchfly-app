// src/app/api/growth/start/route.js
/**
 * Growth API Route
 * 
 * Triggers growth strategies for existing businesses using Inngest orchestration
 */

import { createClient } from '@supabase/supabase-js';
import { sendEvent, EventTypes } from '@/lib/inngest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, strategies = ['customer-acquisition', 'cold-outreach'] } = await request.json();
    
    if (!businessId) {
      return Response.json({ error: 'Business ID is required' }, { status: 400 });
    }
    
    console.log(`🚀 Triggering growth strategies for business: ${businessId}`);
    
    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (businessError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }
    
    // Trigger growth strategy orchestration
    await sendEvent(EventTypes.GROWTH_STRATEGY_STARTED, {
      businessId,
      businessData: business,
      strategies,
      triggeredAt: new Date().toISOString(),
      source: 'api'
    });
    
    console.log(`✅ Growth strategies triggered for business: ${businessId}`);
    
    return Response.json({
      success: true,
      message: 'Growth strategies started successfully',
      businessId,
      strategies
    });
    
  } catch (error) {
    console.error('Growth API error:', error);
    
    return Response.json({
      error: error.message,
      code: error.code
    }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    message: 'Growth Strategy API',
    methods: ['POST'],
    description: 'Triggers growth strategies for businesses',
    availableStrategies: [
      'customer-acquisition',
      'cold-outreach', 
      'content-marketing',
      'social-media',
      'paid-advertising'
    ]
  });
}
