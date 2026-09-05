// Pure-module checks for the copilot vertical. No database, no network.
// Run: npx tsx scripts/tests/copilot-core.test.ts
import assert from 'node:assert/strict';
import { AI_REVIEW_MINUTES, MAX_PLAN_ITEMS, computeTypeAffinity, rankOpportunities, scoreOpportunity, selectPlan } from '../../src/lib/copilot/ranking';
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
  assert.deepEqual(plan.map((p) => `${p.owner}:${p.minutes}`), ['ai:5', 'you:20', 'you:15'], 'low capacity keeps what fits, in order, plus done items');

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
  assert.deepEqual(selectPlan([{ owner: 'ai', minutes: 999, status: 'open' }], 'low').length, 1, 'one oversized item still beats an empty plan');

  // A plan is a shortlist. Thirty drafts is a queue, and rendering all of them
  // is what made Today unreadable on a real account.
  const flood = Array.from({ length: 30 }, () => ({ owner: 'ai' as const, minutes: undefined, status: 'open' as const }));
  assert.equal(selectPlan(flood, 'deep').length, MAX_PLAN_ITEMS, 'the shortlist is capped however much capacity there is');
  assert.equal(selectPlan([...flood, { owner: 'you', minutes: 10, status: 'done' }], 'deep').length, MAX_PLAN_ITEMS + 1, 'finished items are shown for the record and do not use a slot');

  // AI drafts cost a review, so they compete for the budget like everything else.
  const budgeted = selectPlan([
    { owner: 'ai', minutes: 20, status: 'open' },
    { owner: 'ai', minutes: 20, status: 'open' },
  ], 'low');
  assert.equal(budgeted.length, 1, 'a 30 min budget does not fit two 20 min reviews');
  assert.equal(selectPlan([{ owner: 'ai', minutes: undefined, status: 'open' }, { owner: 'you', minutes: 28, status: 'open' }], 'low').length, 2, `an unestimated AI item costs ${AI_REVIEW_MINUTES} min, not 30`);

  // Regression: capping the plan let cheap drafts eat all five slots, so the one
  // thing only the user could do fell off the bottom of their day.
  const crowded = selectPlan([...flood, { owner: 'you' as const, minutes: 20, status: 'open' as const, tag: 'call-back' }], 'moderate');
  assert.equal(crowded.length, MAX_PLAN_ITEMS, 'still a shortlist');
  assert.ok(crowded.some((a) => 'tag' in a), 'work only the user can do reaches the plan past a pile of drafts');
  assert.equal(crowded.filter((a) => a.owner === 'ai').length, MAX_PLAN_ITEMS - 1, 'drafts take back the slots nothing else wanted');
  assert.equal(selectPlan(flood, 'moderate').filter((a) => a.owner === 'ai').length, MAX_PLAN_ITEMS, 'with no other work the ceiling does not shrink the plan');
}

