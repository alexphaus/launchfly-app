// Everything the four tabs render, derived once from HomeData.
//
// One pass, memoised on the home object, for two reasons. The header's status
// line and the tab under it must say the same number — the old app shipped "61"
// in the header over "51" in the card below, from two reads. And every figure
// here is computed from `generatedAt` rather than the clock, so the server
// render and the hydrating client agree.
//
// No logic of its own beyond wiring: the rules live in lib/copilot/pathway.ts,
// today.ts, matches.ts, machine.ts and review.ts, where copilot-core.test.ts
// covers them.

import { useMemo } from 'react';
import { focusWeek } from '@/lib/copilot/focus';
import { agentRoster, businessMachine, workStatus } from '@/lib/copilot/machine';
import { matchCounts, matchFeed, matchesStatus, stageCards } from '@/lib/copilot/matches';
import { offerIsEmpty } from '@/lib/copilot/offer';
import { pathLadder, pathNext, pathPast, pathSwap, pathWeek } from '@/lib/copilot/pathway';
import { pathAhead, pathHere, pathNow, planStatus, priceOf } from '@/lib/copilot/plan';
import { SIZE_LABEL, goalMarkers, markMap, roadmapDue, roadmapFirstStep, roadmapSignature, roadmapView } from '@/lib/copilot/roadmap';
import { weekReview } from '@/lib/copilot/review';
import { doneForYou, needsYou, worthDoing } from '@/lib/copilot/today';
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
  // The list is the verdict: only what cleared the bar. The header counts the
  // same list, so the two agree.
  const good = feed.filter((i) => !i.below);
  const counts = matchCounts(good);
  const staged = stageCards({ now, queue: home.queue, pipeline: home.pipeline, targetSegments: home.profile.target_segments });
  // Drafts written from a blank offer are not put in front of anyone to send
  // (invariant 1) — the offer comes first, and Today's call says so.
  const stages = noOffer ? { ...staged, to_send: [] } : staged;
  // Whether anything is looking for businesses or people for this account: the
  // web searches the app plans from the offer, or Maps. Feed finds arrive
  // without either. Nothing here is for the user to set — it says whether the
  // empty list is "nothing yet" or "nothing can look".
  const mapsReady = home.profile.target_segments.length > 0 && !!(home.profile.target_area || home.profile.location);
  const webReady = !!home.hunting?.webReady && !noOffer && !home.hunting?.unreadable;
  const searching = mapsReady || webReady;

  /* Path — what was Today: the call, what needs you, and what broke, said beside it */
  const ownMoves = [...home.moves, ...(home.callMove ? [home.callMove] : [])].filter((m) => m.job !== 'watch');
  const done = doneForYou({
    now,
    lastCronRun: home.lastCronRun,
    jobsRun: home.jobsRun,
    matchCreated: home.pipeline.map((r) => r.opportunity.created_at),
    matchesWaiting: good.filter((i) => i.from === 'business' && i.fresh).length,
    matchesBelow: feed.filter((i) => i.from === 'business' && i.fresh && i.below).length,
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
  // A brand new account: nothing to call, nothing found, nothing handed over.
  // One card that says what is happening beats five empty sections.
  const nothingYet = !home.decision && !home.insight && !queueCount && !home.moves.length && !home.pipeline.length && !home.commissions.length;

  const d = home.diagnosis;
  // The ladder counts from the same funnel the path to money shows, so a
  // milestone and the machine cannot disagree about how many were sent.
  const count = (k: string) => d.stages.find((st) => st.key === k)?.count ?? 0;
  const funnel = { sent: count('sent'), replied: count('replied'), won: count('won') };
  // The goal the path points at: the first by the user's own priority, a money
  // one when there is one — money is the goal a plan can walk back from.
  const primaryGoal = home.goals.find((g) => g.metric === 'currency') ?? home.goals[0] ?? null;
  // Sends by date, from the ledger. The pipeline's own executions are the
  // fallback for a payload from before the ledger carried them; it only holds
  // the 200 best-scored businesses, so on its own it misses sends.
  const sentAt = home.recent.sentAt ?? home.pipeline.map((r) => r.execution?.sent_at).filter((x): x is string => !!x);
  const sentFortnight = sentAt.filter((t) => Date.parse(t) >= now.getTime() - 14 * 86_400_000).length;
  const pastInput = {
    now,
    timezone: home.profile.timezone,
    outcomes: home.recent.outcomes,
    focus: home.recent.focus,
    commissions: home.commissions,
    decisions: home.decisionLog,
    // The same rows the ladder counts, so a step dated in the past is one the ladder has.
    firsts: d.firsts ?? null,
    currency,
    marks: home.roadmap?.marks ?? [],
  };
  const ladder = pathLadder({
    offerSet: !noOffer,
    ...funnel,
    goal: primaryGoal ? { title: primaryGoal.title, target: primaryGoal.target_value, current: primaryGoal.current_value, money: primaryGoal.metric === 'currency', unit: primaryGoal.unit } : null,
    currency: primaryGoal?.unit || currency,
  });
  // The drawn plan, when there is one. Without a model on the server, or
  // before the first draw lands, the funnel plan below stands in unchanged.
  const rm = home.roadmap;
  const plan = rm
    ? roadmapView({ enabled: rm.enabled, latest: rm.latest, current: rm.current, previous: rm.previous, marks: rm.marks, goals: home.goals, capacity: home.profile.capacity, now })
    : { state: 'off' as const };
  // Whether opening the app should draw: only for what the person said since
  // the last plan (roadmapDue), never over a read that failed.
  const planDue = rm?.enabled && !rm.unreadable
    ? roadmapDue({
        latest: rm.latest, current: rm.current, now, trigger: 'open',
        signature: roadmapSignature({
          goals: home.goals,
          working: home.working.filter((w) => w.status === 'live').map((w) => ({ id: w.id, body: w.body })),
          contextCount: home.contextCount,
          capacity: home.profile.capacity,
          offer: home.profile.offer ?? null,
        }),
      })
    : null;
  const first = roadmapFirstStep(plan);
  const counted = pathHere(ladder, funnel);
  // Where you are, in the plan's words when it has some, with the counts under
  // it only once something has been sent — "0 sent · 0 replied · 0 paid" says
  // nothing to somebody whose path is not a sales funnel.
  const here = plan.state === 'ready' && plan.here
    ? { title: plan.here.title, line: plan.here.line ?? '', counts: funnel.sent > 0 ? counted.line : null }
    // A plan on its way, and nothing sent: the funnel's "Nothing sent yet"
    // would name a path this person may not be on. Their goal is the fact.
    : plan.state !== 'off' && funnel.sent === 0
    ? { title: 'At the start', line: primaryGoal ? `Toward ${primaryGoal.title}` : 'Name a goal and the plan is drawn from it', counts: null }
    : { ...counted, counts: null };
  // The one move. What it takes from the lists below is not repeated in them.
  const move = pathNow({
    noOffer,
    callPending: !!home.decision && home.decision.response === 'pending',
    queue: { count: noOffer ? 0 : queueCount, oldestDays },
    asks,
    moves: worthDoing(home.moves, Number.POSITIVE_INFINITY).shown,
    capacity: home.profile.capacity,
    funnel,
    freshMatches: good.filter((i) => i.from === 'business' && i.fresh).length,
    hasPlan: plan.state === 'ready',
    planStep: first ? { item: first.step.id, title: first.step.title, milestone: first.milestone.title, why: first.milestone.why, size: SIZE_LABEL[first.step.size] } : null,
  });
  const nowMoveId = move.now.kind === 'move' ? move.now.id : null;
  const ticked = [...markMap(home.roadmap?.marks ?? []).values()].filter((m) => m.state === 'done').map((m) => m.at);
  const movedWeek = pathWeek({ now, timezone: home.profile.timezone, sentAt, outcomes: home.recent.outcomes, answered: home.recent.answered, ticked });
  const bottleneck = d.findings.find((f) => f.kind === 'bottleneck') ?? null;
  const path = {
    ladder,
    here,
    now: move.now,
    also: move.also,
    past: pathPast(pastInput),
    pastAll: pathPast(pastInput, Number.POSITIVE_INFINITY),
    next: pathNext({ moves: nowMoveId ? home.moves.filter((m) => m.id !== nowMoveId) : home.moves, commissions: home.commissions }),
    ahead: pathAhead({
      ladder,
      funnel,
      goal: primaryGoal,
      others: home.goals.filter((g) => g.id !== primaryGoal?.id),
      price: priceOf(home.profile.offer?.price_band),
      currency: primaryGoal?.unit || currency,
      capacity: home.profile.capacity,
      sentFortnight,
      bottleneck: bottleneck ? { headline: bottleneck.headline, action: bottleneck.action } : null,
    }),
    week: movedWeek,
    fortnight: sentFortnight,
    plan,
    planDue,
    goals: goalMarkers(home.goals, plan, currency),
    // Drafts from a blank offer are not on To send (above), so they are not waiting to be sent either.
    swap: pathSwap({ now, timezone: home.profile.timezone, focus: home.recent.focus, sentAt, outcomes: home.recent.outcomes, queueCount: noOffer ? 0 : queueCount }),
  };

  /* Work — the path to money and the team running it */
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
    web: webReady,
  });
  const team = agentRoster({
    now,
    supplyLastRun: home.supplyLastRun,
    sourced: home.metrics.pipeline.sourced,
    // Maps targeting or a web search it can plan: either is the Scout with something to do.
    hasTargeting: searching,
    // A web search that should run and cannot, said on the Scout — the searches
    // have no screen of their own, so this is where a broken one shows.
    searchProblem: searchProblemOf(home, noOffer),
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
    path: planStatus(path.here, asks.length, path.week.streak),
    matches: matchesStatus(counts),
    work: workStatus(team, running),
    you: home.metrics.runway_months != null ? `${home.metrics.runway_months} months of runway` : null,
  };

  return {
    now, noOffer, queueCount, oldestDays, queueBacked, currency,
    done, asks, nothingYet, path,
    feed, good, counts, stages, searching,
    machine, team, running,
    review, week,
    status,
  };
}

function searchProblemOf(home: HomeData, noOffer: boolean): string | null {
  const h = home.hunting;
  if (!h?.webReady || noOffer) return null;
  if (h.unreadable) return h.unreadable;
  // The run before the searches: when the plan could not be made, none ran to fail on its own.
  const failed = h.lastError ?? h.hunts.find((x) => x.last_error && !x.last_error.startsWith('Retired'))?.last_error;
  return failed ? `Web search failed last run: ${failed}` : null;
}

export type Derived = ReturnType<typeof derive>;

export function useDerived(home: HomeData): Derived {
  return useMemo(() => derive(home), [home]);
}
