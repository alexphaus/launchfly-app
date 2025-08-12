// src/app/api/intake/route.js
import { createClient } from '@supabase/supabase-js';
import { selectPlan } from '@/lib/strategy/selector';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, intake } = await request.json();
    if (!businessId) return Response.json({ error: 'businessId required' }, { status: 400 });

    const plan = selectPlan(intake || {});

    const { error } = await supabase
      .from('businesses')
      .update({ strategy_plan: plan, updated_at: new Date().toISOString() })
      .eq('id', businessId);

    if (error) throw error;

    return Response.json({ success: true, plan });
  } catch (error) {
    console.error('Intake error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ title: 'Intake API', method: 'POST', body: { businessId: 'uuid', intake: { vertical: 'plumber', geo: 'Ohio', budget: 100, assets: {} } } });
}