// --- schema normalisation
{
  const raw = extractJson('Here you go:\n```json\n{"insight":{"body":"Do X.","reasoning":"Because Y"},"plan":[{"owner":"robot","title":"T","minutes":"20"}],"nudges":[{"title":"N","urgency":"loud"}],"opportunities":[{"type":"clients","title":"O","reason":"R","fit_score":150},{"title":""}],"skills":[{"title":"S","level":-5}],"lessons":[{"title":"L","minutes":12,"url":"https://example.com/l"},{"title":"No url — dropped","minutes":5}]}\n```');
  const b = normalizeBrief(raw);
  assert.equal(b.plan[0].owner, 'you', 'unknown owner falls back to you');
  assert.equal(b.plan[0].minutes, 20, 'numeric strings coerce');
  assert.equal(b.nudges[0].urgency, 'normal');
  assert.equal(b.opportunities.length, 1, 'untitled opportunities dropped');
  assert.equal(b.opportunities[0].type, 'signal', 'unknown type falls back to signal');
  assert.equal(b.opportunities[0].fit_score, 100, 'fit clamps to 100');
  assert.equal(b.opportunities[0].source, 'inferred');
  assert.deepEqual(b.skills, [], 'skill levels are computed now, so the agent may not invent any');
  assert.throws(() => normalizeBrief({}), /insight/);
  assert.equal(b.lessons.length, 1, 'a lesson without a real url is dropped');
  assert.equal(b.lessons[0].url, 'https://example.com/l');
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

// ─── Multi-user safety ──────────────────────────────────────────────────────
import { channelsConfigured, deepLink } from '../../src/lib/copilot/execution';
import { hunterAdapter } from '../../src/lib/copilot/supply/hunter';
import { remoteAdapter } from '../../src/lib/copilot/supply/remote';
import type { Profile } from '../../src/lib/copilot/types';

async function multiUser() {
  const base = { linked_business_id: null, send_mode: 'manual', email_from: null } as Pick<Profile, 'linked_business_id' | 'send_mode' | 'email_from'> & Partial<Pick<Profile, 'plan' | 'plan_status'>>;

  // A profile may never send through the API under an identity it does not own.
  process.env.ULTRAMSG_INSTANCE_ID = 'shared'; process.env.ULTRAMSG_TOKEN = 'shared';
  process.env.RESEND_API_KEY = 'shared';
  assert.deepEqual(channelsConfigured(base), { whatsapp: false, email: false, mode: 'manual' }, 'server credentials never grant a user API sending');
  assert.deepEqual(channelsConfigured({ ...base, send_mode: 'api' }), { whatsapp: false, email: false, mode: 'api' }, 'api mode alone is not enough');
  assert.deepEqual(channelsConfigured({ ...base, send_mode: 'api', linked_business_id: 'biz-1' }).whatsapp, true, 'own business unlocks WhatsApp');
  assert.equal(channelsConfigured({ ...base, send_mode: 'api', email_from: 'me@mine.com', plan: 'pro', plan_status: 'active' }).email, true, 'own verified sender on a paid plan unlocks email');
  // Sending from your own address is a paid feature. The manual mailto link is
  // not, so a free user is never blocked from actually sending the message.
  assert.equal(channelsConfigured({ ...base, send_mode: 'api', email_from: 'me@mine.com' }).email, false, 'free plan does not send through the API');
  assert.equal(channelsConfigured({ ...base, send_mode: 'api', email_from: 'me@mine.com', plan: 'pro', plan_status: 'canceled' }).email, false, 'a lapsed plan loses API sending with it');
  assert.equal(channelsConfigured(null).mode, 'manual', 'default is manual');

  // The prospect pipeline is a shared Launchfly table: only linked profiles see it.
  const unlinked = { linked_business_id: null } as Profile;
  assert.equal(await hunterAdapter.available(unlinked), false, 'unlinked profile cannot read the shared prospect pool');
  assert.equal(await hunterAdapter.available({ linked_business_id: 'biz-1' } as Profile), true);
  assert.deepEqual(await hunterAdapter.discover(unlinked, { limit: 10 }), [], 'discover refuses even if called directly');

  // Deep links carry the message into the user's own app.
  const wa = deepLink({ channel: 'whatsapp', recipient: '+63 917 123 4567', subject: null, body: 'Hi Maria & co' });
  assert.ok(wa.startsWith('https://wa.me/639171234567?text='), `wa.me link strips punctuation (${wa})`);
  assert.match(wa, /Hi%20Maria%20%26%20co/, 'body is url-encoded');
  const mail = deepLink({ channel: 'email', recipient: 'a@b.com', subject: 'Quick note', body: 'Hello' });
  assert.ok(mail.startsWith('mailto:a@b.com?'), 'mailto link');
  assert.match(mail, /subject=Quick\+note/);

  // Remote supply output is untrusted: normalised, and junk is dropped.
  process.env.COPILOT_SUPPLY_URL = 'https://example.invalid/supply';
  assert.equal(remoteAdapter.available({} as Profile), true);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ candidates: [
    { id: 'x1', title: 'Real Co', summary: 'A real one', type: 'client', contact: { phone: '0917 123 4567' } },
    { title: 'No id — dropped' },
    { id: 'x2' },
    { id: 'x3', title: 'Bad type', type: 'wizard', effort: 'teleport', contact: { email: 'z@z.com' } },
  ] }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    const got = await remoteAdapter.discover({ headline: null, offer: {}, location: null, target_segments: [], target_area: null, hunt_types: [] } as unknown as Profile, { limit: 10 });
    assert.equal(got.length, 2, 'rows without a title or stable id are dropped');
    assert.equal(got[0].contact.whatsapp, '639171234567', 'phone normalised');
    assert.equal(got[1].type, 'client', 'unknown type falls back');
    assert.equal(got[1].effort, 'medium', 'unknown effort falls back');
    assert.equal(got[0].source, 'remote');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.COPILOT_SUPPLY_URL;
  }

  // Openers are built from the user's own offer, never a hardcoded vertical.
  const designer = openerTemplate(
    { name: 'Sam Lee', headline: null, target_area: null, location: 'Berlin', offer: { sells: 'brand identity systems', for_who: 'seed-stage startups', problem: 'their deck and their site look like two different companies', proof_url: 'https://sam.example/work' } },
    { title: 'Acme GmbH', summary: 'Seed startup in Berlin.', contact: { name: 'Jonas' } }, 'whatsapp');
  assert.match(designer, /Hi Jonas, Sam here\./);
  assert.match(designer, /I work on brand identity systems/, 'noun phrase gets "work on"');
  assert.match(designer, /their deck and their site look like two different companies/);
  assert.match(designer, /https:\/\/sam\.example\/work/, 'proof link replaces the vague offer');
  assert.doesNotMatch(designer, /automation|WhatsApp booking|small businesses/i, 'no trace of the original vertical');

  const builder = openerTemplate(
    { name: 'Alex', headline: null, target_area: 'Palawan', location: null, offer: { sells: 'build WhatsApp booking flows', for_who: 'resorts' } },
    { title: 'Sea Nymph', summary: 'Resort. Pain: no website.', contact: {} }, 'whatsapp');
  assert.match(builder, /I build WhatsApp booking flows/, 'verb phrase is used as-is');
  assert.match(builder, /Noticed you have no website listed/);

  // No offer, no headline: vague but never invented.
  const bare = openerTemplate({ name: 'Kim', headline: null, target_area: null, location: null }, { title: 'Someone', summary: 'nothing known', contact: {} }, 'email');
  assert.match(bare, /I work with businesses like yours/);
  assert.doesNotMatch(bare, /undefined|\$\{|null/);

  console.log('copilot-core: multi-user checks passed');
}

