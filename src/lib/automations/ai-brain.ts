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
}

export interface AIBrainResult {
  reply: string;
  toolsCalled: string[];
}

// ─── Twilio send helper ──────────────────────────────────────────────────

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const twilio = (await import('twilio')).default;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const from =
    process.env.TWILIO_WHATSAPP_FROM ||
    (process.env.TWILIO_WHATSAPP_NUMBER
      ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`
      : '');
  if (!from) throw new Error('Missing TWILIO_WHATSAPP_FROM or TWILIO_WHATSAPP_NUMBER');
  await client.messages.create({
    from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    body,
  });
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
  send_checkout_link: ['calculatePrice'],
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
  const { businessId, phone, messageText, messageSid } = input;
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

  // ── Send reply ──
  await sendWhatsApp(phoneWithPlus, aiResponse);

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

  return {
    reply: aiResponse,
    toolsCalled: allToolCalls.map((tc) => tc.toolName),
  };
}
