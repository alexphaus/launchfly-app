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

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { receptionistTools } from '@/lib/ai-receptionist/tools';
import {
  getConversationHistory,
  saveMessage,
} from '@/lib/ai-receptionist/history';
import { sendTypingIndicator } from '@/lib/whatsapp-push';

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
}

// ─── Send helpers ────────────────────────────────────────────────────────

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const { sendWhatsApp: ultramsgSend } = await import('@/lib/ultramsg');
  const result = await ultramsgSend(to, body);
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

async function sendReply(to: string, body: string, channel: string): Promise<void> {
  if (channel === 'sms') {
    await sendSms(to, body);
  } else {
    await sendWhatsApp(to, body);
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
  // ── If custom prompt is set, use it directly ──
  if (assistant?.system_prompt) {
    // Still inject dynamic context the custom prompt can reference
    return assistant.system_prompt + contextBlock(phone, businessId, customer, business);
  }

  // ── Auto-generate a minimal prompt from config ──
  const bizName = business?.name || 'the business';
  const config = (business?.business_data || {}) as Record<string, any>;
  const tone = assistant?.tone || 'friendly';
  const goal = assistant?.goal || 'book_consultation';

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  let prompt = `You are the AI assistant for **${bizName}**.
Today is ${today}. You communicate via WhatsApp — keep messages SHORT (under 200 words).

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

  // Typing indicator (fire-and-forget)
  if (messageSid) {
    sendTypingIndicator(messageSid).catch(() => {});
  }

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
    (err) => console.error('[ai-brain] Error saving user message:', err),
  );

  // ── Call AI ──
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages: [...history, { role: 'user' as const, content: messageText }],
    tools,
    // @ts-ignore – maxSteps available in AI SDK 3.1+
    maxSteps: 5,
    toolChoice: 'auto',
  });

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

  // ── Send reply via same channel the customer used ──
  await sendReply(phoneWithPlus, aiResponse, channel);

  // ── Save history ──
  await saveUserPromise;
  await saveMessage(
    phoneWithoutPlus,
    'assistant',
    aiResponse,
    businessId,
    allToolCalls.length > 0 ? allToolCalls : undefined,
  );

  console.log(`   ✅ [ai-brain] ${aiResponse.length} chars, ${allToolCalls.length} tools`);

  // ── Schedule inactivity check — if customer doesn't reply within 24h,
  //    fire user_inactive so automation rules can trigger smart follow-ups ──
  scheduleInactivityCheck(businessId, phoneWithPlus, channel).catch(err =>
    console.warn('[ai-brain] Failed to schedule inactivity check:', err),
  );

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

FOLLOW-UP RULES:
- Reference the EXACT point where the conversation left off. Be specific.
- If you sent a checkout/signup link and they didn't respond, ask if they had trouble or questions about it.
- If they were mid-demo or mid-conversation, casually nudge them to continue.
- If they had a pricing objection, approach it from a DIFFERENT angle than before.
- Keep it to 1-3 sentences MAX. Casual, warm, never desperate.
- NEVER start with "Just following up" or "Just checking in" — be creative and specific.
- NEVER repeat a message you already sent — check the conversation history.
- If you've already sent 3+ unanswered follow-ups, make it a warm final check-in and mention you'll stop messaging.
- Use the customer's name if you know it.
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
  await sendReply(phoneWithPlus, aiResponse, channel);

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
