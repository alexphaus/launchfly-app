// src/lib/copilot/agent/roadmap.ts
// Drawing the Path's plan: the reading, the one model call, and the write.
//
// Why this exists and the rules it keeps are at the top of lib/copilot/roadmap.ts.
// Nothing here forms a judgement: the pure module builds the prompt, holds what
// comes back to the input's numbers, and decides when a redraw is due. This file
// only gathers the rows and records what happened, including when it failed.
//
// Two callers. The route, when somebody taps Redraw or tells the app something
// changed — it writes the row first so the screen can watch it, then draws in
// after(). The nightly pass, which redraws when the person said something new,
// when the record moved since the last plan, or when the plan is a week old.

import { generateText } from 'ai';
import { copilotDb, todayIso } from '../db';
import { VERDICT_LABEL, decisionReview, verdictOf } from '../decision';
import { DEFAULT_HORIZON_DAYS, goalDue } from '../due';
import { loadSendQueue } from '../execution';
import { angleLines, isOpen, ledgerLines, paused, staleOffer, stateOf, type Experiment } from '../experiment';
import { availableJobs } from '../jobs';
import { offerIsEmpty } from '../offer';
import { carriedSteps, goalOutlooks, outlookLine, outlookSignals } from '../outlook';
import { PROPOSE_JOB } from '../propose';
import { oldestWaitDays } from '../triage';
import { loadMetrics } from '../outcomes';
import { priceOf } from '../plan';
import {
  MAX_FOUND, ROADMAP_SYSTEM, happenedLines, idsByTitle, markMap, openIds, parseRoadmap, previousForPrompt, roadmapDue, roadmapPrompt, roadmapSignature, sourcedFrom,
  type DueReason, type RoadmapInput, type RoadmapRun,
} from '../roadmap';
import {
  finishRoadmapRun, getProfile, insertExperimentMark, loadCommissions, loadConversations, loadDecisions, loadMoves, loadOwnNotes, loadRecentRows, loadRoadmapMarks, loadRoadmapRuns, loadWorking, startRoadmapRun,
} from '../store';
import type { Goal, Profile } from '../types';
import { workingBrief } from '../working';
import { planExtraBody, planMaxOutputTokens, planTimeoutMs, providerFor, resolvePlanConfig } from './llm';
import { extractJson } from './schema';

/**
 * A plan is a page of JSON, not a paragraph, and it now carries an experiment
 * and answers to the record: give it room when nothing else caps it. A
 * reasoning model's thinking counts against this too.
 */
const MAX_TOKENS_HINT = 6_000;
/**
 * The draw never runs behind the proxy — the route hands it to after(), the
 * pass runs inside the container — so it can take longer than a tap could.
 * planTimeoutMs() sets it (110s by default); this is the ceiling, under the
 * route's own five minutes.
 */
const DRAW_MAX_MS = 240_000;
/** Calls the plan is shown, newest first. */
const MAX_CALLS = 6;
/** Replies the plan is shown, and how much of each. */
const MAX_REPLIES = 4;
const REPLY_CHARS = 200;

export function roadmapEnabled(): boolean {
  return !!resolvePlanConfig();
}

async function activeGoals(profileId: string): Promise<Goal[]> {
  const { data, error } = await copilotDb().from('copilot_goals').select('*').eq('profile_id', profileId).eq('status', 'active').order('priority');
  if (error) throw new Error(`could not read your goals: ${error.message}`);
  return (data ?? []) as Goal[];
}

async function contextCount(profileId: string): Promise<number> {
  const { count, error } = await copilotDb().from('copilot_context_items').select('id', { count: 'exact', head: true }).eq('profile_id', profileId);
  if (error) throw new Error(`could not read your notes: ${error.message}`);
  return count ?? 0;
}

/** What the person has said, fingerprinted exactly as loadHome's read of the same rows is. */
async function signatureOf(profile: Profile, goals: Goal[]): Promise<string> {
  const [working, notes] = await Promise.all([loadWorking(profile.id), contextCount(profile.id)]);
  return roadmapSignature({
    goals,
    working: working.filter((w) => w.status === 'live').map((w) => ({ id: w.id, body: w.body })),
    contextCount: notes,
    capacity: profile.capacity,
    offer: profile.offer ?? null,
  });
}

