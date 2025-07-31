import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request, { params }) {
  try {
    const { sessionId } = params;
    
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get session data
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
      
    if (sessionError) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get associated business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('session_id', sessionId)
      .single();
      
    if (businessError) {
      console.error('Error fetching business:', businessError);
    }
    
    return Response.json({
      session,
      business: business || null
    });
    
  } catch (error) {
    console.error('Session API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { sessionId } = params;
    const updates = await request.json();
    
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update session data
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();
      
    if (error) {
      console.error('Error updating session:', error);
      return new Response(JSON.stringify({ error: 'Failed to update session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return Response.json(data);
    
  } catch (error) {
    console.error('Session API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}