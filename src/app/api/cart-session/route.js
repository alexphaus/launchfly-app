// API endpoint for cart session tracking
// Used for abandoned cart recovery

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      sessionToken, 
      customerEmail, 
      customerName, 
      items, 
      totalAmount,
      businessId 
    } = body;

    if (!sessionToken || !items || items.length === 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Extract businessId from current URL or session if not provided
    let actualBusinessId = businessId;
    if (!actualBusinessId) {
      // Try to get from referer header
      const referer = request.headers.get('referer');
      if (referer) {
        const urlMatch = referer.match(/\/sites\/([^\/]+)/);
        if (urlMatch) {
          const subdomain = urlMatch[1];
          const { data: business } = await supabase
            .from('businesses')
            .select('id')
            .eq('subdomain', subdomain)
            .single();
          actualBusinessId = business?.id;
        }
      }
    }

    if (!actualBusinessId) {
      console.warn('Could not determine business ID for cart session');
      return Response.json({ error: 'Business ID required' }, { status: 400 });
    }

    // Upsert cart session
    const { data, error } = await supabase
      .from('cart_sessions')
      .upsert({
        session_token: sessionToken,
        business_id: actualBusinessId,
        customer_email: customerEmail || null,
        customer_name: customerName || null,
        items: JSON.stringify(items),
        total_amount: totalAmount || 0,
        last_activity_at: new Date().toISOString()
      }, {
        onConflict: 'session_token'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating cart session:', error);
      return Response.json({ error: 'Failed to update cart session' }, { status: 500 });
    }

    return Response.json({ success: true, sessionId: data.id });
  } catch (error) {
    console.error('Cart session API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get('token');

  if (!sessionToken) {
    return Response.json({ error: 'Session token required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('cart_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .single();

    if (error || !data) {
      return Response.json({ error: 'Cart session not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      session: {
        ...data,
        items: JSON.parse(data.items || '[]')
      }
    });
  } catch (error) {
    console.error('Error fetching cart session:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
