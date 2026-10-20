// Everything the tabs render, derived once from HomeData.
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
import { businessChain, verdictCount, waitingOnYou } from '@/lib/copilot/business';
import { crewLine, crewOf } from '@/lib/copilot/crew';
import { builtSoFar, engineStep, payoffGoal, type Step, type StepPlay } from '@/lib/copilot/engine';
import { callRecord, decideCards, decideCount, type DecideInput, type PayerAsk } from '@/lib/copilot/decide';
import { SCOUT_SEARCHING, stepBusy } from '@/lib/copilot/betplan';
import { betVoiced, betVoices, voiceRefusal } from '@/lib/copilot/voices';
import { unitSignal } from '@/lib/copilot/signal';
import { secondPerson } from '@/lib/copilot/you';
import { lapsedOn } from '@/lib/copilot/commission';
import { assetGaps } from '@/lib/copilot/assets';
import { historyOf } from '@/lib/copilot/history';
import { betPrice, labView, openIntros, playOf, resultLine, unitPage, type LabView } from '@/lib/copilot/lab';
import { proposalLine } from '@/lib/copilot/proposals';
import { chainInputOf, foundOf, saidOf } from '@/lib/copilot/proof';
import { matchCounts, matchFeed, stageCards } from '@/lib/copilot/matches';
import { isFoundBy, offerIsEmpty } from '@/lib/copilot/offer';
import { pathLadder, pathNext, pathPast, pathSwap, pathWeek } from '@/lib/copilot/pathway';
import { pathAhead, pathHere, pathNow, priceOf } from '@/lib/copilot/plan';
import { SIZE_LABEL, goalMarkers, markMap, moneyWaiting, replacesCall, roadmapDue, roadmapFirstStep, roadmapLeadGoal, roadmapSignature, roadmapView } from '@/lib/copilot/roadmap';
import { VERDICT_WORDS, goalOutlooks } from '@/lib/copilot/outlook';
import { weekReview } from '@/lib/copilot/review';
import { brokeLines, doneForYou, moneyLine, needsYou, systemLine, worthDoing } from '@/lib/copilot/today';
import { oldestWaitDays, queueIsBacked } from '@/lib/copilot/triage';
import type { HomeData } from '@/lib/copilot/types';
import { moneyForPlan, readMoney } from '@/lib/copilot/money/ledger';
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

  /* What needs you — the call, the asks, and what broke, said beside them. Path showed these until Decide took them. */
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
  // Introductions somebody offered and nobody has followed up: a card on Decide,
  // because they are lost by waiting, and on System beside the conversations.
  const intros = openIntros(home.lab?.talks ?? [], home.lab?.intros, home.recent.today);
  const asks = needsYou({
    commissions: home.commissions,
    capture: home.capture,
    queue: { count: queueCount, oldestDays },
    queueIsCall: home.callMove?.job === 'send_queue',
    noOffer,
    intros,
    today: home.recent.today,
    proposals: (home.proposals?.open ?? []).map((p) => ({ id: p.id, line: proposalLine(p, betPrice(home.profile.offer?.price_band, currency).priceLabel), why: p.why, at: p.at, kind: p.kind })),
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
    viaSends: isFoundBy(home.profile.offer?.found_by) ? home.profile.offer!.found_by === 'outreach' : undefined,
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
    today: home.recent.today,
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
  const chainInput = chainInputOf(home, {
    agents: team,
    worthAMessage: good.filter((i) => i.from === 'business').length,
    webReady,
    currency,
    topOpening: d.openings[0]?.term ?? null,
  });
  const chain = businessChain(chainInput);
  const running = home.commissions.filter((t) => t.commission.status === 'active' || t.commission.status === 'blocked').length;

  /* Proof — the verdict, the bet that moves it, the assets, the history. One
     tab, because whether the business is proven and what is being bet to find
     out are one question: the part a play is offered for is the part the
     verdict calls weak, and a checkpoint reads its decision back against the
     verdicts on the same screen. */
  const lab = labView(home.lab, { runwayMonths: home.metrics.runway_months, links: chain.links, today: home.recent.today });
  const assets = home.assets?.assets ?? [];
  const states = Object.fromEntries(chain.links.map((l) => [l.key, l.state]));
  // Who works each part (crew.ts): the roster placed where the chain names it,
  // Claude, and the person with what waits on them.
  const crew = crewOf({
    agents: team,
    links: chain.links,
    asks: asks.length,
    proposals: home.proposals?.open.length ?? 0,
    hired: home.workers ?? [],
    bet: lab.current
      ? {
        part: lab.current.bet.part,
        projects: (lab.links[lab.current.bet.id] ?? []).filter((id) => home.commissions.some((t) => t.commission.id === id && (t.commission.status === 'active' || t.commission.status === 'blocked'))).length,
      }
      : null,
  });
  const history = historyOf({
    bets: home.lab?.bets ?? [],
    checkpoints: home.lab?.checkpoints ?? [],
    talks: home.lab?.talks ?? [],
    assets,
    projects: home.commissions.map((t) => ({ id: t.commission.id, objective: t.commission.objective, status: t.commission.status, outcome: t.commission.outcome, closedAt: t.commission.closed_at })),
    wins: home.wins ?? [],
    experiments: home.roadmap?.experiments ?? [],
    currency,
    timezone: home.profile.timezone,
  });
  const proof = {
    chain,
    /** The verdict's count as numbers, for the engine's figure (business.ts verdictCount). */
    count: verdictCount(chainInput),
    crew,
    crewLine: crewLine(crew),
    said,
    found,
    lab,
    /** Every bet, newest first, for what links to one: an asset made for it, a row in the history. */
    bets: home.lab?.bets ?? [],
    assets,
    assetsUnreadable: home.assets?.unreadable ?? null,
    gaps: assetGaps({ assets, offer: home.profile.offer, weak: chain.weak, foundBy: found.value, states, online: home.page ? (home.page.unreadable ? undefined : home.page.live?.asset ?? null) : undefined }),
    history,
    /** What the engine has to show for itself, newest first (engine.ts builtSoFar). */
    built: builtSoFar(history),
    waiting: waitingOnYou(home.commissions, home.recent.today),
    /** Projects waiting on a day that has passed: said under Projects with Stop, counted as neither waiting nor a slot. */
    lapsed: home.commissions.filter((t) => !!lapsedOn(t.commission, home.recent.today)).length,
    intros,
  };

  /* Decide — every card that waits on the person, ahead of the people worth a message.
     Read here with no posts opened: which posts this device opened is the
     device's (engine.ts parseOpened), and an opened post is the same one card,
     so the count on the badge and the pile under it agree. */
  const step = stepOf(home, lab, chain, found.value, noOffer, now);
  const voices = step.voices?.open ?? [];
  // What broke, said once as a card on Decide and counted in System's subheader (invariant 13).
  const broke = brokeLines({ now, unread: home.recent.unreadable, done, lastCronRun: home.lastCronRun });
  // Money in that the bank names and the person has not: a client's payment is a sale, so it is asked on Decide.
  const read = home.money?.read ?? null;
  const payers: PayerAsk[] = read
    ? read.toName.map((p) => ({
      key: p.key, name: p.name, total: readMoney(read)(p.total), count: p.count, last: p.last,
      looksLike: home.money?.suggest[p.key]?.title ?? null,
    }))
    : [];
  const cur = lab.current;
  const decideInput: Omit<DecideInput, 'opened'> = {
    noOffer,
    callPending: move.now.kind === 'call',
    callHandsOver: home.callMove?.artifact?.kind === 'plan',
    call: home.decision ? { headline: home.decision.headline, record: callRecord(home.decisionLog, home.decision.id) } : null,
    now: move.now,
    asks,
    step: step.step,
    bet: cur ? { belief: cur.bet.belief, line: `day ${cur.day} of ${cur.bet.days}, ${resultLine(cur)}` } : null,
    voices,
    pivotLeft: !!home.pivotLeft,
    checkpoint: { due: lab.checkpoint.due, ended: lab.checkpoint.ended.length },
    cannotSearch: !searching,
    // As the Path drew it: nothing to do and no call picked — the brief has not run.
    noCall: !home.decision && move.now.kind === 'rest',
    payers,
    broke,
    today: home.recent.today,
    timezone: home.profile.timezone,
  };
  const decide = decideCards({ ...decideInput, opened: {} });

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
    // The deck says its own line — how many are left in the pile as it stands on this phone (SwipeTab.tsx deckLine).
    swipe: null,
    // When the nightly run last ran and what of it failed: the pulse of what
    // runs without you. Not the verdict or the bet — those are the first two
    // cards, and "Not proven · day 2 of 14 on who buys" said them again.
    proof: systemLine({ now, lastCronRun: home.lastCronRun, stale: done.stale, broke: done.broke.length, failing: home.watchSources.filter((s) => !!s.last_error).length }),
    // How long the money lasts, which the tab does not say: it shows the balance and what is safe today.
    money: moneyLine({ runwayMonths: home.metrics.runway_months, toName: read?.toName.length ?? 0 }),
    // Runway is the first tile on You; "1.7 months of runway" sat directly over it.
    you: null,
  };

  return {
    now, noOffer, queueCount, oldestDays, queueBacked, currency,
    done, asks, nothingYet, path,
    /** The bet's step and its people (engine.ts), read once for Decide and System alike. */
    step,
    decide, decideInput, decideNeeds: decideCount(decide),
    feed, good, counts, stages, searching,
    team, running, proof,
    review, week,
    status,
  };
}

