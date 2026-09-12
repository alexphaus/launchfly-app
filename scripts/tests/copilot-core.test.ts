// Pure-module checks for the copilot vertical. No database, no network.
// Run: npx tsx scripts/tests/copilot-core.test.ts
import assert from 'node:assert/strict';
import { AI_REVIEW_MINUTES, MAX_PLAN_ITEMS, computeTypeAffinity, rankOpportunities, scoreOpportunity, selectPlan } from '../../src/lib/copilot/ranking';
import { extractJson, normalizeBrief } from '../../src/lib/copilot/agent/schema';
import { StarterAgent } from '../../src/lib/copilot/agent/starter';
import { OFFER_TASK_TITLE, PROBLEM_MAX, SELLS_MAX, addOpeningToOffer, offerChangedMaterially, offerIsEmpty } from '../../src/lib/copilot/offer';
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
  const raw = extractJson('Here you go:\n```json\n{"insight":{"body":"Do X.","reasoning":"Because Y"},"plan":[{"owner":"robot","title":"T","minutes":"20"}],"nudges":[{"title":"N","urgency":"loud"}],"opportunities":[{"type":"client","title":"O","reason":"R","fit_score":150}],"skills":[{"title":"S","level":90}],"lessons":[{"title":"L","url":"https://example.com/l"}]}\n```');
  const b = normalizeBrief(raw);
  assert.throws(() => normalizeBrief({}), /insight/);

  // Three fields the agent may still SEND and the app no longer reads. A model
  // pointed at an older prompt, a cached one, or a webhook written against the
  // previous contract must not be able to put anything on the screen through
  // them — so the normalizer drops them on the floor rather than passing them
  // through for a later layer to ignore.
  //
  // They were cut for one reason each: `opportunities` were up to eight matches
  // the MODEL invented, rendered beside real scraped businesses; `skills` were
  // already sliced to zero while the prompt still asked for them; `lessons`
  // needed a working URL, which is the single thing a model is least able to
  // supply. The computed edge replaced the last one and reads off the funnel.
  //
  // `plan` and `nudges` went for a different reason: they were asked for in the
  // same response that wrote the Call, over the same context, so they restated
  // it. The live screen carried four rows of "approve and send N drafts" above a
  // queue card saying it a fifth time, the numbers disagreeing because they came
  // from different runs.
  const leaked = b as unknown as Record<string, unknown>;
  for (const gone of ['opportunities', 'skills', 'lessons', 'plan', 'nudges']) {
    assert.equal(leaked[gone], undefined, `${gone} must not survive normalizeBrief`);
  }
}

