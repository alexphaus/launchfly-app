// src/app/api/cron/reset-wa-counters/route.ts
// Cron job to reset whatsapp_instances.sends_today counters
// Schedule: Daily at midnight UTC via QStash or Vercel Cron

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase.rpc('reset_wa_instance_counters');

  if (error) {
    console.error('[cron] reset_wa_instance_counters failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  console.log('[cron] WhatsApp instance counters reset');
  return Response.json({ ok: true });
}
