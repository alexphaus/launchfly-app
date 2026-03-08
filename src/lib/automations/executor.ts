// src/lib/automations/executor.ts
// ═══════════════════════════════════════════════════════════════════════════
// Automation Action Executor
// ═══════════════════════════════════════════════════════════════════════════
//
// Thin dispatcher that routes automation actions to existing functions.
// Called by: v2 webhook, sequence cron, external webhook trigger.
//
// Design: No new infrastructure — wraps existing sendWhatsApp, Retell call,
// notifyOwner, etc. into a unified executeAction interface.

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── Types ───────────────────────────────────────────────────────────────

export interface AutomationRule {
  id?: string;
  event: string;
  conditions?: Condition[];
  actions: Action[];
  enabled?: boolean;
}

export interface Condition {
  field: string;             // dot-path into event context: "message", "customer.name", "amount"
  op: 'contains' | 'equals' | 'gt' | 'lt' | 'exists' | 'not_exists';
  value?: string | number;
}

export interface Action {
  type: string;
  config?: Record<string, unknown>;
}

export interface EventContext {
  businessId: string;
  event: string;
  phone?: string;
  customerName?: string;
  message?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Available Events ────────────────────────────────────────────────────

export const AVAILABLE_EVENTS = [
  { id: 'inbound_whatsapp', label: 'WhatsApp Message Received', icon: '💬', desc: 'Customer sends a WhatsApp message' },
  { id: 'missed_call', label: 'Missed Call', icon: '📞', desc: 'Incoming call goes unanswered' },
  { id: 'booking_created', label: 'Booking Created', icon: '📅', desc: 'AI creates a new booking' },
  { id: 'booking_cancelled', label: 'Booking Cancelled', icon: '❌', desc: 'Customer cancels a booking' },
  { id: 'payment_received', label: 'Payment Received', icon: '💰', desc: 'Stripe payment succeeds' },
  { id: 'sequence_completed', label: 'Sequence Completed', icon: '✅', desc: 'Follow-up sequence finishes all steps' },
  { id: 'customer_replied', label: 'Customer Replied to Sequence', icon: '💬', desc: 'Prospect replies during follow-up sequence' },
  { id: 'quote_sent', label: 'Quote / Email Sent', icon: '📧', desc: 'A quote or email was sent to a prospect' },
  { id: 'external_webhook', label: 'External Webhook', icon: '⚡', desc: 'POST from Zapier, Make, or any external tool' },
] as const;

// ─── Available Actions ───────────────────────────────────────────────────

export const AVAILABLE_ACTIONS = [
  { id: 'send_whatsapp', label: 'Send WhatsApp Message', icon: '💬', desc: 'Send a text message via WhatsApp', configFields: ['message'] },
  { id: 'start_sequence', label: 'Start Follow-up Sequence', icon: '🔄', desc: 'Begin the AI follow-up sequence for this lead' },
  { id: 'trigger_voice_call', label: 'AI Voice Call', icon: '📞', desc: 'Trigger a Retell AI voice call' },
  { id: 'notify_owner', label: 'Notify Business Owner', icon: '🔔', desc: 'Send the owner a WhatsApp alert', configFields: ['message'] },
  { id: 'call_webhook', label: 'Call External Webhook', icon: '🌐', desc: 'POST data to an external URL', configFields: ['url'] },
  { id: 'update_status', label: 'Update Customer Status', icon: '🏷️', desc: 'Set customer status in database', configFields: ['status'] },
  { id: 'send_template', label: 'Send WhatsApp Template', icon: '📝', desc: 'Send a pre-approved WhatsApp template', configFields: ['templateSid'] },
  { id: 'delay', label: 'Wait / Delay', icon: '⏳', desc: 'Pause the workflow for a set number of hours', configFields: ['delayHours'] },
] as const;

// ─── Template Filling ────────────────────────────────────────────────────

function fillVars(template: string, ctx: EventContext): string {
  return template.replace(/\{(\w+(?:\.\w+)*)\}/g, (_, path: string) => {
    const parts = path.split('.');
    let val: unknown = ctx;
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
      else return '';
    }
    return val != null ? String(val) : '';
  });
}

// ─── Condition Evaluator ─────────────────────────────────────────────────

