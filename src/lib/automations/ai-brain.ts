// src/lib/automations/ai-brain.ts
// ═══════════════════════════════════════════════════════════════════════════
// AI Response Brain — minimal, generic, business-agnostic.
//
// All behavior comes from the assistant config in the modal:
//   - system_prompt (or auto-generated from tone + goal + business data)
//   - knowledge_base (pricing, FAQ, objections)
//   - custom_rules
//   - tools_enabled (which tools the AI can use)
//
// This file is ~120 lines of pure infrastructure. Zero business logic.
// ═══════════════════════════════════════════════════════════════════════════

import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { receptionistTools } from '@/lib/ai-receptionist/tools';
import {
  getConversationHistory,
  saveMessage,
} from '@/lib/ai-receptionist/history';
// sendTypingIndicator removed — was Twilio-specific, not applicable to UltraMsg

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── Types ───────────────────────────────────────────────────────────────

export interface AIBrainInput {
  businessId: string;
  phone: string;           // E.164 with +
  messageText: string;
  messageSid?: string;     // for typing indicator
  channel?: string;        // 'whatsapp' | 'sms' — defaults to whatsapp
}

export interface AIBrainResult {
  reply: string;
  toolsCalled: string[];
  skipped?: boolean;
}

// ─── Send helpers ────────────────────────────────────────────────────────

async function sendWhatsApp(to: string, body: string, businessId?: string): Promise<void> {
  const { sendWhatsApp: ultramsgSend } = await import('@/lib/ultramsg');
  const result = await ultramsgSend(to, body, businessId);
  if (!result.sent) {
    throw new Error(`UltraMsg send failed: ${result.error}`);
  }
}

async function sendSms(to: string, body: string): Promise<void> {
  const twilio = (await import('twilio')).default;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const smsFrom = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER || '';
  if (!smsFrom) throw new Error('Missing TWILIO_SMS_NUMBER');
  const phone = to.replace(/^whatsapp:/, '');
  await client.messages.create({
    from: smsFrom.replace(/^whatsapp:/, ''),
    to: phone.startsWith('+') ? phone : `+${phone}`,
    body,
  });
}

async function sendReply(to: string, body: string, channel: string, businessId?: string): Promise<void> {
  if (channel === 'sms') {
    await sendSms(to, body);
  } else {
    await sendWhatsApp(to, body, businessId);
  }
}

// ─── Prompt builder ──────────────────────────────────────────────────────

const TONE_LABELS: Record<string, string> = {
  friendly: 'Warm, approachable, conversational. Occasional emojis.',
  professional: 'Polished, corporate. Proper grammar, minimal emojis.',
  casual: 'Like a friend. Contractions, slang, emojis freely.',
  direct: 'Concise, straight to the point. No fluff.',
};

const GOAL_LABELS: Record<string, string> = {
  book_consultation: 'Get the customer to book a consultation or appointment.',
  close_sale: 'Close the sale. Push toward checkout/payment. Overcome objections.',
  collect_review: 'Get happy customers to leave a review.',
  reactivate: 'Re-engage old leads who went silent.',
};

