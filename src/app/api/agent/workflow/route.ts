// src/app/api/agent/workflow/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Agent Workflow Cron — Runs scheduled agent workflows
//
// Called by: Vercel Cron (every 15 minutes) or QStash scheduler
// Checks agent_workflows table for tasks whose next_run_at has passed,
// dispatches them via QStash, and updates next_run_at.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

/**
 * Parse a cron expression and compute the next run time after `after`.
 * Supports: minute hour day-of-month month day-of-week
 * Simple implementation covering common patterns.
 */
function getNextCronRun(cronExpr: string, timezone: string, after: Date = new Date()): Date | null {
  try {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) return null;

    const [minPart, hourPart, domPart, monPart, dowPart] = parts;

    // For simplicity, handle the most common patterns:
    // "0 9 * * 1" = every Monday at 9:00
    // "0 9 * * *" = every day at 9:00
    // "0 */6 * * *" = every 6 hours
    // "30 8 1 * *" = 1st of every month at 8:30

    const parseField = (field: string, max: number): number[] => {
      if (field === '*') return Array.from({ length: max }, (_, i) => i);
      if (field.includes('/')) {
        const [, step] = field.split('/');
        const s = parseInt(step, 10);
        return Array.from({ length: Math.ceil(max / s) }, (_, i) => i * s).filter(v => v < max);
      }
      if (field.includes(',')) return field.split(',').map(Number);
      return [parseInt(field, 10)];
    };

    const minutes = parseField(minPart, 60);
    const hours = parseField(hourPart, 24);
    const doms = domPart === '*' ? null : parseField(domPart, 32);
    const dows = dowPart === '*' ? null : parseField(dowPart, 7);

    // Brute-force: check each minute in the next 31 days
    const candidate = new Date(after.getTime() + 60_000); // start 1 minute after
    candidate.setSeconds(0, 0);

    for (let i = 0; i < 31 * 24 * 60; i++) {
      const d = new Date(candidate.getTime() + i * 60_000);
      // Convert to timezone for matching
      const tzStr = d.toLocaleString('en-US', { timeZone: timezone });
      const tz = new Date(tzStr);

      const m = tz.getMinutes();
      const h = tz.getHours();
      const dom = tz.getDate();
      const dow = tz.getDay(); // 0=Sun

      if (!minutes.includes(m)) continue;
      if (!hours.includes(h)) continue;
      if (doms && !doms.includes(dom)) continue;
      if (dows && !dows.includes(dow)) continue;

      return d;
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // Optional auth for cron security
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date();

  // Find all active workflows that are due
  const { data: dueWorkflows, error } = await supabase
    .from('agent_workflows')
    .select('*, businesses!inner(name, whatsapp_notify_number, whatsapp_number, phone_number)')
    .eq('active', true)
    .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`);

  if (error) {
    console.error('[workflow] Error fetching workflows:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dueWorkflows?.length) {
    return NextResponse.json({ ok: true, dispatched: 0 });
  }

  const qstashToken = process.env.QSTASH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
  let dispatched = 0;

  for (const wf of dueWorkflows) {
    try {
      // Look up the assistant for this workflow
      const { data: assistant } = await supabase
        .from('assistants')
        .select('system_prompt, tools_enabled')
        .eq('business_id', wf.business_id)
        .eq('name', wf.assistant_name)
        .limit(1)
        .maybeSingle();

      const role = assistant?.system_prompt || `You are ${wf.assistant_name} for ${wf.businesses?.name || 'the business'}.`;
      const rawTools = wf.enabled_tools?.length > 0
        ? wf.enabled_tools
        : (Array.isArray(assistant?.tools_enabled) ? assistant.tools_enabled : null);

      const ownerPhone = wf.businesses?.whatsapp_notify_number
        || wf.businesses?.whatsapp_number
        || wf.businesses?.phone_number;

      // Substitute template variables in goal
      const todayStr = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: wf.timezone || 'Europe/Madrid',
      });
      const goal = wf.goal_template
        .replace(/\{\{date\}\}/g, todayStr)
        .replace(/\{\{business_name\}\}/g, wf.businesses?.name || '')
        .replace(/\{\{workflow_name\}\}/g, wf.name);

      // Dispatch via QStash
      if (qstashToken) {
        const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
        const targetUrl = `${appUrl.replace(/\/$/, '')}/api/agent/run`;

        const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${qstashToken}`,
            'Content-Type': 'application/json',
            'Upstash-Retries': '1',
            'Upstash-Delay': '2s',
          },
          body: JSON.stringify({
            businessId: wf.business_id,
            goal,
            role,
            enabledTools: rawTools,
            ownerPhone,
          }),
        });

        if (res.ok) {
          dispatched++;
          console.log(`[workflow] Dispatched "${wf.name}" for business ${wf.business_id}`);
        } else {
          console.error(`[workflow] Failed to dispatch "${wf.name}": ${res.status}`);
        }
      }

      // Calculate and save next run time
      const nextRun = getNextCronRun(wf.cron_expression, wf.timezone || 'Europe/Madrid', now);
      await supabase.from('agent_workflows').update({
        last_run_at: now.toISOString(),
        next_run_at: nextRun?.toISOString() || null,
        updated_at: now.toISOString(),
      }).eq('id', wf.id);
    } catch (err) {
      console.error(`[workflow] Error processing "${wf.name}":`, err);
    }
  }

  return NextResponse.json({ ok: true, dispatched, checked: dueWorkflows.length });
}

// Also support GET for Vercel Cron
export async function GET(req: NextRequest) {
  return POST(req);
}
