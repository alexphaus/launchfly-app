// GET /api/cron/foundation-daily-brief
//
// Runs hourly and generates the brief for operators whose local `brief_hour`
// has just arrived — the product promise is "it's ready when you wake up", and
// a single global 07:00 UTC run would be wrong for everyone outside UTC.
//
// Guard rails match the rest of the codebase's cron routes: CRON_SECRET bearer
// auth, a hard per-run cap, and per-user failures that never abort the batch.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateDailyBrief, localDate } from '@/lib/foundation/brief';
import { suggestLearning, startOfWeek } from '@/lib/foundation/growth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_BRIEFS_PER_RUN = 50;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  );
}

/** Local hour for a timezone right now, or null if the tz string is unusable. */
function localHour(timezone: string, now: Date): number | null {
  try {
    return Number(
      new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now),
    );
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const supabase = getSupabase();

  const { data: profiles, error } = await supabase
    .from('foundation_profiles')
    .select('user_id, timezone, brief_hour')
    .eq('onboarding_complete', true);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const due = (profiles ?? []).filter((p) => localHour(p.timezone, now) === p.brief_hour);
  if (!due.length) {
    return NextResponse.json({ message: 'No briefs due this hour', checked: profiles?.length ?? 0 });
  }

  const batch = due.slice(0, MAX_BRIEFS_PER_RUN);
  const isMonday = new Date().getUTCDay() === 1;
  let generated = 0;
  const failures: Array<{ user_id: string; error: string }> = [];

  for (const profile of batch) {
    try {
      const briefDate = localDate(profile.timezone, now);
      const { data: existing } = await supabase
        .from('foundation_briefs')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('brief_date', briefDate)
        .maybeSingle();
      if (existing) continue;

      await generateDailyBrief(profile.user_id, { now });
      generated += 1;

      // Learning suggestions are a weekly beat, folded into Monday's brief run.
      if (isMonday) {
        const { data: thisWeek } = await supabase
          .from('foundation_learning_items')
          .select('id')
          .eq('user_id', profile.user_id)
          .eq('week_of', startOfWeek(now))
          .limit(1);
        if (!thisWeek?.length) await suggestLearning(profile.user_id);
      }
    } catch (err) {
      failures.push({ user_id: profile.user_id, error: (err as Error).message });
    }
  }

  return NextResponse.json({
    generated,
    due: due.length,
    deferred: Math.max(0, due.length - batch.length),
    failures,
  });
}
