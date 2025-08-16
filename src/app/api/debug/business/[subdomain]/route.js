// src/app/api/debug/business/[subdomain]/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request, { params }) {
  try {
    const subdomain = await params.subdomain;
    
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', subdomain)
      .single();

    if (error || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    return Response.json({
      id: business.id,
      name: business.name,
      subdomain: business.subdomain,
      status: business.status,
      businessData: business.business_data,
      products: business.business_data?.products || [],
      layout: business.business_data?.layout || []
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
