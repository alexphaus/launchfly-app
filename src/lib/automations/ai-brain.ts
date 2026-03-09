// src/lib/automations/ai-brain.ts
// ═══════════════════════════════════════════════════════════════════════════
// AI Response Brain — extracted from v2 webhook into a standalone module.
//
// Called by: executor.ts (ai_response action), or directly.
//
// Responsibilities:
//  1. Load business + customer + assistant config from DB
//  2. Build system prompt (custom or generated)
//  3. Append knowledge base, custom rules, context instructions
//  4. Filter tools by assistant config
//  5. Call OpenAI (generateText with tools)
//  6. Handle empty/filler responses (continuation)
//  7. Run guardrails (hallucination detection, booking retries)
//  8. Send WhatsApp reply
//  9. Save chat_history
// ═══════════════════════════════════════════════════════════════════════════

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { receptionistTools } from '@/lib/ai-receptionist/tools';
import {
  generateSystemPrompt,
  type BusinessContext,
  type CustomerContext,
} from '@/lib/ai-receptionist/system-prompt';
import {
  getConversationHistory,
  saveMessage,
} from '@/lib/ai-receptionist/history';
import { sendTypingIndicator, sendJobConfirmed } from '@/lib/whatsapp-push';
import { Guardrails } from '@/lib/ai-receptionist/guardrails';

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

  // ── Build BusinessContext ──
  let businessContext: BusinessContext | null = null;
  let customerContext: CustomerContext | null = null;

  if (business) {
    const config = (business.business_data || {}) as Record<string, any>;
    businessContext = {
      id: business.id,
      name: business.name,
      niche: config.niche || 'General Service',
      currency: config.currency || 'RM',
      cleaningPrice: config.cleaningPrice || 120,
      repairInspectionFee: config.repairInspectionFee || 80,
      warrantyDays: config.warrantyDays || 30,
      serviceInterval: config.serviceInterval || 180,
      ownerName: config.ownerName,
      ownerPhone: business.whatsapp_number || business.phone_number,
      operatingHours: config.operatingHours,
      googleReviewLink: config.googleReviewLink,
      serviceLabels: config.serviceLabels,
      customRules: config.customRules,
    };
  }

  if (customer) {
    const warrantyEnd = customer.warranty_end_date ? new Date(customer.warranty_end_date) : null;
    customerContext = {
      id: customer.id,
      name: customer.name || customer.first_name,
      isReturning: true,
      warrantyActive: warrantyEnd ? warrantyEnd > new Date() : false,
      warrantyEndDate: warrantyEnd?.toLocaleDateString('en-GB') || undefined,
      lastServiceDate: customer.last_service_date,
      lastServiceType: customer.last_service_type,
      address: customer.address,
      status: customer.status,
      lastInteractionContext: customer.last_interaction_context,
    };
  } else {
    customerContext = { isReturning: false, warrantyActive: false };
  }

  // ── Build system prompt ──
  let systemPrompt: string;

  if (assistant?.system_prompt) {
    systemPrompt = assistant.system_prompt;
    console.log('   🤖 [ai-brain] Using custom system prompt from assistants table');
  } else {
    systemPrompt = generateSystemPrompt(
      businessContext!,
      customerContext || undefined,
      {
        tone: (assistant?.tone as string) || undefined,
        goal: (assistant?.goal as string) || undefined,
      },
    );
  }

  // ── Append knowledge base ──
  if (assistant?.knowledge_base) {
    const kb = assistant.knowledge_base as {
      pricing?: Array<{ service: string; price: string; unit: string }>;
      faq?: Array<{ q: string; a: string }>;
      objections?: Array<{ trigger: string; response: string }>;
    };
    const kbLines: string[] = [];
    if (kb.pricing?.length) {
      kbLines.push('\n[PRICING KNOWLEDGE BASE]');
      kb.pricing.forEach((p) => kbLines.push(`- ${p.service}: ${p.price} per ${p.unit}`));
    }
    if (kb.faq?.length) {
      kbLines.push('\n[FAQ KNOWLEDGE BASE]');
      kb.faq.forEach((f) => kbLines.push(`Q: ${f.q}\nA: ${f.a}`));
    }
    if (kb.objections?.length) {
      kbLines.push('\n[OBJECTION HANDLING]');
      kb.objections.forEach((o) =>
        kbLines.push(`When customer says "${o.trigger}" → respond: ${o.response}`),
      );
    }
    if (kbLines.length > 0) systemPrompt += '\n' + kbLines.join('\n');
  }

  // ── Append custom rules ──
  if (assistant?.custom_rules?.length) {
    systemPrompt +=
      '\n\n[CUSTOM BUSINESS RULES]\n' +
      (assistant.custom_rules as string[]).map((r: string) => `- ${r}`).join('\n');
  }

  // ── Context message for tool usage ──
  const contextMessage = `
[SYSTEM CONTEXT - USE THESE VALUES WHEN CALLING TOOLS]
- Customer Phone: ${phoneWithPlus}
- Business ID: ${businessId}
- Customer ID: ${customerContext?.id || ''}
- Customer Name: ${customerContext?.name || 'unknown'}

When calling activateWarranty, use:
  businessId: "${businessId}"
  phone: "${phoneWithPlus}"
  name: (the name the customer provided)
  serviceType: "cleaning"

When calling getAvailableSlots, use:
  businessId: "${businessId}"

When calling notifyOwner (for complaints/human request/escalation), use:
  ownerPhone: "${businessContext?.ownerPhone || ''}"
  message: (summary of the issue and customer phone)

⚠️ CRITICAL: When customer selects a time slot, call createBooking IMMEDIATELY.
⚠️ VERIFICATION RULE: Before saying "Done"/"Confirmed", verify you actually called the tool!
`;

  // ── Filter tools by assistant config ──
  const TOOL_GROUPS: Record<string, string[]> = {
    book_calendar: ['createBooking', 'rescheduleBooking', 'cancelBooking', 'getCustomerBookings', 'getAvailableSlots'],
    lookup_customer: ['lookupCustomer', 'updateCustomer'],
    transfer_to_human: ['notifyOwner'],
    send_checkout_link: ['calculatePrice'],
  };
  const CORE_TOOLS = ['getBusinessConfig', 'checkAvailability', 'activateWarranty', 'saveFeedback', 'saveReferral'];

  const enabledToolKeys = new Set(CORE_TOOLS);
  const toolsConfig = assistant?.tools_enabled as string[] | undefined;
  if (toolsConfig?.length) {
    for (const featureId of toolsConfig) {
      const group = TOOL_GROUPS[featureId];
      if (group) group.forEach((k) => enabledToolKeys.add(k));
      else enabledToolKeys.add(featureId);
    }
  } else {
    Object.keys(receptionistTools).forEach((k) => enabledToolKeys.add(k));
  }

  const filteredTools = Object.fromEntries(
    Object.entries(receptionistTools).filter(([k]) => enabledToolKeys.has(k)),
  ) as typeof receptionistTools;

  console.log(`   🔧 [ai-brain] Tools: ${Object.keys(filteredTools).join(', ')}`);

  // ── Save user message (fire-and-forget, but track promise) ──
  const saveUserPromise = saveMessage(phoneWithoutPlus, 'user', messageText, businessId).catch(
    (err) => console.error('[ai-brain] Error saving user message:', err),
  );

  // ── Call OpenAI ──
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt + `\n\n${contextMessage}`,
    messages: [...history, { role: 'user' as const, content: messageText }],
    tools: filteredTools,
    // @ts-ignore – maxSteps available in AI SDK 3.1+
    maxSteps: 5,
    toolChoice: 'auto',
  });

  let aiResponse = result.text || '';
  const allToolCalls = result.steps.flatMap((step) => step.toolCalls || []);

  // ── Handle empty / filler response after tool calls ──
  const isFiller =
    aiResponse &&
    aiResponse.length < 200 &&
    (aiResponse.toLowerCase().includes('moment') ||
      aiResponse.toLowerCase().includes('checking') ||
      aiResponse.toLowerCase().includes('bear with me') ||
      aiResponse.toLowerCase().includes('hold on'));

  // notifyOwner with no response
  const calledNotifyOwner = allToolCalls.some((tc) => tc.toolName === 'notifyOwner');
  if (calledNotifyOwner && (!aiResponse || aiResponse.length < 20)) {
    const ownerName = businessContext?.ownerName || 'the owner';
    aiResponse = `I've notified ${ownerName} about your request - they'll reach out to you shortly. 🙏 Is there anything else I can help with in the meantime?`;
  }

  if ((!aiResponse || isFiller) && allToolCalls.length > 0) {
    const toolResultsSummary = result.steps
      .flatMap((step) => step.toolResults || [])
      .map((tr) => {
        const toolResult = tr as any;
        const actualResult = toolResult.result ?? toolResult.output ?? toolResult;
        return `Tool ${toolResult.toolName || 'tool'}: ${JSON.stringify(actualResult)}`;
      })
      .join('\n');

    if (toolResultsSummary && !toolResultsSummary.includes('{}')) {
      const continuationResult = await generateText({
        model: openai('gpt-4o-mini'),
        system:
          systemPrompt +
          `\n\nSYSTEM UPDATE: You just called a tool and got results. DO NOT say "I'll check". The check is DONE. Respond with the data now.`,
        messages: [
          ...history,
          { role: 'user' as const, content: messageText },
          {
            role: 'assistant' as const,
            content: `I have executed the tools. Here are the results:\n${toolResultsSummary}\n\nBased on this, the final response to the customer is:`,
          },
        ],
      });
      if (continuationResult.text?.trim()) {
        aiResponse = continuationResult.text;
      }
    }
  }

  if (!aiResponse) aiResponse = 'Hi! How can I help you today?';

  // ── Guardrails ──
  let bookingToolFailed = false;
  let bookingToolError = '';
  for (const step of result.steps) {
    for (const toolResult of step.toolResults || []) {
      const tr = toolResult as any;
      const res = tr.output ?? tr.result;
      if (
        (tr.toolName === 'createBooking' || tr.toolName === 'rescheduleBooking') &&
        res?.success === false
      ) {
        bookingToolFailed = true;
        bookingToolError = res.error || 'Unknown error';
      }
    }
  }

  const { isHallucinating: claimsBooking } = Guardrails.detectHallucination(aiResponse, allToolCalls);
  const actuallyCalledBookingTool = allToolCalls.some(
    (tc) => tc.toolName === 'createBooking' || tc.toolName === 'rescheduleBooking',
  );

  // Override if tool failed but AI claims success
  if (bookingToolFailed && claimsBooking) {
    aiResponse = `It seems there was an issue with your booking. ${
      bookingToolError.includes('not found')
        ? 'Would you like me to create a new booking for you instead?'
        : 'Please try again or reply "HUMAN" to speak with the owner.'
    }`;
  }

  // Hallucination without any tool call → force retry
  if (claimsBooking && !actuallyCalledBookingTool) {
    console.warn('[ai-brain] Hallucination detected — retrying with tool enforcement');
    const retryResult = await generateText({
      model: openai('gpt-4o-mini'),
      system:
        systemPrompt +
        `\n\nSYSTEM ALERT: You claimed to have booked/rescheduled but did NOT call the tool. Call createBooking or rescheduleBooking NOW.`,
      messages: [...history.slice(-20), { role: 'user' as const, content: messageText }],
      tools: receptionistTools,
      toolChoice: 'required',
    });
    const retryToolCalls = retryResult.steps.flatMap((step) => step.toolCalls || []);
    if (retryToolCalls.length > 0) {
      aiResponse = retryResult.text || aiResponse;
      allToolCalls.push(...retryToolCalls);
      retryResult.steps.forEach((step) => result.steps.push(step));
    } else {
      aiResponse =
        "I apologize, I'm having trouble accessing the booking calendar right now. Please try again or reply 'HUMAN' to speak with the owner.";
    }
  }

  // ── Handle tool-result notifications (owner alerts for bookings/cancellations) ──
  const fromNum =
    process.env.TWILIO_WHATSAPP_FROM ||
    (process.env.TWILIO_WHATSAPP_NUMBER
      ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`
      : '');

  for (const step of result.steps) {
    for (const toolResult of step.toolResults || []) {
      const tr = toolResult as any;
      const res = tr.output ?? tr.result;
      const toolName = tr.toolName;

      // notifyOwner — plain text alert
      if (res?.action === 'notify_owner' && res?.phone) {
        sendWhatsApp(res.phone, res.message || 'Notification from AI Receptionist').catch(() => {});
      }

      // createBooking success → notify owner via template
      if (toolName === 'createBooking' && res?.success && res?.ownerPhone) {
        sendJobConfirmed(res.ownerPhone, {
          id: res.bookingId?.substring(0, 8).toUpperCase() || 'NEW',
          serviceName: res.serviceType || businessContext?.niche || 'Service',
          serviceEmoji: '🔧',
          timeSlot: res.slotLabel || 'As scheduled',
          address: res.address || 'Address provided',
          customerName: res.customerName || customerContext?.name || 'Customer',
          customerPhone: res.customerPhone || phoneWithPlus,
          estimate: res.estimate,
        }).catch(() => {});
      }

      // cancelBooking → alert owner
      if (toolName === 'cancelBooking' && res?.success && businessContext?.ownerPhone) {
        sendWhatsApp(
          businessContext.ownerPhone,
          `🔴 *JOB CANCELLED*\n\n👤 ${res.customerName || 'Customer'}\n🗓️ Slot: ${res.slotLabel || 'Unknown'}\n⚠️ Please check dashboard.`,
        ).catch(() => {});
      }

      // rescheduleBooking → alert owner
      if (toolName === 'rescheduleBooking' && res?.success && businessContext?.ownerPhone) {
        sendWhatsApp(
          businessContext.ownerPhone,
          `🔄 *JOB RESCHEDULED*\n\n👤 ${res.customerName || 'Customer'}\n🗓️ NEW: ${res.newSlotLabel || 'New slot'}\n⚠️ Please check dashboard.`,
        ).catch(() => {});
      }
    }
  }

  // ── Send reply to customer ──
  await sendWhatsApp(phoneWithPlus, aiResponse);

  // ── Save to chat_history ──
  await saveUserPromise;
  await saveMessage(
    phoneWithoutPlus,
    'assistant',
    aiResponse,
    businessId,
    allToolCalls.length > 0 ? allToolCalls : undefined,
  );

  console.log(
    `   ✅ [ai-brain] Response sent (${aiResponse.length} chars, ${allToolCalls.length} tools)`,
  );

  return {
    reply: aiResponse,
    toolsCalled: allToolCalls.map((tc) => tc.toolName),
  };
}