function buildSystemPrompt(
  assistant: Record<string, any> | null,
  business: Record<string, any> | null,
  customer: Record<string, any> | null,
  phone: string,
  businessId: string,
): string {
  const bizName = business?.name || 'the business';
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const baseRules = `You communicate via WhatsApp. Today is ${today}.
CRITICAL WHATSAPP RULES (HUMAN REALISM & ANTI-BAN):
- NEVER SEND WALLS OF TEXT. Keep responses exceptionally short, easy to read, and plain.
- NO ENTHUSIASTIC CORPORATE BOT SPEAK. Never say "Got it!", "Great question!", or use exclamation marks excessively.
- Tone should be casual, slightly lazy, like a real person typing on a phone while busy. Use lowercase sometimes.
- 1 emoji max per message, preferably 0 unless necessary.
- If they answer a direct question, acknowledge it casually (e.g. "yeah makes sense", "ah gotcha") before moving on.
`;

  // ── If custom prompt is set, use it but still enforce base rules ──
  if (assistant?.system_prompt) {
    return baseRules + '\n\n' + assistant.system_prompt + contextBlock(phone, businessId, customer, business);
  }

  // ── Auto-generate a minimal prompt from config ──
  const config = (business?.business_data || {}) as Record<string, any>;
  const tone = assistant?.tone || 'friendly';
  const goal = assistant?.goal || 'book_consultation';

  let prompt = `You are the AI assistant for **${bizName}**.
${baseRules}

TONE: ${TONE_LABELS[tone] || tone}
GOAL: ${GOAL_LABELS[goal] || goal}

BUSINESS: ${bizName}
Service type: ${config.niche || 'General Service'}
Currency: ${config.currency || 'USD'}
Owner: ${config.ownerName || 'the owner'}
Operating hours: ${config.operatingHours || '9am - 5pm'}
`;

  // ── Append knowledge base ──
  if (assistant?.knowledge_base) {
    const kb = assistant.knowledge_base as Record<string, any>;
    if (kb.pricing?.length) {
      prompt += '\nPRICING:\n' + kb.pricing.map((p: any) => `- ${p.service}: ${p.price} per ${p.unit}`).join('\n');
    }
    if (kb.faq?.length) {
      prompt += '\n\nFAQ:\n' + kb.faq.map((f: any) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');
    }
    if (kb.objections?.length) {
      prompt += '\n\nOBJECTION HANDLING:\n' + kb.objections.map((o: any) => `"${o.trigger}" → ${o.response}`).join('\n');
    }
  }

  // ── Append custom rules ──
  if (assistant?.custom_rules?.length) {
    prompt += '\n\nRULES:\n' + (assistant.custom_rules as string[]).map((r: string) => `- ${r}`).join('\n');
  }

  prompt += contextBlock(phone, businessId, customer, business);

  return prompt;
}

/** Minimal context block — dynamic values the AI needs for tool calls */
function contextBlock(
  phone: string,
  businessId: string,
  customer: Record<string, any> | null,
  business: Record<string, any> | null,
): string {
  const ownerPhone = business?.whatsapp_number || business?.phone_number || '';
  return `

[CONTEXT]
Customer phone: ${phone}
Business ID: ${businessId}
Customer ID: ${customer?.id || 'unknown'}
Customer name: ${customer?.name || customer?.first_name || 'unknown'}
Owner phone: ${ownerPhone}

When calling any tool that needs businessId, use "${businessId}".
When calling any tool that needs customerPhone/phone, use "${phone}".
When calling notifyOwner, use ownerPhone "${ownerPhone}".
Do NOT claim an action is done unless you called the tool and it succeeded.
`;
}

// ─── Tool filtering ──────────────────────────────────────────────────────

const TOOL_GROUPS: Record<string, string[]> = {
  book_calendar: ['createBooking', 'rescheduleBooking', 'cancelBooking', 'getCustomerBookings', 'getAvailableSlots'],
  lookup_customer: ['lookupCustomer', 'updateCustomer'],
  transfer_to_human: ['notifyOwner'],
  send_checkout_link: ['calculatePrice', 'generateCheckoutLink'],
  warranty: ['activateWarranty', 'saveFeedback', 'saveReferral'],
};

function getFilteredTools(toolsConfig: string[] | undefined) {
  if (!toolsConfig?.length) {
    // No config = all tools (backward compat)
    return receptionistTools;
  }
  const enabled = new Set<string>();
  for (const id of toolsConfig) {
    const group = TOOL_GROUPS[id];
    if (group) group.forEach((k) => enabled.add(k));
    else enabled.add(id);
  }
  // Always include getBusinessConfig + checkAvailability (read-only, harmless)
  enabled.add('getBusinessConfig');
  enabled.add('checkAvailability');

  return Object.fromEntries(
    Object.entries(receptionistTools).filter(([k]) => enabled.has(k)),
  ) as typeof receptionistTools;
}

// ─── Main entry point ────────────────────────────────────────────────────

export async function handleAIResponse(input: AIBrainInput): Promise<AIBrainResult> {
  const { businessId, phone, messageText, messageSid, channel = 'whatsapp' } = input;
  const supabase = getSupabase();

  // Note: UltraMsg doesn't support typing indicators via API.
  // The simulateHumanTyping delay in ultramsg.ts handles perceived typing time.

  const phoneWithPlus = phone.startsWith('+') ? phone : `+${phone}`;
  const phoneWithoutPlus = phone.replace(/^\+/, '');

  // ── Parallel fetch: business, customer, history, assistant ──
  const [businessResult, customerResult, history, assistantResult] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', businessId).single(),
    supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
      .single(),
    getConversationHistory(phoneWithoutPlus, businessId),
    supabase
      .from('assistants')
      .select('system_prompt, knowledge_base, tools_enabled, custom_rules, tone, goal')
      .eq('business_id', businessId)
      .eq('active', true)
      .maybeSingle(),
  ]);

  const business = businessResult.data;
  const customer = customerResult.data;
  const assistant = assistantResult?.data;

  // ── Build prompt ──
  const systemPrompt = buildSystemPrompt(assistant, business, customer, phoneWithPlus, businessId);

  // ── Filter tools ──
  const tools = getFilteredTools(assistant?.tools_enabled as string[] | undefined);
  console.log(`   🔧 [ai-brain] Tools: ${Object.keys(tools).join(', ')}`);

  // ── Save user message (fire-and-forget, but await before return) ──
  const saveUserPromise = saveMessage(phoneWithoutPlus, 'user', messageText, businessId).catch(
    (err) => { console.error('[ai-brain] Error saving user message:', err); return null; }
  );

  // ── Call AI (Parallel text gen + intent classification) ──
  const [result, intentCheck] = await Promise.all([
    generateText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages: [...history, { role: 'user' as const, content: messageText }],
      tools,
      // @ts-ignore – maxSteps available in AI SDK 3.1+
      maxSteps: 5,
      toolChoice: 'auto',
    }),
    
    // Smart Followup Check: Is this prospect completely dead?
    generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        isDead: z.boolean().describe("True if prospect explicitly opted out ('stop', 'no'), or gave very brief dead-end replies to a pitch (e.g. 'ok', 'not now') without asking any questions."),
        reason: z.string().describe("Why you classified this as dead or active"),
      }),
      system: "You are a sales intent analyzer. Analyze the recent conversation history to decide if we should completely abort following up with this lead.",
      messages: [...history.slice(-4), { role: 'user' as const, content: messageText }],
    }).catch(err => {
      console.warn('   ⚠️ [ai-brain] Intent check failed:', err);
      return { object: { isDead: false, reason: 'error processing' } };
    })
  ]);

  let aiResponse = result.text || '';
  const allToolCalls = result.steps.flatMap((step) => step.toolCalls || []);

  // ── Handle empty response after tool calls (continuation) ──
  if (!aiResponse && allToolCalls.length > 0) {
    const toolResultsSummary = result.steps
      .flatMap((step) => step.toolResults || [])
      .map((tr) => {
        const t = tr as any;
        return `${t.toolName || 'tool'}: ${JSON.stringify(t.result ?? t.output ?? t)}`;
      })
      .join('\n');

    if (toolResultsSummary) {
      const cont = await generateText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt + '\n\nYou just called tools and got results. Respond to the customer with the data now.',
        messages: [
          ...history,
          { role: 'user' as const, content: messageText },
          { role: 'assistant' as const, content: `Tool results:\n${toolResultsSummary}` },
        ],
      });
      if (cont.text?.trim()) aiResponse = cont.text;
    }
  }

  if (!aiResponse) aiResponse = `Hi! How can I help you?`;

  // ── Concurrency Check: Did the user send another message? ──
  const userMsgId = await saveUserPromise;
  if (userMsgId) {
    const { data: latestUserMsg } = await supabase
      .from('chat_history')
      .select('id')
      .eq('phone', phoneWithoutPlus)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestUserMsg && latestUserMsg.id !== userMsgId) {
      console.log(`   🛑 [ai-brain] User sent another message during generation. Aborting to prevent double-reply.`);
      return { reply: '', toolsCalled: [], skipped: true };
    }
  }

  // ── Send reply via same channel the customer used ──
  // Split multiple lines and send as staggered chat bubbles
  const messagesToSend = aiResponse.split(/\n{2,}/).filter(m => m.trim().length > 0);
  for (const msg of messagesToSend) {
    await sendReply(phoneWithPlus, msg.trim(), channel, businessId);
  }

  // ── Save history ──
  await saveMessage(
    phoneWithoutPlus,
    'assistant',
    aiResponse,
    businessId,
    allToolCalls.length > 0 ? allToolCalls : undefined,
  );

  console.log(`   ✅ [ai-brain] ${aiResponse.length} chars, ${allToolCalls.length} tools`);

  // ── Smart Followup Check Handling ──
  if (intentCheck.object.isDead) {
    console.log(`   🛑 [ai-brain] Prospect marked dead (${intentCheck.object.reason}). Aborting follow-ups.`);
    if (customer?.id) {
      // Fire and forget update so we don't block
      supabase.from('customers').update({ status: 'not_interested' }).eq('id', customer.id).then(({error}) => {
        if (error) console.warn('[ai-brain] Failed to update customer dead status:', error);
      });
    }
  } else {
    // ── Schedule inactivity check — if customer doesn't reply within 24h,
    //    fire user_inactive so automation rules can trigger smart follow-ups ──
    // Skip for prospecting leads — their prospect_found chain already has its
    // own delay-based follow-up sequence. Scheduling user_inactive here would
    // create a parallel chain (exponential QStash messages + spam risk).
    const phoneDigits = phoneWithPlus.replace(/[^\d]/g, '');
    const { count: isProspect } = await supabase
      .from('quote_leads')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('source', 'prospecting')
      .or(`phone.eq.${phoneWithPlus},phone.eq.+${phoneDigits}`);

    if (isProspect && isProspect > 0) {
      console.log(`   ⏭️ [ai-brain] Skipping user_inactive for ${phoneWithPlus} — prospecting lead (own chain handles follow-ups)`);
    } else {
      scheduleInactivityCheck(businessId, phoneWithPlus, channel).catch(err =>
        console.warn('[ai-brain] Failed to schedule inactivity check:', err),
      );
    }
  }

  return {
    reply: aiResponse,
    toolsCalled: allToolCalls.map((tc) => tc.toolName),
  };
}