multiUser().catch((e) => { console.error(e); process.exit(1); });

// ─── Measured growth: diagnosis instead of invented skill levels ────────────
import { MIN_SAMPLE, demandGap, diagnose } from '../../src/lib/copilot/diagnose';

async function growth() {
  const opp = (id: string, over: Partial<{ source: string; source_kind: 'sourced' | 'inferred'; data: Record<string, unknown> }> = {}) =>
    ({ id, status: 'new' as const, source: over.source ?? 'google_maps', source_kind: over.source_kind ?? 'sourced' as const, data: over.data ?? {}, reason: '', title: id });
  const exec = (opportunity_id: string | null, channel: 'whatsapp' | 'email', state: 'sent' | 'needs_approval' | 'cancelled' = 'sent') =>
    ({ approval_state: state, channel, opportunity_id });

  // 1. Nothing sent: refuses to invent, and names the exact blocker.
  const none = diagnose({ opportunities: [opp('a'), opp('b')], executions: [], outcomes: [], offer: {} });
  assert.equal(none.thin, true);
  assert.equal(none.findings.length, 1, 'exactly one honest finding, not filler');
  assert.equal(none.findings[0].kind, 'insufficient');
  assert.match(none.findings[0].headline, /2 matches, nothing drafted yet/);
  assert.equal(none.bottleneck, null, 'no bottleneck claimed without volume');
  assert.equal(none.stages[0].count, 2);

  const noMatches = diagnose({ opportunities: [], executions: [], outcomes: [], offer: {} });
  assert.match(noMatches.findings[0].headline, /No matches yet/);
  const drafted = diagnose({ opportunities: [opp('a')], executions: [exec('a', 'whatsapp', 'needs_approval')], outcomes: [], offer: {} });
  assert.match(drafted.findings[0].headline, /1 drafted, nothing sent yet/);
  const tooFew = diagnose({ opportunities: [opp('a')], executions: [exec('a', 'whatsapp')], outcomes: [], offer: {} });
  assert.match(tooFew.findings[0].headline, /Only 1 sent so far/);

  // 2. A real bottleneck, computed. 10 sent, 1 reply -> Sent→Replied is worst.
  const ids = Array.from({ length: 10 }, (_, i) => `o${i}`);
  const big = diagnose({
    opportunities: ids.map((i) => opp(i)),
    executions: ids.map((i) => exec(i, 'whatsapp')),
    outcomes: [{ kind: 'reply', opportunity_id: 'o0' }],
    offer: {},
  });
  assert.equal(big.thin, false);
  assert.equal(big.bottleneck?.key, 'replied', 'the 10%% reply step is the bottleneck');
  const b = big.findings.find((f) => f.kind === 'bottleneck')!;
  assert.match(b.headline, /Sent → Replied is where you lose most: 1 of 10 \(10%\)/);
  assert.ok(b.action && /opener/.test(b.action), 'action names the opener, not the list');

  // 3. Channel comparison needs a real sample on BOTH sides.
  const lopsided = diagnose({
    opportunities: ids.map((i) => opp(i)),
    executions: [...ids.slice(0, 8).map((i) => exec(i, 'whatsapp')), exec('o8', 'email'), exec('o9', 'email')],
    outcomes: ids.slice(0, 4).map((i) => ({ kind: 'reply' as const, opportunity_id: i })),
    offer: {},
  });
  assert.ok(!lopsided.findings.some((f) => f.kind === 'channel'), `2 emails is below MIN_SAMPLE=${MIN_SAMPLE}, no comparison`);

  const fair = diagnose({
    opportunities: ids.map((i) => opp(i)),
    executions: [...ids.slice(0, 5).map((i) => exec(i, 'whatsapp')), ...ids.slice(5).map((i) => exec(i, 'email'))],
    outcomes: [{ kind: 'reply', opportunity_id: 'o0' }, { kind: 'reply', opportunity_id: 'o1' }, { kind: 'reply', opportunity_id: 'o2' }],
    offer: {},
  });
  const ch = fair.findings.find((f) => f.kind === 'channel');
  assert.ok(ch, 'even samples produce a comparison');
  assert.match(ch!.headline, /WhatsApp replies at 60%, Email at 0%/);
  assert.match(ch!.detail, /Same person, same offer/);

  // 4. Source comparison: where a match came from predicts whether it answers.
  const src = diagnose({
    opportunities: [...ids.slice(0, 5).map((i) => opp(i, { source: 'hunter' })), ...ids.slice(5).map((i) => opp(i, { source: 'remoteok' }))],
    executions: ids.map((i) => exec(i, 'whatsapp')),
    outcomes: ids.slice(0, 4).map((i) => ({ kind: 'reply' as const, opportunity_id: i })),
    offer: {},
  });
  const sf = src.findings.find((f) => f.kind === 'source');
  assert.ok(sf, 'source comparison fires');
  assert.match(sf!.headline, /hunter reply at 80%; remoteok at 0%/);

  // 5. Demand gap: recurring terms the offer does not cover.
  const withTags = [
    opp('t1', { data: { tags: ['voice ai', 'design'] } }),
    opp('t2', { data: { tags: ['voice ai'] } }),
    opp('t3', { data: { tags: ['voice ai', 'design'] } }),
    opp('t4', { data: { pain_signals: ['no_website'] } }),
    opp('t5', { source_kind: 'inferred', data: { tags: ['voice ai', 'voice ai', 'voice ai'] } }),  // inferred ignored
  ];
  const gap = demandGap(withTags, { sells: 'brand identity systems' });
  assert.equal(gap[0].term, 'voice ai');
  assert.equal(gap[0].count, 3, 'counted once per opportunity, inferred rows excluded');
  assert.ok(!gap.some((g) => g.term === 'no website'), 'below MIN_DEMAND');
  // A term already in the offer is not a gap.
  assert.equal(demandGap(withTags, { sells: 'voice ai intake systems' }).some((g) => g.term === 'voice ai'), false);

  const demandDiag = diagnose({ opportunities: withTags, executions: [], outcomes: [], offer: { sells: 'brand identity' } });
  const df = demandDiag.findings.find((f) => f.kind === 'demand')!;
  assert.match(df.headline, /"voice ai" appears in 3 of your matches and is not in your offer/);
  assert.equal(df.topic, 'voice ai');
  // With one term the detail must not just restate the headline.
  assert.doesNotMatch(df.detail, /^voice ai \(3\)/, 'single term is not echoed back');
  assert.match(df.detail, /That is what the market/);
  const twoTerms = diagnose({ opportunities: [...withTags, opp('t6', { data: { tags: ['seo', 'voice ai'] } }), opp('t7', { data: { tags: ['seo'] } }), opp('t8', { data: { tags: ['seo'] } })], executions: [], outcomes: [], offer: { sells: 'brand identity' } });
  assert.match(twoTerms.findings.find((f) => f.kind === 'demand')!.detail, /Also recurring: seo \(3\)/, 'extra terms listed only when they exist');

  // 6. Every rate shown is real: no finding may contain an uncomputed number.
  for (const d of [none, big, fair, src, demandDiag]) {
    for (const s of d.stages) {
      assert.ok(s.rate === null || (s.rate >= 0 && s.rate <= 1), 'rates are fractions or null, never invented');
    }
  }
  // A reply logged twice for one lead counts as one converted lead.
  const dedupe = diagnose({
    opportunities: ids.map((i) => opp(i)),
    executions: ids.map((i) => exec(i, 'whatsapp')),
    outcomes: [{ kind: 'reply', opportunity_id: 'o0' }, { kind: 'reply', opportunity_id: 'o0' }],
    offer: {},
  });
  assert.equal(dedupe.stages.find((s) => s.key === 'replied')!.count, 1, 'two replies from one lead is one');
  assert.equal(big.outsideFunnel, 0, 'an outcome on a match this app sent is inside the funnel');

  // 7. Funnel integrity. The shape that broke the live account: outcomes logged
  //    by hand on work that never went out through the copilot. 12 matched,
  //    4 drafted, 0 sent, 1 reply and 6 meetings — which used to render as 600%.
  const mIds = Array.from({ length: 6 }, (_, i) => `m${i}`);
  const broken = diagnose({
    opportunities: [...Array.from({ length: 12 }, (_, i) => opp(`b${i}`)), ...mIds.map((i) => opp(i))],
    executions: mIds.slice(0, 4).map((i) => exec(i, 'whatsapp', 'needs_approval')),
    outcomes: [{ kind: 'reply', opportunity_id: 'm0' }, ...mIds.map((i) => ({ kind: 'meeting' as const, opportunity_id: i }))],
    offer: {},
  });
  const meeting = broken.stages.find((s) => s.key === 'meeting')!;
  assert.equal(meeting.count, 6, 'the count is never massaged');
  assert.equal(meeting.rate, 1, 'a conversion rate is a share of the stage above it, so it never exceeds 100%');
  assert.equal(meeting.exceedsPrevious, true, 'a stage holding more than the one above it is flagged, not rendered as a conversion');
  assert.equal(broken.stages.find((s) => s.key === 'replied')!.exceedsPrevious, true, '1 reply against 0 sent is off-chain too');
  assert.ok(!broken.stages.some((s) => s.exceedsPrevious && s.key === broken.bottleneck?.key), 'a broken chain is never named the bottleneck');
  assert.equal(broken.outsideFunnel, 6, 'six leads carry outcomes with no send behind them');
  const outside = broken.findings.find((f) => f.kind === 'outside')!;
  assert.match(outside.headline, /6 matches have outcomes this app never sent/);
  assert.match(outside.action!, /I sent it/, 'the fix is named, not just the problem');
  assert.equal(broken.thin, false, 'there is still a real bottleneck to report here');

  // 8. Off-chain outcomes alone are not a diagnosis: still thin, and still says why.
  const alone = diagnose({
    opportunities: Array.from({ length: 4 }, (_, i) => opp(`s${i}`)),
    executions: [],
    outcomes: [{ kind: 'reply', opportunity_id: 's0' }],
    offer: {},
  });
  assert.equal(alone.outsideFunnel, 1);
  assert.deepEqual(alone.findings.map((f) => f.kind), ['outside', 'insufficient']);
  assert.match(alone.findings[0].headline, /1 match has an outcome/, 'singular reads as English');
  assert.equal(alone.thin, true, 'an explanation of why the funnel looks odd is not a finding about the work');

  console.log('copilot-core: measured-growth checks passed');
}

