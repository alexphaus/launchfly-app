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
import { agentRoster } from '@/lib/copilot/machine';
import { LINK_LABEL, businessChain, teamLine, waitingOnYou } from '@/lib/copilot/business';
import { assetGaps } from '@/lib/copilot/assets';
import { historyOf } from '@/lib/copilot/history';
import { labView, openIntros } from '@/lib/copilot/lab';
import { chainInputOf, foundOf, proofLine, saidOf } from '@/lib/copilot/proof';
import { matchCounts, matchFeed, stageCards } from '@/lib/copilot/matches';
import { offerIsEmpty } from '@/lib/copilot/offer';
import { pathLadder, pathNext, pathPast, pathSwap, pathWeek } from '@/lib/copilot/pathway';
import { pathAhead, pathHere, pathNow, planStatus, priceOf } from '@/lib/copilot/plan';
import { SIZE_LABEL, goalMarkers, markMap, moneyWaiting, replacesCall, roadmapDue, roadmapFirstStep, roadmapLeadGoal, roadmapSignature, roadmapView } from '@/lib/copilot/roadmap';
import { VERDICT_WORDS, goalOutlooks } from '@/lib/copilot/outlook';
import { weekReview } from '@/lib/copilot/review';
import { doneForYou, needsYou, worthDoing } from '@/lib/copilot/today';
import { oldestWaitDays, queueIsBacked } from '@/lib/copilot/triage';
import type { HomeData } from '@/lib/copilot/types';
import { moneyForPlan } from '@/lib/copilot/money/ledger';
import type { Tab2 } from '../shared';
import { salesCurrency } from '@/lib/copilot/metrics';