// ─── Smart Follow-up (called by ai_followup action) ─────────────────────

const FOLLOWUP_SYSTEM_ADDITION = `

══════════════════════════════════════
FOLLOW-UP MODE — CUSTOMER WENT SILENT
══════════════════════════════════════
The customer stopped replying. Your job is to send ONE short follow-up message to re-engage them.

FOLLOWUP_RULES:
- KEEP IT EXTREMELY SHORT (1-2 sentences MAX). Never send a wall of text. It increases the risk of WhatsApp spam bans if they don't reply.
- Use a soft, casual ping to get a reply first. Ask an easy question to elicit a response (e.g. "Hey [Name], still looking into this?").
- Reference the EXACT point where the conversation left off. Be specific.
- If you sent a checkout/signup link and they didn't respond, ask if they had trouble or questions about it.
- If they had a pricing objection, approach it from a DIFFERENT angle than before.
- NEVER start with "Just following up" or "Just checking in" — be creative and specific.
- NEVER repeat a message you already sent — check the conversation history.
- If you've already sent 3+ unanswered follow-ups, make it a warm final check-in and provide an opt-out (e.g., "Reply STOP and I'll close out your file").
- Match the tone and energy of the rest of the conversation.
`;

export interface AIFollowupInput {
  businessId: string;
  phone: string;
  channel?: string;
}