/**
 * The running bet's next step (engine.ts engineStep) and the people it found,
 * off the rows. Read with no posts opened: the posts are Decide's cards, each
 * one, so the step that says "reply to one of them" is never a card of its own.
 */
function stepOf(
  home: HomeData,
  lab: LabView,
  chain: ReturnType<typeof businessChain>,
  found: ReturnType<typeof foundOf>['value'],
  noOffer: boolean,
  now: Date,
): { step: Step | null; voices: ReturnType<typeof betVoices> | null } {
  const view = lab.current;
  const b = view?.bet ?? null;
  const read = home.lab?.voices;
  const voices = view && b && betVoiced(b) ? betVoices(read, b, home.lab?.talks ?? []) : null;
  // Said the same way the route refuses it, so a button that could only be refused is not the step —
  // and not while the plan's Scout is searching, so a tap does not start a second search beside it.
  const searchRefusal = voices
    ? read?.unreadable
      ? 'The people found for this bet could not be read just now.'
      : stepBusy(lab.planRuns, 'find', now)
      ? SCOUT_SEARCHING
      : voiceRefusal({ running: true, voiced: true, searches: voices.searches, ready: !!home.hunting?.webReady, remaining: home.billing.matches.remaining })
    : null;
  const weak = chain.weak ? chain.links.find((l) => l.key === chain.weak) ?? null : null;
  // The play the bet runs, and what a step can do for it (engine.ts StepPlay).
  const played = b ? playOf(b) : null;
  const play: StepPlay | null = b && played ? {
    label: secondPerson(played.label), how: secondPerson(played.how),
    counted: home.signals?.made && unitSignal(b.unit) ? 'link' : home.page?.live && unitPage(b.unit) ? 'page' : null,
    script: (home.assets?.assets ?? []).find((a) => a.kind === 'script' && !a.retired && a.versions.some((v) => v.bet === b.id))?.id ?? null,
    canDraft: !!home.ai && !noOffer,
    pageOnline: !!home.page?.live,
  } : null;
  const step = engineStep({
    today: home.recent.today, offerSet: !noOffer, unreadable: !!lab.unreadable,
    checkpoint: { due: lab.checkpoint.due, ended: lab.checkpoint.ended.length },
    current: view, talks: lab.talks, found, voices, opened: new Set<string>(), searchRefusal,
    shelf: lab.shelf, weak: weak ? { key: weak.key, label: weak.label, why: weak.why } : null,
    goal: payoffGoal(home.goals, home.recent.today),
    play,
  });
  return { step, voices };
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