growth().catch((e) => { console.error(e); process.exit(1); });

// ─── Plans, metering and the Stripe seam ────────────────────────────────────
import {
  PLANS, effectivePlan, isPlanKey, limitsFor, monthlyEquivalent, priceEnvKey, remaining, savingsPercent,
} from '../../src/lib/copilot/plans';
import { periodKey } from '../../src/lib/copilot/usage';
import { planFromSubscription, type SubscriptionShape } from '../../src/lib/copilot/billing';

async function billing() {
  // 1. Every paid plan must beat the free one on the thing being sold, or the
  //    price is not defensible.
  for (const key of ['pro', 'operator'] as const) {
    assert.ok(PLANS[key].limits.matchesPerMonth > PLANS.free.limits.matchesPerMonth, `${key} must offer more supply than free`);
    assert.ok(PLANS[key].price.monthly > 0, `${key} must cost something`);
  }
  assert.ok(PLANS.operator.limits.matchesPerMonth > PLANS.pro.limits.matchesPerMonth, 'the top tier must be worth the jump');
  assert.equal(Object.values(PLANS).filter((p) => p.recommended).length, 1, 'exactly one plan is recommended');

  // 2. Yearly is ten months, framed per month, and the badge matches the maths.
  assert.equal(PLANS.pro.price.yearly, PLANS.pro.price.monthly * 10);
  assert.equal(monthlyEquivalent(PLANS.pro, 'monthly'), 29);
  assert.equal(monthlyEquivalent(PLANS.pro, 'yearly'), Math.round((290 / 12) * 100) / 100);
  assert.equal(savingsPercent(PLANS.pro), 17, 'two months free reads as 17% off');
  assert.equal(savingsPercent(PLANS.free), 0, 'a free plan has no discount to advertise');

  // 3. A lapsed subscription degrades to free limits — it never locks the account.
  assert.equal(effectivePlan({ plan: 'pro', plan_status: 'active' }).key, 'pro');
  assert.equal(effectivePlan({ plan: 'pro', plan_status: 'trialing' }).key, 'pro', 'a trial entitles');
  for (const status of ['past_due', 'canceled', 'incomplete'] as const) {
    assert.equal(effectivePlan({ plan: 'pro', plan_status: status }).key, 'free', `${status} falls back to free`);
  }
  assert.equal(limitsFor({ plan: 'operator', plan_status: 'canceled' }).matchesPerMonth, PLANS.free.limits.matchesPerMonth);
  // Garbage in the column must not crash a page render.
  assert.equal(effectivePlan({ plan: 'enterprise', plan_status: 'active' }).key, 'free', 'an unknown plan is free, not a throw');
  assert.equal(effectivePlan({}).key, 'free');
  assert.equal(isPlanKey('pro'), true);
  assert.equal(isPlanKey('enterprise'), false);

  // 4. Allowance arithmetic never goes negative, however the counters drift.
  assert.equal(remaining(25, 30), 0, 'an overshoot reads as zero left, not minus five');
  assert.equal(remaining(25, -3), 25);
  assert.equal(remaining(400, 130), 270);

  // 5. The month is the user's month, not the server's.
  const newYear = new Date('2026-01-01T00:30:00Z');   // still December in Los Angeles
  assert.equal(periodKey('UTC', newYear), '2026-01');
  assert.equal(periodKey('America/Los_Angeles', newYear), '2025-12', 'the allowance resets on the user’s calendar');
  assert.equal(periodKey('Not/AZone', newYear), '2026-01', 'a bad timezone falls back rather than throwing');

  // 6. Env keys are the contract with the deploy — a typo here is a silent no-sale.
  assert.equal(priceEnvKey('pro', 'monthly'), 'STRIPE_PRICE_COPILOT_PRO_MONTHLY');
  assert.equal(priceEnvKey('operator', 'yearly'), 'STRIPE_PRICE_COPILOT_OPERATOR_YEARLY');

  // 7. Resolving a subscription to a plan. Metadata wins; the price id is the
  //    fallback, because the Stripe Billing Portal does not copy metadata when
  //    someone switches plan there.
  const sub = (over: Partial<SubscriptionShape>): SubscriptionShape =>
    ({ id: 'sub_1', status: 'active', customer: 'cus_1', ...over });
  assert.equal(planFromSubscription(sub({ metadata: { plan: 'operator' } })), 'operator');
  assert.equal(planFromSubscription(sub({ items: { data: [{ price: { id: 'price_x', metadata: { plan: 'pro' } } }] } })), 'pro', 'price metadata is read too');
  assert.equal(planFromSubscription(sub({ metadata: { plan: 'enterprise' } })), null, 'an unrecognised plan resolves to nothing, never to a paid tier');
  assert.equal(planFromSubscription(sub({})), null, 'no metadata and no price is not an upgrade');

  process.env.STRIPE_PRICE_COPILOT_OPERATOR_YEARLY = 'price_op_year';
  assert.equal(planFromSubscription(sub({ items: { data: [{ price: { id: 'price_op_year' } }] } })), 'operator', 'a portal plan switch resolves by price id');
  assert.equal(planFromSubscription(sub({ items: { data: [{ price: { id: 'price_unknown' } }] } })), null);
  delete process.env.STRIPE_PRICE_COPILOT_OPERATOR_YEARLY;

  console.log('copilot-core: plans-and-billing checks passed');
}

billing().catch((e) => { console.error(e); process.exit(1); });