export interface AIFollowupResult {
  reply: string;
  toolsCalled: string[];
  skipped?: boolean;
  skipReason?: string;
}

export async function handleAIFollowup(input: AIFollowupInput): Promise<AIFollowupResult> {
  const { businessId, phone, channel = 'whatsapp' } = input;
  const supabase = getSupabase();

  const phoneWithPlus = phone.startsWith('+') ? phone : `+${phone}`;
  const phoneWithoutPlus = phone.replace(/^\+/, '');

  // ── Parallel fetch ──
  const [businessResult, customerResult, history, assistantResult] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', businessId).single(),
    supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
      .single(),
    getConversationHistory(phoneWithoutPlus, businessId),
    supabase
      .from('assistants')
      .select('system_prompt, knowledge_base, tools_enabled, custom_rules, tone, goal')
      .eq('business_id', businessId)
      .eq('active', true)
      .maybeSingle(),
  ]);

  const business = businessResult.data;
  const customer = customerResult.data;
  const assistant = assistantResult?.data;

  // ── Count consecutive unanswered assistant messages ──
  let unansweredCount = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') unansweredCount++;
    else break;
  }

  // ── Safety: abort if user just replied or if max reached ──
  if (unansweredCount === 0) {
    console.log(`   🛑 [ai-followup] ${phoneWithPlus} replied recently (${unansweredCount} unanswered) — skipping`);
    return { reply: '', toolsCalled: [], skipped: true, skipReason: 'User replied recently' };
  }
  
  // ── Safety: stop after 5 unanswered follow-ups ──
  if (unansweredCount >= 5) {
    console.log(`   🛑 [ai-followup] ${phoneWithPlus} has ${unansweredCount} unanswered msgs — skipping`);
    return { reply: '', toolsCalled: [], skipped: true, skipReason: `${unansweredCount} unanswered messages — stopped` };
  }

  // ── Build prompt with follow-up instructions ──
  const basePrompt = buildSystemPrompt(assistant, business, customer, phoneWithPlus, businessId);
  const systemPrompt = basePrompt + FOLLOWUP_SYSTEM_ADDITION +
    `\nUNANSWERED FOLLOW-UPS ALREADY SENT: ${unansweredCount}\n`;

  // ── Filter tools (same as regular chat) ──
  const tools = getFilteredTools(assistant?.tools_enabled as string[] | undefined);

  // ── Generate follow-up using full conversation history ──
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages: [...history, { role: 'user' as const, content: '[SYSTEM: The customer has been inactive. Generate a follow-up message.]' }],
    tools,
    // @ts-ignore
    maxSteps: 5,
    toolChoice: 'auto',
  });

  let aiResponse = result.text || '';
  const allToolCalls = result.steps.flatMap((step) => step.toolCalls || []);

  if (!aiResponse && allToolCalls.length > 0) {
    const toolResultsSummary = result.steps
      .flatMap((step) => step.toolResults || [])
      .map((tr) => {
        const t = tr as any;
        return `${t.toolName || 'tool'}: ${JSON.stringify(t.result ?? t.output ?? t)}`;
      })
      .join('\n');

    if (toolResultsSummary) {
      const cont = await generateText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt + '\n\nYou just called tools. Now send the follow-up message to re-engage the customer.',
        messages: [
          ...history,
          { role: 'assistant' as const, content: `Tool results:\n${toolResultsSummary}` },
        ],
      });
      if (cont.text?.trim()) aiResponse = cont.text;
    }
  }

  if (!aiResponse) return { reply: '', toolsCalled: [], skipped: true, skipReason: 'AI generated empty response' };

  // ── Send via correct channel ──
  // Split multiple lines and send as staggered chat bubbles
  const messagesToSend = aiResponse.split(/\n{2,}/).filter(m => m.trim().length > 0);
  for (const msg of messagesToSend) {
    await sendReply(phoneWithPlus, msg.trim(), channel, businessId);
  }

  // ── Save to history (no user message to save — this is a follow-up) ──
  await saveMessage(
    phoneWithoutPlus,
    'assistant',
    aiResponse,
    businessId,
    allToolCalls.length > 0 ? allToolCalls : undefined,
  );

  console.log(`   ✅ [ai-followup] Sent to ${phoneWithPlus} via ${channel} (${aiResponse.length} chars, ${unansweredCount + 1} total unanswered)`);

  // We DO NOT schedule another inactivity check here.
  // The visual Rule Engine (Launchfly UI) is now responsible for scheduling
  // multi-step drip sequences using "Wait / Delay" blocks.
  // Auto-looping here would cause exponential firing when combined with UI Wait blocks.

  return {
    reply: aiResponse,
    toolsCalled: allToolCalls.map((tc) => tc.toolName),
  };
}

