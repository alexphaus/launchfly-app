/**
 * Memory Decay CRON
 * 
 * Runs weekly (Sunday 7 AM, before reflection-pulse at 8 AM).
 * 
 * Purpose: Prevent memory bloat by decaying stale memories.
 * - Memories not recalled in 30+ days lose 0.05 importance per week
 * - Memories that drop below 0.1 importance are archived
 * - High-importance validated memories (>= 0.8) decay slower (0.02/week)
 * - Skills and playbooks never decay (they're curated by the reflection pulse)
 * 
 * This ensures the memory system stays lean and relevant — old, unused
 * memories fade out naturally while frequently-recalled ones stay strong.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Step 1: Decay low-importance stale memories (importance < 0.8) by 0.05
    const { data: staleNormal, error: err1 } = await supabase
      .from('ai_memories')
      .select('id, importance_score')
      .eq('archived', false)
      .lt('importance_score', 0.8)
      .neq('category', 'skill')
      .neq('category', 'playbook')
      .or(`last_recalled_at.is.null,last_recalled_at.lt.${thirtyDaysAgo}`)
      .limit(500);

    if (err1) {
      console.error('[memory-decay] Query stale normal failed:', err1.message);
      return NextResponse.json({ error: err1.message }, { status: 500 });
    }

    let decayed = 0;
    let archived = 0;

    // Batch into archive vs decay to avoid N+1 queries
    const toArchiveIds: string[] = [];
    const toDecayBuckets = new Map<number, string[]>(); // newScore → ids

    for (const mem of staleNormal || []) {
      const newScore = Math.round((mem.importance_score - 0.05) * 100) / 100;
      if (newScore < 0.1) {
        toArchiveIds.push(mem.id);
      } else {
        if (!toDecayBuckets.has(newScore)) toDecayBuckets.set(newScore, []);
        toDecayBuckets.get(newScore)!.push(mem.id);
      }
    }

    if (toArchiveIds.length > 0) {
      await supabase.from('ai_memories').update({ archived: true, updated_at: new Date().toISOString() }).in('id', toArchiveIds);
      archived += toArchiveIds.length;
    }
    for (const [score, ids] of toDecayBuckets) {
      await supabase.from('ai_memories').update({ importance_score: score, updated_at: new Date().toISOString() }).in('id', ids);
      decayed += ids.length;
    }

    // Step 2: Decay high-importance stale memories (>= 0.8) by 0.02 (slower)
    const { data: staleHigh } = await supabase
      .from('ai_memories')
      .select('id, importance_score')
      .eq('archived', false)
      .gte('importance_score', 0.8)
      .neq('category', 'skill')
      .neq('category', 'playbook')
      .or(`last_recalled_at.is.null,last_recalled_at.lt.${thirtyDaysAgo}`)
      .limit(200);

    const toDecayHighBuckets = new Map<number, string[]>();
    for (const mem of staleHigh || []) {
      const newScore = Math.round((mem.importance_score - 0.02) * 100) / 100;
      if (!toDecayHighBuckets.has(newScore)) toDecayHighBuckets.set(newScore, []);
      toDecayHighBuckets.get(newScore)!.push(mem.id);
    }
    for (const [score, ids] of toDecayHighBuckets) {
      await supabase.from('ai_memories').update({ importance_score: score, updated_at: new Date().toISOString() }).in('id', ids);
      decayed += ids.length;
    }

    return NextResponse.json({
      message: 'Memory decay complete',
      decayed,
      archived,
      scanned: (staleNormal?.length || 0) + (staleHigh?.length || 0),
    });
  } catch (err) {
    console.error('[memory-decay] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
