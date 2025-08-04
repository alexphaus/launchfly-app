// app/api/generate-business/route.js
import { createClient } from '@supabase/supabase-js';
import { sendEvent, EventTypes } from '@/lib/inngest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
); 

/**
 * API route to trigger business generation using Inngest orchestration
 * This replaces the direct generation with a robust, retryable workflow
 */
export async function POST(request) {
  let sessionId, businessId, formData;
  
  try {
    ({ sessionId, businessId, formData } = await request.json());
    
    console.log('🚀 Triggering business generation orchestration:', { sessionId, businessId });
    
    // Initialize status
    await supabase
      .from('businesses')
      .update({
        status: 'queued'
      })
      .eq('id', businessId);

    await supabase
      .from('sessions')
      .update({ stage: 'queued' })
      .eq('id', sessionId);
    
    // Trigger the Inngest business generation orchestration
    await sendEvent(EventTypes.BUSINESS_GENERATION_STARTED, {
      sessionId,
      businessId,
      userData: formData,
      formData,
      triggeredAt: new Date().toISOString(),
      source: 'api'
    });
    
    console.log('✅ Business generation orchestration triggered successfully');
    
    return Response.json({
      success: true,
      message: 'Business generation started successfully',
      sessionId,
      businessId,
      status: 'orchestration_triggered'
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

// Set a shorter timeout since we're just triggering orchestration
export const runtime = 'nodejs';
export const maxDuration = 30;