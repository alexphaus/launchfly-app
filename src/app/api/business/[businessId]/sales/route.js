import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request, { params }) {
  try {
    const { businessId } = params;
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since'); // Optional filter for sales since a date

    if (!businessId) {
      return Response.json({ error: 'Business ID required' }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from('sales')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    // Add date filter if provided
    if (since) {
      query = query.gte('created_at', since);
    }

    const { data: sales, error } = await query;

    if (error) {
      console.error('Error fetching sales:', error);
      return Response.json({ error: 'Failed to fetch sales' }, { status: 500 });
    }

    return Response.json({
      success: true,
      sales: sales || [],
      count: sales?.length || 0
    });

  } catch (error) {
    console.error('Sales API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}



