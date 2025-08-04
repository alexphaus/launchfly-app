// app/api/generate-business/route.js
import { createClient } from '@supabase/supabase-js';
import { sendEvent, EventTypes } from '@/lib/inngest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
); 

/**
 * API route to trigger business generation via Inngest background processing
 * This route returns immediately to prevent timeouts while heavy processing runs in background
 */
export async function POST(request) {
  let sessionId, businessId, formData;
  
  try {
    ({ sessionId, businessId, formData } = await request.json());
    
    console.log('🚀 Starting business generation (background only):', { sessionId, businessId });
    
    // Get session data for validation
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error(`Session not found: ${sessionError?.message}`);
    }

    // Update status to show processing has started
    await supabase
      .from('businesses')
      .update({
        status: 'processing'
      })
      .eq('id', businessId);

    await supabase
      .from('sessions')
      .update({ 
        stage: 'analyzing',
        progress: 10 
      })
      .eq('id', sessionId);

    // Trigger Inngest for ALL processing - no synchronous work
    console.log('🔄 Triggering Inngest background processing...');
    
    // Don't await the sendEvent to prevent blocking
    sendEvent({
      name: EventTypes.BUSINESS_GENERATION_STARTED,
      data: {
        sessionId,
        businessId,
        userData: formData,
        formData,
        triggeredAt: new Date().toISOString(),
        source: 'api'
      }
    }).then(() => {
      console.log('✅ Inngest event sent successfully');
    }).catch((error) => {
      console.error('❌ Inngest event failed:', error);
    });

    console.log('✅ Background processing triggered successfully');
    
    // Return immediately - all processing happens in background
    return Response.json({
      success: true,
      message: 'Business generation started in background',
      sessionId,
      businessId,
      status: 'processing',
      backgroundProcessing: true
    });

  } catch (error) {
    console.error('❌ Generation API error:', error);
    
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
      sessionId,
      businessId
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Fast timeout since we're just triggering background processing
export const runtime = 'nodejs';
export const maxDuration = 10;