// --- starter agent
{
  const basePack: ContextPack = {
    today: '2026-09-03',
    profile: { name: 'Alex Ph', headline: 'build WhatsApp automations', location: 'Palawan', timezone: 'Asia/Manila', capacity: 'low', hunt_types: ['client'], target_segments: ['resort'], target_area: 'Palawan', offer: { sells: 'WhatsApp booking automations' } },
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
  // The starter could never invent opportunities and now there is nowhere for it
  // to put one if it tried: BriefOutput does not carry the field any more.
  assert.equal((empty as unknown as Record<string, unknown>).opportunities, undefined);
  assert.equal(empty.rankings.length, 0);
  // The starter can no longer produce a plan item or a nudge at all — the fields
  // are gone from BriefOutput. That is a stronger version of invariant 1 than
  // the gate it replaces: there is nowhere to put a draft written from nothing,
  // rather than a rule saying not to. The homework tasks this used to guard
  // against ("log where you stand", "write down the last 3 people who paid you")
  // cannot be generated either.
  const emptyLeak = empty as unknown as Record<string, unknown>;
  assert.equal(emptyLeak.plan, undefined, 'the starter has nowhere to put a plan item');
  assert.equal(emptyLeak.nudges, undefined, 'and nowhere to put a nudge');

  // With a reachable real candidate: ranks it and drafts a send-ready opener bound to it.
  const withCandidate: ContextPack = { ...basePack, candidates: [{ id: 'c1', type: 'client', title: 'Sea Nymph Resort', summary: 'Resort in Palawan. Pain: no website.', source: 'google_maps', url: null, contact: { name: 'Maria', whatsapp: 'yes' }, fit_score: 70, scored: false }] };
  const drafted = await new StarterAgent().generateBrief(withCandidate);
  assert.deepEqual(drafted.rankings.map((r) => r.id), ['c1'], 'ranks the candidate');
  // It ranks, and that is all. Auto-drafting an opener the moment a candidate
  // appears is how a send queue reaches forty-one; the candidate now goes to the
  // deck, where "Draft it" is a decision somebody made and the queue gate
  // applies. openerTemplate is still covered above, on the path that uses it.
  assert.equal((drafted as unknown as Record<string, unknown>).plan, undefined);
  assert.match(drafted.insight.body, /1 real match/);

  // Same reachable candidate, blank offer: nothing is drafted. The live account
  // had 44 openers written from nothing and sent none of them.
  const blank: ContextPack = { ...withCandidate, profile: { ...withCandidate.profile, offer: {} } };
  const gated = await new StarterAgent().generateBrief(blank);
  assert.equal((gated as unknown as Record<string, unknown>).plan, undefined, 'nothing is drafted from an empty offer');
  assert.match(gated.insight.body, /until you say what you sell/, 'the insight says why nothing is drafted');
  assert.deepEqual(gated.rankings.map((r) => r.id), ['c1'], 'ranking still happens — only drafting waits');
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

  // Normaliser: rankings survive and are clamped, junk does not.
  //
  // This used to assert that a plan item carrying ai_draft + opportunity_ref +
  // channel survived, because that was how the agent auto-drafted an opener into
  // the queue. That path is gone on purpose: a model writing five openers a night
  // into a queue nobody empties is how a queue reaches forty-one. Drafting is now
  // only ever deliberate — the deck's "Draft it" and the draft button — and both
  // are gated on the send queue.
  const b = normalizeBrief({
    insight: { body: 'x' },
    rankings: [{ id: 'abc', fit_score: 130, reason: 'r' }, { fit_score: 50 }, { id: 'def', fit_score: '42' }],
    plan: [{ owner: 'ai', title: 'Opener', ai_draft: 'hi', opportunity_ref: 'abc', channel: 'whatsapp' }],
  });
  assert.equal(b.rankings.length, 2, 'ranking without id dropped');
  assert.equal(b.rankings[0].fit_score, 100); assert.equal(b.rankings[1].fit_score, 42);
  assert.equal((b as unknown as Record<string, unknown>).plan, undefined, 'a drafted plan item can no longer reach the queue through the brief');

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
import { MIN_SAMPLE, MIN_WEEKLY, openingGap, openingTrend, diagnose, isoWeekKey, segmentOpenings, segmentOf } from '../../src/lib/copilot/diagnose';

async function growth() {
  const opp = (id: string, over: Partial<{ source: string; source_kind: 'sourced' | 'inferred'; data: Record<string, unknown>; created_at: string }> = {}) =>
    ({ id, status: 'new' as const, source: over.source ?? 'google_maps', source_kind: over.source_kind ?? 'sourced' as const, data: over.data ?? {}, reason: '', title: id, created_at: over.created_at ?? '2026-09-01T00:00:00Z' });
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
  const gap = openingGap(withTags, { sells: 'brand identity systems' });
  assert.equal(gap[0].term, 'voice ai');
  assert.equal(gap[0].count, 3, 'counted once per opportunity, inferred rows excluded');
  assert.ok(!gap.some((g) => g.term === 'no website'), 'below MIN_OPENING');
  // A term already in the offer is not a gap.
  assert.equal(openingGap(withTags, { sells: 'voice ai intake systems' }).some((g) => g.term === 'voice ai'), false);

  const openingDiag = diagnose({ opportunities: withTags, executions: [], outcomes: [], offer: { sells: 'brand identity' } });
  const df = openingDiag.findings.find((f) => f.kind === 'opening')!;
  assert.match(df.headline, /3 of your matches have "voice ai" in common, and nothing you send names it/);
  assert.equal(df.topic, 'voice ai');
  // With one term the detail must not just restate the headline.
  assert.doesNotMatch(df.detail, /^voice ai \(3\)/, 'single term is not echoed back');
  // An opening is a condition observed at the prospect. Nothing in this finding
  // may claim anyone asked for it — that framing is the bug this read had for
  // months, and it is the one thing a rewrite could quietly put back.
  assert.match(df.detail, /not a request anyone made/);
  for (const text of [df.headline, df.detail, df.action ?? '']) {
    assert.doesNotMatch(text, /asking for|asked for|wants|demand/i, `no demand language: ${text}`);
  }
  const twoTerms = diagnose({ opportunities: [...withTags, opp('t6', { data: { tags: ['seo', 'voice ai'] } }), opp('t7', { data: { tags: ['seo'] } }), opp('t8', { data: { tags: ['seo'] } })], executions: [], outcomes: [], offer: { sells: 'brand identity' } });
  assert.match(twoTerms.findings.find((f) => f.kind === 'opening')!.detail, /Also common: seo \(3\)/, 'extra terms listed only when they exist');

  // 6. Every rate shown is real: no finding may contain an uncomputed number.
  for (const d of [none, big, fair, src, openingDiag]) {
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

  // 9. The stuck point itself, which is what the edge is computed from. The
  //    model-written lesson that used to hang off it is gone — it needed a real
  //    URL and almost never had one — but the finding it depended on is real and
  //    still has to name a topic or the edge has nothing to be about.
  assert.ok(openingDiag.findings.some((f) => f.topic), 'a stuck point names what it is about');
  assert.equal(none.findings.some((f) => f.topic), false, 'nothing stuck names nothing');

  // 10. ISO weeks. Monday-based; the week with the year's first Thursday is W01.
  assert.equal(isoWeekKey(new Date('2026-01-01T12:00:00Z')), '2026-W01');
  assert.equal(isoWeekKey(new Date('2025-12-29T12:00:00Z')), '2026-W01', 'the Monday before New Year already belongs to 2026');
  assert.equal(isoWeekKey(new Date('2027-01-01T12:00:00Z')), '2026-W53', '2026 starts on a Thursday, so it has 53 weeks');
  assert.equal(isoWeekKey(new Date('2026-09-06T23:59:00Z')), '2026-W36', 'Sunday closes the week');
  assert.equal(isoWeekKey(new Date('2026-09-07T00:00:00Z')), '2026-W37', 'Monday opens the next');

  // 11. Demand over time. `now` is Sunday 6 Sep 2026 (W36); previous four weeks are W32–W35.
  const now = new Date('2026-09-06T12:00:00Z');
  const thisWk = '2026-09-02T10:00:00Z';                       // W36
  const prevWks = ['2026-08-05T10:00:00Z', '2026-08-12T10:00:00Z', '2026-08-19T10:00:00Z', '2026-08-26T10:00:00Z']; // W32..W35
  const tagged = (id: string, tag: string, created_at: string, extra: Record<string, unknown> = {}) => opp(id, { data: { tags: [tag], ...extra }, created_at });
  const trendOpps = [
    // "new": three this week, nothing before
    tagged('n1', 'voice ai', thisWk), tagged('n2', 'voice ai', thisWk), tagged('n3', 'voice ai', thisWk),
    // "rising": four this week against one a week before
    ...prevWks.map((d, i) => tagged(`r${i}`, 'facebook ads', d)),
    tagged('r4', 'facebook ads', thisWk), tagged('r5', 'facebook ads', thisWk), tagged('r6', 'facebook ads', thisWk), tagged('r7', 'facebook ads', thisWk),
    // "steady": one this week against one a week — below MIN_WEEKLY either side
    ...prevWks.map((d, i) => tagged(`s${i}`, 'renovation', d)), tagged('s4', 'renovation', thisWk),
    // "falling": three a week before, none this week
    ...prevWks.flatMap((d, i) => [0, 1, 2].map((j) => tagged(`f${i}${j}`, 'no website', d))),
    // noise that must be ignored
    tagged('inf', 'voice ai', thisWk, {}), // overwritten below to inferred
    opp('seg', { data: { tags: ['pest control'], segment: 'pest control' }, created_at: thisWk }),
    tagged('off', 'landing pages', thisWk),
  ];
  trendOpps[trendOpps.length - 3] = { ...trendOpps[trendOpps.length - 3], source_kind: 'inferred' as const };
  const tr = openingTrend(trendOpps, { sells: 'landing pages' }, { now, targetSegments: ['pest control'] });
  const by = Object.fromEntries(tr.map((t) => [t.term, t]));
  assert.equal(by['voice ai'].trend, 'new'); assert.equal(by['voice ai'].count, 3, 'the inferred row did not count');
  assert.equal(by['facebook ads'].trend, 'rising'); assert.equal(by['facebook ads'].thisWeek, 4); assert.equal(by['facebook ads'].prevWeeklyAvg, 1);
  assert.equal(by['renovation'].trend, 'steady', `one a week is below MIN_WEEKLY=${MIN_WEEKLY} on both sides`);
  assert.equal(by['no website'].trend, 'falling'); assert.equal(by['no website'].thisWeek, 0); assert.equal(by['no website'].prevWeeklyAvg, 3);
  assert.equal(by['landing pages'], undefined, 'a term already in the offer is not openings');
  assert.equal(by['pest control'], undefined, 'a target segment is targeting, not openings');
  assert.ok(tr.length <= 5, 'top five only');
  assert.equal(tr[0].term, 'no website', 'sorted by all-time count first');
  // The old shape still works for callers that only want counts.
  assert.deepEqual(openingGap(trendOpps, { sells: 'landing pages' }).map((g) => g.term), tr.map((t) => t.term));

  // 12. Per-segment: segment, then service_type, then a target segment named in category.
  const seg = [
    opp('a1', { data: { segment: 'Pest_Control', tags: ['facebook ads', 'no website'] } }),
    opp('a2', { data: { segment: 'pest control', tags: ['facebook ads'] } }),
    opp('b1', { data: { service_type: 'staycation', tags: ['facebook ads'] } }),
    opp('c1', { data: { category: 'Plumbing contractor in Manila', tags: ['renovation'] } }),
    opp('d1', { data: { tags: ['renovation'] } }),                       // no segment at all: not grouped
    opp('e1', { source_kind: 'inferred', data: { segment: 'pest control', tags: ['facebook ads'] } }),
  ];
  assert.equal(segmentOf(seg[0], []), 'pest control', 'normalised: lower case, underscores to spaces');
  assert.equal(segmentOf(seg[2], []), 'staycation');
  assert.equal(segmentOf(seg[3], ['plumbing']), 'plumbing', 'a target segment found inside the category');
  assert.equal(segmentOf(seg[4], ['plumbing']), null);
  const sd = segmentOpenings(seg, { sells: 'landing pages' }, ['plumbing']);
  assert.deepEqual(sd.map((s) => s.segment), ['pest control', 'staycation', 'plumbing'], 'most businesses first; inferred and ungrouped rows excluded');
  assert.equal(sd[0].businesses, 2);
  assert.deepEqual(sd[0].openings[0], { term: 'facebook ads', count: 2 });
  assert.ok(!sd[0].openings.some((w) => w.term === 'pest control'), 'a segment is never its own opening');
  // And a term's own segment list points back the same way.
  assert.deepEqual(openingTrend(seg, { sells: 'landing pages' }, { now, targetSegments: ['plumbing'] }).find((t) => t.term === 'facebook ads')!.segments[0], { segment: 'pest control', count: 2 });

  // 13. The lesson gate still sees the opening finding with its topic.
  assert.ok(diagnose({ opportunities: trendOpps, executions: [], outcomes: [], offer: { sells: 'landing pages' }, now }).findings.some((f) => f.kind === 'opening' && f.topic));

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

  // 8. Only paid supply is metered. Charging for a RemoteOK listing would be
  //    charging for an HTTP request, and onboarding pulls free sources first —
  //    metering those spent a new user's whole free month on day one.
  const { ADAPTERS } = await import('../../src/lib/copilot/supply');
  const billable = ADAPTERS.filter((a) => a.billable).map((a) => a.key);
  const free = ADAPTERS.filter((a) => !a.billable).map((a) => a.key);
  assert.deepEqual(billable, ['google_maps'], 'scraping credits are the only per-match cost');
  assert.deepEqual(free.sort(), ['hunter', 'remote'], 'the shared pipeline and public listings are free to serve');

  // 9. Nothing is advertised that cannot be switched on. send_mode has no route
  //    behind it, so API sending must not appear in the pricing copy.
  for (const p of Object.values(PLANS)) {
    assert.ok(!p.features.some((f) => /verified address|send.*email.*from your own/i.test(f)),
      `${p.key} advertises API sending, which nothing in the app can enable`);
  }

  console.log('copilot-core: plans-and-billing checks passed');
}

billing().catch((e) => { console.error(e); process.exit(1); });

// ─── The offer gate: nothing is drafted from a blank ────────────────────────
async function sending() {
  // 1. Empty means no `sells`. Whitespace is empty. Anything else is an offer.
  assert.equal(offerIsEmpty(undefined), true);
  assert.equal(offerIsEmpty(null), true);
  assert.equal(offerIsEmpty({}), true);
  assert.equal(offerIsEmpty({ sells: '   ' }), true);
  assert.equal(offerIsEmpty({ for_who: 'resorts', problem: 'no bookings' }), true, 'who and problem without sells is still not an offer');
  assert.equal(offerIsEmpty({ sells: 'landing pages' }), false);

  // 2. Only changes that alter what a message would say count as material.
  const base = { sells: 'Landing pages', for_who: 'studios', problem: 'ads with no page', price_band: '$500', proof_url: 'https://x.y/a' };
  assert.equal(offerChangedMaterially(base, { ...base, price_band: '$900' }), false, 'price band never appears in an opener');
  assert.equal(offerChangedMaterially(base, { ...base, sells: '  landing PAGES ' }), false, 'case and whitespace are not a rewrite');
  assert.equal(offerChangedMaterially(base, { ...base, problem: 'no website at all' }), true, 'the problem is in every hook');
  assert.equal(offerChangedMaterially(base, { ...base, proof_url: undefined }), true, 'losing the proof link changes the ask');
  assert.equal(offerChangedMaterially({}, { sells: 'x' }), true, 'first ever offer is material');
  assert.equal(offerChangedMaterially(undefined, {}), false, 'blank to blank is nothing');

  // 3. Adding an opening: appended, deduped, capped — and only ever to `problem`.
  //
  //    The terms are conditions a scraper observed at the prospect. This used to
  //    append them to `sells`, which turned "WhatsApp automations" into
  //    "WhatsApp automations, no website" — an offer describing a business the
  //    user does not run. What they sell is not this function's to touch.
  assert.equal(addOpeningToOffer({ problem: 'ads with no page' }, 'facebook ads').problem, 'ads with no page, facebook ads');
  assert.equal(addOpeningToOffer({}, 'facebook ads').problem, 'facebook ads', 'first term stands alone');
  assert.equal(addOpeningToOffer({ problem: 'ads, facebook ads' }, 'Facebook Ads').problem, 'ads, facebook ads', 'case-insensitive dedupe');
  assert.equal(addOpeningToOffer({ problem: 'x' }, '   ').problem, 'x', 'blank term is a no-op');
  const long = { problem: 'a'.repeat(PROBLEM_MAX - 5) };
  assert.equal(addOpeningToOffer(long, 'facebook ads').problem, long.problem, 'never overflows the column');
  const untouched = { sells: 'landing pages', problem: 'p' };
  assert.deepEqual(addOpeningToOffer(untouched, 'no website'), { sells: 'landing pages', problem: 'p, no website' }, 'what they sell is never touched');
  assert.equal(addOpeningToOffer({ sells: 'landing pages' }, 'no website').sells, 'landing pages', 'not even when problem is blank');
  // A material change, so the waiting drafts are rewritten to lead with it.
  assert.equal(offerChangedMaterially({ sells: 'x' }, addOpeningToOffer({ sells: 'x' }, 'no website')), true);

  console.log('copilot-core: offer-gate checks passed');
}

sending().catch((e) => { console.error(e); process.exit(1); });

// ─── Pipeline stages: where each real business actually is ──────────────────
import { STAGE_ORDER, groupPipeline, stageOf } from '../../src/lib/copilot/pipeline';

async function pipeline() {
  const ex = (approval_state: 'needs_approval' | 'approved' | 'failed' | 'sent' | 'cancelled') => ({ approval_state });

  // 1. The latest outcome wins; a send only matters when nothing came back.
  assert.equal(stageOf({ last_outcome: 'won' }, ex('sent')), 'won');
  assert.equal(stageOf({ last_outcome: 'lost' }, ex('sent')), 'lost');
  assert.equal(stageOf({ last_outcome: 'meeting' }, ex('sent')), 'meeting');
  assert.equal(stageOf({ last_outcome: 'proposal' }, null), 'meeting', 'a proposal is the meeting stage');
  assert.equal(stageOf({ last_outcome: 'reply' }, null), 'replied', 'a reply logged outside the app still counts');
  assert.equal(stageOf({ last_outcome: 'no_reply' }, null), 'sent', 'no reply implies a send even when the app did not do it');
  assert.equal(stageOf({ last_outcome: null }, ex('sent')), 'sent');
  for (const s of ['needs_approval', 'approved', 'failed'] as const) assert.equal(stageOf({}, ex(s)), 'to_send', `${s} is still the user's to send`);
  assert.equal(stageOf({}, ex('cancelled')), 'not_drafted', 'a cancelled draft is as good as none');
  assert.equal(stageOf({}, null), 'not_drafted');
  assert.equal(stageOf({ last_outcome: 'won' }, null), 'won', 'a win with no send behind it is still a win');

  // 2. Grouping follows display order and drops empty stages.
  const rows = [
    { id: 'a', stage: stageOf({}, null) },
    { id: 'b', stage: stageOf({ last_outcome: 'won' }, null) },
    { id: 'c', stage: stageOf({}, ex('needs_approval')) },
    { id: 'd', stage: stageOf({}, ex('needs_approval')) },
    { id: 'e', stage: stageOf({ last_outcome: 'reply' }, ex('sent')) },
  ];
  const groups = groupPipeline(rows);
  assert.deepEqual(groups.map((g) => g.stage), ['to_send', 'replied', 'won', 'not_drafted'], 'display order, empties dropped');
  assert.deepEqual(groups[0].rows.map((r) => r.id), ['c', 'd'], 'rows keep their order inside a stage');
  assert.deepEqual(groupPipeline([]), []);
  assert.equal(STAGE_ORDER[0], 'to_send', 'the ones needing a tap come first');
  assert.equal(STAGE_ORDER[STAGE_ORDER.length - 1], 'not_drafted', 'the untouched pile comes last');

  console.log('copilot-core: pipeline checks passed');
}

pipeline().catch((e) => { console.error(e); process.exit(1); });


// ─────────────────────────────────────────────────────────────────────────────
// Two shells, one app
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { DEFAULT_SHELL, SHELLS, shellOf, toShell } from '../../src/lib/copilot/shell';

async function shells() {
  // 1. Which shell a path belongs to. Anything not under /lifeos is the bold one,
  //    including the pages that live outside both (/, /pricing on the main site).
  assert.equal(shellOf('/lifeos'), '/lifeos');
  assert.equal(shellOf('/lifeos/pricing'), '/lifeos');
  assert.equal(shellOf('/copilot'), '/copilot');
  assert.equal(shellOf('/copilot/login'), '/copilot');
  assert.equal(shellOf(null), DEFAULT_SHELL);
  assert.equal(shellOf(undefined), DEFAULT_SHELL);
  assert.equal(shellOf('/'), DEFAULT_SHELL);

  // 2. toShell guards a redirect target. The Stripe success_url is built by
  //    concatenating this onto the app origin, so anything not on the list has to
  //    collapse to the default rather than travel through.
  for (const s of SHELLS) assert.equal(toShell(s), s);
  for (const hostile of ['https://evil.example', '//evil.example', '/lifeos/../../evil', 'lifeos', '/lifeosX', '', ' /lifeos', null, undefined, 7, {}, ['/lifeos']]) {
    assert.equal(toShell(hostile), DEFAULT_SHELL, `toShell should refuse ${JSON.stringify(hostile)}`);
  }

  // 3. The calm theme is additive: every rule in it is scoped to
  //    [data-theme="soft"], so /copilot cannot regress from anything /lifeos adds.
  const css = readFileSync(new URL('../../src/app/copilot/copilot.css', import.meta.url), 'utf8');
  const marker = '/lifeos — the calm theme';
  const at = css.indexOf(marker);
  assert.ok(at > 0, 'the soft theme block should still be in copilot.css');
  const block = css.slice(at).replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  let buf = '';
  let rules = 0;
  for (const ch of block) {
    if (ch === '{') {
      const sel = buf.trim().replace(/\s+/g, ' ');
      if (sel && !sel.startsWith('@')) {
        rules++;
        assert.ok(sel.includes('[data-theme="soft"]'), `unscoped rule in the soft theme: ${sel}`);
      }
      depth++; buf = '';
    } else if (ch === '}') {
      depth--; buf = '';
    } else {
      buf += ch;
    }
  }
  assert.equal(depth, 0, 'braces in the soft theme block should balance');
  assert.ok(rules > 40, `expected the soft theme to actually restyle the app, saw ${rules} rules`);

  console.log('copilot-core: two-shells checks passed');
}

shells().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// The call, and whether it was right
// ─────────────────────────────────────────────────────────────────────────────
import {
  MIN_TOPIC_RUN, VERIFY_AFTER_DAYS, changesSince, decisionReview, metricValue,
  movedBy, snapshotOf, starterDecision, verdictOf,
  type Decision, type DecisionResponse, type DecisionMetric,
} from '../../src/lib/copilot/decision';
import type { Metrics } from '../../src/lib/copilot/types';

function metrics(over: Partial<Metrics> = {}): Metrics {
  return {
    window_days: 30, sent: 0, replies: 0, reply_rate: null, meetings: 0, won: 0, won_amount: 0,
    lost: 0, awaiting_approval: 0, pipeline: { new: 0, saved: 0, sourced: 0, inferred: 0 },
    runway_months: null, ...over,
  };
}

/** Only the fields verdictOf and decisionReview actually read. */
const call = (response: DecisionResponse, over: { topic?: string; metric?: DecisionMetric; baseline?: number; after?: number | null } = {}) => ({
  topic: over.topic ?? null,
  response,
  verify: { metric: over.metric ?? 'sent' as DecisionMetric, baseline: over.baseline ?? 0, after: over.after ?? null, verifiedAt: null },
}) as Pick<Decision, 'topic' | 'response' | 'verify'>;

async function decisions() {
  // ── 1. What changed: only what moved, and never on the first brief ────────
  const before = snapshotOf(metrics({ sent: 3, replies: 0, awaiting_approval: 7, runway_months: 3.4 }));
  const after = snapshotOf(metrics({ sent: 5, replies: 1, awaiting_approval: 5, runway_months: 3.1 }));
  assert.deepEqual(changesSince(null, after), [], 'the first brief has nothing to compare against');
  assert.deepEqual(changesSince(before, before), [], 'a still week reports no change, not four zeros');
  const changed = changesSince(before, after);
  assert.equal(changed[0].what, 'Runway', 'the constraint is read first');
  assert.deepEqual(changed[0], { what: 'Runway', from: '3.4 mo', to: '3.1 mo' });
  assert.ok(changed.some((c) => c.what === 'Replies' && c.from === '0' && c.to === '1'));
  assert.ok(changed.findIndex((c) => c.what === 'Replies') < changed.findIndex((c) => c.what === 'Sent'), 'outcomes outrank effort');
  assert.ok(changed.length <= 4);
  // A null runway on one side is not a change from nothing to nothing.
  assert.deepEqual(changesSince(snapshotOf(metrics({ sent: 1 })), snapshotOf(metrics({ sent: 1 }))), []);

  // ── 2. Grading is against the ledger, not against how it felt ─────────────
  assert.equal(verdictOf(call('pending')), 'open');
  assert.equal(verdictOf(call('rejected')), 'rejected');
  assert.equal(verdictOf(call('ignored')), 'ignored');
  assert.equal(verdictOf(call('wrong')), 'wrong');
  assert.equal(verdictOf(call('did')), 'measuring', 'done but not read back yet');
  assert.equal(verdictOf(call('did', { metric: 'none' })), 'done', 'nothing measurable to wait for');
  assert.equal(verdictOf(call('did', { baseline: 4, after: 9 })), 'worked');
  assert.equal(verdictOf(call('did', { baseline: 4, after: 4 })), 'no_movement');
  // The metric window rolls, so a value can fall. Falling is not working.
  assert.equal(verdictOf(call('did', { baseline: 9, after: 4 })), 'no_movement');
  assert.equal(movedBy(call('did', { baseline: 4, after: 9 })), 5);
  assert.equal(movedBy(call('did')), null, 'unread is null, never 0');
  assert.equal(metricValue(metrics({ won_amount: 1200 }), 'won_amount'), 1200);
  assert.equal(metricValue(metrics({ sent: 3 }), 'none'), 0);

  // ── 3. The record read back ───────────────────────────────────────────────
  assert.equal(decisionReview([]).line, null);
  assert.equal(decisionReview([call('did', { baseline: 0, after: 2 })]).line, null, 'one call is not a pattern');

  // Recommended three times, never once acted on.
  const avoided = decisionReview([
    call('ignored', { topic: 'sending' }), call('ignored', { topic: 'sending' }), call('rejected', { topic: 'sending' }),
    call('did', { topic: 'opener', baseline: 0, after: 1 }),
  ]);
  assert.equal(avoided.avoidedTopic?.topic, 'sending');
  assert.equal(avoided.avoidedTopic?.count, MIN_TOPIC_RUN);
  assert.match(avoided.line ?? '', /3 of your last 4 calls were about sending/);
  assert.equal(avoided.deadTopic, null, 'never acted on is not the same as never worked');

  // Acted on three times and the number never moved.
  const dead = decisionReview([
    call('did', { topic: 'lead volume', baseline: 5, after: 5 }),
    call('did', { topic: 'lead volume', baseline: 5, after: 5 }),
    call('did', { topic: 'lead volume', baseline: 5, after: 4 }),
    call('did', { topic: 'opener', baseline: 0, after: 3 }),
  ]);
  assert.equal(dead.deadTopic?.topic, 'lead volume');
  assert.match(dead.line ?? '', /You did them and the number did not move/);
  assert.equal(dead.worked, 1);
  assert.equal(dead.noMovement, 3);

  // A topic that ever worked is not dead, however often it is repeated.
  const alive = decisionReview([
    call('did', { topic: 'sending', baseline: 0, after: 4 }),
    call('did', { topic: 'sending', baseline: 4, after: 4 }),
    call('did', { topic: 'sending', baseline: 4, after: 4 }),
    call('did', { topic: 'sending', baseline: 4, after: 4 }),
  ]);
  assert.equal(alive.deadTopic, null);
  assert.match(alive.line ?? '', /1 of your last 4 calls moved the number/);

  const lazy = decisionReview([call('ignored'), call('ignored'), call('ignored'), call('ignored')]);
  assert.match(lazy.line ?? '', /A call nobody makes is not a call/);

  // ── 4. The deterministic ladder ───────────────────────────────────────────
  const ladder = (m: Partial<Metrics>, over: { candidates?: number; offerEmpty?: boolean; hasSegments?: boolean } = {}) =>
    starterDecision({ metrics: metrics(m), candidates: over.candidates ?? 5, offerEmpty: over.offerEmpty ?? false, hasSegments: over.hasSegments ?? true });

  // A blank offer outranks everything: nothing below it can produce a message.
  const blank = ladder({ pipeline: { new: 0, saved: 0, sourced: 12, inferred: 0 }, awaiting_approval: 4 }, { offerEmpty: true });
  assert.equal(blank.decision.topic, 'offer');
  assert.match(blank.decision.headline, /^Say what you sell/);
  assert.equal(blank.decision.verify_metric, 'sent');

  // A broken opener outranks an unsent queue: more sends make it worse.
  const broken = ladder({ sent: 12, replies: 0, awaiting_approval: 7 });
  assert.equal(broken.decision.topic, 'opener');
  assert.equal(broken.decision.verify_metric, 'replies');
  assert.equal(broken.decision.confidence, 'high');
  assert.match(broken.decision.instead_of ?? '', /7 drafts/);

  // Under ten sends the same call is honestly unsure, and says what would settle it.
  const thin = ladder({ sent: 6, replies: 0 });
  assert.equal(thin.decision.confidence, 'low');
  assert.match(thin.decision.missing ?? '', /Ten sends/);

  // A reply nobody followed up beats any amount of new outreach.
  const warm = ladder({ sent: 20, replies: 3, meetings: 0, awaiting_approval: 9 });
  assert.equal(warm.decision.topic, 'converting');
  assert.equal(warm.decision.verify_metric, 'meetings');

  // The live account's actual state: drafted plenty, sent nothing.
  const stuck = ladder({ sent: 0, awaiting_approval: 7, pipeline: { new: 96, saved: 0, sourced: 140, inferred: 0 } });
  assert.equal(stuck.decision.topic, 'sending');
  assert.match(stuck.decision.headline, /Send the 7 drafts already written/);
  assert.match(stuck.decision.instead_of ?? '', /Another match search/);
  assert.ok(stuck.decision.because.some((b) => /7 drafted, 0 sent/.test(b)), 'every line cites a real number');

  // A short runway changes the reasoning, not the call.
  const broke = ladder({ awaiting_approval: 2, runway_months: 2.1 });
  assert.ok(broke.decision.because.some((b) => /Runway is 2.1 months/.test(b)));

  assert.equal(ladder({}, { hasSegments: false }).decision.topic, 'targeting');
  assert.equal(ladder({}, { candidates: 0 }).decision.topic, 'supply');
  // Nothing wrong, nothing waiting: start.
  const fresh = ladder({});
  assert.equal(fresh.decision.topic, 'sending');
  assert.equal(fresh.decision.confidence, 'low', 'a first move is not a measured one');
  // Every rung names a real alternative, or it is not a decision.
  for (const l of [blank, broken, thin, warm, stuck, fresh]) {
    assert.ok(l.decision.instead_of, `${l.decision.topic} must name what it rules out`);
    assert.ok(l.decision.because.length > 0);
    assert.ok(l.decision.headline.length < 90, 'a headline is one move, not a paragraph');
  }

  // ── 5. Agent output is never trusted ──────────────────────────────────────
  const base = { insight: { body: 'x' }, rankings: [], plan: [], nudges: [], opportunities: [], skills: [], lessons: [] };
  // No headline is no decision: the caller falls back to the ladder rather than
  // rendering an empty card.
  assert.equal(normalizeBrief({ ...base, decision: { because: ['a'] } }).decision, null);
  assert.equal(normalizeBrief(base).decision, null);
  assert.equal(normalizeBrief({ ...base, decision: 'send things' }).decision, null);

  const ok = normalizeBrief({
    ...base,
    decision: {
      headline: 'Send the five drafts.', because: ['a', 'b', 'c', 'd', 'e'],
      instead_of: 'Another search', confidence: 'nonsense', missing: 'more sends',
      topic: 'SENDING', verify_metric: 'clicks',
    },
    dont: { title: 'Do not search', why: 'You have 96.' },
  });
  assert.equal(ok.decision?.because.length, 3, 'because is capped');
  assert.equal(ok.decision?.confidence, 'high', 'an unknown confidence is not treated as unsure');
  assert.equal(ok.decision?.missing, undefined, 'a high-confidence call carries no missing fact');
  assert.equal(ok.decision?.topic, 'sending', 'topics are grouped case-insensitively');
  assert.equal(ok.decision?.verify_metric, 'none', 'an unknown metric grades nothing rather than guessing');
  assert.equal(ok.dont?.title, 'Do not search');

  const unsure = normalizeBrief({ ...base, decision: { headline: 'h', confidence: 'low', missing: 'a bigger sample' } });
  assert.equal(unsure.decision?.missing, 'a bigger sample');
  assert.deepEqual(unsure.decision?.because, [], 'no evidence is an empty list, not a fabricated one');
  // A dont with no title is no dont.
  assert.equal(normalizeBrief({ ...base, dont: { why: 'because' } }).dont, null);

  // The ladder never emits a `dont`. Every version that did restated instead_of
  // in the imperative, which cost a whole card on Today to say one sentence
  // twice. The field survives for a model that can name something different.
  for (const l of [blank, broken, thin, warm, stuck, fresh]) {
    assert.equal(l.dont, null, `${l.decision.topic} must not restate its own trade-off`);
  }

  assert.equal(VERIFY_AFTER_DAYS, 3);
  console.log('copilot-core: decision checks passed');
}

decisions().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// Signing in: a link nothing else can spend
// ─────────────────────────────────────────────────────────────────────────────
import { signInLink } from '../../src/lib/copilot/auth';
import { describeDbError } from '../../src/lib/copilot/db';

async function signin() {
  // 1. The shell rides on the link, and only when it is not the default — the
  //    bold shell must keep the shorter URL it has always had.
  assert.equal(signInLink('https://launchfly.ai', 'abc'), 'https://launchfly.ai/api/copilot/auth/callback?token=abc');
  assert.equal(signInLink('https://launchfly.ai/', 'abc'), 'https://launchfly.ai/api/copilot/auth/callback?token=abc', 'a trailing slash must not double up');
  assert.equal(signInLink('https://launchfly.ai', 'abc', '/copilot'), 'https://launchfly.ai/api/copilot/auth/callback?token=abc');
  assert.equal(signInLink('https://launchfly.ai', 'abc', '/lifeos'), 'https://launchfly.ai/api/copilot/auth/callback?token=abc&shell=%2Flifeos');

  // 2. Tokens are base64url, which contains characters a query string cares
  //    about. An unescaped one silently signs nobody in.
  const raw = 'a+b/c=d&e';
  const link = signInLink('https://launchfly.ai', raw);
  assert.ok(!link.includes('a+b/c=d&e'), 'the token must be escaped');
  assert.equal(new URL(link).searchParams.get('token'), raw, 'and must survive the round trip');

  // 3. The failure the user actually sees names the cause, rather than blaming
  //    a migration for everything.
  assert.match(describeDbError({ code: '42703', message: 'column "plan" does not exist' }), /missing something this needs — column "plan" does not exist/);
  assert.match(describeDbError({ code: '42P01', message: 'relation "copilot_decisions" does not exist' }), /supabase\/migrations/);
  assert.match(describeDbError({ code: '23505' }), /Sign in instead/);
  assert.doesNotMatch(describeDbError({ code: '23505' }), /migration/, 'a duplicate row is not a migration problem');
  assert.match(describeDbError({ code: '42501' }), /service key/);

  // PostgREST answers before Postgres does, and its message names the column.
  // Dropping it left the live failure reading "(database error PGRST204)" —
  // a code with the diagnosis stripped out of it.
  const pgrst = describeDbError({ code: 'PGRST204', message: "Could not find the 'offer' column of 'copilot_profiles' in the schema cache" });
  assert.match(pgrst, /Could not find the 'offer' column/, 'the column name is the whole diagnosis');
  assert.match(pgrst, /supabase\/migrations/);
  assert.match(pgrst, /NOTIFY pgrst, 'reload schema'/, 'the column may exist and the cache be stale');
  assert.match(describeDbError({ code: 'PGRST205', message: "Could not find the table 'public.copilot_decisions'" }), /copilot_decisions/);
  // An unknown code still carries the code, because that is the part worth
  // pasting into a search. It must not carry the raw message.
  assert.equal(describeDbError({ code: 'XX000', message: 'internal detail' }, 'Could not create your copilot.'), 'Could not create your copilot. (database error XX000)');
  assert.equal(describeDbError(null, 'Could not create your copilot.'), 'Could not create your copilot.');
  assert.equal(describeDbError(new Error('boom'), 'Nope.'), 'Nope.');

  console.log('copilot-core: sign-in checks passed');
}

signin().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// The agent must fail fast, not hang
// ─────────────────────────────────────────────────────────────────────────────
import { budgetForReason, cronTimeoutMs, extraBody, maxOutputTokens, timeoutMs } from '../../src/lib/copilot/agent/llm';

async function agentLimits() {
  const env = { ...process.env };
  const reset = () => { for (const k of ['COPILOT_AI_TIMEOUT_MS', 'COPILOT_AI_CRON_TIMEOUT_MS', 'COPILOT_AI_MAX_OUTPUT_TOKENS', 'COPILOT_AI_EXTRA_BODY']) delete process.env[k]; };

  // 1. A bounded default, always. An unbounded call is what produced the 504:
  //    the generation ran for five minutes, the proxy gave up, and the user got
  //    nothing while the tokens were billed anyway.
  reset();
  assert.equal(timeoutMs(), 30_000, 'there must always be a limit');
  assert.ok(timeoutMs() < 90_000, 'and it must sit below the route maxDuration so the starter still has room');

  process.env.COPILOT_AI_TIMEOUT_MS = '20000';
  assert.equal(timeoutMs(), 20_000);
  // Nonsense must not disable the bound.
  for (const bad of ['0', '-1', 'soon', '', 'NaN']) {
    process.env.COPILOT_AI_TIMEOUT_MS = bad;
    assert.equal(timeoutMs(), 30_000, `"${bad}" should fall back to the default, not remove the limit`);
  }

  // 2. The token cap is opt-in; absent means absent, never zero.
  reset();
  assert.equal(maxOutputTokens(), undefined);
  process.env.COPILOT_AI_MAX_OUTPUT_TOKENS = '4000';
  assert.equal(maxOutputTokens(), 4000);
  process.env.COPILOT_AI_MAX_OUTPUT_TOKENS = 'lots';
  assert.equal(maxOutputTokens(), undefined, 'an unparseable cap is no cap, not a cap of zero');

  // 3. Endpoint-specific body fields, and never a crash from a typo in an env var.
  reset();
  assert.equal(extraBody(), null);
  process.env.COPILOT_AI_EXTRA_BODY = '{"reasoning":{"effort":"low"}}';
  assert.deepEqual(extraBody(), { reasoning: { effort: 'low' } });
  for (const bad of ['{oops', '[1,2]', '"a string"', 'null', '  ']) {
    process.env.COPILOT_AI_EXTRA_BODY = bad;
    assert.equal(extraBody(), null, `${bad} must be ignored, not thrown`);
  }

  // 4. The two budgets are separate, because the two callers are.
  //    Sharing them is not hypothetical: production ran for weeks with every
  //    nightly generation aborted at exactly 30.0s and falling back to the
  //    starter, while the model was answering perfectly well — the 30s exists
  //    only because a tap sits behind Traefik, and the cron does not.
  reset();
  assert.equal(budgetForReason('cron'), 120_000, 'the nightly run is not behind the proxy');
  for (const reason of ['manual', 'offer', 'note', 'onboard', '']) {
    assert.equal(budgetForReason(reason), 30_000, `"${reason}" is a tap and must take the short budget`);
  }
  assert.ok(cronTimeoutMs() > timeoutMs(), 'the cron must never be the more impatient of the two');

  // Tuning one must not silently move the other.
  process.env.COPILOT_AI_TIMEOUT_MS = '45000';
  assert.equal(budgetForReason('manual'), 45_000);
  assert.equal(budgetForReason('cron'), 120_000, 'the interactive knob must not reach the cron');
  reset();
  process.env.COPILOT_AI_CRON_TIMEOUT_MS = '240000';
  assert.equal(budgetForReason('cron'), 240_000);
  assert.equal(budgetForReason('manual'), 30_000, 'and the cron knob must not reach a tap');
  for (const bad of ['0', '-1', 'later', '', 'NaN']) {
    process.env.COPILOT_AI_CRON_TIMEOUT_MS = bad;
    assert.equal(budgetForReason('cron'), 120_000, `"${bad}" should fall back, not remove the limit`);
  }

  process.env = env;
  console.log('copilot-core: agent-limits checks passed');
}

agentLimits().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// A long run must come back with something
// ─────────────────────────────────────────────────────────────────────────────
import { googleMapsAdapter } from '../../src/lib/copilot/supply/google-maps';
import type { Profile as SupplyProfile } from '../../src/lib/copilot/types';

async function supplyBudget() {
  // Three segments at up to 90s each, behind a proxy that gives up at 60. The
  // adapter has to stop between segments rather than run the request off a
  // cliff — a partial answer is useful, a 504 is not.
  const profile = { target_segments: ['pest control', 'plumbing', 'renovation'], target_area: 'Cebu', location: 'Cebu', linked_business_id: null } as unknown as SupplyProfile;

  // A deadline already in the past must not start a single scrape. Without the
  // guard this would call Apify three times and take minutes.
  const started = Date.now();
  const none = await googleMapsAdapter.discover(profile, { limit: 30, deadline: Date.now() - 1 });
  assert.deepEqual(none, [], 'an expired budget finds nothing');
  assert.ok(Date.now() - started < 1_000, 'and returns immediately rather than scraping');

  // Too little left to be worth starting is the same as none: a scrape that
  // cannot finish still costs credits.
  const tooLittle = await googleMapsAdapter.discover(profile, { limit: 30, deadline: Date.now() + 2_000 });
  assert.deepEqual(tooLittle, [], 'a budget below the floor starts nothing');

  console.log('copilot-core: supply-budget checks passed');
}

supplyBudget().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// Something to get better at, every day there is data
// ─────────────────────────────────────────────────────────────────────────────
import { growthEdge } from '../../src/lib/copilot/diagnose';

async function edge() {
  const stages = [
    { key: 'matched' as const, label: 'Matched', count: 157, rate: null },
    { key: 'drafted' as const, label: 'Drafted', count: 33, rate: 0.21 },
    { key: 'sent' as const, label: 'Sent', count: 0, rate: 0 },
  ];
  const bottleneck = (label: string) => ({ kind: 'bottleneck' as const, headline: `Drafted → ${label} is where you lose most: 0 of 33 (0%).`, detail: '' });
  const openings = [{ term: 'running facebook ads', count: 40, thisWeek: 0, prevWeeklyAvg: 3, trend: 'steady' as const, segments: [] }];

  // 1. The live account's exact state. The old gate produced nothing here,
  //    because BOTTLENECK_TOPIC had no entry for 'sent' — the most common
  //    bottleneck in this product got the emptiest answer.
  const stuck = growthEdge({ findings: [bottleneck('Sent')], stages, openings });
  assert.equal(stuck?.source, 'funnel');
  assert.match(stuck!.capability, /sending what you have already written/);
  assert.ok(stuck!.because.some((b) => /\d/.test(b)), 'evidence cites a number');
  // The bottleneck card sits directly above this one; repeating its headline
  // was the duplication that made Today feel heavy in the first place.
  assert.doesNotMatch(stuck!.because[0], /where you lose most/, 'must not restate the card above it');
  assert.match(stuck!.because[0], /33 of 33 stopped at drafted/);
  assert.match(stuck!.experiment, /Send five/);

  // 2. Repeating something that does not work outranks the funnel: only the
  //    decision record can see it, and it is the more expensive gap.
  const dead = growthEdge({ findings: [bottleneck('Sent')], stages, openings }, { deadTopic: { topic: 'lead volume', count: 4 } });
  assert.equal(dead?.source, 'decisions');
  assert.match(dead!.capability, /lead volume/);
  assert.match(dead!.because[0], /4 calls about lead volume/);
  assert.match(dead!.experiment, /Stop repeating it/);

  // 3. Nothing leaking: the gap is the opening your openers never name.
  //    Never "selling <term>" — these terms are conditions a scraper observed,
  //    so that phrasing rendered as "selling running facebook ads".
  const gap = growthEdge({ findings: [], stages, openings });
  assert.equal(gap?.source, 'openings');
  assert.match(gap!.capability, /naming the "running facebook ads" problem/);
  assert.doesNotMatch(gap!.capability, /^selling /);
  assert.match(gap!.because[0], /40 of your matches have running facebook ads in common/);
  for (const line of [gap!.capability, gap!.experiment, ...gap!.because]) {
    assert.doesNotMatch(line, /asking for|asked for|\bwants\b/i, `no demand language: ${line}`);
  }

  // 4. A brand-new account is the only real empty state.
  assert.equal(growthEdge({ findings: [], stages: [], openings: [] }), null);

  // 5. Every stage names a capability and an experiment — no stage may fall
  //    through to silence the way 'sent' used to.
  for (const label of ['Matched', 'Drafted', 'Sent', 'Replied', 'Meeting', 'Won']) {
    const all = [
      ...stages,
      { key: 'replied' as const, label: 'Replied', count: 2, rate: 0.1 },
      { key: 'meeting' as const, label: 'Meeting', count: 1, rate: 0.5 },
      { key: 'won' as const, label: 'Won', count: 1, rate: 1 },
    ];
    const e = growthEdge({ findings: [bottleneck(label)], stages: all, openings });
    assert.ok(e, `${label} must produce an edge`);
    assert.ok(e!.capability.length > 3 && e!.experiment.length > 20, `${label} needs a real capability and experiment`);
  }

  console.log('copilot-core: growth-edge checks passed');
}

edge().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// One notification a day, carrying the call
// ─────────────────────────────────────────────────────────────────────────────
import { notifyPayload } from '../../src/lib/copilot/brief';

async function notifications() {
  const call = { headline: 'Send the 7 drafts already written before finding anything new.', because: [], verify_metric: 'sent' as const };

  // 1. Only the cron notifies. A brief also runs when the app is opened, and a
  //    notification to somebody already looking at the screen is noise — that
  //    is most of why push has never been seen.
  for (const reason of ['manual', 'daily', 'onboarding', 'offer', 'supply']) {
    assert.equal(notifyPayload({ decision: call }, reason), null, `${reason} must not notify`);
  }

  // 2. The call is what gets carried. One move is a reason to pick up a phone.
  const p = notifyPayload({ decision: call }, 'cron');
  assert.equal(p?.title, 'Today’s call');
  assert.equal(p?.body, call.headline);

  // 3. No call is silence.
  //
  //    This used to fall back to an urgent nudge, and the fallback was worse than
  //    nothing twice over: it fired on exactly the morning the run produced no
  //    decision — which is the morning there is least worth interrupting anyone
  //    for — and what it pushed was a sentence restating a card they would see
  //    the moment they opened the app. The nudges themselves are gone; see
  //    BriefOutput for why.
  assert.equal(notifyPayload({ decision: null }, 'cron'), null);

  // A model that still sends nudges cannot notify through them either: the
  // normalizer drops the field long before this, and the signature no longer
  // reads it.
  assert.equal(notifyPayload({ decision: null } as { decision: null }, 'cron'), null);

  console.log('copilot-core: notification checks passed');
}

notifications().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// What was said, on both sides
// ─────────────────────────────────────────────────────────────────────────────
import {
  MAX_SENT_PER_BUCKET, NO_REPLY_AFTER_DAYS, REPLY_TEXT_MAX,
  selectReplies, selectSentExamples, trimMessage,
} from '../../src/lib/copilot/conversations';
import { SYSTEM_PROMPT as PROMPT } from '../../src/lib/copilot/agent/schema';

async function conversations() {
  // 1. Trimming. A WhatsApp body is mostly newlines by weight, and the pack is
  //    serialised whole into a prompt that already takes two minutes to answer.
  assert.equal(trimMessage('  hello\n\n  there \t world ', 100), 'hello there world');
  assert.equal(trimMessage(null, 100), '');
  assert.equal(trimMessage(undefined, 100), '');
  assert.equal(trimMessage('   ', 100), '', 'whitespace is not a message');
  const long = trimMessage('x'.repeat(500), 20);
  assert.equal(long.length, 20, 'the cap is a cap, including the ellipsis');
  assert.ok(long.endsWith('…'));
  assert.equal(trimMessage('exact', 5), 'exact', 'a body at the limit is not truncated');

  // 2. Replies. Every reply matched before the body was captured has note null;
  //    those rows are history, not facts, and must not reach the prompt.
  const replies = selectReplies([
    { note: null, occurred_at: '2026-09-06T10:00:00Z', business: 'Old Match' },
    { note: '   ', occurred_at: '2026-09-06T11:00:00Z' },
    { note: 'How much is it?', occurred_at: '2026-09-05T10:00:00Z', business: 'Bright Dental' },
    { note: 'Not interested, we have someone', occurred_at: '2026-09-07T09:00:00Z', business: 'Pest Pros' },
  ]);
  assert.equal(replies.length, 2, 'bodiless rows dropped');
  assert.equal(replies[0].business, 'Pest Pros', 'newest first');
  assert.equal(replies[1].text, 'How much is it?');
  assert.equal(selectReplies(Array.from({ length: 20 }, (_, i) => ({ note: `r${i}`, occurred_at: `2026-09-0${(i % 9) + 1}T10:00:00Z` })), 3).length, 3);
  assert.ok(REPLY_TEXT_MAX > 0);

  // 3. Sent examples. The point is the contrast, so both buckets or neither is
  //    meaningful — a model shown only winners concludes everything works.
  const now = new Date('2026-09-07T12:00:00Z');
  const sent = selectSentExamples([
    { id: 'replied-1', body: 'Hi Bright Dental, saw you have no booking link.', sent_at: '2026-09-06T08:00:00Z' },
    { id: 'pending-1', body: 'Sent yesterday, nobody has had time to answer yet.', sent_at: '2026-09-06T09:00:00Z' },
    { id: 'ignored-1', body: 'Hello, I do websites, let me know.', sent_at: '2026-09-01T09:00:00Z' },
    { id: 'nobody', body: '   ', sent_at: '2026-09-01T09:00:00Z' },
    { id: 'draft', body: 'Never sent.', sent_at: null },
  ], new Set(['replied-1']), { now });

  assert.deepEqual(sent.map((s) => s.replied), [true, false], 'one of each, replied first');
  assert.match(sent[0].text, /Bright Dental/);
  assert.match(sent[1].text, /I do websites/);
  assert.ok(!sent.some((s) => s.text.includes('nobody has had time')), `silence younger than ${NO_REPLY_AFTER_DAYS} days is pending, not a result`);
  assert.ok(!sent.some((s) => s.text.includes('Never sent')), 'an unsent draft is not evidence');
  assert.ok(!sent.some((s) => !s.text.trim()), 'an empty body teaches nothing');

  // A reply is a reply however old; only silence has to mature.
  const oldReply = selectSentExamples(
    [{ id: 'r', body: 'Ancient but answered.', sent_at: '2026-01-01T09:00:00Z' }],
    new Set(['r']), { now },
  );
  assert.deepEqual(oldReply.map((s) => s.replied), [true]);

  // Buckets are capped independently, so a run of wins cannot crowd out losses.
  const many = selectSentExamples(
    Array.from({ length: 20 }, (_, i) => ({ id: `w${i}`, body: `won ${i}`, sent_at: '2026-09-01T09:00:00Z' }))
      .concat(Array.from({ length: 20 }, (_, i) => ({ id: `l${i}`, body: `lost ${i}`, sent_at: '2026-09-01T09:00:00Z' }))),
    new Set(Array.from({ length: 20 }, (_, i) => `w${i}`)), { now },
  );
  assert.equal(many.filter((s) => s.replied).length, MAX_SENT_PER_BUCKET);
  assert.equal(many.filter((s) => !s.replied).length, MAX_SENT_PER_BUCKET);

  // 4. A field the agent is never told about is a field it ignores. These three
  //    were in the database for months and reached nothing.
  for (const section of ['REPLIES:', 'SENT:', 'OPENINGS:']) {
    assert.ok(PROMPT.includes(section), `${section} must stay in the system prompt`);
  }
  // The pack's openings are conditions a scraper saw at the prospect. A model
  // told they are demand writes "clients are asking for no website" into a real
  // stranger's inbox, so the prompt has to forbid it in as many words.
  assert.match(PROMPT, /NOBODY ASKED FOR ANY OF THEM/);
  assert.match(PROMPT, /never suggest adding one to what they sell/);

  console.log('copilot-core: conversation checks passed');
}

conversations().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// A move is finished work, or it is not a move
// ─────────────────────────────────────────────────────────────────────────────
import { MOVE_KINDS, HEADLINE_MAX, isDeliverable, moveKey, normalizeMove, selectMoves, type MoveDraft } from '../../src/lib/copilot/moves';
import { daysSince, deliveryMessage, deliveryMove, firstName, moneyLabel, shortDate, type SaleRow } from '../../src/lib/copilot/jobs/client-delivery';

async function movesAndJobs() {
  const ok = (over: Partial<MoveDraft> = {}): MoveDraft => ({
    job: 'client_delivery', kind: 'build', external_id: 'sale:1',
    headline: 'Maria paid PHP 4,500 — send them the setup steps',
    why: ['Paid on 8 Sep, PHP 4,500.'],
    artifact: { kind: 'message', label: 'Open in email', value: 'Hi Maria — thanks for your order.', href: 'mailto:m@x.com' },
    ...over,
  });

  // 1. The floor. Advice with no artifact is what a chat window gives away for
  //    free; it must never reach the queue.
  assert.equal(isDeliverable(ok()), true);
  assert.equal(isDeliverable(ok({ artifact: { kind: 'message', label: 'Send', value: '   ' } })), false, 'an empty artifact is advice');
  assert.equal(isDeliverable(ok({ why: [] })), false, 'a move must cite something');
  assert.equal(isDeliverable(ok({ why: ['  '] })), false);
  assert.equal(isDeliverable(ok({ headline: '' })), false);
  assert.equal(isDeliverable(ok({ external_id: '' })), false, 'without an id it cannot dedupe');
  assert.equal(isDeliverable(ok({ kind: 'vibes' as never })), false);
  // A "link" move whose link is missing is a text move pretending otherwise.
  assert.equal(isDeliverable(ok({ artifact: { kind: 'link', label: 'Open', value: 'A listing', href: null } })), false);

  // 2. Trimming, and the batch dedupe that stops a nightly rerun doubling up.
  const long = normalizeMove(ok({ headline: 'x'.repeat(500), why: ['a', 'b', 'c', 'd'] }));
  assert.equal(long.headline.length, HEADLINE_MAX);
  assert.equal(long.why.length, 3);
  const batch = selectMoves([ok(), ok({ headline: 'Fresher read of the same sale' }), ok({ external_id: 'sale:2' }), ok({ why: [] })]);
  assert.equal(batch.length, 2, 'deduped by (job, external_id); undeliverable dropped');
  assert.equal(batch[0].headline, 'Fresher read of the same sale', 'the later read wins');
  assert.equal(moveKey('client_delivery', 'sale:1'), moveKey(batch[0].job, batch[0].external_id));
  assert.ok(MOVE_KINDS.includes('earn') && MOVE_KINDS.includes('avoid'));

  // 3. The first non-outbound job. No model: the message is a template, so it
  //    cannot invent a purchase that did not happen.
  const now = new Date('2026-09-09T00:00:00Z');
  const sale: SaleRow = {
    id: 's1', product_id: 'p1', amount: 4500, currency: 'php',
    customer_email: 'maria@example.com', customer_name: 'Maria Santos', created_at: '2026-09-06T02:00:00Z',
  };
  const profile = { name: 'Alex Phaus', timezone: 'Asia/Manila' };
  const move = deliveryMove(profile, sale, now);

  assert.equal(move.kind, 'build');
  assert.equal(move.external_id, 'sale:s1');
  assert.match(move.headline, /^Maria paid PHP 4,500/);
  assert.match(move.why[0], /Paid on 6 Sep/);
  assert.match(move.why[1], /2 days ago/, 'floored, not rounded: 2.9 days is not 3');
  assert.equal(move.artifact.kind, 'message');
  assert.match(move.artifact.href!, /^mailto:maria@example\.com\?/, 'opens in their own mail app');
  assert.match(move.artifact.value, /Hi Maria/);
  assert.match(move.artifact.value, /It's Alex/, 'signed by them, not by the app');
  assert.equal(isDeliverable(move), true);

  // No email is not a failure: the message is still the work, it just has to be
  // copied rather than opened.
  const noEmail = deliveryMove(profile, { ...sale, customer_email: null }, now);
  assert.equal(noEmail.artifact.href, null);
  assert.equal(isDeliverable(noEmail), true);

  // Placeholder names from the manual-sale form must not be greeted by name.
  assert.equal(firstName('Manual'), '');
  assert.equal(firstName('Unknown'), '');
  assert.equal(firstName(null), '');
  assert.match(deliveryMessage(profile, { ...sale, customer_name: 'Manual' }), /^Hi — thanks/);

  assert.equal(moneyLabel(4500, 'php'), 'PHP 4,500');
  assert.equal(moneyLabel(null, 'php'), '', 'no amount is no claim about money');
  assert.equal(daysSince('2026-09-09T06:00:00Z', now), 0, 'a sale in the future is not negative days');
  // Month abbreviation varies by ICU version ('Sep' vs 'Sept'), so match the
  // part that is ours: the day, and that a bad timezone renders instead of throwing.
  assert.match(shortDate('2026-09-06T02:00:00Z', 'Asia/Manila'), /^6 Sep/);
  assert.match(shortDate('2026-09-06T02:00:00Z', 'Not/AZone'), /^6 Sep/, 'a bad timezone falls back rather than throwing');

  console.log('copilot-core: moves-and-jobs checks passed');
}

movesAndJobs().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// A swipe orders the pile. It never decides what worked.
// ─────────────────────────────────────────────────────────────────────────────
import {
  MIN_TRIAGE_SAMPLE, NEUTRAL_KEEP_RATE, canTriage, orderTriage, segmentKeepRate,
  type TriageCard, type TriageEvent,
} from '../../src/lib/copilot/triage';

async function triage() {
  const card = (id: string, segment: string | null, score: number): TriageCard =>
    ({ id, title: `Business ${id}`, segment, reason: 'r', score, contact: { whatsapp: true, email: false }, url: null });
  const ev = (segment: string, action: string, n: number): TriageEvent[] =>
    Array.from({ length: n }, () => ({ event_type: 'triage_answered', payload: { segment, action } }));

  // 1. A rate needs a sample. Two swipes reordering the whole pile is noise
  //    dressed as learning — the same floor MIN_OPENING applies in diagnose.ts.
  assert.equal(segmentKeepRate(ev('dentist', 'draft', MIN_TRIAGE_SAMPLE - 1)).size, 0);
  const rates = segmentKeepRate([...ev('dentist', 'draft', 5), ...ev('spa', 'skip', 5), ...ev('spa', 'draft', 5)]);
  assert.equal(rates.get('dentist'), 1);
  assert.equal(rates.get('spa'), 0.5, 'both answers count, or it is not a rate');

  // 2. Only triage events, and only well-formed ones.
  assert.equal(segmentKeepRate([...ev('vet', 'draft', 9), { event_type: 'note_added', payload: { segment: 'vet', action: 'draft' } }]).get('vet'), 1);
  assert.equal(segmentKeepRate(ev('', 'draft', 9)).size, 0, 'no segment, nothing to learn');
  assert.equal(segmentKeepRate(ev('vet', 'shrug', 9)).size, 0);
  assert.equal(segmentKeepRate([{ event_type: 'triage_answered', payload: null }]).size, 0);
  // Case and padding are the same segment, or the rate splits across spellings.
  assert.equal(segmentKeepRate([...ev(' Dentist ', 'draft', 3), ...ev('dentist', 'draft', 2)]).get('dentist'), 1);

  // 3. The learned rate leads; the deterministic score breaks ties. A segment
  //    with no history is neutral, never penalised.
  const ordered = orderTriage(
    [card('a', 'spa', 90), card('b', 'dentist', 10), card('c', null, 80)],
    new Map([['dentist', 1], ['spa', 0]]),
  );
  assert.deepEqual(ordered.map((c) => c.id), ['b', 'c', 'a'], 'kept segment first, unknown before rejected');
  assert.deepEqual(
    orderTriage([card('a', 'x', 10), card('b', 'x', 99)], new Map()).map((c) => c.id),
    ['b', 'a'], 'with no history it is pure score');
  assert.equal(orderTriage([card('a', 'x', 1)], new Map()).length, 1);
  assert.equal(orderTriage(Array.from({ length: 50 }, (_, i) => card(`c${i}`, null, i)), new Map()).length, 20);
  assert.ok(NEUTRAL_KEEP_RATE > 0 && NEUTRAL_KEEP_RATE < 1);

  // 4. A card you cannot contact is a swipe that teaches nothing, because
  //    "draft it" has nowhere to go.
  assert.equal(canTriage({ contact: { whatsapp: true, email: false } }), true);
  assert.equal(canTriage({ contact: { whatsapp: false, email: true } }), true);
  assert.equal(canTriage({ contact: { whatsapp: false, email: false } }), false);

  console.log('copilot-core: triage checks passed');
}

triage().catch((e) => { console.error(e); process.exit(1); });
// Nothing to do and nothing plugged in are different answers
// ─────────────────────────────────────────────────────────────────────────────
import { availableJobs, JOBS } from '../../src/lib/copilot/jobs';
import { clientDeliveryJob } from '../../src/lib/copilot/jobs/client-delivery';
import type { Profile as JobProfile } from '../../src/lib/copilot/types';

async function jobSensors() {
  const profile = (over: Record<string, unknown> = {}) =>
    ({
      id: 'p1', name: 'Alex', timezone: 'Asia/Manila', linked_business_id: 'biz-1',
      target_segments: [], finance: {}, offer: {}, onboarding_complete: true, ...over,
    }) as unknown as JobProfile;

  // The sensor, not the result. Each job reports on the input it needs, and a
  // profile missing that input must say so — reporting an empty list instead is
  // what made a working build look broken.
  //
  // capability_gap is always available: every account has a funnel from the
  // moment it has a match, and growthEdge returning null is a quiet day rather
  // than a missing sensor. silence is the same shape — an account that has sent
  // nothing has no silence, and that is a quiet day, not an unplugged sensor.
  assert.deepEqual(await availableJobs(profile()), ['client_delivery', 'repeat_customer', 'goal_gap', 'silence', 'capability_gap']);
  assert.deepEqual(await availableJobs(profile({ linked_business_id: null })), ['goal_gap', 'silence', 'capability_gap']);
  // Both gate on onboarding, so a half-created profile reports no sensors at all
  // rather than two that always answer.
  assert.ok(!(await availableJobs(profile({ onboarding_complete: false }))).includes('silence'));
  // Outreach is a Job and reports its own sensor like any other: a blank offer
  // cannot have produced drafts, so there is no queue to send.
  assert.ok(!(await availableJobs(profile())).includes('send_queue'), 'nothing to send from a blank offer');
  assert.ok((await availableJobs(profile({ offer: { sells: 'automations' } }))).includes('send_queue'));

  // Each sensor is independent: turning one on must not turn another on.
  assert.ok((await availableJobs(profile({ linked_business_id: null, target_segments: ['dentists'] }))).includes('opening_gap'));
  assert.ok(!(await availableJobs(profile())).includes('opening_gap'), 'no targeting, nothing to read an opening out of');
  assert.ok((await availableJobs(profile({ finance: { cash: 9000, monthly_burn: 3000 } }))).includes('runway_guard'));
  assert.ok(!(await availableJobs(profile({ finance: { cash: 9000 } }))).includes('runway_guard'), 'cash without burn is not a runway');
  assert.ok(!(await availableJobs(profile())).includes('remote'), 'the external seam is off until it is configured');

  // A profile with nothing set up reports NO sensors, so Today can still tell
  // "nothing is plugged in" apart from "a quiet day". One always-available job
  // would have collapsed those two back into one answer.
  assert.deepEqual(await availableJobs(profile({ linked_business_id: null, onboarding_complete: false })), []);

  // A job whose availability throws is unavailable, never fatal: one broken
  // sensor must not take the whole screen down with it.
  const exploding = { key: 'boom', label: 'Boom', available() { throw new Error('no'); }, run: async () => [] };
  JOBS.push(exploding);
  try {
    assert.ok(!(await availableJobs(profile())).includes('boom'));
  } finally {
    JOBS.splice(JOBS.indexOf(exploding), 1);
  }

  assert.equal(clientDeliveryJob.key, 'client_delivery');
  assert.equal(JOBS.includes(clientDeliveryJob), true, 'a job not in the registry never runs');

  // The registry is the product. One entry means one kind of action, which is
  // the state this whole spine exists to escape — so the shape of it is asserted
  // rather than left to whoever edits index.ts next.
  const kinds = new Set(JOBS.map((j) => j.key));
  assert.equal(kinds.size, JOBS.length, 'two jobs sharing a key would collide on every write');
  for (const key of ['send_queue', 'client_delivery', 'repeat_customer', 'runway_guard', 'goal_gap', 'opening_gap', 'capability_gap', 'remote']) {
    assert.ok(kinds.has(key), `${key} is registered`);
  }

  console.log('copilot-core: job-sensor checks passed');
}

jobSensors().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// Six kinds of leverage, and none of them allowed to be advice
// ─────────────────────────────────────────────────────────────────────────────
import { KIND_ORDER, MOVE_KINDS, isDeliverable, orderMoves } from '../../src/lib/copilot/moves';
import { MIN_GAP_BUSINESSES, openingMove } from '../../src/lib/copilot/jobs/opening-gap';
import { addOpeningToOffer } from '../../src/lib/copilot/offer';
import { capabilityMove, tutorialSearch } from '../../src/lib/copilot/jobs/capability-gap';
import { RUNWAY_ALERT_MONTHS, coverPlan, hasFinance, runwayMove } from '../../src/lib/copilot/jobs/runway-guard';
import { DORMANT_MIN_DAYS, dormantSales, repeatMessage, repeatMove } from '../../src/lib/copilot/jobs/repeat-customer';
import { normalizeRemoteMove, profileForRemote } from '../../src/lib/copilot/jobs/remote';
import { memoSense } from '../../src/lib/copilot/jobs/sense';
import type { Opening, GrowthEdge } from '../../src/lib/copilot/diagnose';
import type { SaleRow } from '../../src/lib/copilot/jobs/client-delivery';
import type { Metrics } from '../../src/lib/copilot/types';

async function leverage() {
  const now = new Date('2026-09-09T02:00:00Z');
  const term = (over: Partial<Opening> = {}): Opening =>
    ({ term: 'online booking', count: 7, thisWeek: 2, prevWeeklyAvg: 1, trend: 'rising', segments: [{ segment: 'spas', count: 5 }], ...over });

  // --- opening gap: an observed condition, and where the line is allowed to go
  {
    const offer = { sells: 'WhatsApp automations', problem: 'enquiries arrive after hours' };
    const m = openingMove({ offer }, term(), '2026-W37');
    assert.ok(m, 'an opening with a line to add is a Move');
    assert.equal(m.kind, 'decide');
    // Keyed by week, not once ever. The old key meant the single most valuable
    // finding in the app was shown one morning and never again — two or three
    // nights in, the only job still producing daily was the send queue, and
    // Moves rendered empty for weeks.
    assert.equal(m.external_id, 'opening:online booking:2026-W37');
    assert.notEqual(openingMove({ offer }, term(), '2026-W38')!.external_id, m.external_id, 'still open next week is a new card');
    assert.ok(m.why[0].includes('7'), 'the evidence cites the count, not an adjective');
    assert.ok(m.artifact.value.includes('enquiries arrive after hours, online booking'), 'the edit arrives written');
    assert.ok(m.artifact.value.includes('spas'), 'and names the segment to drop if the answer is no');
    assert.ok(isDeliverable(m));

    // THE BUG THIS JOB SHIPPED WITH. The terms are conditions a scraper saw at
    // the prospect — "no website", "running facebook ads". Appending one to
    // what the user SELLS describes a business nobody runs, so the line is only
    // ever allowed into `problem`.
    const written = addOpeningToOffer(offer, 'no website');
    assert.equal(written.sells, 'WhatsApp automations', 'what they sell is never touched');
    assert.equal(written.problem, 'enquiries arrive after hours, no website');
    const scraped = openingMove({ offer }, term({ term: 'no website' }))!;
    assert.ok(!scraped.artifact.value.includes('WhatsApp automations, no website'), 'never appended to sells');
    assert.match(scraped.artifact.value, /What you sell does not change/);
    assert.match(scraped.artifact.value, /nobody asked for no website/i);
    for (const line of [scraped.headline, ...scraped.why]) {
      assert.doesNotMatch(line, /asking for|asked for|\bwant\b|\bwants\b/i, `no demand language: ${line}`);
    }

    // Already named: there is no line to add, so there is no decision to make.
    assert.equal(openingMove({ offer: { ...offer, problem: 'online booking' } }, term()), null);
    // A term that will not fit the column leaves the offer unchanged, and an
    // unchanged offer is not an artifact.
    assert.equal(openingMove({ offer: { ...offer, problem: 'x'.repeat(238) } }, term()), null);
    // A blank problem still works: the term becomes the whole problem line.
    assert.equal(openingMove({ offer: { sells: 'x' } }, term())?.artifact.value.startsWith('online booking'), true);
    assert.ok(MIN_GAP_BUSINESSES >= 3, 'two businesses is a coincidence, not a pattern');
  }

  // --- capability gap: one input, two opposite instructions
  {
    const edge = (over: Partial<GrowthEdge> = {}): GrowthEdge =>
      ({ capability: 'writing openers people answer', because: ['31 of 40 stopped at sent.'], experiment: 'Change only the first line on the next ten.', source: 'funnel', ...over });

    const learn = capabilityMove(edge());
    assert.equal(learn.kind, 'learn');
    assert.equal(learn.artifact.kind, 'link');
    assert.ok(learn.artifact.href?.startsWith('https://www.youtube.com/results?search_query='), 'somewhere to actually go');
    assert.ok(learn.artifact.value.includes('first line'), 'the experiment is the content; the link is only the shelf');
    assert.ok(isDeliverable(learn));

    // A topic the decision record says has never worked is the opposite advice,
    // and must not arrive dressed as encouragement.
    const stop = capabilityMove(edge({ source: 'decisions', capability: 'discounting' }));
    assert.equal(stop.kind, 'avoid');
    assert.equal(stop.artifact.kind, 'text');
    assert.ok(stop.headline.toLowerCase().startsWith('stop'));
    assert.notEqual(stop.external_id, learn.external_id, 'stop and learn never collide on one key');
    assert.ok(isDeliverable(stop));

    assert.ok(tutorialSearch('ai voice intake').includes('ai%20voice%20intake'));
  }

  // --- runway: arithmetic only, and silence when there is nothing to project from
  {
    const metrics = (over: Partial<Metrics> = {}): Metrics =>
      ({ window_days: 30, sent: 60, replies: 6, reply_rate: 0.1, meetings: 2, won: 2, won_amount: 4000, lost: 0,
         awaiting_approval: 0, pipeline: { new: 0, saved: 0, sourced: 0, inferred: 0 }, runway_months: null, ...over }) as Metrics;

    assert.equal(hasFinance({ cash: 9000, monthly_burn: 3000 }), true);
    assert.equal(hasFinance({ cash: 9000, monthly_burn: 0 }), false, 'no burn is not a runway, it is a divide by zero');
    assert.equal(hasFinance({}), false);

    const tight = runwayMove({ finance: { cash: 6000, monthly_burn: 3000, currency: 'usd' } }, metrics(), '2026-09');
    assert.ok(tight, 'two months of runway is a decision');
    assert.equal(tight.kind, 'decide');
    assert.equal(tight.external_id, 'runway:2026-09', 'once a month: daily is noise, never is a surprise');
    assert.ok(tight.artifact.value.includes('USD 2,000'), 'the average deal is computed, not guessed');
    assert.ok(tight.artifact.value.includes('2 of those a month'));
    assert.ok(isDeliverable(tight));

    // Comfortable runway is a number to glance at, not a decision to make.
    assert.equal(runwayMove({ finance: { cash: 100_000, monthly_burn: 3000 } }, metrics(), '2026-09'), null);
    assert.equal(runwayMove({ finance: {} }, metrics(), '2026-09'), null);
    assert.ok(RUNWAY_ALERT_MONTHS >= 1);

    // Nothing closed: there is no deal size, so the honest answer is to say so
    // rather than invent the three clients that would fix it.
    const blind = coverPlan(metrics({ won: 0, won_amount: 0 }), 3000, 'usd');
    assert.ok(blind.includes('no deal size'), blind);
    assert.ok(!/\d+ of those/.test(blind), 'no projection without a rate to project from');
  }

  // --- repeat customer: the half of the funnel every supply adapter is blind to
  {
    const sale = (over: Partial<SaleRow> = {}): SaleRow =>
      ({ id: 's1', product_id: null, amount: 500, currency: 'usd', customer_email: 'maria@spa.ph',
         customer_name: 'Maria Santos', created_at: '2026-06-01T00:00:00Z', ...over });

    // One customer, three purchases, one Move — three identical reconnects is
    // how you lose the account you were trying to keep.
    const grouped = dormantSales([
      sale({ id: 'a', created_at: '2026-03-01T00:00:00Z' }),
      sale({ id: 'b', created_at: '2026-06-01T00:00:00Z' }),
      sale({ id: 'c', created_at: '2026-04-01T00:00:00Z' }),
    ], now);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].id, 'b', 'the most recent purchase is the one the silence is measured from');

    // Still being served is not dormant.
    assert.equal(dormantSales([sale({ created_at: '2026-09-05T00:00:00Z' })], now).length, 0);
    // A sale with nobody attached cannot be reconnected with.
    assert.equal(dormantSales([sale({ customer_email: null, customer_name: null })], now).length, 0);
    // Different customers stay different.
    assert.equal(dormantSales([sale({ id: 'a' }), sale({ id: 'b', customer_email: 'jo@x.com' })], now).length, 2);
    assert.ok(DORMANT_MIN_DAYS >= 7);

    const m = repeatMove({ name: 'Alex Phaus', timezone: 'Asia/Manila' }, sale(), now);
    assert.equal(m.kind, 'earn');
    assert.equal(m.artifact.kind, 'message');
    assert.ok(m.artifact.href?.startsWith('mailto:maria@spa.ph'), 'the work is done, so it opens where it is sent');
    assert.ok(m.headline.includes('Maria'));
    assert.ok(isDeliverable(m));

    const body = repeatMessage({ name: 'Alex Phaus' }, sale(), now);
    assert.ok(body.startsWith('Hi Maria — it’s Alex.') || body.startsWith("Hi Maria — it's Alex."), body);
    // It knows they bought and that it went quiet. It claims nothing about what
    // the work did, because this job cannot see that.
    assert.ok(!/great results|loved|worked well/i.test(body), 'no claim the sales table cannot support');

    // No contact on file still has to be readable, or the work is unreachable.
    const noEmail = repeatMove({ name: 'Alex', timezone: 'UTC' }, sale({ customer_email: null }), now);
    assert.equal(noEmail.artifact.href, null);
    assert.ok(isDeliverable(noEmail), 'a message with nowhere to open is still a message');
  }

  // --- the external seam: untrusted by construction
  {
    const good = { id: 'mbp-14', kind: 'spend', headline: 'MacBook Pro 14 M4, ₱82,000 — below your ceiling',
                   why: ['You said you wanted one under ₱90,000.'],
                   artifact: { kind: 'link', label: 'View the listing', value: 'Seller has 4.9 over 300 sales.', href: 'https://example.com/x' } };
    const m = normalizeRemoteMove(good, 'n8n');
    assert.ok(m);
    assert.equal(m.kind, 'spend');
    assert.equal(m.job, 'remote');
    assert.equal(m.external_id, 'n8n:mbp-14', 'namespaced, so two workflows cannot collide on "1"');
    assert.ok(isDeliverable(m));
    assert.equal(normalizeRemoteMove(good)?.external_id, 'mbp-14', 'unnamespaced when no source is declared');

    // Everything the quality floor exists to stop.
    assert.equal(normalizeRemoteMove({ ...good, id: undefined }), null, 'no stable id doubles up every night');
    assert.equal(normalizeRemoteMove({ ...good, kind: 'vibes' }), null, '"some kind of move" is not a move');
    assert.equal(normalizeRemoteMove({ ...good, why: [] }), null, 'a Move that cites nothing is a guess');
    assert.equal(normalizeRemoteMove({ ...good, artifact: { kind: 'link', label: 'Go' } }), null, 'no artifact, no Move');
    assert.equal(normalizeRemoteMove({ ...good, artifact: { ...good.artifact, href: undefined } }), null, 'a link Move with no link');
    assert.equal(normalizeRemoteMove('a string'), null);
    assert.equal(normalizeRemoteMove(null), null);

    // An artifact kind the remote forgot is inferred from whether it can be opened.
    assert.equal(normalizeRemoteMove({ ...good, artifact: { label: 'Read it', value: 'a finding' } })?.artifact.kind, 'text');
    // A single why is accepted as one line rather than dropped.
    assert.deepEqual(normalizeRemoteMove({ ...good, why: 'just the one reason' })?.why, ['just the one reason']);

    // What leaves the deployment carries no identity.
    const sent = profileForRemote({ id: 'p1', email: 'a@b.c', name: 'Alex', stripe_customer_id: 'cus_1', offer: {} } as never);
    assert.ok(!('email' in sent) && !('id' in sent) && !('stripe_customer_id' in sent), Object.keys(sent).join(','));
  }

  // --- ordering: with six producers, "whichever finished last" is not an order
  {
    const mv = (kind: string, created_at: string, id: string) => ({ kind, created_at, id }) as never;
    const ordered = orderMoves([
      mv('learn', '2026-09-09T09:00:00Z', 'l'),
      mv('earn', '2026-09-01T09:00:00Z', 'e'),
      mv('decide', '2026-09-08T09:00:00Z', 'd'),
    ] as never[]);
    assert.deepEqual(ordered.map((m: { id: string }) => m.id), ['e', 'd', 'l'], 'money first, whatever was written last');
    // Recency only ever breaks a tie inside one kind.
    const two = orderMoves([mv('earn', '2026-09-01T00:00:00Z', 'old'), mv('earn', '2026-09-08T00:00:00Z', 'new')] as never[]);
    assert.deepEqual(two.map((m: { id: string }) => m.id), ['new', 'old']);
    assert.equal(orderMoves(Array.from({ length: 30 }, (_, i) => mv('earn', '2026-09-01T00:00:00Z', `x${i}`)) as never[]).length, 8);
    // Every kind the constraint allows has a place on the screen, or a job could
    // write a row that renders in an undefined position.
    for (const k of MOVE_KINDS) assert.equal(typeof KIND_ORDER[k], 'number', k);
  }

  // --- sense: one read per run, however many jobs ask
  {
    let reads = 0;
    const sense = memoSense({ id: 'p1' } as never, now, async () => { reads += 1; return { diagnosis: {}, edge: null, metrics: {} } as never; });
    await Promise.all([sense(), sense(), sense()]);
    await sense();
    assert.equal(reads, 1, 'six jobs asking for the funnel must not be six passes over it');
  }

  console.log('copilot-core: leverage checks passed');
}

leverage().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// The Call is picked, not written
// ─────────────────────────────────────────────────────────────────────────────
import {
  BUSINESS_METRICS, CALL_FLOOR, DEFAULT_COST_MINUTES, METRIC_GOOD_DIRECTION, MIN_COST_MINUTES,
  arbitrate, costMinutesOf, kindPrior, scoreMove, type Stake,
} from '../../src/lib/copilot/stake';
import { draftFrom, scorable } from '../../src/lib/copilot/call';
import { sendQueueJob } from '../../src/lib/copilot/jobs/send-queue';
import { metricValue as mv, verdictOf as vo } from '../../src/lib/copilot/decision';
import type { Move as MoveRow } from '../../src/lib/copilot/types';

async function arbitration() {
  const ctx = { monthlyBurn: 3000, capacityMinutes: 60 };
  const m = (id: string, kind: string, stake?: Partial<Stake> | null, costMinutes?: number) =>
    ({ id, kind, stake: stake ? { metric: 'none', direction: 'up', by: 1, withinDays: 30, ...stake } : null, costMinutes }) as never;

  // 1. The vocabulary is no longer the outbound funnel. Every metric a call can
  //    stake itself on has to be readable back out of Metrics, or it is a
  //    promise rather than a stake.
  const metrics = { sent: 9, replies: 2, meetings: 6, won: 1, won_amount: 4000, awaiting_approval: 45, runway_months: 3.4 } as never;
  for (const k of BUSINESS_METRICS) {
    if (k === 'none') continue;
    assert.equal(typeof mv(metrics, k), 'number', `${k} must be readable from Metrics`);
  }
  assert.equal(mv(metrics, 'queue'), 45);
  assert.equal(mv(metrics, 'runway_months'), 3.4);
  assert.ok(BUSINESS_METRICS.includes('runway_months'), 'the funnel is not the whole business');

  // 2. Good is not always up. "Clear the queue" succeeds when the number falls,
  //    and grading that as no_movement is how a working call looked like a
  //    failed one.
  const graded = (metric: string, baseline: number, after: number) =>
    vo({ response: 'did', verify: { metric, baseline, after, verifiedAt: 'x' } } as never);
  assert.equal(graded('queue', 45, 35), 'worked', 'a smaller queue is progress');
  assert.equal(graded('queue', 45, 50), 'no_movement');
  assert.equal(graded('replies', 2, 5), 'worked');
  assert.equal(graded('replies', 5, 2), 'no_movement');
  assert.equal(graded('runway_months', 2, 4), 'worked', 'more runway is progress');
  assert.equal(graded('none', 0, 0), 'done', 'an ungradeable call is done, never "worked"');
  for (const k of BUSINESS_METRICS) assert.ok(METRIC_GOOD_DIRECTION[k], `${k} must declare a good direction`);

  // 3. Cost comes off the label the job already writes.
  assert.equal(costMinutesOf('20 min'), 20);
  assert.equal(costMinutesOf('2 h'), 120);
  assert.equal(costMinutesOf('1.5 hours'), 90);
  assert.equal(costMinutesOf('₱18,000'), null, 'a price is not a duration');
  assert.equal(costMinutesOf(null), null);
  assert.ok(MIN_COST_MINUTES > 0 && DEFAULT_COST_MINUTES >= MIN_COST_MINUTES);

  // 4. THE POINT OF ALL OF THIS. A customer who paid and went quiet outranks the
  //    send queue on the day it should. Before arbitration this was impossible —
  //    not mis-ranked, impossible: the brief wrote the call and the jobs wrote
  //    moves on paths that never met, so "send the drafts" led by construction.
  const queue = m('q', 'earn', { metric: 'queue', direction: 'down', by: 10, withinDays: 1, value: 400 }, 30);
  const dormant = m('d', 'earn', { metric: 'won_amount', by: 500, withinDays: 3, value: 500 }, 5);
  const won = arbitrate([queue, dormant], ctx);
  assert.equal(won.call?.id, 'd', 'a five-minute reconnect worth 500 beats half an hour of sending');
  assert.equal(won.insteadOf?.id, 'q', 'and the trade-off is named, not invented');
  assert.deepEqual(won.rest.map((x) => x.id), ['q'], 'the winner is never also in the stack');

  // But it does not always win: a queue that is worth more still takes the day.
  const richQueue = m('q', 'earn', { metric: 'queue', direction: 'down', by: 10, withinDays: 1, value: 6000 }, 30);
  assert.equal(arbitrate([richQueue, dormant], ctx).call?.id, 'q', 'outreach wins when outreach is worth more');

  // 5. Each factor is bounded, so no single input runs away with the day.
  const huge = m('h', 'learn', { withinDays: 30, value: 10_000_000 }, 30);
  const modest = m('s', 'earn', { withinDays: 1, value: 500 }, 15);
  assert.equal(arbitrate([huge, modest], ctx).call?.id, 's', 'money is capped; urgency and kind still count');
  assert.ok(scoreMove(m('x', 'earn', { withinDays: 0 }), ctx) <= scoreMove(m('x', 'earn', { withinDays: 1 }), ctx) * 1.01,
    'a zero-day deadline cannot divide by zero its way to the top');

  // 6. A move that does not fit today is penalised, not hidden — a day with only
  //    long work should still name the best of it.
  const long = m('l', 'earn', { withinDays: 1, value: 900 }, 240);
  assert.ok(scoreMove(long, ctx) < scoreMove(m('l2', 'earn', { withinDays: 1, value: 900 }, 30), ctx));
  assert.equal(arbitrate([long], ctx).call?.id, 'l', 'still the call when it is the only one');

  // 7. A named number always outranks a guess about a category.
  assert.ok(kindPrior('earn') > kindPrior('learn'), 'the prior is still an opinion about kinds');
  assert.ok(scoreMove(m('a', 'learn', { withinDays: 1, value: 2000 }), ctx) > scoreMove(m('b', 'earn', null), ctx),
    'evidence beats prior');

  // 8. A quiet day promotes nothing and falls through to the written call.
  assert.equal(arbitrate([], ctx).call, null);
  assert.equal(arbitrate([m('w', 'learn', null, 240)], ctx, 99).call, null, 'nothing clears an impossible floor');
  assert.ok(CALL_FLOOR > 0, 'a floor of zero promotes the best of a bad list');

  // 9. Deterministic. A call that reshuffles on reload is not a decision.
  const pool = [m('c', 'earn', { withinDays: 5, value: 100 }), m('a', 'earn', { withinDays: 5, value: 100 }), m('b', 'earn', { withinDays: 5, value: 100 })];
  assert.deepEqual(arbitrate(pool, ctx).rest.map((x) => x.id), arbitrate([...pool].reverse(), ctx).rest.map((x) => x.id));
  assert.equal(arbitrate(pool, ctx).call?.id, 'a', 'ties break on id, not on load order');

  // 10. The promoted draft carries the Move's evidence, its metric and its id —
  //     and instead_of stops being a sentence somebody wrote.
  const row = (over: Partial<MoveRow> = {}): MoveRow => ({
    id: 'mv1', job: 'repeat_customer', kind: 'earn', headline: 'Maria paid 96 days ago',
    why: ['Last paid 1 Jun.'], artifact: { kind: 'message', label: 'Open in email', value: 'Hi Maria', href: 'mailto:m@x.y' },
    cost_label: '5 min', status: 'open', created_at: '2026-09-10T00:00:00Z',
    stake: { metric: 'won_amount', direction: 'up', by: 500, withinDays: 3, value: 500 }, ...over,
  });
  const runnerUp = row({ id: 'mv2', job: 'send_queue', headline: '45 drafts waiting' });
  const draft = draftFrom(row(), runnerUp);
  assert.equal(draft.headline, 'Maria paid 96 days ago');
  assert.deepEqual(draft.because, ['Last paid 1 Jun.']);
  assert.equal(draft.instead_of, '45 drafts waiting', 'the trade-off is the runner-up, named');
  assert.equal(draft.verify_metric, 'won_amount', 'the call is graded on what the Move staked');
  assert.equal(draft.source_move_id, 'mv1', 'without this the call cannot carry the artifact');
  assert.equal(draft.confidence, 'high');
  // A Move riding its kind prior says so rather than sounding equally sure.
  assert.equal(draftFrom(row({ stake: null }), null).confidence, 'low');
  assert.equal(draftFrom(row({ stake: null }), null).verify_metric, 'none');
  assert.equal(draftFrom(row(), null).instead_of, undefined, 'nothing to be instead of, so nothing claimed');
  // The scorer reads cost off the label rather than being told twice.
  assert.equal(scorable(row()).costMinutes, 5);

  // 11. Outreach is a Job now. That is the whole change: it has to win.
  assert.equal(sendQueueJob.key, 'send_queue');
  assert.equal(JOBS.includes(sendQueueJob), true, 'a job not in the registry never runs');
  assert.equal(await sendQueueJob.available({ profile: { offer: {} } } as never), false, 'nothing to send from a blank offer');
  assert.equal(await sendQueueJob.available({ profile: { offer: { sells: 'automations' } } } as never), true);

  console.log('copilot-core: arbitration checks passed');
}

arbitration().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// What the user said they were trying to do
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_PROJECTED_MONTHS, goalMove, measurable, monthlyRate, pickGoal } from '../../src/lib/copilot/jobs/goal-gap';
import { MIN_CREDIBLE_DEAL_SHARE, coverPlan as cover, money as gmoney } from '../../src/lib/copilot/jobs/runway-guard';
import type { Goal as GoalRow } from '../../src/lib/copilot/types';

async function goalsAndArithmetic() {
  const met = (over: Record<string, unknown> = {}) =>
    ({ window_days: 30, sent: 9, replies: 2, reply_rate: 0.22, meetings: 6, won: 1, won_amount: 4000,
       lost: 0, awaiting_approval: 45, pipeline: { new: 0, saved: 0, sourced: 0, inferred: 0 }, runway_months: 3.4, ...over }) as never;
  const goal = (over: Partial<GoalRow> = {}): GoalRow =>
    ({ id: 'g1', profile_id: 'p1', title: 'Emergency', metric: 'currency', unit: '$',
       target_value: 15000, current_value: 1200, horizon_days: 90, priority: 1, status: 'active', note: null, ...over });

  // 1. Only a goal with a meter behind it can be measured. "Monetize App — 0 of
  //    10 users" and "Get a job" are real goals this job must stay silent about,
  //    because nothing in Metrics counts users or offers and a projection with
  //    no meter is the invention every other job here refuses to make.
  assert.equal(measurable(goal()), true);
  assert.equal(measurable(goal({ metric: 'number', unit: 'users', target_value: 10, current_value: 0 })), false);
  assert.equal(measurable(goal({ target_value: null })), false, 'no target, nothing to be short of');
  assert.equal(measurable(goal({ current_value: 15000 })), false, 'already there');
  assert.equal(goalMove(goal({ metric: 'number' }), met(), '2026-09'), null);

  // 2. The user's own priority order decides which one speaks. Not a ranking
  //    this file invents on their behalf.
  assert.equal(pickGoal([goal({ id: 'b', priority: 3 }), goal({ id: 'a', priority: 1 })])?.id, 'a');
  assert.equal(pickGoal([goal({ metric: 'number' })]), null);
  assert.equal(pickGoal([]), null);

  // 3. The rate is read off logged wins, never assumed.
  assert.equal(monthlyRate(met({ won_amount: 3000, window_days: 30 })), 3000);
  assert.equal(monthlyRate(met({ won_amount: 0 })), null, 'nothing closed is not a rate of zero to divide by');

  // 4. The arithmetic, and the sentence it produces.
  const m = goalMove(goal(), met({ won_amount: 1000 }), '2026-09')!;
  assert.equal(m.kind, 'decide');
  assert.equal(m.external_id, 'goal:g1:2026-09', 'once a month per goal');
  assert.match(m.headline, /Emergency is at \$1,200 of \$15,000/);
  assert.match(m.headline, /14 months away, not 90 days/, 'the date the user set is the one it is measured against');
  assert.ok(m.artifact.value.includes('gap $13,800'));
  assert.equal(m.stake?.withinDays, 90, 'the stake inherits the horizon, so urgency is theirs not ours');
  assert.equal(m.stake?.value, 13800);
  assert.ok(isDeliverable(m));

  // Nothing closing says so, rather than dividing by zero into a number.
  const dead = goalMove(goal(), met({ won: 0, won_amount: 0 }), '2026-09')!;
  assert.match(dead.headline, /nothing is closing it/);
  assert.match(dead.why[1], /not closing it at all|not closing at all/);
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(dead)), 'no goal ever renders a NaN');
  assert.ok(MAX_PROJECTED_MONTHS >= 12);

  // 5. THE $1 WIN. The live account had one recorded win worth $1 against a
  //    $350 burn, and coverPlan did what it was told: "covering $350 a month
  //    takes 350 of those a month. At your rate that is about 3,150 sends a
  //    month." Every number correct, the sentence worthless.
  const junk = cover(met({ won: 1, won_amount: 1, sent: 9 }), 350, '$');
  assert.ok(!/350 of those/.test(junk), junk);
  assert.ok(!/3,?150 sends/.test(junk), junk);
  assert.match(junk, /too small against/);
  // A real deal still projects.
  const real = cover(met({ won: 2, won_amount: 4000, sent: 60 }), 3000, 'usd');
  assert.match(real, /USD 2,000/);
  assert.match(real, /2 of those a month/);
  assert.ok(MIN_CREDIBLE_DEAL_SHARE > 0 && MIN_CREDIBLE_DEAL_SHARE < 1);

  // 6. A symbol currency gets no space. Somebody whose finance row said "$" was
  //    reading "$ 1,200".
  assert.equal(gmoney(1200, '$'), '$1,200');
  assert.equal(gmoney(1200, 'usd'), 'USD 1,200');
  assert.equal(gmoney(1200, null), 'USD 1,200');
  assert.equal(gmoney(1200, '₱'), '₱1,200');

  console.log('copilot-core: goals-and-arithmetic checks passed');
}

