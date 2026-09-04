// Pure-module checks for the copilot vertical. No database, no network.
// Run: npx tsx scripts/tests/copilot-core.test.ts
import assert from 'node:assert/strict';
import { computeTypeAffinity, rankOpportunities, scoreOpportunity, selectPlan } from '../../src/lib/copilot/ranking';
import { extractJson, normalizeBrief } from '../../src/lib/copilot/agent/schema';
import { StarterAgent } from '../../src/lib/copilot/agent/starter';
import type { ContextPack } from '../../src/lib/copilot/types';

process.env.COPILOT_SESSION_SECRET ||= 'test-secret';

async function main() {
const { encodeSession, decodeSession } = await import('../../src/lib/copilot/session');

const now = new Date('2026-09-03T08:00:00Z');
const base = { created_at: now.toISOString(), score: 0 };

// --- ranking
{
  const ctx = { capacity: 'moderate' as const, huntTypes: ['client', 'community'] as const, typeAffinity: computeTypeAffinity([]), now };
  const a = scoreOpportunity({ type: 'client', effort: 'medium', fit_score: 80, ...base }, { ...ctx, huntTypes: [...ctx.huntTypes] });
  const b = scoreOpportunity({ type: 'signal', effort: 'medium', fit_score: 80, ...base }, { ...ctx, huntTypes: [...ctx.huntTypes] });
  assert.ok(a > b, 'hunted type outranks unhunted type at equal fit');
  const deep = scoreOpportunity({ type: 'client', effort: 'deep', fit_score: 80, ...base }, { ...ctx, huntTypes: [...ctx.huntTypes], capacity: 'low' });
  assert.ok(a > deep, 'capacity mismatch is penalised');
  // Use fit 60 so neither side hits the inferred cap and the freshness gap is visible.
  const freshMid = scoreOpportunity({ type: 'client', effort: 'medium', fit_score: 60, ...base }, { ...ctx, huntTypes: [...ctx.huntTypes] });
  const old = scoreOpportunity({ type: 'client', effort: 'medium', fit_score: 60, created_at: '2026-08-20T00:00:00Z', score: 0 }, { ...ctx, huntTypes: [...ctx.huntTypes] });
  assert.equal(freshMid - old, 15, 'freshness penalty caps at 15');

  const aff = computeTypeAffinity([
    { event_type: 'opportunity_saved', payload: { type: 'community' } },
    { event_type: 'opportunity_saved', payload: { type: 'community' } },
    { event_type: 'opportunity_dismissed', payload: { type: 'signal' } },
  ]);
  assert.ok(aff.community > 1 && aff.signal < 1 && aff.client === 1, 'affinity learns from saves and skips');

  const ranked = rankOpportunities([
    { type: 'signal', effort: 'light', fit_score: 90, ...base },
    { type: 'client', effort: 'medium', fit_score: 70, ...base },
  ], { ...ctx, huntTypes: [...ctx.huntTypes] });
  assert.equal(ranked[0].type, 'client', 'ranking sorts by blended score');
  assert.ok(ranked.every((r) => r.score >= 0 && r.score <= 100));

  const plan = selectPlan([
    { owner: 'ai', minutes: 5, status: 'open' },
    { owner: 'you', minutes: 90, status: 'open' },
    { owner: 'you', minutes: 20, status: 'open' },
    { owner: 'you', minutes: 15, status: 'done' },
  ], 'low');
  assert.deepEqual(plan.map((p) => `${p.owner}:${p.minutes}`), ['ai:5', 'you:20', 'you:15'], 'low capacity keeps AI items, the tasks that fit, and done items');

  // Regression: an oversized item listed first must not evict the cheap ones behind it.
  const squeezed = selectPlan([
    { owner: 'you', minutes: 90, status: 'open' },
    { owner: 'you', minutes: 5, status: 'open' },
  ], 'low');
  assert.deepEqual(squeezed.map((p) => p.minutes), [5], 'a 90 min task first does not hide the 5 min task');

  // But the plan is never empty: if nothing fits, show the cheapest single task.
  const nothingFits = selectPlan([
    { owner: 'you', minutes: 120, status: 'open' },
    { owner: 'you', minutes: 90, status: 'open' },
  ], 'low');
  assert.deepEqual(nothingFits.map((p) => p.minutes), [90], 'falls back to the cheapest task, not the first');

  assert.deepEqual(selectPlan([{ owner: 'you', minutes: undefined, status: 'open' }], 'low').length, 1, 'missing minutes default to 30 and still fit low');

  const planDeep = selectPlan([{ owner: 'you', minutes: 90, status: 'open' }, { owner: 'you', minutes: 50, status: 'open' }], 'deep');
  assert.equal(planDeep.length, 2, 'deep capacity fits both');
  assert.deepEqual(selectPlan([{ owner: 'ai', minutes: 999, status: 'open' }], 'low').length, 1, 'AI-drafted items ignore the budget');
}

// --- schema normalisation
{
  const raw = extractJson('Here you go:\n```json\n{"insight":{"body":"Do X.","reasoning":"Because Y"},"plan":[{"owner":"robot","title":"T","minutes":"20"}],"nudges":[{"title":"N","urgency":"loud"}],"opportunities":[{"type":"clients","title":"O","reason":"R","fit_score":150},{"title":""}],"skills":[{"title":"S","level":-5}],"lessons":[{"title":"L","minutes":12}]}\n```');
  const b = normalizeBrief(raw);
  assert.equal(b.plan[0].owner, 'you', 'unknown owner falls back to you');
  assert.equal(b.plan[0].minutes, 20, 'numeric strings coerce');
  assert.equal(b.nudges[0].urgency, 'normal');
  assert.equal(b.opportunities.length, 1, 'untitled opportunities dropped');
  assert.equal(b.opportunities[0].type, 'signal', 'unknown type falls back to signal');
  assert.equal(b.opportunities[0].fit_score, 100, 'fit clamps to 100');
  assert.equal(b.opportunities[0].source, 'inferred');
  assert.equal(b.skills[0].level, 0, 'level clamps to 0');
  assert.throws(() => normalizeBrief({}), /insight/);
  const many = normalizeBrief({ insight: { body: 'x' }, opportunities: Array.from({ length: 20 }, (_, i) => ({ type: 'client', title: `t${i}`, reason: 'r', fit_score: 50 })) });
  assert.equal(many.opportunities.length, 8, 'opportunities capped');
}

// --- starter agent
{
  const basePack: ContextPack = {
    today: '2026-09-03',
    profile: { name: 'Alex Ph', headline: 'build WhatsApp automations', location: 'Palawan', timezone: 'Asia/Manila', capacity: 'low', hunt_types: ['client'], target_segments: ['resort'], target_area: 'Palawan' },
    goals: [{ title: 'Monthly revenue', metric: 'currency', unit: '$', target_value: 2000, current_value: 0, horizon_days: 90, priority: 1, note: null }],
    context: [{ source: 'onboarding', kind: 'fact', content: 'What I do: build WhatsApp automations', created_at: '2026-09-03T00:00:00Z' }],
    sources: [{ source_key: 'calendar', status: 'not_connected', last_synced_at: null }],
    history: { saved: [], dismissed: [], acted: [], doneActions: [], openActions: [] },
    typeAffinity: computeTypeAffinity([]),
    candidates: [],
    metrics: computeMetrics({ executions: [], outcomes: [], opportunities: [], finance: {} }),
  };
  // No real matches yet: honest insight, nothing invented, a nudge toward supply.
  const empty = await new StarterAgent().generateBrief(basePack);
  assert.match(empty.insight.body, /Alex/);
  assert.match(empty.insight.body, /\$2,000/);
  assert.match(empty.insight.body, /nothing has gone out yet/);
  assert.equal(empty.opportunities.length, 0, 'starter never invents opportunities');
  assert.equal(empty.rankings.length, 0);
  assert.ok(!empty.plan.some((p) => p.owner === 'ai'), 'no draft without a reachable candidate');
  assert.ok(empty.plan.some((p) => /where you stand/.test(p.title)), 'asks for current value when target set and current is 0');
  assert.ok(empty.nudges.some((n) => /No real matches/.test(n.title)), 'nudges point at supply when there is none');

  // With a reachable real candidate: ranks it and drafts a send-ready opener bound to it.
  const withCandidate: ContextPack = { ...basePack, candidates: [{ id: 'c1', type: 'client', title: 'Sea Nymph Resort', summary: 'Resort in Palawan. Pain: no website.', source: 'google_maps', url: null, contact: { name: 'Maria', whatsapp: 'yes' }, fit_score: 70, scored: false }] };
  const drafted = await new StarterAgent().generateBrief(withCandidate);
  assert.deepEqual(drafted.rankings.map((r) => r.id), ['c1'], 'ranks the candidate');
  const ai = drafted.plan.find((p) => p.owner === 'ai');
  assert.ok(ai && ai.ai_draft && ai.opportunity_ref === 'c1' && ai.channel === 'whatsapp', 'drafts a WhatsApp opener bound to the candidate');
  assert.match(ai!.ai_draft!, /Hi Maria, Alex here/);
  assert.match(drafted.insight.body, /1 real match/);
}

// --- session cookie
{
  const id = '4d0f7f2c-3b3a-4d0e-9d55-0a4f5b7c8e11';
  const tok = encodeSession(id);
  assert.equal(decodeSession(tok), id);
  assert.equal(decodeSession(tok.slice(0, -1) + (tok.endsWith('a') ? 'b' : 'a')), null, 'tampered signature rejected');
  assert.equal(decodeSession('nonsense'), null);
  assert.equal(decodeSession(''), null);
}

console.log('copilot-core: all checks passed');
}

