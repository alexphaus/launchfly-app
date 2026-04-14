/**
 * Weekly Reflection Pulse
 * 
 * THE COMPOUNDING BRAIN
 * 
 * Runs weekly (Sunday 8 AM) for each active business.
 * Spawns an agent_task that:
 * 1. Reviews recent strategic insights and memories
 * 2. Synthesizes patterns into a living "Business Playbook"
 * 3. Alerts the owner ONLY if a breakthrough-level insight emerged
 * 4. Silently terminates if nothing noteworthy was found
 * 
 * This is the heartbeat that makes the agent compound — each week it
 * stands on the shoulders of every previous conversation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAgentTask } from '@/lib/agent/runner';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export async function GET(request: NextRequest) {
  // Verify auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all active businesses with a CEO agent configured
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, name, whatsapp_notify_number, phone_number')
      .eq('active', true);

    if (error || !businesses?.length) {
      return NextResponse.json({ message: 'No active businesses', count: 0 });
    }

    let dispatched = 0;

    for (const biz of businesses) {
      const ownerPhone = biz.whatsapp_notify_number || biz.phone_number;
      if (!ownerPhone) continue;

      const reflectionGoal = `[WEEKLY REFLECTION] You are running your weekly strategic review for ${biz.name || 'the business'}.

DO THIS IN ORDER:
1. search_memory for category "strategic_insight" — review all recent insights saved this week.
2. search_memory for category "skill" — check which workflows have the highest importance_score (proven patterns).
3. search_memory broadly for recurring customer pain points, praise, or objections.

THEN SYNTHESIZE:
- Are there patterns? (e.g., "4 customers this week asked about X" or "Y approach consistently gets positive responses")
- Did any strategy fail repeatedly? Lower its mental priority.
- What are the top 3 things that WORK for this business right now?

FINALLY DECIDE:
- If you found a genuine breakthrough (a new revenue opportunity, a recurring unmet need, a competitive gap) → save_memory with category "strategic_insight" and importance 0.9, then send a brief WhatsApp to the owner: "Hi, quick weekly insight from your AI..."
- If you found useful patterns but nothing groundbreaking → save_memory with category "playbook" summarizing the top working strategies. Do NOT message the owner.
- If nothing notable → silently terminate. No noise.

CRITICAL: Do NOT fabricate insights. Only report what your memories actually show. Quality over quantity — one real insight beats ten generic observations.`;

      const { dispatched: ok } = await createAgentTask({
        businessId: biz.id,
        goal: reflectionGoal,
        role: `You are the strategic brain of ${biz.name || 'the business'}. You think in patterns, not tasks. Your job is to find the signal in the noise.`,
        ownerPhone,
      });

      if (ok) dispatched++;
    }

    return NextResponse.json({
      message: `Reflection pulse dispatched`,
      dispatched,
      total: businesses.length,
    });
  } catch (err) {
    console.error('[reflection-pulse] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
