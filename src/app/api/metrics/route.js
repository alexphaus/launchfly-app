// src/app/api/metrics/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET /api/metrics
export async function GET() {
  try {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    // Total users (profiles) and total businesses
    const [{ count: totalUsers }, { count: totalBusinesses }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('businesses').select('*', { count: 'exact', head: true })
    ]);

    // Live users (sessions in last 10 minutes)
    const { count: liveUsers } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', tenMinutesAgo);

    // % hit $1k (all time and last 60 days from T0)
    const [{ data: allBiz }, { data: recentBiz }] = await Promise.all([
      supabase.from('businesses').select('id, total_revenue'),
      supabase.from('businesses').select('id, guarantee_start_at, total_revenue').gte('guarantee_start_at', sixtyDaysAgo)
    ]);

    const allHit = (allBiz || []).filter(b => Number(b.total_revenue || 0) >= 1000).length;
    const pctHitAll = totalBusinesses ? Math.round((allHit / totalBusinesses) * 100) : 0;

    const recentCount = (recentBiz || []).length;
    const recentHit = (recentBiz || []).filter(b => Number(b.total_revenue || 0) >= 1000).length;
    const pctHit60d = recentCount ? Math.round((recentHit / recentCount) * 100) : 0;

    // Spots left: use env or default
    const spotsLeft = Number(process.env.NEXT_PUBLIC_SPOTS_LEFT || process.env.SPOTS_LEFT || 7);

    return Response.json({
      ok: true,
      spotsLeft,
      liveUsers: liveUsers || 0,
      totals: {
        users: totalUsers || 0,
        businesses: totalBusinesses || 0
      },
      performance: {
        pctHit1kAllTime: pctHitAll,
        pctHit1kLast60d: pctHit60d
      },
      ts: now.toISOString()
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
