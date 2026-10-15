// src/lib/copilot/planrun.ts
// The crew's steps of the running bet's plan (betplan.ts), started: by the tap
// that starts or plans the bet, by the nightly pass, and by "Try again".
//
// Each step is done by what the app already has, not by anything new here: the
// Scout's search is the one "Find people" ran (voices.ts), a draft is the one
// "Draft it with AI" wrote (proofai.ts), and a project is written, tied to the
// bet and approved the way the bet's own hand-over always was — so a step the
// plan starts behaves exactly as the same tap on the card would.
//
// Every attempt is a row before it starts and a row when it ends, done or
// failed with why (LAB_PLAN_RUN). The card reads them, so a step that broke at
// 21:00 says so in the morning instead of reading "not started" forever — the
// shape of the three failures invariant 13 was written for.
//
// No dispatch here: a project the plan hands over is picked up by the commission
// job, which the nightly pass runs right after this one and the lab route runs
// after a Start (it imports the job runner; this module must not, or the jobs
// would import themselves).

import { LAB_LINK, type BetView, type PlanKind, type PlanStep } from './lab';
import { dueSteps, planInputOf, planView, type PlanReason } from './betplan';
import { draftAsset } from './proofai';
import { findVoices } from './voicefind';
import { exaConfigured } from './watch/exa';
import { offerIsEmpty } from './offer';
import { bumpUsage, periodKey } from './usage';
import { LAB_VOICES, betVoiced, betVoices, voiceRefusal, voicesSeen } from './voices';
import { approveCommission, createCommission, getProfile, insertLabEvent, insertPlanRun, insertVoiceEvent, loadHome } from './store';
import type { Commission } from './commission';
import type { HomeData, Profile } from './types';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A search that may not run, said with why. The route answers it as a refusal; the plan records it as the step's failure. */
export class VoiceRefused extends Error {}

/**
 * One search for a bet's people: written from the offer, held to the posts not
 * already found, stored even when it keeps nobody ("searched, nobody new" is an
 * answer, and the next search should know this one ran), and metered like the
 * matches it is. The route's "Find people" and the plan's Scout both come here.
 */
export async function searchVoicesFor(pid: string, profile: Profile, home: HomeData, betId: string, today: string): Promise<{ kept: number; why: string | null }> {
  if (home.lab?.unreadable) throw new VoiceRefused(`Your bets could not be read just now: ${home.lab.unreadable}`);
  // Unread, a search could bring back the people already on the card and charge for them twice.
  if (home.lab?.voices?.unreadable) throw new VoiceRefused(`The people already found could not be read just now, so a search cannot tell who is new: ${home.lab.voices.unreadable}`);
  const view = home.lab?.bets.find((x) => x.bet.id === betId);
  if (!view) throw new VoiceRefused('That bet is not in your record.');
  const mine = betVoices(home.lab?.voices, view.bet, home.lab?.talks ?? []);
  const remaining = home.billing.matches.remaining;
  const no = voiceRefusal({ running: view.state === 'running', voiced: betVoiced(view.bet), searches: mine.searches, ready: exaConfigured(), remaining });
  if (no) throw new VoiceRefused(no);
  // A search worked out from nothing is not the person's (invariant 1).
  if (offerIsEmpty(profile.offer)) throw new VoiceRefused('Say what you sell and who for first: the search is written from it.');
  const found = await findVoices({ offer: profile.offer ?? {}, bet: view.bet, seen: voicesSeen(home.lab?.voices), today, max: remaining });
  await insertVoiceEvent(pid, LAB_VOICES, {
    bet: view.bet.id, queries: found.queries, from: found.from, voices: found.voices,
    ...(found.why ? { why: found.why } : {}),
  });
  if (found.voices.length) await bumpUsage(pid, periodKey(profile.timezone), 'matches', found.voices.length);
  return { kept: found.voices.length, why: found.why };
}

/**
 * A step's project: written for the bet, tied to it, then approved. Tied first,
 * because the bet's own slot is spent only by a project the bet knows about
 * (commission.ts roomToStart) — and a tie that did not save would leave an errand
 * under Projects that the plan cannot see. Approving is the person's Start: the
 * plan was on the screen when they tapped it (handOverStep's reasoning).
 */
async function handOver(pid: string, home: HomeData, view: BetView, step: PlanStep): Promise<Commission> {
  const linked = home.lab?.links?.[view.bet.id] ?? [];
  const today = home.recent.today;
  // The same work already on the go is taken, not written twice: a run that wrote
  // the project and then failed to tie it would otherwise write another every
  // night, each holding a slot (handOverStep's rule, for the same reason).
  const live = home.commissions.map((t) => t.commission).find((c) => c.objective === step.ask && c.status !== 'done' && c.status !== 'stopped') ?? null;
  const c = live ?? await createCommission(pid, { objective: step.ask!, why: `For the bet "${view.bet.belief}".`.slice(0, 300), authority: 'read', today, forBet: linked });
  if (!c) throw new Error('The project was not written.');
  if (!linked.includes(c.id)) await insertLabEvent(pid, LAB_LINK, { bet: view.bet.id, commission: c.id });
  if (c.status !== 'draft') return c;
  const approved = await approveCommission(pid, c.id, { today, forBet: [...linked, c.id] });
  // Not a lost project: it waits under Projects, tied to the bet, for its approve button.
  if (!approved) throw new Error('Written, and not started: approve it under Projects.');
  return approved;
}

