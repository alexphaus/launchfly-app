// app/api/generate-business/route.js
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest';
import { BusinessEvents } from '@/lib/inngest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
); 

/**
 * API route to generate a business using Inngest for orchestration
 * This follows the future-proof architecture with background processing
 */
export async function POST(request) {
  let sessionId, businessId, formData;
  
  try {
    ({ sessionId, businessId, formData } = await request.json());
    
    console.log('Starting business generation via API with Inngest:', { sessionId, businessId });
    
    // Initialize status
    await supabase
      .from('businesses')
      .update({
        status: 'generating'
      })
      .eq('id', businessId);

    // Update session stage to 'pending'
    await supabase
      .from('sessions')
      .update({ 
        stage: 'pending',
        progress: 10
      })
      .eq('id', sessionId);
    
    // Trigger the Inngest orchestration function
    await inngest.send({
      name: BusinessEvents.GenerationRequested,
      data: {
        sessionId,
        businessId,
        formData
      }
    });
    
    return Response.json({ 
      success: true, 
      message: "Business generation started successfully",
      sessionId,
      businessId
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

// Set a longer timeout for this endpoint
export const runtime = 'nodejs';