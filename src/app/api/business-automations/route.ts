// src/app/api/business-automations/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Business-level Automation Rules API
// ═══════════════════════════════════════════════════════════════════════════
//
// Automation rules are stored at the business level (businesses.automation_rules)
// so they remain active regardless of which assistant persona is selected.
//
// GET  /api/business-automations?businessId=xxx  → Return automation_rules
// POST /api/business-automations                  → Save rules & sync QStash CRONs

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── Types ────────────────────────────────────────────────────────────────

interface ScheduleConfig {
  hour?: number;
  minute?: number;
  days?: string[];
  timezone?: string;
  qstashScheduleId?: string;
}

interface AutomationRule {
  id: string;
  event: string;
  enabled: boolean;
  scheduleConfig?: ScheduleConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET — Return the business's automation rules
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get('businessId');
    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('businesses')
      .select('automation_rules')
      .eq('id', businessId)
      .maybeSingle();

    if (error) {
      console.error('[business-automations] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rules: (data?.automation_rules as AutomationRule[]) || [] });
  } catch (err) {
    console.error('[business-automations] GET unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST — Save automation rules and sync QStash CRONs
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { businessId: string; rules: AutomationRule[] };

    if (!body.businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }
    if (!Array.isArray(body.rules)) {
      return NextResponse.json({ error: 'rules must be an array' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify business exists
    const { data: biz, error: bizErr } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', body.businessId)
      .maybeSingle();

    if (bizErr || !biz) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Sync QStash CRONs and get back rules with updated qstashScheduleId values
    const syncedRules = await syncBusinessCrons(body.businessId, body.rules);

    // Save to DB
    const { error: saveErr } = await supabase
      .from('businesses')
      .update({ automation_rules: syncedRules })
      .eq('id', body.businessId);

    if (saveErr) {
      console.error('[business-automations] POST save error:', saveErr);
      return NextResponse.json({ error: saveErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rules: syncedRules });
  } catch (err) {
    console.error('[business-automations] POST unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// QStash CRON Sync — create/update/delete schedules for daily_schedule rules
// ═══════════════════════════════════════════════════════════════════════════

async function syncBusinessCrons(
  businessId: string,
  rules: AutomationRule[],
): Promise<AutomationRule[]> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) return rules;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
  const triggerUrl = `${appUrl}/api/assistants/trigger`;
  const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';

  // Work on a deep copy so we can mutate scheduleConfig
  const updatedRules: AutomationRule[] = JSON.parse(JSON.stringify(rules));
  const scheduleRules = updatedRules.filter(r => r.event === 'daily_schedule');

  const tzOffsets: Record<string, number> = {
    'Pacific/Honolulu': -10, 'America/Los_Angeles': -8, 'America/Denver': -7,
    'America/Chicago': -6, 'America/New_York': -5, 'America/Sao_Paulo': -3,
    'Europe/London': 0, 'Europe/Madrid': 1, 'Europe/Istanbul': 3,
    'Asia/Dubai': 4, 'Asia/Kolkata': 5.5, 'Asia/Bangkok': 7,
    'Asia/Singapore': 8, 'Asia/Tokyo': 9, 'Australia/Sydney': 11,
  };
  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

  for (const rule of scheduleRules) {
    const cfg = rule.scheduleConfig || {};
    const hour = cfg.hour ?? 9;
    const minute = cfg.minute ?? 0;
    const days = cfg.days || ['mon', 'tue', 'wed', 'thu', 'fri'];
    const tz = cfg.timezone || 'America/New_York';

    const offset = tzOffsets[tz] ?? 0;
    let utcHour = hour - offset;
    let dayShift = 0;
    if (utcHour < 0) { utcHour += 24; dayShift = -1; }
    if (utcHour >= 24) { utcHour -= 24; dayShift = 1; }

    const dayNums = days.map(d => {
      let n = (dayMap[d.toLowerCase()] ?? 1) + dayShift;
      if (n < 0) n += 7;
      if (n > 6) n -= 7;
      return n;
    }).sort((a, b) => a - b).join(',');
    const cron = `${minute} ${Math.floor(utcHour)} * * ${dayNums}`;

    if (!rule.enabled) {
      // Delete existing schedule if any
      if (cfg.qstashScheduleId) {
        try {
          await fetch(`${qstashBase}/v2/schedules/${cfg.qstashScheduleId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${qstashToken}` },
          });
          console.log(`[biz-cron] Deleted schedule ${cfg.qstashScheduleId} for rule ${rule.id}`);
        } catch (e) {
          console.warn('[biz-cron] Delete schedule failed:', e);
        }
        rule.scheduleConfig = { ...cfg, qstashScheduleId: undefined };
      }
      continue;
    }

    // Clean up any stale schedules for this rule across QStash
    try {
      const listRes = await fetch(`${qstashBase}/v2/schedules`, {
        headers: { Authorization: `Bearer ${qstashToken}` },
      });
      if (listRes.ok) {
        const allSchedules = await listRes.json();
        for (const sched of allSchedules) {
          const isThisBusiness = sched.destination?.includes(businessId);
          let isThisRule = false;
          if (sched.body) {
            try {
              const raw = typeof sched.body === 'string' && sched.body.match(/^ey/)
                ? Buffer.from(sched.body, 'base64').toString()
                : sched.body;
              const parsed = JSON.parse(raw);
              isThisRule = parsed.ruleId === rule.id;
            } catch {
              try {
                isThisRule = Buffer.from(sched.body, 'base64').toString().includes(rule.id);
              } catch { /* skip */ }
            }
          }
          if (isThisBusiness && isThisRule) {
            await fetch(`${qstashBase}/v2/schedules/${sched.scheduleId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${qstashToken}` },
            });
            console.log(`[biz-cron] Cleaned up old schedule ${sched.scheduleId} for rule ${rule.id}`);
          }
        }
      }
    } catch (e) {
      console.warn('[biz-cron] Error cleaning up old schedules:', e);
    }

    // Create new QStash schedule
    const targetWithBiz = `${triggerUrl}?businessId=${encodeURIComponent(businessId)}`;
    const res = await fetch(`${qstashBase}/v2/schedules/${targetWithBiz}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Cron': cron,
        'Upstash-Retries': '0',
      },
      body: JSON.stringify({
        businessId,
        event: 'daily_schedule',
        ruleId: rule.id,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      rule.scheduleConfig = { ...cfg, qstashScheduleId: data.scheduleId };
      console.log(`[biz-cron] Created schedule ${data.scheduleId} for rule ${rule.id}: ${cron} (${tz})`);

      // ── Immediate first-run if we missed this week's window ──────────────
      // QStash won't retroactively fire a cron that already passed.
      // Check if today (in the user's TZ) matches a selected day AND the
      // scheduled time already passed — if so, fire once immediately via QStash publish.
      try {
        const nowUtc = Date.now();
        const nowLocal = new Date(nowUtc + offset * 3600_000);
        const localDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][nowLocal.getUTCDay()];
        const localHour = nowLocal.getUTCHours();
        const localMinute = nowLocal.getUTCMinutes();

        const isTodayScheduled = days.map(d => d.toLowerCase()).includes(localDay);
        const alreadyPassed = localHour > hour || (localHour === hour && localMinute > minute);

        if (isTodayScheduled && alreadyPassed) {
          console.log(`[biz-cron] Today (${localDay}) is scheduled but ${hour}:${String(minute).padStart(2, '0')} already passed — firing immediately`);
          const fireRes = await fetch(`${qstashBase}/v2/publish/${targetWithBiz}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${qstashToken}`,
              'Content-Type': 'application/json',
              'Upstash-Delay': '5s',
              'Upstash-Retries': '1',
            },
            body: JSON.stringify({
              businessId,
              event: 'daily_schedule',
              ruleId: rule.id,
            }),
          });
          if (fireRes.ok) {
            console.log(`[biz-cron] Immediate first-run queued for rule ${rule.id}`);
          } else {
            console.warn(`[biz-cron] Immediate first-run failed: ${fireRes.status}`);
          }
        }
      } catch (e) {
        console.warn('[biz-cron] Immediate first-run check failed (non-fatal):', e);
      }
    } else {
      console.error(`[biz-cron] Failed to create schedule for rule ${rule.id}:`, await res.text());
    }
  }

  return updatedRules;
}