main().catch((e) => { console.error(e); process.exit(1); });

// ─── Closed loop ────────────────────────────────────────────────────────────
import { INFERRED_SCORE_CAP, computeOutcomeAffinity } from '../../src/lib/copilot/ranking';
import { computeMetrics, computeRunwayMonths, describeMetrics } from '../../src/lib/copilot/metrics';
import { heuristicFit, normalizePhone } from '../../src/lib/copilot/supply/types';
import { followUpTemplate } from '../../src/lib/copilot/execution';
import { openerTemplate } from '../../src/lib/copilot/agent/starter';

async function closedLoop() {
  const now = new Date('2026-09-04T08:00:00Z');
  const ctx = { capacity: 'deep' as const, huntTypes: ['client'] as const, typeAffinity: computeTypeAffinity([]), now };
  const c = { ...ctx, huntTypes: [...ctx.huntTypes] };

  // Ranking: an inferred guess can never outrank a real listing.
  const inferred = scoreOpportunity({ type: 'client', effort: 'deep', fit_score: 100, created_at: now.toISOString(), score: 0, source_kind: 'inferred' }, c);
  const sourced = scoreOpportunity({ type: 'client', effort: 'deep', fit_score: 100, created_at: now.toISOString(), score: 0, source_kind: 'sourced' }, c);
  assert.equal(inferred, INFERRED_SCORE_CAP, 'inferred capped');
  assert.ok(sourced > inferred, 'sourced beats inferred at equal fit');
  const oldSourced = scoreOpportunity({ type: 'client', effort: 'deep', fit_score: 80, created_at: '2026-08-25T00:00:00Z', score: 0, source_kind: 'sourced' }, c);
  const oldInferred = scoreOpportunity({ type: 'client', effort: 'deep', fit_score: 80, created_at: '2026-08-25T00:00:00Z', score: 0, source_kind: 'inferred' }, c);
  assert.ok(oldSourced > oldInferred, 'sourced decays slower');

  // Outcome-weighted affinity: replies lift a type, silence lowers it.
  const aff = computeOutcomeAffinity([], { client: 10, signal: 10 }, { client: { reply: 4 }, signal: {} });
  assert.ok(aff.client > 1.3 && aff.client <= 1.5, `client lifted by replies (${aff.client})`);
  assert.ok(aff.signal < 1 && aff.signal > 0.8, `signal lowered by silence (${aff.signal})`);
  assert.equal(aff.people, 1, 'untouched type stays neutral');
  const tiny = computeOutcomeAffinity([], { client: 1 }, { client: { won: 1 } });
  assert.ok(tiny.client < 1.5 && tiny.client > 1, 'one win with one send is shrunk toward neutral');

  // Metrics from executions and outcomes.
  const m = computeMetrics({
    now,
    executions: [
      { approval_state: 'sent', sent_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z' },
      { approval_state: 'sent', sent_at: '2026-09-02T00:00:00Z', created_at: '2026-09-02T00:00:00Z' },
      { approval_state: 'sent', sent_at: '2026-07-01T00:00:00Z', created_at: '2026-07-01T00:00:00Z' },   // outside window
      { approval_state: 'needs_approval', sent_at: null, created_at: '2026-09-03T00:00:00Z' },
      { approval_state: 'failed', sent_at: null, created_at: '2026-09-03T00:00:00Z' },
    ],
    outcomes: [
      { kind: 'reply', amount: null, occurred_at: '2026-09-02T10:00:00Z' },
      { kind: 'won', amount: 1800, occurred_at: '2026-09-03T10:00:00Z' },
      { kind: 'won', amount: 950, occurred_at: '2026-06-03T10:00:00Z' },   // outside window
    ],
    opportunities: [
      { status: 'new', source_kind: 'sourced' }, { status: 'saved', source_kind: 'sourced' }, { status: 'new', source_kind: 'inferred' }, { status: 'dismissed', source_kind: 'sourced' },
    ],
    finance: { monthly_burn: 1200, cash: 5040 },
  });
  assert.equal(m.sent, 2); assert.equal(m.replies, 1); assert.equal(m.reply_rate, 0.5);
  assert.equal(m.won, 1); assert.equal(m.won_amount, 1800); assert.equal(m.awaiting_approval, 1);
  assert.deepEqual(m.pipeline, { new: 2, saved: 1, sourced: 2, inferred: 1 });
  assert.equal(m.runway_months, 4.2);
  assert.equal(computeRunwayMonths({ monthly_burn: 0, cash: 100 }), null, 'zero burn has no runway');
  assert.match(describeMetrics(m, '$'), /2 sent, 1 reply \(50%\)/);
  assert.match(describeMetrics(m, '$'), /1 won for \$1,800/);
  const empty = computeMetrics({ executions: [], outcomes: [], opportunities: [], finance: {}, now });
  assert.equal(empty.reply_rate, null, 'no sends → no rate');
  assert.match(describeMetrics(empty), /nothing sent/);

  // Supply helpers.
  assert.equal(normalizePhone('0917 123 4567'), '639171234567', 'PH local mobile → international');
  assert.equal(normalizePhone('+63 917 123 4567'), '639171234567');
  assert.equal(normalizePhone('12345'), null, 'too short');
  const fit = heuristicFit({ target_segments: ['pest control'], target_area: 'Palawan', headline: null }, {
    source: 'hunter', external_id: 'x', type: 'client', title: 'ABC Pest Control', summary: 'Pest control in Palawan. Pain: no website.',
    contact: { whatsapp: '639171234567' }, data: { pain_signals: ['no_website'] },
  });
  assert.equal(fit, 80, 'fit caps at 80 to leave headroom for the agent');
  const weak = heuristicFit({ target_segments: ['dentist'], target_area: 'Manila', headline: null }, { source: 's', external_id: 'y', type: 'client', title: 'Cafe', summary: 'Cafe in Cebu', contact: {}, data: {} });
  assert.equal(weak, 50, 'no signals → base');

  // Templates never leak placeholders.
  const opener = openerTemplate({ name: 'Alex P', headline: 'build WhatsApp booking automations', target_area: 'Palawan', location: null }, { title: 'ABC Pest Control', summary: 'Pest control. Pain: no website.', contact: { name: 'Maria' } }, 'whatsapp');
  assert.match(opener, /^Hi Maria, Alex here\./);
  assert.match(opener, /no website listed/);
  assert.doesNotMatch(opener, /undefined|\$\{/);
  const fu = followUpTemplate('Maria', 'Alex', 'email');
  assert.match(fu, /Hi Maria,/); assert.match(fu, /Alex$/);

  // Normaliser: rankings and execution refs survive, junk does not.
  const b = normalizeBrief({
    insight: { body: 'x' },
    rankings: [{ id: 'abc', fit_score: 130, reason: 'r' }, { fit_score: 50 }, { id: 'def', fit_score: '42' }],
    plan: [{ owner: 'ai', title: 'Opener', ai_draft: 'hi', opportunity_ref: 'abc', channel: 'whatsapp' }, { owner: 'ai', title: 'Bad channel', ai_draft: 'hi', opportunity_ref: 'abc', channel: 'carrier pigeon' }],
  });
  assert.equal(b.rankings.length, 2, 'ranking without id dropped');
  assert.equal(b.rankings[0].fit_score, 100); assert.equal(b.rankings[1].fit_score, 42);
  assert.equal(b.plan[0].channel, 'whatsapp'); assert.equal(b.plan[0].opportunity_ref, 'abc');
  assert.equal(b.plan[1].channel, undefined, 'unknown channel dropped');

  console.log('copilot-core: closed-loop checks passed');
}

closedLoop().catch((e) => { console.error(e); process.exit(1); });