function evaluateConditions(conditions: Condition[], ctx: EventContext): boolean {
  for (const cond of conditions) {
    const parts = cond.field.split('.');
    let val: unknown = ctx;
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
      else { val = undefined; break; }
    }

    switch (cond.op) {
      case 'exists':
        if (val == null || val === '') return false;
        break;
      case 'not_exists':
        if (val != null && val !== '') return false;
        break;
      case 'equals':
        if (String(val).toLowerCase() !== String(cond.value).toLowerCase()) return false;
        break;
      case 'contains':
        if (!String(val || '').toLowerCase().includes(String(cond.value).toLowerCase())) return false;
        break;
      case 'gt':
        if (Number(val) <= Number(cond.value)) return false;
        break;
      case 'lt':
        if (Number(val) >= Number(cond.value)) return false;
        break;
    }
  }
  return true;
}

// ─── Action Dispatcher ───────────────────────────────────────────────────

async function dispatchAction(action: Action, ctx: EventContext): Promise<{ ok: boolean; detail: string }> {
  const cfg = action.config || {};

  switch (action.type) {
    case 'send_whatsapp': {
      if (!ctx.phone || !cfg.message) return { ok: false, detail: 'Missing phone or message' };
      const { sendWhatsApp } = await import('@/lib/quote-followup/whatsapp');
      const msg = fillVars(cfg.message as string, ctx);
      await sendWhatsApp(ctx.phone, msg);
      return { ok: true, detail: `Sent WhatsApp to ${ctx.phone}` };
    }

    case 'notify_owner': {
      const supabase = getSupabase();
      const { data: biz } = await supabase
        .from('businesses')
        .select('whatsapp_number, phone_number')
        .eq('id', ctx.businessId)
        .single();
      const ownerPhone = biz?.whatsapp_number || biz?.phone_number;
      if (!ownerPhone) return { ok: false, detail: 'No owner phone found' };
      const { sendWhatsApp } = await import('@/lib/quote-followup/whatsapp');
      const msg = fillVars((cfg.message as string) || '🔔 Automation alert: {event} from {customerName}', ctx);
      await sendWhatsApp(ownerPhone, msg);
      return { ok: true, detail: `Notified owner at ${ownerPhone}` };
    }

    case 'start_sequence': {
      // Create or update a quote_lead to trigger sequence processing
      const supabase = getSupabase();
      if (!ctx.phone) return { ok: false, detail: 'No phone to start sequence' };
      await supabase.from('quote_leads').insert({
        business_id: ctx.businessId,
        phone: ctx.phone,
        name: ctx.customerName || 'Unknown',
        job_type: (cfg.jobType as string) || 'General Inquiry',
        quote_amount: ctx.amount || 0,
        status: 'New',
        sequence_step: 0,
        sequence_paused: false,
        sequence_completed: false,
        attempts: 0,
        next_action_time: new Date(Date.now() + 60_000).toISOString(),
        timezone: (ctx.metadata?.timezone as string) || 'America/New_York',
      });
      return { ok: true, detail: `Sequence started for ${ctx.phone}` };
    }

    case 'trigger_voice_call': {
      // Look up or create a quote_lead, then hit Retell
      const supabase = getSupabase();
      const { data: lead } = await supabase
        .from('quote_leads')
        .select('id')
        .eq('phone', ctx.phone || '')
        .eq('business_id', ctx.businessId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lead) return { ok: false, detail: 'No lead found for voice call' };
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
      await fetch(`${appUrl}/api/retell/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      return { ok: true, detail: `Voice call triggered for lead ${lead.id}` };
    }

    case 'call_webhook': {
      const url = cfg.url as string;
      if (!url) return { ok: false, detail: 'No webhook URL configured' };
      // Validate URL to prevent SSRF — only allow http(s) and non-private IPs
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return { ok: false, detail: 'Only http/https URLs allowed' };
        }
        if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname)) {
          return { ok: false, detail: 'Private/internal URLs not allowed' };
        }
      } catch {
        return { ok: false, detail: 'Invalid URL' };
      }
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: ctx.event,
          business_id: ctx.businessId,
          phone: ctx.phone,
          customer_name: ctx.customerName,
          message: ctx.message,
          amount: ctx.amount,
          metadata: ctx.metadata,
          timestamp: new Date().toISOString(),
        }),
      });
      return { ok: true, detail: `Webhook called: ${url}` };
    }

    case 'update_status': {
      const supabase = getSupabase();
      const status = cfg.status as string;
      if (!ctx.phone || !status) return { ok: false, detail: 'Missing phone or status' };
      await supabase
        .from('customers')
        .update({ status })
        .eq('phone', ctx.phone);
      return { ok: true, detail: `Status updated to ${status}` };
    }

    case 'send_template': {
      const templateSid = cfg.templateSid as string;
      if (!ctx.phone || !templateSid) return { ok: false, detail: 'Missing phone or template SID' };
      const twilio = (await import('twilio')).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      // Build contentVariables from comma-separated config string
      // e.g. "{businessName}, {firstName}" → { "1": "Acme Corp", "2": "John" }
      const contentVariables: Record<string, string> = {};
      if (cfg.contentVars) {
        const parts = (cfg.contentVars as string).split(',').map(s => s.trim());
        parts.forEach((tmpl, i) => {
          contentVariables[String(i + 1)] = fillVars(tmpl, ctx);
        });
      }

      await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM!,
        to: `whatsapp:${ctx.phone}`,
        contentSid: templateSid,
        ...(Object.keys(contentVariables).length > 0
          ? { contentVariables: JSON.stringify(contentVariables) }
          : {}),
      });
      return { ok: true, detail: `Template ${templateSid} sent to ${ctx.phone}` };
    }

    default:
      return { ok: false, detail: `Unknown action type: ${action.type}` };
  }
}

// ─── Main Entry Point ────────────────────────────────────────────────────

/**
 * Fire an event through all matching automation rules for a business.
 * Loads rules from the active assistant's trigger_config.
 */
export async function fireEvent(ctx: EventContext): Promise<{ fired: number; results: { ok: boolean; detail: string }[] }> {
  const supabase = getSupabase();

  const { data: assistant } = await supabase
    .from('assistants')
    .select('trigger_config')
    .eq('business_id', ctx.businessId)
    .eq('active', true)
    .maybeSingle();

  const triggerConfig = assistant?.trigger_config as { rules?: AutomationRule[] } | null;
  const rules = triggerConfig?.rules || [];

  // Filter to rules matching this event that are enabled
  const matchingRules = rules.filter(r =>
    r.event === ctx.event &&
    r.enabled !== false &&
    evaluateConditions(r.conditions || [], ctx)
  );

  if (matchingRules.length === 0) {
    return { fired: 0, results: [] };
  }

  const results: { ok: boolean; detail: string }[] = [];

  for (const rule of matchingRules) {
    await executeActions(rule.actions, 0, ctx, results);
  }

  return { fired: matchingRules.length, results };
}

// ─── Sequential Action Executor (handles delays) ────────────────────────

/**
 * Execute actions starting from `startIndex`. When a `delay` action is hit,
 * schedule the remaining actions via QStash and stop.
 */
export async function executeActions(
  actions: Action[],
  startIndex: number,
  ctx: EventContext,
  results: { ok: boolean; detail: string }[],
): Promise<void> {
  for (let i = startIndex; i < actions.length; i++) {
    const action = actions[i];

    if (action.type === 'delay') {
      const hours = Number(action.config?.delayHours) || 1;
      const delaySeconds = Math.max(60, Math.round(hours * 3600));
      const remaining = actions.slice(i + 1);

      if (remaining.length === 0) {
        results.push({ ok: true, detail: `Delay ${hours}h — no further actions` });
        return;
      }

      // Schedule remaining actions via QStash
      const scheduled = await scheduleResume(remaining, ctx, delaySeconds);
      results.push({ ok: scheduled, detail: `Delay ${hours}h → ${remaining.length} actions scheduled` });
      return; // Stop processing — QStash will resume later
    }

    try {
      const result = await dispatchAction(action, ctx);
      results.push(result);
      console.log(`[automation] ${ctx.event} → ${action.type}: ${result.detail}`);
    } catch (err) {
      const detail = `Error executing ${action.type}: ${err instanceof Error ? err.message : String(err)}`;
      results.push({ ok: false, detail });
      console.error(`[automation] ${detail}`);
    }
  }
}

// ─── QStash Delay Scheduler ─────────────────────────────────────────────

async function scheduleResume(
  remainingActions: Action[],
  ctx: EventContext,
  delaySeconds: number,
): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';

  if (!qstashToken) {
    console.warn('[automation] No QSTASH_TOKEN — cannot schedule delay. Skipping remaining actions.');
    return false;
  }

  try {
    const targetUrl = `${appUrl}/api/assistants/trigger/resume`;
    await fetch('https://qstash.upstash.io/v2/publish/' + encodeURIComponent(targetUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': `${delaySeconds}s`,
        'Upstash-Retries': '2',
      },
      body: JSON.stringify({
        actions: remainingActions,
        ctx: {
          businessId: ctx.businessId,
          event: ctx.event,
          phone: ctx.phone,
          customerName: ctx.customerName,
          message: ctx.message,
          amount: ctx.amount,
          metadata: ctx.metadata,
        },
      }),
    });
    console.log(`[automation] Scheduled ${remainingActions.length} actions after ${delaySeconds}s delay`);
    return true;
  } catch (err) {
    console.error('[automation] QStash schedule failed:', err);
    return false;
  }
}
