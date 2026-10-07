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
  // The user's web hunts are paid per search (Exa), so they are metered like
  // Maps. What invariant 6 guards is the other half: nothing free is.
  assert.deepEqual(billable.sort(), ['google_maps', 'web'], 'paid searches and scraping credits are the only per-match cost');
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
  // The four-tab layout. '/copilot' is a prefix of it, so the boundary is what
  // decides: a link built on /copilot2 must stay there, and nothing that merely
  // starts with the same characters may claim it.
  assert.equal(shellOf('/copilot2'), '/copilot2');
  assert.equal(shellOf('/copilot2/pricing'), '/copilot2');
  assert.equal(shellOf('/copilot20'), DEFAULT_SHELL);
  assert.equal(shellOf('/copilot/2'), DEFAULT_SHELL);

  // 2. toShell guards a redirect target. The Stripe success_url is built by
  //    concatenating this onto the app origin, so anything not on the list has to
  //    collapse to the default rather than travel through.
  for (const s of SHELLS) assert.equal(toShell(s), s);
  for (const hostile of ['https://evil.example', '//evil.example', '/lifeos/../../evil', 'lifeos', '/lifeosX', '', ' /lifeos', '/copilot2/../evil', '/copilot2 ', null, undefined, 7, {}, ['/lifeos']]) {
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
  // "Above this line" meant the old Working tab's funnel; on You and on a Move it pointed at nothing.
  assert.doesNotMatch(stuck!.experiment, /above this line/i);
  assert.deepEqual(stuck!.measure, { metric: 'sent', target: 5 });

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
  assert.deepEqual(gap!.measure, { metric: 'sent', target: 10 }, '"the next ten" is counted in sends');
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
    // Counted only where a row can count it, and counted in the number the
    // sentence says — otherwise the You tab's meter reads "2 of 5" under "the
    // next ten".
    assert.equal(!!e!.measure, ['Sent', 'Replied', 'Meeting', 'Won'].includes(label), `${label}: measured only where a row can count it`);
    const word: Record<number, string> = { 3: 'three', 5: 'five', 10: 'ten' };
    const measure = e!.measure;
    if (measure) assert.match(e!.experiment, new RegExp(`\\b${word[measure.target]}\\b`, 'i'), `${label}: the experiment names the count it is measured by`);
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
  // The availability assertions below are exact lists, and several sensors read
  // the environment. tsx does not load .env.local, so they have always passed by
  // accident — one exported OPENAI_API_KEY and the deepEqual breaks for somebody
  // who changed nothing. Cleared here and restored at the end, so the suite
  // tests the sensors rather than the shell it happens to run in.
  const envKeys = ['COPILOT_AI_API_KEY', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'COPILOT_JOBS_URL'] as const;
  const savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
  for (const k of envKeys) delete process.env[k];

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
  // obligations joins them: the rows are typed, so there is nothing to connect,
  // and whether any are open is a result rather than a sensor.
  assert.deepEqual(await availableJobs(profile()), ['client_delivery', 'repeat_customer', 'obligations', 'goal_gap', 'silence', 'capability_gap']);
  assert.deepEqual(await availableJobs(profile({ linked_business_id: null })), ['obligations', 'goal_gap', 'silence', 'capability_gap']);
  // Both gate on onboarding, so a half-created profile reports no sensors at all
  // rather than two that always answer.
  assert.ok(!(await availableJobs(profile({ onboarding_complete: false }))).includes('silence'));
  assert.ok(!(await availableJobs(profile({ onboarding_complete: false }))).includes('obligations'));
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

  // The proposer is gated on a model being configured, exactly like `remote` is
  // gated on a worker URL. Both report "no sensor" rather than an empty list,
  // because a deployment with no model cannot propose and should say so.
  assert.ok(!(await availableJobs(profile())).includes('propose'), 'no model configured, no proposer');
  process.env.OPENAI_API_KEY = 'test-key';
  assert.ok((await availableJobs(profile())).includes('propose'));
  // And it still respects onboarding: a half-created profile has no goal to
  // move, and a proposal with no goal is the app inventing a direction for
  // somebody's business.
  assert.ok(!(await availableJobs(profile({ onboarding_complete: false }))).includes('propose'));
  delete process.env.OPENAI_API_KEY;

  for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
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
  BUSINESS_METRICS, CALL_FLOOR, DEAD_TOPIC_DECAY, DEFAULT_COST_MINUTES, METRIC_GOOD_DIRECTION, METRIC_LABEL, MIN_COST_MINUTES,
  arbitrate, costMinutesOf, kindPrior, scoreMove, type Stake,
} from '../../src/lib/copilot/stake';
import { draftFrom, scorable } from '../../src/lib/copilot/call';
import { COLD_AFTER_DAYS, coldIn, sendQueueJob } from '../../src/lib/copilot/jobs/send-queue';
import { STARTER_TOPIC_JOB, metricValue as mv, starterDecision as starter, statusLine, verdictOf as vo } from '../../src/lib/copilot/decision';
import { STAND_DOWN_KEY, standingRefusals } from '../../src/lib/copilot/working';
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

  // 1b. Every metric a call may stake itself on must be sayable out loud, and the
  //     database must accept it. The second half is not decoration: 20260909
  //     pinned verify_metric to the six funnel values, 20260911 widened this list
  //     to eight and forgot the constraint, and every Call staking `queue` or
  //     `runway_months` then failed 23514 into a console.error — so Today
  //     rendered the insight instead of the call, on most mornings, for weeks.
  for (const k of BUSINESS_METRICS) {
    if (k === 'none') continue;
    assert.ok(METRIC_LABEL[k]?.trim(), `${k} must have words a person would use`);
    assert.ok(!/_/.test(METRIC_LABEL[k]), `${k} reads as a column name, not a sentence`);
  }
  {
    const migration = readFileSync(new URL('../../supabase/migrations/20260920_copilot_decision_metrics.sql', import.meta.url), 'utf8');
    for (const k of BUSINESS_METRICS) {
      assert.ok(migration.includes(`'${k}'`), `20260920 must permit '${k}' or every Call staking it is lost`);
    }
  }

  // 1c. The status line: one number, and the one the call will be graded on, so
  //     the header and the card are about the same thing. It was three numbers
  //     in three units, led by "8 more ready" — a count of Moves, offering
  //     "more" than something the reader had never been shown.
  assert.equal(statusLine(metrics, { verify: { metric: 'queue' } } as never), '45 drafts waiting');
  assert.equal(statusLine(metrics, { verify: { metric: 'replies' } } as never), '2 replies');
  assert.equal(statusLine(metrics, { verify: { metric: 'none' } } as never), '3.4 months of runway', 'an ungradeable call falls back to runway');
  assert.equal(statusLine(metrics, null), '3.4 months of runway');
  // One number on screen. metricValue reads awaiting_approval, which counts open
  // drafts the queue cannot render — right for grading, wrong for showing, and
  // the reason the header said 61 while the call under it said 51.
  assert.equal(statusLine(metrics, { verify: { metric: 'queue' } } as never, 51), '51 drafts waiting');
  assert.equal(statusLine(metrics, { verify: { metric: 'queue' } } as never), '45 drafts waiting', 'no list given: the metric stands');
  assert.equal(statusLine({ ...metrics, runway_months: null } as never, null), null, 'no filler under a greeting');

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

  // 8b. THE ANSWER TO "can I trust it over time". Three signals of the user's
  //     own judgment were collected and one was read, weakly and temporarily.
  {
    const ctx2 = { capacityMinutes: 60 };
    const job = (id: string, j: string) => ({ id, kind: 'earn' as const, job: j, costMinutes: 30, stake: { metric: 'queue' as const, direction: 'down' as const, by: 10, withinDays: 1 } });

    // A refusal is an opinion about a suggestion. "I did it three times and the
    // number never moved" is the ledger's verdict on one that was carried out,
    // so it has to bite harder — it was computed, shown on one tab, and read by
    // nothing that decides anything.
    const plain = scoreMove(job('a', 'send_queue'), ctx2);
    const refusedOnce = scoreMove(job('a', 'send_queue'), { ...ctx2, refused: { send_queue: 1 } });
    const dead = scoreMove(job('a', 'send_queue'), { ...ctx2, dead: { send_queue: 3 } });
    assert.ok(dead < refusedOnce, 'the ledger outranks a mood');
    assert.ok(Math.abs(dead - plain * DEAD_TOPIC_DECAY) < 1e-9);

    // A standing refusal never expires. REFUSAL_WINDOW forgives after ten
    // decisions, which is right for "not today" and wrong for somebody who has
    // concluded outreach is no longer their leverage — and who then watched the
    // same card come back a fortnight later, which is the loudest complaint
    // this product has had about itself.
    const board = [job('a', 'send_queue'), job('b', 'silence')];
    assert.equal(arbitrate(board, ctx2).call?.id, 'a');
    const stood = arbitrate(board, { ...ctx2, standing: new Set(['send_queue']) });
    assert.equal(stood.call?.id, 'b', 'a standing refusal bars it however long ago it was made');
    assert.ok(stood.stoodDown.includes('send_queue'), 'and it is said out loud, once');
    // Barred from LEADING, not from existing: the work is still real.
    assert.ok(stood.rest.some((m) => m.id === 'a'));
  }

  // 8c. The ladder has to honour it too, or the stand-down is theatre: barring a
  //     job means arbitration promotes nothing, which falls through to exactly
  //     the function whose rungs are all outreach.
  {
    const m = { sent: 9, replies: 2, meetings: 1, won: 0, won_amount: 0, awaiting_approval: 61, runway_months: 3.4, window_days: 30, pipeline: { sourced: 140 } } as never;
    const input = { metrics: m, candidates: 5, offerEmpty: false, hasSegments: true };
    assert.match(starter(input).decision.headline, /Send the/, 'with a queue, the ladder sends');
    const quiet = starter({ ...input, standing: new Set(['send_queue']) }).decision;
    assert.doesNotMatch(quiet.headline, /Send|draft/i, 'stood down: it does not propose it under another name');
    assert.equal(quiet.verify_metric, 'none');
    // Mapped by name, not by guess. Only where the two mean the same thing.
    assert.equal(STARTER_TOPIC_JOB.sending, 'send_queue');
    assert.ok(!STARTER_TOPIC_JOB.opener, 'no job does what "change the opener" does; inventing one would bar a job never refused');
  }

  // 8d. Where a standing refusal lives. Not a new table: the working file's
  //     `refuse` section already means "what you will not do", so the user can
  //     see every stand-down in one place and lift one by deleting the line.
  {
    const row = (o: Record<string, unknown>) => ({ id: 'x', section: 'refuse', body: 'b', source: 'you', evidence: null, status: 'live', observed_key: null, created_at: '', updated_at: '', confirmed_at: null, ...o }) as never;
    const set = standingRefusals([
      row({ observed_key: `${STAND_DOWN_KEY}send_queue` }),
      row({ observed_key: `${STAND_DOWN_KEY}silence`, status: 'declined' }),
      row({ observed_key: 'opening:facebook ads' }),
      row({ observed_key: null }),
    ]);
    assert.deepEqual([...set], ['send_queue']);
    // A declined row is the user rejecting a READING, not an instruction about
    // what may be suggested. Counting it would bar a job they never refused.
    assert.ok(!set.has('silence'));
  }

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

  // The queue's urgency comes off the oldest draft, not off a constant.
  //
  // It was `withinDays: 1` — the floor of the urgency curve, so outreach took
  // the x3 multiplier every morning of its life on top of the top kind prior.
  // Nothing without a money figure on its stake could reach that, which meant
  // arbitration was real and the screen was unchanged: every `decide` job in
  // the registry sat below the send queue by construction.
  const qm = (waited: number) => ({ id: 'q', kind: 'earn' as const, job: 'send_queue', costMinutes: 30, stake: { metric: 'queue' as const, direction: 'down' as const, by: 10, withinDays: coldIn(waited) } });
  assert.ok(coldIn(0) > coldIn(11), 'a draft that has waited longer has less time left, not more');
  assert.equal(coldIn(99), 1, 'past cold it is today, and never zero — urgency must not divide by zero');
  assert.ok(scoreMove(qm(0), { capacityMinutes: 60 }) < scoreMove(qm(11), { capacityMinutes: 60 }),
    'a queue written this morning is not as urgent as one eleven days old');
  // What the change is worth, stated as what it costs to beat the queue rather
  // than as a claim it no longer wins — because a fresh queue still edges a
  // decide Move carrying no number at all, 2.14 to 2.10, and asserting
  // otherwise would be tuning COLD_AFTER_DAYS until a test passed.
  //
  // What moved is the PRICE of the top of the screen. Against a queue pinned at
  // x3, a decide Move needed roughly 43% of monthly burn on its stake before it
  // could win. Against one that starts at x2.14 and climbs, the smallest named
  // number does it. That is the money factor doing the work instead of a
  // constant, which is the only version of this that is honest — and it is why
  // the remaining distance is obligations with real data in them, not a bigger
  // thumb on the scale here.
  const burn = { capacityMinutes: 60, monthlyBurn: 3000 };
  const decide = (value?: number) => ({ id: 'd', kind: 'decide' as const, job: 'silence', costMinutes: 10, stake: { metric: 'replies' as const, direction: 'up' as const, by: 1, withinDays: 7, value } });
  assert.equal(arbitrate([qm(0), decide()], burn).call?.id, 'q', 'with nothing named, the queue still edges it');
  assert.equal(arbitrate([qm(0), decide(100)], burn).call?.id, 'd', 'but now any real number takes the day off a fresh queue');
  assert.equal(arbitrate([qm(11), decide(100)], burn).call?.id, 'q', 'and a stale queue still wins, which is correct');
  // The old pin, for the size of what changed: 100 against a x3 queue lost.
  const pinned = { id: 'q', kind: 'earn' as const, job: 'send_queue', costMinutes: 30, stake: { metric: 'queue' as const, direction: 'down' as const, by: 10, withinDays: 1 } };
  assert.equal(arbitrate([pinned, decide(100)], burn).call?.id, 'q', 'before, the same Move could not');

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
       target_value: 15000, current_value: 1200, horizon_days: 90, priority: 1, status: 'active', note: null,
       created_at: '2026-09-01T08:00:00Z', ...over });

  // 1. Only a goal with a meter behind it can be measured. "Monetize App — 0 of
  //    10 users" and "Get a job" are real goals this job must stay silent about,
  //    because nothing in Metrics counts users or offers and a projection with
  //    no meter is the invention every other job here refuses to make.
  assert.equal(measurable(goal()), true);
  assert.equal(measurable(goal({ metric: 'number', unit: 'users', target_value: 10, current_value: 0 })), false);
  assert.equal(measurable(goal({ target_value: null })), false, 'no target, nothing to be short of');
  assert.equal(measurable(goal({ current_value: 15000 })), false, 'already there');
  assert.equal(goalMove(goal({ metric: 'number' }), met(), '2026-09-01'), null);

  // 2. The user's own priority order decides which one speaks. Not a ranking
  //    this file invents on their behalf.
  assert.equal(pickGoal([goal({ id: 'b', priority: 3 }), goal({ id: 'a', priority: 1 })])?.id, 'a');
  assert.equal(pickGoal([goal({ metric: 'number' })]), null);
  assert.equal(pickGoal([]), null);

  // 3. The rate is read off logged wins, never assumed.
  assert.equal(monthlyRate(met({ won_amount: 3000, window_days: 30 })), 3000);
  assert.equal(monthlyRate(met({ won_amount: 0 })), null, 'nothing closed is not a rate of zero to divide by');

  // 4. The arithmetic, and the sentence it produces.
  const m = goalMove(goal(), met({ won_amount: 1000 }), '2026-09-01')!;
  assert.equal(m.kind, 'decide');
  assert.equal(m.external_id, 'goal:g1:2026-09', 'once a month per goal');
  assert.match(m.headline, /Emergency is at \$1,200 of \$15,000/);
  assert.match(m.headline, /14 months away, not 90 days/, 'the date the user set is the one it is measured against');
  assert.ok(m.artifact.value.includes('gap $13,800'));
  assert.equal(m.stake?.withinDays, 90, 'the stake inherits the horizon, so urgency is theirs not ours');
  assert.equal(m.stake?.value, 13800);
  assert.ok(isDeliverable(m));

  // The days count down from the goal's date. They were the horizon it was
  // written with, so "not 90 days" was said on the day it was set and on every
  // day after — a month later the goal still had ninety days to go.
  const month = goalMove(goal(), met({ won_amount: 1000 }), '2026-10-01')!;
  assert.match(month.headline, /not 60 days/, 'thirty days on, sixty are left');
  assert.equal(month.stake?.withinDays, 60);
  assert.match(month.why[0], /60 days to do it in/);
  const late = goalMove(goal(), met({ won_amount: 1000 }), '2026-12-15')!;
  assert.match(late.headline, /its date has passed/, 'a date gone by is said, not counted as a horizon');
  assert.equal(late.stake?.withinDays, 1, 'a passed date is as urgent as a date can be');
  // Without the day it was written there is no date to count to, and no days are claimed.
  const undated = goalMove(goal({ created_at: undefined }), met({ won_amount: 1000 }), '2026-10-01')!;
  assert.ok(!/days/.test(undated.headline) && !/days to do it in/.test(undated.why[0]), undated.headline);

  // Nothing closing says so, rather than dividing by zero into a number.
  const dead = goalMove(goal(), met({ won: 0, won_amount: 0 }), '2026-09-01')!;
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
  assert.deepEqual(standing, ['capability_gap', 'obligations', 'opening_gap', 'runway_guard']);
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
  // `propose` supersedes without being standing, which is the pair coming apart
  // for the first time. It is not a state that stays true and restates weekly
  // under a period-keyed id — each proposal is different work — but two open at
  // once is exactly the stacked send_queue problem above, each card saying "hand
  // this over" about something else. Superseded rows are deleted rather than
  // dismissed, so one the user never saw cannot teach dismissedStreak that they
  // turned it down.
  assert.deepEqual(supersedes, ['capability_gap', 'obligations', 'opening_gap', 'propose', 'runway_guard', 'send_queue']);
  assert.ok(!REGISTRY.find((j) => j.key === 'propose')?.standing, 'a proposal is not a standing state');
  // An event-driven job must NOT supersede: two different sales, two Moves.
  for (const key of ['client_delivery', 'repeat_customer', 'watch', 'silence', 'goal_gap']) {
    const j = REGISTRY.find((x) => x.key === key);
    assert.ok(j && !j.supersedes && !j.standing, `${key} is event-driven and keeps every Move it writes`);
  }

  console.log('copilot-core: watcher-reality checks passed');
}

watcherReality().catch((e) => { console.error(e); process.exit(1); });

// --- what the app saw, and money with a date on it
//
// Two holes in the ledger, both measured on the live account: 9 sent in 30 days
// against 51 drafts, 2 replies and 6 MEETINGS — nine sends do not produce six
// meetings — and won_amount = $1 against those same six. The app grades its own
// calls against two numbers nobody is feeding it.
import { MAX_CAPTURE_ROWS, OPENED_SETTLE_MINUTES, captureAsk, openedAwaitingAnswer, repliesAwaitingOutcome } from '../../src/lib/copilot/capture';
import { HORIZON_DAYS, daysUntil, dueSoon, forecast, overdueIn } from '../../src/lib/copilot/obligations';
import { collectMove } from '../../src/lib/copilot/jobs/obligations';
import { scoreMove as score } from '../../src/lib/copilot/stake';
import type { Obligation } from '../../src/lib/copilot/obligations';

async function ledger() {
  const now = new Date('2026-09-12T12:00:00Z');

  // 1. OPENING IS NOT SENDING. Nothing here converts one into the other — the
  //    app observed a tap, not a message going out. It produces a question.
  const draft = (o: Partial<{ id: string; who: string; openedAt: string; channel: string; sent: boolean }>) =>
    ({ id: 'a', who: 'Norj', openedAt: '2026-09-12T09:00:00Z', channel: 'whatsapp', sent: false, ...o });
  assert.equal(openedAwaitingAnswer([draft({})], now).length, 1);
  assert.equal(openedAwaitingAnswer([draft({ sent: true })], now).length, 0, 'already confirmed is not asked about');
  // Just opened: still being typed. Asking now is the nagging this replaces.
  assert.equal(openedAwaitingAnswer([draft({ openedAt: '2026-09-12T11:58:00Z' })], now).length, 0);
  assert.ok(OPENED_SETTLE_MINUTES >= 5);
  // But it never ages out — a tap from last week is still a hole in the ledger.
  assert.equal(openedAwaitingAnswer([draft({ openedAt: '2026-09-01T09:00:00Z' })], now).length, 1);
  // Clock skew is not a message from tomorrow.
  assert.equal(openedAwaitingAnswer([draft({ openedAt: '2026-09-20T09:00:00Z' })], now).length, 0);
  // Oldest first, and bounded: one card, not a to-do list.
  const many = openedAwaitingAnswer(
    Array.from({ length: 12 }, (_, i) => draft({ id: `d${i}`, openedAt: `2026-09-0${(i % 9) + 1}T09:00:00Z` })), now);
  assert.equal(many.length, MAX_CAPTURE_ROWS);
  assert.ok(many[0].openedAt <= many[1].openedAt);

  // 2. A REPLY WITH NO ENDING. won_amount = $1 against six meetings is the
  //    outcome half of the same problem.
  const rep = (o: Partial<{ opportunityId: string; who: string; repliedAt: string; resolved: boolean }>) =>
    ({ opportunityId: 'o1', who: 'Andrea', repliedAt: '2026-09-01T09:00:00Z', resolved: false, ...o });
  assert.equal(repliesAwaitingOutcome([rep({})], now).length, 1);
  assert.equal(repliesAwaitingOutcome([rep({ resolved: true })], now).length, 0, 'a won or lost closes it');
  assert.equal(repliesAwaitingOutcome([rep({ repliedAt: '2026-09-11T09:00:00Z' })], now).length, 0, 'yesterday is not stale');

  // 3. SENDS LEAD. An unconfirmed send corrupts `sent`, which every other number
  //    is computed against — including the reply rate that decides whether the
  //    opener works. An unlogged outcome corrupts one goal.
  const both = captureAsk({ opened: [draft({})], replies: [rep({})], sentInWindow: 9, windowDays: 30 });
  assert.equal(both?.kind, 'opened');
  assert.match(both!.because, /9 sent in 30 days/, 'and it says which number it is repairing');
  assert.equal(captureAsk({ opened: [], replies: [rep({})], sentInWindow: 9, windowDays: 30 })?.kind, 'outcome');
  // A clean ledger renders nothing. A standing "nothing to confirm" panel is the
  // filler this codebase keeps deleting.
  assert.equal(captureAsk({ opened: [], replies: [], sentInWindow: 9, windowDays: 30 }), null);
  assert.match(captureAsk({ opened: [draft({}), draft({ id: 'b' })], replies: [], sentInWindow: 9, windowDays: 30 })!.headline, /2 messages/);

  // 4. THE MONEY FACTOR FINALLY HAS AN INPUT.
  //
  //    This is the whole argument for the sensor, so it is checked rather than
  //    asserted in prose: only three jobs could ever set stake.value, two from a
  //    legacy sales table this product does not use — so on a real account the
  //    factor sat at 1.0 on nearly every Move.
  const ob = (o: Partial<Obligation>): Obligation => ({
    id: 'ob1', direction: 'in', counterparty: 'Sea Nymph Resort', amount: 2000, currency: '$',
    due_on: '2026-09-09', status: 'open', note: null, settled_at: null, created_at: '2026-09-01T00:00:00Z', ...o,
  });
  const ctx = { monthlyBurn: 350, capacityMinutes: 60 };
  const collect = collectMove(ob({}), now);
  assert.equal(collect.kind, 'earn');
  assert.equal(collect.stake?.value, 2000, 'a real figure, typed by a person, reaching scoreMove');
  assert.match(collect.headline, /3 days late/);

  const collectScore = score({ kind: collect.kind, stake: collect.stake, costMinutes: 5, job: 'obligations' }, ctx);
  const queueScore = score({ kind: 'earn', stake: { metric: 'queue', direction: 'down', by: 10, withinDays: 1 }, costMinutes: 30, job: 'send_queue' }, ctx);
  assert.ok(collectScore > queueScore, 'an overdue invoice outranks a same-day send queue');
  assert.ok(collectScore / queueScore >= 2, `and not narrowly: ${collectScore.toFixed(1)} against ${queueScore.toFixed(1)}`);

  // 5. THE FORECAST. cash / burn assumes nothing is owed in either direction,
  //    which is never true of somebody running on invoices.
  assert.equal(daysUntil('2026-09-15', now), 3);
  assert.equal(daysUntil('2026-09-09', now), -3);
  assert.equal(daysUntil('not-a-date', now), Number.POSITIVE_INFINITY, 'a bad date is never due');
  assert.deepEqual(overdueIn([ob({}), ob({ id: 'x', due_on: '2026-09-30' })], now).map((o) => o.id), ['ob1']);
  assert.deepEqual(dueSoon([ob({ id: 'soon', due_on: '2026-09-20' }), ob({})], now).map((o) => o.id), ['soon']);
  // Settled rows never rank, and never forecast.
  assert.equal(overdueIn([ob({ status: 'settled' })], now).length, 0);

  const f = forecast({ cash: 1190, monthlyBurn: 350 }, [ob({}), ob({ id: 'bill', direction: 'out', amount: 500, due_on: '2026-09-20' })], now);
  assert.equal(f.incoming, 2000);
  assert.equal(f.outgoing, 500);
  assert.equal(f.net, 2690);
  assert.equal(f.months, 3.4, 'cash alone, matching the header');
  assert.equal(f.forecastMonths, 7.7);
  assert.equal(f.changesTheAnswer, true, 'that is a different month, not a decorated number');
  // No burn, no projection — never a guess.
  assert.equal(forecast({ cash: 1190, monthlyBurn: null }, [], now).months, null);
  // Never negative: "minus one month of runway" is not something anybody can act on.
  assert.equal(forecast({ cash: 100, monthlyBurn: 350 }, [ob({ direction: 'out', amount: 5000, due_on: '2026-09-20' })], now).forecastMonths, 0);
  // Outside the horizon it is not today's decision.
  assert.equal(forecast({ cash: 1190, monthlyBurn: 350 }, [ob({ due_on: '2027-01-01' })], now).incoming, 0);
  assert.ok(HORIZON_DAYS >= 30);

  console.log('copilot-core: ledger checks passed');
}

ledger().catch((e) => { console.error(e); process.exit(1); });

// --- finding the feeds, and counting what they returned
//
// Two failures this guards against, and they are opposites. Discovery that
// offers a URL nobody fetched is the app inventing supply — the thing
// INFERRED_SCORE_CAP was written to stop, one layer further out. Discovery
// without a yield read is a machine that adds sources faster than anyone can
// prune them, and the user's only signal is a vague sense that the app got
// noisy.
import {
  MAX_DISCOVERED, MAX_QUERIES, MAX_TRIES_PER_PAGE, MIN_VERIFY_ITEMS,
  candidateFeeds, discoveredFrom, discoveryQueries, feedGuesses, feedLinksFromHtml,
  hostOf, newCandidates, rankDiscovered, titleLabel,
} from '../../src/lib/copilot/watch/discover';
import { exaHits } from '../../src/lib/copilot/watch/exa';
import { QUIET_AFTER_DAYS, pruneSuggestions, sourceIdOf, sourceYield, yieldLine } from '../../src/lib/copilot/watch/yield';
import type { DiscoveryCandidate } from '../../src/lib/copilot/watch/discover';

async function discovery() {
  const profile = {
    offer: { sells: 'WhatsApp booking automations', for_who: 'resorts', problem: 'enquiries go unanswered' },
    hunt_types: ['client'] as const,
    target_area: 'Cebu',
    location: null,
  };

  // --- the queries
  {
    const qs = discoveryQueries({ ...profile, hunt_types: [...profile.hunt_types] });
    assert.ok(qs.length > 0 && qs.length <= MAX_QUERIES, 'bounded: every query is money');
    assert.ok(qs.some((q) => q.query.includes('WhatsApp booking automations')), 'built from the offer');
    assert.ok(qs.some((q) => q.query.includes('Cebu')), 'target_area localises it');
    // Invariant 1, one step further out: a search run from a blank offer returns
    // whatever the engine free-associates, and that is not the user's world.
    assert.deepEqual(discoveryQueries({ ...profile, offer: {}, hunt_types: [...profile.hunt_types] }), []);
    assert.deepEqual(discoveryQueries({ ...profile, offer: { for_who: 'resorts' }, hunt_types: [...profile.hunt_types] }), []);
    // hunt_types picks the shapes: signal wants newsletters, not job boards.
    const signal = discoveryQueries({ ...profile, hunt_types: ['signal'] });
    assert.ok(signal.every((q) => !q.query.includes('job board')), 'signal does not get marketplaces');
    // Two hunt_types selecting the same shape is one search, not two.
    const both = discoveryQueries({ ...profile, hunt_types: ['client', 'community'] });
    assert.equal(new Set(both.map((q) => q.query)).size, both.length, 'no duplicate searches');
  }

  // --- autodiscovery off a page
  {
    const html = `<html><head>
      <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS">
      <link type="application/atom+xml" rel="alternate" href="https://other.test/atom">
      <link rel="alternate" type="text/html" href="/print">
      <link rel="stylesheet" href="/x.css">
      <link rel='alternate' type='application/rss+xml' href='/tag/jobs/rss?a=1&amp;b=2'/>
    </head></html>`;
    const links = feedLinksFromHtml(html, 'https://site.test/blog');
    assert.ok(links.includes('https://site.test/feed.xml'), 'relative href resolved against the page');
    assert.ok(links.includes('https://other.test/atom'), 'attribute order does not matter');
    assert.ok(links.some((l) => l.includes('a=1&b=2')), 'the href is entity-decoded');
    assert.ok(!links.some((l) => l.includes('/print')), 'alternate but not a feed type');
    assert.ok(!links.some((l) => l.includes('x.css')), 'a stylesheet is not a feed');
  }

  // --- candidates for one page
  {
    // A subreddit converts with no page fetch at all, which is most of what the
    // community shapes return.
    const reddit = candidateFeeds('https://www.reddit.com/r/forhire');
    assert.equal(reddit[0], 'https://www.reddit.com/r/forhire/new/.rss', 'normalised first, no fetch needed');

    const guesses = feedGuesses('https://site.test/blog/');
    assert.equal(guesses[0], 'https://site.test/blog/feed', 'section-relative before the root feed');
    assert.ok(guesses.includes('https://site.test/feed'));

    const declared = candidateFeeds('https://site.test/blog', '<link rel="alternate" type="application/rss+xml" href="/real.xml">');
    assert.equal(declared[0], 'https://site.test/real.xml', 'what the site declares beats what we guess');
    assert.ok(declared.length <= MAX_TRIES_PER_PAGE, 'bounded: each try is a fetch');
  }

  // --- which hits are worth fetching
  {
    const seen = new Set(['reddit.com']);
    const hits = [
      { url: 'https://www.reddit.com/r/forhire', title: 'r/forhire' },
      { url: 'https://boards.test/a', title: 'A' },
      { url: 'https://boards.test/b', title: 'B' },
      { url: 'https://other.test/c', title: 'C' },
    ];
    const got = newCandidates(hits, 'Where work is posted', seen);
    assert.equal(got.length, 2, 'already watched is skipped, and one host answers once');
    assert.deepEqual(got.map((c) => hostOf(c.page)), ['boards.test', 'other.test']);
    assert.equal(got[0].intent, 'Where work is posted', 'the shape label becomes the source intent');
  }

  // --- only a feed that actually returned items is offered
  {
    const cand: DiscoveryCandidate = { page: 'https://site.test/jobs', title: 'Jobs', intent: 'Where work is posted' };
    const items = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `Item ${i}` }));

    assert.equal(discoveredFrom(cand, 'https://site.test/feed', items(MIN_VERIFY_ITEMS - 1)), null,
      'one or two items is a placeholder page, not a feed');
    const ok = discoveredFrom(cand, 'https://site.test/feed', items(9));
    assert.ok(ok && ok.items === 9);
    assert.equal(ok!.sample, 'Item 0', 'the card carries one of the feed\'s own headlines');

    // The name on the card. A host-derived slug reads as "Weworkremotely"; the
    // page's own title, cut at the first separator, is the name a person uses.
    assert.equal(titleLabel('We Work Remotely: Remote Jobs for Digital Nomads'), 'We Work Remotely');
    assert.equal(titleLabel('Hacker News — new'), 'Hacker News');
    assert.equal(titleLabel('r/forhire'), 'r/forhire');
    assert.equal(titleLabel('https://site.test/x'), '', 'a bare url is not a name');
    assert.equal(titleLabel('a'.repeat(60)), '', 'an unseparated paragraph is not a name either');
    assert.equal(
      discoveredFrom({ ...cand, title: 'We Work Remotely: Remote Jobs' }, 'https://weworkremotely.com/jobs.rss', items(5))!.label,
      'We Work Remotely');
    // But a shape the normaliser RECOGNISED keeps its own label: "r/forhire"
    // beats whatever Reddit puts in a <title>.
    assert.equal(
      discoveredFrom({ ...cand, title: 'Reddit - Dive into anything' }, 'https://www.reddit.com/r/forhire', items(5))!.label,
      'r/forhire');
    // A feed whose newest item has no title cannot show evidence, so it is not
    // offered — same rule as a lesson with no URL not being rendered.
    assert.equal(discoveredFrom(cand, 'https://site.test/feed', [{ title: '  ' }, ...items(5)]), null);
  }

  // --- ranking
  {
    const mk = (url: string, items: number) => ({ url, label: url, intent: 'i', page: 'p', sample: 's', items });
    const ranked = rankDiscovered([mk('https://a.test/f', 3), mk('https://a.test/f', 11), mk('https://b.test/f', 7)]);
    assert.equal(ranked.length, 2, 'a site serving RSS and Atom is one source, not two');
    assert.deepEqual(ranked.map((r) => r.items), [11, 7], 'livelier first');
    assert.ok(rankDiscovered(Array.from({ length: 40 }, (_, i) => mk(`https://s${i}.test/f`, i))).length <= MAX_DISCOVERED);
  }

  // --- the Exa response, parsed
  {
    const hits = exaHits({
      results: [
        { url: 'https://ok.test/a', title: 'A', summary: 'a board', publishedDate: '2026-09-01T00:00:00Z' },
        { url: 'not-a-url', title: 'B' },
        { title: 'C' },
        { url: 'https://ok.test/d' },
      ],
    });
    assert.equal(hits.length, 2, 'anything without a fetchable url is dropped at the door');
    assert.equal(hits[0].summary, 'a board');
    assert.equal(hits[1].title, 'https://ok.test/d', 'a missing title falls back to the url, never to invention');
    assert.deepEqual(exaHits({}), []);
    assert.deepEqual(exaHits(null), []);
  }

  // --- attributing a Move back to its source
  {
    // movesFromVerdicts writes `${source.id}:${item.id}`, and a feed guid is
    // very often a URL. Splitting on the last colon mis-attributes every Move
    // from every feed that uses one, which is most of them.
    assert.equal(sourceIdOf('src-1:https://site.test/post/9'), 'src-1');
    assert.equal(sourceIdOf('src-1:plain-id'), 'src-1');
    assert.equal(sourceIdOf('no-colon'), null);
    assert.equal(sourceIdOf(':leading'), null);
    assert.equal(sourceIdOf(null), null);
  }

  // --- the yield read
  {
    const now = new Date('2026-09-12T09:00:00Z');
    const old = '2026-08-01T00:00:00Z';
    const sources = [
      { id: 'earning', created_at: old, last_checked_at: old },
      { id: 'noisy', created_at: old, last_checked_at: old },
      { id: 'quiet', created_at: old, last_checked_at: old },
      { id: 'fresh', created_at: '2026-09-11T00:00:00Z', last_checked_at: null },
    ];
    const rows = [
      ...Array.from({ length: 4 }, (_, i) => ({ external_id: `earning:i${i}`, status: 'done' })),
      ...Array.from({ length: 5 }, (_, i) => ({ external_id: `noisy:i${i}`, status: 'dismissed' })),
      { external_id: 'noisy:open', status: 'open' },
      // A Move from a source since removed still happened, but there is no card
      // left to put its record on.
      { external_id: 'deleted-source:i0', status: 'done' },
    ];
    const y = sourceYield(rows, sources, now);

    assert.equal(y.get('earning')!.verdict, 'earning');
    assert.equal(y.get('earning')!.rate, 1);
    assert.equal(y.get('noisy')!.verdict, 'noise');
    assert.equal(y.get('noisy')!.dismissed, 5);
    assert.equal(y.get('noisy')!.open, 1, 'unanswered Moves are counted but do not move the rate');
    // A source that produced nothing is the interesting one, and a group-by over
    // Moves alone would silently omit it.
    assert.equal(y.get('quiet')!.verdict, 'quiet');
    assert.equal(y.get('quiet')!.moves, 0);
    assert.equal(y.get('fresh')!.verdict, 'new', 'added yesterday and never read has no record to judge');
    assert.equal(y.size, 4, 'every source gets a row; a deleted one gets none');

    // Below MIN_MOVE_SAMPLE there is no rate — one bad morning is not a preference.
    const thin = sourceYield([{ external_id: 'earning:x', status: 'dismissed' }], [sources[0]], now);
    assert.equal(thin.get('earning')!.rate, null);
    assert.equal(thin.get('earning')!.verdict, 'unanswered');

    // A middling keep rate is its own answer. The first version folded this band
    // into 'unanswered', so a feed the user kept half of was indistinguishable
    // from one they had never seen — and verdict ships to the client.
    const half = sourceYield(
      [...Array.from({ length: 5 }, (_, i) => ({ external_id: `earning:k${i}`, status: 'done' })),
       ...Array.from({ length: 5 }, (_, i) => ({ external_id: `earning:b${i}`, status: 'dismissed' }))],
      [sources[0]], now,
    ).get('earning')!;
    assert.equal(half.rate, 0.5);
    assert.equal(half.verdict, 'mixed', 'kept half is not the same as never judged');

    // --- the line under the card
    assert.equal(yieldLine(undefined), null, 'a payload written before this field must not blank the sheet');
    assert.equal(yieldLine(y.get('quiet')), `Nothing in ${QUIET_AFTER_DAYS} days`);
    assert.equal(yieldLine(y.get('earning')), '4 found · 4 kept');
    assert.equal(yieldLine(y.get('noisy')), '6 found · 5 binned');
    assert.equal(yieldLine(y.get('fresh')), null, 'nothing to say is said by saying nothing');

    // --- what to suggest removing
    const prune = pruneSuggestions(y.values());
    assert.deepEqual(prune.map((p) => p.sourceId), ['noisy', 'quiet'],
      'noise first: it costs a call a night AND a judgement every morning');
    assert.ok(!prune.some((p) => p.sourceId === 'earning'));
  }

  console.log('copilot-core: discovery checks passed');
}

discovery().catch((e) => { console.error(e); process.exit(1); });

// --- what the app knows, as opposed to what it can guess
//
// The rule the whole file rests on: two sources and never a third. A sentence
// the user wrote is true because they said so; a sentence the app wrote is true
// because it can point at the count behind it. There is no inferred tier, and
// the test that matters most here is the one asserting every observed line
// carries its own arithmetic — that is what separates this from the skill levels
// and estimated percentages deleted in 3eaa03f.
import {
  BODY_MAX, BRIEF_MAX, MAX_PER_SECTION, MIN_OBSERVED, SECTION, SECTIONS,
  emptySections, isSection, newObserved, observedFrom, workingBrief, workingProgress,
} from '../../src/lib/copilot/working';
import type { WorkingEntry } from '../../src/lib/copilot/working';

async function workingFile() {
  const entry = (o: Partial<WorkingEntry>): WorkingEntry => ({
    id: 'w1', section: 'deliver', body: 'Five working days', source: 'you', evidence: null,
    status: 'live', observed_key: null, created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z', confirmed_at: '2026-09-01T00:00:00Z', ...o,
  });

  const diagnosis = {
    thin: false,
    stages: [
      { key: 'matched', label: 'Matched', count: 40, rate: null },
      { key: 'drafted', label: 'Drafted', count: 30, rate: 0.75 },
      { key: 'sent', label: 'Sent', count: 9, rate: 0.3 },
      { key: 'replied', label: 'Replied', count: 2, rate: 0.22 },
    ],
    bottleneck: { key: 'sent', label: 'Sent', count: 9, rate: 0.3 },
    findings: [],
    openings: [{ term: 'late-night enquiries', count: 7 }],
    segments: [{ segment: 'resorts', businesses: 12, openings: [{ term: 'no-shows', count: 5 }] }],
    outsideFunnel: 0,
  } as unknown as Parameters<typeof observedFrom>[0];
  const metrics = {
    window_days: 30, sent: 9, replies: 2, reply_rate: 0.22, meetings: 6,
    won: 2, won_amount: 1800, lost: 1, awaiting_approval: 51,
    pipeline: { new: 0, saved: 0, sourced: 0, inferred: 0 }, runway_months: 3.4,
  } as unknown as Parameters<typeof observedFrom>[1];

  // --- every observed line carries its own arithmetic
  {
    const drafts = observedFrom(diagnosis, metrics);
    assert.ok(drafts.length > 0);
    for (const d of drafts) {
      assert.ok(/\d/.test(d.body), `"${d.body}" states no number — that is an interpretation, not a reading`);
      assert.ok(d.evidence && /\d/.test(d.evidence), `"${d.body}" carries no countable evidence`);
      assert.ok(d.observed_key, 'without a stable key the nightly pass restacks the same sentence');
      assert.ok(isSection(d.section));
    }
    // The shape that is banned: a verdict about the person rather than a count.
    for (const d of drafts) {
      assert.ok(!/\byou are\b|\byou're\b|\bgood at\b|\bstrong\b|\bweak\b/i.test(d.body),
        `"${d.body}" grades the user; a reading states what happened`);
    }
    assert.ok(drafts.some((d) => d.body.includes('9 sent') && d.body.includes('2 replied')),
      'a rate is stated as both counts or it reads as a grade');

    // Nothing at all from a funnel the diagnosis itself calls thin. Being wrong
    // once about somebody's own business costs being believed about anything.
    assert.deepEqual(observedFrom({ ...diagnosis, thin: true }, metrics), []);
    // And nothing below the floor.
    const quiet = observedFrom(
      { ...diagnosis, openings: [{ term: 'x', count: 2 }], segments: [{ segment: 'y', businesses: 2, openings: [] }] } as typeof diagnosis,
      { ...metrics, sent: 2, won: 0, won_amount: 0 } as typeof metrics,
    );
    assert.ok(!quiet.some((d) => d.observed_key.startsWith('opening:') || d.observed_key.startsWith('segment:')),
      `a pattern under ${MIN_OBSERVED} rows is one good week`);

    // won_amount has sat at $1 against six meetings on the live account. "You
    // have won $1" is true and teaches a model a wrong price band.
    assert.ok(!observedFrom(diagnosis, { ...metrics, won: 1, won_amount: 0 } as typeof metrics)
      .some((d) => d.section === 'price'), 'no price reading without a real amount');
  }

  // --- proposals do not stack, and a no is remembered
  {
    const drafts = observedFrom(diagnosis, metrics);
    const first = drafts[0];
    const at = (existing: WorkingEntry[]) => newObserved([first], existing);

    // Unchanged: nothing to write. Rewriting it bumps updated_at and makes the
    // sheet look like something happened when nothing did.
    const same = at([entry({ observed_key: first.observed_key, body: first.body, status: 'proposed' })]);
    assert.equal(same.propose.length + same.refresh.length, 0);
    // Changed and not yet settled: worth re-proposing.
    const changed = at([entry({ observed_key: first.observed_key, body: 'something older', status: 'proposed' })]);
    assert.deepEqual([changed.propose.length, changed.refresh.length], [1, 0]);
    // Declined: never again. Same failure REFUSAL_DECAY stops one layer up.
    const no = at([entry({ observed_key: first.observed_key, body: 'older', status: 'declined' })]);
    assert.equal(no.propose.length + no.refresh.length, 0);

    // ALREADY CONFIRMED and the number moved: refresh in place, never propose.
    // The first version only skipped 'declined', so a confirmed "9 sent in the
    // last 30 days, 2 replied" was demoted back to 'proposed' the night the
    // count reached 10 — dropping out of workingBrief and reappearing under "It
    // noticed" every morning. What was confirmed is the READING; the number
    // moving is the reading working.
    const live = at([entry({ observed_key: first.observed_key, body: 'an older count', status: 'live' })]);
    assert.deepEqual([live.propose.length, live.refresh.length], [0, 1],
      'a confirmed reading is refreshed, not demoted');
    assert.equal(live.refresh[0].body, first.body);

    assert.equal(newObserved(drafts, []).propose.length, drafts.length, 'an empty file takes everything');
    assert.equal(newObserved(drafts, []).refresh.length, 0);
  }

  // --- the block the prompts read
  {
    const entries = [
      entry({ id: 'a', section: 'deliver', body: 'Two calls, then five working days.' }),
      entry({ id: 'b', section: 'refuse', body: 'No retainers under $100.' }),
      entry({ id: 'c', section: 'works_for', body: '12 of your matches are resorts.', source: 'observed', evidence: '12 matches' }),
      // A proposal is the app's reading waiting on the person who lived it.
      // Feeding it to a model first would make confirming it decorative.
      entry({ id: 'd', section: 'price', body: 'Not confirmed yet', status: 'proposed', source: 'observed', evidence: '2 won' }),
      entry({ id: 'e', section: 'price', body: 'Said no to this', status: 'declined' }),
    ];
    const brief = workingBrief(entries);
    assert.ok(brief.includes('No retainers under $100.'));
    assert.ok(!brief.includes('Not confirmed yet'), 'a proposal never reaches a prompt');
    assert.ok(!brief.includes('Said no to this'), 'nor does a declined reading');
    // The evidence travels with it, so a model can tell a count from a claim.
    assert.ok(brief.includes('(from your rows: 12 matches)'));
    assert.ok(!/\(from your rows/.test(brief.split('\n').find((l) => l.includes('Two calls'))!),
      'the user\'s own statement needs no evidence — they are the evidence');
    // Sections come out in the declared order, so the prompt is stable across
    // nights and the model is not re-reading a reshuffled document.
    assert.ok(brief.indexOf(SECTION.deliver.label) < brief.indexOf(SECTION.works_for.label));
    assert.equal(workingBrief([]), '', 'an empty file adds nothing rather than an empty heading');
    assert.equal(workingBrief([entry({ status: 'proposed' })]), '');

    // The budget. Without it a full file is ~29k characters at the head of every
    // per-source judge prompt, six sources a night.
    const fat = SECTIONS.flatMap((section, i) =>
      Array.from({ length: 8 }, (_, j) => entry({ id: `f${i}-${j}`, section, body: 'x'.repeat(BODY_MAX) })));
    const capped = workingBrief(fat);
    assert.ok(capped.length <= BRIEF_MAX, `budget held: ${capped.length} <= ${BRIEF_MAX}`);
    assert.ok(capped.length > 0, 'a budget is not a mute button');
    // Stops on a whole line rather than truncating one: half a sentence about
    // somebody's pricing is worse than none, because a model completes it.
    assert.ok(!capped.endsWith('x'.repeat(10) + '…') && capped.split('\n').every((l) => l.length <= BODY_MAX + 80));
  }

  // --- progress, as a count and never a percentage
  {
    const entries = [entry({ section: 'deliver' }), entry({ id: 'x', section: 'refuse' }), entry({ id: 'y', status: 'proposed' })];
    assert.deepEqual(workingProgress(entries), { filled: 2, total: SECTIONS.length, proposals: 1 });
    assert.deepEqual(emptySections(entries).sort(), ['price', 'tried', 'voice', 'works_for'].sort());
    assert.deepEqual(workingProgress([]).filled, 0);
  }

  // --- every section says what it is for
  {
    for (const s of SECTIONS) {
      const m = SECTION[s];
      assert.ok(m.label && m.blurb && m.placeholder && m.changes, `${s} is missing its copy`);
      // A form that does not say why it wants something gets abandoned, and
      // this one is six fields long.
      assert.ok(m.changes.length > 20, `${s} does not say what changes when it is filled in`);
      // The placeholder has to be a real example, or the field gets one word.
      assert.ok(m.placeholder.length > 30, `${s}'s placeholder is not a real example`);

      // And it may only promise somewhere this file actually reaches.
      //
      // workingBrief feeds buildContextPack (the daily read), the per-source
      // judge, and the commission payload. It does NOT feed draftOpener, which
      // builds every opener from the offer's five strings. `voice` claimed
      // "changes every draft, which is most of what this app produces" and
      // `deliver` claimed "lets a draft say 'live in five days'" — invariant 7
      // in the app's own sheet, on the one feature whose entire argument is
      // that it never overstates what it knows. Delete this assertion when
      // draftOpener reads the file; until then it is what stops the copy
      // drifting back.
      assert.ok(!/\bdraft(s|ed|ing)?\b/i.test(m.changes),
        `${s} promises the draft path, which workingBrief does not reach: "${m.changes}"`);
    }
    assert.ok(BODY_MAX > 200 && MAX_PER_SECTION >= 4);
  }

  console.log('copilot-core: working-file checks passed');
}

workingFile().catch((e) => { console.error(e); process.exit(1); });
// --- work the app owns, as opposed to work it suggests
//
// The whole layer rests on two refusals, and both are tested here rather than
// trusted. A worker cannot mark its own homework — nextStatus reads the events,
// never the claim — and no amount of granted authority makes `commit` run by
// itself. Everything else in this file is bookkeeping; those two are the
// product.
import {
  AUTHORITY, AUTHORITIES, COMMISSION_STATUSES, MAX_BRIEF_LOG, MAX_STEPS, MAX_EVENTS_PER_POST, SUMMARY_MAX, WORKER_EVENT_KINDS,
  SAFE_HREF, blockedMove, blockedOn, briefLog, canAct, commissionBrief, commissionChip, commissionIdFromMove, commissionLine, commissionTerms,
  dueCommissions, isAuthority, normalizePlan, normalizeResult, nextStatus, reportOf, splitThreads, whoFor,
} from '../../src/lib/copilot/commission';
import type { Commission, CommissionEvent } from '../../src/lib/copilot/commission';

async function commissions() {
  const base: Commission = {
    id: 'c1', goal_id: 'g1', objective: 'Find 20 people who match the offer', why: 'The queue is empty',
    authority: 'read', budget_minutes: 60, status: 'active',
    plan: [
      { n: 1, do: 'Search for matches', state: 'done' },
      { n: 2, do: 'Check each one fits', state: 'doing' },
      { n: 3, do: 'Write the shortlist', state: 'todo' },
    ],
    created_at: '2026-09-10T08:00:00Z', approved_at: '2026-09-10T08:05:00Z',
    last_run_at: '2026-09-12T21:00:00Z', closed_at: null, outcome: null, seen_at: '2026-09-12T07:00:00Z',
  };
  const ev = (o: Partial<CommissionEvent>): CommissionEvent => ({
    id: 'e', commission_id: 'c1', kind: 'worked', step: null, summary: 's', artifact: null,
    at: '2026-09-12T21:00:00Z', ...o,
  });

  // --- authority
  {
    assert.equal(canAct('read', 'read'), true);
    // Granting more does not make the higher rings run: both gates must pass,
    // and reach/commit are not autonomous. Granting `reach` today buys nothing
    // extra BY DESIGN — the mandate records intent, the second gate decides.
    assert.equal(canAct('reach', 'reach'), false, 'reach needs a verified sending identity first');
    assert.equal(canAct('commit', 'commit'), false, 'money never moves by itself');
    assert.equal(canAct('commit', 'read'), true, 'a wider mandate still covers the ring that does run');
    // And a narrow mandate never reaches up.
    assert.equal(canAct('read', 'reach'), false);
    assert.equal(canAct('read', 'commit'), false);

    // Every non-autonomous level has to say WHY, or the UI has nothing honest
    // to render at the moment somebody picks it.
    for (const a of AUTHORITIES) {
      if (!AUTHORITY[a].autonomous) assert.ok(AUTHORITY[a].gate, `${a} must explain why it does not run by itself`);
    }
    assert.equal(AUTHORITY.commit.autonomous, false, 'this one is never true, in any future version');
    assert.equal(isAuthority('read'), true);
    assert.equal(isAuthority('root'), false, 'an unknown level is not a level');
  }

  // --- the brief that goes out
  {
    const profile = {
      name: 'Alex', headline: 'Automations', offer: { sells: 'booking bots' }, location: 'Cebu',
      timezone: 'Asia/Manila', target_segments: ['resorts'], target_area: 'Cebu',
      email: 'a@b.c', id: 'p1', finance: { cash: 1000 },
    } as unknown as Parameters<typeof commissionBrief>[1];
    const brief = commissionBrief(base, profile, null, 'https://app.test/api/copilot/commissions/c1/result');

    assert.equal(brief.commission_id, 'c1', 'an id to report against is the difference from the old socket');
    assert.equal(brief.objective, base.objective);
    assert.equal(brief.may_autonomously, true, 'stated, never left for the worker to infer');
    assert.ok(brief.result_url?.endsWith('/result'));

    // Same boundary as profileForRemote: this payload leaves the deployment.
    const who = JSON.stringify(whoFor(profile));
    assert.ok(!who.includes('a@b.c'), 'no email leaves');
    assert.ok(!who.includes('p1'), 'no id leaves');
    assert.ok(!who.includes('1000'), 'no billing or finance leaves');

    // A reach mandate has to tell the worker it may NOT act, or it sends
    // something under somebody's name.
    assert.equal(commissionBrief({ ...base, authority: 'reach' }, profile, null, null).may_autonomously, false);

    // The worker is told what day it is, in the person's own timezone: 23:30 UTC
    // on Sep 30 is already Oct 1 in Manila. Without it, "from Oct 5" came back
    // as a question about which year.
    const late = new Date('2026-09-30T23:30:00Z');
    assert.equal(commissionBrief(base, profile, null, null, { now: late }).today, '2026-10-01');
    assert.equal(commissionBrief(base, { ...profile, timezone: 'Not/AZone' }, null, null, { now: late }).today, '2026-09-30', 'an unknown zone falls back to UTC, never throws');
  }

  // --- what comes back, untrusted
  {
    const r = normalizeResult({
      events: [
        { kind: 'found', step: 2, summary: 'Three suppliers quote under $400', artifact: { kind: 'link', label: 'Quotes', value: 'x', href: 'https://q.test' } },
        { kind: 'worked', summary: 'Checked 12 of 20' },
        { kind: 'nonsense', summary: 'dropped' },
        { kind: 'done' },
        { kind: 'found', summary: 'no artifact is fine', artifact: { label: 'x' } },
      ],
      plan: [{ n: 1, do: 'Search', state: 'done' }, { garbage: true }],
      status: 'done',
    });
    assert.equal(r.events.length, 3, 'an unknown kind and a summary-less event are both dropped');
    // The dropped one was a bare { kind: 'done' }. For done and failed the
    // summary IS the report, so a worker cannot close a mandate by posting the
    // word "done" with nothing behind it.
    assert.ok(!r.events.some((e) => e.kind === 'done'), 'a done with no summary is not a done');
    assert.equal(r.events[0].artifact?.href, 'https://q.test');
    assert.equal(r.events[2].artifact, null, 'an artifact with no value is no artifact, not a broken one');
    assert.equal(r.plan?.length, 1, 'unparseable steps are dropped, not defaulted');
    assert.equal(r.claimed, 'done', 'the claim is parsed…');

    // …and never applied. This is the rule the whole return leg rests on: if a
    // worker could set its own status, reporting success would be the cheapest
    // way to look successful.
    assert.equal(r.claimed, 'done');
    assert.equal(nextStatus('active', r.events), 'active',
      'the worker claimed done and the log carries no done event, so the mandate has not moved');
    assert.equal(nextStatus('active', [{ kind: 'worked' }]), 'active', 'a claim with no done event moves nothing');
    // It closes only on an event that survived the floor.
    assert.equal(nextStatus('active', [{ kind: 'done' }]), 'done');

    // A needs_you outranks a done, whatever the worker called the run.
    assert.equal(nextStatus('active', [{ kind: 'done' }, { kind: 'needs_you' }]), 'blocked',
      'four steps finished and a fifth awaiting approval is blocked, not finished');
    // Terminal states are the user's to leave.
    assert.equal(nextStatus('stopped', [{ kind: 'worked' }]), 'stopped', 'a worker cannot reopen a mandate you called off');
    assert.equal(nextStatus('draft', [{ kind: 'done' }]), 'draft', 'and cannot start one you never approved');

    // And 'blocked' is the user's too. This is the transition the original had
    // no test for, and it fell through to 'active': a worker that raised a
    // needs_you could clear its own gate by posting anything the next night —
    // the user's question answered for them by the party that asked it.
    assert.equal(nextStatus('blocked', [{ kind: 'worked' }]), 'blocked', 'a worker cannot clear its own question');
    assert.equal(nextStatus('blocked', []), 'blocked', 'nor by posting nothing at all');
    assert.equal(nextStatus('blocked', [{ kind: 'done' }]), 'blocked',
      'nor by declaring victory — the question is what it is blocked ON');

    // Bounds.
    assert.equal(normalizeResult({ events: Array.from({ length: 50 }, () => ({ kind: 'worked', summary: 'x' })) }).events.length, MAX_EVENTS_PER_POST);
    assert.equal(normalizePlan(Array.from({ length: 30 }, (_, i) => ({ do: `s${i}` }))).length, MAX_STEPS);
    assert.equal(normalizeResult({ events: [{ kind: 'worked', summary: 'y'.repeat(999) }] }).events[0].summary.length, SUMMARY_MAX);
    assert.deepEqual(normalizeResult(null).events, []);
    assert.deepEqual(normalizeResult({ events: 'not an array' }).events, []);
  }

  // --- dispatch
  {
    const all: Commission[] = [
      { ...base, id: 'new', last_run_at: null },
      { ...base, id: 'old', last_run_at: '2026-09-01T00:00:00Z' },
      { ...base, id: 'recent', last_run_at: '2026-09-12T00:00:00Z' },
      // Blocked is waiting on the user. Handing it out again produces a second
      // identical needs_you against the same unanswered question.
      { ...base, id: 'blocked', status: 'blocked' },
      { ...base, id: 'draft', status: 'draft', approved_at: null },
    ];
    const due = dueCommissions(all);
    assert.deepEqual(due.map((c) => c.id), ['new', 'old', 'recent'], 'never run first, then oldest');
    assert.ok(!due.some((c) => c.id === 'draft'), 'an ungranted mandate does nothing at all');
    assert.ok(!due.some((c) => c.id === 'blocked'));
    // An active row with no approved_at is not a state the app can produce, and
    // if one appears it is not getting work.
    assert.deepEqual(dueCommissions([{ ...base, approved_at: null }]).map((c) => c.id), []);
    assert.equal(dueCommissions(all, 2).length, 2);
  }

  // --- the report
  {
    const events = [
      ev({ id: 'a', kind: 'worked', summary: 'Checked 12', at: '2026-09-12T21:00:00Z' }),
      ev({ id: 'b', kind: 'found', summary: 'Three fit', at: '2026-09-12T21:05:00Z' }),
      ev({ id: 'c', kind: 'needs_you', summary: 'Which of the three?', at: '2026-09-12T21:10:00Z' }),
      ev({ id: 'd', kind: 'planned', summary: 'Revised the plan', at: '2026-09-12T21:01:00Z' }),
    ];
    const r = reportOf(base, events);
    assert.deepEqual(r.did.map((e) => e.id), ['b', 'a'], 'newest first, and planned is housekeeping not work');
    assert.deepEqual(r.yours.map((e) => e.id), ['c']);
    assert.deepEqual(r.progress, { done: 1, total: 3 }, 'computed from the plan, never claimed');
    assert.equal(r.fresh, 4, 'all four land after seen_at');
    assert.equal(reportOf({ ...base, seen_at: '2026-09-13T00:00:00Z' }, events).fresh, 0);
    // Never looked is not the same as nothing new.
    assert.equal(reportOf({ ...base, seen_at: null }, events).fresh, 4);

    // The chip: the state as something readable at arm's length rather than a
    // caption in the same grey as everything else.
    assert.deepEqual(commissionChip({ ...base, status: 'draft' }), { label: 'Not started', tone: 'draft' });
    assert.deepEqual(commissionChip({ ...base, status: 'blocked' }), { label: 'Needs you', tone: 'needs' });
    assert.deepEqual(commissionChip(base), { label: 'Running', tone: 'running' });
    assert.deepEqual(commissionChip({ ...base, status: 'done' }), { label: 'Done', tone: 'done' });
    // Terms replace the two sentences of authority blurb the card used to carry
    // for a row that is doing nothing by definition.
    assert.equal(commissionTerms(base), 'Research and draft · up to 60 min');
    assert.ok(commissionTerms({ ...base, authority: 'commit', budget_minutes: 15 }).includes('15 min'));

    // The line: counts and state, never adjectives.
    //
    // The count of asks is true only while the mandate is actually stopped on
    // one. `yours` is every question ever raised, so counting it unconditionally
    // — which this asserted — left a running commission reading "1 needs you"
    // for the rest of its life, including the moment after the user answered it.
    assert.equal(commissionLine({ ...base, status: 'blocked' }, r), '1 of 3 done · 1 needs you');
    assert.equal(commissionLine(base, r), '1 of 3 done', 'answered and running: it stops asking');
    // Nothing has moved yet: a progress report about no progress is worse than
    // none, because it implies a run is under way.
    assert.equal(commissionLine({ ...base, plan: [] }, reportOf({ ...base, plan: [] }, [])), 'Nothing back yet');
    assert.equal(commissionLine({ ...base, status: 'draft' }, r), 'Waiting for you to approve it');
    assert.equal(commissionLine({ ...base, status: 'done', outcome: 'Found 20, 3 replied' }, r), 'Found 20, 3 replied');
    const quiet = reportOf(base, []);
    assert.equal(commissionLine(base, quiet), '1 of 3 done · Nothing back yet');
  }

  // --- a blocked mandate, as a Move
  {
    const r = reportOf(base, [ev({ id: 'c', kind: 'needs_you', summary: 'Which of the three should I brief?' })]);
    const m = blockedMove({ ...base, status: 'blocked' }, r, 'commission')!;
    assert.ok(m, 'a stalled mandate competes for the morning like everything else');
    assert.equal(m.job, 'commission');
    // Keyed on the EVENT: the same ask restated is one Move, a new ask tomorrow
    // is a second.
    assert.equal(m.external_id, 'commission:c1:c');
    assert.ok(m.why.some((w) => w.includes(base.objective)), 'it says which mandate it is stopping');
    assert.ok(m.artifact.value, 'no artifact, no Move — the same floor as every other job');
    // Nothing to ask means no Move, rather than an empty one.
    assert.equal(blockedMove(base, reportOf(base, []), 'commission'), null);

    // The return leg: answering that Move is how the mandate carries on, so the
    // commission has to be readable back off the key. Both halves are uuids, so
    // this splits on the prefix rather than on the last colon.
    assert.equal(commissionIdFromMove(m.external_id), 'c1');
    assert.equal(commissionIdFromMove('commission:abc-123:def-456'), 'abc-123');
    assert.equal(commissionIdFromMove('watch:src:item'), null, 'another job\'s Move is not a commission');
    assert.equal(commissionIdFromMove(null), null);
    assert.equal(commissionIdFromMove('commission:'), null);
  }

  // --- nothing untrusted reaches an href without a scheme
  {
    const link = (href: string) => normalizeResult({
      events: [{ kind: 'found', summary: 'x', artifact: { kind: 'link', label: 'Open', value: 'v', href } }],
    }).events[0]?.artifact;

    assert.equal(link('https://ok.test/x')?.href, 'https://ok.test/x');
    assert.equal(link('http://ok.test/x')?.href, 'http://ok.test/x');
    // Anything holding the inbound secret can post one of these, and the sheet
    // renders it into <a href> — React does not block javascript: URLs.
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', '/relative', 'mailto:a@b.c']) {
      // A link artifact whose href is refused is dropped whole rather than
      // rendered as a button that goes nowhere. The EVENT survives — the worker
      // still did something and the log should say so — but with no artifact.
      assert.equal(link(bad), null, `${bad} must not survive`);
    }
    assert.ok(SAFE_HREF.test('https://x.test') && !SAFE_HREF.test('javascript:1'));
  }

  // --- the answer has somewhere to go
  //
  // THE REASON THIS LAYER NEVER CLOSED A LOOP. A worker raised a needs_you, the
  // user tapped "I have answered", unblockCommission wrote a status and nothing
  // else, and the next brief carried objective/may/budget/plan — byte-identical
  // to the last one. So the worker asked the same question again, every night,
  // and no commission that needed anything from its owner could finish.
  {
    const profile = {
      id: 'p1', name: 'A', headline: 'h', email: 'a@b.c', offer: { sells: 'automations' },
      location: 'Cebu', timezone: 'Asia/Manila', target_segments: ['resorts'], target_area: 'Cebu',
      finance: { cash: 1000 },
    } as never;

    const asked = ev({ id: 'e1', kind: 'needs_you', summary: 'Which of the three should I brief?', at: '2026-09-13T09:00:00Z' });
    const said = ev({ id: 'e2', kind: 'answered', summary: 'The second one — they quoted in writing.', at: '2026-09-13T18:00:00Z' });
    const brief = commissionBrief(base, profile, null, null, { events: [said, asked] });

    assert.ok(brief.log.some((l) => l.kind === 'answered' && /second one/.test(l.summary)),
      'the answer must reach the worker, or the question is only ever asked again');
    // Oldest first: it is a transcript, and "which of the three? / the second
    // one" only reads in that order. Everything else in the file is newest-first.
    assert.deepEqual(brief.log.map((l) => l.kind), ['needs_you', 'answered']);
    assert.equal(commissionBrief(base, profile, null, null).log.length, 0, 'no history is an empty log, not a missing field');

    // Bounded: a mandate running for a month must not grow its payload with it.
    const many = Array.from({ length: 40 }, (_, i) =>
      ev({ id: `x${i}`, kind: 'worked', summary: `step ${i}`, at: `2026-09-${String(i % 28 + 1).padStart(2, '0')}T00:00:00Z` }));
    assert.equal(briefLog(many).length, MAX_BRIEF_LOG);
    assert.equal(briefLog(many).at(-1)?.at, briefLog(many).map((l) => l.at).sort().at(-1), 'the tail kept is the newest');
    // Summaries only. The worker produced the artifacts; posting them back is
    // payload for nothing.
    assert.ok(briefLog([said]).every((l) => !('artifact' in l)));

    // --- and the worker may not write it
    //
    // 'answered' exists as a kind but is not in WORKER_EVENT_KINDS, which is
    // what the result socket validates against. A worker that could post one
    // would be answering its own question on the user's behalf — invariant 10
    // with one extra step.
    assert.ok(!(WORKER_EVENT_KINDS as readonly string[]).includes('answered'));
    assert.equal(
      normalizeResult({ events: [{ kind: 'answered', summary: 'They said go ahead' }] }).events.length, 0,
      'a worker cannot answer its own question',
    );

    // It reads as the exchange it is: the ask, then what you said.
    const r = reportOf(base, [asked, said]);
    assert.deepEqual(r.said.map((e) => e.id), ['e2']);
    assert.deepEqual(r.yours.map((e) => e.id), ['e1']);
    assert.ok(!r.did.some((e) => e.kind === 'answered'), 'the user\'s reply is not the worker\'s work');
  }

  // --- what the worker is told about the person
  //
  // Five strings is a headline, and research written from a headline comes back
  // generic however good the worker is. This is the one field that changes it.
  {
    const profile = { name: 'A', headline: 'h', email: 'a@b.c', offer: {}, location: 'Cebu', timezone: 'Asia/Manila', target_segments: [], target_area: null } as never;
    const file = 'What you charge:\n- $900 for the build. Quoted $1,800 twice and lost both.';
    assert.equal(whoFor(profile, file).working, file);
    // Omitted rather than sent empty: an account with no file should not spend
    // payload saying so.
    assert.ok(!('working' in whoFor(profile)));
    assert.equal(commissionBrief(base, profile, null, null, { working: file }).who.working, file);
    // Still no way to identify or bill this person.
    const who = JSON.stringify(whoFor(profile, file));
    assert.ok(!who.includes('a@b.c') && !who.includes('p1'));
  }

  // --- a question and a breakage are opposite states
  //
  // Both arrive as status 'blocked', and for a while both rendered as a blue
  // "NEEDS YOU" chip over a text box. A morning with three handed-over jobs
  // showed three things the user had apparently failed to do, two of which were
  // a dead search tool. Nobody can answer a 500.
  {
    const asked = ev({ id: 'q1', kind: 'needs_you', summary: 'Which of the three?', at: '2026-09-14T09:00:00Z' });
    const broke = ev({ id: 'f1', kind: 'failed', summary: 'The web-search tool returned an internal request error.', at: '2026-09-14T21:00:00Z' });
    const blocked = { ...base, status: 'blocked' as const };

    const askOnly = reportOf(blocked, [asked]);
    const faultOnly = reportOf(blocked, [broke]);
    assert.deepEqual(askOnly.yours.map((e) => e.id), ['q1']);
    assert.deepEqual(askOnly.stopped, [], 'a question is not a breakage');
    assert.deepEqual(faultOnly.stopped.map((e) => e.id), ['f1']);
    assert.deepEqual(faultOnly.yours, [], 'a breakage is not a question');

    assert.equal(blockedOn(blocked, askOnly), 'you');
    assert.equal(blockedOn(blocked, faultOnly), 'worker');
    // Both on file: the newest decides, because a job can carry a question the
    // user already answered and a fresh failure on top of it.
    assert.equal(blockedOn(blocked, reportOf(blocked, [asked, broke])), 'worker');
    assert.equal(blockedOn(blocked, reportOf(blocked, [broke, { ...asked, at: '2026-09-15T00:00:00Z' }])), 'you');
    assert.equal(blockedOn(base, askOnly), null, 'only a blocked job is waiting on anything');
    // Blocked with nothing recorded falls to the user, who can always clear it.
    assert.equal(blockedOn(blocked, reportOf(blocked, [])), 'you');

    // The chip is what somebody reads at arm's length, so it is the thing that
    // must not say "needs you" about an outage.
    assert.deepEqual(commissionChip(blocked, faultOnly), { label: 'Needs a fix', tone: 'fault' });
    assert.deepEqual(commissionChip(blocked, askOnly), { label: 'Needs you', tone: 'needs' });
    assert.deepEqual(commissionChip(blocked), { label: 'Needs you', tone: 'needs' }, 'no report: the answerable reading');
    assert.match(commissionLine(blocked, faultOnly), /tried again/);
    assert.doesNotMatch(commissionLine(blocked, faultOnly), /done|needs you/, 'a shortfall the user did not cause is not reported as one');

    // And a breakage raises no Move: "your search tool is returning 500s" is not
    // finished work, and has no business competing for the day against the queue.
    assert.equal(blockedMove(blocked, faultOnly, 'commission'), null);
    assert.ok(blockedMove(blocked, askOnly, 'commission'), 'a real question still becomes a Move');
  }

  // --- which zone of Now a job belongs in
  //
  // Now was grouped by feature, so a job sat in whichever block its feature
  // owned regardless of whether it was waiting on an answer or quietly making
  // progress — opposite things to somebody holding a phone. The axis is
  // temporal now: what needs me, what happened, and what is over.
  {
    const t = (status: string) => ({ commission: { status } }) as never;
    const z = splitThreads([t('blocked'), t('active'), t('done'), t('draft'), t('stopped')]);
    // A draft needs you: nothing happens to it until it is approved, and an
    // unapproved mandate is indistinguishable from one the app forgot — which
    // is the whole reason the approve button exists.
    assert.deepEqual(z.needsYou.map((x) => x.commission.status), ['blocked', 'draft']);
    assert.deepEqual(z.running.map((x) => x.commission.status), ['active']);
    assert.deepEqual(z.finished.map((x) => x.commission.status), ['done', 'stopped']);
    // Every job lands in exactly one zone, or the screen either loses one or
    // renders it twice.
    const all = [...COMMISSION_STATUSES].map(t);
    const split = splitThreads(all);
    assert.equal(split.needsYou.length + split.running.length + split.finished.length, COMMISSION_STATUSES.length);
    assert.deepEqual(splitThreads([]), { needsYou: [], running: [], finished: [] });
  }

  console.log('copilot-core: commission checks passed');
}

commissions().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// The worth ledger, the handoff export, and the questions
//
// Three changes with one thing in common: each turns something the app already
// held into something it can be asked about. The ledger could only describe a
// message, so eight of the nine Jobs produced work that was never graded; the
// context could not leave, so the product's central claim was untestable; and the
// record could not be interrogated, so "which segment actually replies" had no
// answer on the tab whose whole subject is whether any of this is working.
// ---------------------------------------------------------------------------
import { readFileSync as readWorthFile } from 'node:fs';
import { OUTCOME_KINDS } from '../../src/lib/copilot/types';
import { WORTH, WORTH_KINDS, isWorthKind, worthByJob, worthSentence } from '../../src/lib/copilot/worth';
import { HANDOFF_MAX, renderHandoff } from '../../src/lib/copilot/handoff';
import { ASK_IDS, MIN_ASK_SAMPLE, answerAll } from '../../src/lib/copilot/ask';
import {
  DEAD_TOPIC_DECAY as DEAD2, MIN_WORTH_RUN, WORTHLESS_DECAY, scoreMove as score2, type ScoreCtx as Ctx2,
} from '../../src/lib/copilot/stake';

async function worthLedger() {
  /* ─── 1. The drift lock ─────────────────────────────────────────────────── */
  //
  // The single most valuable assertion in this file, because the exact failure it
  // prevents has already happened once and cost a fortnight of mornings: 20260909
  // pinned verify_metric to six values, stake.ts widened the union to eight, and
  // every write 23514'd into a console.error while the screen reported calm.
  //
  // Both directions. A kind the TS union permits and the CHECK does not is a
  // silent write failure; a kind the CHECK permits and the union does not is a row
  // nothing can read back, which is the same bug one release later.
  {
    const sql = readWorthFile(new URL('../../supabase/migrations/20260921_copilot_outcome_worth.sql', import.meta.url), 'utf8');
    // Only the constraint's own list, not the prose above it — the file's header
    // names several kinds in passing and matching against that would pass for the
    // wrong reason.
    const check = /check \(kind in \(([\s\S]*?)\)\)/.exec(sql);
    assert.ok(check, '20260921 must carry a kind CHECK this test can read');
    const permitted = [...check![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(permitted, [...OUTCOME_KINDS].sort(),
      'OutcomeKind and the 20260921 CHECK must be the same set — drift here is a silent 23514');

    // And the columns the ledger reads, or loadWorthLedger returns {} forever
    // while the ranker goes on guessing.
    assert.match(sql, /add column if not exists move_id/);
    assert.match(sql, /add column if not exists commission_id/);
    // Dropped by definition, never by guessed name. A renamed constraint leaves
    // TWO checks behind and the old narrow one keeps rejecting every write this
    // migration exists to permit — proved on Postgres 16 before it shipped.
    assert.match(sql, /pg_get_constraintdef/, 'the constraint must be dropped by definition, not by guessed name');
    assert.doesNotMatch(sql, /drop constraint if exists copilot_outcomes_kind_check;/,
      'a guessed drop is how a migration reports success and changes nothing');

    // The schema checker has to be able to report all of it, or an unapplied
    // migration and a quiet account look identical.
    const checker = readWorthFile(new URL('../../scripts/sql/copilot-schema-check.sql', import.meta.url), 'utf8');
    for (const k of ['delivered', 'saved', 'nothing']) {
      assert.ok(checker.includes(`('${k}')`), `the schema checker must name '${k}'`);
    }
    assert.ok(checker.includes("'move_id'") && checker.includes("'commission_id'"));
  }

  /* ─── 2. The vocabulary ─────────────────────────────────────────────────── */
  {
    for (const k of WORTH_KINDS) {
      assert.ok((OUTCOME_KINDS as readonly string[]).includes(k), `${k} must be a real OutcomeKind`);
      assert.ok(WORTH[k].label.trim() && WORTH[k].sub.trim(), `${k} needs words somebody would read`);
      // Never required, anywhere. Somebody who knows it made money but not how
      // much would otherwise type a figure, and a typed figure is the invented
      // number invariant 2 exists to keep out of this database.
      assert.notEqual(WORTH[k].amount as string, 'required');
    }
    // `nothing` is the point of the whole change, not a leftover. A close-out
    // question with no honest zero collects agreement.
    assert.ok(WORTH_KINDS.includes('nothing'), 'an honest zero is the answer the ranker most needs');
    assert.ok(isWorthKind('nothing') && !isWorthKind('reply') && !isWorthKind('') && !isWorthKind(null));
  }

  /* ─── 3. The rollup ─────────────────────────────────────────────────────── */
  {
    const rows = [
      { job: 'commission', kind: 'nothing' as const, amount: null },
      { job: 'commission', kind: 'nothing' as const, amount: null },
      { job: 'commission', kind: 'won' as const, amount: 9000 },
      { job: 'client_delivery', kind: 'saved' as const, amount: 1200 },
      // A reply against a Move is news, not a verdict. Counting it as a close
      // would let funnel events dilute the `nothing` ratio the decay reads.
      { job: 'client_delivery', kind: 'reply' as const, amount: null },
      // No job key: nothing to attribute it to, and the funnel already grades it.
      { job: null, kind: 'won' as const, amount: 50_000 },
    ];
    const by = worthByJob(rows);
    assert.deepEqual(by.commission, { closes: 3, money: 9000, nothing: 2 });
    assert.deepEqual(by.client_delivery, { closes: 1, money: 1200, nothing: 0 },
      'a reply is not a close');
    assert.equal(Object.keys(by).length, 2, 'an unattributed outcome is not a job');

    // Saved money counts for ranking and must never reach revenue. computeMetrics
    // sums only `won`, so the goal bar and the runway forecast cannot see a
    // saving as income — the split between the two is the whole reason `saved`
    // is a separate kind rather than a `won` with a note on it.
    assert.equal(by.commission.money + by.client_delivery.money, 9000 + 1200);
  }

  /* ─── 4. The sentence kept on the mandate ───────────────────────────────── */
  //
  // Written as well as the ledger row, because the two writes fail independently:
  // if the insert is rejected the commission is already closed and the user's
  // answer has to survive somewhere they can see it.
  {
    assert.equal(worthSentence('nothing'), 'Worth nothing.');
    assert.equal(worthSentence('won', 18_000, null, '₱'), 'Made ₱18,000.');
    assert.equal(worthSentence('won', null), 'Made money.', 'no figure is not no answer');
    assert.equal(worthSentence('saved', 0), 'Saved money or time.', 'zero is not a figure');
    assert.equal(worthSentence('delivered', null, 'A shortlist of four suppliers with prices.'),
      'Produced something usable. A shortlist of four suppliers with prices.');
    assert.doesNotMatch(worthSentence('nothing', null, 'x'.repeat(500)), /x{400}/, 'the note is bounded');
  }

  /* ─── 5. Evidence beats a claim ─────────────────────────────────────────── */
  //
  // stake.value is what a job SAYS this kind of work is worth. The worth ledger is
  // what the user said it actually turned out to be worth. When both exist the
  // second wins — including when it is lower, which is the case that matters:
  // a job whose claim has been tested and found high should stop leading on it.
  {
    const ctx = (worth?: Ctx2['worth']): Ctx2 => ({ monthlyBurn: 10_000, capacityMinutes: 90, worth });
    // A claim of half the monthly burn, deliberately UNDER the money ceiling.
    // 20k against a 10k burn is already at MAX_MONEY_FACTOR, so a test written
    // there compares two capped values and passes or fails for the wrong reason.
    const move = { id: 'm1', kind: 'earn' as const, job: 'client_delivery', costMinutes: 30,
      stake: { metric: 'won_amount' as const, direction: 'up' as const, by: 1, withinDays: 30, value: 5_000 } };

    const claimed = score2(move, ctx());
    const tested = score2(move, ctx({ client_delivery: { closes: 3, money: 3_000, nothing: 0 } }));
    assert.ok(tested < claimed, 'three closes averaging 1k must beat a 5k claim downward');

    const beaten = score2(move, ctx({ client_delivery: { closes: 2, money: 30_000, nothing: 0 } }));
    assert.ok(beaten > claimed, 'and upward, when the work really has been worth more');

    // The ceiling still holds over evidence. Every factor in this file has a
    // floor and a cap precisely so one input cannot run away with the day, and
    // a single enormous close is exactly the input that would try.
    const huge = score2(move, ctx({ client_delivery: { closes: 1, money: 4_000_000, nothing: 0 } }));
    assert.equal(huge, score2(move, ctx({ client_delivery: { closes: 1, money: 20_000, nothing: 0 } })),
      'observed money is capped at MAX_MONEY_FACTOR like any other');

    // No money observed at all falls back to the claim rather than to zero. An
    // all-nothing record is handled by the decay below, not by pretending the
    // job never said anything.
    assert.equal(score2(move, ctx({ client_delivery: { closes: 2, money: 0, nothing: 2 } })), claimed);
  }

  /* ─── 6. The all-nothing decay ──────────────────────────────────────────── */
  {
    const ctx = (worth?: Ctx2['worth'], dead?: Record<string, number>): Ctx2 =>
      ({ monthlyBurn: 10_000, capacityMinutes: 90, worth, dead });
    // No stake, so the score rides the kind prior alone and the factors are
    // readable rather than buried in a money term.
    const move = { id: 'm2', kind: 'earn' as const, job: 'commission', costMinutes: 30, stake: null };
    const plain = score2(move, ctx());

    const twice = score2(move, ctx({ commission: { closes: 2, money: 0, nothing: 2 } }));
    assert.equal(twice, plain, `two is a bad fortnight; the bar is ${MIN_WORTH_RUN}`);

    const thrice = score2(move, ctx({ commission: { closes: MIN_WORTH_RUN, money: 0, nothing: MIN_WORTH_RUN } }));
    assert.ok(Math.abs(thrice - plain * WORTHLESS_DECAY) < 1e-9, 'three, all nothing, and it decays');

    // One that produced something is a job that can. Deliberately not a ratio:
    // decaying on an average would bury work whose payoff is occasional and
    // large, which describes most of what this product is for.
    const mixed = score2(move, ctx({ commission: { closes: 4, money: 0, nothing: 3 } }));
    assert.equal(mixed, plain, 'one non-nothing close clears the bar');

    // The two verdicts compose rather than override. "The number did not move"
    // and "it moved and I still got nothing" are separate findings and a job
    // carrying both has earned 0.09.
    const both = score2(move, ctx({ commission: { closes: 3, money: 0, nothing: 3 } }, { commission: 3 }));
    assert.ok(Math.abs(both - plain * WORTHLESS_DECAY * DEAD2) < 1e-9);
    assert.ok(both < plain * 0.1, 'both verdicts together put it out of the running');

    // A job with no record is not penalised. Most accounts are this one, and an
    // empty ledger has to mean no opinion rather than a zero.
    assert.equal(score2({ ...move, job: 'send_queue' }, ctx({ commission: { closes: 9, money: 0, nothing: 9 } })), plain);
  }

  console.log('copilot-core: worth ledger checks passed');
}

worthLedger().catch((e) => { console.error(e); process.exit(1); });

async function handoffAndAsk() {
  /* ─── 7. The handoff export ─────────────────────────────────────────────── */
  //
  // A product whose whole claim is "your own rows beat a better model" should ship
  // the button that tests that claim against a better model. What the export has to
  // carry is therefore not decorative: the sections a general model cannot
  // reconstruct — what was already suggested, what was refused, what the working
  // file says — are the only reason the comparison is interesting.
  const pack = {
    today: '2026-09-19',
    profile: {
      name: 'Alex', headline: 'Builds shops that sell', location: 'Cebu', timezone: 'Asia/Manila',
      capacity: 'moderate', hunt_types: ['client'], target_segments: ['plumbers', 'pest control'],
      target_area: 'Cebu City',
      offer: { sells: 'A store that takes orders', for_who: 'trades with no website', price_band: '₱25k' },
    },
    goals: [{ title: 'Monthly revenue', metric: 'currency', unit: '₱', target_value: 120_000, current_value: 18_000, horizon_days: 30, priority: 1, note: null }],
    context: [{ source: 'note', kind: 'fact', content: 'Two of my last three came from referrals.', created_at: '2026-09-18T00:00:00Z' }],
    working: '',
    sources: [],
    history: { saved: [], dismissed: [], acted: [], doneActions: [], openActions: [{ title: 'Send the Ramos quote', owner: 'you', urgency: 'high' }] },
    changed: [],
    recentDecisions: [
      { for_date: '2026-09-18', headline: 'Send 10 of the 51 drafts', topic: 'send_queue', response: 'ignored', moved: null },
      { for_date: '2026-09-17', headline: 'Chase the Ramos delivery', topic: 'client_delivery', response: 'did', moved: 1 },
    ],
    typeAffinity: {},
    candidates: [{ id: 'c1', type: 'client', title: 'Cebu Drain Pros', summary: 'No website, 41 reviews', source: 'maps', url: null, contact: {}, fit_score: 70, scored: true }],
    replies: [{ business: 'Ramos Plumbing', text: 'Send the quote to my accountant.', occurred_at: '2026-09-18T00:00:00Z' }],
    sent: [],
    openings: [{ term: 'emergency callout', businesses: 12, trend: 'rising', segment: 'plumbers' }],
    metrics: { window_days: 30, sent: 44, replies: 1, reply_rate: 0.023, meetings: 0, won: 0, won_amount: 0, lost: 0, awaiting_approval: 61, pipeline: { new: 3, saved: 2, sourced: 9, inferred: 0 }, runway_months: 3.4 },
  } as unknown as ContextPack;

  const input = {
    pack,
    working: [
      { id: 'w1', section: 'price' as const, body: 'Nothing under ₱18k.', source: 'you' as const, evidence: null, status: 'live' as const, observed_key: null, created_at: '', updated_at: '', confirmed_at: null },
      { id: 'w2', section: 'works_for' as const, body: 'Plumbers close; pest control does not.', source: 'observed' as const, evidence: '4 of your last 6 wins', status: 'live' as const, observed_key: 'segment:plumbers', created_at: '', updated_at: '', confirmed_at: null },
      // A proposal is the app's own reading waiting on the person who lived it.
      // Exporting one as fact would launder a guess into the record.
      { id: 'w3', section: 'tried' as const, body: 'You have given up on cold email.', source: 'observed' as const, evidence: '0 of 44', status: 'proposed' as const, observed_key: 'x', created_at: '', updated_at: '', confirmed_at: null },
    ],
    standing: ['sending the drafts'],
    dead: [{ phrase: 'sending the drafts', count: 4 }],
    obligations: [{ id: 'o1', direction: 'in' as const, counterparty: 'Ramos Plumbing', amount: 18_000, currency: '₱', due_on: '2026-09-30', status: 'open' as const, note: null, settled_at: null, created_at: '' }],
    commissions: [{ objective: 'Find three suppliers who deliver same-day', status: 'active' as const, authority: 'read' as const, why: 'Delivery is what lost the last two' }],
    queueTotal: 61,
  };

  {
    const text = renderHandoff(input);
    // The sections that are the point.
    assert.match(text, /Send 10 of the 51 drafts · I ignored/, 'the record of what was suggested and refused must survive');
    assert.match(text, /I did it · the number moved \+1/);
    assert.match(text, /sending the drafts — I have said stop suggesting this/);
    assert.match(text, /sending the drafts — I did it 4 times/);
    // A job key is the database talking, and this document is written to be
    // pasted into a model. The raw key must not reach it.
    assert.doesNotMatch(text, /send_queue/);
    assert.match(text, /61 drafts written and not sent/);
    assert.match(text, /Find three suppliers who deliver same-day — active/);
    assert.match(text, /Owed to me: ₱18000 · Ramos Plumbing/);
    assert.match(text, /"Send the quote to my accountant\."/, "their words, not a summary of them");

    // The two sources stay distinguishable. A reader who cannot tell a counted
    // line from a stated one has been handed one undifferentiated opinion, which
    // is invariant 12 — there are two sources and never a third.
    assert.match(text, /Nothing under ₱18k\.$/m);
    // The section order comes from SECTIONS itself, not a hand-kept copy — which
    // is the drift class this codebase has been bitten by three times. The
    // fixture holds a `price` line and a `works_for` line, and SECTIONS puts
    // price first, so this fails if the order is ever re-typed out of step.
    assert.ok(text.indexOf('What you charge') < text.indexOf('Who it works for'));
    assert.doesNotMatch(text, /How you deliver/, 'an empty section is not a heading');
    assert.match(text, /Plumbers close; pest control does not\..*my app counted this: 4 of your last 6 wins/);
    assert.doesNotMatch(text, /given up on cold email/, 'a proposal is not yet part of the record');

    // No contact details leave. The destination is a third-party model, and the
    // export is context about the user's own business — not a list of other
    // people's phone numbers.
    assert.doesNotMatch(text, /\+63|@[a-z]+\.(com|ph)/i);
  }

  {
    // A section with nothing in it is left out entirely rather than rendered as
    // an empty heading. Eight blank headings is how this screen would read for
    // a new account, and it would look broken rather than new.
    const bare = renderHandoff({ ...input, standing: [], dead: [], obligations: [], commissions: [], working: [] });
    assert.doesNotMatch(bare, /## What I have decided not to do again/);
    assert.doesNotMatch(bare, /## Money owed/);
    assert.doesNotMatch(bare, /## What I know about my own work/);
    assert.match(bare, /## Where I actually am/, 'the numbers are always there');
  }

  {
    // Truncation says so. A paste that looks whole and is not is worse than a
    // short one, because the reader cannot tell which they have.
    const fat = { ...input, pack: { ...pack, context: Array.from({ length: 400 }, (_, n) => ({ source: 'note', kind: 'fact', content: `${n} ${'x'.repeat(400)}`, created_at: '2026-09-18T00:00:00Z' })) } as unknown as ContextPack };
    const text = renderHandoff(fat);
    // The per-section cap does most of the work, so force the overall cap too.
    const huge = renderHandoff({ ...fat, commissions: Array.from({ length: 4000 }, () => ({ objective: 'x'.repeat(200), status: 'active' as const, authority: 'read' as const, why: null })) });
    assert.ok(text.length <= HANDOFF_MAX);
    assert.ok(huge.length <= HANDOFF_MAX + 200);
    assert.match(huge, /\[Cut here/, 'a trimmed export must admit it');
  }

  /* ─── 8. The questions ──────────────────────────────────────────────────── */
  const askBase = {
    decisions: [],
    segments: [],
    drafts: { written: 0, opened: 0, sent: 0, replied: 0, cancelled: 0 },
    standing: [],
    dead: [],
    worth: {},
    phraseFor: (j: string) => j.replace(/_/g, ' '),
    currency: '₱',
    planCurrency: '₱',
    plan: 'free' as const,
    monthsActive: 1,
  };

  {
    // Every question answers, always, even on a brand-new account — and every
    // empty one says WHY it is empty. Three bugs in this codebase shared the
    // shape of a component failing, the failure being swallowed, and the screen
    // reporting calm. A blank answer card is that shape in the one feature whose
    // job is to tell the truth about the record.
    const fresh = answerAll(askBase);
    assert.equal(fresh.length, ASK_IDS.length);
    assert.deepEqual(new Set(fresh.map((a) => a.id)), new Set(ASK_IDS));
    for (const a of fresh) {
      assert.ok(a.q.trim().endsWith('?'), `${a.id} must be a question`);
      assert.ok(a.headline.trim(), `${a.id} must answer something`);
      assert.ok(a.rows.length || a.thin, `${a.id} renders nothing and explains nothing`);
    }
  }

  {
    // A reply rate off three sends is not a smaller fact, it is a different kind
    // of thing. Rendering it beside one off eighty is how a reader is misled by
    // arithmetic that is technically correct.
    const thin = answerAll({ ...askBase, segments: [{ segment: 'plumbers', sent: MIN_ASK_SAMPLE - 1, replied: 1 }] });
    const replies = thin.find((a) => a.id === 'replies')!;
    assert.deepEqual(replies.rows, []);
    assert.match(replies.thin!, new RegExp(String(MIN_ASK_SAMPLE)));

    const real = answerAll({ ...askBase, segments: [
      { segment: 'plumbers', sent: 20, replied: 4 },
      { segment: 'pest control', sent: 30, replied: 1 },
      { segment: 'roofers', sent: 2, replied: 2 },
    ] });
    const a = real.find((x) => x.id === 'replies')!;
    assert.match(a.headline, /plumbers replies 20%/);
    assert.match(a.headline, /pest control replies 3%/);
    assert.deepEqual(a.rows.map((r) => r.label), ['plumbers', 'pest control'], 'best first, and the thin one is out');
    // A 100% rate off two sends must not lead the answer. That is the whole point
    // of the floor and it is the failure mode a reader would act on.
    assert.doesNotMatch(a.headline, /roofers/);
    assert.match(a.thin!, /roofers/, 'and it is named as left out rather than dropped silently');
  }

  {
    // "Has any of this been worth anything" — the question the ledger was widened
    // to make answerable at all.
    const none = answerAll(askBase).find((a) => a.id === 'worth')!;
    assert.match(none.thin!, /including "nothing"/);

    const free = answerAll({ ...askBase, worth: { commission: { closes: 2, money: 40_000, nothing: 0 } } }).find((a) => a.id === 'worth')!;
    assert.match(free.headline, /₱40,000/);
    // A free plan costs nothing, so "did it pay for itself" is not a question it
    // can fail, and claiming it passed one would be the same invention.
    assert.doesNotMatch(free.headline, /paid for itself/);

    const paid = answerAll({ ...askBase, plan: 'pro', monthsActive: 3, worth: { commission: { closes: 2, money: 40_000, nothing: 0 } } }).find((a) => a.id === 'worth')!;
    assert.match(paid.headline, /has paid for itself/);
    const short = answerAll({ ...askBase, plan: 'pro', monthsActive: 3, worth: { commission: { closes: 2, money: 5, nothing: 1 } } }).find((a) => a.id === 'worth')!;
    assert.match(short.headline, /has not paid for itself/);

    // Across currencies there is no subtraction to do. The plan is priced in a
    // deployment-wide currency that is usually not the user's, and computing
    // "₱100 against ₱87" out of a $29 plan would be the invented number
    // invariant 2 exists to keep off the screen — it would tell somebody their
    // app had paid for itself on the strength of an exchange rate nobody applied.
    const crossed = answerAll({ ...askBase, currency: '₱', planCurrency: '$', plan: 'pro', monthsActive: 3, worth: { commission: { closes: 2, money: 100, nothing: 1 } } }).find((a) => a.id === 'worth')!;
    assert.match(crossed.headline, /₱100 attributed/);
    assert.match(crossed.headline, /\$87/);
    assert.match(crossed.headline, /yours to make/);
    assert.doesNotMatch(crossed.headline, /paid for itself/, 'no verdict is drawn across currencies');

    // All nothing, and it says so plainly rather than rendering a row of dashes.
    const dud = answerAll({ ...askBase, worth: { commission: { closes: 3, money: 0, nothing: 3 } } }).find((a) => a.id === 'worth')!;
    assert.match(dud.rows[0].value, /Nothing/);
    assert.match(dud.thin!, /weighing on what gets suggested/, 'the decay is real and is said out loud');
  }

  {
    // The two kinds of bar read differently because they mean different things:
    // one is a decision the user made, the other is a verdict the ledger reached.
    const barred = answerAll({ ...askBase, standing: ['sending the drafts'], dead: [{ topic: 'send_queue', count: 4 }] }).find((a) => a.id === 'stood_down')!;
    assert.equal(barred.rows.length, 2);
    assert.match(barred.rows[0].note!, /never expires/);
    assert.match(barred.rows[1].note!, /did it 4 times/);
    // A bar nobody can find is indistinguishable from the app quietly breaking.
    assert.match(barred.thin!, /refuse section of your working file/);
  }

  {
    const dead = { verify: { metric: 'queue' as const, baseline: 10, after: 12 } };
    const won = { verify: { metric: 'queue' as const, baseline: 10, after: 4 } };
    const worked = answerAll({ ...askBase, decisions: [
      { ...won, topic: 'send_queue', response: 'did', headline: 'Send 10', for_date: '2026-09-18' },
      { ...dead, topic: 'send_queue', response: 'did', headline: 'Send 10 again', for_date: '2026-09-17' },
      { ...dead, topic: 'watch', response: 'ignored', headline: 'Read the feed', for_date: '2026-09-16' },
    ] as never }).find((a) => a.id === 'worked')!;
    assert.match(worked.headline, /1 of 2 calls you carried out moved the number/);
    assert.deepEqual(worked.rows.map((r) => `${r.label}:${r.value}`), ['Moved the number:1', 'Did it, nothing moved:1', 'Never done:1']);

    // Ignored every one of them: that is a finding about the calls, and the copy
    // says so rather than reading as a telling-off.
    const ignored = answerAll({ ...askBase, decisions: [
      { ...dead, topic: 'send_queue', response: 'ignored', headline: 'Send 10', for_date: '2026-09-18' },
    ] as never }).find((a) => a.id === 'worked')!;
    assert.match(ignored.thin!, /an answer about the calls, not about you/);
  }

  {
    const drafts = answerAll({ ...askBase, drafts: { written: 61, opened: 20, sent: 44, replied: 1, cancelled: 10 } }).find((a) => a.id === 'drafts')!;
    assert.match(drafts.headline, /2% of what you send gets a reply/);
    assert.deepEqual(drafts.rows.map((r) => r.label), ['Written', 'Opened', 'Sent', 'Replied', 'Cancelled']);
    assert.match(drafts.rows[4].note!, /most informative number/);
    // Nothing sent at all is the loudest version of this and gets its own line
    // rather than a division by zero.
    const stuck = answerAll({ ...askBase, drafts: { written: 61, opened: 0, sent: 0, replied: 0, cancelled: 0 } }).find((a) => a.id === 'drafts')!;
    assert.equal(stuck.headline, 'Nothing you have written has been sent.');
  }

  console.log('copilot-core: handoff and ask checks passed');
}

handoffAndAsk().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// The app proposing its own work
//
// Every other surface on Now is something the app found and the user does. A
// mandate was the one thing the USER had to think of and the app would do — so
// the gradient was inverted, and the part requiring least to carry out required
// most to conceive. A proposal fixes that by being a Move, which is also what
// stops it adding a card: it competes through arbitrate() like everything else.
// ---------------------------------------------------------------------------
import { isDeliverable } from '../../src/lib/copilot/moves';
import { MAX_ACTIVE_COMMISSIONS as CAP } from '../../src/lib/copilot/commission';
import {
  MAX_OPEN_PROPOSALS, PROPOSAL_BUDGET_MINUTES, PROPOSAL_STEPS_MAX, PROPOSE_JOB, PROPOSE_SYSTEM,
  QUIET_AFTER_BINNED, QUIET_AFTER_WORTHLESS, parseProposal, proposalFrom, proposePrompt, shouldPropose, stakeMetricFor, whyFor,
} from '../../src/lib/copilot/propose';
import { arbitrate as arbitrate2, scoreMove as score3 } from '../../src/lib/copilot/stake';

async function proposals() {
  const goal = { title: 'Monthly revenue', metric: 'currency' as const, unit: '₱', target_value: 120_000, current_value: 18_000, horizon_days: 30, created_at: '2026-09-10T02:00:00Z' };
  const metrics = { window_days: 30, sent: 44, replies: 1, reply_rate: 0.023, meetings: 0, won: 0, won_amount: 0, lost: 0, awaiting_approval: 61, pipeline: { new: 3, saved: 2, sourced: 9, inferred: 0 }, runway_months: 3.4 } as never;

  /* ─── 1. Whether to propose at all ──────────────────────────────────────── */
  {
    const base = { held: 0, openProposals: 0, hasGoal: true };
    assert.deepEqual(shouldPropose(base), { ok: true });

    // A proposal with no goal behind it is the app inventing a direction for
    // somebody's business — invariant 12, which is the one thing this whole
    // feature could most easily have broken.
    const noGoal = shouldPropose({ ...base, hasGoal: false });
    assert.equal(noGoal.ok, false);
    assert.match((noGoal as { reason: string }).reason, /goal/);

    const full = shouldPropose({ ...base, held: CAP });
    assert.equal(full.ok, false, 'three on the go is a person with three priorities');
    const waiting = shouldPropose({ ...base, openProposals: MAX_OPEN_PROPOSALS });
    assert.equal(waiting.ok, false, 'proposing a second while the first is unanswered is how a suggestion becomes a backlog');

    // Binned twice running and it stops. A feed item is news from outside and a
    // dismissal says nothing about tomorrow's; a proposal is the app's OWN idea,
    // so two bins in a row is an answer about the proposer rather than about two
    // pieces of work.
    const binned = shouldPropose({ ...base, binnedInARow: QUIET_AFTER_BINNED });
    assert.equal(binned.ok, false);
    assert.match((binned as { reason: string }).reason, /binned the last 2/);
    assert.deepEqual(shouldPropose({ ...base, binnedInARow: QUIET_AFTER_BINNED - 1 }), { ok: true }, 'one is not a pattern');

    // The gate the worth ledger earned. It stops the card being MADE, which is
    // stronger than ranking it down, and it is the same reasoning as the
    // three-place bar on a standing refusal.
    const dud = shouldPropose({ ...base, worth: { closes: QUIET_AFTER_WORTHLESS, money: 0, nothing: QUIET_AFTER_WORTHLESS } });
    assert.equal(dud.ok, false);
    assert.match((dud as { reason: string }).reason, /none of it was worth anything/);
    // One that paid clears it: a job that produced something once is a job that
    // can, and an average would bury work whose payoff is occasional and large.
    assert.deepEqual(shouldPropose({ ...base, worth: { closes: 4, money: 9000, nothing: 3 } }), { ok: true });
    assert.deepEqual(shouldPropose({ ...base, worth: { closes: 2, money: 0, nothing: 2 } }), { ok: true }, 'two is a bad fortnight');
  }

  /* ─── 2. What the model is allowed to come back with ────────────────────── */
  {
    const ok = parseProposal({ objective: 'Find three suppliers who deliver same-day', kind: 'build', steps: ['Search Cebu suppliers', 'Compare lead times'] });
    assert.deepEqual(ok, { objective: 'Find three suppliers who deliver same-day', kind: 'build', steps: ['Search Cebu suppliers', 'Compare lead times'] });

    // Declining is first-class and the prompt asks for it by name. A proposer
    // that must always propose will propose on a quiet week, and a mandate
    // invented to fill a slot costs worker minutes and the trust in every one
    // that follows.
    assert.equal(parseProposal({ objective: null }), null);
    assert.equal(parseProposal({ objective: '   ' }), null);
    assert.equal(parseProposal(null), null);
    assert.equal(parseProposal('nope'), null);

    // A mandate with no plan is a wish. The user is approving on the strength of
    // what it says it will do, so it has to say.
    assert.equal(parseProposal({ objective: 'Do something', steps: ['Only one'] }), null);
    assert.equal(parseProposal({ objective: 'Do something' }), null);

    // An unrecognised kind lands mid-prior rather than burying or floating it.
    assert.equal(parseProposal({ objective: 'x', kind: 'invented', steps: ['a', 'b'] })!.kind, 'decide');
    assert.equal(parseProposal({ objective: 'x', steps: ['a', 'b'] })!.kind, 'decide');

    const long = parseProposal({ objective: 'x', steps: Array.from({ length: 20 }, (_, i) => `step ${i}`) })!;
    assert.equal(long.steps.length, PROPOSAL_STEPS_MAX, 'past five nobody reads it, and an unread plan approved anyway is the ceremony the approve button exists to avoid');

    // The model is told not to state numbers, because the app writes those. The
    // instruction has to actually be in the prompt or the rule is a comment.
    assert.match(PROPOSE_SYSTEM, /Never state a number/);
    assert.match(PROPOSE_SYSTEM, /Never propose sending, messaging, posting, buying, booking or hiring/);
  }

  /* ─── 3. The reasons are arithmetic, never a model's prose ──────────────── */
  {
    const why = whyFor({ goal, metrics, today: '2026-09-10' });
    assert.match(why[0], /₱102,000 short, 30 days left/, 'the gap is computed, not described');
    // Counted down to the goal's date, not the horizon it was written with.
    assert.match(whyFor({ goal, metrics, today: '2026-09-25' })[0], /short, 15 days left/);
    assert.match(whyFor({ goal, metrics })[0], /₱102,000 short\.$/, 'without today no days are claimed');
    assert.match(why[1], /44 sent in 30 days for 1 reply\. This is not that\./);
    assert.match(why[2], /3\.4 months of runway/);

    // Nothing sent reads differently from nothing back, because they are
    // different situations and only one of them is an argument.
    const quiet = whyFor({ goal, metrics: { ...metrics as object, sent: 0 } as never });
    assert.ok(!quiet.some((w) => /sent/.test(w)));

    const noReply = whyFor({ goal, metrics: { ...metrics as object, replies: 0 } as never });
    assert.match(noReply[1], /nothing has come back/);

    // Long runway drops the urgency line rather than inventing pressure.
    const safe = whyFor({ goal, metrics: { ...metrics as object, runway_months: 22 } as never });
    assert.ok(!safe.some((w) => /runway/.test(w)));

    // The ledger speaks for itself once there is one.
    const graded = whyFor({ goal, metrics, worth: { closes: 3, money: 0, nothing: 3 } });
    assert.match(graded[graded.length - 1], /closed 3 of these and said none of them were worth something/);

    // A goal with no target still produces a reason rather than an empty case.
    const bare = whyFor({ goal: { ...goal, target_value: null, current_value: null }, metrics });
    assert.match(bare[0], /meant to move Monthly revenue/);
  }

  /* ─── 4. A proposal is a Move, and a valid one ──────────────────────────── */
  {
    const draft = parseProposal({ objective: 'Find three suppliers who deliver same-day', kind: 'build', steps: ['Search Cebu suppliers', 'Compare lead times and minimums'] })!;
    const move = proposalFrom(draft, { goal, metrics }, PROPOSAL_BUDGET_MINUTES)!;

    assert.ok(isDeliverable(move), 'it has to survive the same validation as every other Move');
    assert.equal(move.job, PROPOSE_JOB);
    assert.equal(move.artifact.kind, 'plan');
    assert.deepEqual(move.artifact.steps, ['Search Cebu suppliers', 'Compare lead times and minimums']);
    // The readable rendering carries the budget, because the budget is part of
    // what is being authorised and discovering it afterwards inside the mandate
    // is finding out what you agreed to.
    assert.match(move.artifact.value, /1\. Search Cebu suppliers/);
    assert.match(move.artifact.value, new RegExp(`Up to ${PROPOSAL_BUDGET_MINUTES} minutes`));
    assert.match(move.artifact.value, /contacts nobody and spends nothing/);

    // Its own key, and deliberately NOT `commission`. runJobs bars a stood-down
    // job from producing at all, so sharing the key would mean "stop proposing
    // work to me" also silenced the questions from mandates already approved.
    assert.notEqual(move.job, 'commission');

    // No invented value on the stake. A mandate's worth is genuinely unknown
    // when it is proposed, and the house rule is that a job which cannot say is
    // better off silent than making a figure up.
    assert.equal(move.stake!.value, undefined);
    assert.equal(move.stake!.metric, 'won_amount');
    assert.equal(stakeMetricFor('number'), 'none', 'only money maps to a metric that can be read back');
    assert.equal(stakeMetricFor('none'), 'none');

    // A plan Move with no steps has a button that would create an empty
    // mandate. Invariant 7, in the small.
    assert.equal(isDeliverable({ ...move, artifact: { ...move.artifact, steps: [] } }), false);
    assert.equal(isDeliverable({ ...move, artifact: { ...move.artifact, steps: ['  '] } }), false);
  }

  /* ─── 5. It competes. That is the whole reason it is not a fourth card ──── */
  {
    const draft = parseProposal({ objective: 'Find three suppliers who deliver same-day', kind: 'build', steps: ['a', 'b'] })!;
    const proposal = proposalFrom(draft, { goal, metrics }, PROPOSAL_BUDGET_MINUTES)!;
    const scorable = { id: 'prop', kind: proposal.kind, job: proposal.job, stake: proposal.stake, costMinutes: 1 };
    const queue = { id: 'q', kind: 'earn' as const, job: 'send_queue', stake: { metric: 'queue' as const, direction: 'down' as const, by: 10, withinDays: 7 }, costMinutes: 45 };
    const ctx = { monthlyBurn: 42_000, capacityMinutes: 90 };

    // It does NOT automatically win, and it must not: a proposal that outranks
    // real work by construction is the permanent button again, wearing a card.
    // A send queue seven days from going stale is urgent real work, and it
    // leads on any day — measured, 3.00 against 0.90, not assumed.
    assert.equal(arbitrate2([scorable, queue], ctx).call?.id, 'q', 'urgent real work still leads');

    // On a day with no time in it the proposal DOUBLES its standing, because it
    // genuinely costs a tap while the queue costs 45 minutes. The fit factor
    // doing what it is for, rather than a thumb on the scale: it closes the gap,
    // it does not hand over the day.
    const busy = { ...ctx, capacityMinutes: 20 };
    const ratio = (c: typeof ctx) => score3(scorable, c) / score3(queue, c);
    assert.equal(score3(scorable, busy), score3(scorable, ctx), 'a proposal fits any day');
    assert.ok(score3(queue, busy) < score3(queue, ctx), 'a 45-minute task does not');
    assert.ok(ratio(busy) > ratio(ctx) * 1.9, 'and the proposal closes the gap on a day with no time in it');

    // Where it does lead: against work that is neither urgent nor cheap. A
    // two-hour `learn` with no stake is exactly the thing somebody has been not
    // doing for a fortnight, and offering to take it off them beats suggesting
    // it again.
    const learn = { id: 'l', kind: 'learn' as const, job: 'capability_gap', stake: null, costMinutes: 120 };
    assert.equal(arbitrate2([scorable, learn], ctx).call?.id, 'prop');

    // And the case the whole product arc has been about: once the queue is
    // stood down — the user having said outreach is no longer their leverage —
    // the proposal is what is left to lead, instead of the starter ladder
    // proposing the queue again under another name.
    assert.equal(arbitrate2([scorable, queue], { ...ctx, standing: new Set(['send_queue']) }).call?.id, 'prop');

    // And every damper already built reaches it, because it is a Move.
    const refused = arbitrate2([scorable, queue], { ...ctx, refused: { [PROPOSE_JOB]: 3 } });
    assert.notEqual(refused.call?.id, 'prop', 'refused three times and it cannot lead');
    assert.ok(refused.stoodDown.includes(PROPOSE_JOB));
    const stopped = arbitrate2([scorable, queue], { ...ctx, standing: new Set([PROPOSE_JOB]) });
    assert.notEqual(stopped.call?.id, 'prop', 'stood down for good');
    // Barred from leading, not from existing: the work is still real.
    assert.ok(stopped.rest.some((m) => m.id === 'prop'));
  }

  /* ─── 6. The prompt carries what a general model cannot know ────────────── */
  {
    const p = proposePrompt({
      goalTitle: 'Monthly revenue',
      offer: 'A store that takes orders',
      working: 'Nothing under ₱18k.',
      metricsLine: '44 sent, 1 reply (2%)',
      recentObjectives: ['Find three suppliers who deliver same-day'],
      refusedPhrases: ['sending the drafts'],
    });
    // These two lists are the entire argument for doing this inside the app
    // rather than in a chat window. Without them it is a worse chat window.
    assert.match(p, /do not propose these again:[\s\S]*Find three suppliers/);
    assert.match(p, /stop suggesting:[\s\S]*sending the drafts/);
    assert.match(p, /Nothing under ₱18k/);
    assert.match(p, /Propose one piece of work, or decline\./);

    // An empty working file leaves the section out rather than heading nothing.
    const bare = proposePrompt({ goalTitle: 'g', offer: '', working: '   ', metricsLine: 'm', recentObjectives: [], refusedPhrases: [] });
    assert.doesNotMatch(bare, /told the app about their own work/);
    assert.match(bare, /have not written down what they sell/);
  }

  console.log('copilot-core: proposal checks passed');
}

proposals().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// The four-tab shell at /copilot2: deep work
//
// The You tab was asked for "money, runway, deep work hours", and the third had
// no sensor. Invariant 2 decides what happens then: the number is logged by the
// person who did it, or it is not shown. These checks are the ways a focus log
// could quietly become a flattering one.
// ---------------------------------------------------------------------------
import {
  FOCUS_BACK_DAYS, FOCUS_MAX_MINUTES, FOCUS_MIN_MINUTES, dayLetter, focusFromEvents, focusWeek, hoursLabel,
  isIsoDay, normalizeFocus, shiftDay, type FocusLog as FocusLogV2,
} from '../../src/lib/copilot/focus';

async function focusLog() {
  const today = '2026-09-24';

  // 1. What may be written. A block logged for tomorrow is a plan, and a plan
  //    counted as focus is exactly the number this exists not to produce.
  assert.deepEqual(normalizeFocus({ minutes: 90 }, today), { ok: true, value: { minutes: 90, on: today, note: null } }, 'no day means today');
  assert.deepEqual(normalizeFocus({ minutes: '120', on: '2026-09-22', note: '  booking demo  ' }, today), { ok: true, value: { minutes: 120, on: '2026-09-22', note: 'booking demo' } });
  assert.equal(normalizeFocus({ minutes: FOCUS_MIN_MINUTES - 1 }, today).ok, false, 'a break between two things is not a block');
  assert.equal(normalizeFocus({ minutes: FOCUS_MAX_MINUTES + 1 }, today).ok, false);
  assert.equal(normalizeFocus({ minutes: 'lots' }, today).ok, false);
  assert.equal(normalizeFocus({ minutes: 60, on: '2026-09-25' }, today).ok, false, 'the future is refused, not clamped');
  assert.equal(normalizeFocus({ minutes: 60, on: shiftDay(today, -FOCUS_BACK_DAYS) }, today).ok, true, 'the oldest day on the tile can still be filled in');
  assert.equal(normalizeFocus({ minutes: 60, on: shiftDay(today, -FOCUS_BACK_DAYS - 1) }, today).ok, false, 'older than the week is a guess');
  assert.equal(normalizeFocus({ minutes: 60, on: '2026-02-30' }, today).ok, false, 'not a day');
  assert.equal(isIsoDay('2026-02-28'), true);
  assert.equal(isIsoDay('2026-2-28'), false);

  // 2. Day arithmetic stays on days. A DST boundary or a month end must not move a log.
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(dayLetter('2026-09-24'), 'T', 'a Thursday');

  // 3. Rows are trusted no further than their shape. A payload that does not
  //    parse is dropped, never counted as zero — zero would be a number.
  const logs = focusFromEvents([
    { id: 7, payload: { minutes: 120, on: '2026-09-24', note: 'demo' }, created_at: '2026-09-24T09:00:00Z' },
    { id: 8, payload: { minutes: 30, on: '2026-09-24' }, created_at: '2026-09-24T15:00:00Z' },
    { id: 9, payload: { minutes: 90, on: '2026-09-20' }, created_at: '2026-09-20T15:00:00Z' },
    { id: 10, payload: { minutes: 60, on: '2026-09-10' }, created_at: '2026-09-10T15:00:00Z' },
    { id: 11, payload: { on: '2026-09-23' }, created_at: '2026-09-23T15:00:00Z' },
    { id: 12, payload: 'garbage', created_at: '2026-09-23T15:00:00Z' },
    { id: 13, payload: { minutes: 45, on: 'yesterday' }, created_at: '2026-09-23T15:00:00Z' },
  ]);
  assert.deepEqual(logs.map((l) => l.id), ['7', '8', '9', '10'], 'ids cross the wire as strings; unparseable rows are gone');

  // 4. The week. Two blocks on one day add up; a log outside the seven days is
  //    not in this week's number however recent its row is.
  const week = focusWeek(logs, today);
  assert.equal(week.days.length, FOCUS_BACK_DAYS + 1);
  assert.equal(week.days[0].on, '2026-09-18', 'oldest first');
  assert.equal(week.days[6].on, today);
  assert.equal(week.today, 150);
  assert.equal(week.total, 240);
  assert.equal(week.loggedDays, 2, 'a day with nothing logged is not a logged day');
  assert.equal(focusWeek([], today).total, 0);

  // 5. Hours to one decimal. Nobody logs focus to the minute.
  assert.equal(hoursLabel(0), '0h');
  assert.equal(hoursLabel(45), '45m');
  assert.equal(hoursLabel(60), '1h');
  assert.equal(hoursLabel(90), '1.5h');
  assert.equal(hoursLabel(240), '4h');

  const typed: FocusLogV2 = logs[0];
  assert.equal(typed.note, 'demo');
  console.log('copilot-core: deep work checks passed');
}

focusLog().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// The four-tab shell: the week, read back
//
// What created value, what was wasted, what has to change. The Working? tab
// had every one of these facts and read as a log; the questions were what was
// missing. The checks here are the ways a review goes wrong: summing across
// currencies, calling a fresh queue waste, a blank block, a binned suggestion
// counted as the user's failure when it was the app's.
// ---------------------------------------------------------------------------
import { COLD_DRAFT_DAYS, MAX_DID_LINES, MAX_ITEMS, MIN_BINNED, STALE_DRAFT_DAYS, localDay, weekReview, whenLabel, type ReviewInput, type RecentOutcome as RecentOutcomeV2 } from '../../src/lib/copilot/review';

async function weekInReview() {
  const now = new Date('2026-09-24T10:00:00Z');
  const outcome = (o: Partial<RecentOutcomeV2>): RecentOutcomeV2 => ({
    id: 'o', kind: 'reply', amount: null, currency: null, note: null, source: 'manual',
    occurred_at: '2026-09-23T10:00:00Z', opportunity_id: 'b1', commission_id: null, who: 'Tubero Plumbing', ...o,
  });
  const base: ReviewInput = {
    now, today: '2026-09-24', timezone: 'Asia/Manila',
    outcomes: [], answered: [], focus: [], commissions: [],
    queue: { count: 0, oldestDays: 0 }, sources: { total: 0, failing: 0 },
    decisions: [], edge: null, bottleneck: null, runwayMonths: null, currency: '$',
  };
  const call = (for_date: string, o: Partial<ReviewInput['decisions'][number]> = {}): ReviewInput['decisions'][number] => ({
    for_date, headline: 'Send 10 drafts', topic: 'send_queue', response: 'ignored',
    verify: { metric: 'queue', baseline: 0, after: null, verifiedAt: null }, source_move_id: null, ...o,
  });
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

  // 1. An empty week is said, never blank — invariant 13 in the one tab whose
  //    job is telling the truth about the record.
  const empty = weekReview(base);
  assert.deepEqual(empty.value, []);
  assert.deepEqual(empty.waste, []);
  assert.equal(empty.change, null);
  assert.match(empty.valueEmpty, /Nothing logged as value/);

  // 2. Money is never summed across currencies. "₱100 + $2" is two numbers.
  const mixed = weekReview({ ...base, outcomes: [
    outcome({ id: 'w1', kind: 'won', amount: 2, currency: '$', who: 'Tubero Plumbing' }),
    outcome({ id: 'w2', kind: 'won', amount: 1500, currency: '₱', who: 'X Out Pest' }),
    outcome({ id: 'r1', kind: 'reply', who: 'Great Eastern' }),
    outcome({ id: 'r2', kind: 'reply', who: 'Great Eastern' }),
    // Last month's win is not this week's value.
    outcome({ id: 'w3', kind: 'won', amount: 900, currency: '$', occurred_at: '2026-09-01T10:00:00Z' }),
  ] });
  const win = mixed.value[0];
  assert.match(win.text, /\$2/);
  assert.match(win.text, /₱1,500/);
  assert.doesNotMatch(win.text, /1,502|902/, 'no invented total');
  assert.match(win.text, /across 2 deals/);
  assert.equal(win.when, 'yesterday');
  // Line by line: several wins name their clients when the line opens, one row
  // each, each in its own currency. The line itself stays one glance.
  assert.deepEqual(win.items.map((i) => i.text).sort(), ['Tubero Plumbing paid $2', 'X Out Pest paid ₱1,500']);
  assert.equal(win.target, 'won');
  assert.equal(mixed.value[1].text, '2 replies — Great Eastern', 'one business replying twice is named once');
  assert.equal(mixed.value[1].items.length, 2, 'but each reply is its own row when the line opens');
  assert.equal(mixed.value[1].items[0].note, 'You logged it', 'a reply typed in is the person\'s own record, not a match');
  assert.equal(mixed.value[1].target, 'replied', 'a reply is followed up where replies are, not in the record sheet');
  // A group of one opens to its note, not to a list whose only row repeats the line.
  const oneWin = weekReview({ ...base, outcomes: [outcome({ id: 'w9', kind: 'won', amount: 150, currency: '$', who: 'Casa Blanca', note: 'Paid by GCash' })] });
  assert.equal(oneWin.value[0].text, 'Won $150 — Casa Blanca');
  assert.deepEqual(oneWin.value[0].items, []);
  assert.deepEqual(oneWin.value[0].detail, ['“Paid by GCash”']);

  // 3. A mandate's worth is the owner's answer, in the owner's category.
  const worth = weekReview({ ...base, outcomes: [
    outcome({ id: 'm1', kind: 'saved', amount: 80, currency: '$', commission_id: 'c1', who: 'Find a good deal on marketplace' }),
    outcome({ id: 'm2', kind: 'delivered', commission_id: 'c2', who: 'Shortlist of suppliers' }),
  ] });
  assert.equal(worth.value[0].text, '"Find a good deal on marketplace" — saved you $80');
  assert.equal(worth.value[1].text, '"Shortlist of suppliers" — produced something you can use');

  // 4. Waste. A queue is waste only once it has sat; drafts written this morning
  //    are this morning's work.
  assert.equal(weekReview({ ...base, queue: { count: 51, oldestDays: STALE_DRAFT_DAYS - 1 } }).waste.length, 0);
  const stale = weekReview({ ...base, queue: { count: 51, oldestDays: 14 } });
  assert.equal(stale.waste[0].text, '51 drafts written and never sent');
  assert.equal(stale.waste[0].target, 'queue');
  // A payload with no sends and no drafts on it: the line says only what it can.
  assert.equal(stale.waste[0].sub, 'The oldest has waited 14 days');

  // The drafts line moves. Its count changes only when the pile does, so under
  // it: what went out this week, and how many have sat past the point of
  // sending as written — a number that grows every day nothing is sent and
  // drops the moment something is. The same two weeks the send queue calls cold.
  assert.equal(COLD_DRAFT_DAYS, COLD_AFTER_DAYS, 'one judgement of when a draft goes cold, in both places');
  const drafts = [
    { who: 'Tubero Plumbing', createdAt: daysAgo(2) },
    { who: 'Triple A Pest', createdAt: daysAgo(18) },
    { who: 'Rocar Excavation', createdAt: daysAgo(COLD_DRAFT_DAYS) },
  ];
  const piling = weekReview({ ...base, queue: { count: 3, oldestDays: 18, drafts }, sentAt: [daysAgo(12)] });
  assert.equal(piling.waste[0].sub, 'None sent this week · 2 have sat two weeks or more', 'a send twelve days ago is not this week\'s');
  assert.deepEqual(piling.waste[0].items.map((i) => `${i.text} · ${i.when}`), ['Triple A Pest · 18 days', 'Rocar Excavation · 14 days', 'Tubero Plumbing · 2 days'], 'oldest first: the one closest to having moved on');
  const moving = weekReview({ ...base, queue: { count: 3, oldestDays: 18, drafts }, sentAt: [daysAgo(1), daysAgo(3), daysAgo(12)] });
  assert.equal(moving.waste[0].sub, '2 sent this week · 2 have sat two weeks or more');
  // Opened, it shows the first few and counts the rest of the queue, whatever the queue could render.
  const deep = weekReview({ ...base, queue: { count: 57, oldestDays: 18, drafts: Array.from({ length: 8 }, (_, i) => ({ who: `B${i}`, createdAt: daysAgo(18 - i) })) } });
  assert.equal(deep.waste[0].items.length, MAX_ITEMS);
  assert.equal(deep.waste[0].more, 57 - MAX_ITEMS);

  const failing = weekReview({ ...base, sources: { total: 12, failing: 4 } });
  assert.match(failing.waste[0].text, /^4 of 12 sources failed/);
  const named = weekReview({ ...base, sources: { total: 12, failing: 2, failed: [
    { label: 'Freelancer', error: 'HTTP 403', checkedAt: '2026-09-24T01:00:00Z' },
    { label: 'r/indiebiz', error: 'Timed out after 10s', checkedAt: null },
  ] } });
  assert.deepEqual(named.waste[0].items, [
    { text: 'Freelancer', when: 'today', note: 'HTTP 403' },
    { text: 'r/indiebiz', when: null, note: 'Timed out after 10s' },
  ], 'each failing source by name, with the reason it gave: what to fix, or to drop');
  assert.equal(named.waste[0].more, 0);

  // A handful of binned suggestions is taste; it only becomes a line past the floor.
  const bins = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `d${i}`, job: 'watch', kind: 'learn' as const, headline: 'h', status: 'dismissed' as const, acted_at: '2026-09-22T10:00:00Z' }));
  assert.equal(weekReview({ ...base, answered: bins(MIN_BINNED - 1) }).waste.length, 0);
  const binnedWeek = weekReview({ ...base, answered: bins(MIN_BINNED) });
  assert.match(binnedWeek.waste[0].text, /^3 suggestions you binned/);
  assert.equal(binnedWeek.waste[0].items.length, MIN_BINNED, 'opened, it names what was binned');

  // Projects that bought nothing: answered "worth nothing", or called off with
  // no answer. The ledger row's kind decides first; the sentence closeCommission
  // writes is only the fallback for a row the ledger could not take.
  const dud = weekReview({
    ...base,
    outcomes: [
      outcome({ id: 'w5', kind: 'delivered', commission_id: 'c5', opportunity_id: null, who: 'Called off, but useful' }),
      outcome({ id: 'w6', kind: 'nothing', commission_id: 'c6', opportunity_id: null, who: 'Supplier search' }),
    ],
    commissions: [
      { id: 'c1', objective: 'Find jobs', status: 'stopped', closed_at: '2026-09-20T10:00:00Z', outcome: null },
      { id: 'c2', objective: 'Price check', status: 'done', closed_at: '2026-09-21T10:00:00Z', outcome: 'Worth nothing. Stale listings.' },
      { id: 'c3', objective: 'Shortlist', status: 'done', closed_at: '2026-09-21T10:00:00Z', outcome: 'Produced something usable.' },
      { id: 'c4', objective: 'Old one', status: 'stopped', closed_at: '2026-08-01T10:00:00Z', outcome: null },
      // Called off with a real answer is not waste, whatever the button was.
      { id: 'c5', objective: 'Called off, but useful', status: 'stopped', closed_at: '2026-09-22T10:00:00Z', outcome: 'Produced something usable.' },
      // No sentence at all, and the ledger says nothing: counted from the row.
      { id: 'c6', objective: 'Supplier search', status: 'done', closed_at: '2026-09-22T10:00:00Z', outcome: null },
    ],
  });
  assert.equal(dud.waste[0].text, '3 projects closed with nothing to show');
  assert.deepEqual(dud.waste[0].items.map((i) => `${i.text} · ${i.note}`), [
    'Supplier search · You said it was worth nothing',
    'Price check · You said it was worth nothing',
    'Find jobs · Called off with no verdict',
  ], 'newest first, each with how it ended');

  // The call record's two verdicts, said as waste rather than as a log — and
  // only this week's calls, under a heading that says "This week".
  const record = weekReview({ ...base, decisions: [call('2026-09-22'), call('2026-09-23'), call('2026-09-24')] });
  // A job key is the database talking; the screen says it the way a person would.
  assert.match(record.waste[0].text, /^3 calls about sending the drafts and not one of them done/);
  assert.doesNotMatch(record.waste[0].text, /send_queue/);
  assert.deepEqual(record.waste[0].items.map((i) => i.when), ['today', 'yesterday', 'Tue'], 'opened: the calls it counted, newest first');
  assert.equal(record.waste[0].items[0].note, 'Left undone');
  const stale3 = weekReview({ ...base, decisions: [call('2026-09-01'), call('2026-09-02'), call('2026-09-03')] });
  assert.equal(stale3.waste.length, 0, 'three ignored calls from three weeks ago are not this week\'s waste');

  // 5. What has to change: the growth edge first, then the bottleneck's own
  //    action, then runway — and nothing when nothing measured points anywhere.
  const edge = { capability: 'sending what you have already written', because: ['61 of 70 stopped at drafted.'], experiment: 'Send five before you open anything else.', source: 'funnel' as const };
  const withEdge = weekReview({ ...base, edge, bottleneck: { kind: 'bottleneck', headline: 'Drafted → Sent is where you lose most', detail: '', action: 'Send them' } });
  assert.deepEqual(withEdge.change, {
    head: 'Sending what you have already written', because: '61 of 70 stopped at drafted.', body: 'Send five before you open anything else.',
    progress: null, next: null, action: null,
  }, 'nothing it can count and nothing queued: no meter and no button');
  const noEdge = weekReview({ ...base, bottleneck: { kind: 'bottleneck', headline: 'Sent → Replied is where you lose most', detail: '', action: 'Change the first line' } });
  assert.equal(noEdge.change?.body, 'Change the first line');
  assert.match(weekReview({ ...base, runwayMonths: 2.4 }).change?.head ?? '', /^2.4 months of runway/);
  assert.equal(weekReview({ ...base, runwayMonths: 6 }).change, null);

  // The change counts its own experiment, live, off this week's sends: it moves
  // when something goes out, says when it is done, and then asks for the half a
  // count cannot see. It used to print one sentence per funnel stage, the same
  // sentence every week the funnel stayed stuck.
  const counted = { ...edge, measure: { metric: 'sent' as const, target: 5 } };
  const queued = { count: 57, oldestDays: 18 };
  const started = weekReview({ ...base, edge: counted, queue: queued, sentAt: [daysAgo(1), daysAgo(2), daysAgo(9)] });
  assert.deepEqual(started.change?.progress, { done: 2, of: 5, met: false, label: '2 of 5 sent this week' });
  assert.equal(started.change?.next, null);
  assert.deepEqual(started.change?.action, { label: 'Open the queue', target: 'queue' });
  const finished = weekReview({ ...base, edge: counted, queue: queued, sentAt: Array.from({ length: 6 }, (_, i) => daysAgo(i)) });
  assert.deepEqual(finished.change?.progress, { done: 6, of: 5, met: true, label: '6 sent this week — done' });
  assert.match(finished.change?.next ?? '', /log what comes back/);
  assert.deepEqual(finished.change?.action, { label: 'Log what came back', target: 'waiting' });
  // No sends on the payload is not zero sends: no meter, rather than "0 of 5" over a week that had some.
  const unread = weekReview({ ...base, edge: counted, queue: queued });
  assert.equal(unread.change?.progress, null);
  assert.deepEqual(unread.change?.action, { label: 'Open the queue', target: 'queue' });
  // An experiment counted in replies counts this week's replies, and only this week's.
  const booking = { ...edge, capability: 'turning a reply into a booked call', measure: { metric: 'replies' as const, target: 5 } };
  const answering = weekReview({ ...base, edge: booking, outcomes: [outcome({ id: 'r1' }), outcome({ id: 'r2', occurred_at: '2026-09-01T10:00:00Z' })] });
  assert.equal(answering.change?.progress?.label, '1 of 5 replies this week');
  assert.deepEqual(answering.change?.action, { label: 'See your replies', target: 'replied' });

  // 6. What "you did" means. A call answered "I did it" is the reliable yes; a
  //    done Move is too, except a kept feed find (Keep and Did it both write
  //    done) and a handed-over proposal (delegated, not done). The Move behind
  //    a call counts once.
  const busyDecisions = [call('2026-09-24', { headline: 'Apply to the Maintenance Coordinator role', topic: 'watch', response: 'did', source_move_id: 'mv-call' })];
  const busyAnswered: ReviewInput['answered'] = [
    { id: 'mv-call', job: 'watch', kind: 'earn', headline: 'Apply to the Maintenance Coordinator role', status: 'done', acted_at: '2026-09-24T02:00:00Z' },
    { id: 'kept', job: 'watch', kind: 'earn', headline: 'A gig post somebody only kept', status: 'done', acted_at: '2026-09-24T02:00:00Z' },
    { id: 'handed', job: 'propose', kind: 'build', headline: 'Shortlist ten property managers', status: 'done', acted_at: '2026-09-24T02:00:00Z' },
    { id: 'goal', job: 'goal_gap', kind: 'decide', headline: 'Reset the revenue target', status: 'done', acted_at: '2026-09-23T02:00:00Z' },
  ];
  const busy = weekReview({
    ...base,
    focus: [{ id: '1', minutes: 120, on: '2026-09-24', note: null, at: '2026-09-24T09:00:00Z' }, { id: '2', minutes: 90, on: '2026-09-21', note: null, at: '2026-09-21T09:00:00Z' }],
    decisions: busyDecisions,
    answered: busyAnswered,
  });
  // One line per thing done, newest first — never "You did 2 things … +1",
  // which was six lines tall on a phone and named one of the two.
  assert.equal(busy.value[0].text, 'Apply to the Maintenance Coordinator role');
  assert.equal(busy.value[0].when, 'today');
  assert.equal(busy.value[0].detail[0], 'Today’s call — you answered “I did it”');
  assert.match(busy.value[0].detail[1] ?? '', /^Reading .+ back in a few days/, 'opened, it says what came of it');
  assert.equal(busy.value[1].text, 'Reset the revenue target');
  assert.deepEqual(busy.value[1].detail, ['A suggestion you marked done']);
  assert.equal(busy.value.filter((l) => l.kind === 'did').length, 2, 'the kept find and the handed-over proposal are not things done');
  assert.equal(busy.value[2].text, '3.5h of deep work over 2 days');
  assert.deepEqual(busy.value[2].items.map((i) => `${i.when} ${i.text}`), ['today 2h', 'Mon 1.5h'], 'opened: every day worked, newest first');
  assert.equal(busy.value[2].sub, null, 'nothing logged the week before, so nothing to compare with');

  // A step ticked on the plan is a thing done. "I did it" on a call drawn from
  // the plan ticks its step too, under the same words, so the two are one line.
  // A step ticked and put back was not done.
  const mark = (item: string, title: string, at: string, state: 'done' | 'open' = 'done') => ({ item, title, state, at });
  const ticked = weekReview({ ...base, decisions: busyDecisions, answered: busyAnswered, marks: [
    mark('s1', 'Apply to the Maintenance Coordinator role', '2026-09-24T03:00:00Z'),
    mark('s2', 'Research the overstay fine', '2026-09-23T03:00:00Z'),
    mark('s3', 'Ticked and put back', '2026-09-22T03:00:00Z'),
    mark('s3', 'Ticked and put back', '2026-09-22T05:00:00Z', 'open'),
    mark('s4', 'Ticked last month', '2026-09-01T03:00:00Z'),
  ] });
  assert.deepEqual(ticked.value.filter((l) => l.kind === 'did').map((l) => l.text), ['Apply to the Maintenance Coordinator role', 'Reset the revenue target', 'Research the overstay fine']);
  assert.deepEqual(ticked.value.find((l) => l.text === 'Research the overstay fine')?.detail, ['Ticked off on your plan']);

  // A busy week stays a card, not a wall: past MAX_DID_LINES the rest are one line that opens.
  const many = weekReview({ ...base, answered: Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, job: 'goal_gap', kind: 'decide' as const, headline: `Thing ${i}`, status: 'done' as const, acted_at: daysAgo(i) })) });
  const didLines = many.value.filter((l) => l.kind === 'did');
  assert.equal(didLines.length, MAX_DID_LINES);
  assert.equal(didLines[MAX_DID_LINES - 1].text, `${6 - (MAX_DID_LINES - 1)} more things you did`);
  assert.equal(didLines[MAX_DID_LINES - 1].items.length, 6 - (MAX_DID_LINES - 1));

  // Hours say whether they are more or fewer than the week before — the one comparison on the card.
  const hours = (on: string, minutes: number) => ({ id: on, minutes, on, note: null, at: `${on}T09:00:00Z` });
  assert.equal(weekReview({ ...base, focus: [hours('2026-09-24', 120), hours('2026-09-15', 60)] }).value[0].sub, 'Up from 1h the week before');
  assert.equal(weekReview({ ...base, focus: [hours('2026-09-24', 30), hours('2026-09-15', 60)] }).value[0].sub, 'Down from 1h the week before');
  const onlyKept = weekReview({ ...base, answered: [{ id: 'kept', job: 'watch', kind: 'earn', headline: 'A gig post', status: 'done', acted_at: '2026-09-24T02:00:00Z' }] });
  assert.equal(onlyKept.value.length, 0, 'keeping a find is not doing it');
  assert.equal(localDay('2026-09-23T20:00:00Z', 'Asia/Manila'), '2026-09-24', 'late UTC evening is the next morning in Manila');
  assert.equal(whenLabel('2026-09-21', '2026-09-24'), 'Mon');

  console.log('copilot-core: week-in-review checks passed');
}

weekInReview().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// The four-tab shell: Today
//
// "Done for you" is the part the old Now never had: the promise is an app that
// works while you sleep, and nothing on the screen said what it had done. The
// checks here keep it honest — it may not take credit for what the user did,
// and it may not report calm over a nightly job that never ran.
// ---------------------------------------------------------------------------
import { reportOf as reportOfV2 } from '../../src/lib/copilot/commission';
import type { Commission as CommissionV2, CommissionEvent as CommissionEventV2 } from '../../src/lib/copilot/commission';
import { ASK_LABEL, MAX_WORTH_DOING, doneForYou, needsYou, todayStatus, worthDoing, type DoneInput } from '../../src/lib/copilot/today';
import type { CommissionThread as ThreadV2, Move as MoveV2 } from '../../src/lib/copilot/types';

function threadV2(c: Partial<CommissionV2>, events: Array<Partial<CommissionEventV2>> = []): ThreadV2 {
  const commission: CommissionV2 = {
    id: 'c1', goal_id: null, objective: 'Step by step plan to exit Philippines', why: null,
    authority: 'read', budget_minutes: 60, status: 'active',
    plan: [{ n: 1, do: 'a', state: 'done' }, { n: 2, do: 'b', state: 'done' }, { n: 3, do: 'c', state: 'todo' }, { n: 4, do: 'd', state: 'todo' }],
    created_at: '2026-09-15T00:00:00Z', approved_at: '2026-09-15T00:00:00Z', last_run_at: null,
    closed_at: null, outcome: null, seen_at: null, ...c,
  };
  const evs = events.map((e, i) => ({ id: `e${i}`, commission_id: commission.id, kind: 'worked' as const, step: null, summary: 's', artifact: null, at: '2026-09-24T05:00:00Z', ...e }));
  return { commission, report: reportOfV2(commission, evs), line: '' };
}

function moveV2(m: Partial<MoveV2>): MoveV2 {
  return {
    id: 'm', job: 'goal_gap', kind: 'decide', headline: 'h', why: ['w'],
    artifact: { kind: 'text', label: 'Read it', value: 'v' }, cost_label: null, status: 'open',
    created_at: '2026-09-24T05:00:00Z', ...m,
  };
}

async function todayTab() {
  const now = new Date('2026-09-24T10:00:00Z');
  const base: DoneInput = { now, lastCronRun: '2026-09-24T05:02:00Z', jobsRun: null, matchCreated: [], matchesWaiting: 0, matchesBelow: 0, motion: [], sourcesFailing: 0, commissions: [], outcomes: [], moves: [] };

  // 1. What arrived in the last day, counted from the rows it arrived as.
  const done = doneForYou({
    ...base,
    matchCreated: ['2026-09-24T05:00:00Z', '2026-09-24T05:01:00Z', '2026-09-20T05:00:00Z'],
    // One of last night's two was already drafted: found and waiting are different numbers.
    matchesWaiting: 1,
    motion: [{ kind: 'watched', label: '8 of 12 sources read', detail: 'Forum, Freelancer +2 failed — open Sources to see why' }],
    sourcesFailing: 4,
    outcomes: [
      { id: 'o1', kind: 'reply', amount: null, currency: null, note: null, source: 'system', occurred_at: '2026-09-24T03:00:00Z', opportunity_id: 'b', commission_id: null, who: 'X Out Pest' },
      // Typed in by hand: the user's work, not the app's. Reporting it back to
      // them as something done FOR them is the screen taking credit.
      { id: 'o2', kind: 'reply', amount: null, currency: null, note: null, source: 'manual', occurred_at: '2026-09-24T04:00:00Z', opportunity_id: 'c', commission_id: null, who: 'Tubero' },
    ],
    commissions: [threadV2({}, [{ kind: 'worked', summary: 'BI requires ECC-A for stays of six months or more' }])],
    // A mandate's blocked question is an ask, not a Move worked out: it is not counted.
    moves: [{ job: 'goal_gap', created_at: '2026-09-24T05:00:00Z' }, { job: 'runway_guard', created_at: '2026-09-18T05:00:00Z' }, { job: 'commission', created_at: '2026-09-24T05:00:00Z' }],
  });
  assert.equal(done.stale, false);
  assert.equal(done.nightlyAt, '2026-09-24T05:02:00Z');
  assert.deepEqual(done.rows.map((r) => r.key), ['matches', 'replies', 'sources', 'p:c1', 'moves']);
  assert.equal(done.rows[0].label, '1 new match worth a look', 'what is worth a look, not what was fetched — and last week\'s is not last night\'s');
  assert.equal(done.rows[0].detail, 'Out of 2 it found overnight', 'Today and Matches must not disagree about the count');
  assert.equal(done.rows[1].label, '1 reply came in');
  assert.match(done.rows[1].detail, /^X Out Pest/);
  assert.equal(done.rows[2].target, 'sources', 'a failed read leads to where it can be fixed');
  assert.equal(done.rows[2].tone, 'warn', 'a failure never wears the tick');
  // Decided from the rows, not from the wording: the same sentence with nothing
  // failing leads to the finds.
  assert.equal(doneForYou({ ...base, motion: [{ kind: 'watched', label: '8 sources read', detail: '3 worth keeping — Forum' }] }).rows[0].target, 'matches');
  assert.equal(done.rows[3].detail, '2 of 4 steps done — BI requires ECC-A for stays of six months or more', 'progress is the plan\'s count, never the worker\'s say-so');
  assert.equal(done.rows[4].label, '1 move worked out from your rows');

  // 2. A job that never ran is said out loud. With no nightly run every morning
  //    is computed by the person opening the app, and that must not look like a quiet night.
  assert.equal(doneForYou({ ...base, lastCronRun: null }).stale, true);
  assert.equal(doneForYou({ ...base, lastCronRun: '2026-09-22T05:00:00Z' }).stale, true);
  assert.equal(doneForYou({ ...base, lastCronRun: '2026-09-22T05:00:00Z' }).nightlyAt, null);
  // And a sensor that broke is carried through, never dropped into a count.
  assert.deepEqual(doneForYou({ ...base, jobsRun: { at: '', ran: 9, produced: 3, written: 1, quiet: [], broke: ['watch: timeout'] } }).broke, ['watch: timeout']);

  // A project the WORKER finished is done for you; one the owner closed by hand
  // is their act, not the app's. The worker's finish stamps last_run_at and
  // closed_at in one write; a close by hand leaves last_run_at behind.
  const fin = doneForYou({ ...base, commissions: [threadV2({ status: 'done', last_run_at: '2026-09-24T06:00:00Z', closed_at: '2026-09-24T06:00:00Z', outcome: 'Three quotes, cheapest delivered is Signworks.' })] });
  assert.equal(fin.rows[0].label, 'Finished: Step by step plan to exit Philippines');
  assert.match(fin.rows[0].detail, /Three quotes/);
  const byHand = doneForYou({ ...base, commissions: [threadV2({ status: 'done', last_run_at: '2026-09-23T05:00:00Z', closed_at: '2026-09-24T06:00:00Z', outcome: 'Produced something usable.' })] });
  assert.equal(byHand.rows.length, 0, 'the owner closing it is not the app doing it');

  // 3. Needs you, in the order to clear it — and a breakage is never a question.
  const asks = needsYou({
    commissions: [
      threadV2({ id: 'draft', status: 'draft', objective: 'Compare three suppliers' }),
      threadV2({ id: 'broke', status: 'blocked', objective: 'Find jobs' }, [{ kind: 'failed', summary: 'search tool returned 500' }]),
      threadV2({ id: 'ask', status: 'blocked' }, [{ kind: 'needs_you', summary: 'Will you email BI’s Tourist Visa Section?' }]),
    ],
    capture: { kind: 'outcome', headline: '3 replies are still open', because: 'b' },
    queue: { count: 51, oldestDays: 14 },
    queueIsCall: false,
    noOffer: false,
  });
  assert.deepEqual(asks.map((a) => a.kind), ['question', 'fix', 'confirm', 'approve', 'send']);
  assert.equal(asks[0].title, 'Will you email BI’s Tourist Visa Section?');
  assert.equal(asks[1].title, 'Find jobs');
  assert.doesNotMatch(asks[1].detail, /answer|reply/i, 'nobody can answer a 500');
  assert.equal(asks[4].title, '51 drafts ready to send');
  assert.equal(ASK_LABEL.fix, 'Needs a fix');
  // The queue is never said twice: not when it is the call, not when the offer is blank.
  const q = { commissions: [], capture: null, queue: { count: 51, oldestDays: 14 } };
  assert.equal(needsYou({ ...q, queueIsCall: true, noOffer: false }).length, 0);
  assert.equal(needsYou({ ...q, queueIsCall: false, noOffer: true }).length, 0, 'invariant 1: with a blank offer the next step is the offer');

  // 4. Worth doing: each Move lives in exactly one place.
  const moves = [
    moveV2({ id: 'feed', job: 'watch', kind: 'earn' }),
    moveV2({ id: 'queue', job: 'send_queue', kind: 'earn' }),
    moveV2({ id: 'ask', job: 'commission', kind: 'decide' }),
    moveV2({ id: 'plan', job: 'propose', artifact: { kind: 'plan', label: 'Hand it over', value: 'v', steps: ['a'] } }),
    moveV2({ id: 'a', job: 'goal_gap' }), moveV2({ id: 'b', job: 'runway_guard' }),
    moveV2({ id: 'c', job: 'opening_gap' }), moveV2({ id: 'd', job: 'silence' }),
  ];
  const wd = worthDoing(moves);
  assert.deepEqual(wd.shown.map((m) => m.id), ['a', 'b', 'c']);
  assert.equal(wd.shown.length, MAX_WORTH_DOING);
  assert.equal(wd.more, 1);

  assert.equal(todayStatus(done, asks), '4 done for you · 5 need you', 'the failed read is listed, never counted as done');
  assert.equal(todayStatus({ ...done, rows: [] }, []), null, 'nothing true to say beats filler');
  console.log('copilot-core: today tab checks passed');
}

todayTab().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// The four-tab shell: Matches
//
// Everything found outside the account, laid out. Two sources that are
// answered differently, one list, chips by what kind of thing it is. The
// checks: nothing appears twice, what was found overnight leads, a listing
// nobody can reach is not offered, and no guess is printed as a percentage.
// ---------------------------------------------------------------------------
import { MATCH_GROUP_LABEL, groupOfKind, groupOfType, matchCounts, matchFeed } from '../../src/lib/copilot/matches';
import type { Opportunity as OpportunityV2, PipelineRow as PipelineRowV2 } from '../../src/lib/copilot/types';
import type { TriageCard as TriageCardV2 } from '../../src/lib/copilot/triage';

function bizV2(o: Partial<OpportunityV2>, stage: PipelineRowV2['stage'] = 'not_drafted'): PipelineRowV2 {
  const opportunity: OpportunityV2 = {
    id: 'b', type: 'client', title: 'X Out Pest Services', reason: 'Few reviews · running Facebook ads',
    value_label: null, value_amount: null, currency: null, effort: 'light', fit_score: 60, score: 60,
    source: 'google_maps', url: null, status: 'new', data: { segment: 'Pest control' }, external_id: 'x',
    source_kind: 'sourced', contact: { whatsapp: '+639170000000' }, scored_at: null, created_at: '2026-09-20T05:00:00Z', ...o,
  };
  return { opportunity, execution: null, stage };
}

async function matchesTab() {
  const now = new Date('2026-09-24T10:00:00Z');
  const feed = matchFeed({
    now,
    targetSegments: ['Pest control', 'Plumbing'],
    pipeline: [
      bizV2({ id: 'old-high', score: 90 }),
      bizV2({ id: 'old-low', score: 40 }),
      bizV2({ id: 'new', score: 50, created_at: '2026-09-24T05:00:00Z' }),
      bizV2({ id: 'drafted' }, 'to_send'),
      bizV2({ id: 'sent' }, 'sent'),
      bizV2({ id: 'nowhere', contact: {}, url: null }),
      bizV2({ id: 'gone', status: 'dismissed' }),
      bizV2({ id: 'person', type: 'people', contact: {}, url: 'https://example.com/p' }),
    ],
    // The deck's learned order: old-low is a segment this person keeps.
    triage: [
      { id: 'old-low', source: 'opportunity', title: 't', segment: 'pest control', reason: '', score: 40, contact: { whatsapp: true, email: false }, url: null },
      { id: 'gig', source: 'move', title: 'Reply to the Tampa HVAC owner', segment: 'earn', reason: 'They describe what you build', score: 0, contact: { whatsapp: false, email: false }, url: 'https://forum.example/t/1', created_at: '2026-09-24T04:00:00Z' },
    ] as TriageCardV2[],
    moves: [
      moveV2({ id: 'gig', job: 'watch', kind: 'earn' }),
      moveV2({ id: 'read', job: 'watch', kind: 'learn', headline: 'AU trades want voice intake', artifact: { kind: 'link', label: 'Read it', value: 'v', href: 'https://news.example/a' }, created_at: '2026-09-21T00:00:00Z' }),
      moveV2({ id: 'mine', job: 'goal_gap' }),
    ],
  });

  // 1. Only what can be acted on, and nothing twice. Drafted is the queue and
  //    sent is the pipeline; a listing with no contact and no link is a row you
  //    can only scroll past; the deck's copy of a find and the Move behind it
  //    are one item.
  const ids = feed.map((i) => i.id);
  for (const gone of ['drafted', 'sent', 'nowhere', 'gone', 'mine']) assert.ok(!ids.includes(gone), `${gone} should not be in Matches`);
  assert.equal(ids.filter((i) => i === 'gig').length, 1);

  // 2. What came in overnight leads; then the deck's learned order; then score.
  assert.deepEqual(ids.slice(0, 2).sort(), ['gig', 'new']);
  assert.equal(ids.indexOf('old-low') < ids.indexOf('old-high'), true, 'what you keep drafting comes up first');

  // 3. Groups, and how each is answered.
  const by = Object.fromEntries(feed.map((i) => [i.id, i]));
  assert.equal(by.new.group, 'clients');
  assert.equal(by.new.channel, 'whatsapp');
  assert.equal(by.new.tag, 'pest control', 'the grouping key, as segmentOf normalises it; the eyebrow sets the case');
  assert.equal(by.person.group, 'people');
  assert.equal(by.person.channel, null);
  assert.equal(by.gig.group, 'work', 'a paid post from a feed is a gig, not a client');
  assert.equal(by.gig.answer, 'triage', 'a deck card keeps teaching the keep-rate');
  assert.equal(by.read.group, 'signals');
  assert.equal(by.read.answer, 'move');
  assert.equal(groupOfType('signal'), 'signals');
  assert.equal(groupOfKind('meet'), 'people');

  // 4. No percentages. The order uses the fit score; the screen never prints it.
  for (const item of feed) assert.ok(!('score' in item), 'a guess is not shown as a measurement');

  const counts = matchCounts(feed);
  assert.equal(counts.all, feed.length);
  assert.equal(counts.fresh, 2);
  assert.equal(counts.by.clients, 3);
  assert.equal(matchCounts([]).all, 0);
  assert.equal(MATCH_GROUP_LABEL.work, 'Gigs & jobs');
  console.log('copilot-core: matches tab checks passed');
}

matchesTab().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// The four-tab shell: Work
//
// The agents that run parts of the business. A roster with one rule: every
// state is drawn from rows. The checks are the ways a status lies — a
// Researcher looking busy with no worker connected, a Writer "ready" on a blank
// offer, a failed read shown as a working one. (The business itself is the
// chain, and has its own suite: businessChainSuite, at the end.)
// ---------------------------------------------------------------------------
import { AGENT_STATE_LABEL, agentRoster, agoLabel, type RosterInput } from '../../src/lib/copilot/machine';

async function workTab() {
  const now = new Date('2026-09-24T10:00:00Z');

  // The team. States come from when each last ran and what it produced.
  const base: RosterInput = {
    now, supplyLastRun: '2026-09-24T03:00:00Z', sourced: 243, hasTargeting: true, matchesLeft: 1973,
    sources: [
      { lastCheckedAt: '2026-09-24T05:00:00Z', error: null, status: 'active' },
      { lastCheckedAt: '2026-09-24T05:00:00Z', error: '429', status: 'active' },
    ],
    finds: 3, offerEmpty: false, queueCount: 51, drafted: 70, workerConnected: true,
    commissions: [threadV2({ status: 'blocked' }, [{ kind: 'needs_you', summary: 'Which one?' }])],
    lastCronRun: '2026-09-24T05:02:00Z', lastRun: { status: 'ok' }, jobsRan: 9, broke: [],
  };
  const team = agentRoster(base);
  assert.deepEqual(team.map((a) => a.key), ['scout', 'watcher', 'writer', 'researcher', 'planner']);
  assert.deepEqual(team.map((a) => a.state), ['working', 'working', 'ready', 'working', 'working']);
  assert.equal(team[0].line, '243 found so far · last looked 7h ago');
  assert.equal(team[1].line, '2 sources · 3 worth a look · 1 failing');
  assert.equal(team[3].line, '1 project running · 1 waiting on you');
  assert.equal(team[4].line, 'Ran 5h ago · 9 checks');
  for (const a of team) assert.ok(AGENT_STATE_LABEL[a.state], 'a coloured dot alone is not a status');

  const by = (i: RosterInput) => Object.fromEntries(agentRoster(i).map((a) => [a.key, a]));
  // No worker connected: needs setup, however many mandates were written.
  assert.equal(by({ ...base, workerConnected: false }).researcher.state, 'setup');
  // A breakage is the worker's, and says so — never "running".
  assert.equal(by({ ...base, commissions: [threadV2({ status: 'blocked' }, [{ kind: 'failed', summary: '500' }])] }).researcher.state, 'failed');
  // Invariant 1: a blank offer is not idleness, it is what the Writer waits on.
  assert.equal(by({ ...base, offerEmpty: true }).writer.state, 'setup');
  // A night where every read failed is a failed watcher, not a working one.
  assert.equal(by({ ...base, sources: [{ lastCheckedAt: '2026-09-24T05:00:00Z', error: 'timeout', status: 'active' }] }).watcher.state, 'failed');
  assert.equal(by({ ...base, sources: [] }).watcher.state, 'setup');
  assert.equal(by({ ...base, hasTargeting: false }).scout.state, 'setup');
  assert.equal(by({ ...base, matchesLeft: 0 }).scout.state, 'idle');
  // No cron: the Planner only plans when the app is opened, and says so.
  assert.equal(by({ ...base, lastCronRun: null }).planner.state, 'idle');
  assert.match(by({ ...base, lastCronRun: null }).planner.line, /only plans when you open the app/);
  // A broken sensor lands on the agent it belongs to.
  const broke = by({ ...base, broke: ['watch: timeout', 'goal_gap: boom'] });
  assert.equal(broke.watcher.state, 'failed');
  assert.equal(broke.planner.state, 'failed');
  assert.match(broke.planner.line, /goal_gap: boom/);

  assert.equal(agoLabel('2026-09-21T10:00:00Z', now), '3d ago');
  console.log('copilot-core: work tab checks passed');
}

workTab().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// Matches, staged: New · To send · Waiting · Replied
//
// The send queue stopped being a card above the list and became a stage, and a
// poor fit stopped being listed as "Matched for you". The checks are the ways
// the old tab misled on the live account: sixty cards labelled "M", a Toledo in
// Ohio shown with no region, a dental lab offered to a jewellery maker under a
// calm header, and a queue card that was the biggest thing on the screen.
// ---------------------------------------------------------------------------
import {
  MATCH_STAGES, MATCH_STAGE_LABEL, SHOW_FIT, belowBar, imageOf, matchCounts as matchCountsS, matchFeed as matchFeedS,
  isSearchableSegment, monogramOf, placeOf, ratingOf, stageCards, tintOf,
} from '../../src/lib/copilot/matches';
import { doneForYou as doneForYouS, todayStatus as todayStatusS } from '../../src/lib/copilot/today';
import type { Execution as ExecutionS, QueueItem as QueueItemS } from '../../src/lib/copilot/types';

async function matchesStaged() {
  const now = new Date('2026-09-25T10:00:00Z');

  // 1. Where a place is, with its region — the fact that exposes a wrong city.
  assert.equal(placeOf({ city: 'Toledo', state: 'Ohio' }), 'Toledo, Ohio');
  assert.equal(placeOf({ city: 'Toledo', address: '2130 S Reynolds Rd, Toledo, OH 43614' }), 'Toledo, OH', 'postcode dropped, state kept');
  assert.equal(placeOf({ city: 'Toledo', address: 'Calle del Comercio 30, 45001 Toledo' }), 'Toledo');
  assert.equal(placeOf({ city: 'Madrid', address: 'Calle Toledo 12, 28005 Madrid' }), 'Madrid', 'read from the end: a street can carry a city name');
  assert.equal(placeOf({ area: 'Manila' }), 'Manila', 'hunter rows carry an area');
  assert.equal(placeOf({ city: 'Manila', state: 'Metro Manila' }), 'Manila', 'not the city twice');
  assert.equal(placeOf({}), null);

  // 2. The facts a glance can use, and nothing invented when they are missing.
  assert.equal(ratingOf({ rating: 4.6, reviews_count: 31 }), '4.6★ (31)');
  assert.equal(ratingOf({ rating: 5 }), '5.0★', 'one decimal, as Maps prints it');
  assert.equal(ratingOf({ rating: 0, reviews_count: 0 }), null, 'no reviews is not a zero rating');
  assert.equal(imageOf({ image_url: 'https://lh5.googleusercontent.com/p/abc' }), 'https://lh5.googleusercontent.com/p/abc');
  for (const bad of ['http://x.example/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AA', 42]) assert.equal(imageOf({ image_url: bad }), null, `${String(bad)} is not a photo URL`);
  assert.equal(monogramOf('M & T Dental Lab'), 'MT');
  assert.equal(monogramOf('The Olive Tree'), 'OT');
  assert.equal(monogramOf('Joyería Álvarez'), 'JA', 'accents stripped, letters kept');
  assert.equal(monogramOf('東京ジュエリー'), '東', 'a script the strip removes still gets its first character');
  assert.equal(tintOf('Mountain Tops'), tintOf('Mountain Tops'), 'a card keeps its colour');
  assert.ok(tintOf('anything') >= 0 && tintOf('anything') < 6);

  // 3. The bar is the ranker's judgement, and only a judged listing can fall below it.
  assert.equal(belowBar({ scored_at: '2026-09-25T04:00:00Z', fit_score: SHOW_FIT - 1 }), true);
  assert.equal(belowBar({ scored_at: '2026-09-25T04:00:00Z', fit_score: SHOW_FIT }), false);
  assert.equal(belowBar({ scored_at: '2026-09-25T04:00:00Z', fit_score: 55 }), true, 'a middling score came with a reason not to — it is not shown');
  assert.equal(belowBar({ scored_at: null, fit_score: 10 }), false, 'unjudged is not below the bar — the heuristic is not a verdict');

  const junk = (id: string, title: string, o: Partial<OpportunityV2> = {}) => bizV2({
    id, title, scored_at: '2026-09-25T04:00:00Z', fit_score: 20, created_at: '2026-09-25T03:00:00Z',
    data: { segment: 'm', category: 'Dental laboratory', city: 'Toledo', address: '1 Main St, Toledo, OH 43604', rating: 4.8, reviews_count: 31 }, ...o,
  });
  const feed = matchFeedS({
    now, targetSegments: ['m'], triage: [], moves: [],
    pipeline: [
      junk('j1', 'M & T Dental Lab'),
      junk('j2', 'Mountain Tops', { data: { segment: 'm', city: 'Toledo', state: 'Ohio' } }),
      junk('j3', 'Maumee Bay Motors'),
      bizV2({ id: 'fit', title: 'Casa de la Plata', scored_at: '2026-09-25T04:00:00Z', fit_score: 72, created_at: '2026-09-25T03:00:00Z', data: { category: 'Jewelry store', city: 'Toledo', state: 'Castilla-La Mancha', image_url: 'https://lh5.googleusercontent.com/p/x' } }),
    ],
  });
  const by = Object.fromEntries(feed.map((i) => [i.id, i]));
  assert.equal(by.j1.tag, 'Dental laboratory', 'what the listing is, not the term it was found under');
  assert.equal(by.j1.sub, 'Dental laboratory · Toledo, OH');
  assert.equal(by.j2.tag, null, 'a one-letter segment is never a label');
  assert.equal(by.j2.sub, 'Toledo, Ohio');
  assert.equal(by.fit.image, 'https://lh5.googleusercontent.com/p/x');
  assert.equal(by.fit.initials, 'CP');
  assert.deepEqual(feed.filter((i) => i.below).map((i) => i.id).sort(), ['j1', 'j2', 'j3']);

  // 4. What is counted is only what cleared the bar.
  const good = feed.filter((i) => !i.below);
  assert.deepEqual([matchCountsS(good).all, matchCountsS(good).fresh], [1, 1]);
  assert.equal(matchCountsS(good.map((i) => ({ ...i, fresh: false }))).fresh, 0);
  assert.equal(matchCountsS([]).all, 0, 'nothing found is nothing counted');
  assert.equal(isSearchableSegment('m'), false, 'one letter is a typo, and it is searched exactly as typed');
  assert.equal(isSearchableSegment(' é '), false);
  assert.equal(isSearchableSegment('IT'), true, 'two letters can be a market');

  // 5. The other three stages. To send is the queue in the queue's order, with
  //    the draft's first line; Waiting is oldest-sent first; Replied holds
  //    replies and meetings; won and lost are over and are not here.
  const exec = (o: Partial<ExecutionS>): ExecutionS => ({
    id: 'e', action_id: null, opportunity_id: null, channel: 'whatsapp', recipient: '63917', subject: null, body: 'Hi Maria —\nsaw your ads.',
    approval_state: 'needs_approval', provider: null, external_message_id: null, error: null, sent_at: null, dispatch: 'manual', created_at: '2026-09-11T10:00:00Z', ...o,
  });
  const queue = [{
    id: 'a1', kind: 'plan', owner: 'ai', title: 'Opener to Casa de la Plata, ready to review', detail: null, ai_draft: null, urgency: 'normal',
    due_label: null, minutes: 5, status: 'open', opportunity_id: 'fit', for_date: '2026-09-11',
    execution: exec({ action_id: 'a1', opportunity_id: 'fit', deep_link: 'https://wa.me/63917?text=Hi%20Maria' }),
    opp: { id: 'fit', title: 'Casa de la Plata', name: 'Maria', segment: 'jewelry store', score: 72 },
  }] as unknown as QueueItemS[];
  const pipeline = [
    { ...bizV2({ id: 'fit', title: 'Casa de la Plata', data: { category: 'Jewelry store', city: 'Toledo', state: 'Castilla-La Mancha' } }), stage: 'to_send' as const },
    { ...bizV2({ id: 's-new', title: 'Sent Recently' }), execution: exec({ approval_state: 'sent', sent_at: '2026-09-23T10:00:00Z' }), stage: 'sent' as const },
    { ...bizV2({ id: 's-old', title: 'Sent Long Ago' }), execution: exec({ approval_state: 'sent', sent_at: '2026-09-05T10:00:00Z' }), stage: 'sent' as const },
    { ...bizV2({ id: 'r1', title: 'Replied One' }), execution: exec({ approval_state: 'sent', sent_at: '2026-09-20T10:00:00Z' }), stage: 'replied' as const },
    { ...bizV2({ id: 'm1', title: 'Met One' }), execution: exec({ approval_state: 'sent', sent_at: '2026-09-21T10:00:00Z' }), stage: 'meeting' as const },
    { ...bizV2({ id: 'w1', title: 'Won One' }), stage: 'won' as const },
  ];
  const st = stageCards({ now, queue, pipeline, targetSegments: [] });
  assert.equal(st.to_send.length, 1);
  assert.equal(st.to_send[0].title, 'Casa de la Plata');
  assert.equal(st.to_send[0].sub, 'Jewelry store · Toledo, Castilla-La Mancha', 'meta from the business, not the action title');
  assert.equal(st.to_send[0].status, 'Written 14 days ago');
  assert.equal(st.to_send[0].preview, 'Hi Maria —', 'the first line of what is about to go out');
  assert.equal(st.to_send[0].draftId, 'a1');
  assert.equal(st.to_send[0].link, 'https://wa.me/63917?text=Hi%20Maria', 'sent from the card in one tap, in the user\'s own app');
  assert.equal(st.waiting[0]?.link ?? null, null, 'only a draft has something to send');
  assert.deepEqual(st.waiting.map((c) => c.oppId), ['s-old', 's-new'], 'the one closest to going cold first');
  assert.equal(st.waiting[0].status, 'Sent 20 days ago · no reply yet');
  assert.deepEqual(st.replied.map((c) => c.oppId), ['m1', 'r1'], 'the warmest reply first');
  assert.equal(st.replied[0].status, 'Meeting or proposal logged');
  assert.ok(!Object.values(st).flat().some((c) => c.oppId === 'w1'), 'won is over — it is on You, not on a list of people to chase');
  assert.deepEqual([...MATCH_STAGES], ['new', 'to_send', 'waiting', 'replied']);
  assert.equal(MATCH_STAGE_LABEL.to_send, 'To send');

  // 6. Today counts what is worth a look, and says plainly when nothing was.
  const night = { now, lastCronRun: '2026-09-25T05:00:00Z', jobsRun: null, motion: [], sourcesFailing: 0, commissions: [], outcomes: [], moves: [] };
  const four = ['2026-09-25T03:00:00Z', '2026-09-25T03:00:00Z', '2026-09-25T03:00:00Z', '2026-09-25T03:00:00Z'];
  const one = doneForYouS({ ...night, matchCreated: four, matchesWaiting: 1, matchesBelow: 3 });
  assert.equal(one.rows[0].label, '1 new match worth a look');
  assert.equal(one.rows[0].detail, 'Out of 4 it found overnight');
  assert.equal(one.rows[0].tone, 'done');
  assert.equal(todayStatusS(one, []), '1 done for you');
  const none = doneForYouS({ ...night, matchCreated: four, matchesWaiting: 0, matchesBelow: 4 });
  assert.equal(none.rows[0].label, 'Looked at 4 new listings');
  assert.equal(none.rows[0].detail, 'None worth your time — it keeps looking', 'no "poor fits", no card, no setting — the looking is still reported');
  assert.ok(!/poor|search/i.test(`${none.rows[0].label} ${none.rows[0].detail}`), 'nothing asks the user to fix the search');
  // With no nightly job, a find came from opening the app — not "overnight", and nothing "keeps looking".
  const dark = { ...night, lastCronRun: null };
  assert.equal(doneForYouS({ ...dark, matchCreated: four, matchesWaiting: 1, matchesBelow: 3 }).rows[0].detail, 'Out of 4 it found');
  assert.equal(doneForYouS({ ...dark, matchCreated: four, matchesWaiting: 0, matchesBelow: 4 }).rows[0].detail, 'None worth your time');
  const answered = doneForYouS({ ...night, matchCreated: four.slice(0, 2), matchesWaiting: 0, matchesBelow: 0 });
  assert.equal(answered.rows[0].detail, 'All already drafted or answered');
  console.log('copilot-core: matches staged checks passed');
}

matchesStaged().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// Hunts: the web searches the app plans for itself
//
// Supply was one query shape for everybody — every segment on Maps as "segment
// in area" — and on a live account it returned sixty businesses from the wrong
// Toledo. A sheet of searches the user wrote and managed fixed the shape and
// made finding people the user's job again; its owner's answer was "serve, not
// configure". So the app plans the searches from what it was told and keeps
// them honest by what they bring in. The checks are the ways that could go
// wrong: a plan read from nothing, the same words planned twice, a search that
// only brings in what nobody drafts kept forever, the user's own row retired by
// the app, a directory listed as a company, a link that opens the server's own
// network.
// ---------------------------------------------------------------------------
import {
  AUTO_HUNTS, HUNT_BIN_FLAG, HUNT_GRACE_DAYS, PLAN_SYSTEM, candidatesFromHits, companyFromTitle, contactFromHtml, contactPageLink,
  exaCategoryFor, exaQueryFor, huntYield, huntsNeeded, isPublicHttpUrl, labelFor, normalizeHuntInput, parsePlan, personFromTitle,
  buyersOf, noPlanReason, planFromOffer, planPrompt, sameHunt, spentHunts, urlKey, withPageContact, type Hunt as HuntH,
} from '../../src/lib/copilot/hunts';
import { matchFeed as matchFeedH } from '../../src/lib/copilot/matches';

async function huntsCore() {
  const now = new Date('2026-09-25T10:00:00Z');

  // 1. What a planned search may be: a web kind, and words a search can use.
  const ok = normalizeHuntInput({ kind: 'companies', query: '  a family-run resort in Palawan   that takes bookings by message ', area: ' Palawan, Philippines ' });
  assert.ok(!('error' in ok));
  if (!('error' in ok)) {
    assert.equal(ok.query, 'a family-run resort in Palawan that takes bookings by message');
    assert.equal(ok.area, 'Palawan, Philippines');
    assert.equal(ok.label, 'A family-run resort in…', 'whole words, never mid-word');
  }
  assert.ok('error' in normalizeHuntInput({ kind: 'companies', query: 'm' }), 'one letter is a typo, searched as typed');
  assert.ok('error' in normalizeHuntInput({ kind: 'agent', query: 'organisers of medieval fairs' }), 'the planner never writes an agent search — that is a proposal, one tap from handed over');
  assert.equal(labelFor('gift shops'), 'Gift shops');
  assert.ok(sameHunt('Gift shops!', 'gift  shops'), 'the same search in other punctuation is the same search');

  // 2. The query as the index gets it.
  assert.equal(exaCategoryFor('companies'), 'company');
  assert.equal(exaCategoryFor('people'), 'people');
  assert.equal(exaCategoryFor('agent'), null, 'an old agent row is not run');
  assert.equal(exaQueryFor({ query: 'museum shops', area: 'Castilla-La Mancha, Spain' }), 'museum shops in Castilla-La Mancha, Spain');
  assert.equal(exaQueryFor({ query: 'gift shops in Toledo', area: 'Toledo' }), 'gift shops in Toledo', 'the place is not written twice');

  // 3. Search hits into candidates: the company, never the directory it is listed in.
  const hunt = { id: 'h1', kind: 'companies' as const, query: 'shops that stock handmade jewellery', label: 'Jewellery stockists' };
  const cands = candidatesFromHits([
    { title: 'Joyería El Greco | Joyas artesanales en Toledo', url: 'https://www.joyeriaelgreco.es/', summary: 'Family jeweller in Toledo selling handmade silver.' },
    { title: 'Joyería El Greco', url: 'https://joyeriaelgreco.es', summary: 'Duplicate of the same site.' },
    { title: 'Home', url: 'https://plata-y-oro.es/tienda' },
    { title: 'Best jewellers in Toledo - Tripadvisor', url: 'https://www.tripadvisor.com/Attractions-Toledo' },
    { title: 'Facebook page', url: 'https://facebook.com/joyeria' },
    { title: 'Bad', url: 'javascript:alert(1)' },
  ], hunt);
  assert.deepEqual(cands.map((c) => c.title), ['Joyería El Greco', 'Plata Y Oro'], 'deduped, directories and social pages dropped, "Home" named by its domain');
  assert.equal(cands[0].external_id, 'joyeriaelgreco.es', 'www and the trailing slash are not a second company');
  assert.equal(cands[0].source, 'web');
  assert.equal(cands[0].type, 'client');
  assert.deepEqual([cands[0].data.hunt_id, cands[0].data.hunt_label, cands[0].data.segment, cands[0].data.host], ['h1', 'Jewellery stockists', 'shops that stock handmade jewellery', 'joyeriaelgreco.es']);
  assert.equal(urlKey('https://www.a.es/b/?utm=1#x'), 'a.es/b');
  assert.equal(companyFromTitle('Inicio', 'casa-lopez.com'), 'Casa Lopez');
  const people = candidatesFromHits([{ title: 'Carmen López - Compradora - El Corte Inglés | LinkedIn', url: 'https://es.linkedin.com/in/carmen-lopez' }], { ...hunt, kind: 'people' as const });
  assert.equal(people[0].type, 'people');
  assert.equal(people[0].title, 'Carmen López');
  assert.equal(people[0].data.role, 'Compradora · El Corte Inglés');
  assert.deepEqual(personFromTitle('Ana Ruiz'), { name: 'Ana Ruiz', role: null });

  // 4. The page, read for a way to reach them — deterministically.
  const page = `<a href="mailto:info&#64;joyeriaelgreco.es">Mail</a> <img src="logo@2x.png"> <a href="https://wa.me/34600111222">WhatsApp</a>
    <a href="https://instagram.com/joyeriaelgreco/">IG</a> <a href="/contacto">Contacto</a> <a href="https://other.es/contact">x</a>`;
  assert.deepEqual(contactFromHtml(page), { email: 'info@joyeriaelgreco.es', whatsapp: '34600111222', instagram: 'https://instagram.com/joyeriaelgreco' });
  assert.equal(contactFromHtml('<p>Write to ventas@plata.es or noreply@plata.es</p>').email, 'ventas@plata.es');
  assert.equal(contactFromHtml('<script>x="a@sentry.io"</script><p>no address here</p>').email, undefined, 'script text is not the page');
  assert.equal(contactPageLink(page, 'https://joyeriaelgreco.es/'), 'https://joyeriaelgreco.es/contacto', 'same host only');
  const merged = withPageContact(cands[0], { email: 'info@joyeriaelgreco.es' });
  assert.equal(merged.contact.email, 'info@joyeriaelgreco.es');
  assert.equal(merged.contact.website, 'https://www.joyeriaelgreco.es/', 'nothing the page did not show is added or replaced');

  // 5. What this app will open. The link came from outside, so a hostile one must not reach inside.
  for (const good of ['https://joyeriaelgreco.es/', 'http://172.40.1.1/x', 'https://es.linkedin.com/in/a']) assert.equal(isPublicHttpUrl(good), true, good);
  for (const bad of ['http://localhost:3000', 'http://127.0.0.1/', 'http://2130706433/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/', 'http://172.20.1.1/', 'http://192.168.1.1/', 'ftp://a.es/', 'http://intranet/', 'http://user:pw@a.es/', 'http://printer.local/', 'http://100.64.0.1/']) {
    assert.equal(isPublicHttpUrl(bad), false, bad);
  }

  // 6. What each search has brought in, counted from the rows — below the bar counts as unwanted.
  const y = huntYield([
    { hunt_id: 'h1', status: 'new', drafted: false },
    { hunt_id: 'h1', status: 'new', drafted: true },
    { hunt_id: 'h1', status: 'dismissed', drafted: false },
    { hunt_id: 'h1', status: 'new', drafted: false, below: true },
    { hunt_id: 'h1', status: 'acted', drafted: false },
  ]);
  assert.deepEqual(y.h1, { found: 5, waiting: 1, drafted: 2, binned: 1, below: 1 });

  // 7. Keeping the plan honest. A search that has shown what it is worth is
  //    retired — a row the user wrote on the old sheet too, since nothing on
  //    screen can stop it now — and stays on file so its words are not planned again.
  const row = (h: Partial<HuntH>): HuntH => ({
    id: 'x', kind: 'companies', query: 'q', area: null, label: 'Q', status: 'active', origin: 'suggested', commission_id: null,
    last_run_at: '2026-09-25T03:00:00Z', last_found: 6, last_dropped: null, last_error: null, created_at: '2026-09-15T00:00:00Z', ...h,
  });
  const flat = { found: 0, waiting: 0, drafted: 0, binned: 0, below: 0 };
  const spent = spentHunts([
    row({ id: 'unwanted' }),
    row({ id: 'mine', origin: 'user' }),
    row({ id: 'working' }),
    row({ id: 'empty', last_found: 0 }),
    row({ id: 'young', last_found: 0, created_at: '2026-09-24T00:00:00Z' }),
    row({ id: 'off', status: 'paused' }),
  ], {
    unwanted: { ...flat, found: HUNT_BIN_FLAG, binned: 5, below: HUNT_BIN_FLAG - 5 },
    mine: { ...flat, found: 20, binned: 20 },
    working: { ...flat, found: 12, binned: 9, drafted: 1 },
  }, now);
  assert.deepEqual(spent.map((x) => x.id), ['unwanted', 'mine', 'empty'], 'a search that led to a draft, a young one and a retired one are kept; the user\'s old row is judged like any other');
  assert.match(spent[0].why, /^Retired: 8 found, none worth drafting/);
  assert.equal(spent[1].why, 'Retired: 20 found, none worth drafting');
  assert.equal(spent[2].why, 'Retired: found nothing');
  assert.ok(HUNT_GRACE_DAYS >= 2, 'a new search gets a few nights before it is judged empty');
  assert.equal(huntsNeeded([row({}), row({ status: 'paused' }), row({ kind: 'agent' })]), AUTO_HUNTS - 1, 'paused and old agent rows do not fill a slot');
  assert.equal(huntsNeeded([row({}), row({}), row({}), row({})]), 0);

  // 8. The plan: web kinds only, never the same words twice, never more than there are slots.
  const plan = parsePlan({ hunts: [
    { kind: 'companies', query: 'a family-run resort in Palawan that takes bookings by message', area: 'Palawan, Philippines', label: 'Palawan resorts' },
    { kind: 'companies', query: 'A family-run resort in Palawan that takes bookings by message!' },
    { kind: 'agent', query: 'exhibitor lists of travel fairs in Manila' },
    { kind: 'people', query: 'Staycation & resorts' },
    { kind: 'people', query: 'the owner of a pest control company in Metro Manila with a small team', area: 'Manila, Philippines' },
    { kind: 'companies', query: 'a plumbing contractor in Quezon City that quotes by phone' },
  ] }, ['Staycation & resorts'], 2);
  assert.deepEqual(plan.map((p) => `${p.kind}:${p.query}`), ['companies:a family-run resort in Palawan that takes bookings by message', 'people:the owner of a pest control company in Metro Manila with a small team']);
  const fallback = planFromOffer({ sells: 'Booking automation', for_who: 'Staycation & resorts, pest control and plumbing' }, 'Manila, Philippines', ['pest control']);
  assert.deepEqual(fallback.map((p) => `${p.kind}:${p.query}`), ['companies:Staycation & resorts', 'companies:plumbing', 'people:owners and buyers at Staycation & resorts'].slice(0, AUTO_HUNTS));
  assert.ok(fallback.every((p) => p.area === 'Manila, Philippines'));
  assert.deepEqual(planFromOffer({}, null, []), [], 'nothing is planned from nothing (invariant 1)');
  assert.deepEqual(buyersOf({ for_who: 'cafés, gyms and salons; spas / bars y ok' }), ['cafés', 'gyms', 'salons', 'spas', 'bars'], 'split the way people list them; a two-letter fragment is not a buyer');
  // Nothing live and nothing to add is said, never returned as an empty run that reads as a quiet night.
  assert.equal(noPlanReason({ sells: 'Booking automation' }), 'nothing to look for — your offer does not say who buys it', 'the one thing the user can change, named');
  assert.match(noPlanReason({ sells: 'Booking automation', for_who: 'resorts' }), /^every search it could think of was tried/);
  assert.equal(noPlanReason({ sells: 'x', for_who: 'resorts' }, 'rate limited'), 'could not work out what to look for (rate limited)', 'a model that failed is the cause, whatever the offer says');
  for (const r of [noPlanReason({ sells: 'x' }), noPlanReason({ sells: 'x', for_who: 'resorts' }), noPlanReason({ sells: 'x' }, 'e'.repeat(500))]) {
    assert.ok(`Web search failed last run: ${r}`.length <= 120, `fits the Scout line whole: ${r}`);
  }
  const prompt = planPrompt({ offer: { sells: 'Booking automation', for_who: 'resorts' }, area: 'Manila', working: '', goals: ['Revenue'], existing: ['pest control'] });
  assert.ok(prompt.includes('Already searched (do not repeat): pest control'));
  assert.ok(/not "Palawan resort booking automation buyer"/.test(PLAN_SYSTEM), 'a query describes the page, it is not a list of keywords');

  // 9. A web find reads as what it is: the search's short name and the site, or a person's role.
  const feed = matchFeedH({
    now, targetSegments: ['pest control'], triage: [], moves: [],
    pipeline: [
      bizV2({ id: 'w1', title: 'w1', source: 'web', contact: { email: 'x@a.es' }, created_at: '2026-09-25T03:00:00Z', data: { hunt_id: 'h1', hunt_label: 'Palawan resorts', segment: 'a family-run resort in Palawan', host: 'a.es' } }),
      bizV2({ id: 'p1', title: 'p1', source: 'web', type: 'people', contact: {}, url: 'https://linkedin.com/in/p1', created_at: '2026-09-25T03:00:00Z', data: { hunt_id: 'h3', hunt_label: 'Resort owners', role: 'Owner · Casa Blanca Resort', host: 'linkedin.com' } }),
    ],
  });
  const byId = Object.fromEntries(feed.map((i) => [i.id, i]));
  assert.equal(byId.w1.sub, 'Palawan resorts · a.es');
  assert.equal(byId.p1.sub, 'Owner · Casa Blanca Resort · linkedin.com');

  // 10. The chain's "who buys" says the web is searched too, without a word of configuration.
  const { businessChain: bc } = await import('../../src/lib/copilot/business');
  const flatC = {
    offer: { sells: 'Booking bots' }, said: {}, funnel: { matched: 12, sent: 0, replied: 0, meetings: 0, won: 0, outside: 0 }, worthAMessage: 0,
    bySegment: [], byChannel: [], wins: [], queue: 0, wonRecent: { amount: 0, days: 30 }, goal: null, currency: '$', workerConnected: true, agents: [], topOpening: null,
  };
  const whoOf = (x: Partial<Parameters<typeof bc>[0]>) => bc({ ...flatC, segments: [], area: null, web: false, ...x }).links[0];
  assert.equal(whoOf({ segments: ['pest control'], area: 'Manila', web: true }).facts, '12 found on Maps and the web');
  assert.equal(whoOf({ web: true }).facts, '12 found on the web');
  assert.equal(whoOf({ funnel: { ...flatC.funnel, matched: 0 }, foundBy: 'outreach' }).facts, 'Nothing to look for yet');
  // Nothing found, sent or said: not outreach by default. Read through what the person logs, and the chain asks how buyers find them.
  assert.equal(whoOf({ funnel: { ...flatC.funnel, matched: 0 } }).facts, 'Nothing logged yet');
  assert.deepEqual(bc({ ...flatC, segments: [], area: null, web: false, funnel: { ...flatC.funnel, matched: 0 } }).links[1].moves.map((m) => m.go), [{ sheet: 'foundby' }]);
  console.log('copilot-core: hunts checks passed');
}

huntsCore().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// The Path tab: one stream — what moved above, you are here, what comes next.
//
// The checks: only what moved something is in the past, and nothing the
// ledger cannot prove; the ladder is counted, never estimated; the next steps
// are the planner's and nothing is invented to fill them; the week counts what
// you did, not that you opened the app.
// ---------------------------------------------------------------------------
import { MAX_PAST, REPEAT_WINS, callName, pathEvents, pathLadder, pathNext, pathPast, pathWeek } from '../../src/lib/copilot/pathway';

async function pathwayCore() {
  const now = new Date('2026-09-26T10:00:00Z');
  const tz = 'UTC';
  const execP = (id: string, created_at: string, sent_at: string | null) => ({ id, created_at, sent_at, channel: 'whatsapp', approval_state: sent_at ? 'sent' : 'drafted' }) as never;
  const pipeline = [
    { ...bizV2({ id: 'f1', title: 'Casa Blanca Resort', created_at: '2026-09-25T04:00:00Z', scored_at: '2026-09-25T05:00:00Z', fit_score: 80 }), execution: execP('e1', '2026-09-25T06:00:00Z', '2026-09-25T11:00:00Z'), stage: 'sent' as const },
    bizV2({ id: 'f2', title: 'Bayview Resort', created_at: '2026-09-25T04:10:00Z', scored_at: '2026-09-25T05:00:00Z', fit_score: 72 }),
    bizV2({ id: 'f3', title: 'Tubero Plumbing', created_at: '2026-09-25T04:20:00Z', scored_at: '2026-09-25T05:00:00Z', fit_score: 30 }),
    bizV2({ id: 'old', title: 'Old Find', created_at: '2026-09-10T04:00:00Z' }),
  ];
  const queue = [
    { id: 'a1', execution: execP('q1', '2026-09-26T07:00:00Z', null), opp: { id: 'f2', title: 'Bayview Resort', name: null, segment: null, score: 70 } },
    { id: 'a2', execution: execP('q2', '2026-09-26T07:01:00Z', null), opp: { id: 'x', title: 'Palm Cove', name: null, segment: null, score: 70 } },
  ] as never[];
  const outcome = (o: Record<string, unknown>) => ({ id: 'o', kind: 'reply', amount: null, currency: null, note: null, source: 'system', occurred_at: '2026-09-26T09:00:00Z', opportunity_id: null, commission_id: null, who: null, ...o }) as never;
  const outcomes = [
    outcome({ id: 'r1', who: 'Casa Blanca Resort' }),
    outcome({ id: 'w1', kind: 'won', amount: 900, currency: '$', who: 'Bayview Resort', source: 'manual', occurred_at: '2026-09-24T15:30:00Z' }),
    outcome({ id: 'c1', kind: 'won', commission_id: 'pc', who: 'A mandate', occurred_at: '2026-09-25T15:00:00Z' }),
    outcome({ id: 'n1', kind: 'no_reply', who: 'Nobody', occurred_at: '2026-09-25T15:00:00Z' }),
  ];
  const focus = [{ id: 'fo1', minutes: 180, on: '2026-09-25', note: 'the booking app', at: '2026-09-26T08:00:00Z' }];
  const thread = (c: Record<string, unknown>, did: Array<{ at: string; summary: string }> = [], progress = { done: 0, total: 0 }) =>
    ({ commission: { id: 'c', objective: 'Compare signage suppliers', status: 'active', closed_at: null, last_run_at: null, outcome: null, ...c }, report: { did, yours: [], progress }, line: '' }) as never;
  const commissions = [
    thread({ id: 'done-w', status: 'done', closed_at: '2026-09-25T18:00:00Z', last_run_at: '2026-09-25T18:00:10Z', outcome: '4 found, 2 list prices' }),
    thread({ id: 'done-h', status: 'done', objective: 'Closed by hand', closed_at: '2026-09-25T18:00:00Z', last_run_at: '2026-09-20T18:00:00Z' }),
    thread({ id: 'run', objective: 'Shortlist spa resorts' }, [{ at: '2026-09-26T06:00:00Z', summary: 'Found 6 with a booking page' }], { done: 1, total: 3 }),
  ];
  const decision = (o: Record<string, unknown>) => ({ id: 'd', for_date: '2026-09-22', headline: 'Clear the queue', response: 'did', verify: { metric: 'sent', baseline: 0, after: 3, verifiedAt: '2026-09-25T09:00:00Z' }, ...o }) as never;
  const decisions = [decision({ id: 'd1' }), decision({ id: 'd2', response: 'pending', verify: { metric: 'sent', baseline: 0, after: null, verifiedAt: null } })];
  const answered = [
    { id: 'm1', job: 'goal_gap', kind: 'earn', headline: 'Quote the Bayview upsell', status: 'done', acted_at: '2026-09-24T12:00:00Z' },
    { id: 'm2', job: 'goal_gap', kind: 'earn', headline: 'Dismissed thing', status: 'dismissed', acted_at: '2026-09-24T12:00:00Z' },
    { id: 'm3', job: 'watch', kind: 'earn', headline: 'A feed find kept', status: 'done', acted_at: '2026-09-24T12:00:00Z' },
  ] as never[];
  const watchMoves = [{ id: 'w1', job: 'watch', created_at: '2026-09-26T05:00:00Z' }, { id: 'w2', job: 'watch', created_at: '2026-09-26T05:30:00Z' }] as never[];
  const input = { now, timezone: tz, pipeline: pipeline as never[], queue, outcomes, answered, focus, commissions, decisions, watchMoves };

  // 1. The past is what teaches something: answers, payments, verdicts, results, hours.
  const ev = pathEvents(input);
  const titles = ev.map((e) => e.title);
  assert.ok(!ev.some((e) => ['scout', 'watcher', 'writer', 'send'].includes(e.icon)), `finds, flags, drafts and sends are activity, not evidence: ${titles.join(' | ')}`);
  assert.equal(ev.find((e) => e.title === 'Casa Blanca Resort replied')!.detail, 'Matched to what you sent');
  assert.ok(titles.includes('Bayview Resort paid $900'));
  assert.ok(!titles.includes('A mandate paid') && !titles.some((t) => t.includes('Nobody')), 'a mandate’s own ledger row and an inferred no-reply are not events');
  assert.ok(titles.includes('Finished: Compare signage suppliers') && !titles.includes('Finished: Closed by hand'), 'only a finish the worker posted is a result');
  assert.ok(!titles.includes('Shortlist spa resorts'), 'a project’s progress is its own story, told in its thread');
  assert.ok(titles.includes('Tuesday’s call worked') && ev.filter((e) => e.icon === 'call').length === 1, 'only a call the ledger read back');
  assert.equal(ev.find((e) => e.icon === 'call')!.detail, '“Clear the queue” · sent 0 → 3');
  const hours = ev.find((e) => e.icon === 'focus')!;
  assert.equal(hours.title, '3h on the booking app');
  assert.equal(hours.day, '2026-09-25', 'hours belong to the day they were worked, not the day they were typed');
  assert.equal(hours.timed, false);
  assert.ok(!titles.includes('Quote the Bayview upsell'), 'a suggestion ticked off teaches nothing until its call is graded');
  assert.ok(!titles.some((t) => /\b(ran|running|checked|found|drafted|sent)\b/i.test(t)), 'nothing reports activity — that is the log');
  assert.deepEqual([...ev].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map((e) => e.key), ev.map((e) => e.key), 'oldest first');
  assert.ok(ev.every((e) => e.actor === 'ai' || e.actor === 'you' || e.actor === 'world'));
  assert.equal(ev.find((e) => e.title.includes('replied'))!.actor, 'world', 'an answer from outside is neither the app nor you');
  // A fortnight, not a week: answers are rarer than activity.
  const older = pathEvents({ ...input, outcomes: [outcome({ id: 'r9', who: 'Old Reply', occurred_at: '2026-09-15T09:00:00Z' }), outcome({ id: 'r0', who: 'Too Old', occurred_at: '2026-09-10T09:00:00Z' })] });
  assert.ok(older.some((e) => e.title === 'Old Reply replied') && !older.some((e) => e.title === 'Too Old replied'));
  assert.deepEqual(pathPast({ ...input, outcomes: [outcome({ id: 'r9', who: 'Old Reply', occurred_at: '2026-09-15T09:00:00Z' }), outcome({ id: 'r8', who: 'This Week', occurred_at: '2026-09-22T09:00:00Z' })], focus: [], commissions: [], decisions: [] }).days.map((d) => d.label),
    ['Tue 15 Sep', 'Tue'], 'past this week a weekday names two days, so it carries the date');

  // 2. Grouped by the person's own days, with the words they would use.
  const past = pathPast(input);
  assert.deepEqual(past.days.map((d) => d.label), ['Thu', 'Yesterday', 'Today']);
  assert.ok(past.days[1].events.some((e) => e.icon === 'focus'), 'Friday’s hours sit under Friday');
  assert.equal(past.earlier, Math.max(0, ev.length - MAX_PAST));
  const short = pathPast(input, 2);
  assert.equal(short.earlier, ev.length - 2, 'the rest waits behind Show earlier');
  assert.equal(short.days.flatMap((d) => d.events).length, 2);
  assert.equal(callName('2026-09-26', '2026-09-26'), 'Today’s call');
  assert.equal(callName('2026-09-25', '2026-09-26'), 'Yesterday’s call');
  assert.equal(callName('2026-09-21', '2026-09-26'), 'Monday’s call');

  // 3. The ladder is counted from the funnel. Where you are is the first rung not reached.
  const blank = pathLadder({ offerSet: false, sent: 0, replied: 0, won: 0, goal: null, currency: '$' });
  assert.equal(blank.current, 0);
  assert.equal(blank.steps[0].state, 'current');
  assert.ok(blank.steps.slice(1).every((s) => s.state === 'next'));
  assert.equal(blank.steps[5].title, 'Name your goal', 'with no goal, naming it is the step');
  assert.deepEqual(blank.steps.map((s) => s.input), ['offer', null, null, null, null, 'goal'], 'the two rungs that are yours to write, not to earn');
  const mid = pathLadder({ offerSet: true, sent: 41, replied: 7, won: 2, goal: { title: '$12,000 from resorts', target: 12000, current: 1800, money: true, unit: '$' }, currency: '$' });
  assert.equal(mid.current, 4);
  assert.deepEqual(mid.steps.map((s) => s.state), ['done', 'done', 'done', 'done', 'current', 'next']);
  assert.deepEqual(mid.steps[4].progress, { done: 2, of: REPEAT_WINS });
  assert.equal(mid.steps[1].detail, '41 messages sent so far');
  assert.equal(mid.steps[2].detail, '7 replies so far');
  assert.equal(mid.steps[3].detail, '2 clients so far');
  assert.equal(mid.steps[5].detail, '$1,800 of $12,000');
  assert.deepEqual(mid.steps[5].progress, { done: 1800, of: 12000 });
  assert.ok(mid.steps.slice(0, 4).every((s) => s.progress === null), 'a done rung shows no fraction, and none is invented for a rung with no count');
  const early = pathLadder({ offerSet: false, sent: 3, replied: 1, won: 0, goal: null, currency: '$' });
  assert.equal(early.current, 0, 'a reply before the offer does not make the offer optional');
  const all = pathLadder({ offerSet: true, sent: 90, replied: 20, won: 5, goal: { title: 'Goal', target: 1000, current: 1500, money: true, unit: '$' }, currency: '$' });
  const clients = pathLadder({ offerSet: true, sent: 9, replied: 2, won: 1, goal: { title: 'Ten retainers', target: 10, current: 1, money: false, unit: 'clients' }, currency: '$' });
  assert.equal(clients.steps[5].detail, '1 of 10 clients', 'a goal counted in clients is not written as money');
  assert.equal(all.current, 5);
  assert.equal(all.steps[5].state, 'current');
  assert.equal(all.steps[5].detail, 'Reached — set the next one');
  assert.ok(mid.steps.every((s) => s.input === null), 'nothing left to write once the offer and the goal exist');

  // 4. What comes next is the planner's, in its order, and nothing is invented to fill it.
  const move = (o: Record<string, unknown>) => ({ id: 'mv', job: 'goal_gap', kind: 'earn', headline: 'Quote Casa Blanca', artifact: { kind: 'message', value: 'Hi', label: 'Send' }, cost_label: '10 min', created_at: '2026-09-26T05:00:00Z', ...o }) as never;
  const nx = pathNext({
    moves: [
      move({ id: 'm1' }),
      move({ id: 'p1', headline: 'Shortlist 20 spa resorts', artifact: { kind: 'plan', value: '1. Search\n2. Check booking pages', label: 'Hand it over' } }),
      move({ id: 'w1', job: 'watch' }),
      move({ id: 's1', job: 'send_queue' }),
    ],
    commissions: [
      thread({ id: 'run', objective: 'Shortlist spa resorts' }, [], { done: 1, total: 3 }),
      thread({ id: 'blk', status: 'blocked', objective: 'Stuck on you' }),
      thread({ id: 'drf', status: 'draft', objective: 'Not approved yet' }),
    ],
  });
  assert.deepEqual(nx.steps.map((s) => `${s.kind}:${s.id}`), ['move:m1', 'offer:p1', 'project:run']);
  assert.equal(nx.steps[0].actor, 'you');
  assert.equal(nx.steps[0].detail, 'Earn · drafted · 10 min');
  assert.equal(nx.steps[1].actor, 'ai');
  assert.equal(nx.steps[1].plan, '1. Search\n2. Check booking pages', 'a plan is approved with the plan on screen, never behind it');
  assert.equal(nx.steps[2].detail, 'Under way · 1 of 3 steps done');
  assert.deepEqual(nx.steps.map((s) => s.icon), ['send', 'research', 'research'], 'a drafted message is a send; work the app does is research');
  assert.equal(pathNext({ moves: [move({ id: 'd1', kind: 'decide', artifact: { kind: 'text', value: 'v', label: 'Read it' } })], commissions: [] }).steps[0].icon, 'call');
  assert.equal(pathNext({ moves: [], commissions: [] }).steps.length, 0, 'nothing beyond the call is said as nothing');
  const capped = pathNext({ moves: [move({ id: 'a' }), move({ id: 'b' }), move({ id: 'c' })], commissions: [] }, 2);
  assert.equal(capped.steps.length, 2);
  assert.equal(capped.more, 1);

  // 5. The week counts what the ledger can prove you did.
  const week = pathWeek({
    now, timezone: tz,
    sentAt: ['2026-09-25T11:00:00Z', '2026-09-24T09:00:00Z'],
    outcomes: [outcome({ id: 'x1', source: 'manual', occurred_at: '2026-09-23T09:00:00Z' }), outcome({ id: 'x2', source: 'system', occurred_at: '2026-09-21T09:00:00Z' })],
    answered: [{ id: 'm1', job: 'goal_gap', kind: 'earn', headline: 'h', status: 'done', acted_at: '2026-09-26T08:00:00Z' }] as never[],
  });
  assert.deepEqual(week.days.map((d) => d.day), ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']);
  assert.deepEqual(week.days.map((d) => d.moved), [false, false, false, true, true, true, true], 'a reply the app matched on its own is not something you did');
  assert.equal(week.days[6].today, true);
  assert.equal(week.days[6].letter, 'S');
  assert.equal(week.streak, 4);
  const openDay = pathWeek({ now, timezone: tz, sentAt: ['2026-09-25T11:00:00Z', '2026-09-24T09:00:00Z'], outcomes: [], answered: [] });
  assert.equal(openDay.streak, 2, 'a streak is not broken at nine in the morning');
  assert.equal(pathWeek({ now, timezone: tz, sentAt: ['2026-09-23T11:00:00Z'], outcomes: [], answered: [] }).streak, 0);

  console.log('copilot-core: pathway checks passed');
}

pathwayCore().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// The Path, part two: the plan says when it was redrawn, and why each step
// left; a rung is dated by the row that reached it; and the one suggestion
// on the stream is two facts side by side, never a verdict on the hours.
// ---------------------------------------------------------------------------
import { FIRST_WINS } from '../../src/lib/copilot/diagnose';
import {
  MAX_GONE, SWAP_HOURS, SWAP_KEEP_DAYS, parseSeenPlan, pathSwap, planChanges, snapshotPlan, swapKept,
} from '../../src/lib/copilot/pathway';

async function pathwayRedraw() {
  const now = new Date('2026-09-26T10:00:00Z'); // a Saturday
  const tz = 'UTC';

  // 1. The firsts come off the same rows as the counts, all time.
  {
    const dx = diagnose({
      opportunities: [],
      executions: [
        { approval_state: 'sent', channel: 'whatsapp', opportunity_id: 'a', sent_at: '2026-08-02T10:00:00Z' },
        { approval_state: 'sent', channel: 'whatsapp', opportunity_id: 'b', sent_at: '2026-07-30T10:00:00Z' },
        { approval_state: 'sent', channel: 'email', opportunity_id: 'c', sent_at: null },
        { approval_state: 'drafted', channel: 'email', opportunity_id: 'd', sent_at: '2026-07-01T10:00:00Z' },
      ] as never[],
      outcomes: [
        { kind: 'reply', opportunity_id: 'a', occurred_at: '2026-09-20T10:00:00Z' },
        { kind: 'reply', opportunity_id: 'a', occurred_at: '2026-08-05T10:00:00Z' },
        { kind: 'won', opportunity_id: 'a', occurred_at: '2026-09-01T10:00:00Z' },
        { kind: 'won', opportunity_id: 'b', occurred_at: '2026-08-20T10:00:00Z' },
        { kind: 'won', opportunity_id: 'c', occurred_at: '2026-09-24T10:00:00Z' },
        { kind: 'won', opportunity_id: 'c', occurred_at: '2026-09-25T10:00:00Z' },
      ] as never[],
      offer: {},
    });
    assert.equal(dx.firsts?.sent, '2026-07-30T10:00:00Z', 'a draft is not a send, however early');
    assert.equal(dx.firsts?.reply, '2026-08-05T10:00:00Z', 'the first reply, not the latest');
    assert.deepEqual(dx.firsts?.wins, ['2026-08-20T10:00:00Z', '2026-09-01T10:00:00Z', '2026-09-24T10:00:00Z']);
    assert.ok(FIRST_WINS >= REPEAT_WINS, 'the diagnosis dates as many wins as the ladder’s repeat rung needs');
    const none = diagnose({ opportunities: [], executions: [], outcomes: [], offer: {} });
    assert.deepEqual(none.firsts, { sent: null, reply: null, wins: [] });
  }

  // 2. A rung reached this week is a moment in the stream, straight under the row that reached it.
  const exec = (id: string, created_at: string, sent_at: string | null) => ({ id, created_at, sent_at, channel: 'whatsapp', approval_state: sent_at ? 'sent' : 'drafted' }) as never;
  const outcome = (o: Record<string, unknown>) => ({ id: 'o', kind: 'reply', amount: null, currency: null, note: null, source: 'system', occurred_at: '2026-09-26T09:00:00Z', opportunity_id: null, commission_id: null, who: null, ...o }) as never;
  const base = {
    now, timezone: tz,
    pipeline: [
      { ...bizV2({ id: 'b1', title: 'Casa Blanca Resort', created_at: '2026-09-23T04:00:00Z' }), execution: exec('e1', '2026-09-23T06:00:00Z', '2026-09-24T08:00:00Z'), stage: 'sent' as const },
      { ...bizV2({ id: 'b2', title: 'Bayview Resort', created_at: '2026-09-23T04:00:00Z' }), execution: exec('e2', '2026-09-23T06:00:00Z', '2026-09-24T17:00:00Z'), stage: 'sent' as const },
    ] as never[],
    queue: [] as never[],
    outcomes: [
      outcome({ id: 'r1', who: 'Casa Blanca Resort', occurred_at: '2026-09-25T09:00:00Z' }),
      outcome({ id: 'w1', kind: 'won', amount: 900, currency: '$', who: 'Bayview Resort', source: 'manual', occurred_at: '2026-09-26T08:00:00Z' }),
      outcome({ id: 'cw', kind: 'won', commission_id: 'pc', who: 'A mandate', occurred_at: '2026-09-25T15:00:00Z' }),
    ],
    answered: [] as never[], focus: [], commissions: [] as never[], decisions: [] as never[], watchMoves: [] as never[],
  };
  {
    const ev = pathEvents({ ...base, firsts: { sent: '2026-09-24T08:00:00Z', reply: '2026-09-25T09:00:00Z', wins: ['2026-09-26T08:00:00Z'] } });
    const keys = ev.map((e) => e.key);
    const after = (k: string) => keys[keys.indexOf(k) + 1];
    assert.equal(after('o:r1'), 'rung:reply');
    assert.equal(after('o:w1'), 'rung:paid');
    const sent = ev.find((e) => e.key === 'rung:sent')!;
    assert.equal(sent.title, 'First message sent');
    assert.equal(sent.detail, 'Where the path starts');
    assert.equal(sent.rung, 'sent');
    assert.equal(sent.icon, 'star');
    assert.equal(sent.timed, true, 'a send on its own is not evidence, so the moment stands alone and carries its own time');
    assert.equal(sent.at, '2026-09-24T08:00:00Z');
    assert.equal(sent.target, null);
    const reply = ev.find((e) => e.key === 'rung:reply')!;
    assert.equal(reply.timed, false, 'the reply above it carries the time');
    assert.deepEqual(reply.target, { kind: 'matches', stage: 'replied' }, 'it opens what its cause opens');
    assert.equal(ev.find((e) => e.key === 'rung:paid')!.detail, '2 days after your first message', 'how long it took, never a step number');
    assert.equal(ev.find((e) => e.key === 'rung:reply')!.detail, '1 day after your first message');
    const past = pathPast({ ...base, firsts: { sent: '2026-09-24T08:00:00Z', reply: '2026-09-25T09:00:00Z', wins: ['2026-09-26T08:00:00Z'] } });
    assert.deepEqual(past.reached, ['sent', 'reply', 'paid'], 'the rungs drawn where they happened, which the done rungs above leave out');
  }
  {
    // A first reply a month ago: this week's reply is a reply, not a milestone.
    const ev = pathEvents({ ...base, firsts: { sent: '2026-08-01T08:00:00Z', reply: '2026-08-25T09:00:00Z', wins: ['2026-08-20T10:00:00Z', '2026-09-01T10:00:00Z', '2026-09-26T08:00:00Z'] } });
    assert.ok(!ev.some((e) => e.key === 'rung:sent' || e.key === 'rung:reply' || e.key === 'rung:paid'), 'only what was first this week is marked');
    const keys = ev.map((e) => e.key);
    assert.equal(keys[keys.indexOf('o:w1') + 1], 'rung:repeat', 'the third win is the repeat rung');
    assert.equal(ev.find((e) => e.key === 'rung:repeat')!.title, `${REPEAT_WINS} paying clients`);
  }
  {
    // Another answer logged at the payment's instant does not come between the payment and its step.
    const busy = { ...base, outcomes: [...base.outcomes, outcome({ id: 'r2', who: 'Palm Cove', occurred_at: '2026-09-26T08:00:00Z' })] };
    const keys = pathEvents({ ...busy, firsts: { sent: null, reply: null, wins: ['2026-09-26T08:00:00Z'] } }).map((e) => e.key);
    assert.ok(keys.includes('o:r2'));
    assert.equal(keys[keys.indexOf('o:w1') + 1], 'rung:paid', 'placed under its cause, not sorted among equals');
  }
  {
    // The first win was a mandate's own row, which the stream does not show: the moment stands alone, timed.
    const ev = pathEvents({ ...base, firsts: { sent: null, reply: null, wins: ['2026-09-25T15:00:00Z'] } });
    const paid = ev.find((e) => e.key === 'rung:paid')!;
    assert.equal(paid.timed, true);
    assert.equal(paid.at, '2026-09-25T15:00:00Z');
    assert.equal(paid.target, null);
    assert.ok(!pathEvents(base).some((e) => e.rung), 'no firsts, no milestones — a count alone cannot date one');
    assert.deepEqual(pathPast(base).reached, []);
  }

  // 3. Every next step carries the planner's reason, and the whole list is kept for the redraw.
  {
    const move = (o: Record<string, unknown>) => ({ id: 'mv', job: 'goal_gap', kind: 'earn', headline: 'Quote Casa Blanca', why: ['$10,200 to go, and 60 days to do it in.', 'You set this one.'], artifact: { kind: 'message', value: 'Hi', label: 'Send' }, cost_label: '10 min', created_at: '2026-09-26T05:00:00Z', ...o }) as never;
    const thread = (c: Record<string, unknown>) => ({ commission: { id: 'c', objective: 'Shortlist spa resorts', status: 'active', why: 'Resorts reply twice as often.', closed_at: null, last_run_at: null, outcome: null, ...c }, report: { did: [], yours: [], progress: { done: 0, total: 0 } }, line: '' }) as never;
    const nx = pathNext({
      moves: [move({ id: 'a' }), move({ id: 'b', why: [] }), move({ id: 'c', why: ['  ', 'Second line counts.'] }), move({ id: 'p', artifact: { kind: 'plan', value: '1. Search', label: 'Hand it over' } })],
      commissions: [thread({ id: 'x' }), thread({ id: 'y', why: null })],
    }, 2);
    assert.equal(nx.steps[0].because, '$10,200 to go, and 60 days to do it in.');
    assert.equal(nx.steps[1].because, null, 'no reason is invented for a step that came without one');
    assert.deepEqual(nx.all.map((x) => x.key), ['m:a', 'm:b', 'm:c', 'o:p', 'p:x', 'p:y'], 'what is remembered is the whole plan, not the four on screen');
    const whole = pathNext({ moves: [move({ id: 'c', why: ['  ', 'Second line counts.'] })], commissions: [thread({ id: 'x' }), thread({ id: 'y', why: null })] });
    assert.deepEqual(whole.steps.map((x) => x.because), ['Second line counts.', 'Resorts reply twice as often.', null]);
  }

  // 4. The redraw, said — with what happened to each step that left.
  {
    const seen = (at: string, current: number, keys: string[]) => snapshotPlan(at, current, keys.map((key) => ({ key, title: `Title ${key}` })));
    const answered = [
      { id: 'b', job: 'goal_gap', kind: 'earn', headline: 'h', status: 'done', acted_at: '2026-09-25T12:00:00Z' },
      { id: 'c', job: 'goal_gap', kind: 'earn', headline: 'h', status: 'dismissed', acted_at: '2026-09-25T12:00:00Z' },
      { id: 'p', job: 'propose', kind: 'build', headline: 'h', status: 'done', acted_at: '2026-09-25T12:00:00Z' },
    ] as never[];
    const commissions = [
      { commission: { id: 'x', status: 'done' }, report: {}, line: '' },
      { commission: { id: 'z', status: 'stopped' }, report: {}, line: '' },
      { commission: { id: 'k', status: 'blocked' }, report: {}, line: '' },
    ] as never[];
    const ctx = { at: now, timezone: tz, answered, commissions, callMoveId: 'q' };
    const prev = seen('2026-09-25T07:00:00Z', 1, ['m:a', 'm:b', 'm:c', 'o:p', 'p:x', 'p:z', 'p:k', 'm:q', 'm:gone']);
    const ch = planChanges(prev, { ...ctx, all: [{ key: 'm:a', title: 'A' }, { key: 'm:new', title: 'N' }, { key: 'p:y', title: 'Y' }], current: 3 })!;
    assert.equal(ch.since, 'since yesterday');
    assert.deepEqual(ch.added, ['m:new', 'p:y']);
    assert.deepEqual(ch.gone.map((g) => g.why), ['You did it', 'You said no', 'Handed over']);
    assert.equal(ch.gone[0].title, 'Title m:b', 'named the way it was on screen');
    assert.equal(ch.goneMore, 8 - MAX_GONE);
    assert.deepEqual(ch.stepUp, { from: 2, to: 4 }, 'numbered the way the screen numbers them');
    const whys = planChanges(seen('2026-09-26T07:00:00Z', 1, ['p:x', 'p:z', 'p:k', 'm:q', 'm:gone', 'p:vanished']), { ...ctx, all: [], current: 1 })!;
    assert.equal(whys.since, 'since earlier today');
    assert.deepEqual(planChanges(seen('2026-09-26T07:00:00Z', 1, ['p:x', 'p:z', 'p:k']), { ...ctx, all: [], current: 1 })!.gone.map((g) => g.why), ['Finished', 'Called off', 'Waiting on you, above']);
    assert.deepEqual(planChanges(seen('2026-09-26T07:00:00Z', 1, ['m:q', 'm:gone', 'p:vanished']), { ...ctx, all: [], current: 1 })!.gone.map((g) => g.why), ['Now today’s call', 'The last run replaced it', 'Closed']);
    assert.equal(planChanges(seen('2026-09-23T07:00:00Z', 1, ['m:gone']), { ...ctx, all: [], current: 1 })!.since, 'since Wednesday');

    assert.equal(planChanges(null, { ...ctx, all: [{ key: 'm:a', title: 'A' }], current: 0 }), null, 'a first visit is not "everything is new"');
    assert.equal(planChanges(seen('2026-09-18T07:00:00Z', 0, ['m:gone']), { ...ctx, all: [], current: 0 }), null, 'older than the week the reasons are read from');
    assert.equal(planChanges(seen('2026-09-27T07:00:00Z', 0, ['m:gone']), { ...ctx, all: [], current: 0 }), null, 'a snapshot from the future is a broken clock, not a change');
    assert.equal(planChanges(seen('2026-09-25T07:00:00Z', 2, ['m:a']), { ...ctx, all: [{ key: 'm:a', title: 'A' }], current: 2 }), null, 'nothing changed is nothing said');
    assert.equal(planChanges(seen('2026-09-25T07:00:00Z', 3, ['m:a']), { ...ctx, all: [{ key: 'm:a', title: 'A' }], current: 2 }), null, 'a step down is not a step up');

    // What the device kept is read for its shape and nothing else.
    const round = parseSeenPlan(JSON.parse(JSON.stringify(prev)));
    assert.deepEqual(round, prev);
    assert.equal(parseSeenPlan(null), null);
    assert.equal(parseSeenPlan('x'), null);
    assert.equal(parseSeenPlan({ at: 'not a date', current: 0, steps: [] }), null);
    assert.equal(parseSeenPlan({ at: '2026-09-25T07:00:00Z', current: -1, steps: [] }), null);
    assert.equal(parseSeenPlan({ at: '2026-09-25T07:00:00Z', current: 1.5, steps: [] }), null);
    assert.deepEqual(parseSeenPlan({ at: '2026-09-25T07:00:00Z', current: 1, steps: [{ key: 'm:a', title: 'A' }, { key: 3 }, null] })!.steps, [{ key: 'm:a', title: 'A' }]);
    const long = snapshotPlan('2026-09-25T07:00:00Z', 0, Array.from({ length: 40 }, (_, i) => ({ key: `m:${i}`, title: 'x'.repeat(300) })));
    assert.equal(long.steps.length, 24);
    assert.equal(long.steps[0].title.length, 160);
  }

  // 5. The swap: hours next to what sending brought back — two facts, and only with the second.
  {
    const log = (id: string, minutes: number, on: string, note: string | null, at = `${on}T20:00:00Z`) => ({ id, minutes, on, note, at });
    const focus = [log('f1', 180, '2026-09-23', 'the booking app'), log('f2', 120, '2026-09-25', 'The Booking  App'), log('f0', 600, '2026-09-10', 'the booking app')];
    const swap = pathSwap({ now, timezone: tz, focus, sentAt: ['2026-09-24T08:00:00Z', '2026-09-25T08:00:00Z', '2026-09-01T08:00:00Z'], outcomes: [outcome({ id: 'r', occurred_at: '2026-09-25T09:00:00Z' }), outcome({ id: 'm', kind: 'reply', commission_id: 'pc' })], queueCount: 4 })!;
    assert.equal(swap.title, `Try ${SWAP_HOURS} of those hours on sending`);
    assert.equal(swap.detail, '5h on The Booking App this week. 2 messages sent, and 1 reply back.', 'a fortnight-old block and a mandate’s reply are not this week’s facts');
    assert.equal(swap.key, 'swap:the booking app', 'the same thing, however it was typed');
    assert.equal(swap.afterKey, 'f:f2', 'under the latest block on it');
    assert.deepEqual(swap.action, { label: 'Open the drafts', stage: 'to_send' });
    const wins = pathSwap({ now, timezone: tz, focus, sentAt: ['2026-09-24T08:00:00Z'], outcomes: [outcome({ id: 'r', occurred_at: '2026-09-25T09:00:00Z' }), outcome({ id: 'w', kind: 'won', occurred_at: '2026-09-25T10:00:00Z' }), outcome({ id: 'g', kind: 'meeting', occurred_at: '2026-09-25T11:00:00Z' })], queueCount: 0 })!;
    assert.equal(wins.detail, '5h on The Booking App this week. 1 message sent, and 1 reply, 1 meeting and 1 win back.');
    assert.deepEqual(wins.action, { label: 'See who to message', stage: 'new' });

    const waiting = pathSwap({ now, timezone: tz, focus, sentAt: [], outcomes: [], queueCount: 3 })!;
    assert.equal(waiting.title, 'Send the drafts first');
    assert.equal(waiting.detail, '5h on The Booking App this week, and nothing sent. 3 drafts are written and waiting.');
    assert.equal(pathSwap({ now, timezone: tz, focus, sentAt: [], outcomes: [], queueCount: 1 })!.detail.endsWith('1 draft is written and waiting.'), true);

    assert.equal(pathSwap({ now, timezone: tz, focus, sentAt: ['2026-09-24T08:00:00Z'], outcomes: [], queueCount: 2 }), null, 'sending with nothing back yet is no second fact');
    assert.equal(pathSwap({ now, timezone: tz, focus, sentAt: [], outcomes: [], queueCount: 0 }), null, 'nothing written to send: the call has it');
    assert.equal(pathSwap({ now, timezone: tz, focus: [log('s', 200, '2026-09-25', 'the booking app')], sentAt: [], outcomes: [], queueCount: 3 }), null, 'under four hours is not a pattern');
    assert.equal(pathSwap({ now, timezone: tz, focus: [log('o', 600, '2026-09-25', 'WhatsApp outreach'), log('p', 300, '2026-09-24', 'follow-ups')], sentAt: [], outcomes: [], queueCount: 3 }), null, 'hours on reaching people are the swap already made');
    assert.equal(pathSwap({ now, timezone: tz, focus: [log('u', 600, '2026-09-25', null)], sentAt: [], outcomes: [], queueCount: 3 }), null, 'unlabelled hours cannot be named back');

    // "Keep it" holds for a week from the tap, and anything else the device kept is no answer.
    assert.equal(swapKept({ 'swap:the booking app': '2026-09-26' }, 'swap:the booking app', '2026-09-26'), true);
    assert.equal(swapKept({ 'swap:the booking app': '2026-09-20' }, 'swap:the booking app', '2026-09-26'), true);
    assert.equal(swapKept({ 'swap:the booking app': '2026-09-19' }, 'swap:the booking app', '2026-09-26'), false, `${SWAP_KEEP_DAYS} days, then it may ask again`);
    assert.equal(swapKept({ 'swap:x': '2026-09-26' }, 'swap:the booking app', '2026-09-26'), false);
    assert.equal(swapKept('nonsense', 'swap:x', '2026-09-26'), false);
    assert.equal(swapKept({ 'swap:x': 'Tuesday' }, 'swap:x', '2026-09-26'), false);
  }

  // 6. At the goal, the next goal is the step.
  {
    const met = pathLadder({ offerSet: true, sent: 90, replied: 20, won: 5, goal: { title: 'Goal', target: 1000, current: 1500, money: true, unit: '$' }, currency: '$' });
    assert.equal(met.steps[5].input, 'next-goal');
    const open = pathLadder({ offerSet: true, sent: 90, replied: 20, won: 5, goal: { title: 'Goal', target: 1000, current: 100, money: true, unit: '$' }, currency: '$' });
    assert.equal(open.steps[5].input, null);
  }
  console.log('copilot-core: pathway redraw checks passed');
}

pathwayRedraw().catch((e) => { console.error(e); process.exit(1); });

// ---------------------------------------------------------------------------
// The Path as a plan: where you are in words, one move sized to the time you
// set, and the way to the goal walked back through your own funnel — every
// number from rows, and where there are none, what would make one.
// ---------------------------------------------------------------------------
import { MAX_ALSO, RATE_SAMPLE, SEND_MINUTES, pathAhead, pathHere, pathNow, planStatus, priceOf, sendBatch, sendsPerDay } from '../../src/lib/copilot/plan';
import { metricLabel, metricWords } from '../../src/lib/copilot/decision';

async function pathPlan() {
  // 1. The price you wrote, planned at the low end.
  assert.equal(priceOf('$150'), 150);
  assert.equal(priceOf('$400-1,500 per build'), 400, 'the top of a range is how a plan becomes a wish');
  assert.equal(priceOf('₱18,000 a month'), 18000);
  assert.equal(priceOf('18k/mo'), 18000);
  assert.equal(priceOf('$5'), 5);
  assert.equal(priceOf('ask me'), null);
  assert.equal(priceOf(''), null);
  assert.equal(priceOf(undefined), null);

  // 2. Capacity is the user's own number: minutes a day, at SEND_MINUTES a send.
  assert.equal(SEND_MINUTES, 3);
  assert.equal(sendsPerDay('deep'), 25, 'half the day: the rest is for what comes back');
  assert.equal(sendsPerDay('moderate'), 10);
  assert.equal(sendsPerDay('low'), 5);
  assert.equal(sendBatch('deep', 54), 25, 'the move asks for a day at the same pace the plan counts in');
  assert.equal(sendBatch('moderate', 54), 10);
  assert.equal(sendBatch('low', 54), 5);
  assert.equal(sendBatch('deep', 4), 4, 'never more than are written');
  assert.equal(sendBatch('low', 0), 0);

  // 3. Where you are, as a fact — never "Step 5 of 6".
  const goal = { id: 'g1', title: 'Save Exit PH [NOV]', metric: 'currency' as const, target_value: 1500, current_value: 0, horizon_days: null };
  const ladderOf = (o: { offerSet?: boolean; sent: number; replied: number; won: number }, g: { current: number; target: number } | null = { current: 0, target: 1500 }) =>
    pathLadder({ offerSet: o.offerSet ?? true, sent: o.sent, replied: o.replied, won: o.won, goal: g ? { title: 'Save Exit PH [NOV]', target: g.target, current: g.current, money: true, unit: '$' } : null, currency: '$' });
  const f = { sent: 9, replied: 2, won: 2 };
  assert.deepEqual(pathHere(ladderOf(f), f), { title: '2 paying clients', line: '9 sent · 2 replied · 2 paid' });
  assert.equal(pathHere(ladderOf({ offerSet: false, sent: 0, replied: 0, won: 0 }), { sent: 0, replied: 0, won: 0 }).title, 'Nothing to send yet');
  assert.equal(pathHere(ladderOf({ sent: 0, replied: 0, won: 0 }), { sent: 0, replied: 0, won: 0 }).title, 'Nothing sent yet');
  assert.equal(pathHere(ladderOf({ sent: 12, replied: 0, won: 0 }), { sent: 12, replied: 0, won: 0 }).title, '12 messages out, no reply yet');
  assert.equal(pathHere(ladderOf({ sent: 12, replied: 3, won: 0 }), { sent: 12, replied: 3, won: 0 }).title, '3 conversations, no client yet');
  assert.equal(pathHere(ladderOf({ sent: 40, replied: 9, won: 4 }, { current: 1600, target: 1500 }), { sent: 40, replied: 9, won: 4 }).title, 'Goal reached: Save Exit PH [NOV]');

  // 4. One move, in order, sized to the time you set.
  const askRows = [
    { key: 'f:c1', kind: 'fix' as const, title: 'Step by step plan to exit Philippines', detail: 'The worker could not finish — one tap tries it again', id: 'c1' },
    { key: 'capture', kind: 'confirm' as const, title: '3 replies are still open, oldest from X Out Pest Services. Where did they get to?', detail: 'A reply with no ending is a deal the app cannot count.' },
    { key: 'queue', kind: 'send' as const, title: '54 drafts ready to send', detail: 'The oldest has waited 17 days' },
  ];
  const base = { noOffer: false, callPending: false, queue: { count: 54, oldestDays: 17 }, asks: askRows, moves: [] as never[], capacity: 'deep' as const, funnel: f, freshMatches: 3 };
  const deep = pathNow(base);
  assert.equal(deep.now.kind, 'send', 'on an outbound path nothing moves until something goes out');
  assert.equal(deep.now.title, 'Send 25 of your 54 drafts');
  assert.equal(deep.now.size, 'about 75 min of your 150');
  assert.equal(deep.now.why, 'The oldest has waited 17 days. At your rate so far — 2 replies from 9 sends, early — that is about 6 replies.');
  assert.equal(deep.now.cta, 'Open the drafts');
  assert.deepEqual(deep.also.map((a) => a.key), ['f:c1', 'capture'], 'the drafts are the move, so they are not also an ask');
  const low = pathNow({ ...base, capacity: 'low' });
  assert.equal(low.now.title, 'Send 5 of your 54 drafts', 'Low energy asks for less');
  assert.equal(low.now.size, 'about 15 min of your 30');
  assert.ok(low.now.why!.endsWith('that is about 1 reply.'));
  assert.equal(pathNow({ ...base, queue: { count: 3, oldestDays: 0 } }).now.title, 'Send your 3 drafts');
  assert.equal(pathNow({ ...base, funnel: { sent: 0, replied: 0, won: 0 } }).now.why, 'The oldest has waited 17 days. Nothing on this path moves until something goes out.', 'no rate is invented before there is one');

  assert.equal(pathNow({ ...base, noOffer: true }).now.kind, 'offer', 'nothing can be drafted without an offer');
  assert.equal(pathNow({ ...base, noOffer: true, callPending: true }).now.kind, 'call', 'a waiting call is not hidden behind the offer: a blank offer’s call carries its own tap, and a call about a job post needs no offer');
  const call = pathNow({ ...base, callPending: true });
  assert.equal(call.now.kind, 'call', 'a waiting call was weighed against everything else already');
  assert.deepEqual(call.also.map((a) => a.key), ['f:c1', 'capture', 'queue']);

  const noQueue = { ...base, queue: { count: 0, oldestDays: 0 }, asks: askRows.slice(0, 2) };
  const fix = pathNow(noQueue);
  assert.equal(fix.now.kind, 'fix');
  assert.equal(fix.now.title, 'Get "Step by step plan to exit Philippines" going again');
  assert.equal(fix.now.id, 'c1');
  assert.deepEqual(fix.also.map((a) => a.key), ['capture']);

  const mv = (o: Record<string, unknown>) => ({ id: 'm', job: 'goal_gap', kind: 'decide', headline: 'h', why: ['w'], artifact: { kind: 'text', label: 'Read', value: 'v' }, cost_label: '20 min', status: 'open', created_at: '2026-09-26T05:00:00Z', ...o }) as never;
  const moves = [mv({ id: 'big', headline: 'Rebuild the booking site', cost_label: '2 h' }), mv({ id: 'small', headline: 'Quote Casa Blanca', cost_label: '10 min', why: ['  ', 'They asked yesterday.'] })];
  const lowMove = pathNow({ ...noQueue, asks: [], capacity: 'low', moves });
  assert.equal(lowMove.now.id, 'small', 'Low energy skips the two-hour Move for the one that fits');
  assert.equal(lowMove.now.size, 'about 10 min of your 30');
  assert.equal(lowMove.now.why, 'They asked yesterday.');
  assert.equal(pathNow({ ...noQueue, asks: [], capacity: 'deep', moves }).now.id, 'big', 'Deep focus has room for the planner’s first choice');
  assert.equal(pathNow({ ...noQueue, asks: [], capacity: 'low', moves: [moves[0]] }).now.size, 'about 120 min of your 30 — more than today holds', 'nothing fits: the best of it, said to be too big');
  assert.equal(pathNow({ ...noQueue, asks: [], moves: [] }).now.kind, 'find');
  assert.equal(pathNow({ ...noQueue, asks: [], moves: [], freshMatches: 0 }).now.kind, 'rest');
  assert.equal(pathNow({ ...base, callPending: true, asks: [...askRows, ...askRows.map((a) => ({ ...a, key: `${a.key}2` }))] }).also.length, MAX_ALSO, 'the move is one thing; beside it, a few');

  // 5. The plan: the milestone you are on, what you will learn next, the goal.
  const others = [
    { id: 'g2', title: 'MacBook Air 15"', metric: 'currency' as const, target_value: 2000, current_value: 0, horizon_days: null },
    { id: 'g5', title: 'Get a job', metric: 'none' as const, target_value: null, current_value: null, horizon_days: 90, created_at: '2026-09-01T00:00:00Z' },
    { id: 'g6', title: 'Ten retainers', metric: 'number' as const, target_value: 10, current_value: 1, horizon_days: null },
    { id: 'g7', title: '$1M ARR + 500K cash', metric: 'none' as const, target_value: null, current_value: null, horizon_days: null },
  ];
  const input = { ladder: ladderOf(f), funnel: f, goal, others, price: 150, currency: '$', capacity: 'deep' as const, sentFortnight: 0, bottleneck: null, today: '2026-09-28' };
  const { stops, beyond } = pathAhead(input);
  assert.deepEqual(stops.map((s) => s.key), ['rung:repeat', 'check:sample', 'goal:g1']);
  const [repeat, check, target] = stops;
  assert.equal(repeat.title, '3 paying clients');
  assert.equal(repeat.status, '2 of 3');
  assert.deepEqual(repeat.progress, { done: 2, of: 3 });
  assert.equal(repeat.takes, 'About 5 more sends at your rate — 2 clients from 9 sends.');
  assert.equal(repeat.when, 'Under a day of sending at Deep focus. One client can be luck. Three is something you can repeat.');
  assert.equal(repeat.early, true, 'a rate from 9 sends is marked early wherever it is used');
  assert.equal(check.title, `At ${RATE_SAMPLE} sends, the guesses become numbers`);
  assert.deepEqual(check.progress, { done: 9, of: RATE_SAMPLE });
  assert.equal(check.takes, '2 or more replies by then: this opener works, send more of it. Fewer: change its first line or the list before the next batch.');
  assert.equal(target.status, '$0 of $1,500');
  assert.equal(target.takes, '10 clients at your $150 · about 45 sends at your rate — 2 clients from 9 sends.');
  assert.equal(target.when, '2 days of sending at Deep focus.', 'at the pace the move asks for, not the whole day');
  assert.equal(target.pace, 'Nothing sent in the last two weeks — at that pace it does not move.', 'the pace you could keep, and the one you did');
  assert.equal(target.early, true);
  assert.equal(pathAhead({ ...input, sentFortnight: 6 }).stops[2].pace, null, 'said only when it is news');
  assert.equal(pathAhead({ ...input, capacity: 'low' }).stops[2].when, '9 days of sending at Low energy.', 'the same plan, at the time you set');
  // Days left to the goal's date — written on 28 Sep with 30 days on it — not the horizon itself.
  const dated = (h: number, today = '2026-09-28') => pathAhead({ ...input, today, capacity: 'low', goal: { ...goal, horizon_days: h, created_at: '2026-09-28T03:00:00Z' } }).stops[2].when;
  assert.equal(dated(30), '9 days of sending at Low energy. 30 days left: 2 sends a day gets there.');
  assert.equal(dated(2), '9 days of sending at Low energy. 2 days left: 23 sends a day gets there, which is more than the time you set.');
  assert.equal(dated(30, '2026-10-18'), '9 days of sending at Low energy. 10 days left: 5 sends a day gets there.', 'it counts down: twenty days on, ten are left');
  assert.equal(dated(30, '2026-11-02'), '9 days of sending at Low energy. Its date has passed: 5 days past its date.');
  assert.equal(pathAhead({ ...input, capacity: 'low', goal: { ...goal, horizon_days: 30 } }).stops[2].when, '9 days of sending at Low energy.', 'no day it was written, no days claimed');

  const noPrice = pathAhead({ ...input, price: null }).stops[2];
  assert.equal(noPrice.takes, '$1,500 to go. Put a price in your offer and this turns into clients and sends.');
  assert.equal(noPrice.when, null, 'no price, no invented one');

  const noWinF = { sent: 9, replied: 2, won: 0 };
  const noWin = pathAhead({ ...input, ladder: ladderOf(noWinF), funnel: noWinF }).stops;
  assert.deepEqual(noWin.map((s) => s.key), ['rung:paid', 'check:sample', 'rung:repeat', 'goal:g1']);
  assert.equal(noWin[0].takes, 'About 5 sends a conversation at your rate so far.');
  assert.equal(noWin[2].takes, null, 'no client yet: no rate to walk back from');
  assert.equal(noWin[3].takes, '10 clients at your $150 · no client yet to measure a rate from.');
  assert.equal(noWin[3].when, 'Your first paying client turns this into sends and days.');

  const quietF = { sent: 12, replied: 0, won: 0 };
  const quiet = pathAhead({ ...input, ladder: ladderOf(quietF), funnel: quietF }).stops;
  assert.equal(quiet[0].key, 'rung:reply');
  assert.equal(quiet[0].takes, 'No reply yet from 12 sends.');
  assert.equal(quiet[0].when, `If there is still none at ${RATE_SAMPLE}, change the first line or the list.`);

  const lateF = { sent: 40, replied: 2, won: 2 };
  const late = pathAhead({ ...input, ladder: ladderOf(lateF), funnel: lateF, bottleneck: { headline: 'Sent → Replied is where you lose most: 2 of 40 (5%).', action: 'Change one thing in the opener — the first line or the ask — and send the next batch before changing anything else.' } }).stops;
  assert.equal(late[0].early, false, 'forty sends is a measurement');
  assert.equal(late[1].kind, 'check');
  assert.equal(late[1].title, 'Sent → Replied is where you lose most: 2 of 40 (5%).', 'past the sample, the open question is the funnel’s own bottleneck');
  assert.equal(late[1].takes, 'Change one thing in the opener — the first line or the ask — and send the next batch before changing anything else.');
  assert.deepEqual(pathAhead({ ...input, ladder: ladderOf(lateF), funnel: lateF }).stops.map((s) => s.kind), ['rung', 'goal'], 'no bottleneck, no checkpoint made up');

  const job = pathAhead({ ...input, goal: others[1] }).stops.at(-1)!;
  assert.equal(job.title, 'Get a job');
  assert.equal(job.takes, 'There is no number on it, so the plan cannot walk back from it. Give it a target and it can.');
  assert.equal(pathAhead({ ...input, goal: null }).stops.at(-1)!.title, 'Name your goal');
  assert.equal(pathAhead({ ...input, goal: { ...goal, current_value: 1600 } }).stops.at(-1)!.takes, 'Reached. Set the next one.');

  assert.deepEqual(beyond.map((b) => [b.title, b.status]), [
    ['MacBook Air 15"', '$0 of $2,000'],
    ['Get a job', 'No target · 63 days left'],
    ['Ten retainers', '1 of 10'],
    ['$1M ARR + 500K cash', 'No target'],
  ], 'the goals past the first, in your order, named with where they stand and no plan built on a plan');

  // 6. Nowhere on the way is there a step number.
  const words = [...stops, ...noWin, ...quiet, ...late].flatMap((s) => [s.title, s.status, s.takes, s.when, s.pace]).filter(Boolean).join(' | ');
  assert.ok(!/step \d+ of \d+/i.test(words), words);

  // 7. The header line says where you are, and what needs you.
  const here = pathHere(ladderOf(f), f);
  // Never "where you are": the first line under the header already says it, in bigger type.
  assert.equal(planStatus(3, 1), '3 need you');
  assert.equal(planStatus(0, 4), '4 days in a row');
  assert.equal(planStatus(0, 1), null, 'nothing true to add, so nothing');

  // 8. A call's number in its own unit: "It was 2" over "$1,000 of $15,000" read as a contradiction.
  assert.equal(metricWords('won_amount'), 'money won');
  assert.equal(metricWords('replies'), 'replies');
  assert.equal(metricLabel('won_amount', 2, '$'), '$2');
  assert.equal(metricLabel('won_amount', 1500, '₱'), '₱1,500');
  assert.equal(metricLabel('replies', 2, '$'), '2');
  assert.equal(metricLabel('runway_months', 2.94, '$'), '2.9');
  const graded = pathEvents({ now: new Date('2026-09-26T10:00:00Z'), timezone: 'UTC', outcomes: [], focus: [], commissions: [], currency: '$',
    decisions: [{ id: 'd', for_date: '2026-09-24', headline: 'Quote the upsell', response: 'did', verify: { metric: 'won_amount', baseline: 2, after: 902, verifiedAt: '2026-09-26T08:00:00Z' } }] as never[] });
  assert.equal(graded[0].detail, '“Quote the upsell” · money won $2 → $902');
  console.log('copilot-core: path plan checks passed');
}

pathPlan().catch((e) => { console.error(e); process.exit(1); });

// ─────────────────────────────────────────────────────────────────────────────
// "Run again" runs the night: the pass, its row, and the report on You
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync as readNightlyFile } from 'node:fs';
import {
  CRON_REASON, NIGHTLY_NOW, NIGHTLY_STALE_MS, durationLabel, isNightlyPass, nightlyFromRow, nightlyHeadline,
  nightlyInFlight, nightlyLines, nightlyToast, nightlyView, runAgo, type NightlyOutput, type NightlyRun,
} from '../../src/lib/copilot/nightly';
import { budgetForReason as nightlyBudget } from '../../src/lib/copilot/agent/llm';
import { notifyPayload as nightlyNotify } from '../../src/lib/copilot/brief';

async function nightlyPass() {
  const now = new Date('2026-09-27T08:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  // 1. A tap must never be mistaken for the schedule. lastCronRun and /health
  //    count 'cron' briefs as proof the scheduled task exists; if "Run again"
  //    wrote that reason, pressing it would hide a schedule that never fires.
  assert.notEqual(NIGHTLY_NOW, CRON_REASON);
  assert.ok(isNightlyPass(CRON_REASON) && isNightlyPass(NIGHTLY_NOW));
  for (const r of ['manual', 'daily', 'supply', '', null, undefined]) assert.equal(isNightlyPass(r), false, `${String(r)} is not the nightly pass`);

  // 2. Both ways of running the pass are off the proxy, so both get the long
  //    budget and both end in the push. Everything else stays a tap.
  const env = { ...process.env };
  delete process.env.COPILOT_AI_TIMEOUT_MS;
  delete process.env.COPILOT_AI_CRON_TIMEOUT_MS;
  assert.equal(nightlyBudget(NIGHTLY_NOW), nightlyBudget(CRON_REASON), 'the button runs after the response, so it can wait like the cron');
  assert.ok(nightlyBudget(NIGHTLY_NOW) > nightlyBudget('manual'));
  process.env = env;
  const call = { headline: 'Send the 7 drafts already written.', because: [], verify_metric: 'sent' as const };
  assert.equal(nightlyNotify({ decision: call }, NIGHTLY_NOW)?.body, call.headline, 'the push is part of what the night produces');
  assert.equal(nightlyNotify({ decision: call }, 'manual'), null, 'a plain re-brief still does not notify');

  // 3. Same code path, by construction. The cron and the button both call
  //    runNightlyPass, neither calls runDaily around it, and the button never
  //    borrows the cron's reason. The button shares the brief's daily cap, so
  //    it is not a way round briefsPerDay.
  const cronSrc = readNightlyFile(new URL('../../src/app/api/copilot/cron/daily/route.ts', import.meta.url), 'utf8');
  const nowSrc = readNightlyFile(new URL('../../src/app/api/copilot/nightly/route.ts', import.meta.url), 'utf8');
  const briefSrc = readNightlyFile(new URL('../../src/app/api/copilot/brief/route.ts', import.meta.url), 'utf8');
  for (const [name, src] of [['cron', cronSrc], ['nightly', nowSrc]] as const) {
    assert.match(src, /runNightlyPass\(/, `${name} route runs the shared pass`);
    assert.doesNotMatch(src, /runDaily\(/, `${name} route must not run a copy of it`);
  }
  assert.doesNotMatch(nowSrc, /CRON_REASON|'cron'/, 'the button must never record itself as the schedule');
  assert.match(nowSrc, /copilot:brief:\$\{auth\.pid\}/);
  assert.match(briefSrc, /copilot:brief:\$\{auth\.pid\}/, 'one cap for every brief a tap can start');

  // 4. In flight, and when "running" stops being believable.
  const running = (startedMs: number, extra: Partial<NightlyRun> = {}): NightlyRun => ({
    id: 'r1', status: 'running', reason: NIGHTLY_NOW, started_at: ago(startedMs), finished_at: null, output: null, error: null, ...extra,
  });
  assert.equal(nightlyInFlight(running(60_000), now), true);
  assert.equal(nightlyInFlight(running(NIGHTLY_STALE_MS + 1), now), false, 'past the stale line the process that owned it is gone');
  assert.equal(nightlyInFlight({ status: 'ok', started_at: ago(1000) }, now), false);
  assert.equal(nightlyInFlight(null, now), false);
  assert.equal(nightlyInFlight({ status: 'running', started_at: 'not a date' }, now), false, 'an unreadable start is not a live run');

  // 5. Running: which step, how far, how long. Who started it is said, so a
  //    pass the schedule has going is not taken for one you started.
  const v1 = nightlyView(running(72_000, { output: { step: 'jobs' } }), now);
  assert.equal(v1.state, 'running');
  if (v1.state === 'running') {
    assert.equal(v1.stepN, 3); assert.equal(v1.of, 5);
    assert.equal(v1.doing, 'running the checks');
    assert.equal(v1.elapsed, '1m 12s');
    assert.equal(v1.by, 'you');
  }
  const v2 = nightlyView(running(5_000, { reason: CRON_REASON }), now);
  assert.equal(v2.state === 'running' && v2.by, 'schedule');
  assert.equal(v2.state === 'running' && v2.doing, 'starting', 'no step recorded yet is "starting", not a guess');
  assert.equal(v2.state === 'running' && v2.stepN, 0);
  const junkStep = nightlyView(running(5_000, { output: { step: 'teleport' as never } }), now);
  assert.equal(junkStep.state === 'running' && junkStep.step, null, 'a step this code does not know is not rendered');

  // 6. A row that died says so, and says what survived: every step writes as it
  //    goes, so a pass cut off at the checks has already kept its matches.
  const dead = nightlyView(running(20 * 60_000), now);
  assert.equal(dead.state, 'stopped');
  if (dead.state === 'stopped') {
    assert.equal(dead.startedAgo, '20m ago');
    assert.match(dead.line, /Stopped without finishing/);
    assert.match(dead.line, /kept/);
  }
  assert.equal(nightlyToast(dead), 'The nightly run stopped without finishing.');

  // 7. A pass that threw carries its reason, and an empty one is not "fine".
  const failed = nightlyView({ ...running(60_000), status: 'error', finished_at: ago(30_000), error: 'profile not found' }, now);
  assert.equal(failed.state === 'failed' && failed.line, 'profile not found');
  const blank = nightlyView({ ...running(60_000), status: 'error', finished_at: ago(30_000), error: '  ' }, now);
  assert.equal(blank.state === 'failed' && blank.line, 'It failed without saying why.');
  assert.equal(nightlyToast(failed), 'Nightly run failed: profile not found');

  // 8. What each step did, from the stored result.
  const out: NightlyOutput = {
    supply: {
      found: 18, inserted: 4,
      perAdapter: {
        hunter: { found: 0, inserted: 0, skipped: 'not configured for this profile' },
        web: { found: 6, inserted: 1 },
        google_maps: { found: 12, inserted: 3 },
        remote: { found: 0, inserted: 0, error: 'fetch failed' },
      },
    },
    reconcile: { checked: 6, matched: 1 },
    jobs: {
      ran: 9, produced: 5, written: 3,
      perJob: {
        send_queue: { produced: 1, written: 1 },
        watch: { produced: 0, written: 0, error: 'feed returned 403' },
        repeat_customer: { produced: 0, written: 0, skipped: 'sensor not connected for this profile' },
      },
    },
    brief: { agent: 'llm', fellBack: false, graded: { ignored: 1, verified: 1 }, pushed: 1 },
    labels: { supply: { web: 'Web search', google_maps: 'Google Maps', remote: 'External supply agent' }, jobs: { watch: 'What your sources turned up' } },
  };
  const lines = nightlyLines(out);
  const text = lines.map((l) => `${l.tone}|${l.name}|${l.text}`);
  assert.deepEqual(text, [
    'ok|Scout|Found 18 (Web search 6, Google Maps 12) · 4 new',
    'broke|Scout|External supply agent: fetch failed',
    'ok|Replies|Checked 6 sent messages · 1 new reply',
    'ok|Checks|9 checks ran · 3 new next steps',
    'broke|Checks|What your sources turned up: feed returned 403',
    'ok|Call|Picked by the agent · 2 earlier calls graded · sent to your phone',
  ]);
  // Skips that are by design are not news: "not configured" and "sensor not
  // connected" are the setup the Work tab already shows, not failures.
  assert.ok(!text.some((t) => /not configured|not connected/.test(t)));

  const done = nightlyView({ ...running(200_000), status: 'ok', finished_at: ago(70_000), output: out }, now);
  assert.equal(done.state, 'done');
  if (done.state === 'done') {
    assert.equal(done.took, '2m 10s');
    assert.equal(done.ago, '1m ago');
    assert.equal(done.broke, 2);
    assert.equal(done.headline, '4 new matches, 3 new next steps, call picked');
  }
  assert.equal(nightlyToast(done), 'Nightly run done, but 2 things broke. Details under You.');

  // 9. The fallback is a failure even though a call came out of it; the rules
  //    with no model set up are a note, not a fault; a missing label shows the key.
  const fell = nightlyLines({ brief: { agent: 'starter', fellBack: true, graded: { ignored: 0, verified: 0 }, pushed: 0 } });
  assert.deepEqual(fell.map((l) => [l.tone, l.text]), [
    ['note', 'Did not search this run'],
    ['broke', 'The agent failed, so the fallback rules picked it'],
  ]);
  const rules = nightlyLines({ supply: { found: 0, inserted: 0, perAdapter: { google_maps: { found: 0, inserted: 0, skipped: 'monthly match allowance used up' } } }, brief: { agent: 'starter', fellBack: false } });
  assert.deepEqual(rules.map((l) => [l.tone, l.text]), [
    ['ok', 'Searched · nothing turned up'],
    ['note', 'google_maps: monthly match allowance used up'],
    ['note', 'Picked by the rules, since no model is set up'],
  ]);

  // 10. A step that threw says why, in its own words.
  const threw = nightlyLines({ supply: { error: 'profile not found' }, reconcile: { error: 'timeout' }, jobs: { error: 'boom' }, unrecorded: ['permission denied'] });
  assert.deepEqual(threw.map((l) => `${l.tone}|${l.text}`), [
    'broke|Could not search: profile not found',
    'broke|Could not read replies: timeout',
    'broke|Could not run the checks: boom',
    'note|Progress could not be saved as it went: permission denied',
  ]);
  assert.equal(nightlyLines({ reconcile: { checked: 0, matched: 0 } })[1].text, 'No sent WhatsApp messages from the last 30 days to check');
  assert.equal(nightlyLines({ supply: { found: 5, inserted: 0 } })[0].text, 'Found 5 · all already seen');

  // 11. The headline counts only what is new, and says when nothing is.
  assert.equal(nightlyHeadline({ supply: { found: 3, inserted: 0 }, jobs: { written: 0 }, brief: { agent: 'llm' } }), 'nothing new, call picked');
  assert.equal(nightlyHeadline({ supply: { found: 1, inserted: 1 }, brief: { skipped: 'no time left' } }), '1 new match, no call picked');
  assert.equal(nightlyToast(nightlyView({ ...running(90_000), status: 'ok', finished_at: ago(10_000), output: { brief: { agent: 'llm' } } }, now)), 'Nightly run done: nothing new, call picked.');
  assert.equal(nightlyToast(v1), null, 'nothing to announce while it is still going');

  // 12. The row as stored. The reason lives in input_summary; a status this
  //     code does not know is read as a failure, never as fine.
  const row = nightlyFromRow({ id: 'x', status: 'ok', started_at: ago(1000), finished_at: ago(0), output: { brief: { agent: 'llm' } }, error: null, input_summary: { reason: CRON_REASON } });
  assert.equal(row.reason, CRON_REASON);
  assert.equal(row.output?.brief?.agent, 'llm');
  const odd = nightlyFromRow({ id: 'y', status: 'paused', started_at: ago(1000), finished_at: null, output: 'junk', error: null, input_summary: null });
  assert.equal(odd.status, 'error');
  assert.match(odd.error ?? '', /unknown status "paused"/);
  assert.equal(odd.output, null);
  assert.equal(odd.reason, null);
  assert.equal(nightlyView(null, now).state, 'never');

  // 13. Durations and ages.
  assert.equal(durationLabel(48_000), '48s');
  assert.equal(durationLabel(120_000), '2m');
  assert.equal(durationLabel(130_000), '2m 10s');
  assert.equal(durationLabel(3_840_000), '1h 4m');
  assert.equal(durationLabel(-5), '0s');
  assert.equal(runAgo(ago(30_000), now), 'just now');
  assert.equal(runAgo(ago(4 * 60_000), now), '4m ago');
  assert.equal(runAgo(ago(7 * 3_600_000), now), '7h ago');
  assert.equal(runAgo(ago(49 * 3_600_000), now), '2d ago');

  console.log('copilot-core: nightly pass checks passed');
}

nightlyPass().catch((e) => { console.error(e); process.exit(1); });

/* ─── The drawn plan (lib/copilot/roadmap.ts) ───────────────────────────── */
import {
  MAX_MILESTONES_PER_PHASE, MAX_STEPS_PER_MILESTONE, ROADMAP_MAX_AGE_DAYS, ROADMAP_RETRY_MS, ROADMAP_STALE_MS, ROADMAP_SYSTEM,
  goalMarkers, happenedLines, idsByTitle, markFromEvent, parseRoadmap, previousForPrompt, roadmapChanges, roadmapDue, roadmapFirstStep,
  roadmapItem, roadmapPrompt, roadmapRunFromRow, roadmapSignature, roadmapView, sourcedFrom, unsourced,
  type RoadmapInput, type RoadmapRun,
} from '../../src/lib/copilot/roadmap';
import { pathEvents as roadmapPathEvents } from '../../src/lib/copilot/pathway';
import { pathNow as roadmapPathNow } from '../../src/lib/copilot/plan';
import { nightlyLines as roadmapNightlyLines } from '../../src/lib/copilot/nightly';

async function drawnPlan() {
  const now = new Date('2026-09-27T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  // 1. The guard. Only numbers and months the input carried survive; one number
  //    is one number however it is written, digits or words; a small count is an
  //    instruction in a step and a claim in a reason.
  const src = sourcedFrom('- [3f2a91b7-5e14] Goal: €1,000 of €60,000 · within 180 days · runway 3.4 months · price €5 · Save Exit PH [NOV]\n2026-09-25: a reply');
  const t = (x: string) => unsourced(x, src, 'target');
  const c = (x: string) => unsourced(x, src, 'claim');
  assert.equal(t('Close the €60,000 gap'), null);
  assert.equal(t('Close the 60k gap'), null, '60k is 60,000');
  assert.equal(t('Close the sixty thousand gap'), null, 'and so is sixty thousand');
  assert.equal(t('Within the 180 days you set'), null);
  assert.equal(c('With 3.4 months of runway'), null);
  assert.equal(t('Make two calls and send 3 messages'), null, 'in a step, a count of things to do is an instruction');
  assert.equal(t('Aim for a 20% reply rate'), '20%', 'a rate it made up');
  assert.equal(t('Earn €3,000 by March'), '€3,000');
  assert.equal(t('Done in 6 weeks'), null, 'six is a small count in a step');
  assert.equal(t('Done in 45 days'), '45');
  assert.equal(t('Done in forty-five days'), 'forty-five', 'words are numbers too');
  assert.equal(t('Save €5 a day'), null);
  assert.equal(t('Raise the price to €8'), '€8', 'money is never a small count');
  assert.equal(t('Aim for 2.5 hours'), '2.5', 'a decimal is a measurement');
  assert.equal(c('Five sales at €5 covers the fine and a ticket'), 'Five', 'in a reason, five is a claim: the digit guard let exactly this through');
  assert.equal(c('Keep the one channel that already works'), null, 'English cannot do without "one"');
  assert.equal(c('Two market days booked keeps cash in'), 'Two');
  assert.equal(t('Two market days booked'), null, 'but as a target it is fine');
  assert.equal(c('By mid-October you will know which path pays'), 'October', 'a timeline nobody gave');
  assert.equal(c('The Nov deadline is the constraint'), null, 'NOV was in their goal');
  assert.equal(c('The November deadline bends everything'), null);
  assert.equal(c('The September reply'), null, 'a date in the input names its month');
  assert.equal(c('The reply on 25 September'), '25', 'its day is not kept: a plan does not need to quote dates back');
  assert.equal(c('You may want to rest'), null, 'may is a verb here, and is never read as a month');
  assert.equal(c('Your 2026 plan'), '2026', 'the digits of a date are not a quantity anybody gave');
  assert.equal(c('Reply by the 25th'), '25');
  assert.ok(!src.numbers.has(3) && !src.numbers.has(91), 'an id listed in the prompt lends it no numbers');

  // 2. The prompt: every goal with the person's own numbers, a money goal said
  //    in clients at their price, and the last plan as titles and ticks only.
  const input: RoadmapInput = {
    today: '2026-09-27', name: 'Maria', headline: 'Jewellery seller', location: 'Valencia', capacity: 'moderate', currency: '€', runwayMonths: null,
    offer: { sells: 'Stainless steel jewellery', price_band: '€5 each' }, price: 5,
    goals: [
      { id: 'g1', title: 'Property buy and renovation', metric: 'currency', unit: '€', target: 60000, current: 1000, dueOn: '2027-03-26', daysLeft: 180, note: 'Want to flip it' },
      { id: 'g2', title: 'Learn Spanish', metric: 'none', unit: null, target: null, current: null, dueOn: null, daysLeft: null, note: null },
    ],
    working: 'How you deliver:\n- Market stalls on weekends',
    notes: ['I have an interview Thursday'],
    funnel: { windowDays: 30, sent: 0, replied: 0, won: 0, wonAmount: 0 },
    happened: ['2h logged on renovation research'],
    previous: [{ id: 'first-buyer', phase: 'week', title: 'A first wholesale buyer', state: 'dropped', steps: [{ id: 'list-five', title: 'List five buyers', state: 'done' }] }],
    aiAvailable: true,
  };
  const prompt = roadmapPrompt(input);
  // Its date and the days left today — never the horizon it was written with.
  assert.match(prompt, /\[g1\] Property buy and renovation · €1,000 of €60,000 · due 2027-03-26, 180 days left · their note: Want to flip it/);
  assert.match(prompt, /\[g2\] Learn Spanish · no date/);
  assert.match(prompt, /at their price of €5: €59,000 to go is 11800 clients/);
  assert.match(prompt, /Time each day: 60 minutes \(Moderate\)/);
  assert.match(prompt, /\[first-buyer\] \(week\) A first wholesale buyer — dropped/);
  assert.match(prompt, /\[list-five\] List five buyers — done/);
  assert.match(prompt, /I have an interview Thursday/);
  assert.match(prompt, /ai_available: true/);
  assert.ok(!/DRAFTS WRITTEN/.test(prompt), 'no drafts, no line');
  assert.match(roadmapPrompt({ ...input, drafts: { count: 56, oldestDays: 18 } }), /DRAFTS WRITTEN AND WAITING: 56, the oldest 18 days old/, 'the plan is told the drafts exist, so it can decide about them');
  assert.match(ROADMAP_SYSTEM, /never send more of what is not working/);
  assert.match(ROADMAP_SYSTEM, /Never invent a number about them/, 'the rule the guard enforces is also said to the model');
  assert.match(ROADMAP_SYSTEM, /quick_win.*leverage.*foundation/s);

  // 3. What goes back in is the record, never the view (invariant 12).
  const earlier = {
    here: { title: 'Selling jewellery toward a flat', line: 'You are far from the property.' },
    direction: 'Cash first, because the property needs it.', changed: null,
    phases: [{ key: 'week' as const, milestones: [{ id: 'm1', title: 'First sale', why: 'It proves demand.', doneWhen: 'Someone paid', goalId: 'g1', steps: [{ id: 's1', title: 'Ask three shops', size: 'quick' as const, tag: 'quick_win' as const, who: 'you' as const }] }] }],
  };
  const prev = previousForPrompt(earlier, [
    { item: 's1', title: 'Ask three shops', state: 'done', at: ago(3_600_000) },
    { item: 'm1', title: 'First sale', state: 'dropped', at: ago(7_200_000) },
    { item: 'm1', title: 'First sale', state: 'open', at: ago(1_000) },
  ]);
  assert.deepEqual(prev, [{ id: 'm1', phase: 'week', title: 'First sale', state: 'open', steps: [{ id: 's1', title: 'Ask three shops', state: 'done' }] }], 'the newest mark wins; undo is a mark');
  assert.ok(!JSON.stringify(prev).includes('proves demand') && !JSON.stringify(prev).includes('Cash first'), 'no why, no direction');

  // 4. The parse holds the plan to the rules.
  const ctx = { allowed: sourcedFrom(prompt), goalIds: ['g1', 'g2'], aiAvailable: false, previousIds: idsByTitle(earlier) };
  const many = (n: number, f: (i: number) => unknown) => Array.from({ length: n }, (_, i) => f(i));
  const raw = {
    here: { title: 'Saving toward the property', line: 'The jewellery pays €5 a piece; the gap is €59,000.' },
    direction: 'Income first, then the property search.',
    changed: 'Dropped the wholesale buyer, you set it aside.',
    phases: [
      { key: 'later', milestones: [{ id: 'buy', title: 'Make an offer on a property', steps: [] }] },
      { key: 'week', milestones: [
        { title: 'First sale', why: 'It proves somebody pays', done_when: 'One person has paid', goal_id: 'g1',
          steps: many(5, (i) => ({ id: `step-${i}`, title: `Ask shop ${i + 1}`, size: 'quick', tag: 'quick_win', who: 'ai' })) },
        { id: 'rate', title: 'Hit a 25% conversion rate', steps: [] },
        { id: 'site', title: 'Put the shop online', why: 'Online sells €2,000 a month', goal_id: 'not-a-goal', steps: [{ id: 'site', title: 'Pick a platform', size: 'enormous', tag: 'shiny' }] },
        { id: 'extra-1', title: 'Extra one' }, { id: 'extra-2', title: 'Extra two' },
      ] },
      { key: 'someday', milestones: [{ id: 'spanish', title: 'Spanish lessons booked' }] },
    ],
  };
  const parsed = parseRoadmap(raw, ctx)!;
  assert.ok(parsed, 'a usable plan comes back');
  const r = parsed.roadmap;
  assert.deepEqual(r.phases.map((p) => p.key), ['week', 'later'], 'in phase order, an unknown phase read as later');
  const week = r.phases[0].milestones;
  assert.equal(week.length, MAX_MILESTONES_PER_PHASE);
  assert.ok(!week.some((m) => /25%/.test(m.title)), 'a milestone whose title invents a number is dropped whole');
  assert.equal(week[0].id, 'm1', 'the last plan’s id, found by title, so its ticks carry');
  assert.equal(week[0].steps.length, MAX_STEPS_PER_MILESTONE);
  assert.ok(week[0].steps.every((s) => s.who === 'you'), 'no worker, so nothing is offered to one (invariant 7)');
  assert.equal(week[0].goalId, 'g1');
  assert.equal(week[0].doneWhen, 'One person has paid');
  const site = week.find((m) => m.title === 'Put the shop online')!;
  assert.equal(site.why, null, 'a reason carrying a made-up €2,000 is dropped');
  assert.equal(site.goalId, null, 'a goal that does not exist is not linked');
  assert.equal(site.steps[0].size, 'sitting'); assert.equal(site.steps[0].tag, 'foundation');
  assert.notEqual(site.steps[0].id, site.id, 'ids are unique across the plan, so a tick means one thing');
  assert.ok(r.phases[1].milestones.some((m) => m.title === 'Spanish lessons booked'));
  assert.equal(r.here?.line, 'The jewellery pays €5 a piece; the gap is €59,000.', 'numbers from the input pass');
  assert.equal(parsed.withheld, 2);
  assert.equal(parseRoadmap({ phases: [{ key: 'week', milestones: [{ title: 'Earn €9,999 this week' }] }] }, ctx), null, 'nothing that holds up is a failed draw, not an empty plan');
  assert.equal(parseRoadmap('not json at all', ctx), null);
  const withAi = parseRoadmap({ phases: [{ key: 'week', milestones: [{ id: 'x', title: 'Shortlist renovation upgrades', steps: [{ id: 'r', title: 'Research resale value', who: 'ai' }] }] }] }, { ...ctx, aiAvailable: true })!;
  assert.equal(withAi.roadmap.phases[0].milestones[0].steps[0].who, 'ai');
  assert.deepEqual(roadmapItem(r, week[0].steps[0].id), { kind: 'step', title: 'Ask shop 1' });
  assert.equal(roadmapItem(r, 'nope'), null);

  // 5. A stored row is read defensively: a plan that is not one is a failure with a reason.
  const run = (o: Partial<Record<string, unknown>> = {}) => roadmapRunFromRow({ id: 'r1', status: 'ok', started_at: ago(60_000), finished_at: ago(0), output: { roadmap: r }, error: null, input_summary: { reason: 'manual', signature: 'abc' }, ...o });
  assert.equal(run().status, 'ok'); assert.equal(run().signature, 'abc'); assert.equal(run().roadmap?.phases.length, 2);
  const junk = run({ output: { roadmap: { phases: 'x' } } });
  assert.equal(junk.status, 'error'); assert.match(junk.error ?? '', /could not be read/);
  assert.equal(run({ status: 'weird' }).status, 'error');
  const thin = run({ output: { roadmap: { phases: [{ key: 'week', milestones: [{ id: 'a', title: 'A' }, { title: 'no id' }] }] } } });
  assert.deepEqual(thin.roadmap?.phases[0].milestones.map((m) => [m.id, m.steps.length]), [['a', 0]], 'a milestone with no steps array is kept; one with no id is not');
  assert.equal(markFromEvent({ payload: { item: 's1', state: 'done', title: 'T' }, created_at: ago(0) })?.state, 'done');
  assert.equal(markFromEvent({ payload: { state: 'done' }, created_at: ago(0) }), null);

  // 6. The signature is what the person SAID, in any order.
  const sigIn = { goals: [{ id: 'b', title: 'B', target_value: 5, current_value: 0, horizon_days: null, priority: 2, note: null }, { id: 'a', title: 'A', target_value: null, current_value: null, horizon_days: 30, priority: 1, note: 'n' }], working: [{ id: 'w', body: 'x' }], contextCount: 6, capacity: 'moderate' as const, offer: { sells: 'S' } };
  const sig = roadmapSignature(sigIn);
  assert.equal(roadmapSignature({ ...sigIn, goals: [...sigIn.goals].reverse() }), sig);
  assert.notEqual(roadmapSignature({ ...sigIn, contextCount: 7 }), sig, 'a new note');
  assert.notEqual(roadmapSignature({ ...sigIn, capacity: 'deep' }), sig, 'a different day');
  assert.notEqual(roadmapSignature({ ...sigIn, goals: [{ ...sigIn.goals[0], target_value: 6 }, sigIn.goals[1]] }), sig, 'a changed target');

  // 7. When it is redrawn.
  const cur = (o: Partial<RoadmapRun> = {}): RoadmapRun => ({ id: 'c', status: 'ok', reason: 'manual', signature: sig, startedAt: ago(86_400_000), finishedAt: ago(86_300_000), roadmap: r, error: null, ...o });
  const due = (o: Partial<Parameters<typeof roadmapDue>[0]>) => roadmapDue({ latest: cur(), current: cur(), signature: sig, now, trigger: 'open', ...o });
  assert.equal(due({ latest: null, current: null }), 'first');
  assert.equal(due({}), null, 'the plan on screen still holds');
  assert.equal(due({ signature: 'other' }), 'changed');
  assert.equal(due({ lastOutcomeAt: ago(0) }), null, 'a reply waits for the night, so the plan does not move under the thumb');
  assert.equal(due({ trigger: 'nightly', lastOutcomeAt: ago(0) }), 'progress');
  assert.equal(due({ trigger: 'nightly', lastMarkAt: ago(1_000) }), 'progress');
  assert.equal(due({ trigger: 'nightly', lastMarkAt: ago(2 * 86_400_000) }), null, 'a tick from before this plan is already in it');
  assert.equal(due({ trigger: 'nightly', current: cur({ startedAt: ago(ROADMAP_MAX_AGE_DAYS * 86_400_000) }), latest: null }), 'weekly');
  const running = cur({ id: 'x', status: 'running', startedAt: ago(20_000), finishedAt: null });
  assert.equal(due({ latest: running, signature: 'other' }), null, 'never a second draw beside one in flight');
  assert.equal(due({ latest: cur({ status: 'running', startedAt: ago(ROADMAP_STALE_MS + 1) }), signature: 'other' }), 'changed', 'a draw whose process died does not block forever');
  const failedRun = cur({ id: 'f', status: 'error', startedAt: ago(60_000), finishedAt: ago(30_000), roadmap: null, error: 'bad key' });
  assert.equal(due({ latest: failedRun, signature: 'other' }), null, 'opening the app does not retry a failure straight away');
  assert.equal(due({ latest: { ...failedRun, finishedAt: ago(ROADMAP_RETRY_MS + 1) }, signature: 'other' }), 'changed');
  assert.equal(due({ trigger: 'nightly', latest: failedRun, signature: 'other' }), 'changed', 'the night tries again');

  // 8. The view: ticks applied, the newest winning; a reached milestone's steps are not waiting on anyone.
  const marks = [
    { item: week[0].steps[0].id, title: 'Ask shop 1', state: 'done' as const, at: ago(5_000) },
    { item: site.id, title: 'Put the shop online', state: 'done' as const, at: ago(4_000) },
  ];
  const view = roadmapView({ enabled: true, latest: cur(), current: cur(), previous: cur({ roadmap: earlier }), marks, goals: [{ id: 'g1', title: 'Property buy and renovation' }], capacity: 'low', now });
  assert.equal(view.state, 'ready');
  if (view.state === 'ready') {
    assert.equal(view.phases[0].label, 'This week');
    const m0 = view.phases[0].milestones[0];
    assert.equal(m0.goalTitle, 'Property buy and renovation');
    assert.deepEqual(m0.steps.map((s) => s.state), ['done', 'open', 'open']);
    assert.equal(m0.open, 2);
    assert.ok(m0.steps.every((s) => s.fits), 'a quick step fits Low energy');
    const siteView = view.phases[0].milestones.find((m) => m.id === site.id)!;
    assert.equal(siteView.state, 'done');
    assert.equal(siteView.steps[0].state, 'done');
    assert.equal(siteView.steps[0].fits, false, 'a sitting is more than 30 minutes');
    assert.equal(view.done, 1); assert.equal(view.total, 5);
    assert.equal(view.failed, null);
    assert.ok(view.changes?.added.includes('Put the shop online'));
    assert.equal(view.changes?.note, 'Dropped the wholesale buyer, you set it aside.');
  }
  assert.deepEqual(roadmapView({ enabled: false, latest: null, current: null, previous: null, marks: [], goals: [], capacity: 'deep', now }), { state: 'off' }, 'no model and nothing drawn: nothing is said about a plan it cannot draw');
  assert.deepEqual(roadmapView({ enabled: true, latest: running, current: null, previous: null, marks: [], goals: [], capacity: 'deep', now }), { state: 'none', drawing: true, failed: null });
  const broken = roadmapView({ enabled: true, latest: failedRun, current: cur(), previous: null, marks: [], goals: [], capacity: 'deep', now });
  assert.equal(broken.state === 'ready' && broken.failed, 'bad key', 'a failed redraw is said beside the plan it could not replace (invariant 13)');
  assert.equal(roadmapChanges(r, { ...r, changed: null }), null, 'the same plan redrawn is no change');
  assert.deepEqual(roadmapChanges(r, r), { added: [], dropped: [], note: r.changed }, 'but what it says it changed is still said');
  assert.equal(roadmapChanges(null, r), null, 'a first plan changed nothing');

  // 9. The step the plan puts first: yours, open, fitting today, this week or this month.
  const first = roadmapFirstStep(view);
  assert.equal(first?.step.title, 'Ask shop 2', 'the done one is skipped');
  const aiOnly = roadmapView({ enabled: true, latest: null, current: cur({ roadmap: withAi.roadmap }), previous: null, marks: [], goals: [], capacity: 'deep', now });
  assert.equal(roadmapFirstStep(aiOnly), null, 'handed-over work is not a thing to do now');

  // 10. The move: after the drafts and whatever a person is blocking, before the planner's Moves.
  const f0 = { sent: 0, replied: 0, won: 0 };
  const planStep = { item: 's', title: 'Ask shop 2', milestone: 'First sale', size: 'Under 30 min' };
  const nowBase = { noOffer: false, callPending: false, queue: { count: 0, oldestDays: 0 }, asks: [], moves: [{ id: 'm', job: 'goal_gap', kind: 'decide', headline: 'A Move', why: [], artifact: { kind: 'text', label: 'x', value: 'y' }, cost_label: '10 min', status: 'open', created_at: ago(0) }] as never[], capacity: 'moderate' as const, funnel: f0, freshMatches: 0, planStep, hasPlan: true };
  const stepNow = roadmapPathNow(nowBase).now;
  assert.equal(stepNow.kind, 'step'); assert.equal(stepNow.item, 's'); assert.equal(stepNow.cta, 'Mark it done');
  assert.equal(stepNow.why, 'Toward: First sale.', 'the milestone\'s reason is on the plan under it, not said twice');
  assert.equal(stepNow.size, 'Under 30 min · you have 60 min');
  // With a plan the drafts are no longer first by default: the plan said to fix
  // the opener, and the card over it said to send 25 written with the old one.
  const withDrafts = { ...nowBase, queue: { count: 56, oldestDays: 18 }, asks: [{ key: 'queue', kind: 'send' as const, title: '56 drafts ready to send', detail: 'The oldest has waited 18 days' }] };
  const planFirst = roadmapPathNow(withDrafts);
  assert.equal(planFirst.now.kind, 'step', 'the plan decides whether sending is this week');
  assert.deepEqual(planFirst.also.map((a) => a.key), ['queue'], 'the drafts are a chip beside it, one tap away');
  const planSends = roadmapPathNow({ ...withDrafts, planStep: { ...planStep, title: 'Send the waiting drafts', sends: true } });
  assert.equal(planSends.now.kind, 'send', 'when the plan asks for them, it is the send card, sized to the day');
  assert.equal(planSends.now.title, 'Send 10 of your 56 drafts');
  assert.equal(planSends.now.why, 'The oldest has waited 18 days. Your plan puts sending them this week.');
  assert.deepEqual(planSends.also, [], 'and not also a chip');
  const nothingFits = roadmapPathNow({ ...withDrafts, planStep: null });
  assert.equal(nothingFits.now.kind, 'send', 'with nothing of yours that fits today, finished drafts are the best use of it');
  assert.ok(!nothingFits.now.why!.includes('Nothing on this path moves'), 'but a plan never said sending is the path, so neither does the card');
  assert.equal(roadmapPathNow({ ...withDrafts, hasPlan: false, planStep: null }).now.why, 'The oldest has waited 18 days. Nothing on this path moves until something goes out.', 'without a plan, nothing changes');
  const blocked = roadmapPathNow({ ...withDrafts, asks: [{ key: 'q:c1', kind: 'question' as const, title: 'Which of the three?', detail: 'The worker is waiting', id: 'c1' }, ...withDrafts.asks] });
  assert.equal(blocked.now.kind, 'question', 'whatever a person is blocking still comes before the plan');
  assert.equal(roadmapPathNow({ ...nowBase, noOffer: true }).now.kind, 'step', 'with a drawn plan, a blank offer is not the move by default');
  assert.equal(roadmapPathNow({ ...nowBase, noOffer: true, hasPlan: false, planStep: null }).now.kind, 'offer');
  assert.equal(roadmapPathNow({ ...nowBase, planStep: null }).now.kind, 'move');

  // 11. A tick is evidence; one put back is not.
  const evs = roadmapPathEvents({ now, timezone: 'UTC', outcomes: [], focus: [], commissions: [], decisions: [], marks: [
    { item: 'a', title: 'Ask shop 1', state: 'done', at: ago(3_600_000) },
    { item: 'b', title: 'Pick a platform', state: 'done', at: ago(7_200_000) },
    { item: 'b', title: 'Pick a platform', state: 'open', at: ago(3_000_000) },
    { item: 'c', title: 'Long ago', state: 'done', at: ago(30 * 86_400_000) },
  ] });
  assert.deepEqual(evs.map((e) => [e.title, e.detail]), [['Ask shop 1', 'Ticked off on your plan']]);

  // 12. The fortnight, said from rows, newest first; hours summed by what they were on.
  const lines = happenedLines({
    outcomes: [
      { id: 'o1', kind: 'won', amount: 500, currency: '€', note: 'Paid in cash', source: 'manual', occurred_at: '2026-09-25T10:00:00Z', opportunity_id: null, commission_id: null, who: 'Casa Blanca' },
      { id: 'o2', kind: 'no_reply', amount: null, currency: null, note: null, source: 'system', occurred_at: '2026-09-26T10:00:00Z', opportunity_id: null, commission_id: null, who: null },
    ],
    focus: [
      { id: 'f1', minutes: 60, on: '2026-09-24', note: 'Reshaped app', at: '2026-09-24T20:00:00Z' },
      { id: 'f2', minutes: 90, on: '2026-09-26', note: 'Reshaped app', at: '2026-09-26T20:00:00Z' },
    ],
    answered: [{ id: 'm', job: 'x', kind: 'decide', headline: 'Apply to the coordinator role', status: 'done', acted_at: '2026-09-23T09:00:00Z' }],
    finished: [{ objective: 'Compare wholesale marketplaces', closedAt: '2026-09-22T09:00:00Z', outcome: 'Three fit' }],
    currency: '€',
  });
  assert.deepEqual(lines, [
    '2.5h logged on Reshaped app',
    '2026-09-25: a client won (Casa Blanca) for €500 — "Paid in cash"',
    'Did a suggestion: Apply to the coordinator role',
    'Research finished: Compare wholesale marketplaces — Three fit',
  ]);

  // 13. The goals where the plan ends: every one, in order, with what leads to it.
  const markers = goalMarkers([
    { id: 'g1', title: 'Property buy and renovation', metric: 'currency', unit: '€', target_value: 60000, current_value: 1000, horizon_days: 180, created_at: '2026-06-01T10:00:00Z' },
    { id: 'g2', title: 'Learn Spanish', metric: 'none', unit: null, target_value: null, current_value: null, horizon_days: null },
  ], view, '$', '2026-09-26', new Map([['g1', 'Off track']]));
  // The date counted down (written 1 Jun with 180 days: 28 Nov), never "Within
  // 180 days, as you set it" — which never moved, under goals whose sheet had no
  // date field to set.
  assert.deepEqual(markers.map((g) => [g.status, g.horizon, g.toward, g.verdict]), [
    ['€1,000 of €60,000', 'By 28 Nov · 63 days left', 1, 'Off track'],
    [null, null, 0, null],
  ], 'a reached milestone no longer leads anywhere; a goal nothing serves says so');

  // 14. The night reports the plan like any other step, and a skip that is news is said.
  assert.deepEqual(roadmapNightlyLines({ roadmap: { drawn: true, reason: 'progress' } }).filter((l) => l.step === 'roadmap').map((l) => [l.tone, l.text]), [['ok', 'Redrew your plan from what came back']]);
  assert.deepEqual(roadmapNightlyLines({ roadmap: { skipped: 'nothing changed since the last plan' } }).filter((l) => l.step === 'roadmap').map((l) => l.text), ['Kept your plan · nothing changed since it was drawn']);
  assert.deepEqual(roadmapNightlyLines({ roadmap: { error: 'timeout' } }).filter((l) => l.step === 'roadmap').map((l) => [l.tone, l.text]), [['broke', 'Could not redraw your plan: timeout']]);
  assert.equal(roadmapNightlyLines({ roadmap: { skipped: 'no model set up' } }).filter((l) => l.step === 'roadmap').length, 0, 'not configured is not news');

  console.log('copilot-core: drawn plan checks passed');
}

drawnPlan().catch((e) => { console.error(e); process.exit(1); });

/* ─── The drawn plan, second pass: what the first live plans showed ─────── */
import { goalLayout as rmGoalLayout, parseRoadmap as rmParse, planServesOneGoal as rmOneGoal, roadmapView as rmView, sourcedFrom as rmSourced, type RoadmapRun as RmRun } from '../../src/lib/copilot/roadmap';
import { quietEvidence } from '../../src/lib/copilot/pathway';

async function drawnPlanSecondPass() {
  const src = rmSourced('Goal: €1,000 of €60,000 · within 180 days');
  const parse = (direction: string) => rmParse({ direction, phases: [{ key: 'week', milestones: [{ id: 'm', title: 'A first sale' }] }] }, { allowed: src, goalIds: [], aiAvailable: false })!.roadmap.direction;

  // 1. Reasoning is cut at the last whole sentence that fits, never mid-thought.
  const long = `${'Income first, because the property needs a bigger source than stalls. '.repeat(5)}The renovation research you finished stays as reference; nothing new on renovation until the income is steady.`;
  const cut = parse(long)!;
  assert.ok(cut.endsWith('stalls.'), `ends on a sentence, got: …${cut.slice(-30)}`);
  assert.ok(cut.length <= 420);
  assert.equal(parse('Short and whole.'), 'Short and whole.');
  const noStop = parse(`${'word '.repeat(120)}`)!;
  assert.ok(noStop.endsWith('…') && !noStop.endsWith(' …'), 'with no sentence to end on, cut at a word and say so');

  // 2. The goals: the first always, any the plan leads to, and the rest folded into one line.
  const g = (id: string, toward: number) => ({ id, title: id, status: null, progress: null, horizon: null, toward });
  const laid = rmGoalLayout([g('exit', 6), g('macbook', 1), g('job', 2), g('arr', 0), g('daily', 0), g('emergency', 0), g('app', 0)]);
  assert.deepEqual(laid.shown.map((x) => x.id), ['exit', 'macbook', 'job']);
  assert.deepEqual(laid.waiting.map((x) => x.id), ['arr', 'daily', 'emergency', 'app'], 'five "nothing leads here yet" rows became one line');
  assert.deepEqual(rmGoalLayout([g('first', 0), g('second', 0)]).shown.map((x) => x.id), ['first'], 'the first goal shows even before a plan leads to it');
  assert.deepEqual(rmGoalLayout([]), { shown: [], waiting: [] });

  // 3. "For <goal>" only where milestones serve different goals.
  const run = (goals: Array<string | null>): RmRun => ({
    id: 'r', status: 'ok', reason: null, signature: 's', startedAt: '2026-09-27T00:00:00Z', finishedAt: '2026-09-27T00:01:00Z', error: null,
    roadmap: { here: null, direction: null, changed: null, phases: [{ key: 'week', milestones: goals.map((goalId, i) => ({ id: `m${i}`, title: `M${i}`, why: null, doneWhen: null, goalId, steps: [] })) }] },
  });
  const view = (goals: Array<string | null>) => rmView({ enabled: true, latest: run(goals), current: run(goals), previous: null, marks: [], goals: [], capacity: 'deep', now: new Date('2026-09-27T12:00:00Z') });
  assert.equal(rmOneGoal(view(['g1', 'g1', 'g1'])), true, 'Maria: seven milestones, one goal, one label would say it seven times');
  assert.equal(rmOneGoal(view(['g1', 'g2', 'g1'])), false, 'Alex: the exit and the job, so each says which');
  assert.equal(rmOneGoal(view(['g1', null])), false, 'a milestone serving no goal is worth telling apart');

  // 4. The empty evidence agrees with the dots under it.
  assert.equal(quietEvidence({ sentFortnight: 0, movedDays: 1, planned: true }).title, 'Nothing came back yet', 'a green Thursday is not "nothing recorded"');
  assert.match(quietEvidence({ sentFortnight: 0, movedDays: 1, planned: true }).detail, /moved it forward on 1 day this week/);
  assert.equal(quietEvidence({ sentFortnight: 0, movedDays: 0, planned: true }).title, 'Nothing recorded in the last two weeks');
  assert.equal(quietEvidence({ sentFortnight: 9, movedDays: 3, planned: true }).detail, '9 sent in that time. Answers, payments and results show here as they arrive.');
  assert.equal(quietEvidence({ sentFortnight: 0, movedDays: 0, planned: false }).detail, '0 sent in that time. Answers, payments and results show here as they arrive.', 'without a plan, the funnel copy stands');

  console.log('copilot-core: drawn plan second pass checks passed');
}

drawnPlanSecondPass().catch((e) => { console.error(e); process.exit(1); });

/* ─── One planner: the call is the plan's next step ──────────────────────── */
import { MONEY_WAITING_DAYS, PLAN_TOPIC, moneyWaiting, planCall, roadmapPrompt as rpPrompt, stepForCall } from '../../src/lib/copilot/roadmap';
import { NIGHTLY_STEPS as NIGHT_ORDER, nightlyLines as nightOrderLines } from '../../src/lib/copilot/nightly';

async function onePlanner() {
  // 1. The plan's step is the call, with what arbitration would have picked named as the trade-off.
  const first = { step: { title: 'Rewrite the opener around missed booking calls' }, milestone: { title: 'First real reply that can become a $150 sale', why: 'Nothing has worked yet, so the message changes before the volume does.' } };
  const call = planCall(first, { headline: 'Apply today to the Maintenance Coordinator role' })!;
  assert.equal(call.headline, 'Rewrite the opener around missed booking calls');
  assert.deepEqual(call.because, ['It is the next step toward: First real reply that can become a $150 sale.', 'Nothing has worked yet, so the message changes before the volume does.']);
  assert.equal(call.instead_of, 'Apply today to the Maintenance Coordinator role', 'the Move it was chosen over is named, not hidden');
  assert.equal(call.topic, PLAN_TOPIC);
  assert.equal(call.verify_metric, 'none', 'a plan step stakes nothing on a number, so it is graded done or not');
  assert.equal(call.source_move_id, undefined, 'and it answers no Move: the runner-up stays on the list');
  assert.equal(planCall(null, null), null, 'no step that fits today, no plan call — the ladder picks');
  assert.equal(planCall(first, { headline: first.step.title })!.instead_of, undefined, 'a trade-off with itself is not one');
  assert.deepEqual(planCall({ ...first, milestone: { ...first.milestone, why: null } }, null)!.because, ['It is the next step toward: First real reply that can become a $150 sale.']);

  // 2. Only money due soon outranks the plan for the call.
  const due = (job: string, value: number | undefined, withinDays: number) => ({ job, stake: { value, withinDays } });
  assert.equal(moneyWaiting(due('obligations', 400, 3)), true, 'a deposit owed this week');
  assert.equal(moneyWaiting(due('client_delivery', 150, MONEY_WAITING_DAYS)), true, 'a client who paid and is waiting');
  assert.equal(moneyWaiting(due('goal_gap', 1500, 90)), false, 'a goal gap is due at its horizon, and it is what the plan is ordered against');
  assert.equal(moneyWaiting(due('goal_gap', 1500, 3)), false, 'even three days out: the plan is ordered against that gap');
  assert.equal(moneyWaiting(due('obligations', undefined, 1)), false, 'urgent with no money is the plan’s to order');
  assert.equal(moneyWaiting(null), false);
  assert.equal(moneyWaiting({ job: 'obligations', stake: null }), false);
  // The send queue values ten sends at what sends have earned and dates it by
  // when the drafts go cold: an expected value due "tomorrow", every night. It
  // kept "send 10 of your 57 drafts" as the call over a plan that said the
  // opener behind them had never been answered.
  assert.equal(moneyWaiting(due('send_queue', 12, 1)), false, 'what sends might earn is not money owed');
  assert.equal(moneyWaiting(due('repeat_customer', 300, 3)), false, 'a past customer is an opening, not a debt');

  // 3. Answering the call finds its step by its words.
  const roadmap = { here: null, direction: null, changed: null, phases: [{ key: 'week' as const, milestones: [{ id: 'm', title: 'M', why: null, doneWhen: null, goalId: null, steps: [{ id: 'rewrite', title: first.step.title, size: 'sitting' as const, tag: 'leverage' as const, who: 'you' as const }] }] }] };
  assert.deepEqual(stepForCall(roadmap, first.step.title), { id: 'rewrite', title: first.step.title });
  assert.equal(stepForCall(roadmap, 'Something the plan never said'), null, 'a call from somewhere else ticks nothing');
  assert.equal(stepForCall(null, first.step.title), null);

  // 4. The plan is drawn before the call is picked from it, and the report reads in that order.
  assert.deepEqual(NIGHT_ORDER, ['supply', 'reconcile', 'jobs', 'roadmap', 'brief']);
  const order = nightOrderLines({ jobs: { ran: 3, written: 1 }, roadmap: { drawn: true, reason: 'progress' }, brief: { agent: 'llm' } }).map((l) => l.step);
  assert.ok(order.indexOf('roadmap') < order.indexOf('brief'), 'Plan is reported before Call');

  // 5. The plan sees what the checks found.
  const base = {
    today: '2026-09-27', name: 'A', headline: null, location: null, capacity: 'deep' as const, currency: '$', runwayMonths: null, offer: null, price: null,
    goals: [], working: '', notes: [], funnel: { windowDays: 30, sent: 0, replied: 0, won: 0, wonAmount: 0 }, happened: [], previous: [], aiAvailable: false,
  };
  assert.match(rpPrompt({ ...base, found: ['Casa Blanca paid 3 days ago and nothing was delivered'] }), /WHAT THE APP'S CHECKS FOUND, waiting on an answer:\n- Casa Blanca paid 3 days ago/);
  assert.ok(!/CHECKS FOUND/.test(rpPrompt(base)), 'nothing found, no section');

  console.log('copilot-core: one planner checks passed');
}

onePlanner().catch((e) => { console.error(e); process.exit(1); });

/* ─── The plan points the search and the ranking ─────────────────────────── */
import { MAX_FOCUS, planFocus } from '../../src/lib/copilot/roadmap';
import { PLAN_SYSTEM as HUNT_SYSTEM, planPrompt as huntPlanPrompt } from '../../src/lib/copilot/hunts';
import { SYSTEM_PROMPT as BRIEF_SYSTEM } from '../../src/lib/copilot/agent/schema';

async function planPointsTheSearch() {
  const step = (id: string, title: string) => ({ id, title, size: 'quick' as const, tag: 'quick_win' as const, who: 'you' as const });
  const ms = (id: string, title: string, steps: ReturnType<typeof step>[] = []) => ({ id, title, why: 'A reason the model wrote', doneWhen: null, goalId: null, steps });
  const roadmap = {
    here: null, direction: 'Its reasoning', changed: null,
    phases: [
      { key: 'week' as const, milestones: [ms('markets', 'Have your next market days booked', [step('book', 'Contact market organizers'), step('list', 'List three markets')]), ms('margin', 'Know what each piece earns')] },
      { key: 'month' as const, milestones: [ms('earn', 'Earn more per market day')] },
      { key: 'quarter' as const, milestones: [ms('between', 'Sell between market days')] },
    ],
  };

  // 1. Open milestones this week and this month, with the unticked steps: titles only.
  const at = '2026-09-27T10:00:00Z';
  const focus = planFocus(roadmap, [{ item: 'list', title: '', state: 'done', at }, { item: 'margin', title: '', state: 'done', at }]);
  assert.deepEqual(focus, [
    'This week: Have your next market days booked — next: Contact market organizers',
    'This month: Earn more per market day',
  ], 'ticked steps and reached milestones are not searched for; the quarter is too far out to search for yet');
  assert.ok(!focus.join(' ').includes('reason') && !focus.join(' ').includes('reasoning'), 'never the plan’s reasons (roadmap.ts rule 3)');
  assert.deepEqual(planFocus(null, []), []);
  const many = { ...roadmap, phases: [{ key: 'week' as const, milestones: Array.from({ length: 10 }, (_, i) => ms(`m${i}`, `M${i}`)) }] };
  assert.equal(planFocus(many, []).length, MAX_FOCUS);

  // 2. The search planner is told what the plan is working on, and to look for who it needs.
  const prompt = huntPlanPrompt({ offer: { sells: 'Stainless steel jewellery', for_who: 'market shoppers' }, area: 'Valencia, Spain', working: '', goals: ['Property buy and renovation'], existing: [], plan: focus });
  assert.match(prompt, /What their plan is working on now:\n- This week: Have your next market days booked/);
  assert.ok(!huntPlanPrompt({ offer: { sells: 'x' }, area: null, working: '', goals: [], existing: [] }).includes('plan is working on'), 'no plan, no section');
  assert.match(HUNT_SYSTEM, /Their plan comes first/);
  assert.match(HUNT_SYSTEM, /market organiser for "market days booked"/);

  // 3. The ranker reads the plan too, and is told what it is and is not.
  assert.ok(BRIEF_SYSTEM.includes('PLAN:'), 'a field the prompt never names is a field the model ignores');
  assert.match(BRIEF_SYSTEM, /Never add to it and never describe it as done/);

  console.log('copilot-core: plan points the search checks passed');
}

planPointsTheSearch().catch((e) => { console.error(e); process.exit(1); });

/* ─── Notes close the loop: suggested ticks, never ticks ─────────────────── */
import { ROADMAP_SYSTEM as RM_SYSTEM, openIds, parseRoadmap as rmParseSuggest, roadmapRunFromRow as rmRow, roadmapView as rmViewSuggest, sourcedFrom as rmSrc } from '../../src/lib/copilot/roadmap';

async function suggestedTicks() {
  const step = (id: string, title: string) => ({ id, title, size: 'quick' as const, tag: 'quick_win' as const, who: 'you' as const });
  const last = { here: null, direction: null, changed: null, phases: [{ key: 'week' as const, milestones: [{ id: 'markets', title: 'Have your next market days booked', why: null, doneWhen: null, goalId: null, steps: [step('book', 'Contact market organizers'), step('costs', 'List what each piece costs')] }] }] };
  const at = '2026-09-26T10:00:00Z';
  const previousOpen = openIds(last, [{ item: 'costs', title: 'List what each piece costs', state: 'done', at }]);
  assert.deepEqual([...previousOpen].sort(), ['book', 'markets'], 'a ticked step is not open, so it cannot be suggested again');

  // 1. Only ids open on the last plan and still on this one survive.
  const raw = {
    probably_done: ['book', 'costs', 'invented', 42, 'markets'],
    phases: [{ key: 'week', milestones: [{ id: 'markets', title: 'Have your next market days booked', steps: [{ id: 'book', title: 'Contact market organizers' }, { id: 'costs', title: 'List what each piece costs' }] }] }],
  };
  const parsed = rmParseSuggest(raw, { allowed: rmSrc(''), goalIds: [], aiAvailable: false, previousOpen })!;
  assert.deepEqual(parsed.roadmap.suggestedDone, ['book', 'markets'], 'not a ticked step, not an id nobody drew, not a number');
  const none = rmParseSuggest({ phases: raw.phases }, { allowed: rmSrc(''), goalIds: [], aiAvailable: false, previousOpen })!;
  assert.equal(none.roadmap.suggestedDone, undefined, 'nothing said, nothing asked');
  assert.match(RM_SYSTEM, /probably_done/);
  assert.match(RM_SYSTEM, /Only from their words, never from silence/);

  // 2. The view asks only about what is still open, in the plan's own words.
  const run = rmRow({ id: 'r', status: 'ok', started_at: at, finished_at: at, output: { roadmap: parsed.roadmap }, error: null, input_summary: { signature: 's' } });
  const view = (marks: Array<{ item: string; title: string; state: 'done' | 'dropped' | 'open'; at: string }>) =>
    rmViewSuggest({ enabled: true, latest: run, current: run, previous: null, marks, goals: [], capacity: 'moderate', now: new Date('2026-09-27T12:00:00Z') });
  const v = view([]);
  assert.deepEqual(v.state === 'ready' && v.suggested, [{ id: 'book', title: 'Contact market organizers' }, { id: 'markets', title: 'Have your next market days booked' }]);
  const answered = view([{ item: 'book', title: '', state: 'done', at: '2026-09-27T11:00:00Z' }, { item: 'markets', title: '', state: 'dropped', at: '2026-09-27T11:00:00Z' }]);
  assert.deepEqual(answered.state === 'ready' && answered.suggested, [], 'a tick or a "not for me" answers the question');
  assert.equal(v.state === 'ready' && v.phases[0].milestones[0].steps[0].state, 'open', 'a suggestion is never itself a tick');
  const older = rmRow({ id: 'o', status: 'ok', started_at: at, finished_at: at, output: { roadmap: { phases: raw.phases } }, error: null, input_summary: {} });
  assert.deepEqual(older.roadmap?.suggestedDone, [], 'a plan drawn before suggestions reads as none');

  console.log('copilot-core: suggested ticks checks passed');
}

suggestedTicks().catch((e) => { console.error(e); process.exit(1); });

/* ─── Judgement: real dates, will it work, the record, one experiment ─────── */
import { DEFAULT_HORIZON_DAYS, dateLabel, daysPhrase, dueLabel, goalDue, horizonFor } from '../../src/lib/copilot/due';
import { CARRIED_PLANS, MAX_SIGNALS, VERDICT_WORDS, carriedSteps, goalOutlook, outlookLine, outlookSignals, type OutlookInput } from '../../src/lib/copilot/outlook';
import { settledTally } from '../../src/lib/copilot/conversations';
import {
  ANGLES, CHECK_MAX, CHECK_MIN, OFFER_DAYS, PAUSE_DAYS, PERSON_STATES, angleLines, angleRecord, contentWords, experimentMarkFromEvent, experimentView, isNovel, isOpen,
  ledgerLines, parseExperiment, paused, staleOffer, storedExperiment, type Experiment, type ExperimentMark,
} from '../../src/lib/copilot/experiment';
import {
  DEFAULT_AGENT_CAN, ROADMAP_SYSTEM as J_SYSTEM, parseRoadmap as jParse, replacesCall, roadmapPrompt as jPrompt, roadmapRunFromRow as jRow, roadmapStep, roadmapView as jView,
  sourcedFrom as jSourced, unsourced as jUnsourced,
} from '../../src/lib/copilot/roadmap';
import { pathPast as jPast } from '../../src/lib/copilot/pathway';
import { nightlyLines as jNightly } from '../../src/lib/copilot/nightly';

async function dueDates() {
  // 1. The date is written + horizon, and the days count down from today.
  const g = { horizon_days: 90, created_at: '2026-09-01T08:00:00Z' };
  assert.deepEqual(goalDue(g, '2026-09-01'), { dueOn: '2026-11-30', daysLeft: 90 });
  assert.deepEqual(goalDue(g, '2026-09-28'), { dueOn: '2026-11-30', daysLeft: 63 }, 'twenty-seven days on, sixty-three are left — not ninety');
  assert.equal(goalDue(g, '2026-12-03')?.daysLeft, -3);
  // Without the day it was written, or with no horizon, there is no date — never the horizon read as days left.
  assert.equal(goalDue({ horizon_days: 90 }, '2026-09-28'), null);
  assert.equal(goalDue({ horizon_days: null, created_at: g.created_at }, '2026-09-28'), null);
  assert.equal(goalDue({ horizon_days: 0, created_at: g.created_at }, '2026-09-28'), null);

  // 2. A date picked in the sheet is stored as the horizon that lands on it.
  assert.equal(horizonFor('2026-11-30', '2026-09-01T08:00:00Z', '2026-09-28'), 90);
  assert.equal(horizonFor('2026-10-28', null, '2026-09-28'), 30, 'a new goal counts from today');
  assert.equal(horizonFor('2026-09-01', '2026-09-01T08:00:00Z', '2026-09-28'), null, 'not on or before the day it was written');
  assert.equal(horizonFor('30 Nov', null, '2026-09-28'), null, 'only a real date');
  assert.deepEqual(goalDue({ horizon_days: horizonFor('2026-11-30', '2026-09-01T08:00:00Z', '2026-09-28'), created_at: '2026-09-01T08:00:00Z' }, '2026-09-28')?.dueOn, '2026-11-30', 'round trip');

  // 3. Said as a person says it.
  assert.equal(dueLabel(goalDue(g, '2026-09-28'), '2026-09-28'), 'By 30 Nov · 63 days left');
  assert.equal(dueLabel(goalDue(g, '2026-11-29'), '2026-11-29'), 'By 30 Nov · 1 day left');
  assert.equal(dueLabel(goalDue(g, '2026-11-30'), '2026-11-30'), 'Due today');
  assert.equal(dueLabel(goalDue(g, '2026-12-03'), '2026-12-03'), '3 days past its date');
  assert.equal(dueLabel(null, '2026-09-28'), null);
  assert.equal(dateLabel('2027-03-26', '2026-09-28'), '26 Mar 2027', 'another year says so');
  assert.equal(daysPhrase({ dueOn: '2026-11-30', daysLeft: 63 }), '63 days left');
  assert.equal(DEFAULT_HORIZON_DAYS, 90, 'the table default the planner is warned about');

  console.log('copilot-core: due dates checks passed');
}

dueDates().catch((e) => { console.error(e); process.exit(1); });

async function willItWork() {
  const today = '2026-09-28';
  const base: OutlookInput = {
    today, price: 150, selling: true, currency: '$', capacity: 'deep',
    funnel: { windowDays: 30, sent: 9, won: 0, wonAmount: 0 },
  };
  // Written 28 Sep with 63 days on it: due 30 Nov.
  const exit = { id: 'g1', title: 'Save Exit PH [NOV]', metric: 'currency' as const, unit: '$', target_value: 1500, current_value: 0, horizon_days: 63, created_at: '2026-09-28T01:00:00Z' };

  // 1. The account in the screenshots: ten sales needed, nine sends, no rate yet.
  const early = goalOutlook(exit, base);
  assert.equal(early.verdict, 'too_early');
  assert.equal(early.line, '10 sales at your $150 in 63 days. 9 sends so far: 11 more and the rate is a number.');
  assert.equal(outlookLine(early), 'Save Exit PH [NOV] — Too early to tell. 10 sales at your $150 in 63 days. 9 sends so far: 11 more and the rate is a number.');
  assert.match(goalOutlook(exit, { ...base, funnel: { ...base.funnel, sent: 0 } }).line, /Nothing sent yet, so there is no rate to plan on/);

  // 2. Enough sends and no sale: off track, and said as arithmetic, not an opinion.
  const dry = goalOutlook(exit, { ...base, funnel: { windowDays: 30, sent: 24, won: 0, wonAmount: 0 } });
  assert.equal(dry.verdict, 'off_track');
  assert.match(dry.line, /no sale from 24 sends in the last 30 days\. At that rate nothing closes it\./);

  // 3. A real rate: money per send, from what the sends actually earned.
  const rated = (days: number) => goalOutlook({ ...exit, horizon_days: days }, { ...base, funnel: { windowDays: 30, sent: 40, won: 2, wonAmount: 300 } });
  assert.equal(rated(63).verdict, 'on_track', '200 sends is 8 days of Deep focus, well inside 63');
  assert.equal(rated(63).line, '10 sales at your $150 in 63 days: about 200 sends at what yours have earned ($300 from 40 sends), 8 days of sending at Deep focus.');
  assert.equal(rated(10).verdict, 'tight', 'eight of ten days is no room for a bad week');
  assert.equal(rated(5).verdict, 'off_track');

  // 4. THE $1 WIN. Two "sales" worth $1 each are not two sales at $150: counted
  //    by what they earned, the same sends are a plan that never gets there.
  const junk = goalOutlook(exit, { ...base, funnel: { windowDays: 30, sent: 20, won: 2, wonAmount: 2 } });
  assert.equal(junk.verdict, 'off_track');
  assert.match(junk.line, /\$2 from 20 sends/);

  // 5. The order of the early answers.
  assert.equal(goalOutlook({ ...exit, current_value: 1500 }, base).verdict, 'reached');
  const undated = goalOutlook({ ...exit, horizon_days: null }, base);
  assert.equal(undated.verdict, 'no_date');
  assert.equal(undated.line, '$1,500 to go. Give it a date and this says whether your pace gets there.', 'the chip says no date; the line says what would fix it');
  const late = goalOutlook({ ...exit, created_at: '2026-06-01T00:00:00Z', horizon_days: 30 }, base);
  assert.equal(late.verdict, 'off_track');
  assert.match(late.line, /^Its date has passed with \$1,500 to go/);

  // 6. Not every goal is a sale. A job, a skill: measured by the plan's milestones.
  const job = { id: 'g5', title: 'Get a job', metric: 'none' as const, unit: null, target_value: null, current_value: null, horizon_days: 63, created_at: '2026-09-28T01:00:00Z' };
  const jobOut = goalOutlook(job, { ...base, milestones: { g5: { done: 1, open: 2 } } });
  assert.equal(jobOut.verdict, 'no_number');
  assert.equal(jobOut.line, "The plan's milestones are the measure: 1 of 3 milestones reached, 63 days left.");
  assert.match(goalOutlook(job, base).line, /^Nothing here can say whether it is on track/);

  // 7. Money nobody is selling toward: the pace it needs, and the pace the app can see.
  const savings = { ...exit, id: 'g2', title: 'MacBook fund', target_value: 2000 };
  const noSelling = { ...base, selling: false, price: null };
  const blind = goalOutlook(savings, noSelling);
  assert.equal(blind.verdict, 'too_early');
  assert.equal(blind.line, '$2,000 to go in 63 days: about $222 a week. Nothing in the app measures your pace on it yet.');
  const paid = goalOutlook(savings, { ...noSelling, funnel: { windowDays: 30, sent: 0, won: 3, wonAmount: 1800 } });
  assert.equal(paid.verdict, 'on_track', '$420 a week against $222 needed');
  assert.match(paid.line, /You were paid \$1,800 in the last 30 days, about \$420 a week\./);
  // A count, due inside two weeks: per day, rounded up — "0 a week" is never said.
  const count = { id: 'g6', title: 'Applications sent', metric: 'number' as const, unit: 'applications', target_value: 10, current_value: 4, horizon_days: 10, created_at: '2026-09-28T01:00:00Z' };
  assert.equal(goalOutlook(count, base).line, '6 applications to go in 10 days: about 1 a day. Nothing in the app measures your pace on it yet.');

  // 8. No verdict ever carries a NaN, an Infinity or a probability.
  for (const o of [early, dry, rated(63), junk, undated, late, jobOut, blind, paid]) {
    assert.ok(!/NaN|Infinity|%/.test(o.line), o.line);
    assert.ok(VERDICT_WORDS[o.verdict]);
  }

  console.log('copilot-core: will it work checks passed');
}

willItWork().catch((e) => { console.error(e); process.exit(1); });

async function recordSignals() {
  // 1. The opener: the funnel checkpoint's own rule, and silent below its sample.
  assert.deepEqual(outlookSignals({ settled: { sends: 19, answered: 0 } }), [], 'nineteen sends is a bad week, not a verdict');
  const dead = outlookSignals({ settled: { sends: 20, answered: 0 } });
  assert.equal(dead[0].key, 'opener');
  assert.match(dead[0].line, /^No reply from the last 20 messages that have had three days to answer\. Change the first line or the list/);
  assert.match(outlookSignals({ settled: { sends: 24, answered: 1 } })[0].line, /^1 reply from the last 24 messages .* under the 2 in 20 this app plans on/);
  assert.deepEqual(outlookSignals({ settled: { sends: 24, answered: 2 } }), [], 'two in twenty is working');

  // 2. The call record, in people's words — never a job key.
  const avoided = outlookSignals({ calls: { avoided: { topic: 'send_queue', count: 4 }, dead: null, total: 6 } });
  assert.equal(avoided[0].line, '4 of the last 6 calls were about sending the drafts and none was done. Either it is the wrong move or something is in the way.');
  assert.match(outlookSignals({ calls: { avoided: { topic: 'plan', count: 3 }, dead: null, total: 5 } })[0].line, /about steps from your plan/);
  assert.match(outlookSignals({ calls: { avoided: null, dead: { topic: 'opener', count: 3 }, total: 8 } })[0].line, /about the opener; they were done and the number did not move/);

  // 3. A step carried plan after plan, by id, and only while nobody has ticked it.
  const plan = (ids: string[]) => ({ phases: [{ milestones: [{ steps: ids.map((id) => ({ id, title: `Step ${id}` })) }] }] });
  const plans = [plan(['a', 'b', 'c']), plan(['a', 'b']), plan(['a']), plan(['x'])];
  const carried = carriedSteps(plans, (id) => id !== 'c');
  assert.deepEqual(carried, [{ title: 'Step a', plans: 3 }, { title: 'Step b', plans: 2 }], 'counted in a row, newest first, a ticked step left out');
  assert.equal(carriedSteps([], () => true).length, 0);
  const stuck = outlookSignals({ carried });
  assert.deepEqual(stuck.map((x) => x.line), [`On ${CARRIED_PLANS} plans in a row and still not done: Step a. Drop it, make it smaller, or hand it over.`]);
  // Several stuck steps are one fact, said once: Alex's plan printed three
  // identical rows of "On 3 plans in a row and still not done".
  const many = outlookSignals({ carried: [1, 2, 3, 4, 5].map((n) => ({ title: `S${n}`, plans: 7 - n })) });
  assert.equal(many.length, 1, 'one line for every stuck step');
  assert.equal(many[0].line, `4 steps on ${CARRIED_PLANS} or more plans in a row and still not done: S1; S2; S3; and 1 more. Drop them, make them smaller, or hand them over.`);
  assert.ok(outlookSignals({ settled: { sends: 30, answered: 0 }, calls: { avoided: { topic: 'plan', count: 3 }, dead: null, total: 3 }, carried: [1, 2, 3, 4, 5].map((n) => ({ title: `S${n}`, plans: 4 })) }).length <= MAX_SIGNALS);

  // 4. The tally behind the opener line: silence counts only once it has had time to be silence.
  const now = new Date('2026-09-28T12:00:00Z');
  const rows = [
    { id: 'old-quiet', sent_at: '2026-09-20T10:00:00Z' },
    { id: 'old-answered', sent_at: '2026-09-19T10:00:00Z' },
    { id: 'new-quiet', sent_at: '2026-09-27T10:00:00Z' },
    { id: 'new-answered', sent_at: '2026-09-27T11:00:00Z' },
    { id: 'never', sent_at: null },
  ];
  assert.deepEqual(settledTally(rows, new Set(['old-answered', 'new-answered']), now), { sends: 3, answered: 2 });

  console.log('copilot-core: record signals checks passed');
}

recordSignals().catch((e) => { console.error(e); process.exit(1); });

async function oneExperiment() {
  const today = '2026-09-28';
  const src = jSourced('Save Exit PH [NOV] · $0 of $1,500 · 9 sends · price $150');
  const keep = (v: unknown, kind: 'target' | 'claim') => (typeof v === 'string' && v.trim() && !jUnsourced(v.trim(), src, kind) ? v.trim() : null);
  const ctx = { keep, goalIds: ['g1'], today, known: ['Reply to the Tampa HVAC owner with your callback automation', 'Apply to two more remote automation or support roles'] };
  const raw = {
    id: 'Pitch the hiring coordinator',
    title: 'Pitch booking automation to the company hiring a maintenance coordinator',
    angle: 'merge_goals',
    goal_id: 'g1',
    why: 'They posted a role that is scheduling by hand, the problem you sell against.',
    test: 'Send one message offering to automate the scheduling before they hire',
    watch: 'A reply asking how it works',
    check_days: 5,
  };

  // 1. Every part is required, and every part is held to the guard.
  const x = parseExperiment(raw, ctx)!;
  assert.equal(x.id, 'x-pitch-the-hiring-coordinator');
  assert.equal(x.angle, 'merge_goals');
  assert.equal(x.goalId, 'g1');
  assert.equal(x.checkDays, 5);
  assert.equal(x.offeredOn, today);
  for (const k of ['title', 'why', 'test', 'watch'] as const) assert.equal(parseExperiment({ ...raw, [k]: '' }, ctx), null, `no ${k}, no experiment`);
  assert.equal(parseExperiment({ ...raw, why: 'Businesses like this reply 40% of the time.' }, ctx), null, 'an unsourced number in the evidence throws it out');
  assert.equal(parseExperiment({ ...raw, goal_id: 'nope', angle: 'vibes', check_days: 90 }, ctx)?.goalId, null);
  assert.equal(parseExperiment({ ...raw, angle: 'vibes' }, ctx)?.angle, 'fast_test', 'an unknown angle lands on a known one');
  assert.equal(parseExperiment({ ...raw, check_days: 90 }, ctx)?.checkDays, CHECK_MAX);
  assert.equal(parseExperiment({ ...raw, check_days: 0 }, ctx)?.checkDays, CHECK_MIN);
  assert.equal(parseExperiment(null, ctx), null);
  assert.equal(ANGLES.length, 8);

  // 2. Novelty: a restatement of what they already have is not an experiment.
  assert.equal(parseExperiment({ ...raw, title: 'Reply to the Tampa HVAC owner about callback automation' }, ctx), null);
  assert.ok(isNovel(raw.title, ctx.known));
  assert.ok(!isNovel('Apply to two more remote support roles', ctx.known));
  assert.ok(contentWords('Send the messages').size === 0, 'generic verbs are not what makes a move new');

  // 3. Its life: offered, tried, due, answered.
  const at = (d: string) => `${d}T09:00:00Z`;
  const mark = (state: ExperimentMark['state'], d: string, extra: Partial<ExperimentMark> = {}): ExperimentMark => ({ id: x.id, title: x.title, angle: x.angle, state, at: at(d), ...extra });
  assert.deepEqual(experimentView(x, [], today), { stage: 'offered', exp: x });
  const trying = experimentView(x, [mark('started', '2026-09-28')], '2026-09-30');
  assert.deepEqual(trying && trying.stage === 'trying' && [trying.checkOn, trying.due], ['2026-10-03', false]);
  const due = experimentView(x, [mark('started', '2026-09-28')], '2026-10-03');
  assert.equal(due && due.stage === 'trying' && due.due, true, 'its check date is here');
  assert.equal(experimentView(x, [mark('started', '2026-09-28'), mark('worked', '2026-10-02')], '2026-10-03'), null, 'answered, it leaves the plan');
  assert.ok(isOpen(x, []) && isOpen(x, [mark('started', today)]) && !isOpen(x, [mark('dropped', today)]));

  // 4. Nobody started it in a week: not wanted — inferred, never asked.
  assert.ok(!staleOffer(x, [], '2026-10-04'));
  assert.ok(staleOffer(x, [], `2026-10-0${5}`), `${OFFER_DAYS} days offered and untouched`);
  assert.ok(!staleOffer(x, [mark('started', '2026-09-29')], '2026-10-20'), 'something being tried is never stale');
  assert.ok(!PERSON_STATES.includes('ignored'), 'nobody posts "ignored": it is inferred');

  // 5. Two set aside in a row: the planner offers none for a while.
  const drop = (id: string, d: string, inferred = false): ExperimentMark => ({ id, title: id, angle: 'resize', state: inferred ? 'ignored' : 'dropped', at: at(d), ...(inferred ? { inferred } : {}) });
  assert.ok(paused([drop('a', '2026-09-20'), drop('b', '2026-09-26')], today));
  assert.ok(!paused([drop('a', '2026-09-10'), drop('b', '2026-09-15')], today), `quiet for ${PAUSE_DAYS} days, then offered again`);
  assert.ok(!paused([drop('a', '2026-09-20'), { ...drop('b', '2026-09-26'), state: 'worked' }], today));
  assert.ok(!paused([drop('a', '2026-09-20'), drop('c', '2026-09-27', true)], today), 'an inferred mark is not the person saying no');

  // 6. The ledger the next plan reads, and the record by angle.
  const ledger: ExperimentMark[] = [
    { id: 'e1', title: 'Email five of them instead', angle: 'change_channel', state: 'failed', at: at('2026-09-10') },
    { id: 'e2', title: 'Offer one setup at the whole gap', angle: 'resize', state: 'worked', at: at('2026-09-20') },
    { id: 'e3', title: 'Call the two warm leads', angle: 'change_channel', state: 'failed', at: at('2026-09-24') },
    { id: 'e4', title: 'Tried once', angle: 'ask_one', state: 'started', at: at('2026-09-27') },
  ];
  assert.deepEqual(ledgerLines(ledger), [
    '(Change the channel) Call the two warm leads — did not work, 2026-09-24',
    '(Change the size) Offer one setup at the whole gap — worked, 2026-09-20',
    '(Change the channel) Email five of them instead — did not work, 2026-09-10',
  ], 'being tried is not an outcome yet');
  assert.deepEqual(angleRecord(ledger).map((r) => [r.angle, r.tried, r.worked, r.failed]), [['change_channel', 2, 0, 2], ['resize', 1, 1, 0]]);
  assert.deepEqual(angleLines(ledger), ['Change the channel: tried 2, worked 0', 'Change the size: tried 1, worked 1']);

  // 7. Events in and out.
  assert.deepEqual(experimentMarkFromEvent({ payload: { experiment: 'x-a', title: 'A', angle: 'resize', state: 'worked' }, created_at: at(today) }), { id: 'x-a', title: 'A', angle: 'resize', state: 'worked', at: at(today) });
  assert.equal(experimentMarkFromEvent({ payload: { experiment: 'x-a', state: 'maybe' }, created_at: at(today) }), null);
  assert.equal(storedExperiment({ id: 'x' }), null, 'a stored experiment missing its parts is none');
  assert.deepEqual(storedExperiment(x), x);

  // 8. Inside the plan: an open one is carried as it is; paused offers none.
  const phases = [{ key: 'week', milestones: [{ id: 'm', title: 'Warm threads answered', steps: [{ id: 's', title: 'Reply to the appointment thread', who: 'ai' }] }] }];
  const base = { allowed: src, goalIds: ['g1'], aiAvailable: true };
  const fresh = jParse({ phases, experiment: raw }, { ...base, experiment: { carry: null, paused: false, known: ctx.known, today } })!;
  assert.equal(fresh.roadmap.experiment?.id, x.id);
  const carried = jParse({ phases, experiment: { ...raw, title: 'Something else entirely new to try' } }, { ...base, experiment: { carry: x, paused: false, known: [], today } })!;
  assert.equal(carried.roadmap.experiment?.title, x.title, 'the open one is carried, whatever the model returns');
  assert.equal(jParse({ phases, experiment: raw }, { ...base, experiment: { carry: null, paused: true, known: [], today } })!.roadmap.experiment, undefined);
  assert.equal(jParse({ phases, experiment: { ...raw, title: 'Reply to the appointment thread today' } }, { ...base, experiment: { carry: null, paused: false, known: [], today } })!.roadmap.experiment, undefined, 'the experiment is never also a step');

  // 9. Stored and read back with its signals and a call that could not follow; the view shows its stage.
  const plan = { ...fresh.roadmap, signals: ['No reply from the last 20 messages that have had three days to answer.'] };
  const run = jRow({ id: 'r', status: 'ok', started_at: at(today), finished_at: at(today), output: { roadmap: plan, callError: 'the row was locked' }, error: null, input_summary: {} });
  assert.deepEqual(run.roadmap?.experiment, x);
  assert.deepEqual(run.roadmap?.signals, plan.signals);
  assert.equal(run.callError, 'the row was locked');
  const view = jView({ enabled: true, latest: run, current: run, previous: null, marks: [], goals: [], capacity: 'deep', now: new Date(at(today)), experimentMarks: [], today });
  assert.ok(view.state === 'ready' && view.experiment?.stage === 'offered' && view.signals.length === 1 && view.callError === 'the row was locked');
  const old = jRow({ id: 'o', status: 'ok', started_at: at(today), finished_at: at(today), output: { roadmap: { phases } }, error: null, input_summary: {} });
  assert.ok(old.roadmap?.experiment === null && old.roadmap?.signals?.length === 0 && old.callError === null, 'a plan from before any of this reads as none');
  assert.deepEqual(roadmapStep(run.roadmap, 's')?.milestone.title, 'Warm threads answered');
  assert.equal(roadmapStep(run.roadmap, 'nope'), null);

  // 10. A verdict is evidence on the Path, in the person's own answer; trying one is not.
  const past = jPast({
    now: new Date('2026-09-30T12:00:00Z'), timezone: 'UTC', outcomes: [], focus: [], commissions: [], decisions: [],
    experiments: [
      { id: x.id, title: x.title, state: 'started', at: at('2026-09-28') },
      { id: x.id, title: x.title, state: 'worked', at: at('2026-09-29') },
      { id: 'x-b', title: 'Asked by the app', state: 'ignored', at: at('2026-09-29'), inferred: true },
    ],
  }, 99);
  const rows = past.days.flatMap((dd) => dd.events);
  assert.deepEqual(rows.map((e) => [e.title, e.detail]), [[`Experiment: ${x.title}`, 'It worked — your answer']]);

  console.log('copilot-core: one experiment checks passed');
}

oneExperiment().catch((e) => { console.error(e); process.exit(1); });

async function callFollowsThePlan() {
  // 1. A call picked before the plan was redrawn moves to the plan's step — only while nobody has answered it.
  const pending = { response: 'pending', headline: 'Send 10 of your 56 drafts' };
  const step = { headline: 'Rewrite the opener around missed booking calls' };
  assert.ok(replacesCall(pending, step, false));
  assert.ok(!replacesCall({ ...pending, response: 'did' }, step, false), 'an answer is part of the record and stays');
  assert.ok(!replacesCall(pending, step, true), 'money due this week keeps its call');
  assert.ok(!replacesCall(pending, null, false), 'a plan with nothing of theirs that fits today takes nothing away');
  assert.ok(!replacesCall({ ...pending, headline: step.headline }, step, false), 'already the plan\'s step');
  assert.ok(!replacesCall(null, step, false));

  // 2. A call that did not save is said, as broken — never only logged.
  const lines = jNightly({ brief: { agent: 'llm', unsaved: 'new row violates check constraint' } });
  assert.deepEqual(lines.filter((l) => l.step === 'brief').map((l) => [l.tone, l.text]), [['broke', 'Picked, but it did not save: new row violates check constraint']]);

  // 3. The planner's contract: the honest read, the record, the experiment, and what the agent may do.
  for (const rule of [/WILL IT WORK/, /WHAT THE RECORD SAYS/, /Never say one thing caused another/, /a plain week beats a clever guess/, /never offer an angle that failed twice/, /within what THE AGENT says it can do/, /never turn a goal that is not about selling into outreach/]) {
    assert.match(J_SYSTEM, rule);
  }
  assert.ok(!/only for research or drafting a machine can do alone on the open web/.test(J_SYSTEM), 'the agent is no longer research-only by rule');

  // 4. The prompt carries every new section, and the agent's reach only when there is an agent.
  const input = {
    today: '2026-09-28', name: 'Alex', headline: null, location: null, capacity: 'deep' as const, currency: '$', runwayMonths: 2, offer: { sells: 'Booking automation' }, price: 150,
    goals: [{ id: 'g1', title: 'Save Exit PH [NOV]', metric: 'currency' as const, unit: '$', target: 1500, current: 0, dueOn: '2026-11-30', daysLeft: 63, defaultDate: true, note: null }],
    working: '', notes: [], funnel: { windowDays: 30, sent: 9, replied: 2, won: 0, wonAmount: 0 }, happened: [], previous: [], aiAvailable: true,
    outlook: ['Save Exit PH [NOV] — Too early to tell. 10 sales at your $150 in 63 days.'],
    signals: ['On 3 plans in a row and still not done: Rewrite the opener.'],
    openers: [{ text: 'Hi, Alex here', replied: false }, { text: 'Saw your post', replied: true }],
    replies: [{ business: 'Tampa HVAC', text: 'How much?' }],
    calls: ['2026-09-27: Send 10 of your 56 drafts — ignored'],
    experiments: { ledger: ['(Change the size) One setup at the whole gap — worked, 2026-09-20'], angles: ['Change the size: tried 1, worked 1'], open: null, openState: null, paused: false },
    agentCan: null,
  };
  const prompt = jPrompt(input);
  for (const part of [
    /due 2026-11-30, 63 days left \(the app gave it this date by default; they may not have chosen it\)/,
    /WILL IT WORK, computed by the app from their rows:\n- Save Exit PH \[NOV\] — Too early to tell/,
    /WHAT THE RECORD SAYS, act on each:\n- On 3 plans in a row/,
    /- ignored: "Hi, Alex here"\n- answered: "Saw your post"/,
    /- Tampa HVAC: "How much\?"/,
    /CALLS THE APP MADE, newest first, and what happened:\n- 2026-09-27: Send 10 of your 56 drafts — ignored/,
    /EXPERIMENTS SO FAR, newest first:\n- \(Change the size\)/,
    /By angle: Change the size: tried 1, worked 1/,
  ]) assert.match(prompt, part);
  assert.ok(prompt.includes(`THE AGENT can do, alone: ${DEFAULT_AGENT_CAN}.`), 'no declaration: the reference worker\'s reach');
  assert.match(jPrompt({ ...input, agentCan: 'build and deploy a landing page, spreadsheets, code' }), /THE AGENT can do, alone: build and deploy a landing page, spreadsheets, code\. It never contacts anyone/);
  assert.ok(!/THE AGENT/.test(jPrompt({ ...input, aiAvailable: false })), 'no agent, nothing said about one');
  const x: Experiment = { id: 'x-a', title: 'Offer one setup at the whole gap', angle: 'resize', goalId: 'g1', why: 'w', test: 't', watch: 'r', checkDays: 7, offeredOn: '2026-09-27' };
  assert.match(jPrompt({ ...input, experiments: { ...input.experiments, open: x, openState: 'started' } }), /THE OPEN EXPERIMENT, carried as it is — offer no other: Offer one setup at the whole gap \(they are trying it\)/);
  assert.match(jPrompt({ ...input, experiments: { ...input.experiments, paused: true } }), /EXPERIMENTS ARE PAUSED/);
  // What the planner may cite: the verdict arithmetic is in its prompt, so the guard lets it through.
  assert.equal(jUnsourced('Ten sales at $150 in 63 days is the whole question.', jSourced(prompt), 'claim'), null);

  console.log('copilot-core: call follows the plan checks passed');
}

callFollowsThePlan().catch((e) => { console.error(e); process.exit(1); });

/* ─── The Path, lighter: what one redraw on Alex's account showed ────────── */
import { ROADMAP_SYSTEM as LT_SYSTEM, parseRoadmap as ltParse, roadmapLeadGoal, roadmapView as ltView, sourcedFrom as ltSourced, type RoadmapRun as LtRun } from '../../src/lib/copilot/roadmap';
import { UnreadableJson, extractJson as ltJson } from '../../src/lib/copilot/agent/schema';

async function pathReadsLight() {
  // 1. Every milestone names its goal. Left unassigned, every goal under the
  //    plan said "Nothing on the plan leads here yet" — the one it put first too.
  const src = ltSourced('GOALS:\n- [g1] Save Exit PH [NOV]\n- [g2] A remote support job');
  const parse = (goal_id: unknown, goalIds: string[]) => ltParse({ phases: [{ key: 'week', milestones: [{ id: 'm', title: 'A first reply to the new opener', goal_id }] }] }, { allowed: src, goalIds, aiAvailable: false })!.roadmap.phases[0].milestones[0].goalId;
  assert.equal(parse('g2', ['g1', 'g2']), 'g2');
  assert.equal(parse('[g2]', ['g1', 'g2']), 'g2', 'the id as GOALS lists it, brackets and all');
  assert.equal(parse(' g1 ', ['g1', 'g2']), 'g1');
  assert.equal(parse('Save Exit PH [NOV]', ['g1', 'g2']), null, 'a title is not an id, and with two goals nothing says which');
  assert.equal(parse(undefined, ['g1', 'g2']), null);
  assert.equal(parse(undefined, ['g1']), 'g1', 'one goal: there is nothing to choose');
  assert.equal(parse('nope', ['g1']), 'g1');
  assert.equal(parse(undefined, []), null, 'no goals, no goal');
  assert.match(LT_SYSTEM, /Give every milestone the goal_id of the goal it serves/);
  assert.match(LT_SYSTEM, /"done_when":"\.\.\.","goal_id":"\.\.\."/, 'the example asks for one');

  // 2. The lines are short and say each fact once, and here.line leaves the verdict to the app, which shows it beside it.
  assert.match(LT_SYSTEM, /here\.line is one sentence of at most 25 words/);
  assert.match(LT_SYSTEM, /Say each fact once/);
  assert.match(LT_SYSTEM, /The app shows that verdict beside here, so do not restate it/);
  assert.ok(!/here\.line says so plainly/.test(LT_SYSTEM), 'the verdict is no longer asked for twice');

  // 3. The goal the plan leads with: its first open milestone's this week or month, else none.
  const run = (phases: Array<{ key: 'week' | 'month' | 'quarter'; goals: Array<string | null> }>): LtRun => ({
    id: 'r', status: 'ok', reason: null, signature: 's', startedAt: '2026-09-28T00:00:00Z', finishedAt: '2026-09-28T00:01:00Z', error: null,
    roadmap: { here: null, direction: null, changed: null, phases: phases.map((p) => ({ key: p.key, milestones: p.goals.map((goalId, i) => ({ id: `${p.key}${i}`, title: `M${i}`, why: null, doneWhen: null, goalId, steps: [] })) })) },
  });
  const view = (r: LtRun, marks: Array<{ item: string; title: string; state: 'done' | 'dropped' | 'open'; at: string }> = []) =>
    ltView({ enabled: true, latest: r, current: r, previous: null, marks, goals: [], capacity: 'deep', now: new Date('2026-09-28T12:00:00Z') });
  assert.equal(roadmapLeadGoal(view(run([{ key: 'week', goals: [null, 'g2'] }, { key: 'month', goals: ['g1'] }]))), 'g2');
  assert.equal(roadmapLeadGoal(view(run([{ key: 'week', goals: ['g2'] }, { key: 'month', goals: ['g1'] }]), [{ item: 'week0', title: 'M0', state: 'done', at: '2026-09-28T01:00:00Z' }])), 'g1', 'a milestone reached no longer leads');
  assert.equal(roadmapLeadGoal(view(run([{ key: 'quarter', goals: ['g1'] }]))), null, 'a quarter away is not what it leads with');
  assert.equal(roadmapLeadGoal({ state: 'off' }), null);

  // 4. A reply that came back unreadable says so as its own kind, which is what earns it one more ask.
  assert.deepEqual(ltJson('{"phases":[{"key":"week","milestones":[{"id":"m","title":"T",}],},]}'), { phases: [{ key: 'week', milestones: [{ id: 'm', title: 'T' }] }] }, 'a trailing comma does not cost a whole plan');
  assert.deepEqual(ltJson('{"a":"x, ]"}'), { a: 'x, ]' }, 'valid JSON is never rewritten');
  assert.throws(() => ltJson('{"phases":[{"key":"week" "milestones":[]}]}'), (e: unknown) => e instanceof UnreadableJson && /JSON/.test(e.message), 'the parser\'s own words, as UnreadableJson');
  assert.throws(() => ltJson('{"phases":[{"key":"week","milestones":[{"id":"m","title":"cut sh'), (e: unknown) => e instanceof UnreadableJson);
  assert.throws(() => ltJson('I could not draw a plan.'), (e: unknown) => e instanceof UnreadableJson && e.message === 'agent returned no JSON object');

  console.log('copilot-core: path reads light checks passed');
}

pathReadsLight().catch((e) => { console.error(e); process.exit(1); });

/* ─── Money, read from the bank ───────────────────────────────────────────── */
import {
  checkBalances as mCheck, counterpartyKey as mKey, displayName as mName, inferDateOrder as mOrder, parseAmount as mAmount,
  parseCsvStatement as mCsv, parseDateCell as mDate, parseOfxStatement as mOfx, rowFingerprints as mPrints, sniffFormat as mSniff,
  statementFromReading as mReading, accountKey as mAccount, dateHintFor as mHint, type Statement as MStatement,
} from '../../src/lib/copilot/money/statement';
import {
  IMPORT_STALE_MS as M_STALE, financeFromRead as mFinance, financeWithoutStatements as mNoStatements, importView as mImport,
  matchWin as mMatch, moneyForPlan as mForPlan, moneyRead as mRead, moneyText as mText, recurringOut as mRecurring,
  suggestOpportunity as mSuggest, winsToRecord as mWins, type LedgerTx as MTx, type Payee as MPayee,
} from '../../src/lib/copilot/money/ledger';
import { chunkPages as mChunks, mergeReadings as mMerge } from '../../src/lib/copilot/money/extract';
import { SENSORS as M_SENSORS, sensorViews as mSensors } from '../../src/lib/copilot/sensors';
import { roadmapPrompt as mPrompt, roadmapSignature as mSignature, type RoadmapInput as MRoadmapInput } from '../../src/lib/copilot/roadmap';

const mPromptBase: MRoadmapInput = {
  today: '2026-09-29', name: 'Alex', headline: null, location: null, capacity: 'deep', currency: '$', runwayMonths: null,
  offer: null, price: null, goals: [], working: '', notes: [], funnel: { windowDays: 30, sent: 0, replied: 0, won: 0, wonAmount: 0 },
  happened: [], previous: [], aiAvailable: false, found: [], drafts: null,
};
import { readFileSync as readMoneyFile } from 'node:fs';

async function moneyFromTheBank() {
  /* 1. Amounts as banks write them — and a currency code is never a debit marker. */
  assert.equal(mAmount('1,234.56'), 1234.56);
  assert.equal(mAmount('1.234,56', ','), 1234.56);
  assert.equal(mAmount('(45.00)'), -45);
  assert.equal(mAmount('45.00-'), -45);
  assert.equal(mAmount('-€45'), -45);
  assert.equal(mAmount('45.00 DR'), -45);
  assert.equal(mAmount('45.00CR'), 45);
  assert.equal(mAmount('PHP 1,200.00'), 1200);
  assert.equal(mAmount('45.00 USD'), 45, 'the D of USD is not a debit');
  assert.equal(mAmount('USD -1,200.00'), -1200);
  assert.equal(mAmount('n/a'), null);
  assert.equal(mAmount(''), null);

  /* 2. Dates: a part over 12 settles the order; otherwise the order that keeps the column sorted; then the hint. */
  assert.equal(mDate('2026-09-12'), '2026-09-12');
  assert.equal(mDate('12/09/2026', 'dmy'), '2026-09-12');
  assert.equal(mDate('12/09/2026', 'mdy'), '2026-12-09');
  assert.equal(mDate('12-Sep-26'), '2026-09-12');
  assert.equal(mDate('Sep 12, 2026'), '2026-09-12');
  assert.equal(mDate('30 septiembre 2026'), '2026-09-30');
  assert.equal(mDate('20260912'), '2026-09-12');
  assert.equal(mDate('31/02/2026'), null, 'not a day');
  assert.equal(mDate('12 Sep'), null, 'a row placed in the wrong year is worse than one left out');
  assert.equal(mOrder(['09/12/2026', '09/13/2026']), 'mdy');
  assert.equal(mOrder(['13/09/2026', '14/09/2026']), 'dmy');
  assert.equal(mOrder(['10/09/2026', '11/09/2026', '01/10/2026'], 'mdy'), 'dmy', 'month-first would read 9 Oct, 9 Nov, 10 Jan — out of order; a statement is sorted');
  assert.equal(mOrder(['01/09/2026', '01/10/2026'], 'mdy'), 'mdy', 'both orders keep these sorted, so the hint decides');
  assert.equal(mHint('America/Chicago'), 'mdy');
  assert.equal(mHint('Asia/Manila'), 'dmy');

  /* 3. CSV exports: a preamble, a dated opening line, debit and credit columns, day-first semicolons. */
  const boa = 'Description,,Summary Amt.\nBeginning balance as of 09/01/2026,,"1,000.00"\n\nDate,Description,Amount,Running Bal.\n09/01/2026,Beginning balance as of 09/01/2026,,"1,000.00"\n09/03/2026,"STARBUCKS #1203, MANILA","-5.50","994.50"\n09/05/2026,"ACME LTD PAYROLL","1,200.00","2,194.50"\n09/13/2026,"RENT SEPT","-800.00","1,394.50"\n';
  const b = mCsv(boa, { dateHint: 'mdy' });
  assert.equal(b.statement.rows.length, 3);
  assert.equal(b.statement.rows[0].description, 'STARBUCKS #1203, MANILA', 'a comma inside quotes is text');
  assert.equal(b.statement.opening, 1000, 'the dated "Beginning balance" line is the opening, not a dropped row');
  const bc = mCheck(b.statement);
  assert.equal(bc.check, 'balanced');
  assert.equal(bc.closing, 1394.5);

  const dc = mCsv('Date,Description,Debit,Credit,Running Balance\n01/09/2026,SALARY ACME,,"2,000.00","2,500.00"\n02/09/2026,LANDLORD,"800.00",,"1,700.00"\n');
  assert.deepEqual(dc.statement.rows.map((r) => r.amount), [2000, -800]);
  assert.equal(mCheck(dc.statement).check, 'balanced');

  const es = mCsv('Fecha operación;Fecha valor;Concepto;Importe;Saldo\n30/09/2026;30/09/2026;TRANSFERENCIA DE JUAN PEREZ;1.250,00;3.410,25\n28/09/2026;28/09/2026;COMPRA MERCADONA;-45,30;2.160,25\n27/09/2026;27/09/2026;RECIBO LUZ;-60,00;2.205,55\n');
  const ec = mCheck(es.statement);
  assert.equal(ec.check, 'balanced', 'newest first is turned round and still chains');
  assert.deepEqual(ec.rows.map((r) => r.on), ['2026-09-27', '2026-09-28', '2026-09-30']);
  assert.equal(ec.opening, 2265.55);

  const monzo = mCsv('Transaction ID,Date,Time,Type,Name,Amount,Currency,Notes and #tags,Description\ntx_0001,12/09/2026,10:00,Card payment,Pret,-4.50,GBP,,PRET A MANGER\n');
  assert.equal(monzo.statement.rows[0].description, 'PRET A MANGER', 'an id column is not part of what it was');
  assert.equal(monzo.statement.rows[0].counterparty, 'Pret', 'a Name column is who it was, kept apart from the description');
  assert.equal(monzo.statement.currency, 'GBP');

  const headerless = mCsv('"09/03/2026","-5.50","*","","STARBUCKS"\n"09/05/2026","1200.00","*","","ACME PAYROLL"\n"09/13/2026","-800.00","*","","RENT"\n', { dateHint: 'mdy' });
  assert.deepEqual(headerless.statement.rows.map((r) => [r.on, r.amount]), [['2026-09-03', -5.5], ['2026-09-05', 1200], ['2026-09-13', -800]]);
  assert.throws(() => mCsv('Name,Email\nA,a@b.c\nB,b@c.d\n'), /date column and an amount column/);

  /* 4. OFX: signed amounts, the account's last digits, the ledger balance as the closing. */
  const ofx = mOfx('OFXHEADER:100\n<OFX><CURDEF>USD<BANKACCTFROM><ACCTID>000123456789</BANKACCTFROM><BANKTRANLIST>\n<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260903120000[-5:EST]<TRNAMT>-5.50<NAME>STARBUCKS</STMTTRN>\n<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260905<TRNAMT>1200.00<NAME>ACME LTD<MEMO>PAYROLL</STMTTRN>\n</BANKTRANLIST><LEDGERBAL><BALAMT>1394.50</LEDGERBAL></OFX>');
  assert.deepEqual(ofx.statement.rows.map((r) => r.amount), [-5.5, 1200]);
  assert.equal(ofx.statement.rows[1].description, 'ACME LTD · PAYROLL');
  assert.equal(ofx.statement.account.mask, '6789');
  assert.equal(ofx.statement.currency, 'USD');
  assert.equal(ofx.statement.closing, 1394.5);

  /* 5. The check: the balances decide — even against the export's own signs. */
  const st = (rows: Array<[string, number, number | null]>, opening: number | null = null, closing: number | null = null): MStatement =>
    ({ rows: rows.map(([on, amount, balance]) => ({ on, amount, balance, description: 'x' })), currency: null, account: { institution: null, mask: null }, opening, closing });
  const flipped = mCheck(st([['2026-09-01', 100, 900], ['2026-09-02', 50, 850]]));
  assert.equal(flipped.check, 'balanced', 'an export that writes debits positive is corrected by its own balances');
  assert.deepEqual(flipped.rows.map((r) => r.amount), [-100, -50]);
  assert.equal(mCheck(st([['2026-09-01', -100, null], ['2026-09-02', 250, null]], 1000, 1150)).check, 'balanced');
  const off = mCheck(st([['2026-09-01', -100, null]], 1000, 950));
  assert.equal(off.check, 'unbalanced');
  assert.match(off.detail ?? '', /off by 50/);
  const broken = mCheck(st([['2026-09-01', -100, 900], ['2026-09-02', -50, 700], ['2026-09-03', -10, 690]]));
  assert.equal(broken.check, 'unbalanced', 'a missing row breaks the chain');
  assert.match(broken.detail ?? '', /1 of 2 rows/);
  assert.equal(mCheck(st([['2026-09-01', -100, null]])).check, 'no_balances');

  /* 6. A model's reading is held to the shape, and what fails is dropped and counted, never repaired. */
  const reading = mReading({ currency: 'php', account_mask: 'Acct ****4417', opening_balance: '1,000.00', closing_balance: 1150, rows: [
    { date: '2026-09-02', description: 'GCASH IN J DELA CRUZ', amount: '250', balance: null, counterparty: 'J Dela Cruz' },
    { date: '2026-09-40', description: 'bad day', amount: 5 },
    { date: '2026-09-03', description: '', amount: -5 },
    { date: '2026-09-03', description: 'COFFEE', amount: -100 },
  ] });
  assert.equal(reading.dropped, 2);
  assert.equal(reading.statement.currency, 'PHP');
  assert.equal(reading.statement.account.mask, '4417');
  assert.equal(mCheck(reading.statement).check, 'balanced', 'opening + rows = closing: the reading vouches for itself');
  assert.throws(() => mReading({ nope: [] }), /without any rows/);
  assert.deepEqual(mChunks(['a'.repeat(8000), 'b'.repeat(8000), '', 'c'.repeat(100)], 12000).map((c) => c.length > 0), [true, true]);
  const merged = mMerge([
    { rows: [{ on: '2026-09-01', amount: 1, description: 'a', balance: null }], currency: 'EUR', account: { institution: 'N26', mask: null }, opening: 10, closing: null },
    { rows: [{ on: '2026-09-02', amount: 2, description: 'b', balance: null }], currency: null, account: { institution: null, mask: '1234' }, opening: null, closing: 13 },
  ]);
  assert.deepEqual([merged.rows.length, merged.currency, merged.account.institution, merged.account.mask, merged.opening, merged.closing], [2, 'EUR', 'N26', '1234', 10, 13]);

  /* 7. Who: the bank's own words off; one row, one id, every time. */
  assert.equal(mKey('POS 4411 STARBUCKS #1203 MANILA'), 'STARBUCKS MANILA');
  assert.equal(mKey('PAYPAL *NETFLIX.COM 866-579'), 'NETFLIX COM');
  assert.equal(mKey('GCASH TRF J DELA CRUZ 09171234567'), 'J DELA CRUZ');
  assert.equal(mKey('SEPA CREDIT TRANSFER FROM ACME LTD REF INV-004'), 'ACME LTD');
  assert.equal(mKey('GCASH'), 'GCASH', 'a line of nothing but rails is still somebody');
  assert.equal(mKey('12345 678'), 'UNKNOWN');
  assert.equal(mName('ACME LTD'), 'Acme LTD');
  const acct = mAccount('upload', { institution: 'BPI', mask: '1234' });
  const aug = [{ on: '2026-09-01', amount: -5, description: 'Coffee', balance: null }, { on: '2026-09-01', amount: -5, description: 'COFFEE', balance: null }, { on: '2026-09-02', amount: 100, description: 'Acme', balance: null }];
  const printsA = mPrints(acct, aug);
  assert.equal(new Set(printsA).size, 3, 'two identical coffees on one day stay two');
  const printsB = mPrints(acct, [...aug, { on: '2026-09-03', amount: -9, description: 'Grab', balance: null }]);
  assert.deepEqual(printsB.slice(0, 3), printsA, 'an overlapping statement lands on the same ids for the rows it shares');
  assert.notDeepEqual(mPrints(mAccount('upload', { institution: 'BDO', mask: '9' }), aug), printsA, 'another account is another row');

  /* 8. What a file is, by its bytes first. */
  const bytes = (s: string) => new TextEncoder().encode(s);
  assert.equal(mSniff(bytes('%PDF-1.7'), 'statement.csv'), 'pdf');
  assert.equal(mSniff(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'x'), 'image');
  assert.equal(mSniff(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 'x.xlsx'), 'spreadsheet');
  assert.equal(mSniff(bytes('OFXHEADER:100'), 'x.txt'), 'ofx');
  assert.equal(mSniff(bytes('Date,Amount\n1,2\n3,4'), 'download'), 'csv');
  assert.equal(mSniff(bytes('hello'), 'notes'), null);

  /* 9. Repeat bills: a rhythm, still going. */
  const tx = (id: string, on: string, amount: number, key: string, extra: Partial<MTx> = {}): MTx => ({ id, on, amount, key, currency: 'USD', accountId: 'a', outcomeId: null, ...extra });
  const rent = ['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].map((d, i) => tx(`r${i}`, d, -400, 'LANDLORD'));
  const gym = ['2026-03-05', '2026-04-05', '2026-05-05'].map((d, i) => tx(`g${i}`, d, -30, 'GYM'));
  const coffee = ['2026-08-02', '2026-08-19', '2026-09-20'].map((d, i) => tx(`c${i}`, d, -4, 'COFFEE'));
  const bills = mRecurring([...rent, ...gym, ...coffee], (k) => k, '2026-09-28');
  assert.deepEqual(bills.map((x) => x.key), ['LANDLORD'], 'a gym cancelled in May is not due in October; three coffees are not a bill');
  assert.equal(bills[0].next, '2026-10-01');
  assert.equal(bills[0].every, 'month');

  /* 10. The read: every number off the rows, the person's own accounts left out. */
  const payees: MPayee[] = [
    { key: 'ACME LTD', name: 'Acme LTD', role: 'employer', opportunityId: null },
    { key: 'CORON REEF', name: 'Coron Reef', role: null, opportunityId: null },
    { key: 'MY SAVINGS', name: 'My Savings', role: 'self', opportunityId: null },
  ];
  const ledger: MTx[] = [
    ...rent,
    tx('s1', '2026-07-15', 1500, 'ACME LTD'), tx('s2', '2026-08-15', 1500, 'ACME LTD'), tx('s3', '2026-09-05', 1500, 'ACME LTD'),
    tx('p1', '2026-08-20', 150, 'CORON REEF'), tx('p2', '2026-09-10', 150, 'CORON REEF'),
    tx('m1', '2026-09-11', 900, 'MY SAVINGS'), tx('m2', '2026-09-12', -900, 'MY SAVINGS'),
    tx('e1', '2026-09-12', 20, 'SHOP', { currency: 'EUR' }), tx('e2', '2026-09-13', 30, 'SHOP', { currency: 'USD' }),
    tx('u1', '2026-09-14', 10, 'SHOP', { currency: 'USD' }),
  ];
  const read = mRead({ txs: ledger, payees, accounts: [{ id: 'a', label: 'BPI', currency: 'USD', balance: 1800, on: '2026-09-15' }], today: '2026-09-29', currency: '$' })!;
  assert.equal(read.currency, 'USD', 'the currency most rows carry');
  assert.deepEqual(read.otherCurrencies, [{ currency: 'EUR', rows: 1 }]);
  assert.equal(read.inTotal, 1500 * 3 + 150 * 2 + 30 + 10, 'the savings transfer is not income');
  assert.equal(read.payers.find((p) => p.key === 'MY SAVINGS'), undefined);
  assert.deepEqual(read.toName.map((p) => p.key), ['CORON REEF', 'SHOP'], 'only payers nobody named, biggest first');
  assert.equal(read.byRole.employer, 4500);
  assert.equal(read.lastIn?.name, 'Shop');
  assert.ok(read.perMonth && read.perMonth.over === 90);
  assert.equal(read.runwayMonths, Math.round((1800 / read.perMonth!.out) * 10) / 10);
  assert.equal(read.lines[0], 'Since 1 Jun: $4,840 in from 3 payers.');
  assert.ok(read.lines.includes('Acme LTD was 93% of it.'));
  assert.ok(read.lines.includes('Of that: your job $4,500 · not named yet $340.'));
  assert.ok(read.lines.some((l) => /^You spend \$\d[\d,]* a month, \$400 of it on repeat bills\.$/.test(l)));
  assert.ok(read.lines.includes('Next: Landlord $400 around 1 Oct.'));
  assert.ok(read.lines.includes('Your statement ends 14 Sep. Add a newer one to keep this current.'));
  assert.ok(read.lines.includes('1 row in EUR are not in these numbers.') || read.lines.some((l) => /in EUR are not in these numbers/.test(l)));
  assert.equal(mRead({ txs: [], payees: [], accounts: [], today: '2026-09-29', currency: '$' }), null, 'no rows, no read');
  assert.equal(mText(1234.5, 'USD'), '$1,235');
  assert.equal(mText(5.5, '€'), '€5.50');
  assert.equal(mText(1200, 'CHF'), 'CHF 1,200');

  /* 11. Into the finance row: the statement where it is newer, what was typed where that is. */
  const prev = { cash: 5000, monthly_burn: 700, currency: '$', typed_at: '2026-09-20T10:00:00Z', source: { cash: 'typed' as const, monthly_burn: 'typed' as const } };
  const kept = mFinance(prev, read, '2026-09-29T00:00:00Z');
  assert.equal(kept.cash, 5000, 'typed on the 20th beats a balance from the 15th');
  assert.equal(kept.monthly_burn, 700, 'and the burn over rows that end on the 14th');
  const fresh = mFinance({ cash: 5000, monthly_burn: 700, typed_at: '2026-09-01T00:00:00Z', source: { cash: 'typed', monthly_burn: 'typed' } }, read, '2026-09-29T00:00:00Z');
  assert.equal(fresh.cash, 1800);
  assert.equal(fresh.cash_on, '2026-09-15');
  assert.deepEqual(fresh.source, { cash: 'statement', monthly_burn: 'statement' });
  assert.equal(mFinance({}, read, 'now').currency, '$');
  const gone = mNoStatements(fresh, 'later');
  assert.equal(gone.cash, undefined);
  assert.equal(gone.monthly_burn, undefined);
  assert.equal(mNoStatements({ cash: 10, source: { cash: 'typed' } }, 'later').cash, 10, 'what was typed stays');
  const typedOnly = { cash: 10, monthly_burn: 5 };
  assert.equal(mNoStatements(typedOnly, 'later'), typedOnly, 'nothing read off a statement: the row is left exactly as it was, not rewritten');

  /* 12. Deposits into wins: named clients only, recent only, and a win logged by hand is the same money. */
  const withClient: MPayee[] = [{ key: 'CORON REEF', name: 'Coron Reef', role: 'client', opportunityId: 'o1' }];
  const due = mWins({ txs: [tx('p0', '2026-07-01', 150, 'CORON REEF'), tx('p1', '2026-09-10', 150, 'CORON REEF'), tx('p2', '2026-09-12', 150, 'CORON REEF', { outcomeId: 'w9' }), tx('x', '2026-09-12', 99, 'SHOP')], payees: withClient, today: '2026-09-29' });
  assert.deepEqual(due.map((t) => t.id), ['p1'], 'not July, not one already a win, not a payer nobody named a client');
  const wins = [{ id: 'w1', amount: 150, occurred_at: '2026-09-08T09:00:00Z' }, { id: 'w2', amount: 150, occurred_at: '2026-08-01T09:00:00Z' }, { id: 'w3', amount: 90, occurred_at: '2026-09-10T09:00:00Z' }];
  assert.equal(mMatch({ on: '2026-09-10', amount: 150 }, wins, new Set()), 'w1');
  assert.equal(mMatch({ on: '2026-09-10', amount: 150 }, wins, new Set(['w1'])), null, 'one win is one deposit');
  assert.equal(mMatch({ on: '2026-09-10', amount: 151.2 }, wins, new Set()), 'w1', 'within one percent');

  /* 13. Which business a payer is: shared distinctive words, or nothing. */
  const opps = [{ id: 'o1', title: 'Coron Reef Divers' }, { id: 'o2', title: 'Lagen Island Resort' }, { id: 'o3', title: 'Coco Palms Resort' }];
  assert.deepEqual(mSuggest('Coron Reef', opps), { id: 'o1', title: 'Coron Reef Divers' });
  assert.equal(mSuggest('Sunset Resort', opps), null, '"resort" links every resort to every resort');
  assert.equal(mSuggest('Coron', [{ id: 'a', title: 'Coron Reef' }, { id: 'b', title: 'Coron Tours' }]), null, 'two equally good answers are no answer');

  /* 14. A reading that died mid-call says so. */
  const started = new Date(Date.parse('2026-09-29T10:00:00Z') - M_STALE - 1000).toISOString();
  assert.equal(mImport({ id: 'i', status: 'reading', started_at: started, format: 'pdf', method: 'read' }, new Date('2026-09-29T10:00:00Z')).status, 'failed');
  assert.equal(mImport({ id: 'i', status: 'reading', started_at: '2026-09-29T09:59:00Z' }, new Date('2026-09-29T10:00:00Z')).status, 'reading');

  /* 15. The plan redraws when the money says something new — a payer named is something new. */
  const before = mForPlan(read).signature;
  const after = mForPlan(mRead({ txs: ledger, payees: [...payees.slice(0, 1), { ...payees[1], role: 'client' }, payees[2]], accounts: [], today: '2026-09-29', currency: '$' })).signature;
  assert.notEqual(before, after);
  assert.ok(!mForPlan(read).lines.some((l) => /^Your statement ends/.test(l)), 'the stale-statement line is for the person, not the planner');
  assert.deepEqual(mForPlan(null), { lines: [], signature: null });
  // Cut for the screen, the read still fingerprints the same: the phone holds the cut one, the server all of it.
  assert.equal(mForPlan({ ...read, payers: read.payers.slice(0, 1), recurring: [] }).signature, mForPlan(read).signature);
  const sig = { goals: [], working: [], contextCount: 2, capacity: 'deep' as const, offer: null };
  assert.equal(mSignature({ ...sig, money: null }), mSignature(sig), 'no statements, no change to any plan that exists today');
  assert.notEqual(mSignature({ ...sig, money: mForPlan(read).signature }), mSignature(sig));
  assert.match(mPrompt({ ...mPromptBase, money: mForPlan(read).lines }), /THEIR MONEY, counted by the app from their bank statements, every figure already in their main currency — statements in other currencies were converted at ECB daily rates, so never convert again:\n- Since 1 Jun/);
  assert.doesNotMatch(mPrompt(mPromptBase), /THEIR MONEY/);

  /* 16. Records: every sensor opens a sheet the app actually renders (invariant 7). */
  const sheets = readMoneyFile(new URL('../../src/app/copilot/_components/SheetContent.tsx', import.meta.url), 'utf8');
  for (const s of M_SENSORS) assert.ok(sheets.includes(`case '${s.sheet}':`), `sensor ${s.key} opens '${s.sheet}', which SheetContent must render`);
  const views = mSensors({ bank: { ready: true, rows: 412, to: '2026-09-30', reading: 0, review: 0, failed: 0, unreadable: null }, owed: { open: 0 }, focus: { minutesWeek: 210 }, feeds: { total: 5, failing: 2 } });
  assert.deepEqual(views.map((v) => [v.key, v.state, v.line]), [
    ['bank', 'on', '412 transactions · to 30 Sep'],
    ['owed', 'off', 'Nothing logged'],
    ['focus', 'on', '3.5h this week'],
    ['feeds', 'attention', '2 of 5 failing'],
  ]);
  assert.equal(mSensors({ bank: { ready: false, rows: 0, to: null, reading: 0, review: 0, failed: 0, unreadable: null }, owed: { open: 0 }, focus: { minutesWeek: 0 }, feeds: { total: 0, failing: 0 } })[0].line, 'Not set up on this server yet', 'an unapplied migration is not "nothing uploaded"');
  assert.equal(mSensors({ bank: { ready: true, rows: 10, to: null, reading: 0, review: 1, failed: 0, unreadable: null }, owed: { open: 0 }, focus: { minutesWeek: 0 }, feeds: { total: 0, failing: 0 } })[0].state, 'attention');

  /* 17. The schema: plain unique constraints the upserts can infer, and a checker that can see them. */
  const sql = readMoneyFile(new URL('../../supabase/migrations/20260929_copilot_money.sql', import.meta.url), 'utf8');
  assert.match(sql, /constraint copilot_transactions_fingerprint unique \(profile_id, fingerprint\)/);
  assert.match(sql, /constraint copilot_counterparties_key unique \(profile_id, key\)/);
  assert.match(sql, /constraint copilot_money_accounts_key unique \(profile_id, provider, external_key\)/);
  assert.doesNotMatch(sql, /create unique index[^;]*where/i, 'a partial unique index cannot be inferred by on_conflict (20260918)');
  const moneyStore = readMoneyFile(new URL('../../src/lib/copilot/money/store.ts', import.meta.url), 'utf8');
  for (const conflict of ["'profile_id,fingerprint'", "'profile_id,key'", "'profile_id,provider,external_key'"]) {
    assert.ok(moneyStore.includes(`onConflict: ${conflict}`), `the store upserts on ${conflict}`);
  }
  const checker = readMoneyFile(new URL('../../scripts/sql/copilot-schema-check.sql', import.meta.url), 'utf8');
  for (const t of ['copilot_money_accounts', 'copilot_money_imports', 'copilot_transactions', 'copilot_counterparties']) {
    assert.ok(checker.includes(`'${t}'`), `the schema checker must name ${t}`);
  }

  console.log('copilot-core: money from the bank checks passed');
}

moneyFromTheBank().catch((e) => { console.error(e); process.exit(1); });

/* ─── Goal cards on You: the date the Path says, and wins only where they went ─ */
import { creditedGoalId as gcCredited, goalCard as gcCard } from '../../src/lib/copilot/goalcard';

async function goalCardsSayWhatIsTrue() {
  const today = '2026-09-29';
  const goals = [
    { id: 'g1', metric: 'currency' as const, unit: '$', target_value: 1500, current_value: 300, horizon_days: 90, note: null, priority: 1, created_at: '2026-09-01T00:00:00Z' },
    { id: 'g2', metric: 'none' as const, unit: null, target_value: null, current_value: null, horizon_days: 60, note: null, priority: 2, created_at: '2026-09-01T00:00:00Z' },
    { id: 'g3', metric: 'currency' as const, unit: '$', target_value: 6000, current_value: 1200, horizon_days: 180, note: null, priority: 3, created_at: '2026-09-01T00:00:00Z' },
    { id: 'g4', metric: 'none' as const, unit: null, target_value: null, current_value: null, horizon_days: null, note: null, priority: 4, created_at: '2026-09-01T00:00:00Z' },
  ];
  const credited = gcCredited(goals);
  assert.equal(credited, 'g1', 'the first money goal by priority is the one recordOutcome credits');
  assert.equal(gcCredited([{ id: 'a', metric: 'currency', priority: 3 }, { id: 'b', metric: 'currency', priority: 1 }]), 'b');
  assert.equal(gcCredited([{ id: 'a', metric: 'none', priority: 1 }]), null);
  const card = (i: number) => gcCard(goals[i], { today, creditedId: credited, wonAmount: 300, windowDays: 30 });

  // 1. The date, not the horizon it was written with.
  assert.equal(card(1).badge, '32d', 'written 1 Sep with 60 days: due 31 Oct, 32 days left — never "60d"');
  assert.equal(card(1).sub, 'By 31 Oct · 32 days left');
  assert.doesNotMatch(card(1).sub, /horizon/);
  assert.equal(card(3).badge, '—');
  assert.equal(card(3).sub, 'No target and no date yet');
  assert.equal(gcCard({ ...goals[1], note: 'Ops roles only' }, { today, creditedId: credited, wonAmount: 0, windowDays: 30 }).sub, 'Ops roles only', 'their own note first');
  assert.equal(gcCard({ ...goals[1], created_at: '2026-07-01T00:00:00Z' }, { today, creditedId: credited, wonAmount: 0, windowDays: 30 }).badge, 'Past');

  // 2. Wins, only on the goal they went into.
  assert.equal(card(0).badge, '20%');
  assert.equal(card(0).sub, '$300 of $1,500 · By 30 Nov · 62 days left · $300 won in the last 30 days');
  assert.doesNotMatch(card(2).sub, /won/, 'the exit fund never received a win, so it does not claim one');
  assert.equal(card(2).sub, '$1,200 of $6,000 · By 28 Feb 2027 · 152 days left');
  assert.doesNotMatch(gcCard(goals[0], { today, creditedId: credited, wonAmount: 0, windowDays: 30 }).sub, /won/, 'nothing won, nothing said');

  console.log('copilot-core: goal cards checks passed');
}

goalCardsSayWhatIsTrue().catch((e) => { console.error(e); process.exit(1); });

/* ─── Money: a budgeting app's export, a PDF by rules, and one currency per figure ─── */
import {
  counterpartyKey as bKey, parseCsvStatement as bCsv, parseStatementText as bText, rowKey as bRowKey, skippedLine as bSkipped,
  statementFromPdfText as bPdf,
} from '../../src/lib/copilot/money/statement';
import {
  currencyCodeOf as bCode, financeFromRead as bFinance, importLine as bLine, importView as bImport, dayLabel as bDay,
  moneyRead as bRead, typedInLines as bTypedLines, financeFromTyped as bTyped, currencyForZone as bZone, financeMark as bMark, type LedgerTx as BTx,
} from '../../src/lib/copilot/money/ledger';
import {
  covers as bCovers, fxTable as bTable, latestRate as bLatest, mainCurrency as bMain, parseRates as bParse, rateLine as bRateLine,
  rateOn as bRateOn, ratesNeeded as bNeeded,
} from '../../src/lib/copilot/money/fx';

async function moneyFromMessyFiles() {
  /* 1. A budgeting app's export: scheduled bills a year ahead, a blank note, a move between its own accounts. */
  const app = [
    'Type,From Account,From Acc Type,To Account,To Acc Type,Pending,Note,Amount,Category,Date,Time',
    'EXPENSE,Basic account,BASIC,,,Yes,Hosting,-515.00,Utilities,2027-09-01,06:00:00',
    'EXPENSE,Basic account,BASIC,,,No,5G DATA,-510.00,Utilities,2026-09-20,21:14:00',
    'EXPENSE,Basic account,BASIC,,,No,,-150.00,Dining Out,2026-09-21,12:00:00',
    'EXPENSE,Basic account,BASIC,,,No,,-95.00,Dining Out,2026-09-22,12:00:00',
    'INCOME,,,Basic account,BASIC,No,Client payment,5000.00,Salary,2026-09-15,09:00:00',
    'TRANSFER,Basic account,BASIC,Card,BASIC,No,,-1000.00,,2026-09-16,10:00:00',
    'EXPENSE,Basic account,BASIC,,,No,Coffee,-120.00,Coffee,2026-10-02,08:00:00',
  ].join('\n');
  const a = bCsv(app, { today: '2026-09-29' });
  assert.deepEqual(a.statement.rows.map((r) => r.amount), [-510, -150, -95, 5000], 'marked pending, dated after today, or moved between its own accounts: none of it is money spent');
  assert.deepEqual(a.skipped, { scheduled: 2, internal: 1, void: 0, foreign: 0 });
  assert.equal(bSkipped(a.skipped), 'Left out 2 scheduled rows (pending or dated after today) and 1 transfer between your own accounts.');
  assert.deepEqual(a.statement.rows.map((r) => bRowKey(r)), ['5G DATA', 'DINING OUT', 'DINING OUT', 'CLIENT'], 'a blank note is its category, not one payee called "(no description)"');
  assert.equal(a.statement.currency, null, 'the file names none, and none is guessed');
  assert.equal(bKey('5G DATA'), '5G DATA', 'a short token with a digit is a word, not a reference number');
  assert.throws(() => bCsv('Date,Note,Amount,Pending\n2026-09-01,Rent,-500,Yes\n'), /No row in that file is money that has moved\. Left out 1 scheduled row/);

  const statuses = bCsv('Date,Description,Amount,Status\n2026-09-01,Shop,-5,Completed\n2026-09-02,Shop,-7,Declined\n2026-09-03,Shop refund,5,Refunded\n');
  assert.deepEqual(statuses.statement.rows.map((r) => r.amount), [-5, 5], 'declined never happened; a refund is a row of its own and stays');
  const mixed = bCsv('Date,Description,Amount,Currency\n2026-09-01,A,-5,EUR\n2026-09-02,B,-6,EUR\n2026-09-03,C,-7,USD\n');
  assert.equal(mixed.statement.currency, 'EUR');
  assert.equal(mixed.statement.rows.length, 2, 'a dollar row is not stored as euros');
  assert.equal(mixed.skipped?.foreign, 1);

  /* 2. Who, out of how an e-money account words a line. */
  assert.equal(bKey('Sent money to Jane Roe'), 'JANE ROE');
  assert.equal(bKey('Received money from ACME LTD with reference Invoice 12'), 'ACME LTD', 'the reference is not who paid');
  assert.equal(bKey('Card transaction of 348.00 PHP issued by Jollibee Jb3464 DASMARINAS'), 'JOLLIBEE DASMARINAS', 'a store number is not a name');

  /* 3. A PDF's text, by rules: each row's date on the line after it, a page break, a description over two lines. */
  const wiseLike = [
    'ref:abc 1 / 2', 'Wise Europe SA', 'EUR statement', '1 August 2026 [GMT+08:00] - 31 August 2026 [GMT+08:00]', 'IBAN', 'BE00 1234 5678 9012',
    'Description Incoming Outgoing Amount',
    'Sent money to Jane Roe -30.00 5.00', '31 August 2026 | Transaction: TRANSFER-1',
    'Card transaction of 348.00 PHP issued by Jollibee Jb3464 DASMARINAS -5.00 35.00', '30 August 2026 | Transaction: CARD-2',
    'ref:abc 2 / 2', 'Description Incoming Outgoing Amount',
    'Received money from ACME LTD with reference', 'Invoice 12 40.00 40.00', '29 August 2026 | Transaction: TRANSFER-3 | Reference: Invoice 12',
  ];
  const w = bText(wiseLike.join('\n'))!;
  assert.ok(w, 'the layout is read');
  assert.deepEqual(w.statement.rows.map((r) => [r.on, r.amount, r.balance]), [['2026-08-31', -30, 5], ['2026-08-30', -5, 35], ['2026-08-29', 40, 40]]);
  assert.equal(w.statement.rows[2].description, 'Received money from ACME LTD with reference Invoice 12', 'a page header does not leak into the next description');
  assert.equal(w.statement.currency, 'EUR');
  assert.deepEqual(w.statement.account, { institution: 'Wise', mask: '9012' });
  assert.ok(bPdf([wiseLike.slice(0, 11).join('\n'), wiseLike.slice(11).join('\n')]), 'pages joined, and the running balance holds on every row');

  const dated = 'Statement of account\nDate Description Amount Balance\n03/09/2026 STARBUCKS MANILA -5.50 994.50\n05/09/2026 ACME PAYROLL 1,200.00 2,194.50\n13/09/2026 RENT SEPT -800.00 1,394.50\n';
  assert.deepEqual(bText(dated)!.statement.rows.map((r) => [r.on, r.description]), [['2026-09-03', 'STARBUCKS MANILA'], ['2026-09-05', 'ACME PAYROLL'], ['2026-09-13', 'RENT SEPT']]);
  assert.ok(bPdf([dated]));
  const misread = dated.replace('2,194.50', '2,190.50');
  assert.ok(bText(misread), 'it reads');
  assert.equal(bPdf([misread]), null, 'and a chain that breaks once hands the whole file to the model — rules never guess');
  assert.equal(bText(wiseLike.filter((l) => !l.startsWith('30 August')).join('\n')), null, 'a row with no date is refused, not dated by its neighbours');
  assert.equal(bText('Hello\nTotal 5.00 5.00\n'), null, 'one figure pair is not a statement');

  /* 4. One main currency: every row in another converted at its own day's rate, and said. */
  const t = (id: string, on: string, amount: number, currency: string | null): BTx => ({ id, on, amount, key: `K${id}`, currency, accountId: 'a', outcomeId: null });
  const pesos = ['2026-07-01', '2026-07-20', '2026-08-10', '2026-08-30', '2026-09-20'].map((d, i) => t(`p${i}`, d, -1000, null));
  const euros = [t('e1', '2026-06-01', 40, 'EUR'), t('e2', '2026-06-10', -5, 'EUR'), t('e3', '2026-06-30', -5, 'EUR')];
  // A business-day series, the way the ECB publishes: no weekends.
  const series = (base: string, quote: string, from: string, to: string, rate: number) => {
    const out: Array<{ base: string; quote: string; day: string; rate: number }> = [];
    for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
      const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
      if (wd !== 0 && wd !== 6) out.push({ base, quote, day: d, rate });
    }
    return out;
  };
  const eurUsd = series('EUR', 'USD', '2026-05-25', '2026-07-03', 1.1);
  const phpUsd = series('PHP', 'USD', '2026-06-24', '2026-09-29', 0.0172);
  const fxAll = bTable([...eurUsd, ...phpUsd]);

  const both = bRead({ txs: [...pesos, ...euros], payees: [], accounts: [], today: '2026-09-29', currency: 'USD', main: 'USD', fx: fxAll })!;
  assert.equal(both.currency, 'USD');
  assert.equal(both.inMain, true);
  assert.deepEqual(both.converted, [{ currency: 'EUR', rows: 3 }]);
  assert.equal(Math.round(both.inTotal * 100) / 100, 44, '€40 at 1.10');
  assert.equal(Math.round(both.outTotal * 100) / 100, 11, 'not 5,011: the pesos have no currency said yet');
  assert.deepEqual(both.otherCurrencies, [{ currency: '', rows: 5 }]);
  assert.ok(both.lines.includes('Converted to USD from EUR (3 rows) at ECB daily rates.'), 'a converted figure says so');
  assert.ok(both.lines.includes('5 rows with no currency are not in these numbers. Say which on Bank statements.'));

  const alone = bRead({ txs: pesos, payees: [], accounts: [], today: '2026-09-29', currency: 'USD', main: 'USD', fx: fxAll })!;
  assert.equal(alone.currencyKnown, false, 'a file that never said its currency is never converted from a guess');
  assert.ok(alone.lines.some((l) => /^You spend [\d,]+ a month\.$/.test(l)), 'printed bare: a $ on peso rows was a guess');

  const saidRows = [...pesos.map((p) => ({ ...p, currency: 'PHP' })), ...euros];
  const said = bRead({ txs: saidRows, payees: [], accounts: [], today: '2026-09-29', currency: 'USD', main: 'USD', fx: fxAll })!;
  assert.equal(said.currency, 'USD', 'one currency for everything, whatever each statement was in');
  assert.deepEqual(said.converted, [{ currency: 'PHP', rows: 5 }, { currency: 'EUR', rows: 3 }]);
  assert.equal(Math.round(said.outTotal * 100) / 100, 97, '₱5,000 at 0.0172 is $86, and €10 is $11');
  assert.deepEqual(said.otherCurrencies, [], 'nothing left out once everything converts');

  const noPeso = bRead({ txs: saidRows, payees: [], accounts: [], today: '2026-09-29', currency: 'USD', main: 'USD', fx: bTable(eurUsd), fxMissing: { PHP: 'the exchange-rate service did not answer in time' } })!;
  assert.deepEqual(noPeso.otherCurrencies, [{ currency: 'PHP', rows: 5, why: 'the exchange-rate service did not answer in time' }]);
  assert.ok(noPeso.lines.includes('5 rows in PHP are not in these numbers: the exchange-rate service did not answer in time.'), 'a missing rate is said, never guessed');
  const onlyPeso = bRead({ txs: saidRows.slice(0, 5), payees: [], accounts: [], today: '2026-09-29', currency: 'USD', main: 'USD' })!;
  assert.equal(onlyPeso.currency, 'PHP', 'nothing converts: shown in its own currency rather than not at all');
  assert.equal(onlyPeso.inMain, false);
  assert.ok(onlyPeso.lines.some((l) => l.startsWith('Shown in PHP, not USD:')));
  const withBalance = bRead({ txs: saidRows, payees: [], accounts: [{ id: 'w', label: 'Wise', currency: 'EUR', balance: 100, on: '2026-06-30' }], today: '2026-09-29', currency: 'USD', main: 'USD', fx: fxAll })!;
  assert.equal(Math.round(withBalance.cash!.amount * 100) / 100, 110, 'a euro balance converted at its own day’s rate');
  // Two accounts, one stopped in June: the euro one no longer speaks for this month, and a budget export prints no balance.
  const twoAccounts = bRead({
    txs: [...pesos.map((p) => ({ ...p, currency: 'PHP', accountId: 'budget' })), ...euros.map((e) => ({ ...e, accountId: 'wise' }))],
    payees: [], today: '2026-09-29', currency: 'USD', main: 'USD', fx: fxAll,
    accounts: [{ id: 'wise', label: 'Wise', currency: 'EUR', balance: 5, on: '2026-06-30' }, { id: 'budget', label: 'Budget', currency: 'PHP', balance: null, on: null }],
  })!;
  assert.equal(twoAccounts.perMonth?.over, 82, 'averaged over the account still being written, from its first row: not 90 days across a gap nobody recorded');
  assert.equal(twoAccounts.runwayMonths, null, 'one account’s balance is not all the money there is');
  assert.ok(twoAccounts.lines.some((l) => l.startsWith('Balance: $5.50 on 30 Jun in 1 of 2 accounts')));
  assert.equal(bFinance({ currency: '$' }, twoAccounts, 'now', { main: 'USD' }).cash, undefined, 'so runway does not take it');

  /* Rates: the day's, the business day before it, and nothing older than a week. */
  assert.equal(bRateOn(fxAll, 'PHP', 'USD', '2026-09-26')?.day, '2026-09-25', 'a Saturday takes Friday’s rate');
  assert.equal(bRateOn(fxAll, 'USD', 'PHP', '2026-09-25')?.rate, 1 / 0.0172, 'either way round');
  assert.equal(bRateOn(fxAll, 'PHP', 'USD', '2026-10-15'), null, 'a rate two weeks old is not that day’s');
  assert.equal(bRateOn(fxAll, 'EUR', 'USD', '2026-05-24')?.day, '2026-05-25', 'a day just before the series takes its first rate');
  assert.equal(bRateOn(fxAll, 'GBP', 'USD', '2026-06-01'), null);
  assert.equal(bRateOn(fxAll, 'USD', 'USD', '2026-06-01')?.rate, 1);
  assert.equal(bLatest(fxAll, 'PHP', 'USD')?.day, '2026-09-29');
  assert.equal(bRateLine('PHP', 'USD', { rate: 0.0172, day: '2026-09-26' }, bDay), '₱58.14 = $1 on 26 Sep', 'quoted the way a person reads it');
  assert.deepEqual(bParse({ base: 'PHP', rates: { '2026-09-25': { USD: 0.0172 }, '2026-09-28': { USD: 0.0173 } } }, 'PHP', 'USD').map((r) => r.day), ['2026-09-25', '2026-09-28']);
  assert.deepEqual(bParse({ base: 'PHP', date: '2026-09-29', rates: { USD: 0.0174 } }, 'PHP', 'USD'), [{ base: 'PHP', quote: 'USD', day: '2026-09-29', rate: 0.0174 }]);
  assert.deepEqual(bParse({ base: 'EUR', rates: { '2026-09-25': { USD: 1.1 } } }, 'PHP', 'USD'), [], 'another base is not this pair');
  assert.deepEqual(bParse({ message: 'not found' }, 'VND', 'USD'), []);
  assert.deepEqual(bNeeded({ main: 'USD', txs: saidRows, accounts: [{ currency: 'EUR', on: '2026-07-02' }], typed: ['GBP'], today: '2026-09-29' }), [
    { from: 'EUR', to: 'USD', start: '2026-06-01', end: '2026-07-02' },
    { from: 'GBP', to: 'USD', start: '2026-09-29', end: '2026-09-29' },
    { from: 'PHP', to: 'USD', start: '2026-07-01', end: '2026-09-20' },
  ]);
  assert.equal(bCovers({ first: '2026-06-26', last: '2026-09-25' }, { start: '2026-07-01', end: '2026-09-29' }, '2026-09-29'), true, 'a Friday rate covers the Monday after');
  assert.equal(bCovers({ first: '2026-07-10', last: '2026-09-25' }, { start: '2026-07-01', end: '2026-09-20' }, '2026-09-29'), false, 'the first week has no rate');
  assert.equal(bMain({}, []), 'USD');
  assert.equal(bMain({ currency: '$' }, []), 'USD', '"$" is a US dollar unless said otherwise');
  assert.equal(bMain({ currency: '₱' }, [{ metric: 'currency', unit: '$' }]), 'PHP', 'runway’s currency before the goal’s: nobody’s runway changes currency the day this ships');
  assert.equal(bMain({}, [{ metric: 'currency', unit: '€' }]), 'EUR');
  assert.equal(bMain({ currency: '$', main_currency: 'php' }, []), 'PHP', 'a choice in Settings wins');
  assert.equal(bMark('CAD'), 'CAD', 'written so it reads back as itself: "$" would read back as USD');
  assert.equal(bMark('USD'), '$');

  /* 5. Runway in the main currency: statements converted, typed numbers kept as typed and converted. */
  const latest = (from: string, to: string) => bLatest(fxAll, from, to);
  // The live account: "$1,000 cash, $350 a month" typed, then a peso budget export.
  const typedDollars = { cash: 1000, monthly_burn: 350, currency: '$', typed_at: '2026-09-20T00:00:00Z', source: { cash: 'typed' as const, monthly_burn: 'typed' as const } };
  const settled = bFinance(typedDollars, said, '2026-09-29T10:00:00Z', { main: 'USD', latest });
  assert.equal(settled.currency, '$');
  assert.equal(settled.cash, 1000, 'typed in the main currency, kept as typed');
  assert.equal(settled.monthly_burn, Math.round(said.perMonth!.out), 'the burn off the rows, converted: not blanked, not left in pesos');
  assert.equal(settled.source?.monthly_burn, 'statement');
  assert.equal(bFinance(settled, said, 'later', { main: 'USD', latest }), settled, 'settled once, the next load writes nothing');

  // Then their book balance, typed in pesos.
  const typedPeso = bTyped(settled, { cash: 71804, currencies: { cash: 'PHP' } }, '2026-09-29T11:00:00Z', 'USD');
  assert.equal(typedPeso.cash, undefined, 'not a dollar figure until it is converted');
  assert.deepEqual(typedPeso.typed_in, { cash: { amount: 71804, currency: 'PHP' } });
  const inDollars = bFinance(typedPeso, said, '2026-09-29T11:00:01Z', { main: 'USD', latest });
  assert.equal(inDollars.cash, 1235.03, '₱71,804 at 0.0172');
  assert.deepEqual(inDollars.typed_in, { cash: { amount: 71804, currency: 'PHP', rate: 0.0172, day: '2026-09-29' } }, 'kept as typed, so it follows the peso');
  assert.equal(inDollars.monthly_burn, Math.round(said.perMonth!.out), 'the burn came back off the rows');
  assert.ok(bTypedLines(inDollars)[0].startsWith('Cash: you typed ₱71,804, which is $1,235 (₱58.14 = $1 on 29 Sep'));
  const moved = bFinance(inDollars, said, 'next week', { main: 'USD', latest: () => ({ rate: 0.018, day: '2026-10-05' }) });
  assert.equal(moved.cash, 1292.47, 'the peso moved, and the dollar figure with it');
  const noRate = bFinance(typedPeso, said, 'now', { main: 'USD', latest: () => null });
  assert.equal(noRate.cash, undefined, 'no rate, no figure: never a guess');
  assert.match(bTypedLines(noRate)[0], /no PHP to USD rate yet/);

  // Settings moves the main currency: what was typed in dollars is converted, and kept as typed.
  const inPesos = bFinance(settled, bRead({ txs: saidRows, payees: [], accounts: [], today: '2026-09-29', currency: 'PHP', main: 'PHP', fx: fxAll })!, 'now', { main: 'PHP', latest });
  assert.equal(inPesos.currency, '₱');
  assert.equal(inPesos.cash, 58139.53, '$1,000 at 1/0.0172');
  assert.deepEqual(inPesos.typed_in?.cash, { amount: 1000, currency: 'USD', rate: 1 / 0.0172, day: '2026-09-29' });

  assert.equal(bFinance(typedDollars, alone, 'now', { main: 'USD', latest }), typedDollars, 'unlabelled rows never reach runway: they were $37,708 a month of pesos');
  const orphan = bFinance(settled, onlyPeso, 'now', { main: 'USD', latest });
  assert.equal(orphan.monthly_burn, undefined, 'a read not in the main currency writes nothing, and its old burn goes');
  assert.equal(orphan.cash, 1000, 'what was typed stays');

  const unchanged = bTyped(settled, { cash: 1000, monthly_burn: settled.monthly_burn }, 'now', 'USD');
  assert.deepEqual(unchanged.source, { cash: 'typed', monthly_burn: 'statement' }, 'saving the sheet unchanged keeps the bank’s burn the bank’s');
  assert.equal(bFinance({ cash: 5, main_currency: 'EUR' }, null, 'now', { main: 'EUR' }).main_currency, 'EUR');
  assert.equal(bCode('₱'), 'PHP');
  assert.equal(bCode('$'), null, 'a dozen currencies write $');
  assert.equal(bCode('eur'), 'EUR');
  assert.equal(bZone('Asia/Manila'), 'PHP', 'offered first to a person in Manila, who had to type it');
  assert.equal(bZone('Europe/Zurich'), null, 'not every European zone spends euros');
  assert.equal(bZone(null), null);

  /* 6. The skipped line travels with the statement to the screen. */
  const i = bImport({ id: 'i1', status: 'ready', file_name: 'budget.csv', rows_found: 4, rows_new: 4, skipped: 'Left out 2 scheduled rows (pending or dated after today).', started_at: new Date().toISOString() }, new Date());
  assert.equal(i.skipped, 'Left out 2 scheduled rows (pending or dated after today).');
  assert.equal(bLine(i), 'Read budget.csv: 4 new rows. Left out 2 scheduled rows (pending or dated after today).');

  console.log('copilot-core: money from messy files checks passed');
}

moneyFromMessyFiles().catch((e) => { console.error(e); process.exit(1); });

/* ─── The money book: the Money tab's list, calendar, balance and repeats ─── */
import {
  anchorOf as kAnchor, bookBalance as kBalance, bookDayLabel as kDay, bookMoney as kMoney, bookRateLine as kRateLine, bookView as kView,
  checkEntry as kCheck, nextRepeat as kNext, parseRepeat as kParse, repeatValue as kValue, repeatsDue as kDue, shiftMonth as kShift,
  type BookRow as KRow,
} from '../../src/lib/copilot/money/book';
import {
  financeFromRead as kFinance, financeFromTyped as kTyped, moneyRead as kRead, typedInLines as kTypedLines, type LedgerTx as KTx,
} from '../../src/lib/copilot/money/ledger';
import { fxTable as kTable } from '../../src/lib/copilot/money/fx';

async function moneyBook() {
  const today = '2026-09-30';

  /* 1. Repeats: a monthly one keeps its day through a short month; a weekly one catches up, bounded. */
  assert.equal(kValue('month', '2026-01-31'), 'monthly@31');
  assert.equal(kValue('week', '2026-01-31'), 'weekly');
  const m31 = kParse('monthly@31')!;
  assert.deepEqual(m31, { every: 'month', day: 31 });
  assert.equal(kNext(m31, '2026-01-31'), '2026-02-28', 'February has no 31st');
  assert.equal(kNext(m31, '2026-02-28'), '2026-03-31', 'and March gets it back: the day is the rule’s, not the last row’s');
  assert.equal(kNext(kParse('monthly@15')!, '2026-12-15'), '2027-01-15');
  assert.equal(kNext({ every: 'week' }, '2026-09-09'), '2026-09-16');
  assert.equal(kParse('monthly@0'), null);
  assert.equal(kParse('daily'), null);
  assert.equal(kParse(null), null);
  assert.deepEqual(kDue({ every: 'week' }, '2026-09-09', today), ['2026-09-16', '2026-09-23', '2026-09-30', '2026-10-07'],
    'every one that came, and the next one after today as pending');
  assert.deepEqual(kDue(kParse('monthly@1')!, '2026-10-01', today), [], 'a series whose latest row is still pending owes nothing');
  assert.equal(kDue({ every: 'week' }, '2020-01-01', today).length, 60, 'a series nobody opened for years writes a bounded catch-up, not forever');

  /* 2. The balance: said once, moved only by what was logged after it. */
  const anchor = { currency: 'PHP', balance: 71479.06, at: '2026-09-30T01:00:00Z', on: today };
  const row = (r: Partial<KRow> & Pick<KRow, 'id' | 'on' | 'amount'>): KRow => ({
    currency: 'PHP', description: r.category ?? 'Money', category: null, note: null, repeat: null, createdAt: '2026-09-29T20:00:00Z', book: false, source: null, ...r,
  });
  const rows: KRow[] = [
    row({ id: 'imp1', on: '2026-09-29', amount: -200, category: 'Groceries', source: 'budget.csv' }),
    row({ id: 'imp2', on: '2026-09-28', amount: -500, category: 'Dining Out', source: 'budget.csv' }),
    row({ id: 'sm', on: today, amount: -350, category: 'Groceries', note: 'SM market', createdAt: '2026-09-30T02:00:00Z', book: true }),
    row({ id: 'salon', on: '2026-09-29', amount: 20000, category: 'Client', note: 'Salon deposit', createdAt: '2026-09-30T03:00:00Z', book: true }),
    row({ id: 'early', on: today, amount: -99, category: 'Coffee', createdAt: '2026-09-30T00:30:00Z', book: true }),
    row({ id: 'rent', on: '2026-10-01', amount: -8000, category: 'Housing', note: 'Rent', repeat: 'monthly@1', createdAt: '2026-09-30T04:00:00Z', book: true }),
    row({ id: 'usd', on: today, amount: -5, currency: 'USD', category: 'Coffee', createdAt: '2026-09-30T05:00:00Z', book: true }),
    row({ id: 'nocur', on: '2026-09-27', amount: -40, currency: null, category: 'Coffee', source: 'old.csv' }),
    row({ id: 'aug', on: '2026-08-15', amount: -1000, category: 'Groceries', source: 'budget.csv' }),
  ];
  assert.equal(kBalance(anchor, rows, today), 91129.06,
    '₱71,479.06 − ₱350 logged after + ₱20,000 logged after (back-dated, still after): a coffee logged before the balance was said is in it already, a file never moves it, rent is pending, dollars are another book');
  assert.equal(kBalance(anchor, rows, '2026-10-01'), 83129.06, 'the rent counts on its day');

  /* 3. The screen, in the book's own currency. */
  const noFx = kTable([]);
  const v = kView({ rows, anchor, currency: 'PHP', view: 'PHP', today, month: '2026-09', fx: noFx });
  assert.deepEqual(v.balance, { amount: 91129.06, shown: 91129.06, rateDay: null });
  assert.deepEqual(v.days.map((d) => [d.on, d.label, d.spent, d.received]), [
    [today, 'Today', 449, 0],
    ['2026-09-29', 'Yesterday', 200, 20000],
    ['2026-09-28', 'Mon 28 Sep', 500, 0],
  ], 'newest day first, each header carrying what the day cost');
  assert.deepEqual(v.days[0].lines.map((l) => [l.label, l.sub, l.book]), [['SM market', 'Groceries', true], ['Coffee', null, true]],
    'newest logged first; the note reads first and the category under it');
  assert.equal(v.days[1].lines[1].source, 'budget.csv', 'a file’s row says where it came from');
  assert.deepEqual(v.totals, { spent: 1149, received: 20000 }, 'pending rent is in no total');
  assert.deepEqual(v.pending.map((l) => [l.on, l.label, l.repeat]), [['2026-10-01', 'Rent', 'monthly@1']]);
  assert.equal(v.calendar.length, 30);
  const cell = (on: string) => v.calendar.find((c) => c.on === on)!;
  assert.deepEqual([cell(today).spent, cell(today).balance], [449, 91129.06]);
  assert.equal(cell('2026-09-29').balance, 91578.06, 'the end of yesterday: today’s ₱449 not yet spent');
  assert.equal(cell('2026-09-28').balance, 71778.06, 'and before the salon paid');
  assert.equal(cell('2026-09-28').received, 0);
  assert.deepEqual(v.categories.out, ['Groceries', 'Coffee', 'Dining Out', 'Housing', 'Transportation', 'Utilities', 'Self-care', 'Purchases'],
    'the person’s own most used first, then the usual ones they have not used');
  assert.deepEqual(v.categories.in, ['Client', 'Salary', 'Help']);
  assert.equal(v.unlabelled, 1, 'a row with no currency is not guessed into pesos');
  assert.deepEqual([v.first, v.last], ['2026-08', '2026-10'], 'the arrows reach August back and the pending rent forward');
  assert.equal(v.missing, null);
  const oct = kView({ rows, anchor, currency: 'PHP', view: 'PHP', today, month: '2026-10', fx: noFx });
  assert.ok(oct.calendar.every((c) => c.future && c.balance == null), 'no balance is drawn for a day that has not happened');
  assert.equal(oct.days.length, 0, 'pending rows are not days yet');
  const kept = kView({ rows, anchor, currency: 'PHP', view: 'PHP', today, month: '2026-09', fx: noFx, balanceNow: 91000 });
  assert.equal(kept.balance?.amount, 91000, 'the balance read on its own wins over the rows the screen was sent');
  assert.equal(kept.calendar.find((c) => c.on === '2026-09-29')!.balance, 91449, 'and the calendar works back from it');
  const unsaid = kView({ rows, anchor: null, currency: 'PHP', view: 'PHP', today, month: '2026-09', fx: noFx });
  assert.equal(unsaid.balance, null);
  assert.ok(unsaid.calendar.every((c) => c.balance == null), 'with no balance said there is nothing to work back from');

  /* 4. Shown in euros, logged in pesos: every row at its own day's rate, or none is. */
  const series: Array<{ base: string; quote: string; day: string; rate: number }> = [];
  for (let d = '2026-09-21'; d <= today; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) series.push({ base: 'PHP', quote: 'EUR', day: d, rate: 0.016 });
  }
  const fx = kTable(series);
  const eur = kView({ rows, anchor, currency: 'PHP', view: 'EUR', today, month: '2026-09', fx });
  assert.equal(eur.view, 'EUR');
  assert.deepEqual(eur.balance, { amount: 91129.06, shown: 1458.06, rateDay: today });
  assert.deepEqual(eur.days[0].lines.map((l) => [l.amount, l.shown]), [[-350, -5.6], [-99, -1.58]], 'the peso amount kept beside the euro one');
  assert.equal(eur.days[0].spent, 7.18);
  assert.equal(eur.pending[0].shown, -128, 'pending, at today’s rate: its own has not been published');
  assert.equal(kRateLine(eur), 'rate of 30 Sep, ECB daily rates');
  assert.equal(kRateLine(v), null);
  const august = kView({ rows, anchor, currency: 'PHP', view: 'EUR', today, month: '2026-08', fx, fxMissing: 'the exchange-rate service did not answer in time' });
  assert.equal(august.view, 'PHP', 'a month with a day the rates do not reach is shown whole in pesos, not half in each');
  assert.match(august.missing ?? '', /^No PHP to EUR rate for these days \(the exchange-rate service did not answer in time\), so this is in PHP\.$/);

  /* 5. What the add sheet sends, checked. */
  assert.deepEqual(kCheck({ kind: 'out', amount: '1,234.50', on: today, category: 'Groceries' }, today),
    { amount: -1234.5, on: today, category: 'Groceries', note: null, repeat: null });
  assert.deepEqual(kCheck({ kind: 'in', amount: 20000, on: '2026-09-29', note: '  Salon   deposit ', repeat: 'month' }, today),
    { amount: 20000, on: '2026-09-29', category: null, note: 'Salon deposit', repeat: 'month' });
  assert.equal(kCheck({ kind: 'out', amount: 5, on: today, category: 'Coffee', repeat: 'yearly' }, today).repeat, null);
  const refused = (input: Record<string, unknown>) => { try { kCheck(input, today); return null; } catch (e) { return (e as Error).message; } };
  assert.equal(refused({ kind: 'out', amount: 'abc', on: today, category: 'Coffee' }), 'Type an amount above zero.');
  assert.equal(refused({ kind: 'out', amount: 0, on: today, category: 'Coffee' }), 'Type an amount above zero.');
  assert.equal(refused({ kind: 'out', amount: 1e9, on: today, category: 'Coffee' }), 'That amount is too large to be one move.');
  assert.equal(refused({ amount: 5, on: today, category: 'Coffee' }), 'Money in or out?');
  assert.equal(refused({ kind: 'out', amount: 5, on: '2026-13-45', category: 'Coffee' }), 'Pick a day.');
  assert.equal(refused({ kind: 'out', amount: 5, on: '2028-01-01', category: 'Coffee' }), 'Pick a day within a year from today.');
  assert.equal(refused({ kind: 'out', amount: 5, on: '2025-09-01', category: 'Coffee' }), 'Pick a day within a year from today.', 'back past the year the read looks at');
  assert.equal(refused({ kind: 'out', amount: 5, on: today, category: ' ', note: '' }), 'Pick a category or write what it was.');

  /* 6. The words and numbers the screen prints. */
  assert.equal(kMoney(71479.06, 'PHP'), '₱71,479.06');
  assert.equal(kMoney(-510, 'PHP'), '-₱510');
  assert.equal(kMoney(1458.1, 'EUR'), '€1,458.10', 'a book is kept to the cent');
  assert.deepEqual([kDay(today, today), kDay('2026-09-29', today), kDay('2026-10-01', today), kDay('2026-09-27', today)], ['Today', 'Yesterday', 'Tomorrow', 'Sun 27 Sep']);
  assert.deepEqual([kShift('2026-12', 1), kShift('2026-01', -1)], ['2027-01', '2025-12']);
  assert.deepEqual(kAnchor({ book: { currency: 'php', balance: 5, at: 'x', on: today } }), { currency: 'PHP', balance: 5, at: 'x', on: today });
  assert.equal(kAnchor({ book: { currency: 'PHP', balance: 'lots', at: 'x', on: today } as never }), null, 'a finance row written wrong is no book, not a crash');
  assert.equal(kAnchor(null), null);

  /* 7. Runway reads the book's balance as cash, ahead of any statement. */
  const latest = () => ({ rate: 0.0172, day: '2026-09-29' });
  const withBook = { currency: '$', book: anchor, source: {} };
  const f1 = kFinance(withBook, null, 'now', { main: 'USD', latest, book: 91129.06 });
  assert.equal(f1.source?.cash, 'book');
  assert.equal(f1.cash, 1567.42, '₱91,129.06 at 0.0172');
  assert.deepEqual(f1.typed_in?.cash, { amount: 91129.06, currency: 'PHP', rate: 0.0172, day: '2026-09-29' });
  assert.equal(kFinance(f1, null, 'later', { main: 'USD', latest, book: 91129.06 }), f1, 'settled once, the next load writes nothing');
  assert.equal(kFinance(f1, null, 'later', { main: 'USD', latest, book: 90000 }).cash, 1548, 'a coffee logged, and runway moves with it');
  assert.match(kTypedLines(f1)[0], /^Cash: the Money tab's balance, ₱91,129, which is \$1,567 \(/);
  // A statement that prints a balance does not take the cash back from the book.
  const usd: KTx[] = [
    { id: 't1', on: '2026-09-01', amount: -300, currency: 'USD', key: 'rent', accountId: 'a', outcomeId: null },
    { id: 't2', on: '2026-09-25', amount: -200, currency: 'USD', key: 'food', accountId: 'a', outcomeId: null },
  ];
  const read = kRead({ txs: usd, payees: [], accounts: [{ id: 'a', label: 'Bank', currency: 'USD', balance: 500, on: '2026-09-25' }], today, currency: 'USD', main: 'USD', fx: noFx })!;
  assert.equal(read.cash?.amount, 500);
  const f2 = kFinance(f1, read, 'now', { main: 'USD', latest, book: 91129.06 });
  assert.equal(f2.cash, 1567.42, 'the person counts every peso they spend; a file a month old does not overrule that');
  assert.equal(f2.source?.cash, 'book');
  const inMain = kFinance({ currency: '$', book: { ...anchor, currency: 'USD' } }, null, 'now', { main: 'USD', latest, book: 1200 });
  assert.equal(inMain.cash, 1200);
  assert.equal(inMain.typed_in, undefined, 'a book in the main currency is the figure itself');
  const gone = kFinance({ ...f1, book: undefined }, null, 'now', { main: 'USD', latest, book: null });
  assert.deepEqual([gone.cash, gone.source?.cash, gone.typed_in?.cash], [undefined, undefined, undefined], 'no book, no book cash left behind');
  const typed = kTyped(f1, { cash: 5000, monthly_burn: 600 }, 'now', 'USD');
  assert.deepEqual([typed.cash, typed.source?.cash, typed.monthly_burn, typed.source?.monthly_burn], [1567.42, 'book', 600, 'typed'],
    'a cash typed on the Runway sheet would be overwritten on the next load, so it is not taken');
  assert.deepEqual(typed.book, anchor, 'saving the Runway sheet keeps the book');

  /* 8. A pending row is money that has not moved: in no figure of the read. */
  const pendingRead = kRead({
    txs: [...usd, { id: 't3', on: '2026-10-05', amount: -8000, currency: 'USD', key: 'rent', accountId: 'a', outcomeId: null }],
    payees: [], accounts: [], today, currency: 'USD', main: 'USD', fx: noFx,
  })!;
  assert.equal(pendingRead.outTotal, 500);
  assert.equal(pendingRead.to, '2026-09-25');

  console.log('copilot-core: money book checks passed');
}

moneyBook().catch((e) => { console.error(e); process.exit(1); });

/* ─── The money book, faster: the keypad, pictures, typed in another currency ─── */
import {
  anchorOf as fAnchor, bookView as fView, categoryIcon as fIcon, cleanAmount as fClean, convertEntry as fConvert, padKey as fPad, repeatsDue as fDue,
  seriesDay as fSeriesDay, type BookRow as FRow,
} from '../../src/lib/copilot/money/book';
import { fxTable as fTable } from '../../src/lib/copilot/money/fx';

async function moneyBookFaster() {
  /* 1. The keypad: two decimals, nine digits, no leading zeros, one point. */
  const typed = (keys: string[]) => keys.reduce((a, k) => fPad(a, k), '');
  assert.equal(typed(['1', '3', '0']), '130');
  assert.equal(typed(['0', '5']), '5', 'a leading zero gives way');
  assert.equal(typed(['.', '5']), '0.5', 'a point first is "0."');
  assert.equal(typed(['1', '.', '2', '3', '4']), '1.23', 'cents stop at two');
  assert.equal(typed(['1', '.', '.', '2']), '1.2', 'one point');
  assert.equal(typed(['1', '2', '.', '5', 'back', 'back']), '12');
  assert.equal(typed([...'1234567890']), '123456789', 'nine digits: a coffee is not a billion');
  assert.equal(fPad('130', 'clear'), '');
  assert.equal(fPad('130', 'x'), '130');
  assert.equal(fPad('', 'back'), '');
  assert.equal(fClean('1,500'), '1500', 'a comma from the number keyboard is a thousands mark, not a point');
  assert.equal(fClean('12.345'), '12.34');
  assert.equal(fClean('007.5'), '7.5');
  assert.equal(fClean('abc'), '');

  /* 2. A picture per row: by category, then by the words in it; plain when nothing matches. */
  const out = (c: string | null, text = '') => fIcon(c, text, -1);
  assert.deepEqual(
    ['Groceries', 'Dining Out', 'Coffee', 'Transportation', 'Utilities', 'Sent', 'Purchases', 'Self-care', 'Housing'].map((c) => out(c)),
    ['groceries', 'dining', 'coffee', 'transport', 'bills', 'sent', 'shopping', 'care', 'home'],
    'every category the owner uses has one');
  assert.deepEqual(['Salary', 'Client', 'Help'].map((c) => fIcon(c, '', 1)), ['salary', 'client', 'gift']);
  assert.equal(out(null, '5G DATA'), 'phone', 'a row with no category is read by its words');
  assert.equal(out('Food', 'Siomai'), 'dining');
  assert.equal(out(null, 'GrabFood order'), 'dining', 'GrabFood is food');
  assert.equal(out(null, 'Grab to Makati'), 'transport', 'Grab is a ride');
  assert.equal(out('Misc', 'thing'), 'out', 'nothing matches: a plain one, not a wrong one');
  assert.equal(fIcon('Misc', 'thing', 50), 'in');

  /* 3. A repeat counts from the day it was written for, not a date it was moved to. */
  assert.equal(fSeriesDay('2026-09-20', 'repeat:abc:2026-10-01'), '2026-10-01', 'moved earlier: the fingerprint’s day');
  assert.equal(fSeriesDay('2026-10-05', 'repeat:abc:2026-10-01'), '2026-10-05', 'moved later: its date');
  assert.equal(fSeriesDay('2026-09-20', 'book:abc'), '2026-09-20');
  // Counted from the moved date the next row is 1 Oct again — a fingerprint that
  // exists, so the write is ignored and the series stops without a word.
  const monthly = { every: 'month' as const, day: 1 };
  assert.deepEqual(fDue(monthly, fSeriesDay('2026-09-20', 'repeat:abc:2026-10-01'), '2026-10-02'), ['2026-11-01']);

  /* 4. Typed in euros, kept in pesos at the rate on its day. */
  const fx = fTable([
    { base: 'EUR', quote: 'PHP', day: '2026-09-28', rate: 63.5 },
    { base: 'EUR', quote: 'PHP', day: '2026-09-29', rate: 63.6 },
  ]);
  assert.deepEqual(fConvert(fx, 'EUR', 'PHP', -12, '2026-09-29', '2026-09-30'), { amount: -763.2, rate: 63.6, day: '2026-09-29' });
  assert.deepEqual(fConvert(fx, 'EUR', 'PHP', -12, '2026-09-30', '2026-09-30')?.day, '2026-09-29', 'today before the ECB publishes: the last rate');
  assert.equal(fConvert(fx, 'EUR', 'PHP', -12, '2026-10-20', '2026-09-30')?.amount, -763.2, 'pending: today’s rate, its own does not exist yet');
  assert.equal(fConvert(fx, 'JPY', 'PHP', -500, '2026-09-29', '2026-09-30'), null, 'no rate, no row: never a guess');
  assert.equal(fConvert(fx, 'EUR', 'PHP', -12, '2026-09-01', '2026-09-30'), null, 'nothing within five days of it either');

  /* 5. Shown in the currency it was typed in, it is what was typed. */
  const anchor = { currency: 'PHP', balance: 70000, at: '2026-09-30T00:00:00Z', on: '2026-09-30' };
  const rows: FRow[] = [{
    id: 'e', on: '2026-09-29', amount: -763.2, currency: 'PHP', description: 'Dining Out', category: 'Dining Out', note: null, repeat: null,
    createdAt: '2026-09-30T02:00:00Z', book: true, source: null, entered: { amount: -12, currency: 'EUR' },
  }];
  const phpToEur = fTable([{ base: 'PHP', quote: 'EUR', day: '2026-09-29', rate: 1 / 63.6 }, { base: 'PHP', quote: 'EUR', day: '2026-09-30', rate: 1 / 63.7 }]);
  const inPesos = fView({ rows, anchor, currency: 'PHP', view: 'PHP', today: '2026-09-30', month: '2026-09', fx: fTable([]) }).days[0].lines[0];
  assert.deepEqual([inPesos.shown, inPesos.entered, inPesos.icon], [-763.2, { amount: -12, currency: 'EUR' }, 'dining']);
  const inEuros = fView({ rows, anchor, currency: 'PHP', view: 'EUR', today: '2026-09-30', month: '2026-09', fx: phpToEur }).days[0].lines[0];
  assert.equal(inEuros.shown, -12, 'not ₱763.20 turned back into euros at another rounding');

  /* 6. The default currency to type in rides on the balance, and only when it is another. */
  assert.equal(fAnchor({ book: { currency: 'PHP', balance: 1, at: 'x', on: '2026-09-30', entry: 'eur' } })?.entry, 'EUR');
  assert.equal(fAnchor({ book: { currency: 'PHP', balance: 1, at: 'x', on: '2026-09-30', entry: 'PHP' } })?.entry, undefined);

  console.log('copilot-core: money book faster checks passed');
}

moneyBookFaster().catch((e) => { console.error(e); process.exit(1); });

/* ─── Safe to spend: what the balance allows today ─── */
import {
  bookView as sView, safeAfter as sAfter, safeAfterLine as sAfterLine, safeLine as sLine, safeToSpend as sSafe, safeWhy as sWhy, type BookRow as SRow,
} from '../../src/lib/copilot/money/book';
import { fxTable as sTable } from '../../src/lib/copilot/money/fx';

async function safeToSpendSuite() {
  const today = '2026-09-30';
  const anchor = { currency: 'PHP', balance: 60000, at: '2026-09-30T00:00:00Z', on: '2026-09-29' };
  const row = (r: Partial<SRow> & Pick<SRow, 'id' | 'on' | 'amount'>): SRow => ({
    currency: 'PHP', description: r.category ?? 'Money', category: null, note: null, repeat: null, createdAt: '2026-09-30T08:00:00Z', book: true, source: null, ...r,
  });

  /* 1. Nothing promised, nothing spent: the balance over thirty days. */
  const plain = sSafe({ anchor, balance: 60000, rows: [], today });
  assert.deepEqual([plain.perDay, plain.left, plain.committed, plain.spentToday, plain.broke], [2000, 2000, 0, 0, false]);

  /* 2. What today spent comes off today's share — the share itself does not shrink with each coffee. */
  const coffee = [row({ id: 'c', on: today, amount: -150, category: 'Coffee' })];
  const afterCoffee = sSafe({ anchor, balance: 59850, rows: coffee, today });
  assert.equal(afterCoffee.perDay, 2000, 'the balance already had the coffee out of it; put back, the share holds');
  assert.equal(afterCoffee.left, 1850);
  assert.equal(afterCoffee.spentToday, 150);
  const fileRow = [row({ id: 'f', on: today, amount: -500, book: false, source: 'budget.csv' })];
  assert.equal(sSafe({ anchor, balance: 60000, rows: fileRow, today }).spentToday, 0, 'a row read off a file never moved the balance, so it is not taken off twice');

  /* 3. Money already promised in the next thirty days comes off first; a repeat is carried through them. */
  const rent = [row({ id: 'r', on: '2026-10-01', amount: -8000, category: 'Housing', note: 'Rent', repeat: 'monthly@1' })];
  const withRent = sSafe({ anchor, balance: 60000, rows: rent, today });
  assert.equal(withRent.committed, 8000, 'the 1 Oct rent; 1 Nov is past the thirty days');
  assert.equal(withRent.perDay, Math.floor(52000 / 30));
  const weekly = [row({ id: 'w', on: '2026-10-07', amount: -500, category: 'Groceries', repeat: 'weekly' })];
  assert.equal(sSafe({ anchor, balance: 60000, rows: weekly, today }).committed, 2000, '7, 14, 21 and 28 Oct: four of them, not the one written ahead');
  const doubled = [...weekly, row({ id: 'w2', on: '2026-10-14', amount: -500, category: 'Groceries', description: 'Groceries', repeat: 'weekly' })];
  assert.equal(sSafe({ anchor, balance: 60000, rows: doubled, today }).committed, 2000, 'the next one already written is not counted twice');

  /* 4. Money that has not arrived is not counted: a figure called safe errs low. */
  const salary = [row({ id: 's', on: '2026-10-05', amount: 30000, category: 'Salary' })];
  assert.equal(sSafe({ anchor, balance: 60000, rows: salary, today }).perDay, 2000);

  /* 5. Over today, and spoken for. */
  const splurge = [row({ id: 'x', on: today, amount: -2600, category: 'Purchases' })];
  const over = sSafe({ anchor, balance: 57400, rows: splurge, today });
  assert.equal(over.left, -600);
  assert.equal(sLine(over, over.left, 'PHP'), '₱600 over today’s safe amount');
  const broke = sSafe({ anchor, balance: 5000, rows: rent, today });
  assert.equal(broke.broke, true);
  assert.equal(sLine(broke, broke.left, 'PHP'), 'Nothing safe to spend: what is coming up takes all of it');

  /* 6. What it says, and why when asked. */
  assert.equal(sLine(afterCoffee, afterCoffee.left, 'PHP'), '₱1,850 safe to spend today');
  assert.equal(sLine(null, null, 'PHP'), null, 'no balance said, no line');
  assert.equal(sWhy(withRent, 60000, 'PHP'), '₱60,000 in your book, less ₱8,000 coming up, over 30 days is ₱1,733 a day. Money that has not arrived is not counted.');
  assert.equal(sWhy(afterCoffee, 59850, 'PHP'), '₱59,850 in your book, over 30 days is ₱2,000 a day; ₱150 spent today. Money that has not arrived is not counted.');

  /* 6b. While a move is typed: what would be left after it. */
  assert.deepEqual(sAfter(plain, { amount: -150, on: today }, today), { left: 1850, broke: false }, 'a coffee today comes off today');
  assert.deepEqual(sAfter(plain, { amount: -3000, on: '2026-10-10' }, today), { left: 1900, broke: false }, 'a bill in ten days spreads over the thirty');
  assert.deepEqual(sAfter(plain, { amount: -3000, on: '2026-12-10' }, today), { left: 2000, broke: false }, 'past the thirty days it waits its turn');
  assert.deepEqual(sAfter(plain, { amount: 30000, on: '2026-10-05' }, today), { left: 2000, broke: false }, 'money not arrived counts for nothing');
  assert.deepEqual(sAfter(plain, { amount: 3000, on: today }, today), { left: 2100, broke: false }, 'money in today is spread too');
  assert.equal(sAfter(plain, { amount: -61000, on: '2026-10-02' }, today).broke, true);
  assert.equal(sAfterLine({ left: 1850, broke: false }, 'PHP'), '₱1,850 left today after this');
  assert.equal(sAfterLine({ left: -600, broke: false }, 'PHP'), '₱600 over today after this');

  /* 7. On the screen: in the book, and in the currency shown. */
  const rows = [...coffee, ...rent];
  const v = sView({ rows, anchor, currency: 'PHP', view: 'PHP', today, month: '2026-09', fx: sTable([]), balanceNow: 59850 });
  assert.equal(v.safe?.left, Math.floor((59850 + 150 - 8000) / 30 - 150));
  assert.equal(v.safeShown, v.safe?.left);
  const eur = sView({ rows, anchor, currency: 'PHP', view: 'EUR', today, month: '2026-09', balanceNow: 59850,
    fx: sTable([{ base: 'PHP', quote: 'EUR', day: '2026-09-29', rate: 0.0157 }, { base: 'PHP', quote: 'EUR', day: '2026-09-30', rate: 0.0157 }]) });
  assert.equal(eur.safeShown, Math.floor(eur.safe!.left * 0.0157), 'shown in euros at the newest rate, kept in pesos');
  const unsaid = sView({ rows, anchor: null, currency: 'PHP', view: 'PHP', today, month: '2026-09', fx: sTable([]) });
  assert.equal(unsaid.safe, null);

  console.log('copilot-core: safe to spend checks passed');
}

safeToSpendSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── A move said out loud (money/spoken.ts) ──────────────────────────────── */

import { parseSpoken as spoken } from '../../src/lib/copilot/money/spoken';
import { DEFAULT_CATEGORIES as SPOKEN_DEFAULTS } from '../../src/lib/copilot/money/book';

async function spokenMoveSuite() {
  const today = '2026-09-30'; // a Wednesday
  const categories = { out: [...SPOKEN_DEFAULTS.out, '5G Data'], in: SPOKEN_DEFAULTS.in };
  const say = (t: string) => spoken(t, { categories, today });
  const pick = (t: string) => { const s = say(t); return [s.kind, s.amount, s.category, s.note, s.on, s.currency]; };

  /* 1. The usual ones: a category and an amount, said either way round. */
  assert.deepEqual(pick('coffee 130'), ['out', '130', 'Coffee', '', today, null], 'the category named is the category, not the note too');
  assert.deepEqual(pick('130 coffee'), ['out', '130', 'Coffee', '', today, null]);
  assert.deepEqual(pick('I spent 130 on coffee'), ['out', '130', 'Coffee', '', today, null], 'the words around it are not the note');
  assert.deepEqual(pick('groceries 1,500.50'), ['out', '1500.5', 'Groceries', '', today, null], 'a comma between digits is a thousands mark');
  assert.deepEqual(pick('two coffees 260'), ['out', '260', 'Coffee', '', today, null], 'digits beat words, and a plural still names it');
  assert.deepEqual(pick('5G data 299'), ['out', '299', '5G Data', '', today, null], 'their own categories, digits and all');
  assert.equal(say('fifteen hundred groceries').amount, '1500', 'said in words');
  assert.equal(say('a thousand and fifty rent').amount, '1050');
  assert.equal(say('got paid 5k').amount, '5000');
  assert.equal(say('coffee 1:50').amount, '150', 'recognition hears "one fifty" as a time');
  assert.equal(say('coffee 5 billion').amount, null, 'past what one move can be, no amount rather than a wrong one');
  assert.equal(say('coffee').amount, null, 'nothing said, nothing filled in');

  /* 2. Money in: said, or a category that is only ever money in. */
  assert.deepEqual(pick('salary came in 50,000'), ['in', '50000', 'Salary', '', today, null]);
  assert.deepEqual(pick('client paid me 20,000'), ['in', '20000', 'Client', '', today, null], '"paid me" is money in, not "paid"');
  assert.deepEqual(pick('got paid 5k by client'), ['in', '5000', 'Client', '', today, null]);
  assert.deepEqual(pick('Salary 40000'), ['in', '40000', 'Salary', '', today, null], 'an in-only category is money in');
  assert.equal(say('paid rent 8000').kind, 'out');

  /* 3. No category named: the one of theirs the words picture, and only when there is just one. */
  assert.deepEqual(pick('Grab 240'), ['out', '240', 'Transportation', 'Grab', today, null], 'the words stay as the note');
  assert.deepEqual(pick('meralco 2,400'), ['out', '2400', 'Utilities', 'Meralco', today, null]);
  assert.equal(say('sweater 500').category, null, '"sweater" is not "eat": a word is matched from its start');
  const two = spoken('lunch 150', { categories: { out: ['Dining Out', 'Siomai', 'Coffee'], in: [] }, today });
  assert.deepEqual([two.category, two.note], [null, 'Lunch'], 'two of theirs share the picture: none is picked, the words are kept');

  /* 4. The day. */
  assert.equal(say('coffee 130 yesterday').on, '2026-09-29');
  assert.equal(say('kape 50 kahapon').on, '2026-09-29');
  assert.equal(say('dinner 450 day before yesterday').on, '2026-09-28');
  assert.equal(say('three days ago dinner 450').on, '2026-09-27');
  assert.equal(say('gas 1000 tomorrow').on, '2026-10-01', 'a day ahead is kept: the sheet says it is pending');
  assert.equal(say('groceries 900 last monday').on, '2026-09-28');
  assert.equal(say('groceries 900 on wednesday').on, today, 'the weekday it is, is today');
  assert.equal(say('groceries 900 last wednesday').on, '2026-09-23');
  assert.equal(say('rent 8000 next friday').on, '2026-10-02');
  assert.equal(say('dining out 700 on September 12').on, '2026-09-12');
  assert.equal(say('rent sept 5 8000').amount, '8000', 'the day of the month is not the amount');
  assert.equal(say('the 28th groceries 900').on, '2026-09-28');
  assert.equal(say('the 30th groceries 900').on, today);
  assert.equal(spoken('rent 8000 on the 28th', { categories, today: '2026-10-03' }).on, '2026-09-28', 'an ordinal not reached yet this month is last month’s');
  assert.equal(spoken('gift 900 december 24', { categories, today: '2027-01-02' }).on, '2026-12-24', 'a month and day is the one within half a year');
  const thirty = say('coffee 30 sept');
  assert.deepEqual([thirty.amount, thirty.on, thirty.onSaid], ['30', today, false], 'a bare number before a month stays the amount');
  assert.equal(say('coffee 130').onSaid, false);

  /* 5. Currency, only beside the amount. */
  assert.equal(say('40 euros lunch').currency, 'EUR');
  assert.equal(say('130 in euros coffee').currency, 'EUR');
  assert.equal(say('$12 netflix').currency, 'USD');
  assert.equal(say('20 singapore dollars taxi').currency, 'SGD');
  assert.equal(say('120 pesos coffee').currency, 'PHP');
  assert.equal(say('I won 500').currency, null, '"won" before an amount is a verb');
  assert.equal(say('a pound of beef 300').currency, null);
  assert.equal(say('coffee 120 pesos at starbucks').note, 'Coffee at starbucks', 'the currency word is not left in the note');

  /* 6. Two moves in one breath: the first is filled in, the other is said. */
  for (const t of ['coffee 130 and bread 50', 'coffee 130 bread 50', '130 coffee 50 bread']) {
    const s = say(t);
    assert.deepEqual([s.amount, s.category, s.note, s.more], ['130', 'Coffee', '', [50]], t);
  }

  /* 7. Hostile and empty. */
  assert.equal(say('constructor 50').amount, '50', 'a word that is a key of every object is just a word');
  assert.deepEqual(pick(''), ['out', null, null, '', today, null]);
  assert.equal(say('  coffee   130 ').heard, 'coffee 130', 'what was heard, as shown back');

  console.log('copilot-core: spoken move checks passed');
}

spokenMoveSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── The Swipe tab's deck (deck.ts) ──────────────────────────────────────── */

import {
  businessReach as dkBusinessReach, checkDraft as dkCheck, deckCards as dkCards, draftPrompt as dkPrompt, draftSources as dkSources,
  factsOf as dkFacts, findReplyTemplate as dkFindReply, phoneKind as dkPhoneKind, phoneReach as dkPhoneReach, reachLink as dkLink,
  type DeckInput as DkInput,
} from '../../src/lib/copilot/deck';
import type { MatchItem as DkItem, StageCard as DkStage } from '../../src/lib/copilot/matches';
import type { Move as DkMove, PipelineRow as DkRow, QueueItem as DkQueue } from '../../src/lib/copilot/types';

async function swipeDeckSuite() {
  /* 1. What a number is. A Philippine number says; elsewhere both ways are offered. */
  assert.deepEqual(dkPhoneKind('639171234567', 'PH'), { kind: 'mobile', dial: '+639171234567' });
  assert.deepEqual(dkPhoneKind('0917 123 4567', null), { kind: 'mobile', dial: '+639171234567' });
  assert.deepEqual(dkPhoneKind('63281234567', 'PH'), { kind: 'landline', dial: '+63281234567' }, 'a Manila landline');
  assert.deepEqual(dkPhoneKind('(02) 8123 4567', 'PH'), { kind: 'landline', dial: '+63281234567' });
  assert.deepEqual(dkPhoneKind('0321234567', 'PH'), { kind: 'landline', dial: '+63321234567' }, 'Cebu');
  assert.deepEqual(dkPhoneKind('12125551234', 'US'), { kind: 'unknown', dial: '+12125551234' });
  assert.deepEqual(dkPhoneReach('63281234567', 'PH').map((r) => r.via), ['call'], 'a landline is called, never WhatsApped');
  assert.deepEqual(dkPhoneReach('639171234567', 'PH').map((r) => r.via), ['whatsapp', 'sms', 'call']);
  assert.deepEqual(dkPhoneReach('12125551234', 'US').map((r) => r.via), ['whatsapp', 'call']);
  assert.deepEqual(dkPhoneReach('12345', null), [], 'too short to dial');
  assert.deepEqual(dkBusinessReach({ email: 'hi@shop.ph', website: 'https://shop.ph' }, 'PH').map((r) => r.via), ['email', 'site']);
  assert.deepEqual(dkBusinessReach({ website: 'shop.ph' }, 'PH'), [], 'a site with no scheme is not a link');

  /* 2. The links open the person's own app, filled in. */
  const msg = { body: 'Hi Rocar, quick one?', subject: 'Plumbing leads' };
  assert.equal(dkLink({ via: 'whatsapp', to: '+639171234567' }, msg), 'https://wa.me/639171234567?text=Hi%20Rocar%2C%20quick%20one%3F');
  assert.equal(dkLink({ via: 'sms', to: '+639171234567' }, msg), 'sms:+639171234567?&body=Hi%20Rocar%2C%20quick%20one%3F', 'Android reads ?body, iOS &body');
  assert.equal(dkLink({ via: 'call', to: '+63281234567' }, msg), 'tel:+63281234567');
  assert.equal(dkLink({ via: 'email', to: 'hi@shop.ph' }, msg), 'mailto:hi@shop.ph?subject=Plumbing%20leads&body=Hi%20Rocar%2C%20quick%20one%3F', 'spaces as %20, which every mail app reads');
  assert.equal(dkLink({ via: 'post', to: 'https://reddit.com/r/x/1' }, msg), 'https://reddit.com/r/x/1');
  assert.equal(dkLink({ via: 'post', to: 'javascript:alert(1)' }, msg), null);

  /* 3. Facts off the listing, never guessed. */
  assert.deepEqual(dkFacts({ rating: 4.2, reviews_count: 31, pain_signals: ['no_website', 'few_reviews'] }), ['4.2★ (31)', 'No website']);
  assert.deepEqual(dkFacts({ rating: 0, reviews_count: 0 }), ['No reviews yet']);
  assert.deepEqual(dkFacts({}), [], 'nothing on file, nothing said');

  /* 4. The deal: fresh finds, then To send, then the rest of New, then follow-ups that are due. */
  const now = new Date('2026-10-02T08:00:00Z');
  const opp = (id: string, contact: Record<string, string>, data: Record<string, unknown> = {}) => ({
    id, type: 'client', title: `Biz ${id}`, reason: `why ${id}`, value_label: null, value_amount: null, currency: null, effort: 'medium', fit_score: 70, score: 70,
    source: 'google_maps', url: `https://maps.example/${id}`, status: 'new', data: { country_code: 'PH', ...data }, external_id: id, source_kind: 'sourced',
    contact, scored_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z',
  });
  const pipeline = [
    { opportunity: opp('a', { whatsapp: '639171234567' }, { rating: 4.5, reviews_count: 12 }), execution: null, stage: 'not_drafted' },
    { opportunity: opp('b', { whatsapp: '63281234567' }), execution: null, stage: 'not_drafted' },
    { opportunity: opp('c', { website: 'https://c.ph' }), execution: null, stage: 'not_drafted' },
    { opportunity: opp('d', {}), execution: null, stage: 'not_drafted' },
    { opportunity: opp('q1', { whatsapp: '639181111111' }), execution: null, stage: 'drafted' },
    { opportunity: opp('q2', { email: 'owner@q2.ph' }), execution: null, stage: 'sent' },
  ] as unknown as DkRow[];
  const item = (id: string, over: Partial<DkItem> = {}): DkItem => ({
    id, from: 'business', answer: 'triage', group: 'clients', title: `Biz ${id}`, reason: `why ${id}`, tag: 'Plumber', sub: 'Plumber · Makati',
    image: null, initials: 'B', channel: 'whatsapp', url: null, fresh: false, created_at: '2026-10-01T00:00:00Z', saved: false, costLabel: null, judged: true, below: false, ...over,
  });
  const items = [
    item('a'), item('b'), item('c'), item('d'), item('q1'),
    item('mv-old', { from: 'feed', group: 'work', title: 'Apply to the Inside Sales role', url: 'https://jobboard.ph/1', fresh: false }),
    item('mv-new', { from: 'feed', group: 'work', title: 'Reply to the HVAC owner', url: 'https://reddit.com/r/hvac/2', fresh: true }),
  ];
  const queue = [
    { id: 'act-q1', title: 'Opener to Biz q1, ready to review', for_date: '2026-10-01', execution: { channel: 'whatsapp', recipient: '639181111111', body: 'Template opener', subject: null, created_at: '2026-09-25T00:00:00Z' } },
    { id: 'act-fu-due', title: 'Follow-up to Biz q2, ready to review', for_date: '2026-10-02', execution: { channel: 'email', recipient: 'owner@q2.ph', body: 'Follow up', subject: 'Re: hi', created_at: '2026-09-29T00:00:00Z' } },
    { id: 'act-fu-early', title: 'Follow-up to Biz x, ready to review', for_date: '2026-10-05', execution: { channel: 'whatsapp', recipient: '639180000000', body: 'Too early', subject: null, created_at: '2026-10-02T00:00:00Z' } },
  ] as unknown as DkQueue[];
  const stage = (q: string, oppId: string | null): DkStage => ({ key: `q:${q}`, stage: 'to_send', title: `Biz ${oppId}`, sub: 'Plumber · Makati', image: null, initials: 'B', status: 'Written', preview: null, draftId: q, link: null, oppId, channel: 'whatsapp' });
  const moves = [
    { id: 'mv-new', job: 'watch', kind: 'earn', headline: 'Reply to the HVAC owner', why: ['They ask for after-hours call handling.', 'From r/hvac, posted 2026-10-01.'], artifact: { kind: 'link', label: 'Open it', value: 'Looking for someone to handle after-hours calls for my HVAC shop.', href: 'https://reddit.com/r/hvac/2' }, cost_label: null, status: 'open', created_at: '2026-10-02T01:00:00Z' },
  ] as unknown as DkMove[];
  const input: DkInput = { now, today: '2026-10-02', items, toSend: [stage('act-q1', 'q1'), stage('act-fu-due', 'q2'), stage('act-fu-early', null)], queue, pipeline, moves };
  const deck = dkCards(input);
  assert.deepEqual(deck.map((c) => c.key), ['m:mv-new', 'q:act-q1', 'o:a', 'o:b', 'o:c', 'm:mv-old', 'q:act-fu-due'],
    'fresh find, To send, New in its order (a business already written to is not dealt twice, one with no way to reach is not dealt), a due follow-up; one not yet due waits');
  const find = deck[0];
  assert.equal(find.post, 'Looking for someone to handle after-hours calls for my HVAC shop.', 'the post itself, off its Move');
  assert.deepEqual(find.why, ['They ask for after-hours call handling.', 'From r/hvac, posted 2026-10-01.']);
  assert.deepEqual(find.reach, [{ via: 'post', to: 'https://reddit.com/r/hvac/2' }]);
  assert.equal(find.source, 'reddit.com');
  const draft = deck[1];
  assert.deepEqual([draft.kind, draft.written?.body, draft.reach.map((r) => r.via)], ['draft', 'Template opener', ['whatsapp', 'sms', 'call']]);
  assert.deepEqual(deck.find((c) => c.key === 'o:b')?.reach.map((r) => r.via), ['call'], 'the landline is dealt as a call');
  assert.deepEqual(deck.find((c) => c.key === 'o:c')?.reach.map((r) => r.via), ['site']);
  assert.deepEqual(deck.find((c) => c.key === 'o:a')?.facts, ['4.5★ (12)']);
  const fu = deck[deck.length - 1];
  assert.deepEqual([fu.followUp, fu.reach[0].via], [true, 'email']);

  /* 5. What a model writes is held to the rules before it reaches a card. */
  const offer = { sells: 'WhatsApp booking automations', for_who: 'clinics and salons', problem: 'missed bookings after hours', price_band: '₱8,000 per setup', proof_url: 'https://alex.ph/demo' };
  const dInput = { name: 'Alex Cruz', offer, working: null, area: 'Makati', card: { kind: 'business' as const, title: 'Rocar Plumbing', sub: 'Plumber · Makati', why: ['No website, answers on WhatsApp.'], facts: ['4.2★ (31)', 'No website'], post: null, source: null, followUp: false }, via: 'whatsapp' as const };
  const src = dkSources(dInput);
  const ok = dkCheck('"Hi Rocar — saw you have 31 reviews and no website. I set up WhatsApp booking for clinics and salons, ₱8,000 per setup. Worth a 10-minute call at 3pm?"', null, src, 'whatsapp', offer.proof_url);
  assert.ok(ok.ok, 'numbers from the listing and the offer, a duration and a time are fine');
  if (ok.ok) assert.ok(!ok.body.startsWith('"'), 'the quotes a model wraps a message in are taken off');
  const invented = dkCheck('Hi Rocar, I helped 40 plumbers double their bookings.', null, src, 'whatsapp', offer.proof_url);
  assert.deepEqual(invented, { ok: false, why: 'it wrote a number that is not in your offer or their listing (40)' });
  assert.equal(dkCheck('Hi [Owner Name], quick one.', null, src, 'whatsapp').ok, false, 'a placeholder is refused');
  assert.equal(dkCheck('See https://evil.example/x for more.', null, src, 'whatsapp', offer.proof_url).ok, false, 'a link you did not give is refused');
  assert.ok(dkCheck('Here is a demo: www.alex.ph/demo/.', null, src, 'whatsapp', offer.proof_url).ok, 'the proof link, however it is written');
  const long = dkCheck(`${'This is a sentence about bookings. '.repeat(30)}`, null, src, 'sms');
  assert.ok(long.ok && long.body.length <= 450 && long.body.endsWith('.'), 'cut at the last sentence that fits a text');
  const email = dkCheck('Hi, quick note.', ' "Bookings after hours" ', src, 'email');
  assert.deepEqual(email.ok && email.subject, 'Bookings after hours');
  const wa = dkCheck('Hi, quick note.', 'A subject', src, 'whatsapp');
  assert.equal(wa.ok && wa.subject, null, 'a WhatsApp has no subject');

  /* 6. The prompt carries the card, and a follow-up carries the first message. */
  const p = dkPrompt(dInput);
  assert.ok(p.includes('Rocar Plumbing (Plumber · Makati)') && p.includes('- No website') && p.includes('a WhatsApp message'));
  const fp = dkPrompt({ ...dInput, via: 'call', card: { ...dInput.card, followUp: true }, firstMessage: 'Hi Rocar, first note.' });
  assert.ok(fp.includes('THIS IS A FOLLOW-UP') && fp.includes('Hi Rocar, first note.') && fp.includes('a phone call'));
  assert.ok(dkPrompt({ ...dInput, card: { ...dInput.card, kind: 'find', post: 'Need a booking bot' }, via: 'post' }).includes('THE POST THEY ARE ANSWERING'));

  /* 6b. A link on a card is a web page, whatever a scraper wrote. */
  const evil = dkCards({ ...input, pipeline: [{ opportunity: opp('x', { whatsapp: '639171234567', website: 'javascript:alert(1)' }), execution: null, stage: 'not_drafted' }] as unknown as DkRow[], items: [item('x')], toSend: [], queue: [], moves: [] });
  assert.equal(evil[0].reach.some((r) => r.via === 'site'), false, 'no site way to a javascript: page');
  assert.equal(evil[0].link, 'https://maps.example/x', 'the listing, not the script');

  /* 7. Without a model, a find still gets a reply in the person's own words. */
  assert.equal(dkFindReply('Alex Cruz', offer, { title: 'x', group: 'work' }),
    'Hi — I\'d like to be considered for this. I work on WhatsApp booking automations for clinics and salons. An example: https://alex.ph/demo Happy to share more — what would be most useful? — Alex');

  console.log('copilot-core: swipe deck checks passed');
}

swipeDeckSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── Outreach: the door from the deck to everyone already written to ─────── */

import { outreachLine as olLine } from '../../src/lib/copilot/matches';

async function outreachSuite() {
  /* 1. A reply leads, with who is waiting beside it: an answer is what goes cold. */
  assert.deepEqual(olLine({ to_send: 4, waiting: 9, replied: 2 }), { stage: 'replied', label: '2 replied · 9 waiting', replied: true });
  assert.deepEqual(olLine({ to_send: 0, waiting: 0, replied: 1 }), { stage: 'replied', label: '1 replied', replied: true });

  /* 2. Then who you are waiting on; drafts last, since the deck deals them anyway. */
  assert.deepEqual(olLine({ to_send: 4, waiting: 3, replied: 0 }), { stage: 'waiting', label: '3 waiting', replied: false });
  assert.deepEqual(olLine({ to_send: 1, waiting: 0, replied: 0 }), { stage: 'to_send', label: '1 draft', replied: false });
  assert.equal(olLine({ to_send: 5, waiting: 0, replied: 0 })?.label, '5 drafts');

  /* 3. Nobody at any stage is nothing said: no door to an empty room. */
  assert.equal(olLine({ to_send: 0, waiting: 0, replied: 0 }), null);

  console.log('copilot-core: outreach checks passed');
}

outreachSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── The chain of bets behind Proof ──────────────────────────────────────── */
//
// The checks are the ways a picture of a business lies: a part called working
// on a one-dollar test, a weak link that sends you to the top of a funnel whose
// bottom has already failed, a button for a worker nobody connected, a number
// on screen the rows never held, and a draft written from a blank offer.

import {
  ASK_MAX, CLOSE_SAMPLE, LINK_KEYS, LINK_STATE_LABEL, businessChain, chainChanges, changeLine, parseSeenChain,
  readWins, snapshotChain, suggestedAsks, teamLine, waitingOnYou, weakLink, winsLine, type ChainInput,
} from '../../src/lib/copilot/business';
import { proofLine as proofLineBz } from '../../src/lib/copilot/proof';
import { diagnose as diagnoseBz } from '../../src/lib/copilot/diagnose';
import type { Agent as AgentBz } from '../../src/lib/copilot/machine';

async function businessChainSuite() {
  const agents: AgentBz[] = [
    { key: 'scout', name: 'Scout', role: 'r', state: 'working', line: '321 found so far · last looked 7h ago' },
    { key: 'watcher', name: 'Watcher', role: 'r', state: 'setup', line: 'Nothing to read yet — add a source' },
    { key: 'writer', name: 'Writer', role: 'r', state: 'ready', line: '72 drafts written' },
    { key: 'researcher', name: 'Researcher', role: 'r', state: 'failed', line: '1 project stopped — open it to try again' },
    { key: 'planner', name: 'Planner', role: 'r', state: 'working', line: 'Ran 8h ago' },
  ];
  // The owner's account, as the screenshots had it.
  const alex: ChainInput = {
    offer: { sells: 'Booking automation, custom AI workflows, no website', for_who: 'Staycation & resorts, Pest control, plumbing', problem: 'Save time', price_band: '$150' },
    said: { price: ['$70 — Quick Fix', '$150 — Growth', '$300+ — Revenue'], tried: ['700 WhatsApp messages, no sale'] },
    segments: ['Staycation & resorts', 'Pest control', 'plumbing'], area: 'Manila', web: true,
    funnel: { matched: 321, sent: 25, replied: 2, meetings: 6, won: 2, outside: 8 },
    worthAMessage: 40,
    bySegment: [{ segment: 'pest control', sent: 9, replied: 1, won: 1, paid: [1] }, { segment: 'staycation & resorts', sent: 12, replied: 1, won: 1, paid: [1] }],
    byChannel: [{ channel: 'whatsapp', sent: 25 }],
    wins: [1, 1], queue: 21, wonRecent: { amount: 2, days: 30 },
    goal: { title: 'Save Exit PH [NOV]', target: 1500, current: 0 }, currency: '$', workerConnected: true, agents, topOpening: 'running facebook ads',
  };
  const by = (i: ChainInput) => Object.fromEntries(businessChain(i).links.map((l) => [l.key, l]));

  /* 1. The account as it stands: heard, met, paid a dollar twice — not proven, and the weak link is the price. */
  const c = businessChain(alex);
  assert.deepEqual(c.links.map((l) => l.key), [...LINK_KEYS]);
  assert.deepEqual(c.links.map((l) => l.state), ['testing', 'works', 'testing', 'stuck', 'missing']);
  assert.equal(c.weak, 'pay', 'six meetings and no sale at the price binds everything above it');
  assert.deepEqual(c.verdict, { proven: false, title: 'Not proven yet', line: 'Proven at 3 paid at your $150. So far: 0.' });
  const p = by(alex);
  assert.equal(p.who.what, 'Staycation & resorts, Pest control, plumbing in Manila', 'their words, not a segment list re-typed');
  assert.equal(p.who.facts, '321 found on Maps and the web · 40 worth a message');
  assert.equal(p.reach.facts, '25 sent · 2 replies · 21 waiting to send');
  assert.equal(p.reach.why, '2 replies by 25 sent. The app plans on 2 in every 20.');
  // Per whole batch of twenty: two replies by a hundred sends is not an opener that works.
  const hundred = by({ ...alex, funnel: { ...alex.funnel, sent: 100, replied: 2 } }).reach;
  assert.equal(hundred.state, 'stuck');
  assert.equal(hundred.why, '100 sent and 2 replies. The app plans on 2 in every 20, so this many sends wanted 10.');
  assert.equal(p.close.facts, '2 replies · 6 meetings · 2 won');
  assert.equal(p.pay.facts, '2 paid, at $1 each — none at your $150');
  assert.equal(p.pay.why, '6 meetings and 2 paid, none at your $150. From 5 on, that says more about the price or the proof than about luck.');
  assert.ok(p.pay.more.includes('Save Exit PH [NOV]: $0 of $1,500') && p.pay.more.includes('$2 in the last 30 days'));
  // A part a person runs alone does not claim an agent; a part the Scout runs says so.
  assert.equal(p.pay.runner.by, 'you');
  assert.equal(p.who.runner.name, 'Scout', 'a Watcher with no source is not running this part');
  assert.equal(p.reach.runner.by, 'both', 'the Writer drafts; only you send — invariant 4');

  /* 2. A kind of business "pays" at the person's price, not on a one-dollar test. */
  assert.equal(p.who.state, 'testing');
  const paid150 = by({ ...alex, bySegment: [{ segment: 'pest control', sent: 9, replied: 1, won: 1, paid: [150] }] });
  assert.equal(paid150.who.state, 'works');
  assert.equal(paid150.who.why, 'pest control paid your $150. A kind of business that pays is the bar, and this one has.');
  // Two answers from one kind of business is the bar too — the funnel checkpoint's own number.
  assert.equal(by({ ...alex, bySegment: [{ segment: 'pest control', sent: 9, replied: 2, won: 0 }] }).who.state, 'works');

  /* 3. An opener that missed the bar is not sent more of: the move is new openers, not the queue. */
  const stuck = by({ ...alex, funnel: { ...alex.funnel, sent: 20, replied: 1, meetings: 0, won: 0 }, wins: [] });
  assert.equal(stuck.reach.state, 'stuck');
  assert.deepEqual(stuck.reach.moves.map((m) => m.key), ['reach-openers']);
  assert.equal(stuck.reach.moves[0].ask, 'Write three new first messages to "Staycation & resorts, Pest control, plumbing", each opening on something specific to their business, like "running facebook ads", in my own words',
    'a first line from their own matches, their words quoted, and not the offer again — the worker is sent it');
  assert.equal(businessChain({ ...alex, funnel: { ...alex.funnel, sent: 20, replied: 1, meetings: 0, won: 0 }, wins: [] }).weak, 'reach');
  // Below the sample it is early, and says how far from a number it is.
  assert.equal(by({ ...alex, funnel: { ...alex.funnel, sent: 9, replied: 0 } }).reach.why, '11 more sends and the reply rate is a number, not an early read.');

  /* 4. The weak link: a later part that failed on its own evidence binds the ones above it. */
  const both = businessChain({ ...alex, funnel: { ...alex.funnel, sent: 30, replied: 1, meetings: CLOSE_SAMPLE, won: 0 }, wins: [] });
  assert.equal(both.links.find((l) => l.key === 'reach')!.state, 'stuck');
  assert.equal(both.links.find((l) => l.key === 'close')!.state, 'stuck');
  assert.equal(both.weak, 'close', 'more replies only feed meetings already shown not to convert');
  // Nothing sent: the first part with something to do.
  assert.equal(businessChain({ ...alex, funnel: { matched: 40, sent: 0, replied: 0, meetings: 0, won: 0, outside: 0 }, wins: [], bySegment: [] }).weak, 'reach');
  // An unsaid price costs one sentence, so it comes before testing.
  assert.equal(businessChain({ ...alex, offer: { ...alex.offer, price_band: '' }, funnel: { matched: 40, sent: 3, replied: 0, meetings: 0, won: 0, outside: 0 }, wins: [] }).weak, 'pay');

  /* 5. Invariant 1: a blank offer writes nothing, and the chain says so once — on the offer card, not here. */
  const blank = businessChain({ ...alex, offer: {} });
  assert.equal(blank.weak, null);
  assert.equal(blank.verdict.title, 'Not started');
  const bReach = blank.links.find((l) => l.key === 'reach')!;
  assert.equal(bReach.state, 'missing');
  assert.equal(bReach.moves.length, 0, 'no second "write your offer" button');
  assert.equal(suggestedAsks(blank).some((m) => /opener|first message/i.test(m.ask ?? '')), false, 'nothing drafts from a blank offer');

  /* 6. Invariant 7: no worker, no button that writes a project nothing picks up. */
  const noWorker = businessChain({ ...alex, workerConnected: false });
  assert.equal(noWorker.links.flatMap((l) => l.moves).some((m) => m.by === 'ai'), false);
  assert.ok(noWorker.links.flatMap((l) => l.moves).some((m) => m.by === 'claude'), 'the same asks, for a chat');

  /* 7. Proven only at three paid at the price, and then the open part is whatever is left. */
  const proven = businessChain({ ...alex, wins: [150, 300, 150, 70], funnel: { ...alex.funnel, won: 4 }, said: { ...alex.said, deliver: ['Two calls, then I build it.'] } });
  assert.deepEqual(proven.verdict, { proven: true, title: 'Proven', line: '3 paid at your $150 or more. From here it is volume.' });
  assert.equal(proven.weak, null);
  assert.equal(businessChain({ ...alex, wins: [150, 300, 150], funnel: { ...alex.funnel, won: 3 } }).weak, 'deliver', 'selling works; delivery is the gap');

  /* 8. Wins said from the amounts, never a sum across a price nobody set. */
  assert.equal(winsLine(readWins([], '$150'), '$'), 'Nothing paid yet');
  assert.equal(winsLine(readWins([200], '$150'), '$'), '1 paid, $200 — all at your $150 or more');
  assert.equal(winsLine(readWins([100, 200, null], '$150'), '$'), '2 paid, $300 in all · 1 with no amount — 1 at your $150 or more');
  assert.equal(winsLine(readWins([null, null], '$150'), '$'), '2 paid, no amount logged');
  assert.equal(winsLine(readWins([5, 5], null), '€'), '2 paid, at €5 each');

  /* 9. Every ask fits a project's brief, however long the offer. */
  const long = businessChain({ ...alex, offer: { ...alex.offer, sells: 'x'.repeat(400), for_who: 'y'.repeat(300) }, funnel: { ...alex.funnel, sent: 30, replied: 0 } });
  for (const m of long.links.flatMap((l) => l.moves)) if (m.ask) assert.ok(m.ask.length <= ASK_MAX, `${m.key} is ${m.ask.length} characters`);

  /* 10. Every state has its word, and the suggestions are the weak link's first, never a "you" move. */
  for (const l of c.links) assert.ok(LINK_STATE_LABEL[l.state]);
  const asks = suggestedAsks(c);
  assert.ok(asks.length <= 3 && asks.every((m) => m.by !== 'you' && !!m.ask));
  assert.equal(asks[0].key, 'pay-proof');

  /* 11. Since you last looked: nothing on a first visit, the part that moved after. */
  assert.deepEqual(chainChanges(null, c.links), []);
  const seen = parseSeenChain(JSON.parse(JSON.stringify(snapshotChain('2026-10-01T00:00:00Z', businessChain({ ...alex, funnel: { ...alex.funnel, replied: 1 } }).links))));
  const moved = chainChanges(seen, c.links);
  assert.deepEqual(moved.map((m) => m.key), ['reach']);
  assert.equal(changeLine(moved[0]), 'How they hear went from Not working to Works', 'one more reply crossed the bar');
  assert.equal(parseSeenChain({ at: 'yesterday', states: {} }), null, 'storage is reshaped, not trusted');
  assert.deepEqual(parseSeenChain({ at: '2026-10-01T00:00:00Z', states: { who: 'great', reach: 'works' } })?.states, { reach: 'works' });

  /* 12. A business whose buyers do not arrive through the app's sends is read through what the person logs. */
  const quiet = { ...alex, funnel: { matched: 0, sent: 0, replied: 0, meetings: 0, won: 0, outside: 0 }, bySegment: [], byChannel: [], wins: [], queue: 0, wonRecent: { amount: 0, days: 30 } };
  // Nobody said how, and nothing was sent: a question, not outreach by default.
  const unsaid = by({ ...quiet, foundBy: null });
  assert.equal(unsaid.reach.state, 'missing');
  assert.deepEqual(unsaid.reach.moves.map((m) => m.go), [{ sheet: 'foundby' }]);
  assert.equal(businessChain({ ...quiet, foundBy: null }).weak, 'reach');
  // Said: inbound. The app cannot see them arrive, so a bet counts it.
  const inbound = (x: Partial<ChainInput> = {}) => by({ ...quiet, foundBy: 'inbound', ...x });
  assert.equal(inbound().reach.state, 'untested');
  assert.equal(inbound().reach.why, 'The app cannot see this way in, so a bet counts it: the enquiries and sign-ups that come in.');
  assert.deepEqual(inbound().reach.moves.map((m) => m.key), ['reach-bet', 'reach-landing'], 'a bet, and the page buyers would find');
  assert.deepEqual(inbound({ assets: { demo: null, script: null, landing: 'Booking page', workflow: null } }).reach.moves.map((m) => m.key), ['reach-bet']);
  assert.equal(inbound({ assets: { demo: null, script: null, landing: 'Booking page', workflow: null } }).reach.what, 'They find you online · Booking page');
  type BetOn = NonNullable<ChainInput['bets']>[number];
  const betOn = (part: BetOn['part'], state: BetOn['state'], start: string): BetOn =>
    ({ part, state, start, line: `${state === 'passed' ? 5 : 1} of 5 enquiries`, when: state === 'running' ? null : '4 Oct' });
  assert.equal(inbound({ bets: [betOn('reach', 'running', '2026-10-01')] }).reach.state, 'testing');
  assert.equal(inbound({ bets: [betOn('reach', 'failed', '2026-09-20'), betOn('reach', 'failed', '2026-09-01')] }).reach.state, 'stuck', 'two short in a row is the channel not working by its own record');
  assert.equal(inbound({ bets: [betOn('reach', 'passed', '2026-09-20'), betOn('reach', 'passed', '2026-09-01')] }).reach.state, 'works', 'twice is a pattern');
  assert.equal(inbound({ bets: [betOn('reach', 'passed', '2026-09-20')], wins: [150] }).reach.state, 'works', 'one pass with somebody paying is the channel doing its job');
  // A pass, then a miss: not two short in a row, so still being tested.
  assert.equal(inbound({ bets: [betOn('reach', 'failed', '2026-09-20'), betOn('reach', 'passed', '2026-09-01')] }).reach.state, 'testing');
  // Who buys: conversations about the problem, a sale at the price, or a bet that passed.
  assert.equal(inbound().who.state, 'untested');
  assert.equal(inbound({ talks: { n: 4, problem: 3, committed: 1 } }).who.why, '3 of the 4 possible buyers you talked to have the problem, and 1 committed to something.');
  assert.equal(inbound({ wins: [150] }).who.state, 'works', 'a sale at the price is a buyer found');
  assert.equal(inbound({ wins: [1] }).who.state, 'untested', 'a one-dollar test is not one');
  assert.equal(inbound({ bets: [betOn('who', 'passed', '2026-09-20')] }).who.state, 'works');
  // How they say yes: logged conversations stand in for replies the app never saw.
  assert.equal(inbound().close.state, 'untested');
  assert.deepEqual(inbound().close.moves.map((m) => m.go), [{ sheet: 'talk' }]);
  assert.equal(inbound({ talks: { n: CLOSE_SAMPLE, problem: 2, committed: 0 } }).close.state, 'stuck', 'five conversations and nobody paid says more about the ask');
  assert.equal(inbound({ talks: { n: 2, problem: 2, committed: 0 }, funnel: { ...quiet.funnel, won: 1 }, wins: [150] }).close.state, 'testing');
  // What they pay: conversations count toward the sample a price is judged on.
  assert.equal(inbound({ talks: { n: CLOSE_SAMPLE, problem: 2, committed: 0 }, wins: [20] }).pay.state, 'stuck');
  assert.equal(inbound({ talks: { n: CLOSE_SAMPLE, problem: 2, committed: 0 }, wins: [20] }).pay.why, '5 conversations and 1 paid, none at your $150. From 5 on, that says more about the price or the proof than about luck.');
  // A demo kept as an asset is proof: the chain stops asking for one.
  assert.ok(by(alex).pay.moves.some((m) => m.key === 'pay-proof'));
  assert.ok(!by({ ...alex, assets: { demo: 'Booking bot walkthrough', script: null, landing: null, workflow: null } }).pay.moves.some((m) => m.key === 'pay-proof'));
  // Delivery is judged by its own bets: written down is a claim, a bet that passed is evidence.
  assert.equal(inbound({ assets: { demo: null, script: null, landing: null, workflow: 'Kick-off, build, hand-over' } }).deliver.state, 'untested');
  assert.equal(inbound({ assets: { demo: null, script: null, landing: null, workflow: 'Kick-off, build, hand-over' } }).deliver.what, 'Kick-off, build, hand-over');
  assert.equal(inbound({ assets: { demo: null, script: null, landing: null, workflow: 'Steps' }, bets: [betOn('deliver', 'passed', '2026-09-20')] }).deliver.state, 'works');
  // Outreach said out loud reads exactly as the rows did: the owner's account is unchanged by any of this.
  assert.deepEqual(businessChain({ ...alex, foundBy: 'outreach' }).links.map((l) => l.state), c.links.map((l) => l.state));
  // A passed bet on who buys is evidence in the outreach reading too.
  assert.equal(by({ ...alex, bets: [betOn('who', 'passed', '2026-09-20')] }).who.state, 'works');

  /* 13. The team in one line: every agent that is not well named, the optional Watcher not nagged. */
  assert.deepEqual(teamLine(agents), { line: '2 of 5 agents working · Researcher failed', trouble: 1 });

  /* 14. What waits on the person: a draft to approve, a question, a breakage — not work running. */
  const threads = [
    threadV2({ id: 'a', status: 'draft' }),
    threadV2({ id: 'b', status: 'blocked' }, [{ kind: 'needs_you', summary: 'Which year?' }]),
    threadV2({ id: 'c', status: 'blocked' }, [{ kind: 'failed', summary: '500' }]),
    threadV2({ id: 'd', status: 'active' }),
  ];
  assert.equal(waitingOnYou(threads), 3);
  // Proof's line under the greeting: the verdict, the bet or the checkpoint, and what waits on the person.
  const noBet = { current: null, checkpoint: { due: false }, part: null };
  assert.equal(proofLineBz(c, noBet, 3), 'Not proven · no bet running · 3 waiting on you');
  assert.equal(proofLineBz(proven, noBet, 0), 'Proven · no bet running');
  assert.equal(proofLineBz(blank, { ...noBet, checkpoint: { due: true } }, 0), 'Not started · checkpoint due');

  /* 15. The rows behind it: per kind of business, per channel, and every win's amount, from the funnel's own rows. */
  const dz = diagnoseBz({
    opportunities: [
      { id: 'o1', status: 'acted', source: 'google_maps', source_kind: 'sourced', data: { category: 'Pest control service' }, reason: null, title: 'A' },
      { id: 'o2', status: 'acted', source: 'google_maps', source_kind: 'sourced', data: { category: 'Plumber' }, reason: null, title: 'B' },
    ] as never,
    executions: [
      { approval_state: 'sent', channel: 'whatsapp', opportunity_id: 'o1', sent_at: '2026-09-01T00:00:00Z' },
      { approval_state: 'sent', channel: 'email', opportunity_id: 'o2', sent_at: '2026-09-02T00:00:00Z' },
    ],
    outcomes: [
      { kind: 'reply', opportunity_id: 'o1', occurred_at: '2026-09-03T00:00:00Z' },
      { kind: 'reply', opportunity_id: 'o1', occurred_at: '2026-09-04T00:00:00Z' },
      { kind: 'won', opportunity_id: 'o1', occurred_at: '2026-09-05T00:00:00Z', amount: 150 },
      { kind: 'won', opportunity_id: null, occurred_at: '2026-09-06T00:00:00Z', amount: null },
    ],
    offer: { sells: 'x' }, targetSegments: ['pest control'],
  });
  assert.deepEqual(dz.bySegment?.[0], { segment: 'pest control', sent: 1, replied: 1, won: 1, paid: [150] }, 'two replies from one business are one converted lead');
  assert.deepEqual(dz.byChannel, [{ channel: 'whatsapp', sent: 1, replied: 1 }, { channel: 'email', sent: 1, replied: 0 }]);
  assert.deepEqual(dz.wins, [150, null], 'a win with no amount is counted, and not priced');

  console.log('copilot-core: business chain checks passed');
}

businessChainSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── Bets: one at a time, judged by the rows ─────────────────────────────── */
//
// The checks are the ways an experiment lies: a line set after the result is
// in, a send from before the bet counted toward it, a day read in the wrong
// zone, a one-dollar sale passed off as one at the price, a call-off that
// erases a pass, the next bet's sends counted on the last one, a logged number
// shown as a measured one, and a play the app offers that it could never count.

import {
  BELIEF_MAX as LAB_BELIEF_MAX, BET_DAYS_MAX, DEFAULT_BET_DAYS, LAB_BET, LAB_CHECKPOINT, LAB_METRICS, LAB_STOP, LAB_TALK, METRIC as LAB_METRIC,
  PLAYS, PLAY_BY_KEY, TARGET_MAX, TRIES_FOR,
  betPrice, betView, checkpointView, countIn, countedFrom, dayIn, decisionWords, gradeWords, labClock, labFromEvents, labHome, labLine,
  labView, metricWords as labMetricWords, normalizeBet, normalizeCheckpoint, normalizeTalk, overPlan, passLine, playLine, playsFor, spanWords,
  suggestBelief, talkCounts,
  type Bet, type Checkpoint as LabCheckpoint, type DayRows, type LabEventRow, type Talk as LabTalk,
} from '../../src/lib/copilot/lab';
import { LINK_KEYS as LAB_PARTS, type BusinessLink as LabLink, type LinkKey as LabPart, type LinkState as LabState } from '../../src/lib/copilot/business';
import { OBJECTIVE_MAX as LAB_OBJECTIVE_MAX } from '../../src/lib/copilot/commission';
import { readFileSync as readLabFile } from 'node:fs';

async function labSuite() {
  const today = '2026-10-04';
  const bet = (b: Partial<Bet> & Pick<Bet, 'metric' | 'target' | 'days' | 'start'>): Bet => ({
    id: 'b', part: 'reach', belief: 'They answer', play: null, idea: null, unit: null, tries: null, price: null, priceLabel: null, experiment: null, openedAt: `${b.start}T01:00:00Z`, ...b,
  });
  const none: DayRows = { sends: [], outcomes: [], finished: [], talks: [] };
  const talk = (on: string, commitment: LabTalk['commitment'], problem: LabTalk['problem'] = 'yes'): LabTalk => ({ id: `t-${on}-${commitment}`, on, who: null, role: 'buyer', problem, commitment, said: null, via: null, at: `${on}T09:00:00Z` });

  /* 1. A bet is held to what a verdict needs, and refused with what to fix — never coerced into one nobody wrote. */
  const ctx = { today, price: 150, priceLabel: '$150' };
  const ok = normalizeBet({ part: 'pay', belief: '  Pest control   pays $150  ', metric: 'paid_at_price', target: '1', tries: { metric: 'sent', planned: 10 }, days: 14, play: 'guarantee' }, ctx);
  assert.deepEqual(ok, { ok: true, value: { part: 'pay', belief: 'Pest control pays $150', play: 'guarantee', idea: null, metric: 'paid_at_price', unit: null, target: 1, tries: { metric: 'sent', planned: 10 }, days: 14, start: today, price: 150, priceLabel: '$150', experiment: null } });
  const base = { part: 'reach', belief: 'They answer', metric: 'replied', target: 2, days: 10 };
  const refused = (raw: Record<string, unknown>, c = ctx) => { const r = normalizeBet(raw, c); return r.ok ? null : r.error; };
  assert.equal(refused({ ...base, part: 'everything' }), 'Which part of the business is it about?');
  assert.equal(refused({ ...base, belief: '   ' }), 'Say what you believe, in one sentence.');
  assert.equal(refused({ ...base, metric: 'vibes' }), 'What should it count?');
  for (const target of [0, TARGET_MAX + 1, 'lots', null]) assert.equal(refused({ ...base, target }), `The pass line is a count from 1 to ${TARGET_MAX}.`);
  for (const days of [0, BET_DAYS_MAX + 1]) assert.equal(refused({ ...base, days }), `A bet runs from 1 to ${BET_DAYS_MAX} days.`);
  assert.equal(refused({ ...base, tries: { metric: 'replied', planned: 10 } }), 'What it takes is a different count, from 1 to 500.', 'a count out of itself is no plan');
  assert.equal(refused({ ...base, tries: { metric: 'sent', planned: 0 } }), 'What it takes is a different count, from 1 to 500.');
  // A sale at your price with no price would pass on any payment: the one-dollar test.
  assert.equal(refused({ ...base, metric: 'paid_at_price', target: 1 }, { today, price: null, priceLabel: null }), 'Say what it costs first: a sale at your price needs a price.');
  const own = normalizeBet({ ...base, play: 'made-up', belief: 'x'.repeat(400) }, ctx);
  assert.ok(own.ok && own.value.play === null && own.value.belief.length === LAB_BELIEF_MAX, 'an unknown play is not invented into one; a belief is a sentence');
  assert.ok(own.ok && own.value.start === today, 'a bet starts the day it is written, whatever the client says');

  // A conversation: today unless said, never a day not lived yet, a month back at most.
  assert.deepEqual(normalizeTalk({ problem: 'yes', commitment: 'money', who: ' Rico ', said: '' }, today), { ok: true, value: { on: today, who: 'Rico', role: 'buyer', problem: 'yes', commitment: 'money', said: null, via: null } });
  assert.deepEqual(normalizeTalk({ on: '2026-10-05' }, today), { ok: false, error: 'That day has not happened yet.' });
  assert.deepEqual(normalizeTalk({ on: '2026-09-03' }, today), { ok: false, error: 'Only the last 30 days can be logged.' });
  assert.ok(normalizeTalk({ on: '2026-09-04' }, today).ok, 'thirty days back is the edge, and inside it');
  assert.deepEqual(normalizeTalk({ on: 'last week' }, today), { ok: false, error: 'That is not a day.' });
  const shrug = normalizeTalk({ problem: 'maybe', commitment: 'a compliment' }, today);
  assert.ok(shrug.ok && shrug.value.problem === 'unasked' && shrug.value.commitment === 'none', 'an answer it does not know is the honest default, not a yes');

  // The checkpoint: a pivot names the part it changes; the chain is kept only as it can be read back.
  assert.deepEqual(normalizeCheckpoint({ decision: 'maybe' }, today), { ok: false, error: 'Pivot or persevere?' });
  assert.deepEqual(normalizeCheckpoint({ decision: 'pivot' }, today), { ok: false, error: 'Which part are you changing?' });
  assert.deepEqual(
    normalizeCheckpoint({ decision: 'persevere', part: 'pay', note: ' Keep going ', chain: { who: 'testing', pay: 'great', reach: 'works', other: 'works' } }, today),
    { ok: true, value: { on: today, decision: 'persevere', part: null, note: 'Keep going', chain: { who: 'testing', reach: 'works' } } },
  );

  /* 2. What was stored, read back: reshaped rather than trusted, newest first, and the first call-off is the one. */
  const ev = (id: number, event_type: string, created_at: string, payload: Record<string, unknown>): LabEventRow => ({ id, event_type, created_at, payload });
  const ledger = labFromEvents([
    ev(3, LAB_STOP, '2026-09-05T02:00:00Z', { bet: '1', note: 'Nobody answered' }),
    ev(1, LAB_BET, '2026-09-01T01:00:00Z', { part: 'reach', belief: '  They   answer ', metric: 'replied', target: 2, days: 10, start: '2026-09-01', play: 'one-line', tries: { metric: 'sent', planned: 10 }, price: 150, priceLabel: '$150' }),
    ev(4, LAB_STOP, '2026-09-06T02:00:00Z', { bet: '1', note: 'A second tap' }),
    ev(2, LAB_BET, '2026-09-02T01:00:00Z', { part: 'everything', belief: 'x', metric: 'replied', target: 2, days: 10, start: '2026-09-02' }),
    ev(5, LAB_BET, '2026-09-07T01:00:00Z', { part: 'pay', belief: 'They pay', metric: 'paid', target: 1, days: 7, start: '2026-09-07', play: 'not-a-play', price: -5 }),
    ev(6, LAB_TALK, '2026-09-08T09:00:00Z', { on: '2026-09-03', who: 'Rico', problem: 'yes', commitment: 'time' }),
    ev(7, LAB_TALK, '2026-09-08T10:00:00Z', { on: '2026-09-07', problem: 'maybe', commitment: 'hug' }),
    ev(8, LAB_TALK, '2026-09-08T11:00:00Z', { on: 'yesterday' }),
    ev(9, LAB_CHECKPOINT, '2026-09-10T11:00:00Z', { on: '2026-09-10', decision: 'pivot', part: 'pay', chain: { pay: 'stuck', who: 'bogus', nope: 'works' } }),
    ev(10, LAB_CHECKPOINT, '2026-09-11T11:00:00Z', { on: '2026-09-11', decision: 'shrug' }),
  ]);
  assert.deepEqual(ledger.bets.map((b) => b.id), ['5', '1'], 'newest first, and a bet that does not hold together is dropped');
  assert.equal(ledger.bets[1].belief, 'They answer');
  assert.equal(ledger.bets[1].play, 'one-line');
  assert.deepEqual(ledger.bets[1].tries, { metric: 'sent', planned: 10 });
  assert.deepEqual([ledger.bets[0].play, ledger.bets[0].price, ledger.bets[0].priceLabel], [null, null, null], 'no invented play, and no price below nothing');
  assert.deepEqual(ledger.stopped.get('1'), { at: '2026-09-05T02:00:00Z', note: 'Nobody answered' }, 'a second tap on a stopped bet changes nothing');
  assert.deepEqual(ledger.talks.map((t) => [t.id, t.problem, t.commitment]), [['7', 'unasked', 'none'], ['6', 'yes', 'time']], 'by the day it happened; a talk with no day is dropped');
  assert.deepEqual(ledger.checkpoints.map((c) => [c.id, c.decision, c.part, c.chain]), [['9', 'pivot', 'pay', { pay: 'stuck' }]]);

  /* 3. Counting: both ends of the window, a reply once per business, a sale only at the price. */
  const rows: DayRows = {
    sends: ['2026-09-01', '2026-09-02', '2026-09-02', '2026-09-05'],
    outcomes: [
      { kind: 'reply', day: '2026-09-02', opportunity: 'o1', amount: null },
      { kind: 'reply', day: '2026-09-03', opportunity: 'o1', amount: null },
      { kind: 'reply', day: '2026-09-03', opportunity: null, amount: null },
      { kind: 'reply', day: '2026-09-04', opportunity: null, amount: null },
      { kind: 'meeting', day: '2026-09-04', opportunity: 'o1', amount: null },
      { kind: 'won', day: '2026-09-05', opportunity: 'o1', amount: 150 },
      { kind: 'won', day: '2026-09-05', opportunity: 'o2', amount: 1 },
      { kind: 'won', day: '2026-09-06', opportunity: 'o3', amount: null },
      { kind: 'won', day: '2026-09-06', opportunity: 'o4', amount: 300 },
    ],
    finished: ['2026-09-03'],
    talks: [talk('2026-09-02', 'none'), talk('2026-09-03', 'intro')],
  };
  const all = (m: (typeof LAB_METRICS)[number], price: number | null = 150) => countIn(m, '2026-09-01', '2026-09-30', rows, price);
  assert.equal(countIn('sent', '2026-09-02', '2026-09-05', rows, null), 3, 'both ends of the window count');
  assert.equal(all('replied'), 3, 'one business answering twice is one reply; a reply with no business is one each');
  assert.deepEqual([all('meetings'), all('paid'), all('talks'), all('committed'), all('handed')], [1, 4, 2, 1, 1]);
  assert.equal(all('paid_at_price'), 2, 'a dollar test and an amount nobody said are not sales at the price');
  assert.equal(all('paid_at_price', null), 0, 'with no price there is no sale at it');
  assert.equal(countIn('sent', '2026-09-05', '2026-09-01', rows, null), 0);

  /* 4. A day is the person's: an evening in Manila is the next morning's date in Manila, not in UTC. */
  assert.equal(dayIn('2026-09-28T17:00:00Z', 'Asia/Manila'), '2026-09-29');
  assert.equal(dayIn('2026-09-28T17:00:00Z', 'Not/AZone'), '2026-09-28', 'an unknown zone falls back to UTC rather than throwing');
  assert.equal(dayIn(null, 'UTC'), null);
  const zoned = (timezone: string) => labHome({
    events: [ev(1, LAB_BET, '2026-09-28T17:30:00Z', { part: 'reach', belief: 'They answer', metric: 'sent', target: 5, days: 7, start: '2026-09-29' })],
    unreadable: null, timezone, today: '2026-09-30',
    // Before the start in Manila, two inside it, one at Manila's midnight — and one a year old, never read.
    sends: ['2025-01-01T00:00:00Z', '2026-09-28T15:00:00Z', '2026-09-28T17:00:00Z', '2026-09-29T15:59:00Z', '2026-09-29T16:00:00Z'],
    outcomes: [], finished: [],
  }).bets[0].result;
  assert.equal(zoned('Asia/Manila'), 3, 'only what happened from the start counts, on the person’s calendar');
  assert.equal(zoned('UTC'), 2);

  /* 5. Where a bet stands. Early is a pass; a pass outlives a call-off; a call-off counts only what came before. */
  const b1 = bet({ metric: 'replied', target: 2, days: 10, start: '2026-09-01', tries: { metric: 'sent', planned: 10 } });
  const replies: DayRows = {
    ...none,
    sends: ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-08', '2026-09-09', '2026-09-09'],
    outcomes: [
      { kind: 'reply', day: '2026-08-31', opportunity: 'o0', amount: null },
      { kind: 'reply', day: '2026-09-03', opportunity: 'o1', amount: null },
      { kind: 'reply', day: '2026-09-04', opportunity: 'o1', amount: null },
      { kind: 'reply', day: '2026-09-06', opportunity: 'o2', amount: null },
      { kind: 'reply', day: '2026-09-09', opportunity: 'o3', amount: null },
    ],
  };
  const at = (t: string, stop: string | null = null) => betView(b1, stop, replies, t);
  assert.deepEqual([at('2026-09-05').state, at('2026-09-05').result, at('2026-09-05').day, at('2026-09-05').last], ['running', 1, 5, '2026-09-10'], 'a reply from before the bet is not the bet’s');
  const early = at('2026-09-12');
  assert.deepEqual([early.state, early.ended, early.result, early.tries], ['passed', '2026-09-06', 2, 2], 'it passed the day it crossed, and its counts stop there');
  assert.deepEqual([at('2026-09-08', '2026-09-05').state, at('2026-09-08', '2026-09-05').ended, at('2026-09-08', '2026-09-05').result], ['stopped', '2026-09-05', 1]);
  assert.equal(at('2026-09-08', '2026-09-07').state, 'passed', 'calling a bet off after it passed does not unpass it');
  const short = betView(b1, null, { ...replies, outcomes: replies.outcomes.slice(0, 3) }, '2026-09-11');
  assert.deepEqual([short.state, short.ended, short.result, short.day], ['failed', '2026-09-10', 1, 10]);
  assert.equal(overPlan(short), null, 'within the plan, nothing to say');
  const over = betView(bet({ metric: 'replied', target: 1, days: 14, start: '2026-09-01', tries: { metric: 'sent', planned: 2 } }), null,
    { ...none, sends: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-20'], outcomes: [{ kind: 'reply', day: '2026-09-03', opportunity: 'o1', amount: null }] }, '2026-09-20');
  assert.equal(overPlan(over), '3 messages sent against the 2 planned, so a pass here says less than it looks.', 'what it took is said beside a pass, through the day it passed');

  /* 6. The clock: runway over the pace actually kept, not over how long each bet ran. */
  const started = (...days: string[]) => days.map((start, i) => betView(bet({ id: `s${i}`, start, metric: 'sent', target: 1, days: 7 }), null, none, today));
  assert.deepEqual(labClock(3.4, []), { runwayMonths: 3.4, betDays: DEFAULT_BET_DAYS, measured: false, betsLeft: 7 });
  assert.deepEqual(labClock(3.4, started('2026-09-29')), { runwayMonths: 3.4, betDays: DEFAULT_BET_DAYS, measured: false, betsLeft: 7 }, 'one bet has no pace yet');
  // Ten days, fourteen, then four after a call-off: the median is ten, not the four.
  assert.deepEqual(labClock(3.4, started('2026-09-29', '2026-09-25', '2026-09-11', '2026-09-01')), { runwayMonths: 3.4, betDays: 10, measured: true, betsLeft: 10 });
  assert.equal(labClock(1, started('2026-09-01', '2026-09-11', '2026-09-15')).betDays, 7, 'two gaps: the middle of them');
  assert.equal(labClock(1, started('2026-09-01', '2026-09-01')).betDays, 1, 'two on one day is a day, not nothing');
  assert.equal(labClock(null, started('2026-09-01', '2026-09-11')).betsLeft, null, 'no runway, no count — never a guess');

  /* 7. Pivot or persevere: due once a bet has ended and two weeks have passed, and read back on what it was about. */
  const links = (s: Partial<Record<LabPart, LabState>>) => LAB_PARTS.map((key) => ({ key, state: s[key] ?? 'untested' }) as LabLink);
  const now = links({ who: 'testing', reach: 'works', close: 'testing', pay: 'stuck', deliver: 'missing' });
  const passed = betView(bet({ id: 'p', start: '2026-09-11', metric: 'committed', target: 1, days: 14 }), null, { ...none, talks: [talk('2026-09-18', 'money')] }, today);
  const failed = betView(bet({ id: 'f', start: '2026-09-27', metric: 'paid', target: 3, days: 2 }), null, none, today);
  const running = betView(bet({ id: 'r', start: '2026-09-29', metric: 'sent', target: 10, days: 14 }), null, none, today);
  assert.deepEqual([passed.state, passed.ended, failed.state, failed.ended, running.state], ['passed', '2026-09-18', 'failed', '2026-09-28', 'running']);
  const cp = (on: string, decision: LabCheckpoint['decision'], part: LabPart | null, chain: LabCheckpoint['chain']): LabCheckpoint => ({ id: on, on, decision, part, note: null, chain, at: `${on}T11:00:00Z` });
  let v = checkpointView({ checkpoints: [], bets: [running], links: now, today });
  assert.deepEqual([v.due, v.grade, v.nextOn, v.moved], [false, null, null, []], 'nothing ended, nothing to decide');
  v = checkpointView({ checkpoints: [], bets: [running, failed, passed], links: now, today });
  assert.deepEqual([v.due, v.ended.map((b) => b.bet.id)], [true, ['f', 'p']], 'the first comes as soon as a bet ends');
  const last = cp('2026-09-24', 'persevere', null, { who: 'testing', reach: 'stuck', close: 'testing', pay: 'untested', deliver: 'missing' });
  v = checkpointView({ checkpoints: [last], bets: [failed, passed], links: now, today });
  assert.deepEqual([v.due, v.ended.map((b) => b.bet.id), v.nextOn], [false, ['f'], '2026-10-08'], 'only what ended after the last answer is up for the next, two weeks on');
  assert.equal(checkpointView({ checkpoints: [last], bets: [failed], links: now, today: '2026-10-08' }).due, true);
  assert.equal(checkpointView({ checkpoints: [last], bets: [passed], links: now, today: '2026-10-08' }).due, false, 'two weeks with nothing ended is not a decision');
  assert.equal(checkpointView({ checkpoints: [cp('2026-09-28', 'persevere', null, {})], bets: [failed], links: now, today: '2026-10-20' }).due, false, 'a bet that ended on the day of the answer was in front of it');
  assert.equal(v.grade, 'better', 'persevere is read back on the whole chain: 6 then, 8 now');
  assert.deepEqual(v.moved, [{ key: 'reach', from: 'stuck', to: 'works' }, { key: 'pay', from: 'untested', to: 'stuck' }]);
  const pivot = (chain: LabCheckpoint['chain']) => checkpointView({ checkpoints: [cp('2026-09-20', 'pivot', 'pay', chain)], bets: [], links: now, today }).grade;
  assert.equal(pivot({ pay: 'testing', reach: 'stuck' }), 'worse', 'a pivot is read back on the part it changed, and only that part');
  assert.equal(pivot({ pay: 'stuck' }), 'same');
  assert.equal(pivot({ reach: 'stuck' }), null, 'no reading of the part kept, nothing to read back against');
  assert.equal(decisionWords({ decision: 'pivot', part: 'pay' }), 'Pivot what they pay');
  assert.equal(decisionWords({ decision: 'persevere', part: null }), 'Persevere');
  assert.equal(gradeWords({ decision: 'pivot', part: 'pay' }, 'worse'), 'What they pay has slipped since.');
  assert.equal(gradeWords({ decision: 'persevere', part: null }, 'better'), 'The chain has moved forward since.');
  assert.equal(gradeWords({ decision: 'persevere', part: null }, null), null);

  /* 8. Saying it: the line before the bet, where its count comes from, and the header. */
  const g = bet({ metric: 'paid_at_price', target: 1, days: 14, start: '2026-09-29', tries: { metric: 'sent', planned: 10 }, price: 150, priceLabel: '$150' });
  assert.equal(passLine(g, '2026-10-12'), '1 sale at your $150 by 12 Oct, from 10 messages sent');
  assert.equal(passLine({ metric: 'replied', target: 2, tries: null, priceLabel: null }, '2026-10-13'), '2 replies by 13 Oct');
  assert.equal(labMetricWords('paid_at_price', 2, null), 'sales at your price', 'no price, no figure invented for one');
  // A play has no start, so no date: dated from today, a card named a day it could not start on.
  assert.equal(playLine(PLAY_BY_KEY.get('paid-48h')!, '$150'), '3 payments within 2 days');
  assert.equal(playLine(PLAY_BY_KEY.get('guarantee')!, '$150'), '1 sale at your $150 within 2 weeks, from 10 messages sent');
  assert.deepEqual([1, 7, 10, 14, 21, 30].map(spanWords), ['1 day', '1 week', '10 days', '2 weeks', '3 weeks', '30 days']);
  const day6 = betView(g, null, { ...none, sends: ['2026-09-29', '2026-09-30'] }, today);
  assert.equal(labLine(day6, false), 'Day 6 of 14 · 0 of 1 sale at your $150');
  assert.equal(labLine(day6, true), 'Checkpoint · pivot or persevere');
  assert.equal(labLine(null, false), 'No bet running');
  // A logged number never reads as a measured one: the app's own counts are "Counted from", the person's "From".
  for (const m of LAB_METRICS) {
    const said = countedFrom(m, '2026-09-29', '$150', 'sign-ups');
    assert.equal(said.startsWith('From '), LAB_METRIC[m].from === 'log', `${m} says where it comes from`);
    assert.ok(said.includes('29 Sep'), `${m} says from when`);
  }
  assert.equal(countedFrom('logged', '2026-09-29', null, 'sign-ups'), 'From the sign-ups you log since 29 Sep: your count, not the app\'s.');
  assert.match(countedFrom('paid_at_price', '2026-09-29', '$150'), /\$150 or more/);
  assert.deepEqual(talkCounts([talk('2026-10-04', 'money'), talk('2026-09-05', 'none', 'no'), talk('2026-09-04', 'time')], today), { n: 2, committed: 1, have: 1, by: { buyer: 2, seller: 0, operator: 0, earner: 0, connector: 0 }, introduced: 0 }, 'the last thirty days, today included');

  /* 9. A first draft of the belief: one buyer, one thing sold, and a number only when the person said one. */
  const offer = { sells: 'Booking automation, custom AI workflows, no website', for_who: 'Staycation & resorts, Pest control, plumbing', problem: 'Save time', price_band: '$150' };
  assert.equal(suggestBelief('pay', offer, '$150'), 'Staycation & resorts pay $150 for booking automation');
  assert.equal(suggestBelief('who', offer, '$150'), 'Staycation & resorts have the problem I fix: save time');
  assert.equal(suggestBelief('pay', {}, null), 'They pay my price for what I sell');
  for (const k of LAB_PARTS) {
    const s = suggestBelief(k, { sells: 'x'.repeat(300), for_who: 'y'.repeat(300) }, null);
    assert.ok(s.length <= LAB_BELIEF_MAX, `${k}: a draft fits the field it goes in`);
    assert.ok(!/\d/.test(suggestBelief(k, { sells: 'Websites', for_who: 'Dentists' }, null)), `${k}: no number the person did not give`);
  }
  assert.deepEqual(betPrice('$150', '$'), { price: 150, priceLabel: '$150' });
  assert.deepEqual(betPrice('₱5k a month', '₱'), { price: 5000, priceLabel: '₱5,000' });
  assert.deepEqual(betPrice(null, '$'), { price: null, priceLabel: null });

  /* 10. The plays: each one something the app can count, for a part of the business, that its own rules accept. */
  assert.equal(new Set(PLAYS.map((p) => p.key)).size, PLAYS.length, 'one key, one play');
  for (const k of LAB_PARTS) assert.ok(playsFor(k).length > 0, `${k} has a play`);
  for (const p of PLAYS) {
    assert.equal(PLAY_BY_KEY.get(p.key), p);
    assert.ok(LAB_METRICS.includes(p.metric), `${p.key} counts something the app counts`);
    if (p.tries) assert.ok(TRIES_FOR[p.metric].includes(p.tries.metric), `${p.key}: what it takes is the step before what it counts`);
    if (p.prep) assert.ok(p.prep.ask.length <= LAB_OBJECTIVE_MAX, `${p.key}: its prep fits a project's brief`);
    const asBet = normalizeBet({ part: p.part, belief: 'A belief', metric: p.metric, unit: p.unit, target: p.target, tries: p.tries ?? null, days: p.days, play: p.key }, ctx);
    assert.ok(asBet.ok && asBet.value.play === p.key, `${p.key} passes the rules every bet is held to`);
    assert.ok(p.book.trim() && p.how.trim() && p.label.trim(), `${p.key} says where it is from and what to do`);
  }

  /* 11. The tab, derived; and a read that failed is said, never drawn as an empty Lab. */
  const home = labHome({ events: [], unreadable: 'relation "copilot_events" timed out', timezone: 'UTC', today, sends: [], outcomes: [], finished: [] });
  const shown = labView(home, { runwayMonths: 3.4, links: now, today });
  assert.equal(shown.unreadable, 'relation "copilot_events" timed out');
  const lab = labView({ bets: [running, failed, passed], talks: [], checkpoints: [], unreadable: null }, { runwayMonths: null, links: now, today });
  assert.deepEqual([lab.current?.bet.id, lab.learned.map((b) => b.bet.id), lab.line, lab.clock.betsLeft], ['r', ['f', 'p'], 'Checkpoint · pivot or persevere', null]);
  assert.deepEqual(labView(undefined, { runwayMonths: null, links: now, today }).line, 'No bet running', 'a server without the Lab is an empty one');

  /* 12. Nobody marks a bet passed (invariant 10): the route has no way to post a verdict. */
  const route = readLabFile(new URL('../../src/app/api/copilot/lab/route.ts', import.meta.url), 'utf8');
  const actions = [...route.matchAll(/case '([a-z_]+)'/g)].map((m) => m[1]).sort();
  // "intro" says how an introduction went — asked for, or fell through — and never whether a bet passed.
  // "shelve" and "unshelve" keep a test for later and take it off: a test with a line and no result, never a verdict on one.
  assert.deepEqual(actions, ['checkpoint', 'count', 'forget', 'found_by', 'ideas', 'intro', 'link', 'open', 'shelve', 'stop', 'talk', 'uncount', 'unshelve'], 'a verdict is the rows’, not a request’s');

  console.log('copilot-core: lab checks passed');
}

labSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── Proof: assets, the history, ideas a model writes, the bet on screen ─── */
//
// The checks are the ways Proof could lie: a model's draft standing as the
// person's offer, a version given a date it does not have, a number in a draft
// the person never gave, an idea for a count this business cannot keep, a
// history that drops the bet that failed, a sale read as outreach for a shop
// whose buyers walk in, and a tab that says the same thing every time it opens.

import {
  ASSET_RESTORED as PF_RESTORED, ASSET_RETIRED as PF_RETIRED, ASSET_VERSION as PF_VERSION, BODIES_KEPT as PF_BODIES_KEPT, BODY_MAX as PF_BODY_MAX, OFFER_ASSET as PF_OFFER,
  assetGaps as pfGaps, assetsFromEvents as pfAssets, assetsHome as pfAssetsHome, checkAssetDraft as pfCheck, normalizeAssetInput as pfNormAsset,
  numberOutside as pfNumberOutside, sameOffer as pfSameOffer, versionLine as pfVersionLine, webLink as pfWebLink,
  type AssetDraftContext as PfDraftCtx, type AssetEventRow as PfRow,
} from '../../src/lib/copilot/assets';
import { historyDay as pfHistoryDay, historyMonths as pfHistoryMonths, historyOf as pfHistoryOf } from '../../src/lib/copilot/history';
import { ideasPrompt as pfIdeasPrompt, normalizeIdeas as pfNormIdeas } from '../../src/lib/copilot/ideas';
import {
  LAB_BET as PF_LAB_BET, LAB_COUNT as PF_LAB_COUNT, LAB_IDEAS as PF_LAB_IDEAS, LAB_LINK as PF_LAB_LINK,
  betView as pfBetView, experimentVerdicts as pfVerdicts, ideaFromStored as pfIdeaFromStored, labFromEvents as pfLabFromEvents,
  metricsFor as pfMetricsFor, normalizeBet as pfNormBet, normalizeTally as pfNormTally, playsFor as pfPlaysFor, suggestBelief as pfSuggest,
  type Bet as PfBet, type DayRows as PfDayRows,
} from '../../src/lib/copilot/lab';
import { foundByOf as pfFoundByOf } from '../../src/lib/copilot/offer';
import {
  assetMakers as pfMakers, betNext as pfBetNext, betWork as pfBetWork, experimentPart as pfExpPart, ideasStale as pfIdeasStale, offerDraftWaiting as pfDraftWaiting,
} from '../../src/lib/copilot/proof';
import { readFileSync as readProofFile } from 'node:fs';

async function proofSuite() {
  const ev = (id: number, event_type: string, created_at: string, payload: Record<string, unknown>): PfRow => ({ id, event_type, created_at, payload });
  const offer = { sells: 'Booking automation', for_who: 'Pest control', problem: 'Missed calls lose bookings', price_band: '$150' };
  const today = '2026-10-04';

  /* 1. An asset as the person writes it: a kind, and a link or a text — never a button to nowhere. */
  assert.deepEqual(pfNormAsset({ kind: 'demo', url: 'loom.com/share/abc' }), { ok: true, value: { kind: 'demo', title: 'Demo', body: null, url: 'https://loom.com/share/abc', note: null } });
  assert.deepEqual(pfNormAsset({ kind: 'demo', url: 'javascript:alert(1)' }), { ok: false, error: 'That link is not a web address. It should start with https://' });
  assert.deepEqual(pfNormAsset({ kind: 'script' }), { ok: false, error: 'Add a link to it, or write it out.' });
  assert.deepEqual(pfNormAsset({ kind: 'offer', body: 'x' }), { ok: false, error: 'The offer is changed on its own sheet, where every draft is rewritten from it.' });
  assert.deepEqual(pfNormAsset({ kind: 'poster', body: 'x' }), { ok: false, error: 'What kind of asset is it?' });
  const scriptBody = pfNormAsset({ kind: 'script', body: 'Line one   \r\n\r\n\r\n\r\nLine two' });
  assert.ok(scriptBody.ok && scriptBody.value.body === 'Line one\n\nLine two', 'line breaks are a script’s structure: kept, not flattened');
  assert.equal(pfWebLink('ftp://x.com'), null);
  assert.equal(pfWebLink('https://x.com/a'), 'https://x.com/a');

  /* 2. The offer's history: the version in use is the profile's, a draft by AI is not it, and nothing is given a date it does not have. */
  const only = pfAssets([], offer);
  assert.deepEqual([only.length, only[0].id, only[0].versions.length, only[0].current.at, only[0].live, only[0].current.note], [1, PF_OFFER, 1, null, 1, 'Written before the history began']);
  const v1 = { asset: PF_OFFER, kind: 'offer', by: 'you', undated: true, offer: { sells: 'Booking bots' } };
  const v2 = { asset: PF_OFFER, kind: 'offer', by: 'you', offer };
  const v3 = { asset: PF_OFFER, kind: 'offer', by: 'ai', model: 'm', offer: { ...offer, problem: 'After-hours calls go unanswered' }, note: 'add a guarantee', bet: '42' };
  const rows = [ev(3, PF_VERSION, '2026-10-03T00:00:00Z', v3), ev(1, PF_VERSION, '2026-09-01T00:00:00Z', v1), ev(2, PF_VERSION, '2026-09-20T00:00:00Z', v2)];
  const [o] = pfAssets(rows, offer);
  assert.deepEqual(o.versions.map((v) => [v.n, v.by, v.at]), [[3, 'ai', '2026-10-03T00:00:00Z'], [2, 'you', '2026-09-20T00:00:00Z'], [1, 'you', null]]);
  assert.deepEqual([o.current.n, o.live], [2, 2], 'the version in use is the one every draft is written from, not the newest');
  assert.deepEqual([o.versions[0].model, o.versions[0].bet, o.versions[0].note], ['m', '42', 'add a guarantee']);
  const waiting = pfDraftWaiting(pfAssets(rows, offer));
  assert.deepEqual([waiting?.asset.id, waiting?.n], [PF_OFFER, 3], 'a draft by AI waits for the person to keep or leave');
  assert.equal(pfDraftWaiting(pfAssets(rows, v3.offer)), null, 'once adopted, nothing waits');
  assert.equal(pfAssets(rows, v3.offer)[0].live, 3);
  // Changed where the history does not reach: the offer in use is shown as it is, undated, after the recorded ones.
  const elsewhere = pfAssets(rows, { ...offer, price_band: '$200' })[0];
  assert.deepEqual([elsewhere.current.n, elsewhere.current.at, elsewhere.current.note, elsewhere.live], [4, null, 'Changed where the history does not reach', 4]);
  // How buyers find you is said by no message, so it is not a new version of the offer.
  assert.ok(pfSameOffer(offer, { ...offer, found_by: 'inbound' }));

  /* 3. Every other asset: its kind fixed by its first version, each change the next one, put away and brought back. */
  const demo = (id: number, at: string, p: Record<string, unknown>) => ev(id, PF_VERSION, at, { asset: 'd1', kind: 'demo', ...p });
  const assets = pfAssets([
    demo(10, '2026-09-10T00:00:00Z', { by: 'ai', title: 'Demo script', body: 'Before. After.', bet: '7' }),
    demo(11, '2026-09-12T00:00:00Z', { by: 'you', kind: 'script', title: 'Recorded', url: 'https://loom.com/x' }),
    ev(12, PF_RETIRED, '2026-09-13T00:00:00Z', { asset: 'd1' }),
    ev(13, PF_VERSION, '2026-09-14T00:00:00Z', { asset: 's1', kind: 'script', by: 'you', title: 'Opener', body: 'Hi' }),
    ev(14, PF_VERSION, '2026-09-15T00:00:00Z', { asset: 'x1', kind: 'offer', by: 'you', body: 'sneaky' }),
    ev(15, PF_VERSION, '2026-09-16T00:00:00Z', { asset: 'e1', kind: 'demo', by: 'you' }),
  ], offer);
  const d1 = assets.find((a) => a.id === 'd1')!;
  assert.deepEqual([d1.kind, d1.versions.length, d1.current.by, d1.firstBy, d1.retired], ['demo', 2, 'you', 'ai', true], 'the first version names the kind for good');
  assert.equal(assets.some((a) => a.id === 'x1'), false, 'only the offer is the offer');
  assert.equal(assets.some((a) => a.id === 'e1'), false, 'a version with nothing in it is not kept');
  assert.deepEqual(assets.map((a) => a.id), [PF_OFFER, 's1', 'd1'], 'the offer first, then the newest change, put away last');
  const restored = pfAssets([demo(10, '2026-09-10T00:00:00Z', { by: 'ai', body: 'x' }), ev(12, PF_RETIRED, '2026-09-13T00:00:00Z', { asset: 'd1' }), ev(16, PF_RESTORED, '2026-09-14T00:00:00Z', { asset: 'd1' })], null);
  assert.deepEqual(restored.map((a) => [a.id, a.retired]), [['d1', false]], 'brought back; and no offer said, no offer asset');

  /* 4. The home payload carries the newest bodies; older ones come whole from the asset route. */
  const many = pfAssetsHome({ events: [1, 2, 3, 4].map((n) => demo(20 + n, `2026-09-2${n}T00:00:00Z`, { by: 'you', body: `v${n}` })), unreadable: null, offer: null });
  assert.deepEqual(many.assets[0].versions.map((v) => [v.n, v.body, v.trimmed]), [[4, 'v4', false], [3, 'v3', false], [2, null, true], [1, null, true]]);
  assert.equal(PF_BODIES_KEPT, 2);
  assert.equal(pfVersionLine({ n: 3, by: 'ai', at: '2026-10-04T00:00:00Z' }, (d) => d.slice(5, 10)), 'v3 · by AI · 10-04');
  assert.equal(pfVersionLine({ n: 1, by: 'you', at: null }, (d) => d), 'v1 · by you');

  /* 5. What is missing, where it would matter now: two at most, the weak part's first, nothing for a blank offer. */
  const states = { who: 'testing', reach: 'works', close: 'stuck', pay: 'stuck', deliver: 'missing' };
  assert.deepEqual(pfGaps({ assets: [], offer, weak: 'close', foundBy: 'outreach', states }).map((g) => g.kind), ['script', 'demo']);
  assert.deepEqual(pfGaps({ assets: [], offer, weak: 'pay', foundBy: 'outreach', states }).map((g) => g.kind), ['demo', 'script']);
  assert.deepEqual(pfGaps({ assets: [], offer: { ...offer, proof_url: 'https://x.com' }, weak: 'pay', foundBy: 'outreach', states }).map((g) => g.kind), ['script'], 'a proof link is the proof');
  assert.deepEqual(pfGaps({ assets: [], offer, weak: 'reach', foundBy: 'inbound', states: { ...states, reach: 'untested', close: 'untested' } }).map((g) => g.kind), ['landing_page', 'demo'], 'buyers who find you online find a page first');
  assert.deepEqual(pfGaps({ assets: [], offer: {}, weak: null, foundBy: null, states }), []);
  assert.deepEqual(pfGaps({ assets: [], offer, weak: 'deliver', foundBy: 'outreach', states: { who: 'works', reach: 'works', close: 'works', pay: 'works', deliver: 'missing' } }).map((g) => g.kind), ['workflow']);
  assert.deepEqual(pfGaps({ assets: restored, offer, weak: 'pay', foundBy: 'outreach', states }).map((g) => g.kind), ['script'], 'a demo kept is no gap');

  /* 6. A model's draft is held to what the person gave it: no number, link or placeholder of its own. */
  const ctx: PfDraftCtx = { kind: 'script', offer, foundBy: 'outreach', working: 'I answer every call within ten minutes', bet: null, part: null, previous: null, ask: null };
  assert.ok(pfCheck({ title: 'Opener', body: '1. Ask about the last missed call.\n2. Offer a 15-minute walkthrough at 3pm.\n3. Say the price: $150.' }, ctx).ok, 'a step number, a duration and a time of day are instructions; $150 is the person’s');
  assert.deepEqual(pfCheck({ title: 'Opener', body: 'We have helped 40 clients save 30% of their bookings.' }, ctx), { ok: false, why: 'it wrote a number that is not in your offer, your notes or your rows (40)' });
  assert.deepEqual(pfCheck({ title: 'Opener', body: 'Hi [NAME], quick question.' }, ctx), { ok: false, why: 'it left a placeholder in it' });
  assert.deepEqual(pfCheck({ title: 'Opener', body: 'See https://example.com/case' }, ctx), { ok: false, why: 'it put in a link you did not give (https://example.com/case)' });
  assert.ok(pfCheck({ title: 'Opener', body: 'See www.alex.ph/demo.' }, { ...ctx, offer: { ...offer, proof_url: 'https://alex.ph/demo' } }).ok, 'a link the person gave, however it is written');
  assert.deepEqual(pfCheck({ title: 'Book 3 calls', body: 'Hi.' }, ctx), { ok: false, why: 'its title carried a placeholder or a number that is not yours' });
  assert.deepEqual(pfCheck({ body: '' }, ctx), { ok: false, why: 'the model wrote nothing' });
  // An offer: its fields, and the person's price — a model that names its own price has not drafted their offer.
  const offerCtx: PfDraftCtx = { ...ctx, kind: 'offer' };
  const offerDraft = pfCheck({ title: 'Guaranteed bookings', sells: 'Booking automation with a guarantee', for_who: 'Pest control', problem: 'Missed calls', price_band: '' }, offerCtx);
  assert.ok(offerDraft.ok && offerDraft.offer?.price_band === '$150' && offerDraft.offer.sells === 'Booking automation with a guarantee');
  assert.deepEqual(pfCheck({ sells: 'Booking automation', price_band: '$99' }, offerCtx), { ok: false, why: 'it wrote a number that is not in your offer, your notes or your rows (99)' });
  assert.deepEqual(pfCheck({ body: 'no offer fields' }, offerCtx), { ok: false, why: 'the model wrote no offer' });
  // Too long is cut at the last paragraph or sentence that fits, never mid-word.
  const longDraft = pfCheck({ title: 'Page', body: `${'Para one is here. '.repeat(200)}\n\n${'Para two. '.repeat(400)}` }, { ...ctx, kind: 'landing_page' });
  assert.ok(longDraft.ok && longDraft.body.length <= PF_BODY_MAX && /\.$/.test(longDraft.body));
  assert.equal(pfNumberOutside('ten minutes, 10 minutes, step 2', []), null);

  /* 7. The history: every bet and how it ended, newest first; a compliment is not history, and no date is guessed. */
  const pfBet = (b: Partial<PfBet> & Pick<PfBet, 'id' | 'metric' | 'target' | 'days' | 'start'>): PfBet => ({
    part: 'reach', belief: 'They answer', play: null, idea: null, unit: null, tries: null, price: null, priceLabel: null, experiment: null, openedAt: `${b.start}T01:00:00Z`, ...b,
  });
  const none: PfDayRows = { sends: [], outcomes: [], finished: [], talks: [] };
  const ended = pfBetView(pfBet({ id: 'b1', metric: 'sent', target: 5, days: 3, start: '2026-09-20' }), null, none, today);
  const live = pfBetView(pfBet({ id: 'b2', metric: 'sent', target: 5, days: 14, start: '2026-10-01' }), null, none, today);
  const history = pfHistoryOf({
    bets: [live, ended],
    checkpoints: [{ id: 'c1', on: '2026-09-25', decision: 'pivot', part: 'reach', note: 'Salons never answered', chain: {}, at: '2026-09-25T10:00:00Z' }],
    talks: [
      { id: 't1', on: '2026-09-26', who: 'Rico', problem: 'yes', commitment: 'money', said: 'Send the invoice', at: '2026-09-26T09:00:00Z' },
      { id: 't2', on: '2026-09-27', who: 'Ana', problem: 'yes', commitment: 'none', said: 'Love it', at: '2026-09-27T09:00:00Z' },
    ],
    assets: pfAssets(rows, offer),
    projects: [
      { id: 'p1', objective: 'Compare three agencies', status: 'done', outcome: 'Worth: delivered', closedAt: '2026-09-28T04:00:00Z' },
      { id: 'p2', objective: 'Still going', status: 'active', outcome: null, closedAt: null },
    ],
    wins: [{ at: '2026-09-29T08:00:00Z', amount: 150, who: 'Rapid Plumbing' }, { at: '2026-09-30T08:00:00Z', amount: null, who: null }],
    experiments: [
      { id: 'x1', title: 'Ask Mara', angle: 'ask_one', state: 'worked', at: '2026-09-24T08:00:00Z' },
      { id: 'x2', title: 'Left untried', angle: null, state: 'ignored', at: '2026-09-24T08:00:00Z', inferred: true },
    ],
    currency: '$', timezone: 'UTC',
  });
  assert.deepEqual(history.map((e) => e.key), [
    'asset-3', 'bet-start-b2', 'win-2026-09-30T08:00:00Z-1', 'win-2026-09-29T08:00:00Z-0', 'project-p1', 'talk-t1', 'checkpoint-c1',
    'experiment-x1-worked-2026-09-24T08:00:00Z', 'bet-end-b1', 'bet-start-b1', 'asset-2',
  ], 'the undated first offer, the compliment, the work still running and the inferred mark are not in it');
  const byKey = Object.fromEntries(history.map((e) => [e.key, e]));
  assert.deepEqual([byKey['bet-end-b1'].title, byKey['bet-end-b1'].tone, byKey['bet-end-b1'].line], ['Did not pass: “They answer”', 'bad', '0 of 5 messages sent'], 'a bet that failed stays, said as one');
  assert.deepEqual([byKey['asset-3'].title, byKey['asset-3'].by, byKey['asset-3'].line, byKey['asset-3'].asset], ['Offer v3: Booking automation', 'ai', 'add a guarantee', 'offer']);
  assert.deepEqual([byKey['win-2026-09-29T08:00:00Z-0'].title, byKey['win-2026-09-29T08:00:00Z-0'].line], ['Paid $150', 'Rapid Plumbing']);
  assert.equal(byKey['win-2026-09-30T08:00:00Z-1'].title, 'A sale, no amount logged', 'never a sale of nothing');
  assert.equal(byKey['talk-t1'].title, 'Rico committed money');
  assert.deepEqual(pfHistoryMonths(history, today).map((m) => [m.label, m.entries.length]), [['October', 2], ['September', 9]]);
  assert.equal(pfHistoryMonths([{ ...history[0], day: '2025-12-01' }], today)[0].label, 'December 2025');
  assert.deepEqual([pfHistoryDay(today, today), pfHistoryDay('2026-10-03', today), pfHistoryDay('2026-09-03', today)], ['Today', 'Yesterday', '3 Sep']);

  /* 8. Ideas a model writes are held to what a bet is, for counts this business can keep. */
  const ideas = pfNormIdeas({ ideas: [
    { label: 'Reply faster to enquiries', how: 'Answer every enquiry within the hour for two weeks.', metric: 'logged', unit: 'Enquiries', target: 5, days: 14, book: 'traction', why: 'Your page brings 12 visits a day.' },
    { label: 'Message ten salons', how: 'Write to ten salons.', metric: 'replied', target: 2, days: 7 },
    { label: 'Ask three clients', how: 'Ask for one name each.', metric: 'committed', target: 2, tries: { metric: 'talks', planned: 3 }, days: 7, book: 'A Book Nobody Wrote', why: '3 of the 4 people you talked to have the problem.', prep: { label: 'The ask', asset: 'script' } },
    { label: 'Logged without a word', how: 'x', metric: 'logged', target: 3, days: 7 },
    { label: 'Too big', how: 'y', metric: 'talks', target: 500, days: 7 },
    { label: 'Hi [NAME]', how: 'z', metric: 'talks', target: 2, days: 7 },
    { label: 'ask three clients', how: 'The same again.', metric: 'talks', target: 2, days: 7 },
    { label: 'Fourth good one', how: 'A fine idea.', metric: 'talks', target: 2, days: 7 },
    { label: 'Fifth good one', how: 'Another.', metric: 'talks', target: 2, days: 7 },
  ] }, { part: 'reach', foundBy: 'inbound', sources: ['Booking automation', '$150', '3 of the 4 people you talked to'] });
  assert.deepEqual(ideas.map((i) => i.label), ['Reply faster to enquiries', 'Ask three clients', 'Fourth good one'],
    'three at most; a count the business cannot keep, a logged count with no word, a line out of range, a placeholder and a repeat are dropped');
  assert.deepEqual([ideas[0].unit, ideas[0].book, ideas[0].why], ['enquiries', 'Traction', null], 'its own word, a book from the list, and no reason resting on a number nobody gave');
  assert.deepEqual([ideas[1].book, ideas[1].why, ideas[1].tries, ideas[1].prep], [null, '3 of the 4 people you talked to have the problem.', { metric: 'talks', planned: 3 }, { label: 'The ask', asset: 'script' }]);
  // The prompt offers only the counts this business can keep, and never a plan with nothing after "from".
  const bare = { offer, working: null, links: [], bets: [], talks: { n: 0, problem: 0, committed: 0 }, assets: [] };
  const inboundPrompt = pfIdeasPrompt({ ...bare, part: 'reach', foundBy: 'inbound' });
  assert.ok(!/"sent"|"replied"/.test(inboundPrompt) && /"logged"/.test(inboundPrompt), 'no sends or replies offered to a business whose buyers find it');
  assert.ok(!/from (;|\))/.test(inboundPrompt), 'every "from" names a count');
  assert.ok(/"replied"/.test(pfIdeasPrompt({ ...bare, part: 'reach', foundBy: 'outreach' })));
  // Stored ideas are reshaped, not trusted.
  assert.equal(pfIdeaFromStored({ label: 'x', how: 'y', metric: 'logged', target: 3, days: 7 }, 'reach'), null);
  assert.equal(pfIdeaFromStored({ label: 'x', how: 'y', metric: 'talks', target: 3, days: 7, prep: { label: 'p', asset: 'poster' } }, 'reach')?.prep, null);

  /* 9. The bet on screen: where its next count happens, by how buyers arrive, and what was done for it. */
  assert.deepEqual(pfBetNext('replied', 'outreach', null), { label: 'Open Swipe', go: 'swipe' });
  assert.deepEqual(pfBetNext('paid_at_price', 'outreach', null), { label: 'Who replied', go: 'replied' });
  assert.deepEqual(pfBetNext('paid_at_price', 'local', null), { label: 'Log a sale', go: 'sale' }, 'a shop logs a sale; nobody replied to anything');
  assert.deepEqual(pfBetNext('meetings', null, null), { label: 'Log a meeting', go: 'meeting' });
  assert.deepEqual(pfBetNext('logged', 'inbound', 'sign-ups'), { label: 'Log sign-ups', go: 'count' });
  assert.deepEqual(pfBetNext('handed', 'outreach', null), { label: 'Hand a step over', go: 'projects' });
  const workBet = pfBetView(pfBet({ id: '9', metric: 'committed', target: 2, days: 14, start: '2026-09-28', tries: { metric: 'talks', planned: 5 } }), null, none, today);
  const rico = { id: 't', on: '2026-09-30', who: 'Rico', problem: 'yes' as const, commitment: 'time' as const, said: null, at: '2026-09-30T00:00:00Z' };
  const work = pfBetWork(workBet, {
    links: { '9': ['c1', 'gone'] },
    commissions: [threadV2({ id: 'c1', status: 'active' }), threadV2({ id: 'c2', status: 'active' })],
    assets: pfAssets([ev(30, PF_VERSION, '2026-09-29T00:00:00Z', { asset: 'sc', kind: 'script', by: 'ai', body: 'Hi', bet: '9' }), ev(31, PF_VERSION, '2026-09-29T00:00:00Z', { asset: 'other', kind: 'demo', by: 'you', body: 'x' })], null),
    talks: [rico, { id: 'old', on: '2026-09-20', who: null, problem: 'no', commitment: 'none', said: null, at: '2026-09-20T00:00:00Z' }],
    tallies: [],
  });
  assert.deepEqual([work.projects.map((t) => t.commission.id), work.assets.map((a) => a.id), work.talks, work.tallies], [['c1'], ['sc'], { n: 1, last: rico }, null],
    'its projects, its assets, and only the conversations since it began');

  /* 10. Ideas are written again when the record moves: a bet ended since, or two weeks went by. */
  assert.equal(pfIdeasStale(null, [], today), true, 'none yet');
  assert.equal(pfIdeasStale({ at: '2026-10-02T00:00:00Z' }, [live], today), false);
  assert.equal(pfIdeasStale({ at: '2026-09-21T00:00:00Z' }, [ended], today), true, 'a bet ended after they were written');
  assert.equal(pfIdeasStale({ at: '2026-09-23T00:00:00Z' }, [ended], today), false);
  assert.equal(pfIdeasStale({ at: '2026-09-19T00:00:00Z' }, [], '2026-10-03'), true, 'two weeks on, the same three ideas are the same tab');

  /* 11. Who made what, by the version in use. */
  assert.deepEqual(pfMakers(pfAssets(rows, offer)), { ai: 0, you: 1, line: '1 by you' }, 'a draft waiting is not the offer in use');
  assert.deepEqual(pfMakers(pfAssets(rows, v3.offer)), { ai: 1, you: 0, line: '1 by AI' });

  /* 12. The plan's experiment, made a bet: it starts on the part its kind works on, and takes the bet's verdict. */
  assert.equal(pfExpPart('change_channel', 'pay'), 'reach');
  assert.equal(pfExpPart('subtract', 'pay'), 'pay');
  assert.equal(pfExpPart('subtract', null), 'who');
  const fromPlan = (state: 'running' | 'passed' | 'failed' | 'stopped') => ({ ...ended, bet: { ...ended.bet, experiment: 'x9' }, state });
  assert.deepEqual(pfVerdicts([fromPlan('passed')], []), [{ id: 'x9', title: 'They answer', state: 'worked' }]);
  assert.deepEqual(pfVerdicts([fromPlan('failed')], []).map((v) => v.state), ['failed']);
  assert.deepEqual(pfVerdicts([fromPlan('stopped')], []).map((v) => v.state), ['unclear'], 'called off is could not tell, never a failure');
  assert.deepEqual(pfVerdicts([fromPlan('running')], []), [], 'a bet still running has no verdict to give');
  assert.deepEqual(pfVerdicts([fromPlan('passed')], [{ id: 'x9', state: 'worked', at: '2026-09-25T00:00:00Z' }]), [], 'said once, not again');
  assert.equal(pfVerdicts([fromPlan('passed')], [{ id: 'x9', state: 'worked', at: '2026-09-01T00:00:00Z' }]).length, 1, 'a verdict from before this bet is not this bet’s');

  /* 13. A count the person keeps, and the plays for a business whose buyers find it. */
  const loggedBet = pfNormBet({ part: 'reach', belief: 'Enquiries come in', metric: 'logged', unit: 'Enquiries', target: 5, days: 14, idea: { label: 'Reply faster', how: 'Within the hour.', from: 'AI, from your record', prep: { label: 'The page', asset: 'landing_page' } }, experiment: 'x9' }, { today, price: null, priceLabel: null });
  assert.deepEqual(loggedBet.ok && [loggedBet.value.unit, loggedBet.value.idea, loggedBet.value.experiment],
    ['enquiries', { label: 'Reply faster', how: 'Within the hour.', from: 'AI, from your record', prep: { label: 'The page', asset: 'landing_page' } }, 'x9']);
  assert.deepEqual(pfNormBet({ part: 'reach', belief: 'x', metric: 'logged', target: 5, days: 14 }, { today, price: null, priceLabel: null }), { ok: false, error: 'Say what you will count, in a word or two: "sign-ups", "enquiries", "orders".' });
  const badExp = pfNormBet({ part: 'reach', belief: 'x', metric: 'talks', target: 5, days: 14, experiment: 'not a slug!' }, { today, price: null, priceLabel: null });
  assert.ok(badExp.ok && badExp.value.experiment === null, 'an experiment id is a slug or nothing');
  const tallyBet = { id: '9', start: '2026-09-28', days: 14, metric: 'logged' as const };
  assert.deepEqual(pfNormTally({ n: 3 }, tallyBet, today), { ok: true, value: { bet: '9', n: 3, on: today, note: null } });
  assert.deepEqual(pfNormTally({ n: 3, on: '2026-09-27' }, tallyBet, today), { ok: false, error: 'The bet ran from 28 Sep to 11 Oct; only those days count.' });
  assert.deepEqual(pfNormTally({ n: 3, on: '2026-10-05' }, tallyBet, today), { ok: false, error: 'That day has not happened yet.' });
  assert.deepEqual(pfNormTally({ n: 0 }, tallyBet, today), { ok: false, error: 'Log a count from 1 to 1000.' });
  assert.deepEqual(pfNormTally({ n: 3 }, { ...tallyBet, metric: 'sent' }, today), { ok: false, error: 'That bet counts something the app keeps itself.' });
  const led = pfLabFromEvents([
    ev(40, PF_LAB_BET, '2026-09-28T01:00:00Z', { part: 'reach', belief: 'Enquiries come in', metric: 'logged', unit: 'enquiries', target: 5, days: 14, start: '2026-09-28' }),
    ev(41, PF_LAB_COUNT, '2026-09-29T01:00:00Z', { bet: '40', n: 2, on: '2026-09-29' }),
    ev(42, PF_LAB_COUNT, '2026-09-30T01:00:00Z', { bet: '40', n: 'many', on: '2026-09-30' }),
    ev(43, PF_LAB_LINK, '2026-09-30T02:00:00Z', { bet: '40', commission: 'c1' }),
    ev(44, PF_LAB_LINK, '2026-09-30T03:00:00Z', { bet: '40', commission: 'c1' }),
    ev(45, PF_LAB_IDEAS, '2026-09-30T04:00:00Z', { part: 'reach', ideas: [{ label: 'A', how: 'a', metric: 'talks', target: 2, days: 7 }], model: 'm' }),
    ev(46, PF_LAB_IDEAS, '2026-10-01T04:00:00Z', { part: 'reach', ideas: [{ label: 'B', how: 'b', metric: 'talks', target: 2, days: 7 }] }),
    ev(47, PF_LAB_IDEAS, '2026-10-02T04:00:00Z', { part: 'reach', ideas: [{ label: 'broken' }] }),
  ]);
  assert.deepEqual(led.tallies.map((t) => [t.id, t.n]), [['41', 2]], 'a count that is not a number is not counted');
  assert.deepEqual(led.links.get('40'), ['c1'], 'a project is tied once');
  assert.deepEqual(led.ideas.reach?.ideas.map((i) => i.label), ['B'], 'the newest set that holds together');
  const withCounts = pfBetView(led.bets[0], null, { ...none, tallies: led.tallies }, today);
  assert.deepEqual([withCounts.result, withCounts.state], [2, 'running']);
  const inboundPlays = pfPlaysFor('reach', 'inbound');
  assert.ok(inboundPlays.length > 0 && inboundPlays.every((p) => !['sent', 'replied'].includes(p.metric) && !(p.tries && ['sent', 'replied'].includes(p.tries.metric))), 'nothing it could never count');
  assert.ok(!inboundPlays.some((p) => p.key === 'one-line'), 'a play about the first line of a message is not offered to a shop that sends none');
  assert.ok(pfPlaysFor('reach', 'outreach').some((p) => p.key === 'one-line'));
  assert.equal(pfPlaysFor('pay', 'local').find((p) => p.key === 'guarantee')?.tries, undefined, 'a plan counted in sends the app cannot count goes; the line stays');
  assert.equal(pfMetricsFor('marketplace').includes('sent'), false);
  assert.equal(pfSuggest('reach', offer, '$150', 'referrals'), 'My clients will introduce me to pest control');
  assert.equal(pfFoundByOf({ ...offer, found_by: 'local' }, 9, 9).value, 'local', 'said beats read');
  assert.deepEqual(pfFoundByOf(offer, 0, 0), { value: null, said: false }, 'nothing found, sent or said: nobody knows yet');
  assert.deepEqual(pfFoundByOf(offer, 0, 12), { value: 'outreach', said: false }, 'the app finding businesses to write to is outreach starting');

  /* 14. The routes: an asset's every write is a version or a put-away, and nothing a model writes becomes the offer by itself. */
  const assetRoute = readProofFile(new URL('../../src/app/api/copilot/assets/route.ts', import.meta.url), 'utf8');
  assert.deepEqual([...assetRoute.matchAll(/case '([a-z_]+)'/g)].map((m) => m[1]).sort(), ['add', 'adopt', 'draft', 'proof', 'restore', 'retire', 'version']);
  const proofAi = readProofFile(new URL('../../src/lib/copilot/proofai.ts', import.meta.url), 'utf8');
  assert.ok(!/setOffer\(/.test(proofAi), 'a model drafts a version; only the person makes it the offer');
  assert.ok(/offerIsEmpty/.test(proofAi), 'nothing is drafted from a blank offer (invariant 1)');

  console.log('copilot-core: proof checks passed');
}

proofSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── Conversations: who they were, introductions, and what they said ─────── */
//
// The checks are the ways this could mislead: a supplier counted as a buyer,
// an introduction that nags forever or drops off unsaid, a conversation tied
// to an introduction that never was, a model handed words nobody logged — or a
// number from those words refused as if it were invented.

import {
  HEARD_MAX as CV_HEARD_MAX, INTRO_LINK_DAYS as CV_INTRO_LINK_DAYS, LAB_EVENTS as CV_LAB_EVENTS, LAB_INTRO as CV_LAB_INTRO, LAB_TALK as CV_LAB_TALK,
  PLAY_BY_KEY as CV_PLAY_BY_KEY,
  heardFrom as cvHeardFrom, heardLine as cvHeardLine, introSources as cvIntroSources, introState as cvIntroState, isBuyer as cvIsBuyer,
  labFromEvents as cvLabFromEvents, normalizeBet as cvNormBet, normalizeIntroClose as cvNormIntro, normalizeTalk as cvNormTalk,
  openIntros as cvOpenIntros, playsFor as cvPlaysFor, talkCounts as cvTalkCounts, type Talk as CvTalk,
} from '../../src/lib/copilot/lab';
import { ideaSources as cvIdeaSources, ideasPrompt as cvIdeasPrompt, normalizeIdeas as cvNormIdeas, talkTotals as cvTalkTotals } from '../../src/lib/copilot/ideas';
import { assetDraftPrompt as cvDraftPrompt, checkAssetDraft as cvCheckDraft, type AssetDraftContext as CvDraftCtx } from '../../src/lib/copilot/assets';
import { needsYou as cvNeedsYou } from '../../src/lib/copilot/today';
import { pathNow as cvPathNow } from '../../src/lib/copilot/plan';
import { historyOf as cvHistoryOf } from '../../src/lib/copilot/history';
import { readFileSync as readTalkFile } from 'node:fs';

async function conversationsSuite() {
  const today = '2026-10-06';
  const tk = (id: string, on: string, o: Partial<CvTalk> = {}): CvTalk => ({
    id, on, who: null, role: 'buyer', problem: 'unasked', commitment: 'none', said: null, via: null, at: `${on}T09:00:00Z`, ...o,
  });

  /* 1. Who they were: a tap that defaults to a buyer, refused when it is none of the five, and the problem asked only of who could have it. */
  const plain = cvNormTalk({ commitment: 'time' }, today);
  assert.ok(plain.ok && plain.value.role === 'buyer' && plain.value.via === null, 'no role is a buyer, as every conversation was before there was a choice');
  assert.deepEqual(cvNormTalk({ role: 'investor', commitment: 'none' }, today), { ok: false, error: 'Who were they to the business?' });
  const supplier = cvNormTalk({ role: 'seller', problem: 'yes', commitment: 'intro' }, today);
  assert.ok(supplier.ok && supplier.value.problem === 'unasked', 'a supplier’s yes is not one more business with the problem');
  const operator = cvNormTalk({ role: 'operator', problem: 'yes', commitment: 'none' }, today);
  assert.ok(operator.ok && operator.value.problem === 'yes', 'who runs the work can have it');

  /* 2. An introduction a conversation names has to be one on record, offered on or before it. */
  const mara = tk('11', '2026-10-01', { who: 'Mara', role: 'connector', commitment: 'intro', said: 'Talk to my cousin at Bright Smiles' });
  const ana = tk('12', '2026-10-02', { who: 'Ana', commitment: 'time' });
  const known = [mara, ana];
  assert.deepEqual(cvNormTalk({ via: '99', commitment: 'none' }, today, known), { ok: false, error: 'That introduction is not in your record.' });
  assert.deepEqual(cvNormTalk({ via: '12', commitment: 'none' }, today, known), { ok: false, error: 'That introduction is not in your record.' }, 'another call is not an introduction');
  assert.deepEqual(cvNormTalk({ via: '11', on: '2026-09-30', commitment: 'none' }, today, known), { ok: false, error: 'That introduction was offered after this conversation.' });
  const through = cvNormTalk({ via: '11', who: 'Dr. Reyes', commitment: 'money' }, today, known);
  assert.ok(through.ok && through.value.via === '11');
  assert.deepEqual(cvNormTalk({ via: '11', commitment: 'none' }, today), { ok: false, error: 'That introduction is not in your record.' }, 'nothing read, nothing to tie it to');
  assert.deepEqual(cvNormIntro({ talk: '12', outcome: 'asked' }, known), { ok: false, error: 'That introduction is not in your record.' });
  assert.deepEqual(cvNormIntro({ talk: '11', outcome: 'maybe' }, known), { ok: false, error: 'Did you ask for it, or did it fall through?' });
  assert.deepEqual(cvNormIntro({ talk: '11', outcome: 'dropped' }, known), { ok: true, value: { talk: '11', outcome: 'dropped' } });

  /* 3. As stored: a conversation from before roles is a buyer's, a bad reference is none, and the last word on an introduction wins. */
  assert.ok((CV_LAB_EVENTS as readonly string[]).includes(CV_LAB_INTRO), 'read with the rest, or an introduction closed never stays closed');
  const ev = (id: number, event_type: string, created_at: string, payload: Record<string, unknown>) => ({ id, event_type, created_at, payload });
  const stored = cvLabFromEvents([
    ev(1, CV_LAB_TALK, '2026-09-20T09:00:00Z', { on: '2026-09-20', who: 'Rico', problem: 'yes', commitment: 'intro' }),
    ev(2, CV_LAB_TALK, '2026-09-21T09:00:00Z', { on: '2026-09-21', who: 'Joe', role: 'earner', commitment: 'none', via: '1' }),
    ev(3, CV_LAB_TALK, '2026-09-21T10:00:00Z', { on: '2026-09-21', role: 'astronaut', via: 'not an id!' }),
    ev(4, CV_LAB_INTRO, '2026-09-22T09:00:00Z', { talk: '1', outcome: 'asked' }),
    ev(5, CV_LAB_INTRO, '2026-09-25T09:00:00Z', { talk: '1', outcome: 'dropped' }),
    ev(6, CV_LAB_INTRO, '2026-09-26T09:00:00Z', { talk: '1', outcome: 'maybe' }),
  ]);
  assert.deepEqual(stored.talks.map((t) => [t.id, t.role, t.via]), [['3', 'buyer', null], ['2', 'earner', '1'], ['1', 'buyer', null]]);
  assert.equal(stored.intros.get('1')?.outcome, 'dropped', 'asked for on Monday, fallen through by Friday');

  /* 4. Where an introduction stands: a conversation through it is the answer, whatever was said before; open for a month, then lapsed. */
  const asked = { '11': { outcome: 'asked' as const, at: '2026-10-03T00:00:00Z' } };
  assert.equal(cvIntroState(mara, [mara, ana], undefined, today), 'open');
  assert.equal(cvIntroState(mara, [mara, ana], asked, today), 'asked');
  assert.equal(cvIntroState(mara, [mara, tk('13', '2026-10-04', { via: '11' })], { '11': { outcome: 'dropped', at: '2026-10-03T00:00:00Z' } }, today), 'led', 'it happened after all');
  assert.equal(cvIntroState(mara, [mara], undefined, '2026-10-31'), 'open', 'thirty days is the edge, and inside it');
  assert.equal(cvIntroState(mara, [mara], undefined, '2026-11-01'), 'lapsed', 'past the month, a nudge nobody can act on is noise');
  assert.equal(cvIntroState(ana, [ana], undefined, today), null, 'another call offers no introduction');

  /* 5. On the Path from the day after, oldest first, and gone once followed — never the day it was logged. */
  const fresh = tk('14', today, { who: 'Lea', commitment: 'intro' });
  const old = tk('15', '2026-09-20', { who: 'Tom', commitment: 'intro' });
  const kim = tk('16', '2026-09-25', { who: 'Kim', commitment: 'intro' });
  const viaKim = tk('17', '2026-09-28', { via: '16' });
  const all = [fresh, viaKim, kim, mara, old];
  assert.deepEqual(cvOpenIntros(all, undefined, today).map((x) => [x.talk.id, x.days]), [['15', 16], ['11', 5]], 'Lea’s is news today; Kim’s led somewhere');
  assert.deepEqual(cvOpenIntros([mara], asked, today), [], 'asked for: off the Path while the other side does their part');

  /* 6. What a conversation can say it came through: not one that fell through, not one offered after it; one that already led stays. */
  const sources = cvIntroSources(all, { '15': { outcome: 'dropped', at: '2026-09-30T00:00:00Z' } }, '2026-10-02');
  assert.deepEqual(sources.map((t) => t.id), ['11', '16'], 'newest first; Lea’s came after the day, Tom’s fell through');
  assert.equal(cvIntroSources([old], undefined, '2026-12-01').length, 0, `past ${CV_INTRO_LINK_DAYS} days nobody remembers who made it`);

  /* 7. Only a buyer is one: the chain's counts leave the people around the money out; the month's counts say who they were. */
  const month = [
    tk('a', '2026-10-05', { problem: 'yes', commitment: 'time' }),
    tk('b', '2026-10-04', { role: 'seller', commitment: 'intro' }),
    tk('c', '2026-10-03', { role: 'connector', commitment: 'intro', via: '11' }),
    tk('d', '2026-08-01', { problem: 'yes' }),
  ];
  assert.deepEqual(cvTalkTotals(month), { n: 2, problem: 2, committed: 1 }, 'two buyers, all time; the supplier and the connector are heard, not counted');
  const counts = cvTalkCounts(month, today);
  assert.deepEqual([counts.n, counts.committed, counts.have, counts.introduced, counts.by], [3, 3, 1, 1, { buyer: 1, seller: 1, operator: 0, earner: 0, connector: 1 }]);
  const legacy = { id: 'x', on: '2026-10-05', who: null, problem: 'yes', commitment: 'none', said: null, at: '2026-10-05T00:00:00Z' } as unknown as CvTalk;
  assert.ok(cvIsBuyer(legacy) && cvTalkCounts([legacy], today).by.buyer === 1, 'a cached payload from before roles reads as a buyer’s');

  /* 8. Needs you: an introduction right after a question — the one thing on the list lost by waiting — and the move when it leads. */
  const asks = cvNeedsYou({
    commissions: [
      threadV2({ id: 'broke', status: 'blocked', objective: 'Find jobs' }, [{ kind: 'failed', summary: 'search tool returned 500' }]),
      threadV2({ id: 'ask', status: 'blocked' }, [{ kind: 'needs_you', summary: 'Which city?' }]),
    ],
    capture: null, queue: { count: 0, oldestDays: 0 }, queueIsCall: false, noOffer: false,
    intros: cvOpenIntros([mara, old], undefined, today),
  });
  assert.deepEqual(asks.map((a) => a.key), ['q:ask', 'i:15', 'i:11', 'f:broke']);
  assert.deepEqual([asks[2].kind, asks[2].id, asks[2].title, asks[2].detail], ['intro', '11', 'Follow up the intro from Mara', 'Offered 5 days ago — ask before they forget offering. “Talk to my cousin at Bright Smiles”']);
  const yesterday = cvNeedsYou({ commissions: [], capture: null, queue: { count: 0, oldestDays: 0 }, queueIsCall: false, noOffer: false, intros: [{ talk: { id: '9', who: null, said: null }, days: 1 }] });
  assert.deepEqual([yesterday[0].title, yesterday[0].detail], ['Follow up an intro you were offered', 'Offered yesterday — ask before they forget offering.']);
  const move = cvPathNow({ noOffer: false, callPending: false, queue: { count: 0, oldestDays: 0 }, asks: asks.slice(1), moves: [], capacity: 'deep', funnel: { sent: 0, replied: 0, won: 0 }, freshMatches: 0 });
  assert.deepEqual([move.now.kind, move.now.id, move.now.cta, move.now.title], ['intro', '15', 'Follow it up', 'Follow up the intro from Tom']);

  /* 9. What people said goes to the model, and a number in it is theirs: a reason that cites one keeps its reason. */
  const heard = cvHeardFrom([
    tk('h1', '2026-10-05', { who: 'Ana', said: 'We lose 2 bookings a week to missed calls', commitment: 'time' }),
    tk('h2', '2026-10-04'),
    tk('h3', '2026-10-03', { role: 'seller', said: 'Dentists pay $90 a month for answering services' }),
  ]);
  assert.deepEqual(heard.map((h) => h.said.slice(0, 8)), ['We lose ', 'Dentists'], 'only the ones with words, newest first');
  assert.equal(cvHeardLine(heard[0]), 'Ana — could buy, agreed to another call: “We lose 2 bookings a week to missed calls”');
  assert.ok(!/\b(5|Oct|2026)\b/.test(cvHeardLine(heard[0])), 'no day: its digits would pass as a number the person gave');
  assert.equal(cvHeardFrom(Array.from({ length: 30 }, (_, i) => tk(`n${i}`, '2026-10-01', { said: 'x' }))).length, CV_HEARD_MAX);
  const ideaCtx = {
    part: 'who' as const, offer: { sells: 'Booking automation', for_who: 'Dental clinics', price_band: '$150' }, foundBy: 'referrals' as const, working: null,
    links: [], bets: [], talks: { n: 1, problem: 1, committed: 1 }, assets: [],
    coverage: { buyer: 1, seller: 1, operator: 0, earner: 0, connector: 0 }, heard: heard.map(cvHeardLine),
  };
  const prompt = cvIdeasPrompt(ideaCtx);
  assert.ok(prompt.includes('- Ana — could buy, agreed to another call: “We lose 2 bookings a week to missed calls”'), 'the words, as logged');
  assert.ok(prompt.includes("Who the last 30 days' conversations were with: 1 could buy, 1 sells to them, 0 runs the work, 0 already earns in it, 0 knows people."), 'the empty kinds are said: they are the point');
  assert.ok(prompt.includes('"sells to them" sells something else to the same buyers'), 'the model is told what each kind is');
  assert.ok(!cvIdeasPrompt({ ...ideaCtx, coverage: null, heard: [] }).includes('What people said'), 'nothing logged, nothing said');
  const cited = cvNormIdeas({ ideas: [
    { label: 'Answer the missed calls', how: 'Offer Ana a week of answered calls.', metric: 'committed', target: 1, days: 7, why: 'Ana loses 2 bookings a week to missed calls.' },
    { label: 'Price under theirs', how: 'Ask three clinics what they pay.', metric: 'committed', target: 1, days: 7, why: 'Clinics pay $70 a month now.' },
  ] }, { part: 'who', foundBy: 'referrals', sources: cvIdeaSources(ideaCtx) });
  assert.deepEqual(cited.map((i) => i.why), ['Ana loses 2 bookings a week to missed calls.', null], 'her 2 is hers; a $70 nobody said is not');

  /* 10. A draft hears them nameless and in their words — and a number from them is not an invented one. */
  const draftCtx: CvDraftCtx = {
    kind: 'script', offer: { sells: 'Booking automation', for_who: 'Dental clinics', price_band: '$150' }, foundBy: 'referrals', working: null,
    bet: null, part: null, previous: null, ask: null, heard: heard.map((h) => cvHeardLine({ ...h, who: null })),
  };
  const draftPrompt = cvDraftPrompt(draftCtx);
  assert.ok(draftPrompt.includes('- Someone — could buy, agreed to another call: “We lose 2 bookings a week to missed calls”'));
  assert.ok(!draftPrompt.includes('Ana'), 'nameless: an asset is read by strangers, and a name reads as a testimonial nobody gave');
  assert.ok(cvCheckDraft({ title: 'Opener', body: 'If you lose 2 bookings a week to missed calls, $150 a month stops that.' }, draftCtx).ok);
  assert.deepEqual(cvCheckDraft({ title: 'Opener', body: 'Clinics lose 12 bookings a week.' }, draftCtx), { ok: false, why: 'it wrote a number that is not in your offer, your notes or your rows (12)' });

  /* 11. The play: five people close to the money, judged by what they committed to, for any business. */
  const five = CV_PLAY_BY_KEY.get('money-five');
  assert.ok(five && five.part === 'who' && five.fits === 'any' && five.metric === 'committed' && five.tries?.metric === 'talks' && five.tries.planned === 5);
  for (const found of ['outreach', 'inbound', 'referrals', 'marketplace', 'local'] as const) {
    assert.ok(cvPlaysFor('who', found).some((p) => p.key === 'money-five'), `${found} can run it`);
  }
  assert.ok(cvNormBet({ part: 'who', belief: 'People around dental clinics will say what they pay for', metric: five!.metric, target: five!.target, tries: five!.tries, days: five!.days, play: five!.key }, { today, price: 150, priceLabel: '$150' }).ok);

  /* 12. The history says who opened the door, and who they were where they were not a buyer. */
  const hist = cvHistoryOf({
    bets: [], checkpoints: [], assets: [], projects: [], wins: [], experiments: [], currency: '$', timezone: 'UTC',
    talks: [mara, tk('20', '2026-10-04', { who: 'Dr. Reyes', commitment: 'money', via: '11', said: 'Start Monday' })],
  });
  const hk = Object.fromEntries(hist.map((e) => [e.key, e]));
  assert.deepEqual([hk['talk-11'].title, hk['talk-11'].line], ['Mara offered an introduction', 'Knows people · “Talk to my cousin at Bright Smiles”']);
  assert.deepEqual([hk['talk-20'].title, hk['talk-20'].line], ['Dr. Reyes committed money', 'Introduced by Mara · “Start Monday”']);

  /* 13. The route checks an introduction against the record it reads, never one the request vouches for. */
  const route = readTalkFile(new URL('../../src/app/api/copilot/lab/route.ts', import.meta.url), 'utf8');
  assert.match(route, /normalizeTalk\(.*talksOnRecord/);
  assert.match(route, /normalizeIntroClose\(.*talksOnRecord/);

  console.log('copilot-core: conversations checks passed');
}

conversationsSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── Claude, connected: the connector's OAuth, its protocol, what it says ── */
//
// The checks are the ways a connector could let the wrong one in or say what
// the rows do not: a code sent somewhere nobody vetted, a client passing for
// Claude by the name it gave itself, a code redeemed without its verifier, a
// refresh race that ends a working connection or a replay that does not, a
// connection that outlives its disconnect, a write tool before it has its own
// consent, and a failed read that comes back looking like an empty record.

import {
  AS_SCOPES as OC_AS_SCOPES, CODE_TTL_S as OC_CODE_TTL, MCP_GRANT as OC_GRANT, MCP_REVOKE as OC_REVOKE, MCP_SEEN as OC_SEEN,
  REFRESH_GRACE_S as OC_GRACE, SCOPE_READ as OC_READ,
  askerOf as ocAsker, authServerMetadata as ocASM, authenticateClient as ocAuthClient, basicAuth as ocBasic, checkAuthorize as ocCheck,
  checkCodeGrant as ocCheckCode, checkRefreshGrant as ocCheckRefresh, clientOf as ocClientOf, clientRef as ocClientRef, clientSecret as ocSecret,
  connectionsOf as ocConnections, consentToken as ocConsent, consentTokenMatches as ocConsentOk, grantLive as ocLive, issueCode as ocIssue,
  newPairCode as ocNewPair, nextRefreshJti as ocNext, normalizePair as ocNormPair, pairHash as ocPairHash, pkceMatches as ocPkce,
  protectedResourceMetadata as ocPRM, redirectAllowed as ocAllowed, redirectMatches as ocMatches, refreshExp as ocRefreshExp,
  refreshStep as ocStep, registerClient as ocRegister, sameResource as ocSame, seal as ocSeal, tokenSet as ocTokens, unseal as ocUnseal,
  wwwAuthenticate as ocWww, type LedgerRow as OcRow,
} from '../../src/lib/copilot/oauth';
import {
  INSTRUCTIONS as MCP_INSTRUCTIONS, MCP_LATEST, TOOLS as MCP_TOOLS, TOOL_NAMES as MCP_TOOL_NAMES,
  handleBody as mcpBody, handleRpc as mcpRpc, headerVersionOk as mcpVersionOk, type RpcContext,
} from '../../src/lib/copilot/mcp';
import { answersText as mrAnswers, conversationsText as mrTalks, overviewText as mrOverview, planText as mrPlan, proofText as mrProof, type OverviewIn } from '../../src/lib/copilot/mcpread';
import { openIntros as cnOpenIntros, talkCounts as cnTalkCounts, type Talk as CnTalk } from '../../src/lib/copilot/lab';
import { talkTotals as cnTalkTotals } from '../../src/lib/copilot/ideas';
import { readFileSync as readConnFile } from 'node:fs';

async function connectorSuite() {
  const master = Buffer.from('a'.repeat(32));
  const other = Buffer.from('b'.repeat(32));
  const now = 1_800_000_000;
  const base = 'https://app.example.com';
  const resource = `${base}/api/copilot/mcp`;
  const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
  // RFC 7636 appendix B.
  const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  const iso = (s: number) => new Date(s * 1000).toISOString();

  /* 1. A signed token is this server's, for this use, and unexpired — or it is nothing. */
  const t = ocSeal('cpa', { a: 1, exp: now + 10 }, master);
  assert.deepEqual(ocUnseal('cpa', t, master, now), { a: 1, exp: now + 10 });
  assert.equal(ocSeal('cpa', { a: 1, exp: now + 10 }, master), t, 'the same payload signs the same: a replayed refresh can return the same token');
  assert.equal(ocUnseal('cpa', t, other, now), null, 'another key');
  assert.equal(ocUnseal('cpt', `cpt${t.slice(3)}`, master, now), null, 'a code passed off as an access token');
  assert.equal(ocUnseal('cpa', t, master, now + 10), null, 'gone at its exp');
  const [kind, , sig] = t.split('.');
  const edited = Buffer.from(JSON.stringify({ a: 2, exp: now + 10 })).toString('base64url');
  assert.equal(ocUnseal('cpa', `${kind}.${edited}.${sig}`, master, now), null, 'an edited payload');
  for (const junk of ['', 'cpa', 'cpa..', 'cpa.e30.', 7, null, {}]) assert.equal(ocUnseal('cpa', junk, master, now), null, `junk: ${JSON.stringify(junk)}`);

  /* 2. A code goes to Claude's callback or this computer, and nowhere else. */
  for (const ok of [CLAUDE, 'https://claude.com/api/mcp/auth_callback', 'http://localhost:3118/callback', 'http://127.0.0.1/callback', 'http://[::1]:9/callback']) {
    assert.ok(ocAllowed(ok), ok);
  }
  for (const no of ['https://evil.example/cb', `${CLAUDE}#x`, 'https://claude.ai/other', 'http://claude.ai/api/mcp/auth_callback', 'https://claude.ai.evil.example/api/mcp/auth_callback', 'https://localhost/callback', 'https://user@claude.ai/api/mcp/auth_callback', 'javascript:alert(1)', '', null]) {
    assert.equal(ocAllowed(no), false, `refused: ${no}`);
  }
  assert.ok(ocAllowed('https://other.example/oauth/cb', ['https://other.example/oauth/cb']), 'one the operator added, exactly');
  assert.ok(ocMatches(['http://localhost/callback'], 'http://localhost:3118/callback'), 'loopback: any port (RFC 8252 7.3)');
  assert.ok(ocMatches(['http://127.0.0.1/callback'], 'http://127.0.0.1:55001/callback'));
  assert.equal(ocMatches(['http://localhost/callback'], 'http://localhost:3118/elsewhere'), false, 'but the path exactly');
  assert.equal(ocMatches(['http://localhost/callback'], 'http://127.0.0.1:3118/callback'), false, 'localhost is not 127.0.0.1');
  assert.equal(ocMatches([CLAUDE], `${CLAUDE}?x=1`), false, 'anything else exactly');

  /* 3. Registration keeps nothing, and a page cannot register itself to collect codes, whatever it calls itself. */
  const reg = ocRegister({ client_name: 'Claude', redirect_uris: [CLAUDE], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }, { master, nowS: now });
  assert.ok(reg.ok);
  const clientId = (reg as { body: { client_id: string } }).body.client_id;
  assert.equal((reg as { body: Record<string, unknown> }).body.token_endpoint_auth_method, 'none');
  assert.equal((reg as { body: Record<string, unknown> }).body.client_secret, undefined, 'a public client gets no secret');
  assert.deepEqual(ocClientOf(clientId, master)?.r, [CLAUDE], 'the id is the registration');
  assert.equal(ocClientOf(clientId, other), null, 'signed, so it cannot be made up');
  const evil = ocRegister({ client_name: 'Claude', redirect_uris: ['https://evil.example/cb'] }, { master, nowS: now });
  assert.ok(!evil.ok && evil.error === 'invalid_redirect_uri');
  assert.ok(!ocRegister({ redirect_uris: [CLAUDE], grant_types: ['client_credentials'] }, { master, nowS: now }).ok, 'no grant without a person in it');
  assert.ok(!ocRegister({ redirect_uris: [] }, { master, nowS: now }).ok);
  const named = ocRegister({ redirect_uris: [CLAUDE], client_name: `<b>Claude</b>\u0000${'x'.repeat(200)}` }, { master, nowS: now });
  assert.ok(named.ok && !/[<>\u0000]/.test(String(named.body.client_name)) && String(named.body.client_name).length <= 80, 'a name is text, and short');
  const conf = ocRegister({ redirect_uris: ['http://localhost/callback'], token_endpoint_auth_method: 'client_secret_post' }, { master, nowS: now });
  assert.ok(conf.ok && conf.body.client_secret === ocSecret(String(conf.body.client_id), master), 'a confidential client gets a secret derived from its id');

  /* 4. The request: client and address first — until both check out there is nowhere safe to send an error. */
  const ask = { response_type: 'code', client_id: clientId, redirect_uri: CLAUDE, code_challenge: CHALLENGE, code_challenge_method: 'S256', state: 'st-1', scope: 'copilot.read offline_access', resource };
  const okReq = ocCheck(ask, { master, resource });
  assert.ok(okReq.ok && okReq.req.redirect === CLAUDE && okReq.req.state === 'st-1' && okReq.req.scope === OC_READ);
  const show = (r: ReturnType<typeof ocCheck>) => !r.ok && 'show' in r;
  const back = (r: ReturnType<typeof ocCheck>) => (!r.ok && 'redirect' in r ? new URL(r.redirect) : null);
  assert.ok(show(ocCheck({ ...ask, client_id: 'cpc.x.y' }, { master, resource })), 'an unknown client is told on the page');
  assert.ok(show(ocCheck({ ...ask, redirect_uri: 'https://evil.example/cb' }, { master, resource })), 'never sent to an address it did not register');
  const noPkce = back(ocCheck({ ...ask, code_challenge: undefined }, { master, resource }));
  assert.equal(noPkce?.origin + (noPkce?.pathname ?? ''), CLAUDE);
  assert.equal(noPkce?.searchParams.get('error'), 'invalid_request');
  assert.equal(noPkce?.searchParams.get('state'), 'st-1', 'the state goes back with the error');
  assert.equal(back(ocCheck({ ...ask, code_challenge_method: 'plain' }, { master, resource }))?.searchParams.get('error'), 'invalid_request', 'S256 only');
  assert.equal(back(ocCheck({ ...ask, response_type: 'token' }, { master, resource }))?.searchParams.get('error'), 'unsupported_response_type');
  assert.equal(back(ocCheck({ ...ask, resource: 'https://other.example/mcp' }, { master, resource }))?.searchParams.get('error'), 'invalid_target');
  assert.ok(ocCheck({ ...ask, resource: `${resource}/` }, { master, resource }).ok, 'a trailing slash is the same resource');
  assert.ok(ocCheck({ ...ask, redirect_uri: undefined }, { master, resource }).ok, 'the only registered address, when none is named');
  const cli = ocRegister({ client_name: 'Claude Code', redirect_uris: ['http://localhost/callback'] }, { master, nowS: now });
  const cliId = String((cli as { body: Record<string, unknown> }).body.client_id);
  assert.ok(show(ocCheck({ ...ask, client_id: cliId, redirect_uri: undefined }, { master, resource })), 'never a loopback address with no port named');
  const cliReq = ocCheck({ ...ask, client_id: cliId, redirect_uri: 'http://localhost:3118/callback' }, { master, resource });
  assert.ok(cliReq.ok);
  assert.deepEqual(ocAsker(CLAUDE), { name: 'Claude', host: 'claude.ai', local: false }, 'named by where the answer goes');
  assert.equal(ocAsker('http://localhost:3118/callback').local, true, 'this computer: any program, said as such');

  /* 5. A code is bound to its client, its address, its verifier and its resource. */
  assert.ok(ocPkce(VERIFIER, CHALLENGE), 'RFC 7636 B');
  assert.equal(ocPkce(`${VERIFIER.slice(0, -1)}A`, CHALLENGE), false);
  assert.equal(ocPkce('short', CHALLENGE), false);
  const req = (okReq as { req: Parameters<typeof ocIssue>[0] }).req;
  const code = ocIssue(req, 'pid-1', { master, nowS: now, jti: 'g-1' });
  const client = ocClientOf(clientId, master)!;
  const swap = { grant_type: 'authorization_code', code, redirect_uri: CLAUDE, client_id: clientId, code_verifier: VERIFIER, resource };
  const swapped = ocCheckCode(swap, client, { master, nowS: now + 5 });
  assert.ok(swapped.ok && swapped.code.sub === 'pid-1' && swapped.code.jti === 'g-1' && swapped.code.res === resource);
  const err = (r: { ok: boolean; err?: { error: string } }) => (r.ok ? null : r.err!.error);
  assert.equal(err(ocCheckCode({ ...swap, code_verifier: `${VERIFIER.slice(0, -1)}A` }, client, { master, nowS: now + 5 })), 'invalid_grant', 'without its verifier a stolen code is nothing');
  assert.equal(err(ocCheckCode({ ...swap, redirect_uri: 'https://claude.com/api/mcp/auth_callback' }, client, { master, nowS: now + 5 })), 'invalid_grant');
  assert.equal(err(ocCheckCode(swap, client, { master, nowS: now + OC_CODE_TTL })), 'invalid_grant', 'five minutes');
  assert.equal(err(ocCheckCode({ ...swap, resource: 'https://other.example/mcp' }, client, { master, nowS: now + 5 })), 'invalid_target');
  assert.equal(err(ocCheckCode(swap, ocClientOf(cliId, master)!, { master, nowS: now + 5 })), 'invalid_grant', 'issued to another client');
  // Client authentication, the way each registered.
  assert.ok(ocAuthClient({ client_id: clientId }, null, master).ok, 'a public client is who its id says, PKCE does the rest');
  const confId = String(conf.ok && conf.body.client_id);
  assert.equal(err(ocAuthClient({ client_id: confId }, null, master)), 'invalid_client', 'a confidential client without its secret');
  assert.ok(ocAuthClient({ client_id: confId, client_secret: ocSecret(confId, master) }, null, master).ok);
  assert.equal(err(ocAuthClient({ client_id: 'nobody' }, null, master)), 'invalid_client');
  const basic = ocBasic(`Basic ${Buffer.from(`${encodeURIComponent(confId)}:${encodeURIComponent('s3cr+t')}`).toString('base64')}`);
  assert.deepEqual(basic, { id: confId, secret: 's3cr+t' }, 'Basic, form-encoded halves (RFC 6749 2.3.1)');

  /* 6. A refresh rotates; a racing or lost reply gets the same successor; a replay later ends the grant. */
  const grant = { sub: 'pid-1', grant: 'g-1', scope: OC_READ, aud: resource, cid: ocClientRef(clientId) };
  const next = ocNext('r-1', master);
  assert.equal(next, ocNext('r-1', master), 'the successor is decided by the token, so two racing refreshes agree on it');
  const rows = [{ id: 1, jti: 'r-1', exp: now + 999, at: iso(now - 100) }];
  const rotate = ocStep(rows, 'r-1', next, { nowS: now });
  assert.deepEqual(rotate, { kind: 'rotate', next: { jti: next, exp: ocRefreshExp(now) }, insert: true, remove: [1] });
  const racing = ocStep([...rows, { id: 2, jti: next, exp: 123_456, at: iso(now) }], 'r-1', next, { nowS: now });
  assert.deepEqual(racing, { kind: 'rotate', next: { jti: next, exp: 123_456 }, insert: false, remove: [1] }, 'the second of two racing refreshes writes nothing and returns the first one\'s');
  const after = [{ id: 2, jti: next, exp: 123_456, at: iso(now) }];
  assert.deepEqual(ocStep(after, 'r-1', next, { nowS: now + 30 }), { kind: 'replay', next: { jti: next, exp: 123_456 } }, 'a reply lost on the way: the same successor again');
  assert.deepEqual(ocStep(after, 'r-1', next, { nowS: now + OC_GRACE + 1 }), { kind: 'reuse' }, 'replayed after the grace: somebody else holds it');
  assert.deepEqual(ocStep(after, 'r-0', ocNext('r-0', master), { nowS: now }), { kind: 'reuse' }, 'never current');
  const a1 = ocTokens(grant, { jti: next, exp: 123_456 + now }, { master, nowS: now });
  const a2 = ocTokens(grant, { jti: next, exp: 123_456 + now }, { master, nowS: now + 20 });
  assert.equal(a1.refresh_token, a2.refresh_token, 'a replay hands back the very token the lost reply carried');
  assert.equal(a1.token_type, 'Bearer');
  const rt = ocCheckRefresh({ grant_type: 'refresh_token', refresh_token: a1.refresh_token, client_id: clientId }, client, { master, nowS: now + 60 });
  assert.ok(rt.ok && rt.rt.jti === next && rt.rt.g === 'g-1');
  assert.equal(err(ocCheckRefresh({ refresh_token: a1.refresh_token, scope: 'copilot.read copilot.write' }, client, { master, nowS: now + 60 })), 'invalid_scope', 'a refresh cannot add scope');
  assert.ok(ocCheckRefresh({ refresh_token: a1.refresh_token, scope: 'copilot.read offline_access' }, client, { master, nowS: now + 60 }).ok);
  assert.equal(err(ocCheckRefresh({ refresh_token: a1.refresh_token }, ocClientOf(cliId, master)!, { master, nowS: now + 60 })), 'invalid_grant', 'another client');
  assert.equal(err(ocCheckRefresh({ refresh_token: a1.access_token }, client, { master, nowS: now + 60 })), 'invalid_grant', 'an access token is not a refresh token');

  /* 7. The ledger: live until ended, and the list shows only live ones, with their last read. */
  const row = (id: number, event_type: string, payload: Record<string, unknown>, at: number): OcRow => ({ id, event_type, payload, created_at: iso(at) });
  const ledger = [
    row(1, OC_GRANT, { grant: 'g-1', name: 'Claude', host: 'claude.ai', client: 'Claude', scope: OC_READ }, now - 900),
    row(2, OC_GRANT, { grant: 'g-2', name: 'An app on this computer', host: 'localhost', client: 'Claude Code', scope: OC_READ }, now - 500),
    row(3, OC_REVOKE, { grant: 'g-2', why: 'you' }, now - 100),
    row(4, OC_SEEN, { grant: 'g-1', at: iso(now - 60), tool: 'get_plan', n: 3, error: null }, now - 800),
    row(5, OC_SEEN, { grant: 'g-1', at: iso(now - 600), tool: 'get_overview', n: 1, error: null }, now - 850),
  ];
  assert.equal(ocLive(ledger, 'g-1'), true);
  assert.equal(ocLive(ledger, 'g-2'), false, 'ended in the app: its tokens stop at the next call');
  assert.equal(ocLive(ledger, 'g-9'), false, 'never made');
  const listed = ocConnections(ledger);
  assert.deepEqual(listed.map((c) => c.grant), ['g-1']);
  assert.deepEqual(listed[0].seen, { at: iso(now - 60), tool: 'get_plan', n: 3, error: null }, 'the later read, when two rows raced');

  /* 8. A code typed in from the app: unambiguous characters, read the way it was meant, kept keyed. */
  for (let i = 0; i < 300; i++) assert.match(ocNewPair(), /^[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/);
  let call = 0;
  // Bytes past the alphabet's last whole run are drawn again rather than folded in, which would favour the first few letters.
  assert.equal(ocNewPair((n) => Buffer.alloc(n, call++ === 0 ? 255 : 0)), '2222-2222');
  assert.equal(ocNormPair(' k7qm-3txd '), 'K7QM3TXD');
  assert.equal(ocNormPair('K7QM 3TXD'), 'K7QM3TXD');
  for (const bad of ['K7QM-3TX', 'K7QM-3TXO', 'K7QM-3TX1', 'K7QM-3TXDD', '', null]) assert.equal(ocNormPair(bad), null, `not a code: ${bad}`);
  assert.equal(ocPairHash('K7QM3TXD', master), ocPairHash(ocNormPair('k7qm 3txd')!, master));
  assert.notEqual(ocPairHash('K7QM3TXD', master), ocPairHash('K7QM3TXD', other), 'keyed: a copy of the table is not a list of codes');

  /* 9. The consent form is tied to the account it was shown to and the request it was shown for. */
  const ct = ocConsent('pid-1', req, master);
  assert.ok(ocConsentOk(ct, 'pid-1', req, master));
  assert.equal(ocConsentOk(ct, 'pid-2', req, master), false, 'another account');
  assert.equal(ocConsentOk(ct, 'pid-1', { ...req, state: 'other' }, master), false, 'another request');
  assert.equal(ocConsentOk(undefined, 'pid-1', req, master), false);

  /* 10. What the server says: the documents Claude reads, and the 401 that starts sign-in. */
  const prm = ocPRM(`${base}/`);
  assert.equal(prm.resource, resource, 'the resource is exactly the URL pasted into Claude');
  assert.equal(prm.authorization_servers[0], base, 'Claude reads only the first');
  assert.deepEqual(prm.scopes_supported, [OC_READ]);
  const asm = ocASM(base) as Record<string, unknown>;
  assert.equal(asm.issuer, base);
  assert.equal(asm.authorization_endpoint, `${base}/copilot2/connect`);
  assert.equal(asm.registration_endpoint, `${base}/api/copilot/oauth/register`);
  assert.deepEqual(asm.code_challenge_methods_supported, ['S256']);
  assert.ok((asm.token_endpoint_auth_methods_supported as string[]).includes('none'));
  assert.deepEqual(asm.scopes_supported, [...OC_AS_SCOPES], 'offline_access listed, so Claude asks for the refresh token');
  assert.equal(asm.client_id_metadata_document_supported, undefined, 'no metadata documents: they mean fetching any URL a client names');
  const www = ocWww(base);
  assert.ok(www.startsWith('Bearer ') && www.includes(`resource_metadata="${base}/.well-known/oauth-protected-resource/api/copilot/mcp"`) && www.includes(`scope="${OC_READ}"`));
  assert.ok(ocWww(base, { error: 'invalid_token', description: 'It "expired"' }).startsWith('Bearer error="invalid_token", error_description="It expired"'), 'quotes cannot break the header');
  assert.ok(ocSame('https://APP.example.com/api/copilot/mcp/', resource));
  assert.equal(ocSame('https://app.example.com/api/copilot/other', resource), false);

  /* 11. The protocol: what Claude is told, and a failure always comes back as one, with its reason. */
  const calls: Array<[string, Record<string, unknown>]> = [];
  const ctx: RpcContext = {
    call: async (name, args) => {
      calls.push([name, args]);
      if (name === 'get_plan') throw new Error('the plan could not be read');
      return { text: `read ${name}` };
    },
  };
  const init = await mcpRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-ai' } } }, ctx) as { result: Record<string, unknown> };
  assert.equal(init.result.protocolVersion, '2025-06-18', 'a version this server speaks is echoed');
  assert.deepEqual(init.result.capabilities, { tools: { listChanged: false } });
  const told = String(init.result.instructions);
  assert.ok(/read-only/.test(told) && /never say it was saved/.test(told), 'Claude is told it cannot save, so it does not say it did');
  assert.ok(/estimate/.test(told), 'and to say which numbers are its own');
  assert.equal((await mcpRpc({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, ctx) as { result: { protocolVersion: string } }).result.protocolVersion, MCP_LATEST);
  assert.equal(await mcpRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx), null, 'a notification gets no reply');
  assert.equal(await mcpRpc({ jsonrpc: '2.0', id: 9, result: {} }, ctx), null);
  assert.deepEqual(await mcpRpc({ jsonrpc: '2.0', id: 3, method: 'ping' }, ctx), { jsonrpc: '2.0', id: 3, result: {} });
  const listedTools = (await mcpRpc({ jsonrpc: '2.0', id: 4, method: 'tools/list' }, ctx) as { result: { tools: typeof MCP_TOOLS } }).result.tools;
  assert.deepEqual(listedTools.map((x) => x.name), [...MCP_TOOL_NAMES]);
  for (const tool of listedTools) {
    assert.equal(tool.annotations.readOnlyHint, true, `${tool.name} reads`);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.inputSchema.type, 'object');
    assert.ok(tool.description.length > 40, `${tool.name} says what it returns`);
    // Writing waits for its own scope and its own consent screen (invariant 7).
    assert.ok(!/^(log|send|add|create|update|delete|set|write|save|record|book)/.test(tool.name), `no write tool yet: ${tool.name}`);
  }
  const called = await mcpRpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_overview', arguments: {} } }, ctx) as { result: { content: Array<{ text: string }>; isError?: boolean } };
  assert.equal(called.result.content[0].text, 'read get_overview');
  assert.equal(called.result.isError, undefined);
  const failed = await mcpRpc({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'get_plan' } }, ctx) as { result: { content: Array<{ text: string }>; isError?: boolean } };
  assert.equal(failed.result.isError, true);
  assert.match(failed.result.content[0].text, /the plan could not be read/, 'the reason, said to Claude (invariant 13)');
  assert.equal((await mcpRpc({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'log_sale' } }, ctx) as { error: { code: number } }).error.code, -32602);
  const tooMany = await mcpRpc({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'get_conversations', arguments: { limit: 500 } } }, ctx) as { result: { content: Array<{ text: string }>; isError?: boolean } };
  assert.ok(tooMany.result.isError && /1 to 100/.test(tooMany.result.content[0].text), 'a bad argument is a tool error the model can correct');
  await mcpRpc({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'get_conversations' } }, ctx);
  assert.deepEqual(calls.filter(([n]) => n === 'get_conversations'), [['get_conversations', { limit: 20 }]], 'the bad call ran nothing; the bare one got the default');
  assert.equal((await mcpRpc({ jsonrpc: '2.0', id: 11, method: 'resources/list' }, ctx) as { error: { code: number } }).error.code, -32601);
  assert.equal((await mcpRpc({ id: 12, method: 'ping' }, ctx) as { error: { code: number } }).error.code, -32600);
  const batch = await mcpBody([{ jsonrpc: '2.0', id: 13, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }], ctx);
  assert.ok(batch.status === 200 && Array.isArray(batch.json) && batch.json.length === 1);
  assert.deepEqual(await mcpBody({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx), { status: 202 });
  assert.ok(mcpVersionOk(null) && mcpVersionOk('2025-11-25') && !mcpVersionOk('1999-01-01'));

  /* 12. What the tools say: the person's words as theirs, every kind of person counted, a failed read said. */
  const blankOverview: OverviewIn = {
    today: '2026-10-06', offer: {}, foundBy: null, here: { title: 'Nothing to send yet', line: 'No offer written, so nothing is drafted', counts: null },
    goals: [], outlook: null, runwayMonths: null, verdict: { title: 'Not proven', line: 'No sale yet.' }, links: [], weak: null,
    bet: null, checkpointDue: false, now: { title: 'Write your offer', why: null, size: null }, asks: [],
  };
  const ov = mrOverview(blankOverview);
  assert.match(ov, /You have not written down what you sell yet/);
  assert.match(ov, /No bet running\./);
  assert.ok(!/Not in this read/.test(ov));
  const ovGoal = mrOverview({
    ...blankOverview,
    goals: [{ title: 'Exit fund', status: '$0 of $1,500', horizon: 'By 30 Nov · 55 days left', verdict: 'Off track' }],
    outlook: { title: 'Exit fund', verdict: 'Off track', line: '$1,500 in 55 days is 5 sales at your $150 a month.' },
  });
  assert.match(ovGoal, /- Exit fund · \$0 of \$1,500 · By 30 Nov · 55 days left · Off track\n {2}\$1,500 in 55 days/, 'the verdict once, with its sentence under the goal it is about');
  const ovFailed = mrOverview({ ...blankOverview, missing: ['bets and conversations (timeout)'] });
  assert.match(ovFailed, /Not in this read, because the app could not load it just now: bets and conversations \(timeout\)/, '"No bet running" is never what a failed read looks like');
  const ovBet = mrOverview({
    ...blankOverview, offer: { sells: 'Booking automation', price_band: '$150' },
    bet: { belief: 'Dentists pay $150 for this', part: 'What they pay', state: 'running', result: '1 of 3 sales at your $150', pass: '3 sales at your $150 by 20 Oct', start: '2026-10-04', ended: null, day: 3, days: 14, note: null, play: null },
  });
  assert.match(ovBet, /- Sells: Booking automation/);
  assert.match(ovBet, /"Dentists pay \$150 for this" — on what they pay\. Day 3 of 14: 1 of 3 sales at your \$150\. It passes at 3 sales at your \$150 by 20 Oct\./);

  const talk = (id: string, on: string, who: string, role: CnTalk['role'], commitment: CnTalk['commitment'], extra: Partial<CnTalk> = {}): CnTalk => ({ id, on, who, role, problem: 'unasked', commitment, said: null, via: null, at: `${on}T10:00:00Z`, ...extra });
  const today = '2026-10-06';
  const talks = [
    talk('t0', '2026-09-28', 'Mara', 'connector', 'intro', { said: 'My cousin runs Bright Smiles' }),
    talk('t1', '2026-10-02', 'Dr Lim', 'buyer', 'money', { problem: 'yes', said: 'We lose two bookings a week', via: 't0' }),
    talk('t2', '2026-10-03', 'Joel', 'seller', 'none', { problem: 'yes' }),
    talk('t3', '2026-09-30', 'Juan', 'operator', 'intro'),
  ];
  const tx = mrTalks({ today, talks, intros: cnOpenIntros(talks, {}, today), counts: cnTalkCounts(talks, today), totals: cnTalkTotals(talks), limit: 20 });
  assert.match(tx, /Last 30 days: 4 conversations — 1 could buy, 1 sells to them, 1 runs the work, 0 already earns in it, 1 knows people\./, 'every kind of person, the empty ones too');
  assert.match(tx, /2026-10-02 · Dr Lim · could buy · they have it · ended in: money · came through Mara's introduction · said: “We lose two bookings a week”/);
  assert.ok(!/Joel · sells to them · they have it/.test(tx), 'a supplier is not counted as having the buyer\'s problem');
  assert.match(tx, /- Juan offered one 6 days ago \(30 Sep\)/, 'an introduction still waiting');
  assert.ok(!/- Mara offered one/.test(tx), 'one that led somewhere is not waiting');
  assert.match(tx, /the app cannot hear calls/, 'what the count is: only what was logged');
  assert.match(mrTalks({ today, talks, intros: [], counts: cnTalkCounts(talks, today), totals: cnTalkTotals(talks), limit: 1 }), /Newest first \(the 1 newest of 4\)/);

  const plan = mrPlan({
    today, now: null, asks: [{ kind: 'Introduction', title: 'Follow up Juan', detail: '' }], here: { title: 'At the start', line: '', counts: null }, plan: null,
    ahead: [{ title: 'First reply', status: '0 of 1', takes: 'About 20 sends.', when: '4 days at your pace.', early: true }],
  });
  assert.match(plan, /No plan drawn/);
  assert.match(plan, /- First reply \(0 of 1\)\. About 20 sends\. 4 days at your pace\. \(An estimate from too few sends to trust yet\.\)/, 'an estimate keeps its caveat');
  assert.match(plan, /Introduction: Follow up Juan/);
  const drawn = mrPlan({
    today, now: { title: 'Record a demo', why: 'Nothing to show is the gap.', size: 'One sitting' }, asks: [], here: { title: 'At the start', line: 'Toward Exit fund', counts: null },
    plan: {
      here: { title: 'Six conversations, no sale', line: null }, direction: 'Proof first', done: 1, total: 3, drawnAt: '2026-10-05T21:00:00Z', failed: null,
      phases: [{ label: 'This week', milestones: [{ title: 'A demo a prospect can see', why: null, doneWhen: 'A link exists', goal: 'Exit fund', state: 'open', steps: [{ title: 'Record it', size: 'One sitting', tag: 'High leverage', who: 'you', state: 'done' }] }] }],
    },
    ahead: [],
  });
  assert.match(drawn, /Your plan \(drawn by a model from your record on 2026-10-05; what is done is what you ticked\)/, 'a model\'s plan is marked as one (invariant 12)');
  assert.match(drawn, /- \[to do\] A demo a prospect can see \(toward Exit fund\) Done when: A link exists/);
  assert.match(drawn, / {2}- \[done\] Record it \(one sitting, high leverage\)/);
  assert.match(drawn, /The move now: Record a demo \(One sitting\)\nNothing to show is the gap\./);

  const proof = mrProof({
    today, verdict: { title: 'Not proven yet', line: '0 of 3 sales at your price.' }, weak: 'What they pay',
    links: [
      { label: 'Who buys', state: 'Works', what: 'Dental clinics', facts: '3 replied of 12', why: 'Replies came back.' },
      { label: 'What they pay', state: 'Untested', what: null, facts: 'Nothing paid yet', why: 'Nothing paid yet.' },
    ],
    bets: [{ belief: 'Clinics pay $150', part: 'What they pay', state: 'failed', result: '0 of 3 sales', pass: '3 sales by 1 Oct', start: '2026-09-17', ended: '2026-10-01', day: 14, days: 14, note: 'Too early in the month', play: null }],
    checkpoint: { due: true, last: null }, history: [{ day: '2026-10-01', title: 'Bet ended', line: 'Did not pass' }],
  });
  assert.match(proof, /Who buys: Works\. What it is, in your words: Dental clinics\. Counted: 3 replied of 12\. Replies came back\./);
  assert.match(proof, /- What they pay: Untested\. Nothing paid yet\.\n/, 'a count that only repeats its reason is said once');
  assert.match(proof, /2026-09-17 · "Clinics pay \$150" — on what they pay: did not pass on 2026-10-01, 0 of 3 sales against 3 sales by 1 Oct\. You wrote: "Too early in the month"/);
  assert.match(proof, /A checkpoint is due now\.\nNo checkpoint decided yet\./);

  const answers = mrAnswers([{ id: 'replies', q: 'Which segments reply?', headline: 'Too few sends to say yet', rows: [], thin: 'Six sends per segment before a rate means anything.' }], today);
  assert.match(answers, /## Which segments reply\?\nToo few sends to say yet\nSix sends per segment/);

  /* 13. The routes: what reads cookies, what a GET can do, what is checked first. */
  const src = (p: string) => readConnFile(new URL(`../../src/${p}`, import.meta.url), 'utf8');
  const mcpRoute = src('app/api/copilot/mcp/route.ts');
  const mcpRead = src('app/api/copilot/mcp/read.ts');
  for (const [name, s] of [['mcp route', mcpRoute], ['mcp read', mcpRead]] as const) {
    assert.ok(!/currentProfileId|profileIdOr401|cookies\(/.test(s), `${name} never reads the session: the token is the only credential, which is why any origin may call it`);
  }
  assert.match(mcpRoute, /status: 401[\s\S]*www-authenticate/, 'a 401 with the header is the only thing that starts Claude\'s sign-in');
  assert.ok(mcpRead.indexOf('markSeen(who.pid, who.grant, name, null)') < mcpRead.indexOf('readTool(name, args, who.pid)'), 'a read is recorded before it is made');
  const authorizeRoute = src('app/api/copilot/oauth/authorize/route.ts');
  assert.ok(!/export (async )?function GET/.test(authorizeRoute), 'a code is issued by the tap\'s POST, never by a GET a preview could make');
  assert.match(authorizeRoute, /consentTokenMatches\(/);
  assert.match(authorizeRoute, /rateLimit\(`copilot:mcp-pair-try:/, 'a typed code is rate-limited per network');
  const page = src('app/copilot2/connect/page.tsx');
  assert.match(page, /method="post" action="\/api\/copilot\/oauth\/authorize"/);
  assert.match(page, /askerOf\(/, 'the screen names who is asking by where the answer goes');
  const connector = src('lib/copilot/connector.ts');
  assert.match(connector, /insertRows\(\[\s*\{ profile_id: code\.sub, event_type: MCP_GRANT[\s\S]*?event_type: MCP_REFRESH/, 'a grant and its refresh token are written in one insert');
  assert.match(connector, /if \(!grantLive\(rows, t\.g\)\)/, 'every call checks the grant, so a disconnect does not wait out the hour');

  console.log('copilot-core: connector checks passed');
}

connectorSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── Ask it: a question about the record, matched, counted, said back ──────── */
//
// The checks are the ways a spoken answer could mislead: a question matched to
// the wrong count ("messages went out" as money), a week that means two things,
// a total over days the rows do not reach passed off as the days asked about, a
// failed read answered as "nothing", amounts in two currencies added up, a
// model allowed to supply the answer or a day nobody said — and a move said
// into the mic answered as a question, or a question logged as a move.

import {
  ASKED as AK_ASKED, ASKED_CHIPS as AK_CHIPS, ASKED_IDS as AK_IDS, PERIODS as AK_PERIODS,
  aboutOf as akAbout, answerAsked as akAnswer, askedLine as akLine, askedPrompt as akPrompt, categoryOf as akCategory,
  matchAsked as akMatch, monthsOf as akMonths, normalizeAsked as akNormalize, periodOf as akPeriod, screenMoney as akScreen, spanOf as akSpan,
  spokenMoney as akSpoken, type Asked as AkAsked, type AskedInput as AkInput, type BookMonthIn as AkBook,
} from '../../src/lib/copilot/asked';
import type { Talk as AkTalk } from '../../src/lib/copilot/lab';
import { askedOutright as akOutright } from '../../src/lib/copilot/tell';
import { readFileSync as readAskFile } from 'node:fs';

async function askItSuite() {
  const today = '2026-10-04';
  const ask = (id: AkAsked['id'], period: AkAsked['period'] = null, about: string | null = null): AkAsked => ({ id, period, about, by: 'rules' });

  /* 1. What was asked, matched — the most particular reading first. */
  const cases: Array<[string, string | null]> = [
    ['What should I do next?', 'next'], ['what should I focus on today', 'next'], ['where do I start', 'next'],
    ['How is my bet going?', 'bet'], ["how's the experiment going", 'bet'], ['is my test working', 'bet'],
    ['Am I on track for my goal?', 'goal'], ['how close am I to my exit fund', 'goal'],
    ['How much can I spend today?', 'safe'], ['can I afford a coffee', 'safe'], ['what is safe to spend', 'safe'],
    ['How much did I spend this week?', 'spent'], ['how much did coffee cost me this week', 'spent'], ['my expenses last month', 'spent'],
    ['What came in this month?', 'received'], ['how much did I make this week', 'received'], ['did I get paid', 'received'],
    ['What is my balance?', 'balance'], ['how much money do I have', 'balance'],
    ["what's my runway", 'runway'], ['when will I run out of money', 'runway'],
    ['Who did I talk to this week?', 'talks'], ['how many conversations this month', 'talks'],
    ['Who do I need to follow up?', 'intros'], ['any introductions waiting', 'intros'],
    ['How many sales this month?', 'sales'], ['did I close any deals', 'sales'], ['how much did I sell this month', 'sales'],
    ['how many sales did I make this month', 'sales'], ['how many customers did I talk to this week', 'talks'], ['how much money did I make this week', 'received'],
    ['How many messages went out this week?', 'sent'], ['did anyone reply', 'sent'],
    ['How much deep work this week?', 'focus'], ['how many hours did I work this week', 'focus'], ['how much time did I spend focused', 'focus'],
    ['which segment replies the most', 'segments'], ['where do my drafts die', 'drafts'], ['which of its calls worked', 'calls'],
    ['what did I tell it to stop suggesting', 'stood_down'], ['has any of this been worth it', 'worth'],
    ['should I raise my price', null], ['how do I get more clients', null], ['tell me a joke', null],
  ];
  for (const [said, id] of cases) assert.equal(akMatch(said)?.id ?? null, id, `"${said}" → ${id}`);
  assert.equal(akMatch('How many messages went out this week?')?.id, 'sent', '"went out" alone is a message as often as money');
  for (const id of AK_CHIPS) assert.equal(akMatch(AK_ASKED[id].q)?.id, id, `the chip for ${id} matches itself`);

  /* 2. A question for the sheet, or a move for the book: a move is never answered, and a question never logged. */
  for (const said of ['coffee 130', 'grab 240 yesterday', 'paid rent 12000', 'salary came in 50000', 'Pia paid me 150']) assert.equal(akOutright(said), false, `"${said}" is a move`);
  for (const said of ['how much did I spend this week', 'did I spend 500 on food?', 'safe to spend', 'Any replies today', 'what should I do next']) assert.equal(akOutright(said), true, `"${said}" is a question`);

  /* 3. Days, said the way the screens count them: a week is the last seven days, a month is the calendar's. */
  assert.equal(akPeriod('how much did I spend this week'), 'week');
  assert.equal(akPeriod('my expenses last month'), 'lastmonth');
  assert.equal(akPeriod('in the past month'), '30d');
  assert.equal(akPeriod('anything last week'), 'lastweek');
  assert.equal(akPeriod('what did I spend'), null);
  assert.deepEqual(akSpan('week', today), { from: '2026-09-28', to: today, label: 'in the last 7 days' });
  assert.deepEqual(akSpan('lastweek', today), { from: '2026-09-21', to: '2026-09-27', label: 'in the 7 days before that' });
  assert.deepEqual(akSpan('month', today), { from: '2026-10-01', to: today, label: 'this month' });
  assert.deepEqual(akSpan('lastmonth', '2026-01-05'), { from: '2025-12-01', to: '2025-12-31', label: 'in December' }, 'across the new year');
  assert.deepEqual(akSpan('30d', today), { from: '2026-09-05', to: today, label: 'in the last 30 days' });
  assert.deepEqual(akMonths({ from: '2026-09-28', to: today }), ['2026-09', '2026-10'], 'a week that straddles two months reads both');
  assert.deepEqual(akMonths({ from: '2025-12-30', to: '2026-01-02' }), ['2025-12', '2026-01']);
  for (const p of AK_PERIODS) assert.ok(akSpan(p, today).from <= akSpan(p, today).to, `${p} runs forwards`);

  /* 4. What a money question is about, matched to the person's own categories. */
  assert.equal(akAbout('how much did I spend on food yesterday'), 'food');
  assert.equal(akAbout('how much did I spend on dining out this month'), 'dining out');
  assert.equal(akAbout('how much did coffee cost me this week'), 'coffee');
  assert.equal(akAbout('how much did I spend this week'), null);
  assert.equal(akCategory('dining out', ['Groceries', 'Dining Out']), 'Dining Out');
  assert.equal(akCategory('grocery', ['Groceries', 'Dining Out']), 'Groceries', 'singular and plural are one category');
  assert.equal(akCategory('grab', ['Groceries']), null);

  /* 5. Money, said: a voice reads words, not marks. */
  assert.equal(akSpoken(850, '₱'), '850 pesos');
  assert.equal(akSpoken(71479.06, 'PHP'), '71,479 pesos', 'whole units past twenty');
  assert.equal(akSpoken(1, 'USD'), '1 dollar');
  assert.equal(akSpoken(12.5, 'EUR'), '12.5 euros');
  assert.equal(akSpoken(150, '$'), '150 dollars');
  assert.equal(akSpoken(100, 'XYZ'), '100 XYZ');
  assert.equal(akScreen(71479.06, 'PHP'), '₱71,479.06');

  /* 6. Money answers, counted from the book. */
  const line = (shown: number, category: string | null, label = category ?? 'Thing') => ({ shown, category, label });
  const month = (m: string, days: AkBook['days'], extra: Partial<AkBook> = {}): AkBook => ({
    month: m, view: 'PHP', ready: true, notReady: null, started: true, days, unlabelled: 0, missing: null,
    balance: { shown: 12000 }, safe: { left: 850, perDay: 1000, days: 30, committed: 3000, spentToday: 150, broke: false }, safeShown: 850,
    categories: { out: ['Groceries', 'Coffee', 'Transportation'], in: ['Client'] }, ...extra,
  });
  const book = [
    month('2026-09', [{ on: '2026-09-29', lines: [line(-210, 'Coffee')] }, { on: '2026-09-20', lines: [line(-2000, 'Groceries')] }]),
    month('2026-10', [{ on: '2026-10-04', lines: [line(-130, 'Coffee'), line(-20, 'Transportation', 'Jeep')] }, { on: '2026-10-02', lines: [line(-1280, 'Groceries'), line(4500, 'Client', 'Bright Smiles')] }]),
  ];
  const base: AkInput = { today, timezone: 'Asia/Manila', book };
  const week = akAnswer(ask('spent', 'week'), base);
  assert.equal(week.title, '₱1,640 spent in the last 7 days', 'the 20 Sep groceries are outside the week and not in it');
  assert.equal(week.say, 'You spent 1,640 pesos in the last 7 days, across 4 moves. Most on Groceries.');
  assert.match(week.counted ?? '', /4 moves, 28 Sep to 4 Oct/);
  assert.match(week.lines[0], /^Groceries ₱1,280 · Coffee ₱340 · Transportation ₱20$/);
  assert.equal(akAnswer(ask('spent', 'month', 'coffee'), base).title, '₱130 spent on Coffee this month', 'a category, by its own name');
  assert.equal(akAnswer(ask('spent', 'week', 'jeep'), base).title, '₱20 spent on “jeep” in the last 7 days', 'a word in the label, when it is no category');
  const none = akAnswer(ask('spent', 'month', 'shoes'), base);
  assert.match(none.say, /^Nothing spent on “shoes” this month\. Your categories: Groceries, Coffee, Transportation\.$/, 'the spending ones: money in is not where shoes went');
  assert.equal(akAnswer(ask('received', 'month'), base).title, '₱4,500 came in this month');
  assert.equal(akAnswer(ask('spent', 'month'), base).title, '₱1,430 spent this month', 'the default for spending is the calendar month');
  // A book that could not be read is said, never answered as nothing.
  const unread = akAnswer(ask('spent', 'week'), { ...base, book: 'timeout' });
  assert.ok(unread.thin && /could not be opened: timeout/.test(unread.title));
  assert.ok(akAnswer(ask('spent', 'week'), { today, timezone: 'Asia/Manila' }).thin, 'a book never opened is not an empty one');
  assert.match(akAnswer(ask('spent', 'week'), { ...base, book: [month('2026-10', [], { ready: false, notReady: 'Run 20261001_copilot_book.sql.' })] }).title, /20261001/);
  const mixed = akAnswer(ask('spent', 'week'), { ...base, book: [book[0], { ...book[1], view: 'EUR', missing: 'No rate for these days.' }] });
  assert.ok(mixed.thin && /different currencies/.test(mixed.title), 'pesos and euros are not added up');

  /* 7. Balance and safe to spend, from the book's own figures. */
  assert.equal(akAnswer(ask('safe'), base).say, 'You can spend 850 pesos today.');
  assert.equal(akAnswer(ask('balance'), base).title, '₱12,000');
  const broke = akAnswer(ask('safe'), { ...base, book: [month('2026-10', [], { safe: { left: 0, perDay: 0, days: 30, committed: 15000, spentToday: 0, broke: true } })] });
  assert.match(broke.say, /Nothing is safe to spend today/);
  const over = akAnswer(ask('safe'), { ...base, book: [month('2026-10', [], { safeShown: -200 })] });
  assert.match(over.say, /over today's share by 200 pesos/);
  const unstarted = akAnswer(ask('balance'), { ...base, book: [month('2026-10', [], { started: false, balance: null, safe: null, safeShown: null })] });
  assert.ok(unstarted.thin && /no starting balance/i.test(unstarted.say));

  /* 8. The record's own answers: the bet, the goal, runway, the move. */
  assert.equal(akAnswer(ask('bet'), { today, timezone: 'UTC', bet: null }).title, 'No bet running.');
  assert.match(akAnswer(ask('bet'), { today, timezone: 'UTC', bet: null, checkpointDue: true }).say, /checkpoint is due/);
  const bet = akAnswer(ask('bet'), { today, timezone: 'UTC', bet: { belief: 'Clinics pay $150 for this', part: 'What they pay', day: 6, days: 14, result: '1 of 3 commitments', pass: '3 commitments by 12 Oct' } });
  assert.equal(bet.title, 'Day 6 of 14: 1 of 3 commitments');
  assert.equal(bet.say, 'Your bet, Clinics pay $150 for this: day 6 of 14, 1 of 3 commitments. It passes at 3 commitments by 12 Oct.');
  assert.ok(akAnswer(ask('goal'), { today, timezone: 'UTC', goals: [] }).thin);
  const goal = akAnswer(ask('goal'), { today, timezone: 'UTC', goals: [{ title: 'Exit fund', status: '$0 of $1,500', horizon: 'By 9 Nov · 36 days left', verdict: 'Off track' }], outlook: { title: 'Exit fund', line: '10 sales at your $150 in 36 days.' } });
  assert.equal(goal.say, 'Exit fund: $0 of $1,500, By 9 Nov, 36 days left. Off track. 10 sales at your $150 in 36 days.');
  assert.ok(akAnswer(ask('runway'), { today, timezone: 'UTC', runway: { months: null, cash: null, outPerMonth: null, currency: null } }).thin, 'no runway is said, not shown as zero');
  const runway = akAnswer(ask('runway'), { today, timezone: 'UTC', runway: { months: 3.4, cash: 34000, outPerMonth: 10000, currency: '₱', cashFrom: 'book', outFrom: 'statement' } });
  assert.deepEqual([runway.title, ...runway.lines], ['3.4 months of runway', 'Cash: ₱34,000, from your book.', 'Going out: ₱10,000 a month, from your statements.']);
  const next = akAnswer(ask('next'), { today, timezone: 'UTC', now: { title: 'Record a demo', why: 'Nothing to show is the gap.', size: 'about 60 min of your 150' }, asks: [{ kind: 'Introduction', title: 'Follow up Juan' }] });
  assert.equal(next.say, 'Next: Record a demo. Nothing to show is the gap.');
  assert.ok(next.lines.includes('About 60 min of your 150.') && next.lines.includes('Introduction: Follow up Juan'));

  /* 9. Conversations, sales, sends and deep work: over the days asked, or said why not. */
  const talk = (id: string, on: string, role: AkTalk['role'], commitment: AkTalk['commitment']): AkTalk => ({ id, on, who: id, role, problem: 'unasked', commitment, said: null, via: null, at: `${on}T10:00:00Z` });
  const talks = [talk('Mara', '2026-09-28', 'connector', 'intro'), talk('Dr Lim', '2026-10-02', 'buyer', 'money'), talk('Juan', '2026-10-03', 'operator', 'none')];
  const t30 = akAnswer(ask('talks'), { today, timezone: 'UTC', talks });
  assert.equal(t30.title, '3 conversations in the last 30 days', 'conversations default to the thirty days the app counts them over');
  assert.match(t30.say, /1 could buy, 1 runs the work, 1 knows people\. 2 ended in a commitment\./);
  assert.equal(akAnswer(ask('talks', 'month'), { today, timezone: 'UTC', talks }).title, '2 conversations this month');
  const tFailed = akAnswer(ask('talks'), { today, timezone: 'UTC', talks: [], unreadable: ['bets and conversations (timeout)'] });
  assert.ok(tFailed.thin && !/No conversations/.test(tFailed.title), 'a failed read is not "no conversations"');
  const wins = [{ at: '2026-10-01T16:30:00Z', amount: 150, who: 'Bright Smiles' }, { at: '2026-09-30T16:30:00Z', amount: null, who: 'Pia' }, { at: '2026-09-12T03:00:00Z', amount: 300, who: 'Lakeview' }];
  // 30 Sep 16:30 UTC is 1 Oct 00:30 in Manila: the sale is the person's October.
  const sales = akAnswer(ask('sales', 'month'), { today, timezone: 'Asia/Manila', wins, salesCurrency: '$' });
  assert.equal(sales.title, '2 sales this month for $150', 'a day is the person\'s, where they live');
  assert.match(sales.say, /^2 sales this month, 150 dollars\. 1 without an amount logged\.$/);
  const sentAt = ['2026-10-03T02:00:00Z', '2026-10-01T02:00:00Z', '2026-09-24T02:00:00Z'];
  const sent = akAnswer(ask('sent', 'week'), { today, timezone: 'UTC', sentAt, replies: ['2026-10-03T08:00:00Z'], metrics: { windowDays: 30, sent: 25, replies: 2 } });
  assert.equal(sent.title, '2 messages out in the last 7 days, 1 reply');
  const longer = akAnswer(ask('sent', 'lastmonth'), { today, timezone: 'UTC', sentAt, replies: [], metrics: { windowDays: 30, sent: 25, replies: 2 } });
  assert.match(longer.say, /reads back 14 days of sends here, so this is the last 30 days instead: 25 messages out, 2 replies/, 'days the rows do not reach are not passed off as the days asked about');
  assert.ok(longer.lines.includes('Not in September: the last 30 days.'));
  assert.ok(akAnswer(ask('sent', 'week'), { today, timezone: 'UTC', sentAt: [], unreadable: ['sent messages'] }).thin);
  const focus = akAnswer(ask('focus'), { today, timezone: 'UTC', focus: [{ id: 'f1', minutes: 90, on: '2026-10-03', note: null, at: '' }, { id: 'f2', minutes: 45, on: '2026-10-04', note: null, at: '' }, { id: 'f3', minutes: 60, on: '2026-09-20', note: null, at: '' }] });
  assert.equal(focus.say, '2.3 hours of deep work in the last 7 days, on 2 days.');
  assert.ok(akAnswer(ask('focus', 'lastmonth'), { today, timezone: 'UTC', focus: [] }).thin, 'deep work past the two weeks read back is said, not counted as none');

  /* 10. ask.ts's five, said from their own counts. */
  const answers = [{ id: 'replies' as const, q: 'Which segment actually replies?', headline: 'Pest control replies most: 2 of 9.', rows: [{ label: 'Pest control', value: '2 of 9', note: 'replied' }], thin: null }];
  assert.equal(akAnswer(ask('segments'), { today, timezone: 'UTC', answers }).say, 'Pest control replies most: 2 of 9.');
  assert.ok(akAnswer(ask('segments'), { today, timezone: 'UTC', answers: 'Server error 500' }).thin);

  /* 11. A model may say which question it was — never the answer, and never days nobody said. */
  assert.deepEqual(akNormalize({ id: 'spent', period: '30d', about: null }, { heard: 'am I doing ok on money in the past month' }), { id: 'spent', period: '30d', about: null, by: 'model' });
  assert.equal(akNormalize({ id: 'spent', period: 'week' }, { heard: 'am I doing ok on money lately' })?.period, null, 'a week the words never said is not taken');
  assert.equal(akNormalize({ id: 'none' }, { heard: 'should I raise my price' }), null);
  assert.equal(akNormalize({ id: 'advice', answer: 42 }, { heard: 'x' }), null, 'only a question on the list');
  assert.equal(akNormalize({ id: 'spent', about: 'shoes' }, { heard: 'what went on food lately' })?.about, null, 'about what was not said is dropped');
  assert.equal(akNormalize({ id: 'spent', about: 'groceries' }, { heard: 'what went on food lately', categories: { out: ['Groceries'], in: [] } })?.about, 'Groceries', 'or is one of their categories');
  const prompt = akPrompt('how am I doing', { today });
  for (const id of AK_IDS) assert.ok(prompt.includes(`"${id}"`), `the model is offered ${id}`);
  assert.ok(!/categories:/.test(prompt), 'no categories line without categories');
  assert.match(akLine(ask('goal'), today), /^Are you on track for your goal\?$/);
  assert.equal(akLine(ask('spent', 'week', 'coffee'), today), 'How much did you spend on coffee in the last 7 days?', 'the question as understood, written back');

  /* 12. The route only matches, and the mic only routes. */
  const src = (p: string) => readAskFile(new URL(`../../src/${p}`, import.meta.url), 'utf8');
  const route = src('app/api/copilot/asked/route.ts');
  assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(|logEvent|recordOutcome/.test(route), 'the model route writes nothing');
  assert.match(route, /normalizeAsked\(/);
  assert.match(route, /rateLimit\(`copilot:asked:/);
  const sheet = src('app/copilot/_components/AskSheet.tsx');
  assert.ok(!/post<[^>]*>\('\/(?!asked)/.test(sheet) && !/actions\.(log|record|addOutcome|lab|money)/.test(sheet), 'asking writes nothing');
  assert.match(sheet, /if \(aloud && canSpeak\(\)\) speech\.speak\(out\.say\)/, 'asked aloud, answered aloud — checked when speaking, not from first-render state');
  const shell = src('app/copilot/_components/v2/CopilotApp2.tsx');
  assert.match(shell, /if \(askedOutright\(heard\)\) return actions\.openSheet\(\{ kind: 'ask', heard \}\);/);
  assert.ok(shell.indexOf('askedOutright(heard)') < shell.indexOf('clearlyMoney(heard'), 'a question is answered before anything is read as money');

  console.log('copilot-core: ask-it checks passed');
}

askItSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── The mic: what was said, sorted into the record it belongs to ────────── */
//
// The checks are the ways the mic could put words in the person's mouth: a
// name, a quote or an amount nobody said, a day the model picked, a note
// rewritten into a model's view of the business, a sale filed as spending, a
// coffee sent on a round trip to a model, and a route that keeps anything
// before the person taps.

import {
  HEARD_MAX as TELL_HEARD_MAX, askedOutright as tellOutright, cleanHeard as tellClean, clearlyMoney as tellMoney, inWords as tellInWords, isQuestion as tellQuestion,
  normalizeTold as tellNormalize, occurredOn as tellOccurred, readByRules as tellRules, spokenFacts as tellFacts, tellPrompt, toldAs as tellAs,
  TOLD_KINDS as TELL_KINDS,
} from '../../src/lib/copilot/tell';
import { readFileSync as readTellFile } from 'node:fs';

async function tellSuite() {
  const today = '2026-10-06';
  const cats = { out: ['Food', 'Transport'], in: ['Salary'] };

  /* 1. A money move said like one goes straight to the book; anything it could be besides is sorted. */
  for (const said of ['coffee 130', 'grab 240 yesterday', 'salary came in 50,000', 'paid rent 12000', 'deposit 5000 to savings', 'load 100']) {
    assert.equal(tellMoney(said, today, cats), true, `"${said}" is money`);
  }
  assert.equal(tellMoney('Food 200', today, cats), true, 'one of their own categories, named');
  for (const said of ['Pia paid 150', 'pia paid me 150', 'sold 3 stickers to Joel for 450', 'raised my price to 200', 'Sent 20 messages today', 'Juan 500', 'how much did I spend 500', 'talked to Mara about 150']) {
    assert.equal(tellMoney(said, today, cats), false, `"${said}" is not filed as spending without a sort`);
  }

  /* 2. Asked, not told: the opening word decides, and a statement that opens like a plan is a statement. */
  for (const q of ['how is my bet going', 'did Pia pay', 'Is my runway ok?', 'what should I do next']) assert.equal(tellQuestion(q), true, q);
  for (const t of ['was at the market and sold three', 'have a call with Joel tomorrow', 'will call Mara tomorrow', 'coffee 130']) assert.equal(tellQuestion(t), false, t);
  for (const t of ['When I met Joel he said every clinic misses calls', 'what she wants is a quote', 'how we got Pia: she saw the post']) assert.equal(tellQuestion(t), false, `"${t}" tells`);
  assert.equal(tellQuestion('when did I last talk to Mara'), true, 'a question puts its verb before the person');
  assert.deepEqual(tellRules('When I met Joel he said every clinic misses calls', today)?.kind, 'talk', 'so the rules log it, rather than answer it');

  /* 2b. The Ask sheet's own list does not decide what is asked: a record names what a question does. */
  for (const said of [
    'Talked to Mara yesterday, she will introduce me to her cousin', 'Had a call with Pia, she wants to follow up next week',
    'Sent messages to five clinics today', 'I need to follow up with Joel', 'Spent the morning on deep work',
    'My balance is low this week', 'Runway is tight', 'Sold two to Pia', 'The trade fair was worth it, two leads', 'Talked to Mara',
  ]) assert.equal(tellOutright(said), false, `"${said}" is told, and sorted`);
  for (const said of ['how much did I spend this week', 'can I spend 500 today', 'who did I talk to this week', 'my balance', 'runway', 'Is my runway ok?', 'which segment replies']) {
    assert.equal(tellOutright(said), true, `"${said}" is asked, and answered at once`);
  }
  assert.equal(tellOutright('should I raise my price'), false, 'not on the list: the sort finds the question, and Ask says it cannot count it');
  assert.deepEqual(tellRules('should I raise my price', today), { kind: 'question' });

  /* 3. The rules, with no model: what they can tell, and nothing they cannot. */
  const talk = tellRules('Talked to Mara yesterday, she will introduce me to her cousin at Bright Smiles', today);
  assert.deepEqual(talk, { kind: 'talk', talk: { who: 'Mara', role: null, problem: null, commitment: null, said: null, on: '2026-10-05' } }, 'who and the day; who they were and how it ended are the person’s to pick');
  assert.deepEqual(tellRules('sold 3 stickers to Joel for 450', today), { kind: 'sale', sale: { who: 'Joel', amount: '450', currency: null, on: null } }, 'the price, not the count of stickers');
  assert.deepEqual(tellRules('Pia paid me 150 yesterday', today), { kind: 'sale', sale: { who: 'Pia', amount: '150', currency: null, on: '2026-10-05' } });
  assert.deepEqual(tellRules('booked a demo with Lakeview Resort for Thursday', today), { kind: 'meeting', sale: { who: 'Lakeview Resort', amount: null, currency: null, on: null } }, 'booked today: the Thursday it is for is not the day it counts');
  assert.deepEqual(tellRules('raised my price to 200', today), { kind: 'offer', offer: { price_band: '200' } });
  assert.deepEqual(tellRules('how is my bet going', today), { kind: 'question' });
  assert.deepEqual(tellRules('coffee 130', today), { kind: 'money' });
  assert.deepEqual(tellRules('Resorts go quiet in the rainy season', today), { kind: 'note', note: { content: 'Resorts go quiet in the rainy season' } });
  assert.deepEqual(tellRules('Sent 20 messages today', today), { kind: 'note', note: { content: 'Sent 20 messages today' } }, 'a number is not money by being one');
  assert.equal(tellRules('Juan 500', today), null, 'a figure with nothing to say what it is: the chooser asks');
  assert.equal(tellRules('', today), null);
  for (const k of TELL_KINDS) assert.equal(tellAs(k, 'Pia paid 150', today).kind, k, `the chooser can open ${k}`);

  /* 4. A model's sort, held to the words: what nobody said is dropped, and the day is the app's reading. */
  const heard = 'Talked to Mara yesterday, she said we lose two bookings a week, she will intro me to her cousin';
  assert.deepEqual(
    tellNormalize({ kind: 'talk', who: 'Mara', role: 'buyer', said: 'we lose two bookings a week', problem: 'yes', commitment: 'intro', on: '2026-09-01' }, { heard, today }),
    { kind: 'talk', talk: { who: 'Mara', role: 'buyer', said: 'we lose two bookings a week', problem: 'yes', commitment: 'intro', on: '2026-10-05' } },
    'their words kept; the day said, not the one the model gave',
  );
  assert.deepEqual(
    tellNormalize({ kind: 'talk', who: 'Maria Santos', role: 'investor', said: 'They love it', problem: 'maybe', commitment: 'a lot' }, { heard, today }),
    { kind: 'talk', talk: { who: null, role: null, said: null, problem: null, commitment: null, on: '2026-10-05' } },
    'a name and a quote nobody said are inventions; an answer that is not one is no answer',
  );
  // Who sells to the buyers does not have the problem: their "yes" would count
  // as one more business that does (lab.ts → asksProblem).
  const supplier = tellNormalize({ kind: 'talk', who: 'Mara', role: 'seller', problem: 'yes', commitment: 'intro' }, { heard, today });
  assert.ok(supplier?.kind === 'talk' && supplier.talk.role === 'seller' && supplier.talk.problem === null, 'a supplier is not asked the buyer’s question');
  assert.match(tellPrompt('talked to Mara', { today, weekday: 'Tuesday', offer: {} }), /"role" \(one of "buyer", "seller", "operator", "earner", "connector"/, 'the model is asked who they were, from the same five');
  assert.deepEqual(tellNormalize({ kind: 'sale', who: 'Pia', amount: 1500 }, { heard: 'Pia paid me 150 pesos yesterday', today }),
    { kind: 'sale', sale: { who: 'Pia', amount: '150', currency: 'PHP', on: '2026-10-05' } }, 'an amount not said gives way to the one that was');
  assert.deepEqual(tellNormalize({ kind: 'meeting', who: 'Joel', amount: 99 }, { heard: 'booked a call with Joel', today }),
    { kind: 'meeting', sale: { who: 'Joel', amount: null, currency: null, on: null } }, 'a meeting has no amount');
  assert.deepEqual(tellNormalize({ kind: 'offer', offer: { price_band: '₱200', sells: 'booking bots', for_who: 'dentists' } }, { heard: 'raised my price to 200 for dentists', today }),
    { kind: 'offer', offer: { price_band: '₱200', for_who: 'dentists' } }, 'a price held by its figures; what was not said about the offer is not changed');
  assert.equal(tellNormalize({ kind: 'offer', offer: { price_band: '₱250' } }, { heard: 'raised my price to 200', today }), null, 'a price nobody said changes nothing');
  assert.deepEqual(tellNormalize({ kind: 'note', note: 'Rainy season slows resort bookings by 40%' }, { heard: 'Resorts go quiet in the rainy season', today }),
    { kind: 'note', note: { content: 'Resorts go quiet in the rainy season' } }, 'a note is the person’s words, never a model’s version of them (invariant 12)');
  assert.deepEqual(tellNormalize({ kind: 'question' }, { heard: 'how is my bet going', today }), { kind: 'question' });
  assert.equal(tellNormalize({ kind: 'chat', reply: 'Great question!' }, { heard: 'hello', today }), null, 'a kind there is not is the rules’ to sort');
  assert.equal(tellNormalize('not json', { heard: 'hello', today }), null);

  /* 5. The words: compared as said, whole words only; cut where the reader stops. */
  assert.equal(tellInWords('dr. lim', 'Met Dr. Lim from Bright Smiles', 80), 'dr. lim');
  assert.equal(tellInWords('Mar', 'Talked to Mara', 80), null, 'part of a name is not a name');
  assert.equal(tellClean(`  ${'word '.repeat(300)}`).length, TELL_HEARD_MAX);
  assert.equal(tellFacts('talked to Mara on october 1st', today).on, '2026-10-01', 'a day said is read');
  assert.equal(tellFacts('talked to Mara on august 1st', today).on, null, 'past the month a conversation can be logged for');
  assert.deepEqual(tellFacts('talked to Mara tomorrow', today).on, null, 'a day not lived yet');

  /* 6. The prompt: the words, today, the offer, and every kind with what it is. */
  const prompt = tellPrompt('Pia paid 150', { today, weekday: 'Tuesday', offer: { sells: 'Booking automation', for_who: 'resorts', price_band: '$150' } });
  assert.ok(prompt.includes('"Pia paid 150"') && prompt.includes('Today is Tuesday 2026-10-06.') && prompt.includes('What they sell: Booking automation, for resorts, at $150.'));
  for (const k of TELL_KINDS) assert.ok(prompt.includes(`- "${k}":`), `the model is told what "${k}" is`);

  /* 7. A sale on the day it happened: today is now, a day said is kept at its noon, a day ahead or past the month is refused. */
  assert.deepEqual(tellOccurred(undefined, today), { ok: true, at: null });
  assert.deepEqual(tellOccurred(today, today), { ok: true, at: null });
  assert.deepEqual(tellOccurred('2026-10-05', today), { ok: true, at: '2026-10-05T12:00:00.000Z' });
  assert.deepEqual(tellOccurred('2026-10-07', today), { ok: false, error: 'That day has not happened yet.' });
  assert.deepEqual(tellOccurred('2026-09-05', today), { ok: false, error: 'Only the last 30 days can be logged.' });
  assert.deepEqual(tellOccurred('yesterday', today), { ok: false, error: 'That is not a day.' });

  /* 8. The route sorts and never keeps: nothing is written until the person taps on the sheet it opens. */
  const route = readTellFile(new URL('../../src/app/api/copilot/tell/route.ts', import.meta.url), 'utf8');
  assert.ok(!/insert|recordOutcome|addContextItem|saveOffer|setOffer|insertLabEvent/.test(route), 'a sort writes nothing');
  assert.ok(/normalizeTold\(/.test(route) && /readByRules\(/.test(route), 'a model’s sort is held to the words, and the rules sort what it cannot');
  const outcomes = readTellFile(new URL('../../src/app/api/copilot/outcomes/route.ts', import.meta.url), 'utf8');
  assert.ok(/occurredOn\(/.test(outcomes), 'a said day is checked before an outcome is kept on it');

  console.log('copilot-core: tell checks passed');
}

tellSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── Words shared in: the end of a chat as the start of a test ────────────── */
//
// The checks are the ways a share goes wrong: a reply read as a bank statement
// by the Money tab, a chat's sentence put in the person's mouth as their belief
// and handed to a model as their words, an app's title taken for what was said,
// a link cut in half or dropped, a "</script>" in a shared reply ending the page
// that keeps it, a share lost at the sign-in screen, a share that fails and says
// nothing, and a reply kept as context about the business.

import {
  SEED_CACHE, SEED_FRESH_MS, SEED_FROM, SEED_KEY, SEED_MAX, hostOf as seedHost, ideaOfSeed, keptOfSeed, plainLines, seedIsFresh, seedOf, seedPage,
} from '../../src/lib/copilot/seed';
import {
  IDEA_HOW_MAX as SD_HOW_MAX, IDEA_LABEL_MAX as SD_LABEL_MAX, SHARED_FROM as SD_SHARED_FROM, normalizeBet as sdNormBet, playForModel as sdPlayForModel,
} from '../../src/lib/copilot/lab';
import { assetDraftPrompt as sdAssetPrompt } from '../../src/lib/copilot/assets';
import { readFileSync as readShareFile } from 'node:fs';

async function shareSeedSuite() {
  const src = (p: string) => readShareFile(new URL(`../../${p}`, import.meta.url), 'utf8');

  /* 1. What a share is: words, a link or both. The link at the end is the share's own; one in the middle was said. */
  assert.deepEqual(seedOf({ text: 'Offer a free pilot to ten guesthouses', url: '' }), { text: 'Offer a free pilot to ten guesthouses', url: null, cut: false });
  assert.deepEqual(seedOf({ text: 'Try this: https://claude.ai/share/abc' }), { text: 'Try this', url: 'https://claude.ai/share/abc', cut: false }, 'apps put the link after the words');
  assert.deepEqual(seedOf({ text: 'https://claude.ai/share/abc' }), { text: '', url: 'https://claude.ai/share/abc', cut: false }, 'a link and no words is still a share');
  assert.deepEqual(seedOf({ text: 'Words\nhttps://x.com/a', url: 'https://x.com/a' }), { text: 'Words', url: 'https://x.com/a', cut: false }, 'the same link twice is one');
  assert.deepEqual(seedOf({ text: 'See https://x.com/a for the price, then offer it' }), { text: 'See https://x.com/a for the price, then offer it', url: null, cut: false }, 'a link in the middle is part of what was said');
  assert.equal(seedOf({ title: 'A title' })?.text, 'A title', 'a title is all there is without words');
  assert.equal(seedOf({ title: 'Claude', text: 'Words' })?.text, 'Words', 'and noise beside them');
  assert.equal(seedOf({}), null);
  assert.equal(seedOf(null), null);
  assert.equal(seedOf({ text: '   ', url: 'javascript:alert(1)' }), null, 'a javascript: link is never a link');
  assert.equal(seedOf({ text: 'Words', url: `https://x.com/${'a'.repeat(600)}` })?.url, null, 'half an address opens the wrong page, so it is none');
  const long = seedOf({ text: 'word '.repeat(2000) })!;
  assert.ok(long.cut && long.text.length <= SEED_MAX && long.text.endsWith('word'), 'cut at a word, and said');
  assert.deepEqual(plainLines('## Ideas\n- **Free** pilot\n1. `Ask` five\n\n[a chat](https://x.com/a) said so'), ['Ideas', 'Free pilot', 'Ask five', 'a chat said so'], 'formatting is not what was said');
  assert.deepEqual(plainLines('a *b* c and _d_.'), ['a b c and d.'], 'emphasis around a word goes');
  assert.deepEqual(plainLines('Cost is 2 * 3 * 4 dollars'), ['Cost is 2 * 3 * 4 dollars'], 'arithmetic is not italics');
  assert.deepEqual(seedOf({ text: 'Try this: https://x.com/a.' }), { text: 'Try this', url: 'https://x.com/a', cut: false }, 'the full stop after a link is the sentence’s, not the address’s');
  assert.deepEqual(seedOf({ text: 'Is it https://x.com/a, or not?' }), { text: 'Is it https://x.com/a, or not?', url: null, cut: false }, 'a link that is not last is part of what was said');
  // A title beside a link is the app's name for it, not words: taken as words it became the belief and the play.
  assert.deepEqual(seedOf({ title: 'Claude', text: '', url: 'https://claude.ai/chat/abc' }), { text: '', url: 'https://claude.ai/chat/abc', cut: false });
  // A link ending the words that is not the one the share named was said, and stays: cut out, it was lost.
  assert.deepEqual(seedOf({ text: 'Read this https://a.com/x', url: 'https://b.com/y' }), { text: 'Read this https://a.com/x', url: 'https://b.com/y', cut: false });
  assert.deepEqual(seedOf({ text: `Too long ${'https://x.com/'}${'a'.repeat(600)}` })?.url, null, 'an address too long to keep whole is left in the words, not cut');

  /* 2. The belief is theirs, always: nothing is filled in from a share. It once was, for a one-sentence share,
        and one tap later the chat's sentence and its numbers reached the ideas model as the owner's own words. */
  const one = (text: string) => seedOf({ text })!;
  const seedSrc = src('src/lib/copilot/seed.ts');
  assert.ok(!/export function beliefOfSeed/.test(seedSrc), 'there is no way to make a belief out of a share');
  assert.match(src('src/app/copilot/_components/v2/LabSheets.tsx'), /useState\(\(\) => \(shelved \? shelved\.belief : seed \? '' : suggestBelief\(/, 'a shared sheet opens with an empty belief, not the share and not a draft from the offer');
  // Kept while signed out, picked up after sign-in only while it is still the share somebody just made.
  const now = Date.parse('2026-10-06T10:00:00Z');
  assert.ok(seedIsFresh({ at: now - 60_000 }, now) && seedIsFresh({ at: now - SEED_FRESH_MS }, now));
  assert.ok(!seedIsFresh({ at: now - SEED_FRESH_MS - 1 }, now), 'past half an hour it is let go, not popped up');
  assert.ok(!seedIsFresh({}, now) && !seedIsFresh({ at: 'yesterday' }, now) && !seedIsFresh(null, now) && !seedIsFresh({ at: now + 60_000 }, now), 'no stamp, a bad one or one from the future is not fresh');

  /* 3. The words ride along as the play, held to what a play holds and said to be from elsewhere. */
  const idea = ideaOfSeed(one('Offer a free demo to ten guesthouses.\nThen ask who would pay.'))!;
  assert.deepEqual(idea, { label: 'Offer a free demo to ten guesthouses.', how: 'Offer a free demo to ten guesthouses. Then ask who would pay.', from: SEED_FROM });
  const wordy = ideaOfSeed(one('abc '.repeat(200)))!;
  assert.ok(wordy.how.length <= SD_HOW_MAX && /abc…$/.test(wordy.how) && wordy.label.length <= SD_LABEL_MAX, 'cut at a word and marked, never mid-word');
  assert.deepEqual(ideaOfSeed(seedOf({ text: 'https://www.claude.ai/share/abc' })!), { label: 'Idea from claude.ai', how: 'https://www.claude.ai/share/abc', from: SEED_FROM }, 'a link alone is the way back to the chat');
  assert.equal(ideaOfSeed({ text: '', url: null, cut: false }), null);
  assert.equal(seedHost('not a url'), 'a link');
  // The link back to the chat stays with the bet, after the words — what the sheet says it keeps is what it keeps.
  const linked = keptOfSeed(seedOf({ text: 'Offer a free pilot to ten guesthouses https://grok.com/share/xyz' })!);
  assert.deepEqual(linked, { idea: { label: 'Offer a free pilot to ten guesthouses', how: 'Offer a free pilot to ten guesthouses https://grok.com/share/xyz', from: SEED_FROM }, whole: true, link: true });
  const longLinked = keptOfSeed({ text: 'abc '.repeat(200).trim(), url: 'https://claude.ai/share/abc', cut: false });
  assert.ok(longLinked.idea!.how.length <= SD_HOW_MAX && longLinked.idea!.how.endsWith('… https://claude.ai/share/abc') && !longLinked.whole && longLinked.link, 'long words are cut to leave room for the link, and the sheet says only the first lines stay');
  const hugeLink = keptOfSeed({ text: 'Words', url: `https://x.com/${'a'.repeat(300)}`, cut: false });
  assert.ok(!hugeLink.link && hugeLink.idea!.how === 'Words', 'a link too long to keep beside the words is not kept, and the sheet says so');
  assert.equal(keptOfSeed({ ...one('Short'), cut: true }).whole, false, 'a share cut on the way in is not kept whole');
  // A bet from a share is an ordinary bet: the server keeps the play as it came, and the belief is what the person typed.
  const ctx = { today: '2026-10-06', price: 150, priceLabel: '$150' };
  const asBet = sdNormBet({ part: 'reach', belief: 'Guesthouses answer a free demo', metric: 'replied', target: 3, days: 7, idea }, ctx);
  assert.ok(asBet.ok && asBet.value.play === null && asBet.value.idea?.from === SEED_FROM && asBet.value.idea.how === idea.how && asBet.value.belief === 'Guesthouses answer a free demo');

  /* 4. The page that keeps a first share: the same cache the worker uses, and nothing in the words can end its script. */
  const hostile = { title: '', text: 'x</script><script>alert(1)</script>\u2028y\u2029z', url: '' };
  const page = seedPage(hostile);
  assert.equal(page.split('</script>').length - 1, 1, 'only the page’s own script end');
  assert.ok(page.includes('\\u003c/script>') && !page.includes('\u2028') && !page.includes('\u2029'), 'escaped, including the line separators');
  const kept = page.slice(page.indexOf('var p=') + 6, page.indexOf(';p.at=Date.now();'));
  assert.deepEqual(JSON.parse(kept), hostile, 'the words come out as they went in');
  assert.ok(page.includes(JSON.stringify(SEED_CACHE)) && page.includes(JSON.stringify(SEED_KEY)), 'the cache and key the page reads');
  assert.ok(page.includes('could not be kept') && page.includes('/copilot2?tab=proof&shared=text'), 'a failure to keep it is said on arrival');
  assert.ok(page.includes('p.at=Date.now();'), 'stamped, as the worker stamps its own');

  /* 5. The worker, the route and the screen agree, and none of them fails quietly. */
  const sw = src('public/sw.js');
  assert.notEqual(SEED_CACHE, 'copilot-share');
  assert.ok(sw.includes(`const SHARE_CACHE = 'copilot-share';`) && sw.includes(`const SHARE_TEXT_CACHE = '${SEED_CACHE}';`), 'words wait in a cache of their own: the Money tab reads every entry of the other as a statement');
  assert.ok(sw.includes(`const SHARE_PATH = '/copilot2/share';`) && sw.includes(`const SHARE_TEXT_KEY = SHARE_PATH + '/text';`) && SEED_KEY === '/copilot2/share/text', 'the worker keeps them where the page looks');
  assert.match(sw, /if \(!files\.length\) \{[\s\S]*?return to\('shared=text', 'proof'\)/, 'a file wins: words are for shares with none');
  assert.match(sw, /if \(words\) return to\('shared=text&why='/, 'a share that could not be kept says why where the person lands');
  assert.match(sw, /const said = \{ at: Date\.now\(\) \};/, 'stamped, so a share kept while signed out is only picked up while fresh');
  const route = src('src/app/copilot2/share/route.ts');
  // Signed out, nothing is read: a body nobody is signed in to send is not held in memory to be refused after.
  const signedOut = route.indexOf("if (!(await currentProfileId())) return back(req, { shared: 'error', why: 'Sign in, then share it again.' });");
  assert.ok(signedOut > 0 && signedOut < route.indexOf('req.formData()'), 'the session is checked before the body is read');
  assert.match(route, /if \(!file && seedOf\(said\)\) return new Response\(seedPage\(said\)/);
  const onboarding = src('src/app/copilot/_components/Onboarding.tsx');
  assert.match(onboarding, /if \(shared === 'text'\) setArrived\(/, 'the sign-in screen says what happened to a share made while signed out');
  assert.match(onboarding, /else if \(shared === 'error' && q\.get\('why'\)\) setArrived\(q\.get\('why'\)\);/);
  assert.match(onboarding, /\{arrived && <p className="cp-note" role="status">\{arrived\}<\/p>\}/);
  const hook = src('src/app/copilot/_components/useCopilot.ts');
  assert.match(hook, /if \(shared === 'text'\) void takeText\(params\.get\('why'\)\);\s*else if \(shared \|\| params\.get\('add'\)\)/, 'a text share never becomes the Money tab’s arrival');
  assert.match(hook, /else void takeText\(null, true\);/, 'the first open after sign-in picks up what was shared while signed out');
  assert.match(hook, /if \(tookText\.current\) return;/, 'read once, though development runs an effect twice');
  assert.match(hook, /else if \(!fresh\) say\('Nothing came through that share\.'\);/, 'an ordinary open with nothing waiting says nothing');
  const reader = src('src/app/copilot/_components/sharedSeed.ts');
  assert.match(reader, /await cache\.delete\(SEED_KEY\)/, 'spent on the first read');
  assert.match(reader, /if \(quiet && !seedIsFresh\(raw, Date\.now\(\)\)\) return \{ seed: null, error: null \};/, 'a stale share is let go on an ordinary open');
  assert.match(reader, /error: quiet && !found \? null : `That share could not be read:/, 'once something was found, failing to read it is said all the same');
  assert.ok(!/catch \{\s*\}/.test(reader) && (reader.match(/error: /g) ?? []).length >= 4, 'every way it fails is a sentence');
  const sheet = src('src/app/copilot/_components/v2/LabSheets.tsx');
  assert.match(sheet, /const \[sharedPart\] = useState<LinkKey \| null>\(\(\) => \(seed && !asked && !shelved && !experiment \? derive\(home\)\.proof\.chain\.weak : null\)\);/, 'derive() reads the whole home, so once — not on every keystroke');
  assert.match(src('src/app/copilot/_components/SheetContent.tsx'), /seed=\{sheet\.seed\}/);
  const manifest = src('src/app/copilot2/manifest.webmanifest/route.ts');
  assert.ok(/title: 'title'/.test(manifest) && /text: 'text'/.test(manifest) && /url: 'url'/.test(manifest), 'Copilot is in the share sheet for words, not only for files');

  /* 6. A shared reply is never context about the business (invariants 2 and 12): nothing a model reads imports it,
        and a play that came in as one is never named to a model — not to the ideas writer, not to an asset draft. */
  for (const f of ['src/lib/copilot/store.ts', 'src/lib/copilot/working.ts', 'src/lib/copilot/proofai.ts', 'src/lib/copilot/ideas.ts', 'src/lib/copilot/mcpread.ts']) {
    assert.ok(!/from '\.\/seed'/.test(src(f)), `${f} does not read a share`);
  }
  assert.equal(SEED_FROM, SD_SHARED_FROM);
  const sharedPlay = { play: null, idea: { label: 'Charge $99 a month', how: 'Charge $99 a month to ten guesthouses', from: SEED_FROM } };
  assert.equal(sdPlayForModel(sharedPlay), null, 'a shared play is not named to a model');
  assert.equal(sdPlayForModel({ play: null, idea: { label: 'Free demo', how: 'Offer a demo.', from: 'AI, from your record' } }), 'Free demo');
  assert.equal(sdPlayForModel({ play: 'guarantee', idea: null }), 'A guarantee, and the price up front', 'a book’s play is named as the book names it');
  const proofaiSrc = src('src/lib/copilot/proofai.ts');
  assert.match(proofaiSrc, /bet: bet \? \{ belief: bet\.bet\.belief, line: passLine\(bet\.bet, bet\.last\), play: playForModel\(bet\.bet\) \} : null,/, 'an asset draft is never told a shared play');
  assert.ok(!/playOf\(/.test(proofaiSrc), 'nothing in the model calls names a play any other way');
  // And what an asset draft is not told, its check does not allow: the $99 is not a number the person gave.
  const draftPrompt = sdAssetPrompt({ kind: 'script', offer: { sells: 'Booking automation', price_band: '$150' }, foundBy: 'outreach', working: null, bet: { belief: 'Guesthouses answer', line: '3 replies by 13 Oct', play: sdPlayForModel(sharedPlay) }, part: null, previous: null, ask: null, heard: [] });
  assert.ok(!/\$99/.test(draftPrompt), 'the shared play’s figure never reaches the draft');

  console.log('copilot-core: shared words checks passed');
}

shareSeedSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── A bet's first reading ───────────────────────────────────────────────── */
//
// The checks are the ways a reading could mislead: a second verdict that
// disagrees with the first, a send from before the bet counted toward it, a
// one-dollar payment read as a sale at the price, a ladder with sends in it for
// a shop whose buyers walk in, a rung for a count nobody kept, and a card that
// shows the plan twice.

import {
  LAB_BET as RD_BET, LAB_METRICS as RD_METRICS, LAB_STOP as RD_STOP,
  betView as rdBetView, labHome as rdLabHome, readingOf as rdReadingOf,
  type Bet as RdBet, type DayRows as RdRows, type LabEventRow as RdEvent,
} from '../../src/lib/copilot/lab';
import { readingLine as rdLine, rungsOf as rdRungs } from '../../src/lib/copilot/reading';
import { readFileSync as readReadingFile } from 'node:fs';

async function betReadingSuite() {
  const bet = (b: Partial<RdBet> & Pick<RdBet, 'metric' | 'target' | 'days' | 'start'>): RdBet => ({
    id: 'b', part: 'pay', belief: 'Staycation & resorts pay $150', play: null, idea: null, unit: null, tries: null, price: 150, priceLabel: '$150', experiment: null, openedAt: `${b.start}T01:00:00Z`, ...b,
  });
  const src = (p: string) => readReadingFile(new URL(`../../${p}`, import.meta.url), 'utf8');

  /* 1. The funnel since the bet began: both ends of the window, nothing from before, a dollar is a payment and not a sale at the price. */
  const rows: RdRows = {
    sends: ['2026-10-04', '2026-10-05', '2026-10-05', '2026-10-06'],
    outcomes: [
      { kind: 'reply', day: '2026-10-04', opportunity: 'old', amount: null },
      { kind: 'reply', day: '2026-10-06', opportunity: 'o1', amount: null },
      { kind: 'meeting', day: '2026-10-06', opportunity: 'o1', amount: null },
      { kind: 'won', day: '2026-10-06', opportunity: 'o2', amount: 1 },
      { kind: 'won', day: '2026-10-06', opportunity: 'o3', amount: 1 },
    ],
    finished: [], talks: [],
  };
  const day2 = bet({ metric: 'paid_at_price', target: 2, days: 14, start: '2026-10-05' });
  const reading = rdReadingOf(day2, '2026-10-06', rows);
  assert.deepEqual(reading, { sent: 3, replied: 1, meetings: 1, paid: 2, paid_at_price: 0, talks: 0, committed: 0, handed: 0, logged: 0 }, 'a send and a reply from the day before do not count');
  assert.deepEqual(Object.keys(reading).sort(), [...RD_METRICS].sort(), 'every count there is, so a card can pick its ladder');

  /* 2. Never a second verdict: for the count a bet is decided on, the reading is the result, in every state — and the verdict is untouched.
        Only the running bet carries a reading (nothing shows another); readingOf, read to the day a bet ended, is what it would have been. */
  const ev = (id: number, event_type: string, created_at: string, payload: Record<string, unknown>): RdEvent => ({ id, event_type, created_at, payload });
  const opened = ev(1, RD_BET, '2026-10-05T01:00:00Z', {
    part: 'pay', belief: 'Staycation & resorts pay $150', metric: 'paid_at_price', target: 2, days: 14, start: '2026-10-05', price: 150, priceLabel: '$150',
    tries: { metric: 'sent', planned: 20 },
  });
  const sends = ['2026-10-04T10:00:00Z', '2026-10-05T10:00:00Z', '2026-10-06T10:00:00Z', '2026-10-08T10:00:00Z', '2026-10-20T10:00:00Z'];
  const outcome = (kind: string, at: string, opportunity: string, amount: number | null = null) => ({ kind, opportunity_id: opportunity, occurred_at: at, amount });
  const outcomes = [
    outcome('reply', '2026-10-06T11:00:00Z', 'o1'), outcome('meeting', '2026-10-06T12:00:00Z', 'o1'),
    outcome('won', '2026-10-07T09:00:00Z', 'o2', 150), outcome('won', '2026-10-07T10:00:00Z', 'o3', 150), outcome('won', '2026-10-08T10:00:00Z', 'o4', 150),
    outcome('won', '2026-10-06T13:00:00Z', 'o5', 1),
  ];
  const labAt = (today: string, events: RdEvent[]) => rdLabHome({ events, unreadable: null, timezone: 'UTC', today, sends, outcomes, finished: [] });
  // The same bet with a line the rows never reach, so it runs out its days instead of passing on the 7th.
  const unlucky = { ...opened, payload: { ...(opened.payload as object), target: 9 } };
  const scenarios: Array<[string, string, RdEvent[], string]> = [
    ['running', '2026-10-06', [opened], 'running'],
    ['passed', '2026-10-09', [opened], 'passed'],
    ['called off', '2026-10-09', [opened, ev(2, RD_STOP, '2026-10-06T20:00:00Z', { bet: '1', note: 'No' })], 'stopped'],
    ['failed', '2026-10-30', [unlucky], 'failed'],
  ];
  const dayRows: RdRows = {
    sends: sends.map((s) => s.slice(0, 10)),
    outcomes: outcomes.map((o) => ({ kind: o.kind, day: o.occurred_at.slice(0, 10), opportunity: o.opportunity_id, amount: o.amount })),
    finished: [], talks: [], tallies: [],
  };
  for (const [name, today, events, state] of scenarios) {
    const v = labAt(today, events).bets[0];
    assert.equal(v.state, state, `${name}: the state is the rows’`);
    assert.equal(!!v.reading, state === 'running', `${name}: a reading only on the bet it is shown for`);
    const reading = v.reading ?? rdReadingOf(v.bet, v.ended!, dayRows);
    assert.equal(reading[v.bet.metric], v.result, `${name}: the reading and the verdict count the same rows`);
    assert.equal(reading[v.bet.tries!.metric], v.tries, `${name}: and the plan the same`);
    const direct = rdBetView(v.bet, v.state === 'stopped' ? '2026-10-06' : null, dayRows, today);
    assert.deepEqual({ state: v.state, result: v.result, tries: v.tries, ended: v.ended, day: v.day, last: v.last }, { state: direct.state, result: direct.result, tries: direct.tries, ended: direct.ended, day: direct.day, last: direct.last }, `${name}: the reading did not touch the verdict`);
  }
  const passed = labAt('2026-10-09', [opened]).bets[0];
  assert.equal(passed.ended, '2026-10-07');
  assert.equal(rdReadingOf(passed.bet, passed.ended!, dayRows).sent, 2, 'a passed bet is read to the day it passed: the send on the 8th is the next bet’s');
  const failed = labAt('2026-10-30', [unlucky]).bets[0];
  assert.equal(rdReadingOf(failed.bet, failed.ended!, dayRows).sent, 3, 'a failed one to its last day, the 18th: the send on the 20th is not its, nor the one before it began');
  // Running, it is read to today and no further: past the last day is a different bet's.
  assert.equal(labAt('2026-10-06', [opened]).bets[0].reading!.sent, 2, 'sends from the day it began to today');

  /* 3. The ladder: the funnel up to the line, in order, marked where it has got to — and the dollar tests are payments, not sales. */
  const view = (b: RdBet, r: Partial<Record<(typeof RD_METRICS)[number], number>>) => ({ bet: b, reading: r });
  const rungs = rdRungs(view(day2, reading), 'outreach');
  assert.deepEqual(rungs.map((r) => [r.metric, r.n, r.words, r.state]), [
    ['sent', 3, 'messages sent', 'done'], ['replied', 1, 'reply', 'done'], ['meetings', 1, 'meeting', 'done'], ['paid', 2, 'payments', 'done'], ['paid_at_price', 0, 'sales at your $150', 'next'],
  ], '2 payments and no sale at $150: the price finding, said by the card');
  // The card wraps short labels in a row rather than breaking a long one: grammar for its number, and the full words kept for a sentence.
  assert.deepEqual(rungs.map((r) => r.label), ['sent', 'reply', 'meeting', 'paid', 'at $150']);
  assert.deepEqual(rdRungs(view(day2, { ...reading, replied: 3, meetings: 0 }), 'outreach').map((r) => r.label), ['sent', 'replies', 'meetings', 'paid', 'at $150']);
  assert.equal(rdRungs(view({ ...day2, priceLabel: null }, reading), 'outreach')[4].label, 'at your price', 'no price, no figure invented for one');
  for (const r of rungs) assert.ok(r.label.length <= 9 + 'at your price'.length && !/\n/.test(r.label), `${r.metric}: a label is a word or two`);
  assert.deepEqual(rungs.map((r) => [r.line, r.target]), [[false, null], [false, null], [false, null], [false, null], [true, 2]], 'the line is marked, with what it has to reach');
  assert.equal(rdLine(view(day2, reading), 'outreach'), 'Counted since 5 Oct: 3 messages sent, 1 reply, 1 meeting, 2 payments, 0 sales at your $150.');
  assert.deepEqual(rdRungs(view(day2, reading), 'local').map((r) => r.metric), ['meetings', 'paid', 'paid_at_price'], 'no sends for a shop whose buyers walk in');
  assert.deepEqual(rdRungs(view(day2, reading), null).map((r) => r.metric), ['sent', 'replied', 'meetings', 'paid', 'paid_at_price'], 'unsaid, the app counts outreach once it has found or sent anything');
  assert.deepEqual(rdRungs(view(bet({ metric: 'committed', target: 3, days: 7, start: '2026-10-05' }), { talks: 4, committed: 1 }), 'outreach').map((r) => [r.metric, r.n]), [['talks', 4], ['committed', 1]]);
  for (const m of ['sent', 'handed', 'logged'] as const) {
    assert.equal(rdRungs(view(bet({ metric: m, target: 3, days: 7, start: '2026-10-05', unit: m === 'logged' ? 'sign-ups' : null }), { sent: 1, handed: 1, logged: 1 }), 'outreach').length, 1, `${m} has nothing before it: one rung is no ladder`);
  }
  assert.deepEqual(rdRungs(view(day2, { sent: 0, replied: 0, meetings: 0, paid: 0, paid_at_price: 0 }), 'outreach').map((r) => r.state), ['next', 'later', 'later', 'later', 'later'], 'nothing yet: the next step is the first one');
  assert.deepEqual(rdRungs(view(day2, { sent: 5, replied: 0, meetings: 1, paid: 0, paid_at_price: 0 }), 'outreach').map((r) => r.state), ['done', 'next', 'done', 'later', 'later'], 'a meeting logged by hand is still counted, and the gap before it is the one named');
  // What it takes is a rung too: in the funnel already, or ahead of it where the funnel has no room.
  assert.equal(rdRungs(view({ ...day2, tries: { metric: 'sent', planned: 20 } }, reading), 'outreach')[0].planned, 20);
  const talky = rdRungs(view({ ...day2, tries: { metric: 'talks', planned: 5 } }, { ...reading, talks: 2 }), 'outreach');
  assert.deepEqual([talky[0].metric, talky[0].planned, talky[0].n], ['talks', 5, 2]);
  assert.deepEqual(rdRungs({ bet: day2 }, 'outreach'), [], 'a payload from before readings shows the card it always did');
  assert.equal(rdLine({ bet: day2 }, 'outreach'), null);

  /* 4. On the screen, and to Claude: the plan once, the reading only while it can still be read. */
  const tab = src('src/app/copilot/_components/v2/ProofTab.tsx');
  assert.match(tab, /\{rungs\.length > 1 && <Reading view=\{view\} rungs=\{rungs\} found=\{found\} \/>\}/);
  assert.match(tab, /b\.tries && view\.tries != null && !planInRungs/, 'the old plan bar goes only where the ladder holds the plan');
  const conn = src('src/app/api/copilot/mcp/read.ts');
  assert.match(conn, /reading: v\.state === 'running' \? readingLine\(v, found\) : null/);
  const proofDoc = (b: Record<string, unknown>) => mrProof({
    today: '2026-10-06', verdict: { title: 'Not proven yet', line: '0 of 3.' }, links: [], weak: null, checkpoint: { due: false, last: null }, history: [],
    bets: [{ belief: 'They pay', part: 'What they pay', state: 'running', result: '0 of 2 sales at your $150', pass: '2 sales at your $150 by 18 Oct', start: '2026-10-05', ended: null, day: 2, days: 14, note: null, play: null, ...b }],
  } as Parameters<typeof mrProof>[0]);
  assert.match(proofDoc({ reading: 'Counted since 5 Oct: 3 messages sent, 1 reply.' }), /It passes at 2 sales at your \$150 by 18 Oct\. Counted since 5 Oct: 3 messages sent, 1 reply\./);
  assert.ok(!/Counted since/.test(proofDoc({})), 'a bet with no reading says what it always said');

  console.log('copilot-core: bet reading checks passed');
}

betReadingSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── The shelf: tests kept for later ──────────────────────────────────────── */
//
// The checks are the ways a shelf becomes a graveyard or a liar: an idea kept
// with no line, a score or a market size riding in on an entry, a test that
// cannot become the bet it was kept as, one that stays on the shelf after it
// started, a shelf that grows without end, a write to a shelf nobody could read,
// and a model told to suggest what is already written down.

import {
  LAB_BET as SH_BET, LAB_EVENTS as SH_EVENTS, LAB_SHELF as SH_SHELF, LAB_SHELF_GONE as SH_GONE, LAB_TALK as SH_TALK, SHELF_MAX,
  countRefusal, labFromEvents as shLedger, labHome as shHome, labView as shView, normalizeBet as shNormBet, normalizeShelf, shelfFromEvents, shelfRefusal,
  type LabEventRow as ShRow, type ShelfEntry as ShEntry,
} from '../../src/lib/copilot/lab';
import { ideaSources as shSources, ideasPrompt as shIdeasPrompt } from '../../src/lib/copilot/ideas';
import { readFileSync as readShelfFile } from 'node:fs';

async function shelfSuite() {
  const src = (p: string) => readShelfFile(new URL(`../../${p}`, import.meta.url), 'utf8');
  const ctx = { today: '2026-10-06', price: 150, priceLabel: '$150' };
  const test = { part: 'pay', belief: 'Staycation & resorts pay $150 for booking automation', metric: 'paid_at_price', target: 2, days: 14, tries: { metric: 'sent', planned: 20 } };

  /* 1. No test, no entry: the shelf is held to what starting a bet is held to — the same function, less the day and price that belong to the day it starts. */
  const kept = normalizeShelf({ ...test, score: 9, marketSize: '$2B', start: '2020-01-01', price: 1, experiment: 'plan-x' }, ctx);
  assert.ok(kept.ok);
  assert.deepEqual(Object.keys(kept.ok ? kept.value : {}).sort(), ['belief', 'days', 'idea', 'metric', 'part', 'play', 'target', 'tries', 'unit'], 'no score, no market size, no start, no price: a field it does not know is dropped');
  const refusals: Array<Record<string, unknown>> = [
    { ...test, belief: '   ' }, { ...test, part: 'everything' }, { ...test, metric: 'vibes' }, { ...test, target: 0 }, { ...test, days: 0 },
    { ...test, tries: { metric: 'paid', planned: 10 } }, { ...test, metric: 'logged', unit: '' }, { part: 'pay' },
  ];
  for (const raw of refusals) {
    const a = normalizeShelf(raw, ctx);
    const b = shNormBet(raw, ctx);
    assert.ok(!a.ok && !b.ok && a.error === b.error, `a test with no line is refused with what a bet says: ${a.ok ? 'kept' : a.error}`);
  }
  const noPrice = normalizeShelf(test, { today: ctx.today, price: null, priceLabel: null });
  assert.ok(!noPrice.ok && noPrice.error === 'Say what it costs first: a sale at your price needs a price.', 'a sale at a price nobody named is refused here too');

  /* 2. Not a backlog: ten, and not the same test twice — the same part, belief, count and play, not merely the same sentence. */
  type Key = Pick<ShEntry, 'part' | 'belief' | 'metric' | 'play' | 'idea'>;
  const k = (o: Partial<Key>): Key => ({ part: 'pay', belief: 'They pay', metric: 'paid_at_price', play: null, idea: null, ...o });
  const held = (n: number) => Array.from({ length: n }, (_, i) => k({ belief: `Belief ${i}` }));
  assert.equal(shelfRefusal(held(SHELF_MAX - 1), k({ belief: 'A new one' })), null);
  assert.equal(shelfRefusal(held(SHELF_MAX), k({ belief: 'A new one' })), `The shelf holds ${SHELF_MAX}. Start one, or take one off, to keep another.`);
  assert.equal(shelfRefusal(held(SHELF_MAX), k({ belief: 'Belief 3' })), 'That is already on your shelf.', 'on a full shelf, a test already on it is said as that — not as a slot to free first');
  assert.equal(shelfRefusal([k({ belief: 'They  pay $150' })], k({ belief: ' they pay $150 ' })), 'That is already on your shelf.', 'case and spacing are not a second test');
  assert.equal(shelfRefusal([k({})], k({ part: 'reach' })), null, 'the same words about another part are another test');
  // Every play and idea on a part opens the sheet with the same suggested belief: two different plays kept as they came are two tests.
  const demo = { label: 'Free demo', how: 'Offer a free demo.', from: 'AI, from your record' };
  const calls = { label: 'Cold call five', how: 'Call five owners.', from: 'AI, from your record' };
  assert.equal(shelfRefusal([k({ idea: demo, metric: 'replied' })], k({ idea: calls, metric: 'meetings' })), null, 'two ideas, one suggested belief');
  assert.equal(shelfRefusal([k({ play: 'guarantee' })], k({ play: 'paid-48h' })), null, 'two plays, one suggested belief');
  assert.equal(shelfRefusal([k({ idea: demo })], k({ idea: { ...demo, label: ' FREE  demo ' } })), 'That is already on your shelf.', 'the same idea twice is still one');
  assert.equal(shelfRefusal([k({ metric: 'replied' })], k({ metric: 'meetings' })), null, 'the same belief judged on another count is another test');

  // A count the business cannot keep is refused wherever a test is written, not only hidden in the sheet.
  assert.equal(countRefusal('replied', null, 'outreach'), null);
  assert.equal(countRefusal('replied', null, null), null, 'unsaid, every count is open');
  assert.equal(countRefusal('replied', null, 'local'), 'The app cannot count replies for a business whose buyers do not come through its sends. Pick a count you log.');
  assert.match(countRefusal('meetings', { metric: 'sent' }, 'inbound') ?? '', /cannot count messages sent/, 'nor a plan counted in sends');
  assert.equal(countRefusal('paid', { metric: 'talks' }, 'local'), null);

  /* 3. What was stored, read back: newest first, and an entry leaves by being started or taken off — neither is undone. */
  const ev = (id: number, event_type: string, created_at: string, payload: Record<string, unknown>): ShRow => ({ id, event_type, created_at, payload });
  const entry = (id: number, belief: string, extra: Record<string, unknown> = {}) => ev(id, SH_SHELF, `2026-10-0${id}T09:00:00Z`, { ...test, belief, ...extra });
  const rows = [
    entry(1, 'First'), entry(2, 'Second'), entry(3, 'Third', { play: 'not-a-play' }),
    ev(4, SH_SHELF, '2026-10-04T09:00:00Z', { ...test, belief: '' }),
    ev(5, SH_SHELF, '2026-10-05T09:00:00Z', { ...test, belief: 'No line', target: 0 }),
    ev(6, SH_GONE, '2026-10-06T09:00:00Z', { entry: '2' }),
    ev(7, SH_BET, '2026-10-06T10:00:00Z', { ...test, start: '2026-10-06', belief: 'Third', price: 150, priceLabel: '$150', shelf: '3' }),
  ];
  const ledger = shLedger(rows);
  assert.deepEqual(ledger.shelf.map((e) => e.belief), ['First'], 'one taken off, one started, two that did not hold together: only the first is left');
  assert.equal(ledger.bets[0].shelf, '3', 'the bet names the entry it came from');
  assert.equal(shLedger([...rows, entry(8, 'Fourth')].map((r) => ({ ...r, created_at: r.id === 8 ? '2026-10-08T09:00:00Z' : r.created_at }))).shelf.map((e) => e.belief).join(','), 'Fourth,First', 'newest first');
  assert.ok(!('start' in ledger.shelf[0]) && !('price' in ledger.shelf[0]), 'what only starting decides is not on an entry');
  const many = shLedger(Array.from({ length: SHELF_MAX + 5 }, (_, i) => ev(100 + i, SH_SHELF, `2026-09-${String(10 + i).padStart(2, '0')}T09:00:00Z`, { ...test, belief: `Belief ${i}` })));
  assert.equal(many.shelf.length, SHELF_MAX, 'what the screen and the payload carry has an end');
  assert.equal(many.shelf[0].belief, `Belief ${SHELF_MAX + 4}`);
  assert.ok(SH_EVENTS.includes(SH_SHELF) && SH_EVENTS.includes(SH_GONE), 'the store reads both, or a shelf would vanish on reload');
  const home = shHome({ events: rows, unreadable: null, timezone: 'UTC', today: '2026-10-06', sends: [], outcomes: [], finished: [] });
  assert.deepEqual(home.shelf?.map((e) => e.belief), ['First']);
  assert.deepEqual(shView(home, { runwayMonths: null, links: [], today: '2026-10-06' }).shelf.map((e) => e.belief), ['First']);
  assert.deepEqual(shView(undefined, { runwayMonths: null, links: [], today: '2026-10-06' }).shelf, [], 'a server without the shelf has an empty one');
  // Read from rows of its own: a hundred newer counts in the general window do not push a waiting test out of view.
  const counts = Array.from({ length: 120 }, (_, i) => ev(1000 + i, SH_TALK, `2026-10-06T1${i % 10}:00:00Z`, { on: '2026-10-06', commitment: 'none' }));
  const windowed = shHome({ events: counts, shelfEvents: rows, unreadable: null, timezone: 'UTC', today: '2026-10-06', sends: [], outcomes: [], finished: [] });
  assert.deepEqual(windowed.shelf?.map((e) => e.belief), ['First'], 'the shelf comes from its own rows when they are given');
  // A window of the newest rows can only lose an entry: its start or take-off is newer than its keeping, so it is in any window the keeping is in.
  for (let n = 1; n <= rows.length; n++) {
    const newest = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, n);
    const shown = shelfFromEvents(newest).map((e) => e.belief);
    assert.ok(shown.every((b) => b === 'First'), `a window of the newest ${n} never brings back the one taken off or the one started`);
  }

  /* 4. A kept test can become the bet it was kept as, as it stands — the point of keeping it whole. */
  const draft = normalizeShelf({ ...test, metric: 'logged', unit: 'Enquiries', tries: null, idea: { label: 'Free demo', how: 'Offer a free demo to ten guesthouses.', from: 'AI, from your record' } }, ctx);
  assert.ok(draft.ok);
  const back = shLedger([ev(1, SH_SHELF, '2026-10-01T09:00:00Z', draft.ok ? { ...draft.value } : {})]).shelf[0];
  const asBet = shNormBet({ ...back }, ctx);
  assert.ok(asBet.ok && asBet.value.belief === test.belief && asBet.value.metric === 'logged' && asBet.value.unit === 'enquiries' && asBet.value.idea?.from === 'AI, from your record' && asBet.value.target === 2 && asBet.value.days === 14);

  /* 5. A model is told what is already written down, in the person's own words, and a number in them is theirs. */
  const bare = { offer: { sells: 'Booking automation' }, working: null, links: [], bets: [], talks: { n: 0, problem: 0, committed: 0 }, assets: [] };
  const withShelf = shIdeasPrompt({ ...bare, part: 'pay', foundBy: 'outreach', shelf: [{ belief: 'Guesthouses answer when I write', play: 'Free demo' }, { belief: 'They pay', play: null }] });
  assert.ok(/do not suggest these again:\n- "Guesthouses answer when I write" \(the play: Free demo\)\n- "They pay"\n/.test(withShelf), 'the play is named, so a suggested belief kept twice still says which ideas are kept');
  assert.ok(!/shelf/.test(shIdeasPrompt({ ...bare, part: 'pay', foundBy: 'outreach' })), 'no shelf, no line about one');
  const sources = shSources({ ...bare, part: 'pay', foundBy: 'outreach', shelf: [{ belief: 'I charge $150', play: 'Charge $99 up front' }] });
  assert.ok(sources.includes('I charge $150') && !sources.some((x) => x.includes('$99')), 'a belief is the person’s; a play’s name is not, and its number is not theirs');
  assert.match(src('src/lib/copilot/proofai.ts'), /shelf: \(home\.lab\?\.shelf \?\? \[\]\)\.map\(\(e\) => \(\{ belief: e\.belief, play: playForModel\(e\) \}\)\)/, 'a play kept from a share is never named to the model');

  /* 6. Claude reads the shelf, marked as tests not started, with where each play came from. */
  const proof = (shelf?: Array<{ belief: string; part: string; line: string; from: string | null }>) => mrProof({
    today: '2026-10-06', verdict: { title: 'Not proven yet', line: '0 of 3.' }, links: [], weak: null, bets: [], checkpoint: { due: false, last: null }, history: [], shelf,
  } as Parameters<typeof mrProof>[0]);
  const doc = proof([{ belief: 'Guesthouses answer a free demo', part: 'They hear', line: '3 replies within 1 week', from: 'Free demo (AI, from your record)' }]);
  assert.match(doc, /## On the shelf: tests kept for later, not started\n- "Guesthouses answer a free demo" — on they hear\. The test: 3 replies within 1 week\. The play: Free demo \(AI, from your record\)\./);
  assert.ok(doc.indexOf('On the shelf') < doc.indexOf('Pivot or persevere'));
  assert.ok(!/On the shelf/.test(proof()) && !/On the shelf/.test(proof([])), 'a record with no shelf reads as it always did');

  /* 7. The route and the screen: guarded where a write could lie, and said when it did. */
  const route = src('src/app/api/copilot/lab/route.ts');
  assert.match(route, /case 'shelve': \{[\s\S]*?if \(home\.lab\?\.unreadable\) return fail\([\s\S]*?normalizeShelf\(obj\(b\.bet\)[\s\S]*?shelfRefusal\(home\.lab\?\.shelf \?\? \[\], v\.value\)/, 'refused when the shelf cannot be read, held to a bet’s rules, capped');
  assert.match(route, /case 'unshelve': \{[\s\S]*?if \(home\.lab\?\.unreadable\) return fail\([\s\S]*?if \(!home\.lab\?\.shelf\?\.some\(\(e\) => e\.id === id\)\) return fail\([\s\S]*?LAB_SHELF_GONE/, 'only what is on the shelf can be taken off, and a read that failed says so rather than "not on your shelf"');
  assert.equal((route.match(/countRefusal\(v\.value\.metric, v\.value\.tries, foundOf\(home\)\.value\)/g) ?? []).length, 2, 'a count the business cannot keep is refused on open and on keep alike');
  const store = src('src/lib/copilot/store.ts');
  assert.match(store, /read\(\[LAB_SHELF, LAB_SHELF_GONE, LAB_BET\], SHELF_EVENT_LIMIT\)/, 'the shelf has a window of its own');
  assert.match(store, /shelfEvents: labEvents\.shelfRows,/);
  assert.match(route, /if \(shelf && !home\.lab\?\.shelf\?\.some\(\(e\) => e\.id === shelf\)\) return fail\('That test is no longer on your shelf\.'\);/, 'a bet cannot name a test nobody kept');
  assert.match(route, /LAB_BET, \{ \.\.\.v\.value, shelf, /, 'and the bet names the one it came from, which is how the entry leaves');
  const iface = src('src/lib/copilot/lab.ts').match(/export interface ShelfEntry \{[\s\S]*?\n\}/)![0];
  assert.ok(!/score|market|viab|rank/i.test(iface), 'a kept idea is a test with a line: nothing in it estimates its worth');
  const tab = src('src/app/copilot/_components/v2/ProofTab.tsx');
  assert.match(tab, /<Shelf home=\{home\} d=\{d\} actions=\{actions\} \/>\s*<PickABet/, 'with no bet running, the person’s own tests come before the generic ones');
  assert.match(tab, /\{!running && <button className="cp-btn sm primary" disabled=\{busy === e\.id\} onClick=\{\(\) => actions\.openSheet\(\{ kind: 'bet', shelf: e\.id \}\)\}>Start it<\/button>\}/, 'Start is offered only when the slot is free, and not while that row is being taken off');
  // While a bet runs the picker is not shown and Start is not offered, so the shelf is the only way into the sheet — and that is when ideas arrive.
  assert.match(tab, /if \(!shelf\.length && !running\) return null;/, 'nothing to show, and nothing running: no card');
  assert.match(tab, /if \(!shelf\.length\) return <div className="cp2-shelf-solo">\{keep\}<\/div>;/, 'an empty shelf under a running bet is only the way to fill it');
  assert.match(tab, /\{running && keep\}/);
  assert.match(tab, /'Keep another idea for later' : 'Keep an idea for later'/);
  const sheet = src('src/app/copilot/_components/v2/LabSheets.tsx');
  assert.match(sheet, /\{!experiment && !shelfId && \(/, 'the plan’s experiment and a kept test are already waiting somewhere');
  // The entry as it was when the sheet opened: taken off meanwhile, Start still names it and the server says it is gone.
  assert.match(sheet, /const \[shelved\] = useState\(\(\) => \(shelfId \? home\.lab\?\.shelf\?\.find\(\(e\) => e\.id === shelfId\) \?\? null : null\)\);/);
  assert.match(sheet, /shelf: shelfId \?\? null/);
  assert.match(sheet, /const keptCountOff = !!shelved && !!countRefusal\(shelved\.metric, shelved\.tries, found\);/, 'a kept count the business can no longer keep reopens the pickers');
  assert.match(sheet, /const fixed = keptCountOff \? null : play \?\? idea;/);
  assert.match(src('src/app/copilot/_components/useCopilot.ts'), /shelve: 'Kept on your shelf\. Nothing counts until you start it\.'/);
  assert.match(src('src/app/copilot/_components/useCopilot.ts'), /'talk', 'shelf'\]/, 'two kept tests are two sheets, not the first one’s state');

  console.log('copilot-core: shelf checks passed');
}

shelfSuite().catch((e) => { console.error(e); process.exit(1); });

// A shared file waits for a tap: while the worker is active any page can post to the share target, and a file
// imported on arrival was a way for a web page to write rows into the book.
async function sharedFileConfirmSuite() {
  const { readFileSync } = await import('node:fs');
  const money = readFileSync('src/app/copilot/_components/v2/MoneyTab.tsx', 'utf8');
  assert.equal((money.match(/uploadStatement\(/g) ?? []).length, 1, 'the one upload is the one behind the button');
  assert.match(money, /for \(const f of held\) await actions\.uploadStatement\(f\);/);
  assert.match(money, /else setHeld\(got\.files\);\s*return;/, 'arrival holds the files and reads none of them');
  assert.match(money, /onRead=\{\(\) => void readHeld\(\)\} onDiscard=\{\(\) => void discardHeld\(\)\}/);
  // Left in the cache until the person decides, so a reload before the tap says something rather than losing it.
  const peek = money.slice(money.indexOf('async function peekShared'), money.indexOf('async function spendShared'));
  assert.ok(!/cache\.delete/.test(peek), 'looking at a shared file does not spend it');
  assert.match(money, /await spendShared\(\);\s*setHeld\(null\); setReading\(false\);/);
  console.log('copilot-core: shared file confirm checks passed');
}

sharedFileConfirmSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── Proof, honest about what it counts ──────────────────────────────────── */
//
// The live account, read through the connector on 7 Oct, showed four ways the
// chain told a founder more than its rows held: a new offer judged by the old
// one's sales, a bet opened read back as progress, six meetings called six
// conversations, and one tap opening the same bet twice.

import {
  PIVOT_REACH as pfReach, businessChain as pfChain, chainChanges as pfChanges, evidenceState as pfEvidence, restartsOf as pfRestarts,
  snapshotChain as pfSnapshot, triedWords as pfTried, type ChainInput as PfInput,
} from '../../src/lib/copilot/business';
import { erasOf as pfErasOf, pivotWords as pfPivotWords } from '../../src/lib/copilot/proof';
import { eraCounts as pfEraCounts } from '../../src/lib/copilot/era';
import { checkpointView as pfCheckpoint, gradeWords as pfGradeWords, isOpenNonce as pfNonce, openRace as pfRace } from '../../src/lib/copilot/lab';
import { FOUND_BY as pfFoundBy } from '../../src/lib/copilot/types';
import { FOUND_BY_PHRASE as pfPhrase } from '../../src/lib/copilot/offer';
import { goalOutlook as pfOutlook } from '../../src/lib/copilot/outlook';

async function proofHonestSuite() {
  const { readFileSync } = await import('node:fs');
  const src = (p: string) => readFileSync(p, 'utf8');
  // The account on 7 Oct: the app it sells now, found online, and September's two $1 tests and six meetings from selling to trades.
  const founder: PfInput = {
    offer: { sells: 'Founder OS Copilot App', for_who: "People who want a business but don't know how to start", problem: 'Not knowing what to do that moves the needle', price_band: '$29/month' },
    said: {}, segments: [], area: 'Manila', web: false,
    funnel: { matched: 116, sent: 27, replied: 2, meetings: 6, won: 2, outside: 0 },
    worthAMessage: 0, bySegment: [], byChannel: [{ channel: 'whatsapp', sent: 27 }],
    wins: [1, 1], queue: 0, wonRecent: { amount: 1, days: 30 },
    goal: { title: 'Save Exit PH [NOV]', target: 1500, current: 0 }, currency: '$', workerConnected: true, agents: [], topOpening: null,
    foundBy: 'inbound', talks: { n: 0, problem: 0, committed: 0 },
    bets: [{ part: 'who', state: 'running', start: '2026-10-07', line: '0 of 3 commitments', when: null, result: 0 }],
  };
  const parts = (i: PfInput) => Object.fromEntries(pfChain(i).links.map((l) => [l.key, l]));

  /* 1. Before: the new offer judged on the old one's rows — the screen the owner saw. */
  const was = parts(founder);
  assert.equal(was.pay.state, 'stuck');
  assert.equal(was.pay.why, '6 meetings and 2 paid, none at your $29. From 5 on, that says more about the price or the proof than about luck.',
    'six meetings are six meetings: no logged conversation is summed into "6 conversations"');
  assert.equal(was.close.why, '2 won so far. At 3 it stops being luck.');
  assert.equal(pfTried(0, 6), '6 meetings');
  assert.equal(pfTried(2, 6), '2 conversations and 6 meetings');
  assert.equal(pfTried(1, 0), '1 conversation');
  assert.equal(pfTried(0, 0), '0 conversations');

  /* 2. A pivot restarts the part it changed and every part measured after it; delivery only on its own. */
  assert.deepEqual(pfReach.who, ['who', 'reach', 'close', 'pay']);
  assert.deepEqual(pfReach.pay, ['pay']);
  assert.deepEqual(pfReach.deliver, ['deliver']);
  const cp = (on: string, decision: 'pivot' | 'persevere', part: 'who' | 'reach' | 'close' | 'pay' | 'deliver' | null) => ({ id: on, on, decision, part, note: null, chain: {}, at: `${on}T10:00:00Z` });
  assert.deepEqual(pfRestarts([cp('2026-10-07', 'pivot', 'who')]), {
    who: { on: '2026-10-07', pivot: 'who' }, reach: { on: '2026-10-07', pivot: 'who' }, close: { on: '2026-10-07', pivot: 'who' }, pay: { on: '2026-10-07', pivot: 'who' },
  });
  // A later pivot on the price restarts the price alone; persevere restarts nothing.
  const two = pfRestarts([cp('2026-10-21', 'pivot', 'pay'), cp('2026-10-14', 'persevere', null), cp('2026-10-07', 'pivot', 'who')]);
  assert.deepEqual([two.who?.on, two.close?.on, two.pay?.on, two.pay?.pivot, two.deliver], ['2026-10-07', '2026-10-07', '2026-10-21', 'pay', undefined]);
  // On one day, a part's own pivot names it.
  assert.equal(pfRestarts([cp('2026-10-07', 'pivot', 'who'), cp('2026-10-07', 'pivot', 'pay')]).pay?.pivot, 'pay');
  assert.equal(pfPivotWords('who'), 'Who buys, how they hear, how they say yes and what they pay');
  assert.equal(pfPivotWords('deliver'), 'How you deliver');

  /* 3. After the pivot: judged on what came after it, with what came before said and not counted. */
  const zero = { funnel: { sent: 0, replied: 0, meetings: 0, won: 0, outside: 0 }, bySegment: [], byChannel: [], wins: [], talks: { n: 0, problem: 0, committed: 0 } };
  const era = (part: 'who' | 'reach' | 'close' | 'pay') => ({ ...zero, since: '2026-10-07', pivot: 'who' as const, ...(part ? {} : {}) });
  const after: PfInput = { ...founder, eras: { who: era('who'), reach: era('reach'), close: era('close'), pay: era('pay') } };
  const now = parts(after);
  assert.deepEqual(pfChain(after).links.map((l) => l.state), ['testing', 'untested', 'untested', 'untested', 'missing']);
  assert.equal(now.pay.facts, 'Nothing paid yet');
  assert.equal(now.pay.since, 'Counted since 7 Oct, when you pivoted who buys.');
  assert.equal(now.pay.before, 'Before 7 Oct: 6 meetings · 2 paid, at $1 each. Not counted here, and kept in History.');
  assert.equal(now.pay.more[0], now.pay.before, 'said first when the part is open');
  assert.equal(now.close.before, 'Before 7 Oct: 6 meetings · 2 paid, at $1 each. Not counted here, and kept in History.');
  assert.equal(now.reach.before, 'Before 7 Oct: 27 messages sent · 2 replies. Not counted here, and kept in History.');
  assert.equal(now.deliver.since, undefined, 'delivery was not pivoted');
  assert.deepEqual(pfChain(after).verdict, { proven: false, title: 'Not proven yet', line: 'Proven at 3 paid at your $29. So far: 0.', since: 'Counted since 7 Oct, when you pivoted who buys.' });
  // A sale at the new price after the pivot counts, and the old ones still do not.
  const sold = parts({ ...after, wins: [1, 1, 29], funnel: { ...after.funnel, won: 3 }, eras: { ...after.eras, pay: { ...era('pay'), funnel: { ...zero.funnel, won: 1 }, wins: [29] } } });
  assert.equal(sold.pay.facts, '1 paid, $29 — all at your $29 or more');
  assert.equal(sold.pay.before, 'Before 7 Oct: 6 meetings · 2 paid, at $1 each. Not counted here, and kept in History.');
  // Bets from before the pivot are not the new business's evidence either.
  const oldBet = { part: 'reach' as const, state: 'passed' as const, start: '2026-09-20', line: '5 of 5 enquiries', when: '25 Sep', result: 5 };
  assert.equal(parts({ ...after, bets: [oldBet] }).reach.state, 'untested');
  assert.match(parts({ ...after, bets: [oldBet] }).reach.before ?? '', /1 bet\./);
  assert.equal(parts({ ...founder, bets: [oldBet] }).reach.state, 'works', 'with no pivot, every bet still counts — and the $1 sales with it');
  // No pivot, no change: the chain reads exactly as it did.
  assert.deepEqual(pfChain(founder).links.map((l) => [l.state, l.why]), pfChain({ ...founder, eras: undefined }).links.map((l) => [l.state, l.why]));
  assert.equal(pfChain(founder).verdict.since, undefined);

  /* 4. The counts are the funnel's own, from the person's day on, and a payload without them reads as before. */
  const rows = {
    opportunities: [{ id: 'o1', status: 'won', source: 'maps', source_kind: 'business', data: {}, reason: null, title: 'A & D Plumbing' }],
    executions: [
      { approval_state: 'sent' as const, channel: 'whatsapp' as const, opportunity_id: 'o1', sent_at: '2026-09-01T02:00:00Z' },
      // 01:30 on 7 Oct in Manila: on the pivot's day there, though it is the 6th in UTC.
      { approval_state: 'sent' as const, channel: 'whatsapp' as const, opportunity_id: null, sent_at: '2026-10-06T17:30:00Z' },
      { approval_state: 'sent' as const, channel: 'whatsapp' as const, opportunity_id: null, sent_at: null },
    ],
    outcomes: [
      { kind: 'won' as const, opportunity_id: 'o1', occurred_at: '2026-09-12T03:00:00Z', amount: 1 },
      // A reply after the pivot to a message the app sent before it is still the app's send, not one logged outside.
      { kind: 'reply' as const, opportunity_id: 'o1', occurred_at: '2026-10-08T03:00:00Z', amount: null },
      { kind: 'won' as const, opportunity_id: null, occurred_at: '2026-10-08T05:00:00Z', amount: 29 },
    ],
  } as unknown as Parameters<typeof pfEraCounts>[0];
  const counted = pfEraCounts(rows, '2026-10-07', 'Asia/Manila', founder.offer);
  assert.deepEqual(counted.funnel, { sent: 1, replied: 1, meetings: 0, won: 1, outside: 0 });
  assert.deepEqual(counted.wins, [29]);
  assert.equal(pfEraCounts(rows, '2026-10-07', 'UTC', founder.offer).funnel.sent, 0, 'the same send is the 6th in UTC');
  const lab = (eras?: Record<string, unknown>) => ({ lab: { bets: [], talks: [{ id: 't1', on: '2026-10-08', who: null, role: 'buyer', problem: 'yes', commitment: 'time', said: null, via: null, at: '' }, { id: 't0', on: '2026-10-01', who: null, role: 'buyer', problem: 'yes', commitment: 'none', said: null, via: null, at: '' }], checkpoints: [cp('2026-10-07', 'pivot', 'who')], unreadable: null, eras } }) as unknown as Parameters<typeof pfErasOf>[0];
  const fromPayload = pfErasOf(lab({ '2026-10-07': counted }));
  assert.deepEqual(Object.keys(fromPayload ?? {}), ['who', 'reach', 'close', 'pay']);
  assert.deepEqual(fromPayload?.who?.talks, { n: 1, problem: 1, committed: 1 }, 'only the conversations since the pivot');
  assert.equal(pfErasOf(lab(undefined)), undefined, 'a payload cached before the server counted reads all time, never as empty');
  const store = src('src/lib/copilot/store.ts');
  assert.match(store, /const pivotDays = Object\.values\(restartsOf\(lab\.checkpoints\)\)\.map\(\(r\) => r!\.on\);\s*if \(pivotDays\.length\) lab\.eras = erasFor\(pivotDays, diagRows,/, 'counted where the rows are, from the rows the funnel counts');

  /* 5. A bet opened is a test begun, not progress. */
  const bare = now.who;
  assert.equal(bare.state, 'testing');
  assert.equal(bare.bare, true);
  assert.equal(bare.why, 'A bet on it is running. Nothing counted yet.');
  assert.equal(pfEvidence(bare), 'untested');
  const counting = parts({ ...after, bets: [{ ...founder.bets![0], line: '1 of 3 commitments', result: 1 }] }).who;
  assert.deepEqual([counting.bare, pfEvidence(counting)], [undefined, 'testing'], 'one commitment counted is something');
  assert.equal(parts({ ...after, eras: { ...after.eras, who: { ...era('who'), talks: { n: 1, problem: 1, committed: 0 } } } }).who.bare, undefined, 'a conversation logged is something');
  // Called off before it counted anything: said as what it was.
  assert.equal(parts({ ...after, bets: [{ ...founder.bets![0], state: 'stopped', when: '7 Oct' }] }).who.why, 'The last bet on it was called off: 0 of 3 commitments.');
  // "Since you last looked": a device that saw Untested is told nothing when a bet opens, and something when it counts.
  const saw = { at: '2026-10-07T01:00:00Z', states: { who: 'untested' as const } };
  assert.deepEqual(pfChanges(saw, pfChain(after).links), []);
  assert.deepEqual(pfChanges(saw, pfChain({ ...after, bets: [{ ...founder.bets![0], line: '1 of 3 commitments', result: 1 }] }).links).map((c) => [c.key, c.from, c.to]), [['who', 'untested', 'testing']]);
  // A snapshot from before `bare` kept the label: not news either way.
  assert.deepEqual(pfChanges({ at: saw.at, states: { who: 'testing' } }, pfChain(after).links), []);
  assert.equal(pfSnapshot('2026-10-07T02:00:00Z', pfChain(after).links).states.who, 'untested', 'kept as evidence');
  // The checkpoint's read-back: the owner's "Who buys has moved forward since" over an empty log.
  const links = pfChain(after).links;
  const pivotBack = (who: 'untested' | 'testing') => pfCheckpoint({ checkpoints: [{ ...cp('2026-10-07', 'pivot', 'who'), chain: { who } }], bets: [], links, today: '2026-10-07' }).grade;
  assert.equal(pivotBack('untested'), 'same');
  assert.equal(pfGradeWords({ decision: 'pivot', part: 'who' }, pivotBack('untested')), 'Who buys has not moved since.');
  assert.equal(pivotBack('testing'), 'same', 'a checkpoint from before `bare` kept the label: not read as a slip');
  const realLinks = pfChain({ ...after, eras: { ...after.eras, who: { ...era('who'), talks: { n: 2, problem: 2, committed: 1 } } } }).links;
  assert.equal(pfCheckpoint({ checkpoints: [{ ...cp('2026-10-07', 'pivot', 'who'), chain: { who: 'untested' } }], bets: [], links: realLinks, today: '2026-10-10' }).grade, 'better', 'two conversations logged is a step');
  const tab = src('src/app/copilot/_components/v2/ProofTab.tsx');
  assert.match(tab, /chain: Object\.fromEntries\(links\.map\(\(l\) => \[l\.key, evidenceState\(l\)\]\)\)/, 'the checkpoint keeps the chain as evidence');
  const sheets = src('src/app/copilot/_components/v2/ProofSheets.tsx');
  assert.match(sheets, /chain: Object\.fromEntries\(links\.map\(\(l\) => \[l\.key, evidenceState\(l\)\]\)\)/, 'and so does a pivot made from the chain');
  assert.match(src('src/app/copilot/_components/SheetContent.tsx'), /case 'pivot': return <PivotSheet home=\{home\} actions=\{actions\} \/>;/);
  assert.match(sheets, /actions\.openSheet\(\{ kind: 'pivot' \}\)/, 'a pivot does not wait for the checkpoint to come due');

  /* 6. "How buyers find you" in a sentence, never the label spliced in. */
  for (const f of pfFoundBy) assert.ok(!/^(they|you)\b/i.test(pfPhrase[f]) || f === 'outreach', `${f}: "buyers ${pfPhrase[f]}" has no second subject`);
  assert.equal(`Sends and replies are left out: buyers ${pfPhrase.inbound}, not through what the app sends.`, 'Sends and replies are left out: buyers find you online, not through what the app sends.');
  const labSheets = src('src/app/copilot/_components/v2/LabSheets.tsx');
  assert.match(labSheets, /buyers \{FOUND_BY_PHRASE\[found\]\}, not through what the app sends\./);
  assert.ok(!/buyers find you \{FOUND_BY_LABEL/.test(labSheets), 'the stutter is gone');

  /* 7. One tap, one bet. The second of two that raced is withdrawn; a retry of the same tap is answered as the tap was. */
  assert.ok(pfNonce('6b0f3c1e-2a4d-4c8e-9f10-123456789abc') && !pfNonce('x') && !pfNonce('a b c d e f g h') && !pfNonce(7));
  const v = (id: string, state: 'running' | 'stopped' | 'passed', openedAt: string, nonce: string | null = null) => ({ state, bet: { id, openedAt, nonce } });
  assert.equal(pfRace([v('10', 'running', '2026-10-07T09:00:00Z')], '10'), null, 'alone: kept');
  assert.deepEqual(pfRace([v('11', 'running', '2026-10-07T09:00:01Z', 'n-aaaaaaaa'), v('10', 'running', '2026-10-07T09:00:00Z', 'n-aaaaaaaa')], '11'), { first: '10', same: true }, 'the same tap twice: the second answers as the first');
  assert.deepEqual(pfRace([v('11', 'running', '2026-10-07T09:00:01Z', 'n-bbbbbbbb'), v('10', 'running', '2026-10-07T09:00:00Z', 'n-aaaaaaaa')], '11'), { first: '10', same: false }, 'two taps: the second is refused');
  assert.equal(pfRace([v('11', 'running', '2026-10-07T09:00:01Z'), v('10', 'running', '2026-10-07T09:00:00Z')], '10'), null, 'the first written stays');
  assert.deepEqual(pfRace([v('11', 'running', '2026-10-07T09:00:00Z'), v('10', 'running', '2026-10-07T09:00:00Z')], '11'), { first: '10', same: false }, 'one instant: the table’s order decides');
  assert.equal(pfRace([v('11', 'running', '2026-10-07T09:00:01Z'), v('10', 'passed', '2026-10-07T09:00:00Z'), v('9', 'stopped', '2026-10-07T08:59:00Z')], '11'), null, 'a bet that passed or was called off freed the slot');
  const route = src('src/app/api/copilot/lab/route.ts');
  assert.match(route, /if \(nonce && home\.lab\?\.bets\.some\(\(x\) => x\.bet\.nonce === nonce\)\) return json\(\{ ok: true, home \}\);/, 'a retry of a tap that opened its bet is not refused');
  assert.match(route, /const id = await insertLabEvent\(auth\.pid, LAB_BET,[\s\S]*?const race = after\?\.lab && !after\.lab\.unreadable \? openRace\(after\.lab\.bets, id\) : null;\s*if \(race\) \{\s*await withdrawLabBet\(auth\.pid, id\);/, 'the write is read back, and the second withdrawn');
  assert.match(labSheets, /if \(starting\.current\) return;\s*starting\.current = true;/, 'a second tap before the render does nothing');
  assert.match(labSheets, /action: 'open',\s*nonce,/);

  /* 8. A goal is not walked back to sends for a business whose buyers do not come through them. */
  const exit = { id: 'g1', title: 'Save Exit PH [NOV]', metric: 'currency' as const, unit: '$', target_value: 1500, current_value: 0, horizon_days: 62, created_at: '2026-10-07T01:00:00Z' };
  const base = { today: '2026-10-07', price: 29, selling: true, currency: '$', capacity: 'moderate' as const, funnel: { windowDays: 30, sent: 27, won: 1, wonAmount: 1 } };
  assert.match(pfOutlook(exit, base).line, /sends at what yours have earned/, 'nobody said: as it always read');
  const online = pfOutlook(exit, { ...base, viaSends: false });
  assert.ok(!/send/.test(online.line), online.line);
  assert.equal(online.line, '52 sales at your $29 in 62 days: about $169 a week. You were paid $1 in the last 30 days, about $0 a week.');
  assert.equal(online.verdict, 'off_track');
  assert.match(pfOutlook(exit, { ...base, viaSends: true }).line, /sends at what yours have earned/, 'outreach walks the chain from sends, as before');

  console.log('copilot-core: proof honest checks passed');
}

proofHonestSuite().catch((e) => { console.error(e); process.exit(1); });

/* ─── Projects: a day that has passed, and the bet's own slot ─────────────── */
//
// On 7 Oct the owner's Proof said "3 waiting on you": two questions about
// guesthouses in Manila for 5 Oct, and one breakage. The two held two of the
// three slots, so "Hand part of this bet over" was greyed out for the bet's
// whole fortnight by errands whose night had already gone.

import {
  MAX_ACTIVE_COMMISSIONS as pdMax, datesNamed as pdDates, lapsedOn as pdLapsed, roomForProject as pdRoom, roomToStart as pdStart, takesASlot as pdSlot,
} from '../../src/lib/copilot/commission';
import { waitingOnYou as pdWaiting } from '../../src/lib/copilot/business';
import { needsYou as pdNeeds } from '../../src/lib/copilot/today';
import { agentRoster as pdRoster } from '../../src/lib/copilot/machine';

async function projectsDaySuite() {
  const { readFileSync } = await import('node:fs');
  const src = (p: string) => readFileSync(p, 'utf8');
  const today = '2026-10-07';

  /* 1. The days a project's own words name. */
  assert.deepEqual(pdDates('List the three cheapest guesthouses in Manila for Oct 5 with links', '2026-09-28'), ['2026-10-05']);
  assert.deepEqual(pdDates('List short-stay rooms in Manila available from Oct 5, cheapest first', '2026-09-28'), ['2026-10-05'], '", cheapest" is not a year');
  assert.deepEqual(pdDates('Which year should I use for October 5: 2025 or 2026?', '2026-09-28'), ['2026-10-05'], 'a year only when it is attached');
  assert.deepEqual(pdDates('Book it for the 5th of October 2025', '2026-09-28'), ['2025-10-05']);
  assert.deepEqual(pdDates('Flights from Oct 5 to Oct 9', '2026-09-28'), ['2026-10-05', '2026-10-09']);
  assert.deepEqual(pdDates('Check in 2026-10-05', '2026-09-28'), ['2026-10-05']);
  assert.deepEqual(pdDates('Find a venue for 12 Jan', '2026-09-28'), ['2027-01-12'], 'the next one after it was written');
  assert.deepEqual(pdDates('Plan for Oct 5', '2026-10-06'), ['2027-10-05'], 'written after this year’s: it meant next year’s');
  assert.deepEqual(pdDates('Step by step plan to exit Philippines', '2026-09-15'), []);
  assert.deepEqual(pdDates('Feb 30 or 2026-02-30', '2026-01-01'), [], 'a day that does not exist is not read as one');

  /* 2. Lapsed: only waiting on the person, only once the last day named has gone. */
  const c = (objective: string, status: 'draft' | 'active' | 'blocked' | 'done' | 'stopped', id = objective) => ({ id, objective, status, created_at: '2026-09-28T03:00:00Z' });
  const guesthouses = c('List the three cheapest guesthouses in Manila for Oct 5 with links', 'blocked', 'g');
  const rooms = c('List short-stay rooms in Manila available from Oct 5, cheapest first', 'blocked', 'r');
  const exit = c('Step by step plan to exit Philippines', 'blocked', 'x');
  assert.equal(pdLapsed(guesthouses, today), '2026-10-05');
  assert.equal(pdLapsed(guesthouses, '2026-10-05'), null, 'on the day itself it is still the day');
  assert.equal(pdLapsed({ ...guesthouses, status: 'draft' }, today), '2026-10-05', 'a draft nobody approved lapses too');
  assert.equal(pdLapsed({ ...guesthouses, status: 'active' }, today), null, 'running work is never lapsed: the worker is not waiting on anyone');
  assert.equal(pdLapsed({ ...guesthouses, status: 'done' }, today), null);
  assert.equal(pdLapsed(c('Flights from Oct 5 to Oct 9', 'blocked'), today), null, 'the latest day named is the one that has to pass');
  assert.equal(pdLapsed(exit, today), null, 'no day named, nothing inferred');
  assert.deepEqual([pdSlot(guesthouses, today), pdSlot(exit, today), pdSlot({ ...exit, status: 'done' }, today)], [false, true, false]);

  /* 3. The three slots, counted as the server counts them. */
  const errands = [guesthouses, rooms, exit];
  assert.equal(pdRoom(errands, today), true, 'two of three are past their day: room for one more');
  const three = [exit, c('Pricing check', 'active', 'p'), c('Client onboarding', 'draft', 'o')];
  assert.equal(pdRoom(three, today), false, `${pdMax} on the go is the cap`);
  assert.equal(pdRoom(three, today, []), true, 'the running bet keeps a slot of its own');
  assert.equal(pdRoom([...three, c('Interview questions', 'active', 'b1')], today, ['b1']), false, 'one at a time for the bet');
  assert.equal(pdRoom([...three, c('Interview questions', 'done', 'b1')], today, ['b1']), true, 'a finished one frees it');
  // Starting: the draft for the bet starts past three running; a draft that is not the bet's does not.
  const running3 = [c('a', 'active', 'a'), c('b', 'active', 'b'), c('c', 'blocked', 'c'), c('Interview questions', 'draft', 'b1')];
  assert.equal(pdStart(running3, 'b1', today), false);
  assert.equal(pdStart(running3, 'b1', today, ['b1']), true);
  assert.equal(pdStart([...running3, c('Find groups', 'active', 'b0')], 'b1', today, ['b0', 'b1']), false, 'the bet’s slot is already running');
  assert.equal(pdStart([c('a', 'active', 'a'), c('b', 'active', 'b'), guesthouses, c('d', 'draft', 'd')], 'd', today), true, 'a lapsed question is not running work');

  /* 4. Not waiting on you, not on the Path, not the Researcher's — said on its card instead. */
  const tg = threadV2({ id: 'g', objective: guesthouses.objective, status: 'blocked', created_at: guesthouses.created_at }, [{ kind: 'needs_you', summary: 'Which of these three should I use for the next booking step?' }]);
  const tr = threadV2({ id: 'r', objective: rooms.objective, status: 'blocked', created_at: rooms.created_at }, [{ kind: 'needs_you', summary: 'Which year should I use for October 5: 2025 or 2026?' }]);
  const tx = threadV2({ id: 'x', status: 'blocked' }, [{ kind: 'failed', summary: 'Email cannot be sent' }]);
  assert.equal(pdWaiting([tg, tr, tx]), 3, 'without a day, as before');
  assert.equal(pdWaiting([tg, tr, tx], today), 1, 'the owner’s "3 waiting on you" was one');
  const asks = pdNeeds({ commissions: [tg, tr, tx], capture: null, queue: { count: 0, oldestDays: 0 }, queueIsCall: false, noOffer: false, today });
  assert.deepEqual(asks.map((a) => a.key), ['f:x']);
  assert.equal(pdNeeds({ commissions: [tg, tr, tx], capture: null, queue: { count: 0, oldestDays: 0 }, queueIsCall: false, noOffer: false }).length, 3);
  const roster = (t?: string) => pdRoster({
    now: new Date('2026-10-07T01:00:00Z'), today: t, supplyLastRun: null, sourced: 0, hasTargeting: false, matchesLeft: 10, sources: [], finds: 0, offerEmpty: false, queueCount: 0, drafted: 0,
    workerConnected: true, commissions: [tg, tr, threadV2({ id: 'y', status: 'active' })], lastCronRun: null, lastRun: null, jobsRan: null, broke: [],
  } as Parameters<typeof pdRoster>[0]).find((a) => a.key === 'researcher')!;
  assert.equal(roster(today).line, '1 project running');
  assert.equal(roster(undefined).line, '3 projects running · 2 waiting on you');
  const card = src('src/app/copilot/_components/v2/ProjectCard.tsx');
  assert.match(card, /const lapsed = today \? lapsedOn\(c, today\) : null;/);
  assert.match(card, /It was for \{dayWords\(lapsed\)\}, which has passed/);
  assert.match(card, /actions\.commissionAction\(c\.id, 'stop'\)/, 'Stop on the card: inferred, never acted on for them');
  assert.match(src('src/app/copilot/_components/v2/ProofSheets.tsx'), /<Project key=\{t\.commission\.id\} thread=\{t\} actions=\{actions\} today=\{home\.recent\.today\} \/>/);

  /* 5. The bet's own project is the bet's: checked on the record, tied by the server, approved into its slot. */
  const create = src('src/app/api/copilot/commissions/route.ts');
  assert.match(create, /const running = home\?\.lab\?\.bets\.find\(\(x\) => x\.state === 'running' && x\.bet\.id === b\.bet\);\s*if \(!running\) return fail\('That bet is not running\.'\);/, 'a slot only for the bet that runs');
  assert.match(create, /forBet: bet\?\.linked,/);
  assert.match(create, /insertLabEvent\(auth\.pid, LAB_LINK, \{ bet: bet\.id, commission: commission\.id \}\)/, 'tied in the same request');
  assert.match(src('src/app/api/copilot/commissions/[id]/route.ts'), /approveCommission\(auth\.pid, id, \{ today: before\?\.recent\.today, forBet: bet \? before\?\.lab\?\.links\?\.\[bet\.bet\.id\] \?\? \[\] : undefined \}\)/);
  const store = src('src/lib/copilot/store.ts');
  assert.match(store, /if \(!roomForProject\(all, today, input\.forBet\)\) \{/);
  assert.match(store, /if \(!roomToStart\(all, id, today, opts\.forBet\)\) \{/);
  const tab = src('src/app/copilot/_components/v2/ProofTab.tsx');
  assert.match(tab, /full=\{agentIsFull\(home, lab\.links\[lab\.current\.bet\.id\] \?\? \[\]\)\}/, 'the bet’s card counts its own slot');
  assert.match(tab, /authority: 'read', bet: view\.bet\.id \}\);/);
  assert.match(tab, /move\.run\(m, why, tie, b\.id\)/, 'its prep goes over as the bet’s own too');
  assert.match(src('src/lib/copilot/jobs/propose.ts'), /held: commissions\.filter\(\(c\) => takesASlot\(c, todayIso\(ctx\.profile\.timezone\)\)\)\.length,/, 'proposals count slots as the cap does');

  console.log('copilot-core: projects day checks passed');
}

projectsDaySuite().catch((e) => { console.error(e); process.exit(1); });
