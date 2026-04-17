// src/app/api/assistants/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// CRUD API for the AI Assistant configuration
// ═══════════════════════════════════════════════════════════════════════════
//
// GET  /api/assistants?businessId=xxx           → Get the active assistant
// GET  /api/assistants?businessId=xxx&list=true  → List ALL assistants
// POST /api/assistants                           → Create or update assistant config
// PUT  /api/assistants                           → Switch active assistant or create new
//
// Uses Supabase service key (server-side only) — auth checked via businessId ownership.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GET — Fetch the active assistant for a business
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get('businessId');
    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const listAll = req.nextUrl.searchParams.get('list') === 'true';

    if (listAll) {
      // Return ALL assistants for the business (for the switcher dropdown)
      const { data: assistants, error } = await supabase
        .from('assistants')
        .select('id, name, tone, goal, active, created_at')
        .eq('business_id', businessId)
        .order('active', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[assistants] GET list error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ assistants: assistants || [] });
    }

    const { data: assistant, error } = await supabase
      .from('assistants')
      .select('*')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[assistants] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no assistant exists yet, return a default shape (UI will show defaults)
    if (!assistant) {
      return NextResponse.json({
        assistant: null,
        defaults: {
          name: 'AI Sales Assistant',
          tone: 'friendly',
          goal: 'book_consultation',
          system_prompt: null,
          custom_rules: [],
          knowledge_base: { pricing: [], faq: [], objections: [] },
          tools_enabled: ['send_checkout_link', 'book_calendar', 'send_template', 'transfer_to_human'],
          sequence_steps: [],
          trigger_config: { whatsapp_webhook: true, missed_call: true },
        },
      });
    }

    return NextResponse.json({ assistant });
  } catch (err) {
    console.error('[assistants] GET unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST — Create or update the assistant
// ═══════════════════════════════════════════════════════════════════════════

interface AssistantPayload {
  businessId: string;
  assistantId?: string;  // Target a specific assistant (prevents race conditions)
  name?: string;
  tone?: string;
  goal?: string;
  system_prompt?: string | null;
  custom_rules?: string[];
  knowledge_base?: {
    pricing?: { service: string; price: string; unit: string }[];
    faq?: { q: string; a: string }[];
    objections?: { trigger: string; response: string }[];
  };
  tools_enabled?: string[];
  sequence_steps?: {
    step: number;
    dayOffset: number;
    hour: number;
    minute: number;
    channel: string;
    message: string;
    voicemail?: string;
  }[];
  trigger_config?: Record<string, unknown>;
  webhooks?: { label?: string; url: string; headers?: string; events?: string[] }[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AssistantPayload;

    if (!body.businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Find the specific assistant to update (by ID if provided, otherwise active)
    let existing: { id: string } | null = null;
    if (body.assistantId) {
      const { data } = await supabase
        .from('assistants')
        .select('id')
        .eq('id', body.assistantId)
        .eq('business_id', body.businessId)
        .maybeSingle();
      existing = data;
    } else {
      const { data } = await supabase
        .from('assistants')
        .select('id')
        .eq('business_id', body.businessId)
        .eq('active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existing = data;
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only include fields that were actually sent
    if (body.name !== undefined) payload.name = body.name;
    if (body.tone !== undefined) payload.tone = body.tone;
    if (body.goal !== undefined) payload.goal = body.goal;
    if (body.system_prompt !== undefined) payload.system_prompt = body.system_prompt;
    if (body.custom_rules !== undefined) payload.custom_rules = body.custom_rules;
    if (body.knowledge_base !== undefined) payload.knowledge_base = body.knowledge_base;
    if (body.tools_enabled !== undefined) payload.tools_enabled = body.tools_enabled;
    if (body.sequence_steps !== undefined) payload.sequence_steps = body.sequence_steps;
    if (body.trigger_config !== undefined) payload.trigger_config = body.trigger_config;

    let result;

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('assistants')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[assistants] Update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('assistants')
        .insert({
          business_id: body.businessId,
          name: body.name || 'AI Sales Assistant',
          tone: body.tone || 'friendly',
          goal: body.goal || 'book_consultation',
          system_prompt: body.system_prompt ?? null,
          custom_rules: body.custom_rules || [],
          knowledge_base: body.knowledge_base || { pricing: [], faq: [], objections: [] },
          tools_enabled: body.tools_enabled || ['send_checkout_link', 'book_calendar', 'send_template', 'transfer_to_human'],
          sequence_steps: body.sequence_steps || [],
          trigger_config: body.trigger_config || { whatsapp_webhook: true, missed_call: true },
          active: true,
          ...payload,
        })
        .select()
        .single();

      if (error) {
        console.error('[assistants] Insert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    }

    // ─── QStash CRON management for daily_schedule rules ──────────────────
    try {
      await syncDailyScheduleCrons(result, body.businessId);
    } catch (cronErr) {
      console.error('[assistants] CRON sync error (non-fatal):', cronErr);
    }

    // ─── Persist webhook config to business_data (if provided) ────────────
    if (body.webhooks !== undefined) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', body.businessId)
        .single();
      const bizData = (biz?.business_data || {}) as Record<string, unknown>;
      bizData.webhooks = body.webhooks;
      // Clean up legacy single-URL fields
      delete bizData.webhook_url;
      delete bizData.webhook_headers;
      await supabase
        .from('businesses')
        .update({ business_data: bizData })
        .eq('id', body.businessId);
    }

    return NextResponse.json({ assistant: result, ok: true });
  } catch (err) {
    console.error('[assistants] POST unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT — Switch active assistant or create a new one
// ═══════════════════════════════════════════════════════════════════════════

interface SwitchPayload {
  businessId: string;
  assistantId?: string;   // switch to this existing assistant
  createNew?: boolean;     // create a brand-new assistant and make it active
  newName?: string;        // name for the new assistant
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as SwitchPayload;

    if (!body.businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const supabase = getSupabase();

    if (body.createNew) {
      // Deactivate all currently active assistants
      await supabase
        .from('assistants')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('business_id', body.businessId)
        .eq('active', true);

      // Create a new one
      const { data: newAssistant, error } = await supabase
        .from('assistants')
        .insert({
          business_id: body.businessId,
          name: body.newName || 'New Assistant',
          tone: 'friendly',
          goal: 'book_consultation',
          tools_enabled: ['send_checkout_link', 'book_calendar', 'send_template', 'transfer_to_human'],
          trigger_config: { whatsapp_webhook: true, missed_call: true },
          active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('[assistants] PUT create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ assistant: newAssistant, ok: true });
    }

    if (body.assistantId) {
      // Verify the assistant belongs to this business
      const { data: target } = await supabase
        .from('assistants')
        .select('id, business_id')
        .eq('id', body.assistantId)
        .eq('business_id', body.businessId)
        .single();

      if (!target) {
        return NextResponse.json({ error: 'Assistant not found' }, { status: 404 });
      }

      // Deactivate all currently active assistants
      await supabase
        .from('assistants')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('business_id', body.businessId)
        .eq('active', true);

      // Activate the chosen one
      const { data: switched, error } = await supabase
        .from('assistants')
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq('id', body.assistantId)
        .select()
        .single();

      if (error) {
        console.error('[assistants] PUT switch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Sync CRONs for the newly active assistant (creates its schedules, cleans up old ones)
      try {
        await syncDailyScheduleCrons(switched, body.businessId);
      } catch (cronErr) {
        console.error('[assistants] PUT CRON sync error (non-fatal):', cronErr);
      }

      return NextResponse.json({ assistant: switched, ok: true });
    }

    return NextResponse.json({ error: 'assistantId or createNew required' }, { status: 400 });
  } catch (err) {
    console.error('[assistants] PUT unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE — Delete an assistant
// ═══════════════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest) {
  try {
    const { businessId, assistantId } = (await req.json()) as { businessId: string; assistantId: string };

    if (!businessId || !assistantId) {
      return NextResponse.json({ error: 'businessId and assistantId required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify ownership
    const { data: target } = await supabase
      .from('assistants')
      .select('id, active')
      .eq('id', assistantId)
      .eq('business_id', businessId)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'Assistant not found' }, { status: 404 });
    }

    // Delete it
    const { error } = await supabase
      .from('assistants')
      .delete()
      .eq('id', assistantId)
      .eq('business_id', businessId);

    if (error) {
      console.error('[assistants] DELETE error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If the deleted one was active, activate the most recent remaining one
    if (target.active) {
      const { data: remaining } = await supabase
        .from('assistants')
        .select('id')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (remaining) {
        await supabase
          .from('assistants')
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq('id', remaining.id);
      }
    }

    return NextResponse.json({ ok: true, deletedId: assistantId, wasActive: target.active });
  } catch (err) {
    console.error('[assistants] DELETE unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// QStash CRON Sync — create/update/delete schedules for daily_schedule rules
// ═══════════════════════════════════════════════════════════════════════════

interface ScheduleConfig {
  hour?: number;
  minute?: number;
  days?: string[];       // ['mon','tue','wed','thu','fri','sat','sun']
  timezone?: string;     // e.g. 'America/New_York'
  qstashScheduleId?: string;
  _lastCron?: string;
}

interface AutomationRule {
  id: string;
  event: string;
  enabled: boolean;
  scheduleConfig?: ScheduleConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

async function syncDailyScheduleCrons(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assistant: any,
  businessId: string,
) {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
  const triggerUrl = `${appUrl}/api/assistants/trigger`;
  const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
  const rules: AutomationRule[] = assistant.trigger_config?.rules || [];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  // Collect all daily_schedule rules (enabled or disabled)
  const scheduleRules = rules.filter(r => r.event === 'daily_schedule');

  for (const rule of scheduleRules) {
    const cfg = rule.scheduleConfig || {};
    const hour = cfg.hour ?? 9;
    const minute = cfg.minute ?? 0;
    const days = cfg.days || ['mon', 'tue', 'wed', 'thu', 'fri'];
    const tz = cfg.timezone || 'America/New_York';

    // Convert local time to UTC for QStash (timezone headers unreliable)
    const tzOffsets: Record<string, number> = {
      'Pacific/Honolulu': -10, 'America/Los_Angeles': -8, 'America/Denver': -7,
      'America/Chicago': -6, 'America/New_York': -5, 'America/Sao_Paulo': -3,
      'Europe/London': 0, 'Europe/Madrid': 1, 'Europe/Istanbul': 3,
      'Asia/Dubai': 4, 'Asia/Kolkata': 5.5, 'Asia/Bangkok': 7,
      'Asia/Singapore': 8, 'Asia/Tokyo': 9, 'Australia/Sydney': 11,
    };
    const offset = tzOffsets[tz] ?? 0;
    let utcHour = hour - offset;
    // Handle day wrap-around
    let dayShift = 0;
    if (utcHour < 0) { utcHour += 24; dayShift = -1; }
    if (utcHour >= 24) { utcHour -= 24; dayShift = 1; }

    // Build cron expression: minute hour * * day1,day2,...
    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    let dayNums = days.map(d => {
      let n = (dayMap[d.toLowerCase()] ?? 1) + dayShift;
      if (n < 0) n += 7;
      if (n > 6) n -= 7;
      return n;
    }).sort((a, b) => a - b).join(',');
    const cron = `${minute} ${Math.floor(utcHour)} * * ${dayNums}`;

    if (!rule.enabled) {
      // Disabled — delete existing schedule if any
      if (cfg.qstashScheduleId) {
        try {
          await fetch(`${qstashBase}/v2/schedules/${cfg.qstashScheduleId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${qstashToken}` },
          });
          console.log(`[cron] Deleted schedule ${cfg.qstashScheduleId} for rule ${rule.id}`);
        } catch (e) {
          console.warn('[cron] Delete schedule failed:', e);
        }
        // Clear the stored ID
        rule.scheduleConfig = { ...cfg, qstashScheduleId: undefined };
      }
      continue;
    }

    // Skip recreating if cron hasn't changed and existing schedule is still valid
    if (cfg.qstashScheduleId && cfg._lastCron === cron) {
      try {
        const checkRes = await fetch(`${qstashBase}/v2/schedules/${cfg.qstashScheduleId}`, {
          headers: { Authorization: `Bearer ${qstashToken}` },
        });
        if (checkRes.ok) {
          console.log(`[cron] Schedule ${cfg.qstashScheduleId} unchanged for rule ${rule.id}, skipping`);
          continue;
        }
      } catch { /* schedule gone — recreate below */ }
    }

    // Delete ALL existing QStash schedules for this rule (prevents duplicates)
    // We can't rely solely on cfg.qstashScheduleId because the frontend may
    // have a stale copy. Instead, list all schedules and delete any that match
    // this business + ruleId payload.
    try {
      const listRes = await fetch(`${qstashBase}/v2/schedules`, {
        headers: { Authorization: `Bearer ${qstashToken}` },
      });
      if (listRes.ok) {
        const allSchedules = await listRes.json();
        for (const sched of allSchedules) {
          // Match: same destination URL (contains businessId) AND same ruleId in body
          const isThisBusiness = sched.destination?.includes(businessId);
          let isThisRule = false;
          if (sched.body) {
            try {
              const parsed = JSON.parse(typeof sched.body === 'string' && sched.body.match(/^ey/)
                ? Buffer.from(sched.body, 'base64').toString()
                : sched.body);
              isThisRule = parsed.ruleId === rule.id;
            } catch {
              // body might be base64 or unparseable — try raw match
              try {
                const decoded = Buffer.from(sched.body, 'base64').toString();
                isThisRule = decoded.includes(rule.id);
              } catch { /* skip */ }
            }
          }
          if (isThisBusiness && isThisRule) {
            await fetch(`${qstashBase}/v2/schedules/${sched.scheduleId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${qstashToken}` },
            });
            console.log(`[cron] Cleaned up old schedule ${sched.scheduleId} for rule ${rule.id}`);
          }
        }
      }
    } catch (e) {
      console.warn('[cron] Error cleaning up old schedules:', e);
    }

    // Create new QStash schedule — businessId MUST be in the URL query param
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
      rule.scheduleConfig = { ...cfg, qstashScheduleId: data.scheduleId, _lastCron: cron };
      console.log(`[cron] Created schedule ${data.scheduleId} for rule ${rule.id}: ${cron} ${tz}`);
    } else {
      console.error(`[cron] Failed to create schedule for rule ${rule.id}:`, await res.text());
    }
  }

  // Persist any updated scheduleConfig back to DB (qstashScheduleId changes)
  const hasChanges = scheduleRules.length > 0;
  if (hasChanges) {
    await supabase
      .from('assistants')
      .update({ trigger_config: assistant.trigger_config })
      .eq('id', assistant.id);
  }
}
