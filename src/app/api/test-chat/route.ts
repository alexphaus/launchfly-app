// src/app/api/test-chat/route.ts
// Direct chat API for testing the AI brain without UltraMsg
// Messages go through the same AI pipeline but responses come back as JSON instead of WhatsApp

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  getConversationHistory,
  saveMessage,
} from '@/lib/ai-receptionist/history';
import { receptionistTools } from '@/lib/ai-receptionist/tools';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

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

const TOOL_GROUPS: Record<string, string[]> = {
  book_calendar: ['createBooking', 'rescheduleBooking', 'cancelBooking', 'getCustomerBookings', 'getAvailableSlots'],
  lookup_customer: ['lookupCustomer', 'updateCustomer'],
  transfer_to_human: ['notifyOwner'],
  send_checkout_link: ['calculatePrice', 'generateCheckoutLink'],
  warranty: ['activateWarranty', 'saveFeedback', 'saveReferral'],
};

function getFilteredTools(toolsConfig: string[] | undefined) {
  if (!toolsConfig?.length) return receptionistTools;
  const enabled = new Set<string>();
  for (const id of toolsConfig) {
    const group = TOOL_GROUPS[id];
    if (group) group.forEach((k) => enabled.add(k));
    else enabled.add(id);
  }
  enabled.add('getBusinessConfig');
  enabled.add('checkAvailability');
  return Object.fromEntries(
    Object.entries(receptionistTools).filter(([k]) => enabled.has(k)),
  ) as typeof receptionistTools;
}

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

  if (assistant?.system_prompt) {
    return baseRules + '\n\n' + assistant.system_prompt + contextBlock(phone, businessId, customer, business);
  }

  const config = (business?.business_data || {}) as Record<string, any>;
  const tone = assistant?.tone || 'friendly';
  const goal = assistant?.goal || 'book_consultation';

  let prompt = `You are the AI assistant for **${bizName}**.
${baseRules}
TONE: ${TONE_LABELS[tone] || tone}
GOAL: ${GOAL_LABELS[goal] || goal}
BUSINESS: ${bizName}
`;

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

  if (assistant?.custom_rules?.length) {
    prompt += '\n\nRULES:\n' + (assistant.custom_rules as string[]).map((r: string) => `- ${r}`).join('\n');
  }

  prompt += contextBlock(phone, businessId, customer, business);
  return prompt;
}

function contextBlock(
  phone: string,
  businessId: string,
  customer: Record<string, any> | null,
  business: Record<string, any> | null,
): string {
  const ownerPhone = business?.whatsapp_number || business?.phone_number || '';
  return `\n[CONTEXT]\nCustomer phone: ${phone}\nBusiness ID: ${businessId}\nCustomer name: ${customer?.name || 'unknown'}\nOwner phone: ${ownerPhone}\n`;
}

export async function POST(request: NextRequest) {
  try {
    const { message, phone, businessId } = await request.json();

    if (!message || !businessId) {
      return NextResponse.json({ error: 'message and businessId required' }, { status: 400 });
    }

    const testPhone = phone || 'test-chat-user';
    const supabase = getSupabase();

    const [businessResult, customerResult, history, assistantResult] = await Promise.all([
      supabase.from('businesses').select('*').eq('id', businessId).single(),
      supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .or(`phone.eq.${testPhone},phone.eq.+${testPhone}`)
        .maybeSingle(),
      getConversationHistory(testPhone, businessId),
      supabase
        .from('assistants')
        .select('system_prompt, knowledge_base, tools_enabled, custom_rules, tone, goal')
        .eq('business_id', businessId)
        .eq('active', true)
        .neq('name', 'Purchasing OS')
        .limit(1)
        .maybeSingle(),
    ]);

    const business = businessResult.data;
    const customer = customerResult.data;
    const assistant = assistantResult?.data;

    const systemPrompt = buildSystemPrompt(assistant, business, customer, testPhone, businessId);
    const tools = getFilteredTools(assistant?.tools_enabled as string[] | undefined);

    // Save user message
    await saveMessage(testPhone, 'user', message, businessId);

    // Generate AI response
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages: [...history, { role: 'user' as const, content: message }],
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
          system: systemPrompt + '\n\nYou just called tools. Respond with the data now.',
          messages: [
            ...history,
            { role: 'user' as const, content: message },
            { role: 'assistant' as const, content: `Tool results:\n${toolResultsSummary}` },
          ],
        });
        if (cont.text?.trim()) aiResponse = cont.text;
      }
    }

    if (!aiResponse) aiResponse = 'hey, how can i help?';

    // Save assistant response
    await saveMessage(testPhone, 'assistant', aiResponse, businessId, allToolCalls.length > 0 ? allToolCalls : undefined);

    // Split into multiple bubbles (same logic as production)
    const bubbles = aiResponse.split(/\n{2,}/).filter(m => m.trim().length > 0);

    return NextResponse.json({
      reply: aiResponse,
      bubbles,
      toolsCalled: allToolCalls.map((tc) => tc.toolName),
    });
  } catch (error) {
    console.error('Test chat error:', error);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}

// Clear chat history for test phone
export async function DELETE(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId');
  const phone = request.nextUrl.searchParams.get('phone') || 'test-chat-user';
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

  const supabase = getSupabase();
  await supabase.from('chat_history').delete().eq('phone', phone).eq('business_id', businessId);
  return NextResponse.json({ ok: true });
}