export interface PlanRunResult {
  started: PlanKind[];
  failed: Array<{ step: PlanKind; why: string }>;
  /** A project went on: the caller hands it to a worker now, rather than at 21:00. */
  handed: boolean;
  /** Why nothing ran at all, when nothing could. */
  idle: string | null;
  /** Failures the card cannot show, because the row saying so did not save: the run's own report carries them. */
  unrecorded: string[];
  /** Projects handed over whose step is left started, for the caller to close once a worker has had them (holdProjects). */
  held: Array<{ step: PlanKind; ref: string }>;
}

/** The steps a run will take, each already said to have started. */
export interface PlanClaim { bet: string; steps: PlanKind[]; failed: Array<{ step: PlanKind; why: string }> }

/**
 * Decide which crew steps are due (betplan.ts dueSteps) against a home already
 * read, and write each one's start before any of them runs. The tap answers with
 * those rows in it, so the card says "Searching…" from a row, not from a guess,
 * and follows the work until it lands. Throws only when the bets cannot be read.
 */
export async function claimPlanSteps(pid: string, home: HomeData, reason: PlanReason, now = new Date()): Promise<PlanClaim | { idle: string }> {
  // Refused rather than guessed: an unread record could start a step for a bet that ended.
  if (home.lab?.unreadable) throw new Error(`Your bets could not be read: ${home.lab.unreadable}`);
  const view = home.lab?.bets.find((x) => x.state === 'running') ?? null;
  if (!view) return { idle: 'No bet is running.' };
  const plan = home.lab?.plans?.[view.bet.id] ?? null;
  if (!plan) return { idle: 'The running bet has no plan.' };
  const due = dueSteps(planView(plan, planInputOf(home, view, now)), {
    runs: (home.lab?.planRuns ?? []).filter((r) => r.bet === view.bet.id), reason, today: home.recent.today, timezone: home.profile.timezone,
  });
  const claim: PlanClaim = { bet: view.bet.id, steps: [], failed: [] };
  for (const kind of due) {
    try {
      await insertPlanRun(pid, { bet: view.bet.id, step: kind, state: 'asked' });
      claim.steps.push(kind);
    } catch (e) {
      claim.failed.push({ step: kind, why: message(e) });
    }
  }
  return claim;
}

/**
 * Run the claimed steps one after another, each read against the home as the
 * last one left it — a search spends matches and a project takes a slot, and the
 * next step has to see both. Every step ends in a row, done or failed with why;
 * one the clock ran out on says so, and the next night takes it up.
 */
export async function runPlanSteps(pid: string, claim: PlanClaim, opts: { deadline?: number; holdProjects?: boolean } = {}): Promise<PlanRunResult> {
  // A step whose start did not save never ran, and nothing on the card says so: the run's report does.
  const out: PlanRunResult = { started: [], failed: [...claim.failed], handed: false, idle: null, unrecorded: claim.failed.map((f) => `${f.step}: ${f.why}`), held: [] };
  const fail = async (kind: PlanKind, why: string) => {
    out.failed.push({ step: kind, why });
    // Kept where the card reads it. If even this write fails, the run's own result says so (invariant 13).
    await insertPlanRun(pid, { bet: claim.bet, step: kind, state: 'failed', why }).catch((x) => out.unrecorded.push(`${kind}: ${why}, and it could not be recorded: ${message(x)}`));
  };
  const profile = await getProfile(pid);
  let home = await loadHome(pid);
  const live = (h: HomeData | null) => h?.lab?.bets.find((x) => x.bet.id === claim.bet && x.state === 'running') ?? null;
  for (const kind of claim.steps) {
    const view = live(home);
    const step = home?.lab?.plans?.[claim.bet]?.steps.find((s) => s.kind === kind) ?? null;
    if (!profile || !home || !view || !step) { await fail(kind, 'The bet is no longer running.'); continue; }
    if (opts.deadline && Date.now() > opts.deadline) { await fail(kind, 'No time was left in this run. It is tried again tonight.'); continue; }
    out.started.push(kind);
    try {
      let ref: string | null = null;
      let why: string | null = null;
      if (step.kind === 'draft') {
        ref = (await draftAsset(pid, { kind: step.asset, bet: claim.bet })).asset;
      } else if (step.kind === 'find' && step.who === 'Scout') {
        const r = await searchVoicesFor(pid, profile, home, claim.bet, home.recent.today);
        // Kept nobody is an answer, not a failure: the card says it and the Scout looks again tomorrow.
        why = r.kept ? null : r.why ?? 'Nobody new this time';
      } else if (step.ask) {
        ref = (await handOver(pid, home, view, step)).id;
        out.handed = true;
        // On a tap, the step stays started until a worker has had the project, so
        // the screen follows it to what came back rather than stopping at "handed over".
        if (opts.holdProjects) { out.held.push({ step: kind, ref }); home = (await loadHome(pid)) ?? home; continue; }
      }
      await insertPlanRun(pid, { bet: claim.bet, step: kind, state: 'done', why, ref });
    } catch (e) {
      await fail(kind, message(e));
    }
    home = (await loadHome(pid)) ?? home;
  }
  return out;
}

/** Claim and run in one go: the nightly pass, which has no screen waiting on the claim. */
export async function runBetPlan(pid: string, opts: { reason: PlanReason; deadline?: number; now?: Date }): Promise<PlanRunResult> {
  const home = await loadHome(pid);
  if (!home) throw new Error('profile not found');
  const claim = await claimPlanSteps(pid, home, opts.reason, opts.now);
  if ('idle' in claim) return { started: [], failed: [], handed: false, idle: claim.idle, unrecorded: [], held: [] };
  return runPlanSteps(pid, claim, { deadline: opts.deadline });
}
