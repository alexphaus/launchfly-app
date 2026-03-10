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
  { id: 'call_completed', label: 'Voice Call Completed', icon: '📱', desc: 'Retell AI call ended — check outcome in metadata' },
  { id: 'new_lead_created', label: 'New Lead Created', icon: '🆕', desc: 'A new customer/lead record is created for the first time' },
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

// ─── Chat History Helper ─────────────────────────────────────────────────
// Save outbound messages to chat_history so the v2 webhook can trace the
// business when the customer replies (getLastBusinessId looks here).

async function saveToChatHistory(phone: string, businessId: string, content: string): Promise<void> {
  try {
    const supabase = getSupabase();
    const phoneNormalized = phone.replace('whatsapp:', '').replace(/^\+/, '');
    await supabase.from('chat_history').insert({
      phone: phoneNormalized,
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

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const twilio = (await import('twilio')).default;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const from = process.env.TWILIO_WHATSAPP_FROM
    || (process.env.TWILIO_WHATSAPP_NUMBER ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}` : '');
  if (!from) throw new Error('Missing TWILIO_WHATSAPP_FROM or TWILIO_WHATSAPP_NUMBER');
  await client.messages.create({
    from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    body,
  });
}

/** Send a message — WhatsApp first, SMS fallback on failure */
async function sendMessage(to: string, body: string, channel?: string): Promise<'whatsapp' | 'sms'> {
  if (channel === 'sms') {
    await sendSms(to, body);
    return 'sms';
  }
  try {
    await sendWhatsApp(to, body);
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
      const channel = (ctx.metadata?.channel as string) || undefined;
      const sentVia = await sendMessage(ctx.phone, msg, channel);
      await saveToChatHistory(ctx.phone, ctx.businessId, msg);
      return { ok: true, detail: `Sent ${sentVia} to ${ctx.phone}` };
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
      await sendWhatsApp(ownerPhone, notifyMsg);
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
          metadata: { lead_id: lead.id, source: 'automation' },
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

      const fromNum = process.env.TWILIO_WHATSAPP_FROM
        || (process.env.TWILIO_WHATSAPP_NUMBER ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}` : '');
      if (!fromNum) return { ok: false, detail: 'Missing TWILIO_WHATSAPP_FROM or TWILIO_WHATSAPP_NUMBER' };

      await client.messages.create({
        from: fromNum.startsWith('whatsapp:') ? fromNum : `whatsapp:${fromNum}`,
        to: `whatsapp:${ctx.phone}`,
        contentSid: templateSid,
        ...(Object.keys(contentVariables).length > 0
          ? { contentVariables: JSON.stringify(contentVariables) }
          : {}),
      });
      // Save to chat_history so v2 webhook can trace business on customer reply
      await saveToChatHistory(ctx.phone, ctx.businessId, `[Template: ${templateSid}]`);
      return { ok: true, detail: `Template ${templateSid} sent to ${ctx.phone}` };
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
    const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
    const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
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