goalsAndArithmetic().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// A no that is heard
// ─────────────────────────────────────────────────────────────────────────────
import { MAX_REFUSALS, REFUSAL_DECAY } from '../../src/lib/copilot/stake';
import { REFUSAL_WINDOW, refusalsByTopic } from '../../src/lib/copilot/decision';
import { draftFrom as promoteDraft, phraseFor } from '../../src/lib/copilot/call';
import type { Move as MoveR } from '../../src/lib/copilot/types';

async function refusals() {
  const ctx = { monthlyBurn: 3000, capacityMinutes: 60 };
  const mv = (id: string, job: string, kind = 'earn') => ({ id, job, kind, stake: null, costMinutes: 30 }) as never;
  const dec = (topic: string | null, response: string) => ({ topic, response }) as never;

  // 1. A refusal is a no you gave, or one the sweep inferred from a call you
  //    left pending until the next arrived. Both mean the app asked and nothing
  //    happened. Nothing else counts — a call you DID is not a refusal.
  const r = refusalsByTopic([
    dec('send_queue', 'rejected'), dec('send_queue', 'ignored'), dec('send_queue', 'did'),
    dec('runway_guard', 'ignored'), dec(null, 'rejected'), dec('goal_gap', 'pending'),
  ]);
  assert.equal(r.send_queue, 2, 'rejected and ignored count; did does not');
  assert.equal(r.runway_guard, 1);
  assert.equal(r.goal_gap, undefined, 'still open is not yet a no');
  assert.equal(Object.keys(r).length, 2, 'a call with no topic teaches nothing');

  // The window is bounded: a no from months ago is not a standing objection.
  const old = Array.from({ length: REFUSAL_WINDOW + 5 }, () => dec('send_queue', 'rejected'));
  assert.equal(refusalsByTopic(old).send_queue, REFUSAL_WINDOW);

  // 2. THE FIFTH MORNING. Same two Moves, same day, the only difference being
  //    that the user has already said no to one of them twice.
  const queue = mv('q', 'send_queue');
  const goal = mv('g', 'goal_gap', 'decide');
  assert.equal(arbitrate([queue, goal], ctx).call?.id, 'q', 'with no history the earn leads');
  const heard = arbitrate([queue, goal], { ...ctx, refused: { send_queue: 2 } });
  assert.equal(heard.call?.id, 'g', 'two refusals and the other one leads');
  assert.ok(REFUSAL_DECAY > 0 && REFUSAL_DECAY < 1);

  // 3. Past MAX_REFUSALS it is barred from leading — but it stays on the list,
  //    because the work is still real. Barred is not deleted.
  const done = arbitrate([queue, goal], { ...ctx, refused: { send_queue: MAX_REFUSALS } });
  assert.equal(done.call?.id, 'g');
  assert.deepEqual(done.stoodDown, ['send_queue']);
  assert.ok(done.rest.some((m) => m.id === 'q'), 'still available, just not the call');

  // Even alone it cannot lead: a refused call is not made valid by having no
  // competition.
  const only = arbitrate([queue], { ...ctx, refused: { send_queue: MAX_REFUSALS } });
  assert.equal(only.call, null);
  assert.deepEqual(only.stoodDown, ['send_queue']);

  // 4. Standing down is said once, in the winner's own evidence. Saying nothing
  //    is indistinguishable from having forgotten, which is what the app did for
  //    five mornings while the ledger recorded every no.
  const row = (over: Partial<MoveR> = {}): MoveR => ({
    id: 'g', job: 'goal_gap', kind: 'decide', headline: 'Emergency is 14 months away',
    why: ['$13,800 to go.'], artifact: { kind: 'text', label: 'Show it', value: 'x' },
    cost_label: '10 min', status: 'open', created_at: '2026-09-11T00:00:00Z', stake: null, ...over,
  });
  const d = promoteDraft(row(), null, ['send_queue']);
  assert.equal(d.because.length, 2);
  assert.match(d.because[1], /turned down sending the drafts/);
  assert.match(d.because[1], /still on the list/, 'stood down, not deleted');
  // The winner never stands itself down.
  assert.deepEqual(promoteDraft(row({ job: 'send_queue' }), null, ['send_queue']).because, ['$13,800 to go.']);
  assert.deepEqual(promoteDraft(row(), null, []).because, ['$13,800 to go.']);
  // Every job the registry can promote has a phrase a person would use.
  for (const j of JOBS) assert.ok(phraseFor(j.key).length > 0 && !phraseFor(j.key).includes('_'), j.key);

  console.log('copilot-core: refusal checks passed');
}