export function derive(home: HomeData) {
  const now = new Date(home.generatedAt);
  const noOffer = offerIsEmpty(home.profile.offer);
  const queueCount = home.queue.length;
  const oldestDays = oldestWaitDays(home.queue.map((q) => q.execution.created_at), now);
  const queueBacked = queueIsBacked(queueCount, oldestDays);
  // Sales money: the goal's currency. Runway's is the finance row's, which follows the bank.
  const currency = salesCurrency(home.profile.finance, home.goals);

  /* The matches — first, because Today reports how many of last night's finds are still waiting in the deck. */
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
  // Introductions somebody offered and nobody has followed up: on the Path,
  // because they are lost by waiting, and on Proof beside the conversations.
  const intros = openIntros(home.lab?.talks ?? [], home.lab?.intros, home.recent.today);
  const asks = needsYou({
    commissions: home.commissions,
    capture: home.capture,
    queue: { count: queueCount, oldestDays },
    queueIsCall: home.callMove?.job === 'send_queue',
    noOffer,
    intros,
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
    experiments: home.roadmap?.experiments ?? [],
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
    ? roadmapView({ enabled: rm.enabled, latest: rm.latest, current: rm.current, previous: rm.previous, marks: rm.marks, goals: home.goals, capacity: home.profile.capacity, now, experimentMarks: rm.experiments ?? [], today: home.recent.today })
    : { state: 'off' as const };
  // Will it work, per goal, live: the same arithmetic the draw handed the
  // planner (outlook.ts), from this morning's rows rather than last night's. A
  // goal with no number is measured by the plan's milestones for it.
  const byGoal: Record<string, { done: number; open: number }> = {};
  if (plan.state === 'ready') for (const ph of plan.phases) for (const m of ph.milestones) {
    if (!m.goalId || m.state === 'dropped') continue;
    const e = byGoal[m.goalId] ?? { done: 0, open: 0 };
    if (m.state === 'done') e.done += 1; else e.open += 1;
    byGoal[m.goalId] = e;
  }
  const outlooks = goalOutlooks(home.goals, {
    today: home.recent.today,
    price: priceOf(home.profile.offer?.price_band),
    selling: !noOffer,
    currency,
    capacity: home.profile.capacity,
    funnel: { windowDays: home.metrics.window_days, sent: home.metrics.sent, won: home.metrics.won, wonAmount: home.metrics.won_amount },
    milestones: byGoal,
  });
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
          // The same fingerprint the server stores on the draw, off the same rows (moneyForPlan).
          money: moneyForPlan(home.money?.read ?? null).signature,
        }),
      })
    : null;
  const first = roadmapFirstStep(plan);
  // A call picked before the plan on screen was drawn, and still unanswered:
  // the server re-picks it once the redraw lands (refreshCallFromPlan), but the
  // screen can reload first, and a card telling you to send the old drafts over
  // a plan that says to rewrite them first is worse than either. So the plan's
  // step is the move until the call catches up — the same rule, replacesCall.
  const staleCall = plan.state === 'ready' && replacesCall(
    home.decision,
    first ? { headline: first.step.title } : null,
    moneyWaiting(home.callMove),
  );
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
    callPending: !!home.decision && home.decision.response === 'pending' && !staleCall,
    queue: { count: noOffer ? 0 : queueCount, oldestDays },
    asks,
    moves: worthDoing(home.moves, Number.POSITIVE_INFINITY).shown,
    capacity: home.profile.capacity,
    funnel,
    freshMatches: good.filter((i) => i.from === 'business' && i.fresh).length,
    hasPlan: plan.state === 'ready',
    planStep: first ? {
      item: first.step.id, title: first.step.title, milestone: first.milestone.title, size: SIZE_LABEL[first.step.size],
      // "Send the waiting drafts": the plan asked for the drafts, so the move is the send card, sized to the day, with its one tap to them.
      sends: /\bdrafts?\b/i.test(first.step.title),
    } : null,
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
      today: home.recent.today,
    }),
    week: movedWeek,
    fortnight: sentFortnight,
    plan,
    planDue,
    goals: goalMarkers(home.goals, plan, currency, home.recent.today, new Map(outlooks.map((o) => [o.goalId, VERDICT_WORDS[o.verdict]]))),
    // Whether the goal the plan leads with gets there in time, said under "you
    // are here" — the goal of its first open milestone, else the person's first.
    // It was a block of its own above the plan, one card per goal, and every
    // verdict in it was said again on the goal markers at the foot of the plan:
    // the most important line on the screen, in a box, twice. The rest of the
    // goals carry theirs on their markers.
    verdict: (() => {
      const lead = roadmapLeadGoal(plan) ?? home.goals[0]?.id ?? null;
      return outlooks.find((o) => o.goalId === lead) ?? null;
    })(),
    // Drafts from a blank offer are not on To send (above), so they are not waiting to be sent either.
    // Not over a drawn plan: the swap only ever says "send the drafts" or "move
    // hours to sending", and with a plan that is the plan's call to make. Alex's
    // Path said "send the drafts first" in the evidence while the plan under it
    // said to rewrite the opener before sending more like them.
    swap: plan.state === 'ready' ? null : pathSwap({ now, timezone: home.profile.timezone, focus: home.recent.focus, sentAt, outcomes: home.recent.outcomes, queueCount: noOffer ? 0 : queueCount }),
  };

  /* The team: each agent placed on the part of the business it runs, and one line for Proof */
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
  // The chain is read from the same rows the funnel counts (proof.ts), with the
  // bets, conversations and assets the person keeps for what the app cannot see.
  const said = saidOf(home);
  const found = foundOf(home);
  const chain = businessChain(chainInputOf(home, {
    agents: team,
    worthAMessage: good.filter((i) => i.from === 'business').length,
    webReady,
    currency,
    topOpening: d.openings[0]?.term ?? null,
  }));
  const running = home.commissions.filter((t) => t.commission.status === 'active' || t.commission.status === 'blocked').length;

  /* Proof — the verdict, the bet that moves it, the assets, the history. One
     tab, because whether the business is proven and what is being bet to find
     out are one question: the part a play is offered for is the part the
     verdict calls weak, and a checkpoint reads its decision back against the
     verdicts on the same screen. */
  const lab = labView(home.lab, { runwayMonths: home.metrics.runway_months, links: chain.links, today: home.recent.today });
  const assets = home.assets?.assets ?? [];
  const states = Object.fromEntries(chain.links.map((l) => [l.key, l.state]));
  const proof = {
    chain,
    said,
    found,
    lab,
    /** Every bet, newest first, for what links to one: an asset made for it, a row in the history. */
    bets: home.lab?.bets ?? [],
    assets,
    assetsUnreadable: home.assets?.unreadable ?? null,
    gaps: assetGaps({ assets, offer: home.profile.offer, weak: chain.weak, foundBy: found.value, states }),
    history: historyOf({
      bets: home.lab?.bets ?? [],
      checkpoints: home.lab?.checkpoints ?? [],
      talks: home.lab?.talks ?? [],
      assets,
      projects: home.commissions.map((t) => ({ id: t.commission.id, objective: t.commission.objective, status: t.commission.status, outcome: t.commission.outcome, closedAt: t.commission.closed_at })),
      wins: home.wins ?? [],
      experiments: home.roadmap?.experiments ?? [],
      currency,
      timezone: home.profile.timezone,
    }),
    team: teamLine(team),
    waiting: waitingOnYou(home.commissions),
    intros,
  };

  const review = weekReview({
    now,
    today: home.recent.today,
    timezone: home.profile.timezone,
    outcomes: home.recent.outcomes,
    answered: home.recent.answered,
    focus: home.recent.focus,
    commissions: home.commissions.map((t) => t.commission),
    queue: {
      count: queueCount,
      oldestDays,
      // By name and age, for the waste line that opens: named the way the queue sheet names them.
      drafts: home.queue.map((q) => ({ who: q.opp?.title || q.title.replace(/^Opener to /, '').replace(/, ready to review$/, ''), createdAt: q.execution.created_at })),
    },
    sources: {
      total: home.watchSources.length,
      failing: home.watchSources.filter((s) => !!s.last_error).length,
      failed: home.watchSources.filter((s) => !!s.last_error).map((s) => ({ label: s.label || s.url, error: s.last_error!, checkedAt: s.last_checked_at })),
    },
    decisions: home.decisionLog,
    edge: home.edge,
    bottleneck: d.findings.find((f) => f.kind === 'bottleneck') ?? null,
    runwayMonths: home.metrics.runway_months,
    currency,
    // The same sends the week's dots count, so "2 of 5 sent this week" and the dots cannot disagree.
    sentAt,
    marks: home.roadmap?.marks ?? [],
  });
  const week = focusWeek(home.recent.focus, home.recent.today);

  const status: Record<Tab2, string | null> = {
    path: planStatus(asks.length, path.week.streak),
    // The deck has no header: the card is the screen, and its own top line counts what is left.
    swipe: null,
    proof: proofLine(chain, { current: lab.current, checkpoint: lab.checkpoint, part: lab.current ? LINK_LABEL[lab.current.bet.part].toLowerCase() : null }, proof.waiting),
    // The balance is the first thing on the tab; a header saying it again is noise.
    money: null,
    you: home.metrics.runway_months != null ? `${home.metrics.runway_months} months of runway` : null,
  };

  return {
    now, noOffer, queueCount, oldestDays, queueBacked, currency,
    done, asks, nothingYet, path,
    feed, good, counts, stages, searching,
    team, running, proof,
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
