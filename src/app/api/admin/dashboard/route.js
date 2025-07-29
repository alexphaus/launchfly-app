// app/api/admin/dashboard/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET() {
  try {
    // Get business statistics
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, subdomain, status, views, created_at, total_revenue')
      .order('created_at', { ascending: false })
      .limit(10);

    if (businessError) throw businessError;

    // Get lead statistics  
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select(`
        id, name, email, service_interest, status, created_at,
        businesses!inner(name)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    // Transform leads data
    const transformedLeads = leads?.map(lead => ({
      ...lead,
      business_name: lead.businesses?.name || 'Unknown'
    })) || [];

    // Calculate statistics
    const stats = {
      totalBusinesses: businesses?.length || 0,
      activeWebsites: businesses?.filter(b => b.status === 'ready').length || 0,
      totalLeads: transformedLeads?.length || 0,
      totalRevenue: businesses?.reduce((sum, b) => sum + (b.total_revenue || 0), 0) || 0
    };

    // Get additional counts
    const { count: totalBusinessCount } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true });

    const { count: totalLeadCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });

    stats.totalBusinesses = totalBusinessCount || 0;
    stats.totalLeads = totalLeadCount || 0;

    return Response.json({
      stats,
      businesses: businesses || [],
      leads: transformedLeads
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to load dashboard data',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