refusals().catch((e) => { console.error(e); process.exit(1); });

// --- watching the outside world
//
// The supply list was three adapters compiled into the build, all of them
// pointed at local businesses to message. Everything here exists so that the
// list is rows instead — and so that a stranger's feed cannot put a number on
// somebody's morning screen that nobody wrote down.
import { MAX_ITEMS_PER_SOURCE, SEEN_WINDOW, decodeEntities, parseFeed, stripTags, trimSeen, unseenItems } from '../../src/lib/copilot/watch/feed';
import { MAX_PICKS_PER_SOURCE, STALE_WITHIN_DAYS, movesFromVerdicts, parseVerdicts, valueFromItem, watchBrief, withinDaysFor } from '../../src/lib/copilot/watch/judge';
import { WATCH_INTENTS, normalizeSourceUrl, startersFor } from '../../src/lib/copilot/watch/catalogue';
import { dueSources } from '../../src/lib/copilot/jobs/watcher';
import { isDeliverable } from '../../src/lib/copilot/moves';
import { CALL_FLOOR, scoreMove } from '../../src/lib/copilot/stake';
import type { FeedItem } from '../../src/lib/copilot/watch/feed';
import type { Goal, WatchSource } from '../../src/lib/copilot/types';

async function watching() {
  const now = new Date('2026-09-11T08:00:00Z');

  // 1. THE THREE DIALECTS. Whatever a feed is written in, the judge sees the
  //    same three fields — an id it can dedupe on, a title, and prose.
  const rss = `<rss><channel><item><title>[Hiring] n8n dev, $45/hr</title>
    <link>https://reddit.com/r/forhire/x1</link><guid isPermaLink="false">t3_x1</guid>
    <pubDate>Wed, 10 Sep 2026 09:00:00 +0000</pubDate><dc:creator>u/someone</dc:creator>
    <content:encoded><![CDATA[<p>Wiring a WhatsApp intake &amp; booking flow.</p>]]></content:encoded>
    </item></channel></rss>`;
  const [r0] = parseFeed(rss);
  assert.equal(r0.id, 't3_x1', 'guid beats the link as the dedupe key');
  assert.equal(r0.publishedAt, '2026-09-10T09:00:00.000Z', 'RFC 822 read');
  // CDATA markup stripped, its escaped ampersand decoded — and in that order.
  assert.equal(r0.text, 'Wiring a WhatsApp intake & booking flow.');

  const atom = `<feed><entry><id>tag:hn,2026:41</id><title>Show HN: a thing</title>
    <link rel="self" href="https://hnrss.org/show"/>
    <link rel="alternate" href="https://news.ycombinator.com/item?id=41"/>
    <updated>2026-09-09T12:00:00Z</updated>
    <summary type="html">&lt;p&gt;Points: 120&lt;/p&gt;</summary></entry></feed>`;
  const [a0] = parseFeed(atom);
  // An Atom entry carries several links and only one of them is the human page.
  assert.equal(a0.url, 'https://news.ycombinator.com/item?id=41');
  // Escaped HTML is the opposite problem from CDATA and the same code handles both.
  assert.equal(a0.text, 'Points: 120');

  const [j0] = parseFeed(JSON.stringify({ items: [{ id: 'a1', title: 'Subcontract', url: 'https://x.dev/a1', content_text: '£1,200 fixed', date_published: '2026-09-11T08:00:00Z' }] }));
  assert.equal(j0.id, 'a1');
  assert.equal(j0.text, '£1,200 fixed');

  // A page that is not a feed yields nothing. It must never throw: one bad
  // source would otherwise take the whole nightly loop with it.
  assert.equal(parseFeed('<html><body>not a feed</body></html>').length, 0);
  assert.equal(parseFeed('').length, 0);
  assert.equal(parseFeed('{"broken":').length, 0);
  assert.equal(decodeEntities('a &amp; b &#39;c&#39; &mdash;'), "a & b 'c' —");
  assert.equal(stripTags('<script>bad()</script>ok'), 'ok');

  // 2. DEDUPE IS ON IDS, NOT DATES. Half the feeds worth watching publish no
  //    dates at all, and a cut on last_checked_at shows nothing for those
  //    forever — which looks exactly like a working watcher and a quiet week.
  const undated: FeedItem[] = [
    { id: 'i1', title: 'One', url: 'https://x/1', text: '', publishedAt: null, author: null },
    { id: 'i2', title: 'Two', url: 'https://x/2', text: '', publishedAt: null, author: null },
  ];
  assert.equal(unseenItems(undated, [], { now }).length, 2, 'no dates is not a reason to show nothing');
  assert.deepEqual(unseenItems(undated, ['i1'], { now }).map((i) => i.id), ['i2']);

  // maxAgeDays only ever applies to items that HAVE a date: on the first night
  // a source's whole backlog is unseen, and judging a two-year-old post is a
  // model call spent on something that is gone.
  const old = { ...undated[0], id: 'i3', publishedAt: '2024-01-01T00:00:00Z' };
  assert.equal(unseenItems([old], [], { now, maxAgeDays: 21 }).length, 0);
  assert.equal(unseenItems([old], [], { now }).length, 1, 'no cutoff, no cut');
  // Dated items lead; undated ones are kept but sort last.
  const mixed = unseenItems([undated[0], { ...undated[1], publishedAt: '2026-09-10T00:00:00Z' }], [], { now });
  assert.deepEqual(mixed.map((i) => i.id), ['i2', 'i1']);
  assert.ok(unseenItems(Array.from({ length: 80 }, (_, i) => ({ ...undated[0], id: `n${i}` })), [], { now }).length <= MAX_ITEMS_PER_SOURCE);

  // The memory is bounded, and it drops the OLDEST ids — the ones furthest down
  // a feed that only grows at the top, so least likely to come back.
  assert.deepEqual(trimSeen(['a', 'b', 'c'], ['c', 'd'], 3), ['b', 'c', 'd']);
  assert.equal(trimSeen(Array.from({ length: SEEN_WINDOW + 50 }, (_, i) => `x${i}`), ['new']).length, SEEN_WINDOW);

  // 3. WHAT SOMEBODY TYPES, AS SOMETHING FETCHABLE. Nobody types a feed URL.
  for (const typed of ['r/forhire', '/r/forhire', 'reddit.com/r/forhire', 'https://www.reddit.com/r/forhire/']) {
    const n = normalizeSourceUrl(typed);
    assert.equal(n?.url, 'https://www.reddit.com/r/forhire/new/.rss', typed);
    assert.equal(n?.label, 'r/forhire');
    assert.equal(n?.kind, 'feed');
  }
  assert.equal(normalizeSourceUrl('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv')?.url,
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv');
  // A @handle URL does not contain the channel id and there is no way to resolve
  // one without fetching the page. Rejecting it beats saving a URL that fails
  // silently every night at three in the morning.
  assert.equal(normalizeSourceUrl('https://www.youtube.com/@somebody'), null);
  assert.equal(normalizeSourceUrl('https://hnrss.org/newest?q=n8n')?.kind, 'feed');
  assert.equal(normalizeSourceUrl('weworkremotely.com/remote-jobs.rss')?.kind, 'feed');
  // An unknown host is accepted, and told the truth about itself.
  const page = normalizeSourceUrl('example.com/blog');
  assert.equal(page?.kind, 'page');
  assert.match(page!.note!, /does not look like a feed/);
  assert.equal(normalizeSourceUrl('   '), null);
  // Every starter in the catalogue survives its own normaliser, so nothing the
  // sheet offers can be a URL the watcher then refuses to read.
  for (const def of WATCH_INTENTS) {
    for (const s of def.starters) {
      // Not merely parseable — a FEED. The watcher only reads feeds, so a
      // starter that normalises to a 'page' is a card somebody can tap that
      // will never produce anything, which is worse than no card at all.
      assert.equal(normalizeSourceUrl(s.url)?.kind, 'feed', `${def.key}: ${s.url}`);
      assert.equal(s.kind, 'feed', `${def.key}: ${s.url}`);
      assert.ok(s.intent.length > 0, s.url);
    }
  }
  // A search starter takes the user's own words rather than a placeholder.
  assert.ok(startersFor('clients', { term: 'n8n' }).some((s) => s.url.includes('n8n')));

  // 4. THE ONE NUMBER THE MODEL IS NOT TRUSTED WITH.
  //
  //    "The user's numbers are never invented" is an invariant of this codebase,
  //    and value feeds straight into scoreMove's money factor — a hallucinated
  //    $5,000 on a post that mentions no budget would buy the top of the screen.
  const gig: FeedItem = { id: 'g1', title: 'Need an n8n dev, $45/hr', url: 'https://r/g1', text: 'Budget around 1,200 for the build.', publishedAt: '2026-09-11T06:00:00Z', author: null };
  assert.equal(valueFromItem(1200, gig), 1200, 'written down, separators and all');
  assert.equal(valueFromItem(45, gig), 45);
  assert.equal(valueFromItem(5000, gig), null, 'nobody wrote 5000 anywhere');
  assert.equal(valueFromItem(0, gig), null);

  // 5. PICKS ARE MATCHED BACK AGAINST WHAT WAS SHOWN. A pick whose id is not one
  //    of the items is a plausible opportunity nobody posted; there is no safe
  //    way to render it, so it is dropped rather than repaired.
  const items = [gig, { ...gig, id: 'g2', title: 'Unrelated', text: '' }];
  const picks = parseVerdicts({ picks: [
    { id: 'g1', kind: 'earn', headline: 'Reply to the n8n contract', why: ['They want exactly the intake flow you build.'], value: 1200, cost_label: '15 min' },
    { id: 'ghost', kind: 'earn', headline: 'Invented', why: ['nope'] },
    { id: 'g2', kind: 'learn', headline: 'No evidence', why: [] },
    { id: 'g1', kind: 'earn', headline: 'Same item twice', why: ['dup'] },
  ] }, items);
  assert.equal(picks.length, 1, 'the ghost, the uncited and the duplicate all drop');
  assert.equal(picks[0].value, 1200);
  assert.equal(parseVerdicts({ picks: [] }, items).length, 0, 'an empty list is a valid answer, and the common one');
  assert.equal(parseVerdicts('not json at all', items).length, 0);
  // A model that answers with the index it was shown is not punished for it.
  assert.equal(parseVerdicts({ picks: [{ index: 2, kind: 'learn', headline: 'By index', why: ['ok'] }] }, items)[0].id, 'g2');
  assert.ok(parseVerdicts({ picks: Array.from({ length: 9 }, (_, i) => ({ id: items[i % 2].id, headline: `h${i}`, why: ['w'] })) }, items).length <= MAX_PICKS_PER_SOURCE);

  // Urgency is read off the posting date when the item names no deadline —
  // never invented. Both inputs are things somebody wrote down.
  assert.equal(withinDaysFor(null, gig, now), 3, 'posted this morning');
  assert.equal(withinDaysFor(null, { ...gig, publishedAt: '2026-08-01T00:00:00Z' }, now), STALE_WITHIN_DAYS);
  assert.equal(withinDaysFor(null, { ...gig, publishedAt: null }, now), STALE_WITHIN_DAYS);
  assert.equal(withinDaysFor(999, gig, now), 30, 'clamped');

  // 6. THE OUTPUT IS A MOVE, NOT AN OPPORTUNITY. That is the point of the whole
  //    change: all five OpportunityTypes are somebody to message, so a tutorial
  //    or a flight price had to arrive as a business with a contact or not at
  //    all. A Move has eight kinds and carries the thing itself.
  const source = { id: 'src1', label: 'r/forhire', url: 'https://www.reddit.com/r/forhire/new/.rss', intent: 'contract work' };
  const [move] = movesFromVerdicts(picks, items, source, now);
  assert.ok(isDeliverable(move), 'clears the same floor every other job clears');
  assert.equal(move.job, 'watch');
  assert.equal(move.artifact.kind, 'link');
  assert.equal(move.artifact.href, 'https://r/g1');
  assert.equal(move.external_id, 'src1:g1', 'namespaced, so two feeds carrying one crosspost are one Move');
  assert.match(move.why[move.why.length - 1], /From r\/forhire/, 'the reader can see where it came from');

  // An item with no link is still worth reading; it just cannot pretend to have
  // a destination.
  const [textMove] = movesFromVerdicts(
    parseVerdicts({ picks: [{ id: 'n1', kind: 'learn', headline: 'Read it', why: ['relevant'] }] }, [{ ...gig, id: 'n1', url: null }]),
    [{ ...gig, id: 'n1', url: null }], source, now,
  );
  assert.equal(textMove.artifact.kind, 'text');
  assert.ok(isDeliverable(textMove));

  // 7. AND IT CAN ACTUALLY WIN THE DAY. The number that started all of this was
  //    45 drafts written and never sent; the queue could only ever lose to
  //    something that arrived from outside, and nothing could.
  const ctx = { monthlyBurn: 350, capacityMinutes: 60 };
  const fresh = scoreMove({ kind: move.kind, stake: move.stake, costMinutes: 15, job: 'watch' }, ctx);
  const queue = scoreMove({ kind: 'earn', stake: { metric: 'queue', direction: 'down', by: 10, withinDays: 1 }, costMinutes: 30, job: 'send_queue' }, ctx);
  assert.ok(fresh > CALL_FLOOR, 'a paid gig found this morning clears the floor');
  assert.ok(fresh > scoreMove({ kind: 'learn', stake: null, costMinutes: 30, job: 'watch' }, ctx), 'and outranks a tutorial');
  // It does not beat a same-day queue outright — that would just be a new
  // hardcoded winner. It beats one the user has already turned down twice.
  assert.ok(fresh > scoreMove({ kind: 'earn', stake: { metric: 'queue', direction: 'down', by: 10, withinDays: 1 }, costMinutes: 30, job: 'send_queue' }, { ...ctx, refused: { send_queue: 2 } }));
  assert.ok(queue > 0);

  // 8. WHICH SOURCES ARE DUE. Only feeds, only active ones, oldest check first
  //    so nothing starves behind a busy feed.
  const src = (over: Partial<WatchSource>): WatchSource => ({
    id: 'a', kind: 'feed', url: 'https://x/f', label: 'x', intent: null, every_hours: 24,
    status: 'active', seen_ids: [], last_checked_at: null, last_error: null,
    created_at: '2026-09-01T00:00:00Z', ...over,
  });
  const due = dueSources([
    src({ id: 'never' }),
    src({ id: 'stale', last_checked_at: '2026-09-09T08:00:00Z' }),
    src({ id: 'justnow', last_checked_at: '2026-09-11T07:00:00Z' }),
    src({ id: 'paused', status: 'paused' }),
    src({ id: 'page', kind: 'page' }),
  ], now);
  assert.deepEqual(due.map((s) => s.id), ['never', 'stale']);
  // A 24h source checked at 21:00:05 must not wait a whole extra day and then
  // drift later every night until it skips one entirely.
  assert.equal(dueSources([src({ id: 'edge', last_checked_at: '2026-09-10T08:02:00Z' })], now).length, 1);
  assert.ok(dueSources(Array.from({ length: 20 }, (_, i) => src({ id: `s${i}` })), now).length <= 6);

  // 9. THE BRIEF IS THE USER'S OWN ROWS. Nothing here asks a model what the user
  //    wants — that distinction is the difference between a watcher and a feed
  //    reader, and it is why a goal with no meter still reaches the prompt.
  const goals = [
    { id: 'g', profile_id: 'p', title: 'Get a job', metric: 'none', unit: null, target_value: null, current_value: null, horizon_days: 90, priority: 0, status: 'active', note: 'urgent money' },
    { id: 'e', profile_id: 'p', title: 'Emergency fund', metric: 'currency', unit: '$', target_value: 15000, current_value: 1200, horizon_days: null, priority: 1, status: 'active', note: null },
  ] as Goal[];
  const brief = watchBrief({
    profile: { headline: 'builds WhatsApp automations', location: 'Palawan', target_area: null, offer: { sells: 'booking automations', for_who: 'resorts' }, capacity: 'moderate' },
    goals, metrics: { runway_months: 3.4 }, capacityMinutes: 60,
  });
  assert.match(brief.who, /booking automations/);
  assert.match(brief.goals[0], /urgent money/, 'a goal with no meter is still the most important line here');
  assert.match(brief.goals[1], /\$1,200 of \$15,000/);
  assert.ok(brief.constraints.some((c) => /Palawan/.test(c)));
  assert.ok(brief.constraints.some((c) => /3\.4 months/.test(c)), 'runway is what makes unpaid work expensive');

  console.log('copilot-core: watch checks passed');
}

watching().catch((e) => { console.error(e); process.exit(1); });

// --- the deck, widened and gated
//
// The live app showed "20 to judge" directly above "41 drafts written and not
// sent": the top of the funnel asking for more input while forty-one outputs sat
// unsent. And answering a Move was a dead write — logged on every done and every
// dismissed, read by nothing, while the watcher guessed nightly with no feedback.
import { QUEUE_GATE_DAYS, QUEUE_GATE_DRAFTS, canTriage, oldestWaitDays, queueIsBacked, triageLabels } from '../../src/lib/copilot/triage';
import { KEEP_HIGH, KEEP_LOW, MIN_MOVE_SAMPLE, keepSummary, moveKeepRate } from '../../src/lib/copilot/moves';
import { briefText as watchBriefText, watchBrief as buildWatchBrief } from '../../src/lib/copilot/watch/judge';
import type { MoveAnswerEvent } from '../../src/lib/copilot/moves';

async function deck() {
  // 1. THE GATE. Both conditions, never either: ten drafted this morning is a
  //    good morning; ten drafted three days ago and still sitting is avoidance.
  assert.equal(queueIsBacked(41, 2), false, 'deep but fresh is not backed up');
  assert.equal(queueIsBacked(4, 30), false, 'stale but shallow is not backed up');
  assert.equal(queueIsBacked(QUEUE_GATE_DRAFTS, QUEUE_GATE_DAYS), true, 'exactly at the gate counts');
  assert.equal(queueIsBacked(41, 3), true, 'the screenshot that started this');
  assert.equal(queueIsBacked(0, 0), false);

  const now = new Date('2026-09-11T08:00:00Z');
  assert.equal(oldestWaitDays([], now), 0, 'no queue is not an old queue');
  assert.equal(oldestWaitDays(['2026-09-09T08:00:00Z', '2026-09-10T08:00:00Z'], now), 2, 'oldest wins');
  // A draft written in the future (clock skew between the browser and the row)
  // must not read as a negative wait and quietly disable the gate.
  assert.equal(oldestWaitDays(['2026-09-20T08:00:00Z'], now), 0);

  // 2. A WATCHED-FEED CARD HAS NO CONTACT AND IS STILL ACTIONABLE. Requiring a
  //    phone number is what would have silently dropped every one of them.
  const withUrl = { source: 'move' as const, url: 'https://reddit.com/x', contact: { whatsapp: false, email: false } };
  assert.equal(canTriage(withUrl), true, 'the artifact is the destination');
  assert.equal(canTriage({ ...withUrl, url: null }), false, 'nowhere to go is not a card');
  // A business is unchanged: no contact, no card, because "Draft it" would have
  // nowhere to send and the swipe would teach nothing.
  assert.equal(canTriage({ source: 'opportunity', url: 'https://x', contact: { whatsapp: false, email: false } }), false);
  assert.equal(canTriage({ source: 'opportunity', url: null, contact: { whatsapp: true, email: false } }), true);

  // The buttons are not the same question for both sources. "Draft it" on a
  // Reddit post has nobody to draft to.
  assert.equal(triageLabels('opportunity').yes, 'Draft it');
  assert.equal(triageLabels('move').yes, 'Keep it');
  assert.equal(triageLabels('move').no, triageLabels('opportunity').no);

  // 3. ANSWERING A MOVE NOW TEACHES. It logged move_id and status only, which is
  //    why nothing could read it: an id cannot tell you they bin every tutorial.
  const ev = (job: string, kind: string, status: string): MoveAnswerEvent =>
    ({ event_type: 'move_answered', payload: { job, kind, status } });
  const history: MoveAnswerEvent[] = [
    ...Array.from({ length: 5 }, () => ev('watch', 'earn', 'done')),
    ...Array.from({ length: 5 }, () => ev('watch', 'learn', 'dismissed')),
    ...Array.from({ length: 2 }, () => ev('watch', 'spend', 'done')),   // under the floor
    { event_type: 'moves_written', payload: { written: 3 } },           // not an answer
    { event_type: 'move_answered', payload: null },                     // malformed
    { event_type: 'move_answered', payload: { job: 'watch', kind: 'nonsense', status: 'done' } },
  ];
  const rates = moveKeepRate(history);
  assert.equal(rates.byKind.get('earn'), 1);
  assert.equal(rates.byKind.get('learn'), 0);
  assert.equal(rates.byKind.get('spend'), undefined, `under ${MIN_MOVE_SAMPLE} answers is a bad morning, not a preference`);
  assert.equal(rates.byKind.has('decide'), false, 'never answered, so no opinion');
  // 13 answers carry a valid job: 5 earn done, 5 learn dismissed, 2 spend done,
  // and the unrecognised-kind one, which is still a real answer about the job
  // even though its kind is dropped from the kind tally.
  assert.equal(rates.byJob.get('watch'), 8 / 13, 'jobs tally across kinds, including kinds this build does not know');
  assert.equal(moveKeepRate([]).byKind.size, 0, 'no history is no opinion, not a bad one');

  const summary = keepSummary(rates);
  assert.deepEqual(summary.kept, ['earn']);
  assert.deepEqual(summary.binned, ['learn']);
  assert.ok(KEEP_HIGH > KEEP_LOW);

  // 4. AND THE JUDGE IS TOLD. This is the loop the watcher had none of — it
  //    picked three of twenty-five every night and never learned whether any
  //    were wanted.
  const profile = { headline: 'builds automations', location: 'Palawan', target_area: null, offer: { sells: 'booking automations' }, capacity: 'moderate' as const };
  const args = { profile, goals: [], metrics: { runway_months: 3.4 }, capacityMinutes: 60 };
  const taught = watchBriefText(buildWatchBrief({ ...args, keeps: rates }));
  assert.match(taught, /WHAT THEY ACT ON/);
  assert.match(taught, /follow through on earn/);
  assert.match(taught, /bin learn/);

  // With no history the heading is absent entirely rather than present and
  // empty — a prompt carrying "WHAT THEY ACT ON:" with nothing after it invites
  // the model to fill the gap itself.
  const cold = watchBriefText(buildWatchBrief(args));
  assert.doesNotMatch(cold, /WHAT THEY ACT ON/);
  assert.doesNotMatch(watchBriefText(buildWatchBrief({ ...args, keeps: moveKeepRate([]) })), /WHAT THEY ACT ON/);
  // The rest of the brief is unchanged by any of this.
  assert.match(cold, /WHO THEY ARE/);
  assert.match(cold, /3\.4 months of runway/);

  console.log('copilot-core: deck checks passed');
}

deck().catch((e) => { console.error(e); process.exit(1); });

// --- what is already running
//
// "Also today" rendered the model's plan[] and nudges[], asked for in the same
// response that wrote the Call, over the same context. The live screen carried
// "approve and send 15 drafts", "approve and send 15 drafts today", "approve and
// send 10 drafts today" and "send 10 drafts today" as four rows above a queue
// card saying it a fifth time — the 15 and the 10 disagreeing because they came
// from different runs. This is what took its place: state, not instructions.
import { MAX_NAMES, RECENT_CHECK_HOURS, inMotion, nameList } from '../../src/lib/copilot/motion';
import { VERIFY_AFTER_DAYS as VERIFY_DAYS } from '../../src/lib/copilot/decision';

async function motion() {
  const now = new Date('2026-09-11T20:00:00Z');
  const base = { sent: [], call: null, sources: [], finds: 0, now };

  // 1. A QUIET ACCOUNT SAYS NOTHING. A heading over "nothing yet" is exactly the
  //    filler this change removes, so the section is not rendered at all.
  assert.deepEqual(inMotion(base), []);

  // 2. SENT AND WAITING, off real executions.
  const sent = inMotion({ ...base, sent: [
    { name: 'Norj', sentAt: '2026-09-06T09:00:00Z' },
    { name: 'Andrea', sentAt: '2026-09-10T09:00:00Z' },
    { name: 'MAPECON', sentAt: '2026-09-10T10:00:00Z' },
  ] })[0];
  assert.equal(sent.kind, 'sent');
  assert.equal(sent.label, '3 sent, waiting');
  assert.match(sent.detail, /oldest 5 days/, 'the oldest is the number that matters, not the newest');
  assert.match(sent.detail, /Norj, Andrea \+1/);
  // All today reads as "all today" rather than "oldest 0 days".
  assert.match(inMotion({ ...base, sent: [{ name: 'Solo', sentAt: '2026-09-11T08:00:00Z' }] })[0].detail, /all today/);
  assert.equal(nameList([]), '');
  assert.equal(nameList(['A']), 'A');
  assert.equal(nameList(['A', 'B', 'C', 'D']), `A, B +2`);
  assert.ok(MAX_NAMES >= 1);

  // 3. THE CALL BEING READ BACK. This is the decision record made visible on the
  //    screen where the call was made, instead of only on the tab nobody opens.
  const verifying = inMotion({ ...base, call: { headline: 'Send the 15 drafts', metric: 'sent', answeredAt: '2026-09-10' } })[0];
  assert.equal(verifying.kind, 'verifying');
  assert.equal(verifying.label, 'Send the 15 drafts');
  assert.match(verifying.detail, /you did it/);
  assert.match(verifying.detail, new RegExp(`reads back on sent in ${VERIFY_DAYS - 1} days`));
  // Past the window it is being read back now, never a negative countdown.
  const due = inMotion({ ...base, call: { headline: 'h', metric: 'replies', answeredAt: '2026-09-01' } })[0];
  assert.match(due.detail, /being read back now/);
  assert.doesNotMatch(due.detail, /-\d/);

  // 4. WHAT THE SOURCES TURNED UP — including nothing, which is the common and
  //    correct answer and the thing that stops a quiet night reading as a bug.
  const fresh = '2026-09-11T03:00:00Z';
  const quiet = inMotion({ ...base, sources: [{ label: 'r/forhire', lastCheckedAt: fresh }], finds: 0 })[0];
  assert.equal(quiet.kind, 'watched');
  assert.equal(quiet.label, '1 source read');
  assert.match(quiet.detail, /nothing worth your morning/);
  const found = inMotion({ ...base, sources: [{ label: 'r/forhire', lastCheckedAt: fresh }], finds: 2 })[0];
  assert.match(found.detail, /2 worth keeping/);
  // A source never checked, or checked long ago, is not "last night".
  assert.deepEqual(inMotion({ ...base, sources: [{ label: 'x', lastCheckedAt: null }], finds: 1 }), []);
  assert.deepEqual(inMotion({ ...base, sources: [{ label: 'x', lastCheckedAt: '2026-09-01T03:00:00Z' }], finds: 1 }), []);
  // Clock skew: a check stamped in the future must not count as recent either.
  assert.deepEqual(inMotion({ ...base, sources: [{ label: 'x', lastCheckedAt: '2026-09-20T03:00:00Z' }], finds: 1 }), []);
  assert.ok(RECENT_CHECK_HOURS >= 24, 'one missed hour must not hide last night');

  // 5. AT MOST THREE, in a fixed order — sent, then the call, then the sources.
  //    A section that reorders itself between loads is not a receipt.
  const all = inMotion({
    ...base,
    sent: [{ name: 'Norj', sentAt: '2026-09-09T09:00:00Z' }],
    call: { headline: 'Send the 15 drafts', metric: 'sent', answeredAt: '2026-09-10' },
    sources: [{ label: 'r/forhire', lastCheckedAt: fresh }],
    finds: 1,
  });
  assert.deepEqual(all.map((r) => r.kind), ['sent', 'verifying', 'watched']);
  assert.ok(all.every((r) => r.label && r.detail), 'every row carries evidence, never a bare heading');

  console.log('copilot-core: motion checks passed');
}

motion().catch((e) => { console.error(e); process.exit(1); });

// --- the openers that got nothing back
//
// "Note why the 3 sent openers got silence" was a row in the old "Also today"
// list: a real instruction with nothing under it, telling somebody to go and
// think about three messages the app was already holding. This is that row
// rebuilt to the standard everything else is held to — and the thing it must
// never do is say WHY somebody did not reply.
import { MAX_SHOWN, MIN_PER_SIDE, MIN_SILENT, readSilence, silenceArtifact, traitsOf } from '../../src/lib/copilot/silence';
import type { SentMessage } from '../../src/lib/copilot/silence';

async function silence() {
  const msg = (over: Partial<SentMessage>): SentMessage =>
    ({ text: 'Hi there, I build automations.', business: 'Sea Nymph Resort', sentAt: '2026-09-01T09:00:00Z', replied: false, ...over });

  // 1. TRAITS ARE FACTS, NOT OPINIONS. Each one is checkable against the text
  //    printed under it — "41 words" is a fact, "too long" is a judgement.
  const t = traitsOf(msg({ text: 'Hi Sea Nymph Resort, saw you have no booking link. Worth a look? https://x.dev' }));
  assert.equal(t.asks, true);
  assert.equal(t.namesThem, true, 'the business name appears in the text');
  assert.equal(t.hasLink, true);
  assert.equal(t.words, 14);
  const bare = traitsOf(msg({ text: 'Hi there, I build automations for resorts.' }));
  assert.equal(bare.asks, false);
  assert.equal(bare.namesThem, false, 'a generic opening names nobody');
  assert.equal(bare.hasLink, false);
  // A business whose name is a regex metacharacter must not blow up the match.
  assert.doesNotThrow(() => traitsOf(msg({ business: 'A+ (Plumbing) [Ltd]', text: 'Hi A+' })));
  assert.equal(traitsOf(msg({ business: null, text: 'Hi' })).namesThem, false, 'no name on file is not a match');
  // Two-letter names are skipped rather than matching half the alphabet.
  assert.equal(traitsOf(msg({ business: 'Jo', text: 'Joinery is my job' })).namesThem, false);
  assert.equal(traitsOf(msg({ text: '   ' })).words, 0, 'blank is zero words, never NaN');

  // 2. UNDER THE FLOOR, NO CLAIM. Three answered and three silent is the least
  //    that separates a habit from a coincidence — the same rule the agent
  //    prompt already states for this exact comparison.
  const answered = Array.from({ length: 3 }, (_, i) =>
    msg({ replied: true, text: `Hi Sea Nymph Resort, noticed something specific. Worth ten minutes?`, sentAt: `2026-09-0${i + 1}T09:00:00Z` }));
  const ignored = Array.from({ length: 4 }, (_, i) =>
    msg({ replied: false, text: 'Hi there, I build WhatsApp automations for resorts and would love to work together.', sentAt: `2026-09-0${i + 1}T09:00:00Z` }));

  const thin = readSilence([...answered.slice(0, 2), ...ignored]);
  assert.equal(thin.comparable, false, `${MIN_PER_SIDE - 1} answered is not enough to compare`);
  assert.deepEqual(thin.differences, [], 'and nothing is claimed from it');
  assert.equal(thin.silent.length, 4);

  // 3. WITH BOTH SIDES, ONLY DIFFERENCES THAT ARE ACTUALLY THERE.
  const full = readSilence([...answered, ...ignored]);
  assert.equal(full.comparable, true);
  assert.ok(full.differences.some((d) => /end with a question/.test(d)), 'a real divergence is named');
  assert.ok(full.differences.some((d) => /name the business/.test(d)));
  // Neither group has a link, so nothing is said about links. Printing a trait
  // both sides share is how a "pattern" gets read into noise.
  assert.ok(!full.differences.some((d) => /link/.test(d)), 'a trait both sides share is not a difference');

  // Same habit on both sides produces no finding at all, however many messages.
  const same = readSilence([
    ...Array.from({ length: 3 }, () => msg({ replied: true, text: 'Hi Sea Nymph Resort, worth a chat?' })),
    ...Array.from({ length: 3 }, () => msg({ replied: false, text: 'Hi Sea Nymph Resort, worth a chat?' })),
  ]);
  assert.deepEqual(same.differences, [], 'identical messages differ in nothing');

  // 4. NOTHING EVER ANSWERED — the live account's actual state. There is no
  //    version that worked, and saying so is the honest answer rather than
  //    inventing a rule from one side.
  const never = readSilence(ignored);
  assert.equal(never.replied.length, 0);
  assert.equal(never.comparable, false);
  const neverArt = silenceArtifact(never);
  assert.match(neverArt, /no version that worked/);
  assert.doesNotMatch(neverArt, /ANSWERED/, 'no empty "answered" heading over nothing');

  // 5. THE ARTIFACT IS THE MESSAGES. This is the whole point: the old row told
  //    somebody to go and think about messages it was already holding.
  const art = silenceArtifact(full);
  assert.match(art, /GOT NOTHING BACK \(4\)/, 'the true count, not the number shown');
  assert.match(art, /ANSWERED \(3\)/);
  assert.match(art, /Hi there, I build WhatsApp automations/, 'the message text itself is in the artifact');
  assert.match(art, /words · /, 'with the checkable facts above it');
  assert.match(art, /WHAT DIFFERS/);
  // Capped: more than three a side is a transcript, not a pattern.
  const many = readSilence(Array.from({ length: 12 }, (_, i) => msg({ text: `Message number ${i}`, replied: false })));
  assert.equal((silenceArtifact(many).match(/Message number/g) ?? []).length, MAX_SHOWN);
  assert.match(silenceArtifact(many), /GOT NOTHING BACK \(12\)/, 'the count is still the truth');

  // 6. IT NEVER SAYS WHY. Nothing here knows why a stranger did not reply, and a
  //    confident sentence about it is exactly the invention invariant 2 stops.
  for (const text of [art, neverArt, ...full.differences]) {
    assert.doesNotMatch(text, /because they|they were not interested|they did not care|too pushy|spam/i);
  }
  assert.ok(MIN_SILENT >= 3, 'a card about two messages is homework');

  console.log('copilot-core: silence checks passed');
}

silence().catch((e) => { console.error(e); process.exit(1); });

// --- a quiet night is a report, not silence
//
// The cron ran, succeeded, took four minutes — and Moves rendered empty. Not a
// bug in the cron: every standing-state job keyed itself once and never fired
// again (`runway:${month}`, `edge:${capability}`, `opening:${term}`), so two or
// three nights in the only daily producer left was the send queue, which is
// already on the screen twice. And an empty list rendered nothing at all, so a
// working build and a broken one were pixel-identical.
import { MAX_RESTATE_DISMISSALS, dismissedStreak } from '../../src/lib/copilot/moves';
import { runwayMove } from '../../src/lib/copilot/jobs/runway-guard';
import { capabilityMove } from '../../src/lib/copilot/jobs/capability-gap';
import { dueSources as due } from '../../src/lib/copilot/jobs/watcher';
import { JOBS as ALL_JOBS } from '../../src/lib/copilot/jobs';
import type { MoveAnswerEvent as AnswerEvent } from '../../src/lib/copilot/moves';
import type { WatchSource as WSource } from '../../src/lib/copilot/types';

async function refill() {
  // 1. STANDING STATES COME BACK. The same gap next week is a new card, because
  //    it is still the gap.
  const finance = { cash: 1190, monthly_burn: 350, currency: '$' };
  const m = { sent: 9, replies: 2, won: 1, won_amount: 400, window_days: 30, lost: 0, meetings: 6,
    reply_rate: 0.22, awaiting_approval: 51, runway_months: 3.4,
    pipeline: { new: 0, saved: 0, sourced: 71, inferred: 0 } };
  const w37 = runwayMove({ finance }, m as never, '2026-W37');
  const w38 = runwayMove({ finance }, m as never, '2026-W38');
  assert.ok(w37 && w38);
  assert.notEqual(w37.external_id, w38.external_id, 'a standing money problem restates weekly');
  assert.match(w37.external_id, /^runway:2026-W37$/);

  const edge = { capability: 'Naming the opening in the first line', because: ['x'], experiment: 'y', source: 'funnel' as const };
  assert.notEqual(capabilityMove(edge, '2026-W37').external_id, capabilityMove(edge, '2026-W38').external_id);

  // Every job that describes a standing state says so, and every one that does
  // not is event-driven — the source row already decides when there is news.
  const standing = ALL_JOBS.filter((j) => j.standing).map((j) => j.key).sort();
  assert.deepEqual(standing, ['capability_gap', 'opening_gap', 'runway_guard']);
  assert.ok(!ALL_JOBS.find((j) => j.key === 'send_queue')?.standing, 'a daily queue is not a standing state');
  assert.ok(!ALL_JOBS.find((j) => j.key === 'watch')?.standing, 'a feed item is an event');

  // 2. BUT NOT FOREVER. Binned twice running and it stops — restating something
  //    already answered is the app not listening, the same failure REFUSAL_DECAY
  //    stops one level up.
  const ev = (job: string, status: string): AnswerEvent => ({ event_type: 'move_answered', payload: { job, status, kind: 'decide' } });
  assert.equal(dismissedStreak([], 'runway_guard'), 0, 'no history is no streak');
  assert.equal(dismissedStreak([ev('runway_guard', 'dismissed')], 'runway_guard'), 1);
  assert.equal(dismissedStreak([ev('runway_guard', 'dismissed'), ev('runway_guard', 'dismissed')], 'runway_guard'), MAX_RESTATE_DISMISSALS);
  // A 'done' ends it: acting on one and binning the next is not a pattern.
  assert.equal(dismissedStreak([ev('runway_guard', 'done'), ev('runway_guard', 'dismissed')], 'runway_guard'), 0,
    'newest first — a recent done clears the streak');
  // Another job's dismissals are not this job's.
  assert.equal(dismissedStreak([ev('opening_gap', 'dismissed'), ev('opening_gap', 'dismissed')], 'runway_guard'), 0);
  // Events between them do not break the streak; a different status does.
  assert.equal(dismissedStreak([ev('runway_guard', 'dismissed'), ev('watch', 'done'), ev('runway_guard', 'dismissed')], 'runway_guard'), 2);

  // 3. "READ THEM NOW" IGNORES every_hours. That rule stops the nightly run
  //    spending a model call on a feed that has not moved; it has no business
  //    telling somebody looking at the screen to wait.
  const now = new Date('2026-09-12T10:00:00Z');
  const src = (o: Partial<WSource>): WSource => ({
    id: 'a', kind: 'feed', url: 'https://x/f', label: 'x', intent: null, every_hours: 24,
    status: 'active', seen_ids: [], last_checked_at: '2026-09-12T03:00:00Z', last_error: null,
    created_at: '2026-09-01T00:00:00Z', ...o,
  });
  assert.equal(due([src({})], now).length, 0, 'read seven hours ago is not due on the nightly pass');
  assert.equal(due([src({})], now, 6, true).length, 1, 'and is read anyway when somebody asks');
  // force still respects what force is not for: a paused source stays paused,
  // and a page is not a feed.
  assert.equal(due([src({ status: 'paused' })], now, 6, true).length, 0);
  assert.equal(due([src({ kind: 'page' })], now, 6, true).length, 0);
  // Two per tap, oldest first, so tapping again walks the list instead of
  // re-reading the same feed.
  const many = due([
    src({ id: 'c', last_checked_at: '2026-09-12T09:00:00Z' }),
    src({ id: 'a', last_checked_at: '2026-09-10T03:00:00Z' }),
    src({ id: 'b', last_checked_at: '2026-09-11T03:00:00Z' }),
  ], now, 2, true);
  assert.deepEqual(many.map((s) => s.id), ['a', 'b']);

  console.log('copilot-core: refill checks passed');
}

refill().catch((e) => { console.error(e); process.exit(1); });

// --- the watcher, as it actually behaved on a live account
//
// Eight sources, one read. r/forhire returned 25 items, its judge call spent the
// rest of the run's budget, and every source after it recorded "the operation
// was aborted due to timeout". Two Reddit feeds 429'd before that. The screen
// said "8 sources read · nothing worth your morning", which was a lie in both
// halves — and the judge, which I had assumed was too strict, had run once.
import { SAME_HOST_GAP_MS, USER_AGENT } from '../../src/lib/copilot/jobs/watcher';
import { inMotion as motionOf } from '../../src/lib/copilot/motion';
import { JOBS as REGISTRY } from '../../src/lib/copilot/jobs';

async function watcherReality() {
  const now = new Date('2026-09-12T10:00:00Z');
  const fresh = '2026-09-12T03:00:00Z';
  const base = { sent: [], call: null, finds: 0, now };

  // 1. A FAILED SOURCE IS NOT A READ ONE. markWatchSourceChecked stamps
  //    last_checked_at on failure too — it must, or a dead feed is refetched
  //    every run forever — so "checked" was counted as "read".
  const mixed = motionOf({ ...base, sources: [
    { label: 'r/forhire', lastCheckedAt: fresh, error: null },
    { label: 'r/Entrepreneur', lastCheckedAt: fresh, error: '429 Too Many Requests' },
    { label: 'r/SaaS', lastCheckedAt: fresh, error: 'The operation was aborted due to timeout' },
  ] })[0];
  assert.equal(mixed.label, '1 of 3 sources read');
  assert.match(mixed.detail, /r\/Entrepreneur, r\/SaaS failed/);
  assert.match(mixed.detail, /open Sources/, 'and points at the one screen that can fix it');

  // All well: the count is plain and the finds lead.
  const clean = motionOf({ ...base, finds: 2, sources: [
    { label: 'r/forhire', lastCheckedAt: fresh, error: null },
    { label: 'We Work Remotely', lastCheckedAt: fresh, error: null },
  ] })[0];
  assert.equal(clean.label, '2 sources read');
  assert.match(clean.detail, /2 worth keeping/);
  // Genuinely quiet still reads as quiet, not as broken.
  assert.match(motionOf({ ...base, sources: [{ label: 'x', lastCheckedAt: fresh, error: null }] })[0].detail,
    /nothing worth your morning/);
  // An absent error field behaves like no error, for callers that do not set it.
  assert.equal(motionOf({ ...base, sources: [{ label: 'x', lastCheckedAt: fresh }] })[0].label, '1 source read');

  // 2. THE FETCHER IDENTIFIES ITSELF. Reddit 429s what it cannot attribute, and
  //    "copilot-watch/1.0 (+feed reader)" was not enough on a live account.
  assert.match(USER_AGENT, /^launchfly-copilot\/1\.0 \(\+https?:\/\/.+\)$/);
  assert.ok(SAME_HOST_GAP_MS >= 1000, 'same host back to back is what earns a 429');

  // 3. SUPERSEDING. Three open send_queue Moves were stacked on the live screen,
  //    each quoting a different count of the same pile — and restating standing
  //    states weekly would have done the same to runway and the opening gap.
  const supersedes = REGISTRY.filter((j) => j.supersedes || j.standing).map((j) => j.key).sort();
  assert.deepEqual(supersedes, ['capability_gap', 'opening_gap', 'runway_guard', 'send_queue']);
  // An event-driven job must NOT supersede: two different sales, two Moves.
  for (const key of ['client_delivery', 'repeat_customer', 'watch', 'silence', 'goal_gap']) {
    const j = REGISTRY.find((x) => x.key === key);
    assert.ok(j && !j.supersedes && !j.standing, `${key} is event-driven and keeps every Move it writes`);
  }

  console.log('copilot-core: watcher-reality checks passed');
}

watcherReality().catch((e) => { console.error(e); process.exit(1); });
