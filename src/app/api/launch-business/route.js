// app/api/launch-business/route.js
// New API endpoint for future-proof business launching

import { launchflyCore } from '@/lib/launchfly-core';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { sessionId, businessId, formData } = await request.json();
    
    console.log('Starting future-proof business launch:', { sessionId, businessId });
    
    // Update session to show intelligent analysis is starting
    await supabase
      .from('sessions')
      .update({
        stage: 'analyzing',
        progress: 10
      })
      .eq('id', sessionId);
    
    // Update business status
    await supabase
      .from('businesses')
      .update({
        status: 'generating'
      })
      .eq('id', businessId);
    
    // Use the new core system for comprehensive business launch
    const businessResult = await launchflyCore.launchBusiness(formData, sessionId, businessId);
    
    // Store the comprehensive business data
    await supabase
      .from('businesses')
      .update({
        name: businessResult.presence.businessName || businessResult.opportunity.niche,
        subdomain: generateSubdomain(businessResult.presence.businessName || businessResult.opportunity.niche),
        business_data: {
          // Legacy compatibility
          ...businessResult.presence,
          // New intelligence layers
          opportunity: businessResult.opportunity,
          validation: businessResult.validation,
          customerPlan: businessResult.customerPlan,
          successPlan: businessResult.successPlan,
          // Success tracking
          launchDate: new Date().toISOString(),
          nextMilestone: businessResult.successPlan.revenue_milestones[0]
        },
        status: 'ready'
      })
      .eq('id', businessId);
    
    // Mark session as complete
    await supabase
      .from('sessions')
      .update({
        stage: 'complete',
        progress: 100
      })
      .eq('id', sessionId);
    
    return Response.json({ 
      success: true, 
      businessData: businessResult,
      message: "Business launched with AI-powered success system"
    });
    
  } catch (error) {
    console.error('Business launch error:', error);
    
    // Update session to error state
    const { sessionId } = await request.json();
    await supabase
      .from('sessions')
      .update({ 
        stage: 'error',
        error_message: error.message 
      })
      .eq('id', sessionId);
    
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function generateSubdomain(businessName) {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 20);
}

export const runtime = 'nodejs';
export const maxDuration = 60;
