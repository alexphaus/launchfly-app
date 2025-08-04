// app/api/generate-business/route.js
import { createClient } from '@supabase/supabase-js';
import { inngest, INNGEST_EVENTS } from '@/lib/inngest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * API route to trigger business generation using Inngest for background processing
 * This prevents timeout issues while maintaining the same interface for the dashboard
 */
export async function POST(request) {
  let sessionId, businessId, formData;
  
  try {
    ({ sessionId, businessId, formData } = await request.json());
    
    console.log('Triggering Inngest business generation:', { sessionId, businessId });
    
    // Step 1: Create inngest_jobs record to track the background job
    const { data: inngestJob, error: jobError } = await supabase
      .from('inngest_jobs')
      .insert({
        business_id: businessId,
        job_type: 'business_generation',
        event_name: INNGEST_EVENTS.BUSINESS_GENERATION_REQUESTED,
        event_data: { sessionId, businessId, formData },
        status: 'queued',
        progress: 0
      })
      .select()
      .single();
      
    if (jobError) {
      throw new Error(`Failed to create job record: ${jobError.message}`);
    }
    
    // Step 2: Update session with job reference and set to pending
    await supabase
      .from('sessions')
      .update({ 
        inngest_job_id: inngestJob.id,
        stage: 'pending' // Will be updated to 'analyzing' once Inngest starts
      })
      .eq('id', sessionId);
      
    // Step 3: Update business status to generating
    await supabase
      .from('businesses')
      .update({
        status: 'generating'
      })
      .eq('id', businessId);

    // Step 4: Send Inngest event to trigger background processing
    const inngestResult = await inngest.send({
      name: INNGEST_EVENTS.BUSINESS_GENERATION_REQUESTED,
      data: {
        sessionId,
        businessId,
        formData,
        inngestJobId: inngestJob.id
      }
    });
    
    console.log('Inngest event sent successfully:', { 
      eventId: inngestResult.ids?.[0], 
      jobId: inngestJob.id 
    });
    
    // Step 5: Return immediately with success - the dashboard will poll for progress
    return Response.json({ 
      success: true,
      message: 'Business generation started in background',
      sessionId,
      businessId,
      jobId: inngestJob.id,
      inngestEventId: inngestResult.ids?.[0]
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

// Set runtime configuration - much faster now since we just trigger Inngest
export const runtime = 'nodejs';
export const maxDuration = 30; // 30 seconds is plenty for triggering the background job