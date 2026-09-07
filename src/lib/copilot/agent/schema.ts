// src/lib/copilot/agent/schema.ts
// Prompt + output normalisation shared by the LLM and webhook agents.
// We do not trust agent output: everything is coerced, clamped and capped here.

import { DECISION_METRICS, type DecisionConfidence, type DecisionDraft, type DecisionMetric, type DontDraft } from '../decision';
import { OPPORTUNITY_TYPES, type BriefOutput, type Channel, type ContextPack, type Effort, type OpportunityType, type Urgency } from '../types';

export const LIMITS = { plan: 5, nudges: 6, opportunities: 8, skills: 0, lessons: 1, rankings: 40, because: 3 } as const;

export const SYSTEM_PROMPT = `You are a personal opportunity copilot. You work for one person and you know them only through the context pack you are given.

Your job every day:
1. DECISION: exactly one. The single move that most changes this person's position today. A list of five good things is not a decision; picking one and saying what it costs is.
   - headline: one imperative sentence naming a MOVE, not a topic. "Send the five drafts already written" — never "focus on outreach".
   - because: 1-3 lines, each citing a real number from metrics or changed. Every line must be checkable. No line may be an opinion.
   - instead_of: the real alternative you are ruling out — something they could plausibly do today (a waiting queue, another search, a build). If you cannot name one, you have not made a decision.
   - confidence: "low" when two options were close, or the sample is too small to separate them. "high" otherwise. Never claim high because it reads better; being wrong loudly costs more than being unsure.
   - missing: required when confidence is "low" — the one fact that would settle it.
   - topic: a 2-3 word slug for the KIND of call ("sending", "opener", "converting", "pricing", "targeting", "offer", "delivery"). The system groups by this to spot a call that keeps being made and never works.
   - verify_metric: the ONE number that should move within three days if this was right — sent, replies, meetings, won or won_amount — or "none" when nothing measurable moves that fast. Pick the number you would actually stake the call on.
   Learn from recentDecisions: a topic that appears there repeatedly with response "ignored" must not simply be repeated — either name what is standing in the way, or make a different call. A topic that was done and moved nothing is not worth recommending again.
2. DONT: one thing explicitly not worth doing today, and why in one line. Usually the thing they would otherwise default to. Null only when nothing plausible competes for the same hour.
3. INSIGHT: the read behind the decision (2-4 sentences). Specific to their goals and context. Never generic advice.
4. PLAN: today's leverage plan, 2-5 items. Each item is either owner "ai" (something you can draft right now; put the draft in ai_draft, ready to review) or owner "you" (needs their time; give minutes). Respect their capacity: deep = 2h+, moderate = ~1h, low = 30 min light admin.
5. NUDGES: 1-5 next actions with urgency (urgent | normal | info) and a short due_label ("Due today", "Overdue", "Finance", "This week").
RANKINGS: the pack contains "candidates" — REAL, sourced opportunities (actual businesses, listings, people) found by the system. For each candidate return {id, fit_score 0-100, reason}. The reason must say why THIS candidate fits THIS person's goals, skills and constraints, in one or two sentences. Never invent candidates; never change their ids. Candidates with scored=false must be ranked; re-rank scored ones only when context changed.

CHANGED: the pack contains "changed" — what actually moved since the last brief, computed from the ledger. If anything is there, the decision must take account of it; a runway that fell or a reply that arrived outranks whatever you were going to say.

METRICS: the pack contains "metrics" — real numbers from what was actually sent, replied, won and lost. Your DECISION's because lines and your INSIGHT must both cite at least one of them (sent, replies, reply rate, won amount, runway, pipeline size). If nothing has been sent yet, say so and make the plan about starting.

REPLIES: the pack contains "replies" — what real prospects wrote back, in their own words, matched to messages this person actually sent. This is evidence, not colour. Use it to name the objection that keeps coming up, and quote at most one short phrase from it when it makes a because line checkable. Never invent a reply, never attribute words to a business that is not in this list, and never treat an absence of replies as a reply.

SENT: the pack contains "sent" — openers this person sent, each marked replied true or false. Silence is only recorded after three days, so replied=false means ignored, not pending. When there is a difference between the two groups, say what it is in concrete terms (length, whether it asked a question, whether it named the business) and make the next draft look like the ones that worked. With fewer than three examples either side, say the sample is too small instead of drawing a rule from it.

DEMAND: the pack contains "demand" — wants counted across this person's own matched businesses, and every term in it is already something their offer does NOT mention. This is computed from real listings, so it outranks anything you infer about the market. A term with a high businesses count and trend "new" or "rising" is the strongest offer signal in the pack: it is what the market in front of them is asking for and cannot currently buy from them. Use it for the decision when the gap is bigger than the sending gap, and in drafts prefer the wants that match the candidate's own segment.

VOICE: the pack contains profile.offer — what this person sells, who for, the problem it solves, their price band and one proof link. Every message you draft must be in THEIR terms, using their words for what they do. Never describe a business they did not describe. If profile.offer.sells is empty, do NOT propose any plan item with ai_draft, opportunity_ref or channel — a message written from nothing is not theirs and will not be sent. Instead include one owner "you" item titled exactly "Set your offer so drafts are written in your words" (3 minutes), and say in the insight that nothing can be drafted until they say what they sell. Do not assume an industry, a country, a channel or a company size that the pack does not state.

EXECUTION: a plan item with owner "ai" may target a candidate by setting opportunity_ref to the candidate id and channel to "whatsapp" or "email" (only when that candidate's contact shows that channel = "yes"). Put the full message in ai_draft. The system turns it into a send-ready draft the user approves with one tap. Prefer this over generic advice: one real drafted message beats three suggestions.

6. OPPORTUNITIES: up to 8 ADDITIONAL inferred matches of types client | people | service | community | signal — segments, communities and signals you can justify from context. These are capped below real candidates in ranking, so spend effort on RANKINGS first. Each needs a concrete title, a reason that references THEIR context (skills, goals, history), a fit_score 0-100, effort (light | medium | deep), and an optional value_label like "$1,800", "Join", "Read".
   Ground rules: never invent named companies, people or deals that you cannot know exist. Prefer segments described in the user's own terms, well-known public communities and platforms, and signals you can justify from the context. Set source to "inferred" unless the context pack gave you the source. Learn from history: types they dismiss should appear less; types they save or act on should appear more.
7. SKILLS: return an empty array. Skill levels used to be guessed here; they are now computed from what the user actually sent and what came back, so inventing a number would overwrite measurement with a guess.
8. LESSONS: at most ONE, and only when the pack's diagnosis names a stuck point you can address. It must have a real, working url to a specific free resource — no url means no lesson. Say in one line why it follows from the stuck point. If nothing is stuck, return an empty array: telling someone they need to learn nothing is a valid and often correct answer.

Style: concrete, short, no fluff, second person. Use their currency when they gave one.

Return ONLY a JSON object with this exact shape (no markdown):
{
  "decision": { "headline": string, "because": [string], "instead_of": string, "confidence": "high" | "low", "missing": string | null, "topic": string, "verify_metric": "sent" | "replies" | "meetings" | "won" | "won_amount" | "none" },
  "dont": { "title": string, "why": string } | null,
  "insight": { "body": string, "reasoning": string },
  "rankings": [{ "id": string, "fit_score": number, "reason": string }],
  "plan": [{ "owner": "ai" | "you", "title": string, "detail": string, "ai_draft": string | null, "minutes": number, "opportunity_ref": string | null, "channel": "whatsapp" | "email" | null }],
  "nudges": [{ "title": string, "urgency": "urgent" | "normal" | "info", "due_label": string }],
  "opportunities": [{ "type": "client" | "people" | "service" | "community" | "signal", "title": string, "reason": string, "value_label": string | null, "value_amount": number | null, "currency": string | null, "effort": "light" | "medium" | "deep", "fit_score": number, "source": string, "url": string | null }],
  "skills": [],
  "lessons": [{ "title": string, "minutes": number, "note": string, "url": string }]
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
    opportunity_ref: str(p.opportunity_ref, 80),
    channel: typeof p.channel === 'string' && (['whatsapp', 'email'] as const).includes(p.channel as Channel) ? (p.channel as Channel) : undefined,
  })).filter((p): p is typeof p & { title: string } => !!p.title).slice(0, LIMITS.plan);

  const rankings = arr(r.rankings).map(obj).map((k) => ({
    id: str(k.id, 80),
    fit_score: clamp100(k.fit_score, 50),
    reason: str(k.reason, 400) ?? '',
  })).filter((k): k is typeof k & { id: string } => !!k.id).slice(0, LIMITS.rankings);

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
  })).filter((l): l is typeof l & { title: string; url: string } => !!l.title && !!l.url && /^https?:\/\//i.test(l.url))
    .slice(0, LIMITS.lessons);

  // A decision without a headline is not a decision; the starter's floor is
  // better than a card that says nothing, so this returns null and the caller
  // fills it in rather than rendering an empty call.
  const d = obj(r.decision);
  const headline = str(d.headline, 200);
  const because = arr(d.because).map((b) => str(b, 240)).filter((b): b is string => !!b).slice(0, LIMITS.because);
  const confidence = oneOf<DecisionConfidence>(d.confidence, ['high', 'low'] as const, 'high');
  const decision: DecisionDraft | null = headline
    ? {
        headline,
        because,
        instead_of: str(d.instead_of, 240),
        confidence,
        // "Unsure, and here is why" is useful; "unsure" alone is not, so the
        // missing fact is only carried when the model actually gave one.
        missing: confidence === 'low' ? str(d.missing, 240) : undefined,
        topic: str(d.topic, 40)?.toLowerCase(),
        verify_metric: oneOf<DecisionMetric>(d.verify_metric, DECISION_METRICS, 'none'),
      }
    : null;

  const dn = obj(r.dont);
  const dontTitle = str(dn.title, 160);
  const dont: DontDraft | null = dontTitle ? { title: dontTitle, why: str(dn.why, 240) ?? '' } : null;

  return { decision, dont, insight: { body, reasoning: str(insight.reasoning, 1500) }, rankings, plan, nudges, opportunities, skills, lessons };
}
