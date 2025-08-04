// app/api/generate-business/route.js
import { createClient } from '@supabase/supabase-js';
import { sendEvent, EventTypes } from '@/lib/inngest';
import { analyzeOpportunity } from '@/core/analyze';
import { launchBusiness } from '@/core/launch';
import { runGrowthExperiments } from '@/core/grow';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
); 

/**
 * API route to trigger business generation with hybrid approach:
 * - Process immediately for development/immediate results
 * - Also trigger Inngest for production scalability
 */
export async function POST(request) {
  let sessionId, businessId, formData;
  
  try {
    ({ sessionId, businessId, formData } = await request.json());
    
    console.log('🚀 Starting business generation (hybrid approach):', { sessionId, businessId });
    
    // Get session data for processing
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error(`Session not found: ${sessionError?.message}`);
    }

    // Initialize status to processing
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

    // **ASYNC PROCESSING** - Trigger Inngest for heavy AI operations
    try {
      // Set session to building stage immediately 
      await supabase
        .from('sessions')
        .update({ 
          stage: 'building',
          progress: 20 
        })
        .eq('id', sessionId);

      // Trigger async business generation via Inngest
      await sendEvent(EventTypes.BUSINESS_GENERATION_STARTED, {
        sessionId,
        businessId,
        userData: formData,
        formData,
        triggeredAt: new Date().toISOString(),
        source: 'api'
      });
      
      console.log('✅ Business generation started via Inngest');
    } catch (inngestError) {
      console.error('❌ Failed to trigger Inngest business generation:', inngestError);
      
      // Fallback: Set error state
      await supabase
        .from('sessions')
        .update({ 
          stage: 'failed',
          error_message: 'Failed to start business generation process',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      throw inngestError;
    }
    
    return Response.json({
      success: true,
      message: 'Business generation started successfully',
      sessionId,
      businessId,
      status: 'building'
    });

  } catch (error) {
    console.error('❌ Generation API error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    
    // Update session to error state
    if (sessionId) {
      try {
        await supabase
          .from('sessions')
          .update({ 
            stage: 'failed',
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

// Set a shorter timeout since we're just triggering orchestration
export const runtime = 'nodejs';
export const maxDuration = 10;