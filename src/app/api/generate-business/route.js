// app/api/generate-business/route.js
import { createClient } from '@supabase/supabase-js';
import { triggerBusinessGeneration } from '@/lib/inngest-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * API route to generate a business using Inngest for background processing
 * This provides better reliability, observability, and error handling
 */
export async function POST(request) {
  let sessionId, businessId, formData;
  
  try {
    ({ sessionId, businessId, formData } = await request.json());
    
    console.log('=== INNGEST API: Starting business generation ===');
    console.log('Session ID:', sessionId);
    console.log('Business ID:', businessId);
    console.log('Form Data keys:', Object.keys(formData || {}));
    
    // Initialize status immediately
    console.log('Setting business status to generating...');
    await supabase
      .from('businesses')
      .update({
        status: 'generating'
      })
      .eq('id', businessId);

    console.log('Setting session stage to queued...');
    await supabase
      .from('sessions')
      .update({ 
        stage: 'queued',
        progress: 0 
      })
      .eq('id', sessionId);

    // Use utility function to trigger the Inngest function
    console.log('Triggering Inngest function...');
    const result = await triggerBusinessGeneration(sessionId, businessId, formData);
    
    console.log('Inngest event triggered successfully:', result.eventId);
    
    // Return immediately - the processing will happen in the background
    return Response.json({ 
      success: true, 
      message: "Business generation started",
      eventId: result.eventId,
      sessionId,
      businessId
    });
    
  } catch (error) {
    console.error('Generation API error:', error);
    
    // Update session to error state
    if (sessionId) {
      try {
        await supabase
          .from('sessions')
          .update({ 
            stage: 'error',
            error_message: error.message 
          })
          .eq('id', sessionId);
          
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
      success: false
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Optimize for serverless
export const runtime = 'nodejs';
export const maxDuration = 30; // Quick response since processing happens in background