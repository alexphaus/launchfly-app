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

    // **DIRECT PROCESSING** - Execute business generation immediately
    try {
      console.log('Step 1: Analyzing user data...');
      const analysisResult = await analyzeOpportunity(session, sessionId);
      console.log('Analysis completed:', JSON.stringify(analysisResult, null, 2));

      // Update progress
      await supabase
        .from('sessions')
        .update({ 
          stage: 'generating',
          progress: 40 
        })
        .eq('id', sessionId);

      console.log('Step 2: Generating business concept...');
      const businessConcept = await launchBusiness(analysisResult, sessionId, businessId);
      console.log('Business concept generated:', JSON.stringify(businessConcept, null, 2));

      // Update progress
      await supabase
        .from('sessions')
        .update({ 
          stage: 'launching',
          progress: 70 
        })
        .eq('id', sessionId);

      // Step 3: Update business record with generated data
      await supabase
        .from('businesses')
        .update({
          business_data: businessConcept,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);

      // Step 4: Update session to launched
      await supabase
        .from('sessions')
        .update({ 
          stage: 'launched',
          progress: 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      console.log('✅ Business generation completed successfully');

      // Step 5: Trigger growth experiments asynchronously
      try {
        console.log('Step 5: Starting growth experiments...');
        await runGrowthExperiments(businessId, businessConcept);
        console.log('Growth experiments initiated');
      } catch (growthError) {
        console.error('Warning: Growth experiments failed (non-critical):', growthError);
        // Don't fail the main flow
      }

    } catch (processingError) {
      console.error('❌ Error in direct business generation:', processingError);
      
      // Update business status to failed
      await supabase
        .from('businesses')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);

      // Update session to failed
      await supabase
        .from('sessions')
        .update({ 
          stage: 'failed',
          error_message: processingError.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      throw processingError; // Re-throw to be caught by outer try-catch
    }

    // **INNGEST BACKUP** - Also trigger Inngest for additional processing (non-blocking)
    try {
      await sendEvent(EventTypes.BUSINESS_GENERATION_STARTED, {
        sessionId,
        businessId,
        userData: formData,
        formData,
        triggeredAt: new Date().toISOString(),
        source: 'api',
        isBackgroundProcessing: true // Flag to indicate this is backup processing
      });
      console.log('Inngest backup orchestration triggered');
    } catch (inngestError) {
      console.error('Warning: Inngest trigger failed (non-critical):', inngestError);
      // Don't fail the main flow
    }
    
    return Response.json({
      success: true,
      message: 'Business generation completed successfully',
      sessionId,
      businessId,
      status: 'completed'
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
export const maxDuration = 30;