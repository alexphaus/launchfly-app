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
import { loadSendQueue } from '../execution';
import { availableJobs } from '../jobs';
import { offerIsEmpty } from '../offer';
import { PROPOSE_JOB } from '../propose';
import { oldestWaitDays } from '../triage';
import { loadMetrics } from '../outcomes';
import { priceOf } from '../plan';
import {
  MAX_FOUND, ROADMAP_SYSTEM, happenedLines, idsByTitle, parseRoadmap, previousForPrompt, roadmapDue, roadmapPrompt, roadmapSignature, sourcedFrom,
  type DueReason, type RoadmapInput, type RoadmapRun,
} from '../roadmap';
import {
  finishRoadmapRun, getProfile, loadCommissions, loadMoves, loadOwnNotes, loadRecentRows, loadRoadmapMarks, loadRoadmapRuns, loadWorking, startRoadmapRun,
} from '../store';
import type { Goal, Profile } from '../types';
import { workingBrief } from '../working';
import { cronTimeoutMs, maxOutputTokens, providerFor, resolveLlmConfig } from './llm';
import { extractJson } from './schema';

/** A plan is a page of JSON, not a paragraph: give it room when nothing else caps it. */
const MAX_TOKENS_HINT = 2_500;
/**
 * The draw never runs behind the proxy — the route hands it to after(), the
 * pass runs inside the container — so it can take the nightly budget. Capped
 * below it so a slow draw cannot eat the whole cron's time for one profile.
 */
const DRAW_CAP_MS = 110_000;

export function roadmapEnabled(): boolean {
  return !!resolveLlmConfig();
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
  const cfg = resolveLlmConfig();
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
    const cfg = resolveLlmConfig();
    if (!cfg) throw new Error('No model is set up on this server, so the plan cannot be drawn.');
    const profile = await getProfile(profileId);
    if (!profile) throw new Error('profile not found');

    const [goals, working, notes, metrics, recent, commissions, runs, marks, jobs, queue, open] = await Promise.all([
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
    ]);
    // A plan drawn without knowing what the person already did with the last
    // one would bring back what they set aside. Better to fail and say so.
    if (runs.unreadable) throw new Error(`could not read the last plan: ${runs.unreadable}`);
    if (marks.unreadable) throw new Error(`could not read what you ticked off: ${marks.unreadable}`);

    const currency = profile.finance?.currency || goals.find((g) => g.metric === 'currency')?.unit || '$';
    const since = Date.now() - 14 * 86_400_000;
    const last = runs.current?.roadmap ?? null;
    const input: RoadmapInput = {
      today: todayIso(profile.timezone),
      name: profile.name,
      headline: profile.headline,
      location: profile.location,
      capacity: profile.capacity,
      currency,
      runwayMonths: metrics.runway_months,
      offer: profile.offer?.sells?.trim() ? profile.offer : null,
      price: priceOf(profile.offer?.price_band),
      goals: goals.map((g) => ({
        id: g.id, title: g.title, metric: g.metric, unit: g.unit, target: g.target_value, current: g.current_value, horizonDays: g.horizon_days, note: g.note,
      })),
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
    };
    const prompt = roadmapPrompt(input);

    let raw: unknown;
    try {
      const { text } = await generateText({
        model: providerFor(cfg)(cfg.model),
        system: ROADMAP_SYSTEM,
        prompt,
        // Between the brief's 0.4 and the proposer's 0.5 would be arbitrary; a
        // plan should come out the same way twice from the same record, or a
        // redraw reads as the app changing its mind for no reason.
        temperature: 0.3,
        maxRetries: 0,
        maxOutputTokens: maxOutputTokens() ?? MAX_TOKENS_HINT,
        abortSignal: AbortSignal.timeout(Math.min(cronTimeoutMs(), DRAW_CAP_MS)),
      });
      raw = extractJson(text);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(/abort|timeout/i.test(message)
        ? `${cfg.model} did not answer in time — raise COPILOT_AI_CRON_TIMEOUT_MS or pick a faster model`
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
    });
    if (!parsed) throw new Error('the model answered with no milestone that held up');

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
  const due = roadmapDue({
    latest: runs.latest, current: runs.current, signature, now: new Date(), trigger: 'nightly',
    lastOutcomeAt: recent.outcomes[0]?.occurred_at ?? null,
    lastMarkAt: marks.marks[0]?.at ?? null,
  });
  if (!due) return { skipped: 'nothing changed since the last plan' };
  const started = await startRoadmap(profileId, reason);
  if ('error' in started) return { error: started.error };
  const r = await drawRoadmap(profileId, started.run.id);
  return r.ok ? { drawn: true, reason: due } : { error: r.error, reason: due };
}
