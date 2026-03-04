// src/lib/quote-followup/openai.ts
// ─── OpenAI negotiation helper for WhatsApp chatbot ───

import OpenAI from 'openai';
import type { ChatMessage } from './types';

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');
  return new OpenAI({ apiKey: key });
}

/** Default prompt — overridden by buildNegotiationPrompt when contractor info available */
const DEFAULT_SYSTEM_PROMPT = `You are a friendly, professional follow-up assistant for a home service contractor.
Your job is to answer the homeowner's questions about their recent quote, overcome objections politely, and guide them toward booking the job by paying a deposit.

Rules:
- Be warm but concise. Keep replies under 160 words.
- If the customer raises a price objection, acknowledge it, explain the value (quality materials, warranty, licensed crew), and offer a small gesture (e.g., free add-on) but do NOT discount the price without approval.
- If the customer asks to speak to the contractor directly, say you'll have them call back shortly and mark the intent as "escalate".
- If the customer says a keyword like "deposit", "pay", "book", or "let's do it", respond positively and tell them you'll send a secure payment link.
- Never make up facts about the project scope. Stick to the information provided.
- Always sign off messages as the contractor's team.`;

/** Build a business-aware negotiation prompt */
export function buildNegotiationPrompt(opts?: {
  contractorName?: string;
  businessName?: string;
  niche?: string;
}): string {
  if (!opts?.businessName) return DEFAULT_SYSTEM_PROMPT;

  return `You are a friendly, professional follow-up assistant for *${opts.businessName}*${opts.niche ? ` (${opts.niche})` : ''}.
Your job is to answer the homeowner's questions about their recent quote, overcome objections politely, and guide them toward booking the job by paying a deposit.

Rules:
- Be warm but concise. Keep replies under 160 words.
- Refer to the business as "${opts.businessName}" and the owner as "${opts.contractorName || 'the team'}".
- If the customer raises a price objection, acknowledge it, explain the value (quality materials, warranty, licensed crew), and offer a small gesture (e.g., free add-on or priority scheduling) but do NOT discount the price without approval.
- If the customer asks to speak to the contractor directly, say you'll have ${opts.contractorName || 'someone from the team'} call back shortly and mark the intent as "escalate".
- If the customer says a keyword like "deposit", "pay", "book", or "let's do it", respond positively and tell them you'll send a secure payment link.
- When handling "too expensive" objections, try the crew-in-neighborhood angle: "If we could schedule you this week when our crew is already in your area, we could save on logistics — would that help?"
- Never make up facts about the project scope. Stick to the information provided.
- Always sign off messages as the ${opts.businessName} team.`;
}

export interface NegotiationResult {
  reply: string;
  intent: 'continue' | 'deposit' | 'escalate' | 'lost';
}

/**
 * Given the conversation history and the lead context, produce the next
 * assistant reply and a detected intent.
 */
export async function negotiate(opts: {
  customerName: string;
  quoteAmount: number;
  jobType: string;
  history: ChatMessage[];
  latestMessage: string;
  contractorName?: string;
  businessName?: string;
  niche?: string;
  currency?: string;
}): Promise<NegotiationResult> {
  const openai = getOpenAI();

  const systemPrompt = buildNegotiationPrompt({
    contractorName: opts.contractorName,
    businessName: opts.businessName,
    niche: opts.niche,
  });

  const cur = opts.currency || '$';
  const contextMessage = `Context — Customer: ${opts.customerName}, Quote: ${cur}${opts.quoteAmount.toLocaleString()}, Job: ${opts.jobType}`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: contextMessage },
    ...opts.history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: opts.latestMessage },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 300,
    messages,
  });

  const reply = response.choices[0]?.message?.content?.trim() ?? '';

  // Detect intent from the user's latest message
  const lower = opts.latestMessage.toLowerCase();
  let intent: NegotiationResult['intent'] = 'continue';

  if (/\b(deposit|pay|book|let'?s do it|ready to start|sign me up)\b/.test(lower)) {
    intent = 'deposit';
  } else if (/\b(speak to|call me|talk to someone|manager|owner)\b/.test(lower)) {
    intent = 'escalate';
  } else if (/\b(not interested|no thanks|pass|cancel|too expensive|never mind)\b/.test(lower)) {
    intent = 'lost';
  }

  return { reply, intent };
}
