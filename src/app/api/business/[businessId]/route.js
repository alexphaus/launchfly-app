import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET handler for fetching business data
 * Used for polling real-time updates during business generation
 */
export async function GET(request, { params }) {
  try {
    const { businessId } = params;
    
    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }
    
    // Fetch the business data
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
      
    if (error) {
      console.error('Error fetching business:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    
    return NextResponse.json(business);
    
  } catch (error) {
    console.error('Error in business API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
