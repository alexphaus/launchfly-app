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
  op: 'contains' | 'equals' | 'gt' | 'lt' | 'exists' | 'not_exists' | 'not_equals' | 'not_contains';
  value?: string | number;
}

export interface Action {
  type: string;
  config?: Record<string, unknown>;
}

interface ConditionBranchConfig {
  conditions?: Condition[];
  thenActions?: Action[];
  elseActions?: Action[];
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
  { id: 'call_completed', label: 'Voice Call Completed', icon: '📱', desc: 'Retell AI call ended — check outcome in metadata' },
  { id: 'new_lead_created', label: 'New Lead Created', icon: '🆕', desc: 'A new customer/lead record is created for the first time' },
  { id: 'user_inactive', label: 'Customer Went Silent', icon: '😶', desc: 'Customer hasn\'t replied after 24h — triggers smart AI follow-up' },
  { id: 'prospect_found', label: 'Prospect Found', icon: '🎯', desc: 'A new prospect was discovered by search_leads — fires once per lead' },
  { id: 'daily_schedule', label: 'Daily Schedule', icon: '⏰', desc: 'Fires on a schedule (daily/weekly). Configure time and days in the rule.' },
] as const;

// ─── Available Actions ───────────────────────────────────────────────────

export const AVAILABLE_ACTIONS = [
  { id: 'ai_response', label: 'AI Response', icon: '🤖', desc: 'Let the AI assistant respond to the customer using the configured persona, tools, and knowledge base', configFields: [] },
  { id: 'send_whatsapp', label: 'Send WhatsApp Message', icon: '💬', desc: 'Send a text message via WhatsApp', configFields: ['message'] },
  { id: 'trigger_voice_call', label: 'AI Voice Call', icon: '📞', desc: 'Auto-creates lead, then triggers Retell AI voice call. Leave blank to use Brain tab config.', configFields: ['fromNumber', 'retellAgentId', 'jobType'] },
  { id: 'notify_owner', label: 'Notify Business Owner', icon: '🔔', desc: 'Send the owner a WhatsApp alert', configFields: ['message'] },
  { id: 'call_webhook', label: 'Call External Webhook', icon: '🌐', desc: 'POST data to an external URL', configFields: ['url', 'webhookHeaders'] },
  { id: 'update_status', label: 'Update Customer Status', icon: '🏷️', desc: 'Set customer status in database', configFields: ['status'] },
  { id: 'send_template', label: 'Send WhatsApp Template', icon: '📝', desc: 'Send a pre-approved WhatsApp template', configFields: ['templateSid'] },
  { id: 'delay', label: 'Wait / Delay', icon: '⏳', desc: 'Pause the workflow for a set number of hours', configFields: ['delayHours'] },
  { id: 'send_email', label: 'Send Email', icon: '📧', desc: 'Send an email to the customer', configFields: ['emailSubject', 'emailBody'] },
  { id: 'send_sms', label: 'Send SMS', icon: '📱', desc: 'Send a plain SMS text message (non-WhatsApp)', configFields: ['message'] },
  { id: 'add_tag', label: 'Add Tag', icon: '🏷️', desc: 'Add a tag to the customer for segmentation', configFields: ['tag'] },
  { id: 'remove_tag', label: 'Remove Tag', icon: '🗑️', desc: 'Remove a tag from the customer', configFields: ['tag'] },
  { id: 'ai_followup', label: 'AI Smart Follow-up', icon: '🧠', desc: 'AI reads the conversation history and generates a contextual follow-up message. Stops after 5 unanswered messages.', configFields: [] },
  { id: 'ask_ai', label: 'Ask AI', icon: '🧩', desc: 'Send a prompt to AI with full business context. Use for qualification, personalization, categorization — anything. Optionally stops chain on NO. Result available as {aiResponse}.', configFields: ['aiPrompt', 'stopOnNo'] },
  { id: 'search_leads', label: 'Search Leads (Apify)', icon: '🔍', desc: 'Scrape Google Maps for businesses. Each result fires a prospect_found event for downstream rules.', configFields: ['searchQuery', 'searchLocation', 'searchMaxResults'] },
  { id: 'stagger_outreach', label: 'Stagger Outreach', icon: '⏱️', desc: 'Space out leads with progressive delays and a daily cap. Schedules remaining actions via QStash.', configFields: ['staggerIntervalMin', 'staggerMaxPerDay'] },
  { id: 'condition_branch', label: 'If / Else Branch', icon: '🔀', desc: 'Evaluate conditions and run different actions for true vs false branches', configFields: [] },
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

    // Fallback: if top-level field not found, check inside metadata
    // This lets rules use "outcome" instead of "metadata.outcome"
    if (val === undefined && ctx.metadata && !cond.field.startsWith('metadata.')) {
      const metaParts = cond.field.split('.');
      let metaVal: unknown = ctx.metadata;
      for (const p of metaParts) {
        if (metaVal && typeof metaVal === 'object') metaVal = (metaVal as Record<string, unknown>)[p];
        else { metaVal = undefined; break; }
      }
      if (metaVal !== undefined) val = metaVal;
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
      case 'not_equals':
        if (String(val).toLowerCase() === String(cond.value).toLowerCase()) return false;
        break;
      case 'not_contains':
        if (String(val || '').toLowerCase().includes(String(cond.value).toLowerCase())) return false;
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

// ─── Chat History Helper ─────────────────────────────────────────────────
// Save outbound messages to chat_history so the v2 webhook can trace the
// business when the customer replies (getLastBusinessId looks here).

async function saveToChatHistory(phone: string, businessId: string, content: string): Promise<void> {
  try {
    const supabase = getSupabase();
    // Normalize: strip non-digits, add +1 for US 10-digit numbers, store without +
    let digits = phone.replace(/^whatsapp:/, '').replace(/[^\d]/g, '');
    if (digits.length === 10) digits = `1${digits}`;
    await supabase.from('chat_history').insert({
      phone: digits,
      business_id: businessId,
      role: 'assistant',
      content,
    });
  } catch (err) {
    console.warn('[automation] Failed to save chat_history breadcrumb:', err);
  }
}

// ─── Twilio WhatsApp Helper ──────────────────────────────────────────────

async function sendSms(to: string, body: string): Promise<void> {
  const twilio = (await import('twilio')).default;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const smsFrom = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER || '';
  if (!smsFrom) throw new Error('Missing TWILIO_SMS_NUMBER');
  const phoneForSms = to.replace(/^whatsapp:/, '');
  await client.messages.create({
    from: smsFrom.replace(/^whatsapp:/, ''),
    to: phoneForSms.startsWith('+') ? phoneForSms : `+${phoneForSms}`,
    body,
  });
}

async function sendWhatsApp(to: string, body: string, businessId?: string): Promise<void> {
  const { sendWhatsApp: ultramsgSend } = await import('@/lib/ultramsg');
  const result = await ultramsgSend(to, body, businessId);
  if (!result.sent) {
    throw new Error(`UltraMsg send failed: ${result.error}`);
  }
}

/** Send a message — WhatsApp first, SMS fallback on failure */
async function sendMessage(to: string, body: string, channel?: string, businessId?: string): Promise<'whatsapp' | 'sms'> {
  if (channel === 'sms') {
    await sendSms(to, body);
    return 'sms';
  }
  try {
    await sendWhatsApp(to, body, businessId);
    return 'whatsapp';
  } catch (err) {
    console.warn(`[automation] WhatsApp failed for ${to}, falling back to SMS:`, (err as Error).message);
    await sendSms(to, body);
    return 'sms';
  }
}

// ─── Action Dispatcher ───────────────────────────────────────────────────

async function dispatchAction(action: Action, ctx: EventContext): Promise<{ ok: boolean; detail: string }> {
  const cfg = action.config || {};

  switch (action.type) {
    case 'ai_followup': {
      if (!ctx.phone || !ctx.businessId) return { ok: false, detail: 'Missing phone or businessId' };
      const followupChannel = (ctx.metadata?.channel as string) || 'whatsapp';
      const { handleAIFollowup } = await import('@/lib/automations/ai-brain');
      const followupResult = await handleAIFollowup({
        businessId: ctx.businessId,
        phone: ctx.phone,
        channel: followupChannel,
      });
      if (followupResult.skipped) return { ok: true, detail: `Skipped: ${followupResult.skipReason}` };
      return { ok: true, detail: `AI follow-up sent via ${followupChannel} (${followupResult.toolsCalled.length} tools)` };
    }

    case 'ai_response': {
      if (!ctx.phone || !ctx.businessId) return { ok: false, detail: 'Missing phone or businessId' };
      if (!ctx.message) return { ok: false, detail: 'No message to respond to' };
      const channel = (ctx.metadata?.channel as string) || 'whatsapp';
      const { handleAIResponse } = await import('@/lib/automations/ai-brain');
      const result = await handleAIResponse({
        businessId: ctx.businessId,
        phone: ctx.phone,
        messageText: ctx.message,
        messageSid: ctx.metadata?.messageSid as string | undefined,
        channel,
      });
      return { ok: true, detail: `AI replied via ${channel} (${result.toolsCalled.length} tools: ${result.toolsCalled.join(', ') || 'none'})` };
    }

    case 'send_whatsapp': {
      if (!ctx.phone || !cfg.message) return { ok: false, detail: 'Missing phone or message' };
      const msg = fillVars(cfg.message as string, ctx);
      try {
        await sendWhatsApp(ctx.phone, msg, ctx.businessId);
      } catch (err) {
        return { ok: false, detail: `WhatsApp failed for ${ctx.phone}: ${err instanceof Error ? err.message : String(err)}` };
      }
      await saveToChatHistory(ctx.phone, ctx.businessId, msg);
      return { ok: true, detail: `Sent whatsapp to ${ctx.phone}` };
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
      const notifyMsg = fillVars((cfg.message as string) || '🔔 Automation alert: {event} from {customerName}', ctx);
      await sendWhatsApp(ownerPhone, notifyMsg, ctx.businessId);
      return { ok: true, detail: `Notified owner at ${ownerPhone}` };
    }

    case 'trigger_voice_call': {
      if (!ctx.phone) return { ok: false, detail: 'Missing phone for voice call' };
      const supabase = getSupabase();
      const phoneNorm = ctx.phone.startsWith('+') ? ctx.phone : `+${ctx.phone}`;
      const jobType = (cfg.jobType as string) || (ctx.metadata?.job_type as string) || 'General Inquiry';

      // Auto-upsert lead record
      let { data: lead } = await supabase
        .from('quote_leads')
        .select('id')
        .eq('phone', phoneNorm)
        .eq('business_id', ctx.businessId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lead) {
        const { data: newLead, error: insertErr } = await supabase
          .from('quote_leads')
          .insert({
            business_id: ctx.businessId,
            phone: phoneNorm,
            name: ctx.customerName || 'Unknown',
            job_type: jobType,
            quote_amount: ctx.amount || 0,
            status: 'Open',
            source: (ctx.metadata?.source as string) || 'automation',
            attempts: 0,
          })
          .select('id')
          .single();
        if (insertErr) return { ok: false, detail: `Failed to create lead: ${insertErr.message}` };
        lead = newLead;

        // Also upsert customer record
        await supabase.from('customers').upsert({
          business_id: ctx.businessId,
          phone: phoneNorm,
          name: ctx.customerName || 'Unknown',
          email: (ctx.metadata?.email as string) || `${phoneNorm.replace(/\+/g, '')}@lead.placeholder`,
          status: 'lead',
          source: (ctx.metadata?.source as string) || 'automation',
        }, { onConflict: 'business_id,email' });

        // Fire new_lead_created (non-blocking — avoid infinite loops by checking event)
        if (ctx.event !== 'new_lead_created') {
          fireEvent({
            businessId: ctx.businessId,
            event: 'new_lead_created',
            phone: phoneNorm,
            customerName: ctx.customerName,
            metadata: { source: 'voice_call_auto' },
          }).catch(err => console.warn('[automation] new_lead_created fire error:', err));
        }
      }

      if (!lead) return { ok: false, detail: 'Failed to resolve lead for voice call' };

      // Call Retell API directly
      const retellApiKey = process.env.RETELL_API_KEY;
      if (!retellApiKey) return { ok: false, detail: 'Missing RETELL_API_KEY' };

      // Load business + assistant context
      const { data: biz } = await supabase
        .from('businesses')
        .select('name, business_data')
        .eq('id', ctx.businessId)
        .single();
      const bizName = biz?.name || 'the team';
      const bizConfig = (biz?.business_data || {}) as Record<string, unknown>;

      // Determine mode: custom (fromNumber set) or default (use Brain tab config)
      const customFromNumber = (cfg.fromNumber as string) || '';
      const customAgentId = (cfg.retellAgentId as string) || '';

      let fromNumber: string;
      let agentId: string;
      let dynamicVars: Record<string, string> = {
        customer_name: ctx.customerName || 'there',
        business_name: bizName,
        contractor_name: (bizConfig.ownerName as string) || '',
        lead_id: lead.id,
      };

      if (customFromNumber || customAgentId) {
        // ── CUSTOM MODE: use dedicated Retell agent ──
        fromNumber = customFromNumber || process.env.RETELL_FROM_NUMBER || '';
        agentId = customAgentId || process.env.RETELL_AGENT_ID || '';
      } else {
        // ── DEFAULT MODE: use universal agent + voice-optimized Brain tab config ──
        const defaultAgentId = process.env.RETELL_DEFAULT_AGENT_ID || '';
        const defaultFromNumber = process.env.RETELL_DEFAULT_FROM_NUMBER || '';

        if (defaultAgentId && defaultFromNumber) {
          // Load the business's active assistant config
          const { data: assistant } = await supabase
            .from('assistants')
            .select('system_prompt, knowledge_base, custom_rules, tone, goal, name')
            .eq('business_id', ctx.businessId)
            .eq('active', true)
            .maybeSingle();

          const assistantName = assistant?.name || 'the assistant';
          const tone = assistant?.tone || 'friendly';
          const goal = assistant?.goal || 'book_consultation';
          const ownerName = (bizConfig.ownerName as string) || 'the owner';
          const niche = (bizConfig.niche as string) || 'General Service';
          const customerName = ctx.customerName || 'there';

          // Build voice-optimized prompt — DO NOT use the WhatsApp system_prompt directly
          let voicePrompt = `You are ${assistantName}, an AI phone agent calling on behalf of ${bizName}.
You are on a VOICE CALL — not text. Speak naturally like a real person on the phone.

VOICE RULES (CRITICAL):
- Keep every response to 1-2 SHORT sentences. This is a phone call, not a presentation.
- Be conversational. Use natural speech patterns, contractions, brief pauses.
- NEVER use emojis, bullet points, numbered lists, or any text formatting.
- NEVER read out URLs, links, or long text.
- Sound warm, confident, and human. Not scripted or robotic.
- Match the prospect's energy. If they're short, be short. If they're chatty, be chattier.

YOUR IDENTITY:
- Name: ${assistantName}
- Calling from: ${bizName}
- Tone: ${tone}
- Owner: ${ownerName}
- Industry: ${niche}

CALL PURPOSE: ${jobType}
CUSTOMER NAME: ${customerName}

`;

          // Extract knowledge from Brain tab — but format for voice
          if (assistant?.knowledge_base) {
            const kb = assistant.knowledge_base as Record<string, unknown[]>;
            if ((kb.pricing as { service: string; price: string; unit: string }[])?.length) {
              voicePrompt += 'PRICING KNOWLEDGE (use naturally in conversation, don\'t list them):\n';
              voicePrompt += (kb.pricing as { service: string; price: string; unit: string }[])
                .map(p => `${p.service}: ${p.price}/${p.unit}`)
                .join(', ') + '\n\n';
            }
            if ((kb.faq as { q: string; a: string }[])?.length) {
              voicePrompt += 'KEY ANSWERS (paraphrase naturally, don\'t read verbatim):\n';
              voicePrompt += (kb.faq as { q: string; a: string }[])
                .slice(0, 6) // limit for voice — don't overload
                .map(f => `If asked "${f.q}" → ${f.a}`)
                .join('\n') + '\n\n';
            }
            if ((kb.objections as { trigger: string; response: string }[])?.length) {
              voicePrompt += 'OBJECTION RESPONSES (adapt to voice naturally):\n';
              voicePrompt += (kb.objections as { trigger: string; response: string }[])
                .map(o => `"${o.trigger}" → ${o.response}`)
                .join('\n') + '\n\n';
            }
          }

          // Custom rules — filter to voice-relevant ones
          if ((assistant?.custom_rules as string[])?.length) {
            voicePrompt += 'RULES:\n' + (assistant!.custom_rules as string[]).map((r: string) => `- ${r}`).join('\n') + '\n\n';
          }

          // Call flow based on goal
          const goalInstructions: Record<string, string> = {
            close_sale: `CALL FLOW:
1. Quick intro — say who you are and why you're calling (one sentence).
2. Ask ONE qualifying question to hook them into conversation.
3. If they engage, give a brief pitch (2-3 sentences max) focused on their biggest pain point.
4. Handle objections with confidence — don't fold at the first "no" or "not interested." Push back once with value.
5. Drive to action: "Want me to send you the signup link on WhatsApp right now?"
6. If they say not interested TWICE, respect it. Say you'll follow up on WhatsApp and end warmly.`,
            book_consultation: `CALL FLOW:
1. Quick intro — say who you are and why you're calling (one sentence).
2. Ask about their current situation — what are they dealing with?
3. Based on their answer, explain how you can help (2 sentences max).
4. Push for a booking: "I've got Thursday or Friday open — which works better for you?"
5. If they hesitate, offer to send details on WhatsApp. Don't let the call end without a next step.`,
            collect_review: `CALL FLOW:
1. Quick intro — remind them of the recent service.
2. Ask if everything went well.
3. If happy: "Would you mind leaving us a quick review? I can text you the link right now."
4. If there's an issue: "I'm sorry to hear that. Let me have the owner reach out to make it right."`,
            reactivate: `CALL FLOW:
1. Quick intro — mention you haven't connected in a while.
2. Ask if they have any upcoming projects or needs.
3. Mention any current availability, promotions, or seasonal relevance.
4. Push for next step: schedule a visit, send a quote, or follow up on WhatsApp.`,
          };

          voicePrompt += (goalInstructions[goal] || goalInstructions.close_sale) + '\n\n';

          voicePrompt += `CRITICAL: When someone says "not interested" the first time, don't just give up. Push back ONCE with a quick value prop. Only back off if they say no a second time. End every call with a next step — even if it's "I'll text you some info on WhatsApp."`;

          dynamicVars.system_prompt = voicePrompt;
          fromNumber = defaultFromNumber;
          agentId = defaultAgentId;
        } else {
          // Fallback: use Launchfly's agent (backward compat)
          fromNumber = process.env.RETELL_FROM_NUMBER || '';
          agentId = process.env.RETELL_AGENT_ID || '';
        }
      }

      if (!agentId || !fromNumber) {
        return { ok: false, detail: 'Missing Retell agent ID or from number. Configure a custom number or set RETELL_DEFAULT_AGENT_ID + RETELL_DEFAULT_FROM_NUMBER env vars.' };
      }

      const retellRes = await fetch('https://api.retellai.com/v2/create-phone-call', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_number: fromNumber,
          to_number: phoneNorm,
          agent_id: agentId,
          retell_llm_dynamic_variables: dynamicVars,
          // Only mark as retry when this voice call is triggered from within a
          // call_completed sequence — prevents the Retell webhook from re-firing
          // call_completed on no_answer (which would cause an infinite loop).
          // First-time calls from external_webhook, missed_call etc. need is_retry=false
          // so their results properly fire call_completed rules.
          metadata: { lead_id: lead.id, source: 'automation', is_retry: ctx.event === 'call_completed' },
        }),
      });

      if (!retellRes.ok) {
        const errBody = await retellRes.text();
        return { ok: false, detail: `Retell API error ${retellRes.status}: ${errBody.substring(0, 200)}` };
      }

      const retellData = (await retellRes.json()) as { call_id?: string };

      // Update lead status
      await supabase.from('quote_leads').update({
        status: 'Called',
        retell_call_id: retellData.call_id ?? null,
        attempts: 1,
      }).eq('id', lead.id);

      return { ok: true, detail: `Voice call triggered (agent: ${agentId.substring(0, 8)}..., lead: ${lead.id})` };
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
      // Parse optional custom headers: "Authorization=Bearer xxx, X-Api-Key=abc"
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.webhookHeaders && typeof cfg.webhookHeaders === 'string') {
        for (const pair of (cfg.webhookHeaders as string).split(',')) {
          const eqIdx = pair.indexOf('=');
          if (eqIdx > 0) {
            headers[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
          }
        }
      }
      const webhookRes = await fetch(url, {
        method: 'POST',
        headers,
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
      if (!webhookRes.ok) {
        const errBody = await webhookRes.text().catch(() => '');
        console.error(`[automation] Webhook ${url} returned ${webhookRes.status}: ${errBody.substring(0, 200)}`);
        return { ok: false, detail: `Webhook returned ${webhookRes.status}` };
      }
      return { ok: true, detail: `Webhook ${webhookRes.status}: ${url}` };
    }

    case 'update_status': {
      const supabase = getSupabase();
      const status = cfg.status as string;
      if (!ctx.phone || !status) return { ok: false, detail: 'Missing phone or status' };
      const phoneNorm = ctx.phone.startsWith('+') ? ctx.phone : `+${ctx.phone}`;
      const phoneWithoutPlus = phoneNorm.replace(/^\+/, '');
      await supabase
        .from('customers')
        .update({ status })
        .eq('business_id', ctx.businessId)
        .or(`phone.eq.${phoneNorm},phone.eq.${phoneWithoutPlus}`);
      return { ok: true, detail: `Status updated to ${status}` };
    }

    case 'send_template': {
      // UltraMsg: no templates needed — send as a plain message
      // The templateSid field is repurposed: if it looks like a Twilio SID (HX...),
      // we skip it and use contentVars as the message body instead.
      // If a plain message is provided, send that directly.
      if (!ctx.phone) return { ok: false, detail: 'Missing phone' };

      let templateMsg = '';
      if (cfg.contentVars) {
        // Fill variable placeholders in the content vars string
        templateMsg = fillVars(cfg.contentVars as string, ctx);
      } else if (cfg.message) {
        templateMsg = fillVars(cfg.message as string, ctx);
      }
      if (!templateMsg) return { ok: false, detail: 'No message content for template action' };

      await sendWhatsApp(ctx.phone, templateMsg, ctx.businessId);
      await saveToChatHistory(ctx.phone, ctx.businessId, templateMsg);
      return { ok: true, detail: `Template message sent to ${ctx.phone}` };
    }

    case 'send_email': {
      const subject = cfg.emailSubject as string;
      const body = cfg.emailBody as string;
      if (!subject || !body) return { ok: false, detail: 'Missing email subject or body' };

      // Resolve customer email from phone
      const supabase = getSupabase();
      let toEmail = cfg.emailTo as string | undefined;
      if (!toEmail && ctx.phone) {
        const phoneN = ctx.phone.startsWith('+') ? ctx.phone : `+${ctx.phone}`;
        const { data: cust } = await supabase
          .from('customers')
          .select('email')
          .eq('business_id', ctx.businessId)
          .or(`phone.eq.${phoneN},phone.eq.${phoneN.replace(/^\+/, '')}`)
          .maybeSingle();
        toEmail = cust?.email;
      }
      if (!toEmail || toEmail.endsWith('@lead.placeholder')) {
        return { ok: false, detail: 'No valid email address for this customer' };
      }

      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || 'hello@launchfly.ai';
      const filledSubject = fillVars(subject, ctx);
      const filledBody = fillVars(body, ctx);

      await resend.emails.send({
        from: `${ctx.businessName || 'Launchfly'} <${fromEmail}>`,
        to: toEmail,
        subject: filledSubject,
        html: filledBody.replace(/\n/g, '<br>'),
      });
      return { ok: true, detail: `Email sent to ${toEmail}: ${filledSubject}` };
    }

    case 'send_sms': {
      if (!ctx.phone || !cfg.message) return { ok: false, detail: 'Missing phone or message' };
      const smsMsg = fillVars(cfg.message as string, ctx);
      const smsFrom = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER;
      if (!smsFrom) return { ok: false, detail: 'Missing TWILIO_SMS_NUMBER' };
      const twilio = (await import('twilio')).default;
      const smsClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const phoneForSms = ctx.phone.startsWith('+') ? ctx.phone : `+${ctx.phone}`;
      await smsClient.messages.create({
        from: smsFrom.replace(/^whatsapp:/, ''),
        to: phoneForSms,
        body: smsMsg,
      });
      return { ok: true, detail: `SMS sent to ${phoneForSms}` };
    }

    case 'add_tag': {
      const tag = (cfg.tag as string)?.trim();
      if (!ctx.phone || !tag) return { ok: false, detail: 'Missing phone or tag' };
      const supabase = getSupabase();
      const phoneNorm = ctx.phone.startsWith('+') ? ctx.phone : `+${ctx.phone}`;
      // Append tag to the tags array if not already present
      const { data: cust } = await supabase
        .from('customers')
        .select('id, tags')
        .eq('business_id', ctx.businessId)
        .or(`phone.eq.${phoneNorm},phone.eq.${phoneNorm.replace(/^\+/, '')}`)
        .maybeSingle();
      if (!cust) return { ok: false, detail: 'Customer not found' };
      const currentTags: string[] = cust.tags || [];
      if (currentTags.includes(tag)) return { ok: true, detail: `Tag "${tag}" already present` };
      await supabase
        .from('customers')
        .update({ tags: [...currentTags, tag] })
        .eq('id', cust.id);
      return { ok: true, detail: `Tag "${tag}" added` };
    }

    case 'remove_tag': {
      const tag = (cfg.tag as string)?.trim();
      if (!ctx.phone || !tag) return { ok: false, detail: 'Missing phone or tag' };
      const supabase = getSupabase();
      const phoneNorm = ctx.phone.startsWith('+') ? ctx.phone : `+${ctx.phone}`;
      const { data: cust } = await supabase
        .from('customers')
        .select('id, tags')
        .eq('business_id', ctx.businessId)
        .or(`phone.eq.${phoneNorm},phone.eq.${phoneNorm.replace(/^\+/, '')}`)
        .maybeSingle();
      if (!cust) return { ok: false, detail: 'Customer not found' };
      const currentTags: string[] = cust.tags || [];
      if (!currentTags.includes(tag)) return { ok: true, detail: `Tag "${tag}" not present` };
      await supabase
        .from('customers')
        .update({ tags: currentTags.filter(t => t !== tag) })
        .eq('id', cust.id);
      return { ok: true, detail: `Tag "${tag}" removed` };
    }

    // ─── Ask AI (general-purpose AI step with full business context) ─────
    // Optionally gates the chain (stopOnNo: YES/NO check).
    // Stores result in ctx.aiResponse so downstream actions can use {aiResponse}.

    case 'ask_ai': {
      const promptTemplate = (cfg.aiPrompt as string) || 'Analyze this lead and tell me what you think.';
      const prompt = fillVars(promptTemplate, ctx);
      const shouldGate = cfg.stopOnNo === true || cfg.stopOnNo === 'true';

      // Load full business + assistant context
      const supabase = getSupabase();
      const [{ data: biz }, { data: assistant }] = await Promise.all([
        supabase.from('businesses').select('name, industry, city, state').eq('id', ctx.businessId).single(),
        supabase.from('assistants').select('system_prompt, knowledge_base, custom_rules, goal').eq('business_id', ctx.businessId).eq('active', true).maybeSingle(),
      ]);

      const kb = assistant?.knowledge_base || {};
      const pricingInfo = (kb.pricing || []).map((p: { service: string; price: string }) => `${p.service}: ${p.price}`).join(', ');
      const faqInfo = (kb.faq || []).map((f: { q: string; a: string }) => `Q: ${f.q} A: ${f.a}`).join('\n');

      const systemParts = [
        assistant?.system_prompt || '',
        biz?.name ? `Business: ${biz.name}` : '',
        biz?.industry ? `Industry: ${biz.industry}` : '',
        biz?.city ? `Location: ${biz.city}, ${biz.state || ''}` : '',
        assistant?.goal ? `Goal: ${assistant.goal}` : '',
        pricingInfo ? `Pricing: ${pricingInfo}` : '',
        faqInfo ? `Knowledge:\n${faqInfo}` : '',
        (assistant?.custom_rules || []).length > 0 ? `Rules: ${((assistant?.custom_rules || []) as string[]).join('; ')}` : '',
      ].filter(Boolean);
      if (shouldGate) systemParts.push('\nYou MUST answer with YES or NO on the first line, followed by a brief reason.');
      const systemPrompt = systemParts.join('\n');

      const { generateText } = await import('ai');
      const { openai } = await import('@ai-sdk/openai');
      const result = await generateText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
      const aiText = result.text.trim();
      ctx.aiResponse = aiText; // Available as {aiResponse} in downstream actions
      console.log(`[automation] ask_ai: "${aiText.substring(0, 100)}" for ${ctx.customerName || ctx.phone}`);

      if (shouldGate && aiText.toUpperCase().startsWith('NO')) {
        return { ok: true, detail: `AI said NO: "${aiText}"`, stopChain: true } as { ok: boolean; detail: string; stopChain: boolean };
      }
      return { ok: true, detail: `AI: "${aiText.substring(0, 150)}"` };
    }

    // ─── Search Leads (Apify fan-out → prospect_found events) ─────────────

    case 'search_leads': {
      const searchQuery = (cfg.searchQuery as string) || '';
      const searchLocation = (cfg.searchLocation as string) || '';
      if (!searchQuery || !searchLocation) return { ok: false, detail: 'Missing searchQuery or searchLocation' };
      const maxResults = Number(cfg.searchMaxResults) || 50;

      const { searchGoogleMaps } = await import('@/lib/apify');
      const leads = await searchGoogleMaps({
        query: searchQuery,
        location: searchLocation,
        maxResults,
        businessId: ctx.businessId,
      });

      if (leads.length === 0) return { ok: true, detail: 'Search returned 0 leads with phone numbers' };

      // Dedup against existing quote_leads (normalize to digits-only for matching)
      const supabase = getSupabase();
      const normalizePhone = (p: string) => {
        const digits = p.replace(/[^\d]/g, '');
        return digits.length === 10 ? `1${digits}` : digits; // US/CA 10-digit → add country code
      };
      // Fetch all existing phones for this business and normalize in JS
      // (avoids format mismatch issues with spaces/dashes in DB)
      const existingPhones = new Set<string>();
      let from = 0;
      while (true) {
        const { data: batch } = await supabase
          .from('quote_leads')
          .select('phone')
          .eq('business_id', ctx.businessId)
          .range(from, from + 999);
        if (!batch || batch.length === 0) break;
        for (const e of batch) existingPhones.add(normalizePhone(e.phone));
        if (batch.length < 1000) break;
        from += 1000;
      }
      const newLeads = leads.filter(l => !existingPhones.has(normalizePhone(l.phone)));

      if (newLeads.length === 0) return { ok: true, detail: `${leads.length} leads found, all already in database` };

      // Only dispatch up to the remaining daily cap — extras stay undiscovered for tomorrow
      const todayStartSearch = new Date();
      todayStartSearch.setHours(0, 0, 0, 0);
      const { count: alreadySentToday } = await supabase
        .from('quote_leads')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', ctx.businessId)
        .eq('source', 'prospecting')
        .gte('created_at', todayStartSearch.toISOString());
      const dailyCap = 15;
      const remaining = Math.max(0, dailyCap - (alreadySentToday || 0));
      const leadsToDispatch = newLeads.slice(0, remaining);

      if (leadsToDispatch.length === 0) return { ok: true, detail: `${newLeads.length} new leads found but daily cap already reached` };

      // Fan-out: dispatch prospect_found via QStash so each gets its own execution
      const qstashToken = process.env.QSTASH_TOKEN;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
      const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
      const triggerUrl = `${appUrl}/api/assistants/trigger?businessId=${ctx.businessId}`;

      let firedCount = 0;
      const basePosition = alreadySentToday || 0;
      const batchSize = 5;
      for (let i = 0; i < leadsToDispatch.length; i += batchSize) {
        const batch = leadsToDispatch.slice(i, i + batchSize);
        await Promise.all(batch.map(async (lead, batchIdx) => {
          const leadIndex = i + batchIdx;
          try {
            const res = await fetch(`${qstashBase}/v2/publish/${triggerUrl}`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${qstashToken}`,
                'Content-Type': 'application/json',
                'Upstash-Delay': `${Math.floor(i / batchSize) * 5}s`,
                'Upstash-Retries': '1',
              },
              body: JSON.stringify({
                event: 'prospect_found',
                phone: lead.phone,
                name: lead.title,
                metadata: {
                  source: 'apify_prospecting',
                  rating: String(lead.rating),
                  reviews: String(lead.reviewsCount),
                  website: lead.website,
                  address: lead.address,
                  city: lead.city,
                  category: lead.categoryName,
                  place_id: lead.placeId,
                  stagger_index: basePosition + leadIndex,
                },
              }),
            });
            if (res.ok) firedCount++;
            else console.warn(`[automation] QStash prospect_found publish failed: ${res.status}`);
          } catch (err) {
            console.warn('[automation] prospect_found dispatch error:', err);
          }
        }));
      }

      const skipped = newLeads.length - leadsToDispatch.length;
      return { ok: true, detail: `Found ${leads.length} leads, ${newLeads.length} new, dispatched ${firedCount}${skipped > 0 ? ` (${skipped} saved for tomorrow)` : ''} via QStash` };
    }

    // ─── Stagger Outreach (progressive delays + daily cap) ────────────────

    case 'stagger_outreach': {
      const intervalMin = Number(cfg.staggerIntervalMin) || 15;
      const maxPerDay = Number(cfg.staggerMaxPerDay) || 15;

      // Use pre-assigned stagger_index from search_leads if available (race-free),
      // otherwise fall back to counting DB rows (legacy / manual triggers)
      const supabase = getSupabase();
      const staggerIdx = ctx.metadata?.stagger_index;
      let position: number;

      if (typeof staggerIdx === 'number' || typeof staggerIdx === 'string') {
        position = Number(staggerIdx);
      } else {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: todayCount } = await supabase
          .from('quote_leads')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', ctx.businessId)
          .eq('source', 'prospecting')
          .gte('created_at', todayStart.toISOString());
        position = todayCount || 0;
      }

      if (position >= maxPerDay) {
        return { ok: true, detail: `Daily cap reached (${position}/${maxPerDay}) — skipping`, stopChain: true } as { ok: boolean; detail: string; stopChain: boolean };
      }

      // Schedule remaining actions with progressive delay + random jitter
      // Jitter avoids exact intervals which WhatsApp flags as bot behavior
      const jitterSec = Math.floor(Math.random() * 5 * 60); // 0–5 min random offset
      const delaySeconds = position * intervalMin * 60 + jitterSec;
      // Mark this lead with the prospecting source so the counter works
      if (ctx.phone) {
        let digits = ctx.phone.replace(/[^\d]/g, '');
        if (digits.length === 10) digits = `1${digits}`; // US/CA numbers need country code
        const phoneNorm = `+${digits}`;
        const jobType = (ctx.metadata?.category as string) || 'Prospecting';
        // Check if lead already exists (avoid duplicate insert — unique index is on phone+job_type)
        const { data: existingLead } = await supabase
          .from('quote_leads')
          .select('id')
          .eq('business_id', ctx.businessId)
          .eq('phone', phoneNorm)
          .maybeSingle();

        if (!existingLead) {
          await supabase.from('quote_leads').insert({
            business_id: ctx.businessId,
            phone: phoneNorm,
            name: ctx.customerName || 'Unknown',
            source: 'prospecting',
            status: 'Open',
            job_type: jobType,
            quote_amount: 0,
            attempts: 0,
          });
        }
      }

      if (delaySeconds <= 0) {
        // First lead of the day — continue immediately (no delay needed)
        return { ok: true, detail: `Stagger: position ${position + 1}/${maxPerDay}, executing now` };
      }

      // Use the existing scheduleResume to delay remaining actions
      // We need to grab remaining actions from the call stack — return a special marker
      // The executeActions loop doesn't know about remaining actions here,
      // so we use the delay pattern: inject into ctx and break.
      // Actually simpler: just return a detail and let the next action in the chain be a delay.
      // But for progressive delays, we need to schedule from HERE.
      // We'll abuse the existing scheduleResume by importing it.

      return { ok: true, detail: `Stagger: position ${position + 1}/${maxPerDay}, delay=${Math.round(delaySeconds / 60)}min`, staggerDelay: delaySeconds } as { ok: boolean; detail: string; staggerDelay: number };
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

  // Enrich context: auto-resolve businessName + firstName if not provided
  if (!ctx.businessName && ctx.businessId) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', ctx.businessId)
      .single();
    if (biz?.name) ctx.businessName = biz.name;
  }
  if (!ctx.firstName && ctx.customerName) {
    ctx.firstName = ctx.customerName.split(' ')[0];
  }

  // Enrich customer status + tags so rules can filter on them
  if (ctx.phone && ctx.businessId) {
    const phoneWithPlus = ctx.phone.startsWith('+') ? ctx.phone : `+${ctx.phone}`;
    const phoneWithoutPlus = ctx.phone.replace(/^\+/, '');
    const { data: cust } = await supabase
      .from('customers')
      .select('status, tags')
      .eq('business_id', ctx.businessId)
      .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
      .maybeSingle();
    if (cust) {
      if (!ctx.customerStatus) ctx.customerStatus = cust.status || '';
      if (!ctx.customerTags) ctx.customerTags = (cust.tags || []).join(',');
    }
  }

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

    if (action.type === 'condition_branch') {
      const cfg = (action.config || {}) as ConditionBranchConfig;
      const branchConditions = cfg.conditions || [];
      const thenActions = Array.isArray(cfg.thenActions) ? cfg.thenActions : [];
      const elseActions = Array.isArray(cfg.elseActions) ? cfg.elseActions : [];
      const branchMatched = evaluateConditions(branchConditions, ctx);
      const selected = branchMatched ? thenActions : elseActions;

      results.push({
        ok: true,
        detail: `Branch ${branchMatched ? 'matched' : 'not matched'} (${selected.length} step${selected.length === 1 ? '' : 's'})`,
      });

      // Execute selected branch inline, then continue with remaining outer actions.
      // This preserves expected flow even when branch actions include delays.
      const remainingOuter = actions.slice(i + 1);
      const merged = [...selected, ...remainingOuter];
      await executeActions(merged, 0, ctx, results);
      return;
    }

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

      // stopChain: action requested we abort remaining steps (e.g. ask_ai said NO)
      if ((result as { stopChain?: boolean }).stopChain) {
        console.log(`[automation] Chain stopped by ${action.type}`);
        return;
      }

      // staggerDelay: stagger_outreach wants us to delay remaining actions
      const staggerDelay = (result as { staggerDelay?: number }).staggerDelay;
      if (staggerDelay && staggerDelay > 0) {
        const remaining = actions.slice(i + 1);
        if (remaining.length > 0) {
          const scheduled = await scheduleResume(remaining, ctx, staggerDelay);
          results.push({ ok: scheduled, detail: `Stagger delay ${Math.round(staggerDelay / 60)}min → ${remaining.length} actions scheduled` });
        }
        return;
      }
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
    const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
    const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': `${delaySeconds}s`,
        'Upstash-Retries': '0',
      },
      body: JSON.stringify({
        actions: remainingActions,
        ctx: {
          businessId: ctx.businessId,
          event: ctx.event,
          phone: ctx.phone,
          customerName: ctx.customerName,
          firstName: ctx.firstName,
          businessName: ctx.businessName,
          message: ctx.message,
          amount: ctx.amount,
          metadata: ctx.metadata,
        },
        scheduledAt: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[automation] QStash error ${res.status}: ${errText}`);
      return false;
    }

    console.log(`[automation] Scheduled ${remainingActions.length} actions after ${delaySeconds}s delay`);
    return true;
  } catch (err) {
    console.error('[automation] QStash schedule failed:', err);
    return false;
  }
}
