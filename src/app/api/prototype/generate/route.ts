// POST /api/prototype/generate
// Streams a real AI-generated business blueprint over SSE.
// Powers the public landing-page prototype (public/start.html).
// No auth — protected by input validation + a light per-IP rate limit.

import { streamObject } from 'ai';
import { z } from 'zod';
import { deepseek, CHAT_MODEL } from '@/lib/ai-provider';

export const runtime = 'nodejs';
export const maxDuration = 60;

const businessSchema = z.object({
  positioning: z.object({
    niche: z.string().describe('Specific niche, max 8 words'),
    audience: z.string().describe('Who exactly this serves, max 12 words'),
    angle: z.string().describe('The sharp differentiating angle, one sentence'),
  }),
  brand: z.object({
    name: z.string().describe('Short brandable business name, 1-2 words, no "AI" cliches'),
    tagline: z.string().describe('Punchy tagline, max 8 words'),
  }),
  offer: z.object({
    productName: z.string().describe('Name of the core product or service package'),
    format: z.string().describe('Delivery format, e.g. "6-week program", "monthly service plan"'),
    price: z.number().describe('Realistic launch price in USD'),
    bullets: z.array(z.string()).describe('Exactly 3 concrete outcomes the buyer gets'),
  }),
  landing: z.object({
    headline: z.string().describe('Landing page headline, benefit-led, max 10 words'),
    subheadline: z.string().describe('Supporting subheadline, one sentence'),
    cta: z.string().describe('Button text, max 4 words'),
  }),
  launchPlan: z.array(
    z.object({
      day: z.number().describe('Day number 1-7'),
      action: z.string().describe('One specific, doable action'),
      channel: z.string().describe('Where: e.g. Instagram, email, local groups'),
    })
  ).describe('Exactly 5 actions across the first 7 days'),
});

export type PrototypeBusiness = z.infer<typeof businessSchema>;

// Light in-memory rate limit. Resets on cold start — fine for a prototype.
const RATE_LIMIT = 8;
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return Response.json(
      { error: 'The agents are offline right now. Please try again later.' },
      { status: 503 }
    );
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return Response.json(
      { error: 'You have hit the free limit for now. Try again in an hour.' },
      { status: 429 }
    );
  }

  let idea = '';
  let mode: 'new' | 'existing' = 'new';
  try {
    const body = await request.json();
    idea = String(body.idea || '').trim();
    if (body.mode === 'existing') mode = 'existing';
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (idea.length < 3 || idea.length > 300) {
    return Response.json(
      { error: 'Tell us a bit about your skill or business (3-300 characters).' },
      { status: 400 }
    );
  }

  const system =
    mode === 'existing'
      ? `You are Launchfly's business-building agent team. The user already runs a business. Reposition it for growth: sharpen the niche, keep the brand name close to what they describe (or improve it slightly), design the strongest productized offer from what they already do, and plan a realistic first week of growth actions they can execute with zero budget. Be specific and practical — no hype, no invented metrics.`
      : `You are Launchfly's business-building agent team. The user wants to start a business from a skill or idea. Design a lean online business around it: a specific niche, a brandable name, one concrete paid offer at a realistic price, landing page copy, and a realistic first week of launch actions with zero budget. Be specific and practical — no hype, no invented metrics.`;

  const result = streamObject({
    // .chat() forces the chat-completions API — DeepSeek does not support /responses
    model: deepseek.chat(CHAT_MODEL),
    schema: businessSchema,
    system,
    prompt: `User input: "${idea}"`,
    maxOutputTokens: 1400,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let lastSent = 0;
        for await (const partial of result.partialObjectStream) {
          // Throttle SSE frames to ~8/sec to keep payloads light
          const now = Date.now();
          if (now - lastSent < 120) continue;
          lastSent = now;
          controller.enqueue(encoder.encode(sse({ type: 'partial', business: partial })));
        }
        const business = await result.object;
        controller.enqueue(encoder.encode(sse({ type: 'done', business })));
      } catch (err) {
        console.error('[prototype/generate] stream error:', err);
        controller.enqueue(
          encoder.encode(
            sse({ type: 'error', message: 'The agents hit a snag. Please try again.' })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
