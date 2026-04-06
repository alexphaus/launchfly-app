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

const APIFY_BASE = 'https://api.apify.com/v2';

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
  { id: 'quote_sent', label: 'Quote / Email Sent', icon: '📧', desc: 'A quote or email was sent to a prospect' },
  { id: 'external_webhook', label: 'External Webhook', icon: '⚡', desc: 'POST from Zapier, Make, or any external tool' },
  { id: 'call_completed', label: 'Voice Call Completed', icon: '📱', desc: 'Retell AI call ended — check outcome in metadata' },
  { id: 'new_lead_created', label: 'New Lead Created', icon: '🆕', desc: 'A new customer/lead record is created for the first time' },
  { id: 'user_inactive', label: 'Customer Went Silent', icon: '😶', desc: 'Customer hasn\'t replied after 24h — triggers smart AI follow-up' },
  { id: 'prospect_found', label: 'Prospect Found', icon: '🎯', desc: 'Fires per lead — from outreach drip or search_leads. Configure what happens when a prospect is contacted.' },
  { id: 'daily_schedule', label: 'Daily Schedule', icon: '⏰', desc: 'Fires on a schedule (daily/weekly). Configure time and days in the rule.' },
  { id: 'job_completed', label: 'Job Completed', icon: '🔨', desc: 'Fires when a job/project is marked complete. Trigger review requests, referral asks, and seasonal reactivation.' },
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
  { id: 'outreach', label: 'Outreach (Drip from Pool)', icon: '📤', desc: 'Pick N leads from hunter_prospects pool and schedule each as a prospect_found event at a random business-hours time. Decouples lead finding from outreach.', configFields: ['outreachLeadsPerDay', 'outreachWindowStart', 'outreachWindowEnd'] },
  { id: 'condition_branch', label: 'If / Else Branch', icon: '🔀', desc: 'Evaluate conditions and run different actions for true vs false branches', configFields: [] },
  { id: 'generate_content', label: 'Generate Content (AI)', icon: '✍️', desc: 'AI generates social media posts, captions, or video scripts based on business context and optional topic. Result in {aiResponse}.', configFields: ['contentType', 'contentTopic', 'contentPlatform'] },
  { id: 'post_social', label: 'Post to Social Media', icon: '📣', desc: 'Publish a post to Facebook/Instagram via Meta Graph API. Use with generate_content or provide text directly.', configFields: ['socialPlatform', 'socialMessage'] },
  { id: 'generate_report', label: 'Generate Business Report', icon: '📊', desc: 'AI analyzes leads, bookings, revenue, and conversations. Sends summary to owner via WhatsApp.', configFields: ['reportType'] },
  { id: 'scrape_url', label: 'Scrape URL', icon: '🕸️', desc: 'Scrape a website for data (competitor prices, job listings, directory info). Result in {aiResponse}.', configFields: ['scrapeUrl', 'scrapeExtract'] },
  { id: 'agent_task', label: 'Autonomous Agent Task', icon: '🚀', desc: 'Launch an AI agent that can search the web, scrape sites, find leads, save to CRM, draft content, and report back. Runs autonomously in the background.', configFields: ['agentGoal', 'agentRole'] },
] as const;

// ─── Template Filling ────────────────────────────────────────────────────

