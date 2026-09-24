// Everything the four tabs render, derived once from HomeData.
//
// One pass, memoised on the home object, for two reasons. The header's status
// line and the tab under it must say the same number — the old app shipped "61"
// in the header over "51" in the card below, from two reads. And every figure
// here is computed from `generatedAt` rather than the clock, so the server
// render and the hydrating client agree.
//
// No logic of its own beyond wiring: the rules live in lib/copilot/today.ts,
// matches.ts, machine.ts and review.ts, where copilot-core.test.ts covers them.

import { useMemo } from 'react';
import { focusWeek } from '@/lib/copilot/focus';
import { agentRoster, businessMachine, workStatus } from '@/lib/copilot/machine';
import { matchCounts, matchFeed, matchesStatus } from '@/lib/copilot/matches';
import { offerIsEmpty } from '@/lib/copilot/offer';
import { weekReview } from '@/lib/copilot/review';
import { doneForYou, needsYou, todayStatus, worthDoing } from '@/lib/copilot/today';
import { oldestWaitDays, queueIsBacked } from '@/lib/copilot/triage';
import type { HomeData } from '@/lib/copilot/types';
import type { Tab2 } from '../shared';

export function derive(home: HomeData) {
  const now = new Date(home.generatedAt);
  const noOffer = offerIsEmpty(home.profile.offer);
  const queueCount = home.queue.length;
  const oldestDays = oldestWaitDays(home.queue.map((q) => q.execution.created_at), now);
  const queueBacked = queueIsBacked(queueCount, oldestDays);
  const currency = home.profile.finance?.currency || home.goals.find((g) => g.metric === 'currency')?.unit || '$';

  /* Matches — first, because Today reports how many of last night's finds are still waiting there. */
  const feed = matchFeed({ now, pipeline: home.pipeline, triage: home.triage, moves: home.moves, targetSegments: home.profile.target_segments });
  const counts = matchCounts(feed);

  /* Today */
  const ownMoves = [...home.moves, ...(home.callMove ? [home.callMove] : [])].filter((m) => m.job !== 'watch');
  const done = doneForYou({
    now,
    lastCronRun: home.lastCronRun,
    jobsRun: home.jobsRun,
    matchCreated: home.pipeline.map((r) => r.opportunity.created_at),
    matchesWaiting: feed.filter((i) => i.from === 'business' && i.fresh).length,
    motion: home.motion,
    sourcesFailing: home.watchSources.filter((s) => !!s.last_error).length,
    commissions: home.commissions,
    outcomes: home.recent.outcomes,
    moves: ownMoves,
  });
  const asks = needsYou({
    commissions: home.commissions,
    capture: home.capture,
    queue: { count: queueCount, oldestDays },
    queueIsCall: home.callMove?.job === 'send_queue',
    noOffer,
  });
  const worth = worthDoing(home.moves);
  // A brand new account: nothing to call, nothing found, nothing handed over.
  // One card that says what is happening beats five empty sections.
  const nothingYet = !home.decision && !home.insight && !queueCount && !home.moves.length && !home.pipeline.length && !home.commissions.length;

  /* Work */
  const d = home.diagnosis;
  // The goal a logged win actually moves: recordOutcome adds the amount to the
  // highest-priority currency goal, target or not. Showing any other one at the
  // end of the path to money would draw a pipe into the wrong tank.
  const goal = home.goals.find((g) => g.metric === 'currency') ?? null;
  const machine = businessMachine({
    stages: d.stages,
    bottleneck: d.bottleneck,
    outsideFunnel: d.outsideFunnel,
    segments: home.profile.target_segments,
    area: home.profile.target_area || home.profile.location,
    queueCount,
    wonAmount: home.metrics.won_amount,
    currency: goal?.unit || currency,
    goal: goal ? { title: goal.title, target: goal.target_value, current: goal.current_value } : null,
  });
  const team = agentRoster({
    now,
    supplyLastRun: home.supplyLastRun,
    sourced: home.metrics.pipeline.sourced,
    hasTargeting: home.profile.target_segments.length > 0 && !!(home.profile.target_area || home.profile.location),
    matchesLeft: home.billing.matches.remaining,
    sources: home.watchSources.map((s) => ({ lastCheckedAt: s.last_checked_at, error: s.last_error, status: s.status })),
    finds: feed.filter((i) => i.from === 'feed').length,
    offerEmpty: noOffer,
    queueCount,
    drafted: d.stages.find((s) => s.key === 'drafted')?.count ?? 0,
    workerConnected: home.workerConnected,
    commissions: home.commissions,
    lastCronRun: home.lastCronRun,
    lastRun: home.lastRun,
    jobsRan: home.jobsRun?.ran ?? null,
    broke: home.jobsRun?.broke ?? [],
  });
  const running = home.commissions.filter((t) => t.commission.status === 'active' || t.commission.status === 'blocked').length;

  /* You */
  const review = weekReview({
    now,
    today: home.recent.today,
    timezone: home.profile.timezone,
    outcomes: home.recent.outcomes,
    answered: home.recent.answered,
    focus: home.recent.focus,
    commissions: home.commissions.map((t) => t.commission),
    queue: { count: queueCount, oldestDays },
    sources: { total: home.watchSources.length, failing: home.watchSources.filter((s) => !!s.last_error).length },
    decisions: home.decisionLog,
    edge: home.edge,
    bottleneck: d.findings.find((f) => f.kind === 'bottleneck') ?? null,
    runwayMonths: home.metrics.runway_months,
    currency,
  });
  const week = focusWeek(home.recent.focus, home.recent.today);

  const status: Record<Tab2, string | null> = {
    today: todayStatus(done, asks),
    matches: matchesStatus(counts, noOffer ? 0 : queueCount),
    work: workStatus(team, running),
    you: home.metrics.runway_months != null ? `${home.metrics.runway_months} months of runway` : null,
  };

  return {
    now, noOffer, queueCount, oldestDays, queueBacked, currency,
    done, asks, worth, nothingYet,
    feed, counts,
    machine, team, running,
    review, week,
    status,
  };
}

export type Derived = ReturnType<typeof derive>;

export function useDerived(home: HomeData): Derived {
  return useMemo(() => derive(home), [home]);
}
