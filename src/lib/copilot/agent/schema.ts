// src/lib/copilot/agent/schema.ts
// Prompt + output normalisation shared by the LLM and webhook agents.
// We do not trust agent output: everything is coerced, clamped and capped here.

import { OPPORTUNITY_TYPES, type BriefOutput, type ContextPack, type Effort, type OpportunityType, type Urgency } from '../types';

export const LIMITS = { plan: 5, nudges: 6, opportunities: 8, skills: 4, lessons: 4 } as const;

export const SYSTEM_PROMPT = `You are a personal opportunity copilot. You work for one person and you know them only through the context pack you are given.

Your job every day:
1. INSIGHT: one sharp read of their situation (2-4 sentences). Specific to their goals and context. Name the trade-off. Never generic advice.
2. PLAN: today's leverage plan, 2-5 items. Each item is either owner "ai" (something you can draft right now; put the draft in ai_draft, ready to review) or owner "you" (needs their time; give minutes). Respect their capacity: deep = 2h+, moderate = ~1h, low = 30 min light admin.
3. NUDGES: 1-5 next actions with urgency (urgent | normal | info) and a short due_label ("Due today", "Overdue", "Finance", "This week").
4. OPPORTUNITIES: up to 8 matches of types client | people | service | community | signal. Each needs a concrete title, a reason that references THEIR context (skills, goals, history), a fit_score 0-100, effort (light | medium | deep), and an optional value_label like "$1,800", "Join", "Read".
   Ground rules: never invent named companies, people or deals that you cannot know exist. Prefer segments ("agencies selling WhatsApp bookings"), well-known public communities and platforms, and signals you can justify from the context. Set source to "inferred" unless the context pack gave you the source. Learn from history: types they dismiss should appear less; types they save or act on should appear more.
5. SKILLS: up to 4 skills with a level 0-100 estimate and a note tying it to their matches. Include their strongest asset and the biggest gap.
6. LESSONS: up to 4 things worth learning this week, with minutes and why it matters to THEIR opportunities.

Style: concrete, short, no fluff, second person. Use their currency when they gave one.

Return ONLY a JSON object with this exact shape (no markdown):
{
  "insight": { "body": string, "reasoning": string },
  "plan": [{ "owner": "ai" | "you", "title": string, "detail": string, "ai_draft": string | null, "minutes": number }],
  "nudges": [{ "title": string, "urgency": "urgent" | "normal" | "info", "due_label": string }],
  "opportunities": [{ "type": "client" | "people" | "service" | "community" | "signal", "title": string, "reason": string, "value_label": string | null, "value_amount": number | null, "currency": string | null, "effort": "light" | "medium" | "deep", "fit_score": number, "source": string, "url": string | null }],
  "skills": [{ "title": string, "level": number, "note": string, "cta": string }],
  "lessons": [{ "title": string, "minutes": number, "note": string, "url": string | null }]
}`;

export function userPrompt(pack: ContextPack): string {
  return `Context pack for today (${pack.today}):\n${JSON.stringify(pack, null, 2)}\n\nProduce the daily brief JSON.`;
}

/** Pull a JSON object out of a model reply that may contain fences or prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error('agent returned no JSON object');
}

const str = (v: unknown, max = 600): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
const clamp100 = (v: unknown, dflt: number) => Math.max(0, Math.min(100, Math.round(num(v) ?? dflt)));
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : dflt);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function normalizeBrief(raw: unknown): BriefOutput {
  const r = obj(raw);
  const insight = obj(r.insight);
  const body = str(insight.body, 900) ?? str(r.insight, 900) ?? '';
  if (!body) throw new Error('agent output missing insight.body');

  const plan = arr(r.plan).map(obj).map((p) => ({
    owner: oneOf(p.owner, ['ai', 'you'] as const, 'you'),
    title: str(p.title, 200),
    detail: str(p.detail, 400),
    ai_draft: str(p.ai_draft, 2000),
    minutes: num(p.minutes),
  })).filter((p): p is typeof p & { title: string } => !!p.title).slice(0, LIMITS.plan);

  const nudges = arr(r.nudges).map(obj).map((n) => ({
    title: str(n.title, 240),
    urgency: oneOf<Urgency>(n.urgency, ['urgent', 'normal', 'info'], 'normal'),
    due_label: str(n.due_label, 40),
  })).filter((n): n is typeof n & { title: string } => !!n.title).slice(0, LIMITS.nudges);

  const opportunities = arr(r.opportunities).map(obj).map((o) => ({
    type: oneOf<OpportunityType>(o.type, OPPORTUNITY_TYPES, 'signal'),
    title: str(o.title, 200),
    reason: str(o.reason, 400) ?? '',
    value_label: str(o.value_label, 40),
    value_amount: num(o.value_amount),
    currency: str(o.currency, 8),
    effort: oneOf<Effort>(o.effort, ['light', 'medium', 'deep'], 'medium'),
    fit_score: clamp100(o.fit_score, 50),
    source: str(o.source, 80) ?? 'inferred',
    url: str(o.url, 500),
  })).filter((o): o is typeof o & { title: string } => !!o.title).slice(0, LIMITS.opportunities);

  const skills = arr(r.skills).map(obj).map((s) => ({
    title: str(s.title, 120),
    level: clamp100(s.level, 0),
    note: str(s.note, 300),
    cta: str(s.cta, 80),
  })).filter((s): s is typeof s & { title: string } => !!s.title).slice(0, LIMITS.skills);

  const lessons = arr(r.lessons).map(obj).map((l) => ({
    title: str(l.title, 160),
    minutes: num(l.minutes),
    note: str(l.note, 300),
    url: str(l.url, 500),
  })).filter((l): l is typeof l & { title: string } => !!l.title).slice(0, LIMITS.lessons);

  return { insight: { body, reasoning: str(insight.reasoning, 1500) }, plan, nudges, opportunities, skills, lessons };
}
