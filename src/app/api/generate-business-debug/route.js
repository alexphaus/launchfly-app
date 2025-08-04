// app/api/generate-business-debug/route.js
import { createClient } from '@supabase/supabase-js';
import { triggerDebugBusinessGeneration } from '@/lib/inngest-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * DEBUG API route to generate a business using mock data (no AI calls)
 */
export async function POST(request) {
  let sessionId, businessId, formData;
  
  try {
    ({ sessionId, businessId, formData } = await request.json());
    
    console.log('=== DEBUG API: Starting business generation ===');
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

    // Use debug utility function to trigger the Inngest function
    console.log('Triggering DEBUG Inngest function...');
    const result = await triggerDebugBusinessGeneration(sessionId, businessId, formData);
    
    console.log('DEBUG Inngest event triggered successfully:', result.eventId);
    
    // Return immediately - the processing will happen in the background
    return Response.json({ 
      success: true, 
      message: "DEBUG Business generation started",
      eventId: result.eventId,
      sessionId,
      businessId,
      debug: true
    });
    
  } catch (error) {
    console.error('DEBUG Generation API error:', error);
    
    // Update session to error state if we have the IDs
    if (sessionId) {
      try {
        await supabase
          .from('sessions')
          .update({ 
            stage: 'error', 
            error_message: error.message 
          })
          .eq('id', sessionId);
      } catch (dbError) {
        console.error('Failed to update session error state:', dbError);
      }
    }
    
    return Response.json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ 
    message: 'DEBUG Business Generation API',
    description: 'Uses mock data instead of AI calls for faster debugging',
    usage: 'POST with { sessionId, businessId, formData }'
  });
}

// Optimize for serverless
export const runtime = 'nodejs';
export const maxDuration = 30;
