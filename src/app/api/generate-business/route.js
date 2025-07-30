// app/api/generate-business/route.js
import { createClient } from '@supabase/supabase-js';
import { generateBusinessWithAI } from '@/lib/business-generator';
import { LaunchflyV2 } from '@/core';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * API route to generate a business using our future-proof architecture
 * Following the principles from future-proof-approach.md
 */
export async function POST(request) {
  try {
    const { sessionId, businessId, formData } = await request.json();
    
    console.log('Starting business generation via API:', { sessionId, businessId });
    
    // Initialize status
    await supabase
      .from('businesses')
      .update({
        status: 'generating'
      })
      .eq('id', businessId);
    
    // Option 1: Use the legacy generator for backward compatibility
    // const businessData = await generateBusinessWithAI(formData, sessionId, businessId);
    
    // Option 2: Use our new unified LaunchflyV2 class (preferred approach)
    const launchfly = new LaunchflyV2();
    const businessData = await launchfly.launchBusiness(formData, sessionId, businessId);
    
    // Update business with generated data
    await supabase
      .from('businesses')
      .update({
        name: businessData.businessName,
        subdomain: businessData.domain.replace('.com', '').toLowerCase(),
        business_data: businessData,
        status: 'ready'
      })
      .eq('id', businessId);
    
    // Session is already marked complete by generateBusinessWithAI
    
    return Response.json({ 
      success: true, 
      businessData 
    });
    
  } catch (error) {
    console.error('Generation API error:', error);
    
    // Update session to error state
    if (request.body) {
      const { sessionId } = await request.json();
      await supabase
        .from('sessions')
        .update({ stage: 'error' })
        .eq('id', sessionId);
    }
    
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Set a longer timeout for this endpoint if using Vercel
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout