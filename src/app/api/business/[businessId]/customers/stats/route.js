import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export async function GET(request, { params }) {
  const { businessId } = params;

  if (!businessId) {
    return NextResponse.json({ success: false, error: 'Business ID is required' }, { status: 400 });
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch total customers
    const { count: totalCustomers, error: totalError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if (totalError) throw totalError;

    // Fetch new customers this week
    const { count: newThisWeek, error: newError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (newError) throw newError;

    const stats = {
      totalCustomers,
      newThisWeek,
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch customer stats' }, { status: 500 });
  }
}
