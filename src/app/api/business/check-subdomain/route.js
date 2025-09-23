import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subdomain = searchParams.get('subdomain');
  const businessId = searchParams.get('businessId');

  if (!subdomain) {
    return NextResponse.json({ error: 'Subdomain is required' }, { status: 400 });
  }

  try {
    let query = supabase
      .from('businesses')
      .select('id')
      .eq('subdomain', subdomain);

    if (businessId) {
        query = query.not('id', 'eq', businessId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error checking subdomain:', error);
      return NextResponse.json({ error: 'Failed to check subdomain availability' }, { status: 500 });
    }
    
    return NextResponse.json({ available: !data });
  } catch (error) {
    console.error('Error in check-subdomain API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
