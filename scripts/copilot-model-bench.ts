// scripts/copilot-model-bench.ts
// Which model should write the brief?
//
// An intelligence index does not answer that. This prompt is ~9,400 tokens of
// context and about ten hard rules, and the only thing that matters is whether
// the reply survives normalizeBrief and obeys them. A model that reasons
// beautifully and returns prose around its JSON is worth nothing here: the run
// falls back to the starter and the user never knows.
//
// So this runs the REAL system prompt through the REAL normalizer against
// whatever models you name, and scores the things that actually break.
//
//   COPILOT_AI_API_KEY=sk-or-... COPILOT_AI_BASE_URL=https://openrouter.ai/api/v1 \
//     npx tsx scripts/copilot-model-bench.ts z-ai/glm-5.3-flash openai/gpt-5.6-luna
//
// Costs a few cents per model. Run it before switching, not after.

import { SYSTEM_PROMPT, extractJson, normalizeBrief, userPrompt } from '../src/lib/copilot/agent/schema';
import { OFFER_TASK_TITLE } from '../src/lib/copilot/offer';
import type { Candidate, ContextPack } from '../src/lib/copilot/types';

const BASE = process.env.COPILOT_AI_BASE_URL || 'https://openrouter.ai/api/v1';
const KEY = process.env.COPILOT_AI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

const candidate = (i: number): Candidate => ({
  id: `9f8e7d6c-5b4a-3210-9876-5432100${String(i).padStart(5, '0')}`,
  type: 'client',
  title: ['Reliable Pest Control Services', 'L&K Waterproofing Solutions', 'Golden Staycation PH', 'D-Square Plumbing Supply', 'Mega Manila Pest Management'][i % 5] + ` ${i}`,
  summary: i % 3 === 0 ? 'Runs Facebook ads, no website listed, 12 reviews' : 'Uses WhatsApp for sales, generates custom quotes, few reviews',
  source: 'google_maps', url: 'https://maps.google.com/?cid=1',
  contact: { name: 'Maria Santos', whatsapp: i % 4 === 0 ? undefined : 'yes', website: 'https://example.com' },
  fit_score: 60 + (i % 30), scored: false,
});

function pack(withOffer: boolean): ContextPack {
  return {
    today: '2026-09-07',
    profile: {
      name: 'Alex', headline: 'I build WhatsApp booking automations', location: 'Cebu', timezone: 'Asia/Manila',
      capacity: 'deep', hunt_types: ['client', 'service'],
      target_segments: ['renovation', 'pest control', 'plumbing'], target_area: 'Cebu',
      offer: withOffer
        ? { sells: 'WhatsApp booking automations', for_who: 'local service businesses', problem: 'enquiries arrive after hours and go unanswered', price_band: '$400-1,500', proof_url: 'https://example.com' }
        : {},
    },
    goals: [{ title: 'Reach $3,000 a month', metric: 'currency', unit: '$', target_value: 3000, current_value: 1, horizon_days: 90, priority: 1, note: null }],
    context: Array.from({ length: 20 }, (_, i) => ({ source: 'note', kind: 'fact', content: `Background note ${i} about how the business actually runs.`, created_at: '2026-09-01T00:00:00Z' })),
    sources: [{ source_key: 'calendar', status: 'not_connected', last_synced_at: null }],
    history: { saved: [], dismissed: [], acted: [], doneActions: [], openActions: [] },
    changed: [{ what: 'Runway', from: '3.6 mo', to: '3.4 mo' }, { what: 'Replies', from: '1', to: '2' }],
    // Eight ignored calls on one topic. A model that reads the pack will stop
    // repeating it; one that does not will recommend "sending" a ninth time.
    recentDecisions: Array.from({ length: 8 }, (_, i) => ({ for_date: `2026-08-${20 + i}`, headline: 'Send the drafts already written before finding anything new.', topic: 'sending', response: 'ignored' as const, moved: null })),
    typeAffinity: { client: 1.2, people: 0.9, service: 1, community: 0.8, signal: 1 },
    candidates: Array.from({ length: 25 }, (_, i) => candidate(i)),
    metrics: { window_days: 30, sent: 0, replies: 2, reply_rate: null, meetings: 6, won: 1, won_amount: 1, lost: 3, awaiting_approval: 33, pipeline: { new: 87, saved: 0, sourced: 157, inferred: 0 }, runway_months: 3.4 },
  };
}

interface Check { label: string; pass: boolean; note?: string }

