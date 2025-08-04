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
  let sessionId, businessId, formData;
  
  try {
    ({ sessionId, businessId, formData } = await request.json());
    
    console.log('Starting business generation via API:', { sessionId, businessId });
    
    // Initialize status
    await supabase
      .from('businesses')
      .update({
        status: 'generating'
      })
      .eq('id', businessId);

    // Update session stage to 'analyzing'
    await supabase
      .from('sessions')
      .update({ stage: 'analyzing' })
      .eq('id', sessionId);
    
    // Add a small delay to show the analyzing stage
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update session stage to 'researching'
    await supabase
      .from('sessions')
      .update({ stage: 'researching' })
      .eq('id', sessionId);
    
    // Add delay for researching stage
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update session stage to 'building'
    await supabase
      .from('sessions')
      .update({ stage: 'building' })
      .eq('id', sessionId);
    
    // Option 1: Use the legacy generator for backward compatibility
    const businessData = await generateBusinessWithAI(formData, sessionId, businessId);
    
    // Option 2: Use our new unified LaunchflyV2 class (preferred approach)
    // const launchfly = new LaunchflyV2();
    // const businessData = await launchfly.launchBusiness(formData, sessionId, businessId);
    
    // Update session stage to 'finalizing'
    await supabase
      .from('sessions')
      .update({ stage: 'finalizing' })
      .eq('id', sessionId);
    
    // Add delay for finalizing stage
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Update business with generated data
    await supabase
      .from('businesses')
      .update({
        name: businessData.businessName,
        subdomain: businessData.domain ? businessData.domain.replace('.com', '').toLowerCase() : `business-${Date.now()}`,
        business_data: businessData,
        status: 'ready'
      })
      .eq('id', businessId);

    // Mark session as complete
    await supabase
      .from('sessions')
      .update({ stage: 'complete' })
      .eq('id', sessionId);
    
    return Response.json({ 
      success: true, 
      businessData 
    });
    
  } catch (error) {
    console.error('Generation API error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    
    // Update session to error state using the stored sessionId
    if (sessionId) {
      try {
        await supabase
          .from('sessions')
          .update({ 
            stage: 'error',
            error_message: error.message 
          })
          .eq('id', sessionId);
          
        // Also update business status if we have businessId
        if (businessId) {
          await supabase
            .from('businesses')
            .update({ status: 'failed' })
            .eq('id', businessId);
        }
      } catch (updateError) {
        console.error('Error updating session/business to error state:', updateError);
      }
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      code: error.code,
      type: error.type 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Set a longer timeout for this endpoint if using Vercel
export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes timeout to handle the full generation process