function fillVars(template: string, ctx: EventContext): string {
  // Inject built-in date/time variables so {date}, {today}, {month}, {year}, {dayOfWeek} always resolve
  const now = new Date();
  const builtins: Record<string, string> = {
    date: now.toISOString().split('T')[0],           // "2026-04-04"
    today: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), // "Friday, April 4, 2026"
    month: now.toLocaleDateString('en-US', { month: 'long' }),  // "April"
    year: String(now.getFullYear()),                  // "2026"
    dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }), // "Friday"
  };
  const merged = { ...builtins, ...ctx }; // ctx overrides builtins if explicitly set

  return template.replace(/\{(\w+(?:\.\w+)*)\}/g, (_, path: string) => {
    const parts = path.split('.');
    let val: unknown = merged;
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
  const { getWhatsAppProvider } = await import('@/lib/whatsapp-provider');
  const wa = await getWhatsAppProvider(businessId);
  const result = await wa.sendWhatsApp(to, body, businessId);
  if (!result.sent) {
    throw new Error(`WhatsApp send failed (${wa.name}): ${result.error}`);
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
        waInstanceId: ctx.metadata?.wa_instance_id as string | undefined,
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
        waInstanceId: ctx.metadata?.wa_instance_id as string | undefined,
      });
      return { ok: true, detail: `AI replied via ${channel} (${result.toolsCalled.length} tools: ${result.toolsCalled.join(', ') || 'none'})` };
    }

    case 'send_whatsapp': {
      if (!ctx.phone || !cfg.message) return { ok: false, detail: 'Missing phone or message' };
      const msg = fillVars(cfg.message as string, ctx);

      // Use pinned WhatsApp instance if this prospect was assigned one (multi-instance outreach)
      const pinnedInstanceId = ctx.metadata?.wa_instance_id as string | undefined;
      if (pinnedInstanceId) {
        const { getProviderByInstanceId } = await import('@/lib/whatsapp-provider');
        const wa = await getProviderByInstanceId(pinnedInstanceId, ctx.businessId);
        const result = await wa.sendWhatsApp(ctx.phone, msg);
        if (!result.sent) {
          return { ok: false, detail: `WhatsApp failed for ${ctx.phone} (instance ${pinnedInstanceId}): ${result.error}` };
        }
      } else {
        try {
          await sendWhatsApp(ctx.phone, msg, ctx.businessId);
        } catch (err) {
          return { ok: false, detail: `WhatsApp failed for ${ctx.phone}: ${err instanceof Error ? err.message : String(err)}` };
        }
      }
      await saveToChatHistory(ctx.phone, ctx.businessId, msg);

      // Auto-create customer record for prospect_found events so they appear in CRM
      if (ctx.event === 'prospect_found' && ctx.businessId) {
        const supabase = getSupabase();
        const phoneNorm = ctx.phone.startsWith('+') ? ctx.phone : `+${ctx.phone}`;
        await supabase.from('customers').upsert({
          business_id: ctx.businessId,
          phone: phoneNorm,
          name: ctx.customerName || 'Unknown',
          status: 'lead',
          source: 'outreach',
          tags: ['prospect', ctx.metadata?.service_type as string || 'unknown'].filter(Boolean),
        }, { onConflict: 'business_id,phone' }).then(() => {});

        // Update hunter_prospects status to opener_sent
        const prospectId = ctx.metadata?.prospect_id as string;
        if (prospectId) {
          await supabase.from('hunter_prospects')
            .update({ status: 'opener_sent', opener_sent_at: new Date().toISOString() })
            .eq('id', prospectId);
        }
      }

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
            .not('name', 'in', '("Purchasing OS","Chief of Staff","Marketing OS","Content & Growth OS")')
            .limit(1)
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
        supabase.from('assistants').select('system_prompt, knowledge_base, custom_rules, goal').eq('business_id', ctx.businessId).eq('active', true).not('name', 'in', '("Purchasing OS","Chief of Staff","Marketing OS","Content & Growth OS")').limit(1).maybeSingle(),
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
      const { deepseek, MINI_MODEL } = await import('@/lib/ai-provider');
      const result = await generateText({
        model: deepseek(MINI_MODEL),
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

      if (remaining <= 0) return { ok: true, detail: `${newLeads.length} new leads found but daily cap already reached` };

      // Find leads that actually have WhatsApp registered, until we hit the 'remaining' target
      const { getWhatsAppProvider } = await import('@/lib/whatsapp-provider');
      const waProvider = await getWhatsAppProvider(ctx.businessId);
      const checkHasWhatsApp = waProvider.checkHasWhatsApp;
      const leadsToDispatch: typeof newLeads = [];
      let checkedCount = 0;
      let noWhatsAppCount = 0;
      
      // Check in concurrent batches of 5
      for (let i = 0; i < newLeads.length && leadsToDispatch.length < remaining; i += 5) {
        const batch = newLeads.slice(i, i + 5);
        const results = await Promise.all(batch.map(async lead => {
          const hasWa = await checkHasWhatsApp(lead.phone, ctx.businessId);
          return { lead, hasWa };
        }));
        
        for (const { lead, hasWa } of results) {
          checkedCount++;
          if (hasWa) {
            leadsToDispatch.push(lead);
            if (leadsToDispatch.length >= remaining) break;
          } else {
            noWhatsAppCount++;
          }
        }
      }

      if (leadsToDispatch.length === 0) return { ok: true, detail: `Checked ${checkedCount} leads, none had WhatsApp registered` };

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

      const skipped = newLeads.length - checkedCount;
      return { ok: true, detail: `Found ${leads.length} leads. Checked ${checkedCount}: ${noWhatsAppCount} no WhatsApp, ${firedCount} dispatched${skipped > 0 ? ` (${skipped} saved for tomorrow)` : ''} via QStash.` };
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

    // ─── Outreach (Drip from Pool) ───────────────────────────────────────

    case 'outreach': {
      const leadsPerDay = Number(cfg.outreachLeadsPerDay) || 5;
      const windowStart = (cfg.outreachWindowStart as string) || '09:00';
      const windowEnd = (cfg.outreachWindowEnd as string) || '18:00';
      const maxChecks = leadsPerDay * 5; // Check up to 5x quota to fill the day

      const supabase = getSupabase();
      const { getOutreachInstances, getProviderForInstance, getWhatsAppProvider } = await import('@/lib/whatsapp-provider');

      // Load multi-instance config (may be empty → falls back to single instance)
      const instances = await getOutreachInstances(ctx.businessId);
      const useMultiInstance = instances.length > 0;

      // Calculate total remaining capacity across all instances
      let totalCapacity = leadsPerDay;
      if (useMultiInstance) {
        totalCapacity = Math.min(
          leadsPerDay,
          instances.reduce((sum, inst) => sum + Math.max(0, inst.daily_limit - inst.sends_today), 0),
        );
        if (totalCapacity <= 0) {
          return { ok: true, detail: `All ${instances.length} WhatsApp instances at daily limit — skipping outreach` };
        }
      }

      // Use the first available instance (or default provider) for WhatsApp checks
      const waProvider = useMultiInstance
        ? getProviderForInstance(instances[0])
        : await getWhatsAppProvider(ctx.businessId);

      // Backfill loop: keep fetching batches until we have enough WhatsApp-verified leads
      const verified: { id: string; business_name: string; whatsapp_number: string; service_type: string; area: string; owner_name: string | null; source: string; pain_signals: string[] | null; website_url: string | null }[] = [];
      const noWaIds: string[] = [];
      let offset = 0;
      let totalChecked = 0;

      while (verified.length < totalCapacity && totalChecked < maxChecks) {
        const batchSize = Math.min(10, totalCapacity * 2 - verified.length);
        const { data: batch, error: fetchErr } = await supabase
          .from('hunter_prospects')
          .select('id, business_name, whatsapp_number, service_type, area, owner_name, source, pain_signals, website_url')
          .eq('status', 'new')
          .order('priority', { ascending: false })
          .order('created_at', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (fetchErr) {
          console.error('[outreach] Fetch error:', fetchErr.message);
          break;
        }
        if (!batch || batch.length === 0) break;

        for (let i = 0; i < batch.length && verified.length < totalCapacity; i += 5) {
          const chunk = batch.slice(i, Math.min(i + 5, batch.length));
          const results = await Promise.all(chunk.map(async p => {
            const hasWa = await waProvider.checkHasWhatsApp(p.whatsapp_number, ctx.businessId);
            return { prospect: p, hasWa };
          }));
          for (const { prospect, hasWa } of results) {
            totalChecked++;
            if (hasWa && verified.length < totalCapacity) {
              verified.push(prospect);
            } else if (!hasWa) {
              noWaIds.push(prospect.id);
            }
          }
        }

        offset += batch.length;
      }

      if (noWaIds.length > 0) {
        await supabase
          .from('hunter_prospects')
          .update({ status: 'no_whatsapp' })
          .in('id', noWaIds);
      }

      if (verified.length === 0) {
        return { ok: true, detail: `Checked ${totalChecked} prospects — none had WhatsApp. Pool may need refilling.` };
      }

      // ─── Round-robin assign prospects to instances ──────────────────────
      // Build assignment: each prospect gets pinned to an instance
      type Assignment = { prospect: typeof verified[0]; instanceId: string | null };
      const assignments: Assignment[] = [];

      if (useMultiInstance) {
        // Track remaining capacity per instance during assignment
        const caps = instances.map(inst => ({
          id: inst.id,
          remaining: Math.max(0, inst.daily_limit - inst.sends_today),
        }));

        for (const prospect of verified) {
          // Pick instance with most remaining capacity (spread the load)
          caps.sort((a, b) => b.remaining - a.remaining);
          const pick = caps.find(c => c.remaining > 0);
          if (!pick) break; // all full
          assignments.push({ prospect, instanceId: pick.id });
          pick.remaining--;
        }
      } else {
        // Single instance mode — no pinning
        for (const prospect of verified) {
          assignments.push({ prospect, instanceId: null });
        }
      }

      // ─── Schedule each as prospect_found ────────────────────────────────
      const qstashToken = process.env.QSTASH_TOKEN;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
      const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
      const triggerUrl = `${appUrl}/api/assistants/trigger?businessId=${ctx.businessId}`;

      const [startH, startM] = windowStart.split(':').map(Number);
      const [endH, endM] = windowEnd.split(':').map(Number);
      const windowStartSec = startH * 3600 + startM * 60;
      const windowEndSec = endH * 3600 + endM * 60;
      const windowSpan = Math.max(windowEndSec - windowStartSec, 60); // Minimum 60s span

      const tz = (ctx.metadata?.__timezone as string) || 'UTC';
      let nowSec: number;
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
        }).formatToParts(new Date());
        const h = Number(parts.find(p => p.type === 'hour')?.value || 0);
        const m = Number(parts.find(p => p.type === 'minute')?.value || 0);
        const s = Number(parts.find(p => p.type === 'second')?.value || 0);
        nowSec = h * 3600 + m * 60 + s;
      } catch {
        const now = new Date();
        nowSec = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
      }

      let scheduled = 0;
      const scheduledIds: string[] = [];

      const intervalSec = assignments.length > 0 ? windowSpan / assignments.length : 0;

      for (let i = 0; i < assignments.length; i++) {
        const { prospect, instanceId } = assignments[i];
        
        // Distribute evenly across the window, plus up to 50% of interval as jitter
        const baseOffset = i * intervalSec;
        const jitter = Math.floor(Math.random() * (intervalSec * 0.5));
        const targetSec = windowStartSec + baseOffset + jitter;
        
        let delaySec = targetSec - nowSec;
        if (delaySec < 60) delaySec = 60 + i * 30 + Math.floor(Math.random() * 30); // Prevent zero-delays and clumped retries

        try {
          const res = await fetch(`${qstashBase}/v2/publish/${triggerUrl}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${qstashToken}`,
              'Content-Type': 'application/json',
              'Upstash-Delay': `${delaySec}s`,
              'Upstash-Retries': '1',
            },
            body: JSON.stringify({
              event: 'prospect_found',
              phone: prospect.whatsapp_number,
              name: prospect.business_name,
              metadata: {
                source: prospect.source || 'hunter_pool',
                prospect_id: prospect.id,
                service_type: prospect.service_type,
                area: prospect.area,
                owner_name: prospect.owner_name,
                website: prospect.website_url,
                pain_signals: prospect.pain_signals,
                wa_instance_id: instanceId, // pin to this instance for all follow-ups
              },
            }),
          });
          if (res.ok) {
            scheduled++;
            scheduledIds.push(prospect.id);
          } else {
            console.warn(`[outreach] QStash publish failed for ${prospect.business_name}: ${res.status}`);
          }
        } catch (err) {
          console.warn('[outreach] QStash dispatch error:', err);
        }
      }

      // Mark scheduled prospects as 'opener_queued' + pin the instance
      if (scheduledIds.length > 0) {
        // Bulk update status
        await supabase
          .from('hunter_prospects')
          .update({ status: 'opener_queued', opener_sent_at: new Date().toISOString() })
          .in('id', scheduledIds);

        // Pin wa_instance_id per prospect
        if (useMultiInstance) {
          for (const { prospect, instanceId } of assignments) {
            if (instanceId && scheduledIds.includes(prospect.id)) {
              await supabase
                .from('hunter_prospects')
                .update({ wa_instance_id: instanceId })
                .eq('id', prospect.id);
            }
          }
          // Note: sends_today counters are auto-incremented by the provider on each successful send
        }
      }

      const instanceInfo = useMultiInstance ? ` across ${instances.length} instances` : '';
      return {
        ok: true,
        detail: `Checked ${totalChecked}, ${noWaIds.length} no WhatsApp, ${scheduled}/${totalCapacity} scheduled (window ${windowStart}–${windowEnd})${instanceInfo}`,
      };
    }

    // ─── Generate Content (AI-powered content creation) ─────────────────

    case 'generate_content': {
      const contentType = (cfg.contentType as string) || 'social_post';
      const topic = (cfg.contentTopic as string) ? fillVars(cfg.contentTopic as string, ctx) : '';
      const platform = (cfg.contentPlatform as string) || 'instagram';

      const supabase = getSupabase();
      const [{ data: biz }, { data: assistant }] = await Promise.all([
        supabase.from('businesses').select('name, industry, city, state, business_data').eq('id', ctx.businessId).single(),
        supabase.from('assistants').select('system_prompt, knowledge_base, tone, goal').eq('business_id', ctx.businessId).eq('active', true).not('name', 'in', '("Purchasing OS","Chief of Staff","Marketing OS","Content & Growth OS")').limit(1).maybeSingle(),
      ]);

      const bizName = biz?.name || 'the business';
      const industry = biz?.industry || '';
      const location = biz?.city ? `${biz.city}, ${biz.state || ''}` : '';
      const tone = assistant?.tone || 'friendly';
      const bd = (biz?.business_data || {}) as Record<string, unknown>;
      const kb = (assistant?.knowledge_base || {}) as Record<string, unknown[]>;

      const contentTypeInstructions: Record<string, string> = {
        social_post: `Write a compelling social media post for ${platform}. Include relevant hashtags. Keep it concise and engaging. If Instagram, suggest a visual description in brackets [like this] at the end.`,
        carousel_script: `Write a 5-7 slide Instagram carousel script. Format: SLIDE 1: [visual description] / Caption: text. Make it educational and shareable.`,
        video_script: `Write a short-form video script (30-60 seconds) for ${platform}. Include: HOOK (first 3 seconds), BODY (value/story), CTA (call to action). Format with scene directions.`,
        blog_outline: `Write a detailed blog post outline with title, intro hook, 5-7 sections with key points, and conclusion CTA.`,
        email_campaign: `Write a marketing email with subject line, preview text, body with clear sections, and a strong CTA button text.`,
      };

      const systemPrompt = [
        `You are a content marketing expert creating ${contentType.replace('_', ' ')} for ${bizName}.`,
        `Industry: ${industry}. Location: ${location}. Tone: ${tone}.`,
        bd.niche ? `Niche: ${bd.niche}` : '',
        bd.usp ? `USP: ${bd.usp}` : '',
        contentTypeInstructions[contentType] || contentTypeInstructions.social_post,
        kb.pricing ? `Services: ${(kb.pricing as { service: string }[]).map(p => p.service).join(', ')}` : '',
        'Write content that drives engagement and leads. Be authentic, not salesy.',
        'Output ONLY the content — no meta-commentary.',
      ].filter(Boolean).join('\n');

      const userPrompt = topic
        ? `Create content about: ${topic}`
        : `Create content that would resonate with potential customers looking for ${industry || 'services'} in ${location || 'the area'}. Pick a trending angle.`;

      const { generateText } = await import('ai');
      const { deepseek, MINI_MODEL } = await import('@/lib/ai-provider');
      const result = await generateText({
        model: deepseek(MINI_MODEL),
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      ctx.aiResponse = result.text.trim();
      return { ok: true, detail: `Generated ${contentType} for ${platform}: "${(ctx.aiResponse as string).substring(0, 100)}..."` };
    }

    // ─── Post to Social Media (Meta Graph API) ───────────────────────────

    case 'post_social': {
      const platform = (cfg.socialPlatform as string) || 'facebook';
      const messageTemplate = (cfg.socialMessage as string) || '{aiResponse}';
      const postText = fillVars(messageTemplate, ctx);

      if (!postText || postText === '{aiResponse}') {
        return { ok: false, detail: 'No content to post. Chain generate_content before this action, or provide socialMessage.' };
      }

      // Load Meta credentials from business config
      const supabase = getSupabase();
      const { data: biz } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', ctx.businessId)
        .single();

      const bd = (biz?.business_data || {}) as Record<string, unknown>;
      const metaAccessToken = (bd.meta_access_token || bd.facebook_access_token || process.env.META_ACCESS_TOKEN) as string;
      const fbPageId = (bd.facebook_page_id || process.env.META_PAGE_ID) as string;
      const igAccountId = (bd.instagram_account_id || process.env.META_IG_ACCOUNT_ID) as string;

      if (!metaAccessToken) {
        return { ok: false, detail: 'No Meta/Facebook access token configured. Add meta_access_token to business settings.' };
      }

      if (platform === 'facebook' || platform === 'both') {
        if (!fbPageId) return { ok: false, detail: 'No Facebook Page ID configured.' };
        const fbRes = await fetch(`https://graph.facebook.com/v19.0/${fbPageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: postText,
            access_token: metaAccessToken,
          }),
        });
        if (!fbRes.ok) {
          const err = await fbRes.text().catch(() => '');
          return { ok: false, detail: `Facebook post failed ${fbRes.status}: ${err.substring(0, 200)}` };
        }
      }

      if (platform === 'instagram' || platform === 'both') {
        if (!igAccountId) return { ok: false, detail: 'No Instagram Account ID configured.' };
        // Instagram Graph API requires a media URL for posts — text-only not supported
        // For text-only, we post to Facebook. For IG, we need an image URL.
        const imageUrl = (cfg.socialImageUrl as string) || (ctx.metadata?.image_url as string);
        if (!imageUrl) {
          return { ok: false, detail: 'Instagram requires an image URL. Provide socialImageUrl or chain with an image generator.' };
        }
        // Step 1: Create media container
        const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            caption: postText,
            access_token: metaAccessToken,
          }),
        });
        if (!containerRes.ok) {
          const err = await containerRes.text().catch(() => '');
          return { ok: false, detail: `Instagram container creation failed ${containerRes.status}: ${err.substring(0, 200)}` };
        }
        const container = (await containerRes.json()) as { id: string };
        // Step 2: Publish
        const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media_publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: container.id,
            access_token: metaAccessToken,
          }),
        });
        if (!publishRes.ok) {
          const err = await publishRes.text().catch(() => '');
          return { ok: false, detail: `Instagram publish failed ${publishRes.status}: ${err.substring(0, 200)}` };
        }
      }

      return { ok: true, detail: `Posted to ${platform}: "${postText.substring(0, 80)}..."` };
    }

    // ─── Generate Business Report ────────────────────────────────────────

    case 'generate_report': {
      const reportType = (cfg.reportType as string) || 'weekly_summary';
      const supabase = getSupabase();

      // Gather business metrics
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const periodStart = reportType === 'monthly_summary' ? monthAgo : weekAgo;
      const periodLabel = reportType === 'monthly_summary' ? 'month' : 'week';

      const [{ data: biz }, leadsResult, customersResult, chatResult, prospectsResult] = await Promise.all([
        supabase.from('businesses').select('name, whatsapp_number, phone_number').eq('id', ctx.businessId).single(),
        supabase.from('quote_leads').select('id, status, source, quote_amount, created_at')
          .eq('business_id', ctx.businessId).gte('created_at', periodStart.toISOString()),
        supabase.from('customers').select('id, status, source, created_at')
          .eq('business_id', ctx.businessId).gte('created_at', periodStart.toISOString()),
        supabase.from('chat_history').select('id, role, created_at')
          .eq('business_id', ctx.businessId).gte('created_at', periodStart.toISOString()),
        supabase.from('hunter_prospects').select('id, status, created_at')
          .eq('business_id', ctx.businessId).gte('created_at', periodStart.toISOString()),
      ]);

      const leads = leadsResult.data || [];
      const customers = customersResult.data || [];
      const chats = chatResult.data || [];
      const prospects = prospectsResult.data || [];

      const totalLeads = leads.length;
      const convertedLeads = leads.filter(l => l.status === 'Won' || l.status === 'Converted').length;
      const totalRevenue = leads.reduce((sum, l) => sum + (l.quote_amount || 0), 0);
      const newCustomers = customers.length;
      const totalConversations = chats.filter(c => c.role === 'user').length;
      const aiResponses = chats.filter(c => c.role === 'assistant').length;
      const prospectsContacted = prospects.filter(p => p.status === 'opener_sent' || p.status === 'replied').length;
      const prospectsReplied = prospects.filter(p => p.status === 'replied').length;
      const responseRate = prospectsContacted > 0 ? Math.round((prospectsReplied / prospectsContacted) * 100) : 0;

      const metricsBlock = [
        `📊 ${periodLabel.toUpperCase()}LY REPORT — ${biz?.name || 'Your Business'}`,
        `Period: ${periodStart.toLocaleDateString()} → ${now.toLocaleDateString()}`,
        '',
        `📈 LEADS: ${totalLeads} new (${convertedLeads} converted)`,
        `💰 PIPELINE: $${totalRevenue.toLocaleString()}`,
        `👥 NEW CUSTOMERS: ${newCustomers}`,
        `💬 CONVERSATIONS: ${totalConversations} inbound, ${aiResponses} AI replies`,
        `🎯 OUTREACH: ${prospectsContacted} contacted, ${prospectsReplied} replied (${responseRate}% response rate)`,
      ].join('\n');

      // Ask AI to analyze and add insights
      const { generateText } = await import('ai');
      const { deepseek, MINI_MODEL } = await import('@/lib/ai-provider');

      const analysisResult = await generateText({
        model: deepseek(MINI_MODEL),
        system: 'You are a business analyst. Given the metrics below, provide 3 specific, actionable insights in 2-3 sentences each. Focus on what to improve and what\'s working. Be direct and practical. Format with emoji bullets.',
        messages: [{ role: 'user', content: metricsBlock }],
      });

      const fullReport = `${metricsBlock}\n\n🧠 AI INSIGHTS:\n${analysisResult.text.trim()}`;

      // Send report to business owner
      const ownerPhone = biz?.whatsapp_number || biz?.phone_number;
      if (ownerPhone) {
        await sendWhatsApp(ownerPhone, fullReport, ctx.businessId);
      }

      ctx.aiResponse = fullReport;
      return { ok: true, detail: `Report generated and sent to owner: ${totalLeads} leads, $${totalRevenue} pipeline` };
    }

    // ─── Scrape URL (generic web scraper via Apify) ──────────────────────

    case 'scrape_url': {
      const url = (cfg.scrapeUrl as string) ? fillVars(cfg.scrapeUrl as string, ctx) : '';
      const extractInstruction = (cfg.scrapeExtract as string) || 'Extract all relevant business information, prices, contact details, and key content.';

      if (!url) return { ok: false, detail: 'No URL to scrape' };

      // Validate URL
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return { ok: false, detail: 'Only http/https URLs allowed' };
        }
        if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname)) {
          return { ok: false, detail: 'Private/internal URLs not allowed' };
        }
      } catch {
        return { ok: false, detail: 'Invalid URL format' };
      }

      const { getApifyToken } = await import('@/lib/apify');
      const token = await getApifyToken(ctx.businessId);

      // Use Apify's web scraper actor for general URL scraping
      const startRes = await fetch(
        `${APIFY_BASE}/acts/apify~website-content-crawler/runs?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startUrls: [{ url }],
            maxCrawlPages: 3,
            maxCrawlDepth: 1,
          }),
        },
      );

      if (!startRes.ok) {
        const err = await startRes.text().catch(() => '');
        return { ok: false, detail: `Apify scrape start error ${startRes.status}: ${err.substring(0, 200)}` };
      }

      const run = (await startRes.json()) as { data: { id: string; defaultDatasetId: string } };

      // Wait for completion
      const waitRes = await fetch(
        `${APIFY_BASE}/actor-runs/${run.data.id}?token=${encodeURIComponent(token)}&waitForFinish=50`,
      );
      const runStatus = (await waitRes.json()) as { data: { status: string } };

      if (runStatus.data.status !== 'SUCCEEDED') {
        console.warn(`[scrape_url] Run status: ${runStatus.data.status}`);
      }

      // Fetch results
      const dataRes = await fetch(
        `${APIFY_BASE}/datasets/${run.data.defaultDatasetId}/items?token=${encodeURIComponent(token)}&format=json`,
      );
      const results = (await dataRes.json()) as { url?: string; text?: string; title?: string }[];
      const scrapedText = results.map(r => `## ${r.title || r.url || ''}\n${(r.text || '').substring(0, 3000)}`).join('\n\n');

      if (!scrapedText.trim()) {
        return { ok: false, detail: 'Scrape returned no content' };
      }

      // Ask AI to extract the relevant info
      const { generateText } = await import('ai');
      const { deepseek, MINI_MODEL } = await import('@/lib/ai-provider');
      const extraction = await generateText({
        model: deepseek(MINI_MODEL),
        system: 'You are a data extraction specialist. Extract and structure the requested information from the scraped web content below. Be precise and concise.',
        messages: [{ role: 'user', content: `INSTRUCTION: ${extractInstruction}\n\nSCRAPED CONTENT:\n${scrapedText.substring(0, 8000)}` }],
      });

      ctx.aiResponse = extraction.text.trim();
      return { ok: true, detail: `Scraped ${url}: "${(ctx.aiResponse as string).substring(0, 100)}..."` };
    }

    // ─── Autonomous Agent Task ────────────────────────────────────────────

    case 'agent_task': {
      const goal = (cfg.agentGoal as string) ? fillVars(cfg.agentGoal as string, ctx) : '';
      const role = (cfg.agentRole as string) || undefined;
      // Which internal tools this agent can use.
      // Explicit array → those tools; '*' or undefined from Launchfly internal → null (all tools)
      // Default for client agents: [] (core tools only — no save_leads/search_google_maps)
      const enabledTools: string[] | null = cfg.agentTools === '*' ? null
        : Array.isArray(cfg.agentTools) ? (cfg.agentTools as string[])
        : []; // safe default: core-only

      if (!goal) return { ok: false, detail: 'No agent goal specified' };

      // Dispatch to agent runner via QStash (async — don't block the action chain)
      const qstashToken = process.env.QSTASH_TOKEN;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';

      if (!qstashToken) {
        // Fallback: run inline (will work for quick tasks but may timeout on long ones)
        try {
          const { executeAgentTask } = await import('@/lib/agent/runner');
          const result = await executeAgentTask({ businessId: ctx.businessId, goal, role, enabledTools });
          ctx.aiResponse = result.result || `Agent ${result.status} after ${result.stepsUsed} steps`;
          return { ok: result.status !== 'failed', detail: ctx.aiResponse as string };
        } catch (err) {
          return { ok: false, detail: `Agent error: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // Preferred: dispatch via QStash for robust async execution
      try {
        const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
        const targetUrl = `${appUrl}/api/agent/run`;
        const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${qstashToken}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': '1s',
            'Upstash-Retries': '1',
          },
          body: JSON.stringify({
            businessId: ctx.businessId,
            goal,
            role,
            enabledTools,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return { ok: false, detail: `Agent dispatch failed: ${res.status} ${errText.substring(0, 200)}` };
        }

        return { ok: true, detail: `Agent task dispatched: "${goal.substring(0, 80)}"` };
      } catch (err) {
        return { ok: false, detail: `Agent dispatch error: ${err instanceof Error ? err.message : String(err)}` };
      }
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

  // ── Pause check for outbound events (prospecting, scheduled outreach) ──
  // Inbound events (inbound_whatsapp, payment_received) should ALWAYS be processed
  const OUTBOUND_EVENTS = new Set(['prospect_found', 'daily_schedule', 'user_inactive']);
  if (OUTBOUND_EVENTS.has(ctx.event) && ctx.businessId) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('outreach_paused')
      .eq('id', ctx.businessId)
      .single();
    if (biz?.outreach_paused) {
      console.log(`[automation] Outreach paused for ${ctx.businessId} — skipping ${ctx.event}`);
      return { fired: 0, results: [{ ok: true, detail: 'Outreach paused — skipped' }] };
    }
  }

  // Enrich context: auto-resolve businessName, googleReviewUrl + firstName if not provided
  if (!ctx.businessName && ctx.businessId) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('name, business_data')
      .eq('id', ctx.businessId)
      .single();
    if (biz?.name) ctx.businessName = biz.name;
    const bd = biz?.business_data as Record<string, unknown> | null;
    if (bd) {
      ctx.googleReviewUrl = (bd.googleReviewLink || bd.google_review_link || '') as string;
    }
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
    .not('name', 'in', '("Purchasing OS","Chief of Staff","Marketing OS","Content & Growth OS")')
    .limit(1)
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
    // Propagate schedule timezone to actions (used by outreach for window calculation)
    const ruleCtx = { ...ctx };
    const schedCfg = (rule as any).scheduleConfig;
    if (schedCfg?.timezone) {
      ruleCtx.metadata = { ...ruleCtx.metadata, __timezone: schedCfg.timezone };
    }
    await executeActions(rule.actions, 0, ruleCtx, results);
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
      const baseSeconds = Math.max(60, Math.round(hours * 3600));

      // Add human-like jitter: ±5% of total delay (min ±5min, max ±2h)
      const jitterRange = Math.min(7200, Math.max(300, Math.round(baseSeconds * 0.05)));
      const jitter = Math.round((Math.random() * 2 - 1) * jitterRange);
      const delaySeconds = Math.max(60, baseSeconds + jitter);

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