async function call(model: string, p: ContextPack) {
  const started = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model, temperature: 0.4,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt(p) }],
    }),
  });
  const body = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: Record<string, number>; error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message || `HTTP ${res.status}`);
  return { text: body.choices?.[0]?.message?.content ?? '', usage: body.usage ?? {}, ms: Date.now() - started };
}

async function score(model: string): Promise<void> {
  const checks: Check[] = [];
  let ms = 0;
  const usage: Record<string, number> = {};

  try {
    // ── 1. The normal case ────────────────────────────────────────────────
    const a = await call(model, pack(true));
    ms += a.ms;
    for (const [k, v] of Object.entries(a.usage)) if (typeof v === 'number') usage[k] = (usage[k] ?? 0) + v;

    let out;
    try {
      out = normalizeBrief(extractJson(a.text));
      checks.push({ label: 'survives normalizeBrief', pass: true });
    } catch (e) {
      checks.push({ label: 'survives normalizeBrief', pass: false, note: e instanceof Error ? e.message : String(e) });
      report(model, checks, ms, usage);
      return;
    }

    checks.push({ label: 'made a decision', pass: !!out.decision, note: out.decision?.headline });
    const cites = (out.decision?.because ?? []).some((b) => /\d/.test(b));
    checks.push({ label: 'because cites a number', pass: cites });
    checks.push({ label: 'named the trade-off', pass: !!out.decision?.instead_of });
    checks.push({ label: 'staked a metric', pass: !!out.decision?.verify_metric && out.decision.verify_metric !== 'none' });
    // Eight ignored "sending" calls are in the pack. A ninth is the failure.
    checks.push({ label: 'did not repeat the ignored topic', pass: out.decision?.topic !== 'sending', note: `topic: ${out.decision?.topic ?? 'none'}` });
    checks.push({ label: 'ranked the candidates', pass: out.rankings.length >= 20, note: `${out.rankings.length}/25` });
    const known = new Set(pack(true).candidates.map((c) => c.id));
    checks.push({ label: 'invented no candidate ids', pass: out.rankings.every((r) => known.has(r.id)) });
    checks.push({ label: 'insight cites a number', pass: /\d/.test(out.insight.body) });

    // ── 2. The invariant that matters most ────────────────────────────────
    // Nothing drafts from a blank offer. 44 messages were once written from
    // one and none were sent. A model that ignores this rule is unusable here
    // whatever it scores on a benchmark.
    const b = await call(model, pack(false));
    ms += b.ms;
    for (const [k, v] of Object.entries(b.usage)) if (typeof v === 'number') usage[k] = (usage[k] ?? 0) + v;
    const blank = normalizeBrief(extractJson(b.text));
    const drafted = blank.plan.filter((p) => p.ai_draft && p.channel && p.opportunity_ref);
    checks.push({ label: 'blank offer: drafted nothing', pass: drafted.length === 0, note: drafted.length ? `${drafted.length} drafts written from nothing` : undefined });
    checks.push({ label: 'blank offer: asked for the offer', pass: blank.plan.some((p) => p.title.trim().toLowerCase() === OFFER_TASK_TITLE.toLowerCase()) });
  } catch (e) {
    checks.push({ label: 'call succeeded', pass: false, note: e instanceof Error ? e.message : String(e) });
  }
  report(model, checks, ms, usage);
}

function report(model: string, checks: Check[], ms: number, usage: Record<string, number>) {
  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${model}`);
  console.log(`${'─'.repeat(Math.max(model.length, 40))}`);
  for (const c of checks) console.log(`  ${c.pass ? '✓' : '✗'} ${c.label}${c.note ? `  — ${c.note}` : ''}`);
  const tokens = usage.total_tokens ?? ((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0));
  console.log(`  ${passed}/${checks.length} passed · ${(ms / 1000).toFixed(1)}s for both runs · ${tokens ? `${tokens.toLocaleString()} tokens` : 'usage not reported'}`);
}

async function main() {
  const models = process.argv.slice(2);
  if (!KEY) { console.error('Set COPILOT_AI_API_KEY (or OPENROUTER_API_KEY).'); process.exit(1); }
  if (!models.length) {
    console.error('Usage: npx tsx scripts/copilot-model-bench.ts <model> [model...]');
    console.error('Model ids are whatever your endpoint calls them, e.g. z-ai/glm-5.3-flash on OpenRouter.');
    process.exit(1);
  }
  console.log(`Endpoint: ${BASE}`);
  console.log('Two runs per model: a normal brief, and one with a blank offer.');
  for (const m of models) await score(m);
  console.log('\nPick on the failures, not the totals. "blank offer: drafted nothing" and');
  console.log('"survives normalizeBrief" are disqualifying; the rest is preference.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
