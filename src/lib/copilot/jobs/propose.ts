// src/lib/copilot/jobs/propose.ts
// One model call a night, asking what this app should go and do itself.
//
// Everything about WHY this exists is at the top of lib/copilot/propose.ts. This
// file is the reading, the one call, and the gate around it. The split is the
// usual one: the pure module decides whether to propose, writes the reasons from
// rows and validates what comes back; nothing here forms a judgement.
//
// It is a Job like any other, which is the whole design. A proposal competes for
// the morning through scoreMove, is barred by a standing refusal, decays on
// refusals and on the ledger's verdict, and renders as the Call or as a Move or
// as nothing at all. No new surface, no new section, no permanent button.

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { extractJson } from '../agent/schema';
import { cronTimeoutMs, extraBody, maxOutputTokens, resolveLlmConfig } from '../agent/llm';
import { describeMetrics } from '../metrics';
import { countOpenMoves, loadCommissions, loadMoveAnswers, loadStandingRefusals, loadWorking } from '../store';
import { dismissedStreak } from '../moves';
import { loadWorthLedger } from '../outcomes';
import {
  PROPOSAL_BUDGET_MINUTES, PROPOSE_JOB, PROPOSE_SYSTEM, parseProposal, proposalFrom, proposePrompt, shouldPropose,
} from '../propose';
import { workingBrief } from '../working';
import { phraseFor } from '../call';
import type { MoveDraft } from '../moves';
import type { Job, JobContext } from './types';

/** Tighter than the watcher's: one short JSON object, not a page of verdicts. */
const MAX_TOKENS_HINT = 700;

/** Objectives already handed over, so the same idea is not proposed twice. */
const RECENT_OBJECTIVES = 8;

export const proposeJob: Job = {
  key: PROPOSE_JOB,
  label: 'Work it could take off you',

  /**
   * Only the newest unanswered proposal is worth showing.
   *
   * The gate in shouldPropose saves the model call; this guarantees the screen,
   * and the two are not the same thing — a gate that reads one row wrong stacks
   * two cards saying "hand this over" forever, which is what happened to
   * send_queue with three open Moves keyed by date. Superseded rows are deleted
   * rather than dismissed, so a proposal the user never saw cannot teach
   * dismissedStreak that they turned it down.
   */
  supersedes: true,

  /**
   * Cheap, as the contract requires: environment and profile only. Whether
   * there is anything worth proposing is a result, read in run() — an account
   * with nothing to hand over is not a broken sensor.
   */
  available(ctx: JobContext) {
    return !!ctx.profile.onboarding_complete && !!resolveLlmConfig();
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const cfg = resolveLlmConfig();
    if (!cfg) return [];

    const { goals, metrics } = await ctx.sense();
    // Highest priority active goal. A proposal with no goal behind it is the
    // app inventing a direction for somebody's business (invariant 12), which
    // shouldPropose refuses outright.
    const goal = [...goals].sort((a, b) => a.priority - b.priority)[0] ?? null;

    const [commissions, openProposals, answers, worth] = await Promise.all([
      loadCommissions(ctx.profile.id),
      // An exact count, not loadMoves. That is a screen read capped at eight by
      // orderMoves, so a proposal ranked below the cut on a busy morning read as
      // none open and the gate wrote a second one — the gate failing in exactly
      // the situation it exists for.
      countOpenMoves(ctx.profile.id, PROPOSE_JOB),
      loadMoveAnswers(ctx.profile.id),
      loadWorthLedger(ctx.profile.id),
    ]);

    const gate = shouldPropose({
      held: commissions.filter((c) => c.status !== 'done' && c.status !== 'stopped').length,
      openProposals,
      binnedInARow: dismissedStreak(answers, PROPOSE_JOB),
      hasGoal: !!goal,
      // The `commission` record, not `propose`'s own: the question the user
      // answered at close — was handing this over worth anything — is the same
      // one a proposal asks them to bet on again.
      worth: worth.commission,
    });
    if (!gate.ok || !goal) {
      // Returning [] with the reason only in a log would make "nothing worth
      // proposing" and "the model is not configured" the same empty screen.
      // The jobs run summary carries it; Now reads that summary.
      if (!gate.ok) console.info(`[copilot] propose: quiet — ${gate.reason}`);
      return [];
    }

    const [working, standing] = await Promise.all([
      loadWorking(ctx.profile.id),
      loadStandingRefusals(ctx.profile.id),
    ]);

    const prompt = proposePrompt({
      goalTitle: goal.title,
      offer: ctx.profile.offer?.sells ?? '',
      // Live entries only — workingBrief already filters proposals out. This is
      // what the user has said about their own business, and it is the reason a
      // proposal from inside the app can beat the same question typed into a
      // chat window.
      working: workingBrief(working),
      metricsLine: describeMetrics(metrics, ctx.profile.finance?.currency || '$'),
      recentObjectives: commissions.slice(0, RECENT_OBJECTIVES).map((c) => c.objective),
      refusedPhrases: [...standing].map(phraseFor),
    });

    let raw: unknown;
    try {
      const extra = extraBody();
      const provider = createOpenAI({
        apiKey: cfg.apiKey,
        baseURL: cfg.baseURL,
        fetch: extra
          ? (input, init) => {
              if (typeof init?.body !== 'string') return fetch(input, init);
              try { return fetch(input, { ...init, body: JSON.stringify({ ...JSON.parse(init.body), ...extra }) }); }
              catch { return fetch(input, init); }
            }
          : undefined,
      });
      const { text } = await generateText({
        model: provider(cfg.model),
        system: PROPOSE_SYSTEM,
        prompt,
        // Higher than the watcher's 0.2, lower than the brief's 0.4. A filter
        // should answer the same way twice; a proposer that does is a proposer
        // that suggests the same thing every night until it is refused.
        temperature: 0.5,
        maxRetries: 0,
        maxOutputTokens: maxOutputTokens() ?? MAX_TOKENS_HINT,
        abortSignal: AbortSignal.timeout(Math.min(cronTimeoutMs(), 30_000)),
      });
      raw = extractJson(text);
    } catch (e) {
      // Surfaced as a broken sensor rather than a quiet night. runJobs collects
      // a throw into jobsRun.broke, and Now says "a sensor failed last night"
      // instead of "nothing new" — invariant 13, and the difference between a
      // model outage and a week with nothing in it.
      throw new Error(`could not ask for a proposal: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    const draft = parseProposal(raw);
    // Declining is a first-class answer and the prompt asks for it by name. A
    // proposer that must always propose will propose on a quiet week, and a
    // mandate invented to fill a slot costs worker minutes and the user's trust
    // in every one that follows.
    if (!draft) return [];

    const move = proposalFrom(draft, { goal, metrics, worth: worth.commission }, PROPOSAL_BUDGET_MINUTES);
    return move ? [move] : [];
  },
};
