// app/api/generate-business-stream/route.js
import { createClient } from '@supabase/supabase-js';
import { generateBusinessWithAIStream } from '../../../lib/business-generator-stream';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Streaming API route for real-time business generation
 * Shows content being built piece by piece as OpenAI generates it
 */
export async function POST(request) {
  let sessionId, businessId, formData;
  
  try {
    ({ sessionId, businessId, formData } = await request.json());
    
    console.log('Starting streaming business generation:', { sessionId, businessId });
    
    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Initialize status
          await supabase
            .from('businesses')
            .update({ status: 'generating' })
            .eq('id', businessId);

          // Send initial progress update
          controller.enqueue(`data: ${JSON.stringify({
            type: 'stage',
            stage: 'analyzing',
            message: 'Starting business analysis...'
          })}\n\n`);

          // Update session stage to 'analyzing'
          await supabase
            .from('sessions')
            .update({ stage: 'analyzing' })
            .eq('id', sessionId);

          // Generate business with streaming updates
          await generateBusinessWithAIStream(
            formData, 
            sessionId, 
            businessId,
            (update) => {
              // Send real-time updates to the client
              controller.enqueue(`data: ${JSON.stringify(update)}\n\n`);
            }
          );

          // Mark as complete
          await supabase
            .from('sessions')
            .update({ stage: 'complete' })
            .eq('id', sessionId);

          controller.enqueue(`data: ${JSON.stringify({
            type: 'complete',
            message: 'Business generation complete!'
          })}\n\n`);

          controller.close();
        } catch (error) {
          console.error('Streaming generation error:', error);
          
          await supabase
            .from('sessions')
            .update({ stage: 'error' })
            .eq('id', sessionId);

          controller.enqueue(`data: ${JSON.stringify({
            type: 'error',
            message: error.message
          })}\n\n`);
          
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('Stream setup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for streaming
