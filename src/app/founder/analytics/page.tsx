import { createClient } from '@supabase/supabase-js';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function FounderAnalyticsPage() {
  // Fetch data in parallel
  const [
    { data: businesses },
    { data: orders },
    { data: activities }
  ] = await Promise.all([
    supabase.from('businesses').select('id, status, created_at, total_leads'),
    supabase.from('orders').select('id, total_amount, created_at, status').eq('status', 'fulfilled'),
    supabase.from('ai_activities').select('*, businesses(name)').order('created_at', { ascending: false }).limit(50)
  ]);

  // Calculate aggregates
  const totalRevenue = orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;
  const totalLeads = businesses?.reduce((sum, b) => sum + (b.total_leads || 0), 0) || 0;
  const activeBusinesses = businesses?.filter(b => b.status === 'active' || b.status === 'ready').length || 0;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Founder Analytics</h1>
          <p className="text-slate-600 mt-2">Real-time platform performance metrics.</p>
        </div>

        <AnalyticsDashboard 
          data={{ businesses: businesses || [], orders: orders || [] }}
          revenue={totalRevenue}
          leads={totalLeads}
          businesses={activeBusinesses}
          recentActivity={activities || []}
        />
      </div>
    </div>
  );
}
