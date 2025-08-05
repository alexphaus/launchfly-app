// src/app/api/generate-business/route.js
import { createClient } from '@supabase/supabase-js';
import { inngest, EVENTS } from '@/lib/inngest/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * API route to trigger business generation via Inngest
 * This provides better orchestration and error handling
 */
export async function POST(request) {
  let sessionId, businessId, formData;
  
  try {
    ({ sessionId, businessId, formData } = await request.json());
    
    console.log('Triggering business generation via Inngest:', { sessionId, businessId });
    
    // Send event to Inngest to start generation
    await inngest.send({
      name: EVENTS.BUSINESS_GENERATION_STARTED,
      data: {
        sessionId,
        businessId,
        formData
      }
    });
    
    // Return immediately - Inngest will handle the async processing
    return Response.json({ 
      success: true, 
      message: 'Business generation started',
      sessionId,
      businessId
    });
    
  } catch (error) {
    console.error('Error triggering generation:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    
    // Update session to error state if we can
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