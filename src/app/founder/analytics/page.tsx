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
    { data: activities },
    { data: subscriptions }
  ] = await Promise.all([
    supabase.from('businesses').select('id, status, created_at, total_leads'),
    supabase.from('orders').select('id, total_amount, created_at, status, stripe_session_id').eq('status', 'fulfilled'),
    supabase.from('ai_activities').select('*, businesses(name)').order('created_at', { ascending: false }).limit(50),
    supabase.from('platform_subscriptions').select('id, amount, stripe_session_id, payment_status, created_at').eq('payment_status', 'completed')
  ]);

  // Calculate aggregates
  // Use a Set to track processed stripe sessions to avoid double counting between orders and subscriptions
  const processedSessions = new Set();
  
  let totalRevenue = 0;
  const mergedOrders = [...(orders || [])];
  
  // Add revenue from orders
  orders?.forEach(o => {
    totalRevenue += (Number(o.total_amount) || 0);
    if (o.stripe_session_id) {
      processedSessions.add(o.stripe_session_id);
    }
  });
  
  // Add revenue from subscriptions (only if not already counted in orders)
  subscriptions?.forEach(s => {
    if (s.stripe_session_id && !processedSessions.has(s.stripe_session_id)) {
      totalRevenue += (Number(s.amount) || 0);
      processedSessions.add(s.stripe_session_id);
      
      // Add to merged orders for the chart
      mergedOrders.push({
        id: s.id,
        total_amount: s.amount,
        created_at: s.created_at,
        status: 'fulfilled',
        stripe_session_id: s.stripe_session_id
      });
    }
  });

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
          data={{ businesses: businesses || [], orders: mergedOrders }}
          revenue={totalRevenue}
          leads={totalLeads}
          businesses={activeBusinesses}
          recentActivity={activities || []}
        />
      </div>
    </div>
  );
}