/**
 * Write the row a draw reports on. Returned rather than thrown: the route
 * refuses to start a draw nobody can watch, and says why.
 */
export async function startRoadmap(profileId: string, reason: string): Promise<{ run: RoadmapRun } | { error: string }> {
  const cfg = resolvePlanConfig();
  if (!cfg) return { error: 'No model is set up on this server, so the plan cannot be drawn.' };
  const profile = await getProfile(profileId);
  if (!profile) return { error: 'profile not found' };
  try {
    const signature = await signatureOf(profile, await activeGoals(profileId));
    return await startRoadmapRun(profileId, { reason, signature, model: cfg.model });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Draw into a row already started. Never throws: whatever goes wrong is written
 * on the row, where the Path reads it (invariant 13), and returned.
 */
export async function drawRoadmap(profileId: string, runId: string): Promise<{ ok: true; withheld: number } | { ok: false; error: string }> {
  const close = async (fin: Parameters<typeof finishRoadmapRun>[1]) => {
    const err = await finishRoadmapRun(runId, fin).catch((x: unknown) => (x instanceof Error ? x.message : String(x)));
    // The row stays "running" and reads as stopped after ROADMAP_STALE_MS. Late, never "fine".
    if (err) console.error(`[copilot/roadmap] could not close run ${runId}; it will read as stopped:`, err);
  };
  try {
    const cfg = resolvePlanConfig();
    if (!cfg) throw new Error('No model is set up on this server, so the plan cannot be drawn.');
    const profile = await getProfile(profileId);
    if (!profile) throw new Error('profile not found');

    const [goals, working, notes, metrics, recent, commissions, runs, marks, jobs, queue, open, talk, decisions] = await Promise.all([
      activeGoals(profileId),
      loadWorking(profileId),
      loadOwnNotes(profileId),
      loadMetrics(profileId, profile),
      loadRecentRows(profileId),
      loadCommissions(profileId),
      loadRoadmapRuns(profileId),
      loadRoadmapMarks(profileId),
      availableJobs(profile),
      // The same read the send card counts, so the plan and "Send 25 of your 56" see one number.
      loadSendQueue(profileId),
      loadMoves(profileId, MAX_FOUND * 2),
      // What the brief has always been shown and the plan never was: the
      // messages sent, which were answered, and what people wrote back.
      loadConversations(profileId),
      loadDecisions(profileId, 12),
    ]);
    // A plan drawn without knowing what the person already did with the last
    // one would bring back what they set aside. Better to fail and say so.
    if (runs.unreadable) throw new Error(`could not read the last plan: ${runs.unreadable}`);
    if (marks.unreadable) throw new Error(`could not read what you ticked off: ${marks.unreadable}`);

    const currency = profile.finance?.currency || goals.find((g) => g.metric === 'currency')?.unit || '$';
    const since = Date.now() - 14 * 86_400_000;
    const last = runs.current?.roadmap ?? null;
    const today = todayIso(profile.timezone);
    const ticks = markMap(marks.marks);
    const openItem = (id: string) => (ticks.get(id)?.state ?? 'open') === 'open';

    // Will it work: the arithmetic the planner may not do, done from rows
    // (outlook.ts). A goal with no number is measured by the last plan's
    // milestones for it, reached and still open.
    const milestones: Record<string, { done: number; open: number }> = {};
    for (const p of last?.phases ?? []) for (const m of p.milestones) {
      if (!m.goalId) continue;
      const state = ticks.get(m.id)?.state ?? 'open';
      const e = milestones[m.goalId] ?? { done: 0, open: 0 };
      if (state === 'done') e.done += 1;
      else if (state === 'open') e.open += 1;
      milestones[m.goalId] = e;
    }
    const outlook = goalOutlooks(goals, {
      today,
      price: priceOf(profile.offer?.price_band),
      selling: !offerIsEmpty(profile.offer),
      currency,
      capacity: profile.capacity,
      funnel: { windowDays: metrics.window_days, sent: metrics.sent, won: metrics.won, wonAmount: metrics.won_amount },
      milestones,
    });
    // What the record says to stop or change: an opener nobody answers, a step
    // carried plan after plan, calls made again and again and never done.
    const review = decisionReview(decisions);
    const signals = outlookSignals({
      settled: talk.tally,
      carried: carriedSteps(runs.plans.map((r) => r.roadmap!).filter(Boolean), openItem),
      calls: { avoided: review.avoidedTopic, dead: review.deadTopic, total: review.total },
    });

    // The experiment (experiment.ts). One open is carried as it is. One offered
    // a week ago and never started was not wanted: recorded as not tried —
    // inferred, never asked — and the planner may offer another.
    const lastExperiment = last?.experiment ?? null;
    let carry: Experiment | null = null;
    if (lastExperiment && isOpen(lastExperiment, marks.experiments)) {
      if (staleOffer(lastExperiment, marks.experiments, today)) {
        await insertExperimentMark(profileId, { id: lastExperiment.id, title: lastExperiment.title, angle: lastExperiment.angle, state: 'ignored', inferred: true });
      } else {
        carry = lastExperiment;
      }
    }
    const experimentsPaused = !carry && paused(marks.experiments, today);
    // What the person already has, which a new experiment must not restate.
    const known = [
      ...notes,
      ...workingBrief(working).split('\n'),
      ...(last?.phases ?? []).flatMap((p) => p.milestones.flatMap((m) => [m.title, ...m.steps.map((st) => st.title)])),
      ...open.moves.map((m) => m.headline),
      // And every experiment already run: one that was answered is not offered again as new.
      ...marks.experiments.map((m) => m.title),
    ].filter((t) => t && t.trim());

    const input: RoadmapInput = {
      today,
      name: profile.name,
      headline: profile.headline,
      location: profile.location,
      capacity: profile.capacity,
      currency,
      runwayMonths: metrics.runway_months,
      offer: profile.offer?.sells?.trim() ? profile.offer : null,
      price: priceOf(profile.offer?.price_band),
      goals: goals.map((g) => {
        const due = goalDue(g, today);
        return {
          id: g.id, title: g.title, metric: g.metric, unit: g.unit, target: g.target_value, current: g.current_value,
          dueOn: due?.dueOn ?? null, daysLeft: due?.daysLeft ?? null, defaultDate: !!due && g.horizon_days === DEFAULT_HORIZON_DAYS,
          note: g.note,
        };
      }),
      working: workingBrief(working),
      notes,
      funnel: { windowDays: metrics.window_days, sent: metrics.sent, replied: metrics.replies, won: metrics.won, wonAmount: metrics.won_amount },
      happened: happenedLines({
        outcomes: recent.outcomes,
        focus: recent.focus,
        answered: recent.answered,
        finished: commissions
          .filter((c) => c.status === 'done' && c.closed_at && Date.parse(c.closed_at) >= since)
          .map((c) => ({ objective: c.objective, closedAt: c.closed_at!, outcome: c.outcome })),
        currency,
      }),
      previous: previousForPrompt(last, marks.marks),
      aiAvailable: jobs.includes('commission'),
      // Drafts from a blank offer are not put in front of anyone (invariant 1), so the plan is not told about them either.
      found: open.moves
        .filter((m) => m.job !== PROPOSE_JOB && m.job !== 'send_queue')
        .slice(0, MAX_FOUND)
        .map((m) => [m.headline, m.why?.find((w) => w?.trim())].filter(Boolean).join(' — ').slice(0, 220)),
      drafts: offerIsEmpty(profile.offer) || !queue.length
        ? null
        : { count: queue.length, oldestDays: oldestWaitDays(queue.map((q) => q.execution.created_at), new Date()) },
      outlook: outlook.map(outlookLine),
      signals: signals.map((x) => x.line),
      openers: talk.sent.map((x) => ({ text: x.text, replied: x.replied })),
      replies: talk.replies.slice(0, MAX_REPLIES).map((r) => ({ business: r.business, text: r.text.slice(0, REPLY_CHARS) })),
      calls: decisions.slice(0, MAX_CALLS).map((d) => `${d.for_date}: ${d.headline} — ${VERDICT_LABEL[verdictOf(d)].toLowerCase()}`),
      experiments: {
        ledger: ledgerLines(marks.experiments),
        angles: angleLines(marks.experiments),
        open: carry,
        openState: carry ? stateOf(carry, marks.experiments) : null,
        paused: experimentsPaused,
      },
      agentCan: process.env.COPILOT_AGENT_CAN?.trim() || null,
    };
    const prompt = roadmapPrompt(input);

    let raw: unknown;
    try {
      const { text } = await generateText({
        model: providerFor(cfg, planExtraBody())(cfg.model),
        system: ROADMAP_SYSTEM,
        prompt,
        // Between the brief's 0.4 and the proposer's 0.5 would be arbitrary; a
        // plan should come out the same way twice from the same record, or a
        // redraw reads as the app changing its mind for no reason.
        temperature: 0.3,
        maxRetries: 0,
        maxOutputTokens: planMaxOutputTokens() ?? MAX_TOKENS_HINT,
        abortSignal: AbortSignal.timeout(Math.min(planTimeoutMs(), DRAW_MAX_MS)),
      });
      raw = extractJson(text);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(/abort|timeout/i.test(message)
        ? `${cfg.model} did not answer in time — raise COPILOT_PLAN_TIMEOUT_MS or pick a faster model`
        : `the model did not answer: ${message}`);
    }

    const parsed = parseRoadmap(raw, {
      // Every number and month in what it was shown about the person, and nothing
      // else: the guard reads the same text the model did. Not the system text —
      // its "30 minutes" and "8 words" are this file's numbers, not theirs.
      allowed: sourcedFrom(prompt),
      goalIds: goals.map((g) => g.id),
      aiAvailable: input.aiAvailable,
      previousIds: idsByTitle(last),
      previousOpen: openIds(last, marks.marks),
      experiment: { carry, paused: experimentsPaused, known, today },
    });
    if (!parsed) throw new Error('the model answered with no milestone that held up');
    // A new experiment under an id an earlier one used would inherit that one's
    // verdict and arrive already answered. Its id is made its own.
    const fresh = parsed.roadmap.experiment;
    if (fresh && !carry && marks.experiments.some((m) => m.id === fresh.id)) fresh.id = `${fresh.id}-${today.replace(/-/g, '')}`;
    // The signals ride with the plan that had to answer them, so the Path can
    // show both side by side. Computed above, never written by the model.
    if (signals.length) parsed.roadmap.signals = signals.map((x) => x.line);

    await close({ status: 'ok', output: { roadmap: parsed.roadmap, withheld: parsed.withheld } });
    return { ok: true, withheld: parsed.withheld };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await close({ status: 'error', error });
    return { ok: false, error };
  }
}

export interface NightlyRoadmap { drawn?: boolean; reason?: DueReason; skipped?: string; error?: string }

/**
 * The night's part: redraw when something changed since the last plan, or once
 * a week, and otherwise leave the plan the person has been looking at alone.
 */
export async function redrawIfDue(profileId: string, reason: string): Promise<NightlyRoadmap> {
  if (!roadmapEnabled()) return { skipped: 'no model set up' };
  const profile = await getProfile(profileId);
  if (!profile) return { error: 'profile not found' };
  const [goals, runs, marks, recent] = await Promise.all([activeGoals(profileId), loadRoadmapRuns(profileId), loadRoadmapMarks(profileId), loadRecentRows(profileId)]);
  if (runs.unreadable) return { error: `could not read the last plan: ${runs.unreadable}` };
  const signature = await signatureOf(profile, goals);
  // An experiment tried, set aside or answered is the record moving, like a tick:
  // the next plan should know, and offer the next one.
  const lastMarkAt = [marks.marks[0]?.at, marks.experiments[0]?.at].filter((x): x is string => !!x).sort().pop() ?? null;
  const due = roadmapDue({
    latest: runs.latest, current: runs.current, signature, now: new Date(), trigger: 'nightly',
    lastOutcomeAt: recent.outcomes[0]?.occurred_at ?? null,
    lastMarkAt,
  });
  if (!due) return { skipped: 'nothing changed since the last plan' };
  const started = await startRoadmap(profileId, reason);
  if ('error' in started) return { error: started.error };
  const r = await drawRoadmap(profileId, started.run.id);
  return r.ok ? { drawn: true, reason: due } : { error: r.error, reason: due };
}