// ─── Inactivity Scheduler ────────────────────────────────────────────────
// Schedules a user_inactive event via QStash 24h from now.
// The trigger endpoint will only fire if the customer hasn't replied since.

async function scheduleInactivityCheck(
  businessId: string,
  phone: string,
  channel: string,
): Promise<void> {
  const qstashToken = process.env.QSTASH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.launchfly.ai';
  if (!qstashToken) return; // Dev environment — skip silently

  const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io';
  const targetUrl = `${appUrl}/api/assistants/trigger?businessId=${businessId}`;
  const delaySeconds = 24 * 60 * 60; // 24 hours

  const res = await fetch(`${qstashBase}/v2/publish/${targetUrl}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${qstashToken}`,
      'Content-Type': 'application/json',
      'Upstash-Delay': `${delaySeconds}s`,
      'Upstash-Retries': '1',
    },
    body: JSON.stringify({
      event: 'user_inactive',
      phone,
      metadata: { channel, scheduledAt: new Date().toISOString() },
    }),
  });

  if (res.ok) {
    console.log(`   ⏰ [ai-brain] Scheduled user_inactive for ${phone} in 24h`);
  } else {
    console.warn(`   ⚠️ [ai-brain] Failed to schedule user_inactive: ${res.status}`);
  }
}
