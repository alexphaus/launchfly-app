import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request, { params }) {
  const { sessionId } = params;
  
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*, business:businesses(*)')
    .eq('id', sessionId)
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return Response.json(session);
}

export async function PATCH(request, { params }) {
  const { sessionId } = params;
  const updates = await request.json();
  
  const { data, error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return Response.json(data);
}