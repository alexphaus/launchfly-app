// src/app/api/copilot/mcp/read.ts
// The connector's tools, run for one person: the home loaded as the app loads
// it, derived as the screens derive it (derive.ts), and handed to the pure
// renderers (lib/copilot/mcpread.ts). Here rather than in lib because derive()
// is the four tabs' own wiring, and the point is that Claude reads the numbers
// the Path and Proof show, not a second count of them.

import { derive } from '@/app/copilot/_components/v2/derive';
import { LINK_LABEL, LINK_STATE_LABEL } from '@/lib/copilot/business';
import { markSeen } from '@/lib/copilot/connector';
import { talkTotals } from '@/lib/copilot/ideas';
import { decisionWords, gradeWords, passLine, playOf, resultLine, talkCounts, type BetView } from '@/lib/copilot/lab';
import { readingLine } from '@/lib/copilot/reading';
import { answersText, conversationsText, overviewText, planText, proofText, type AskIn, type BetIn, type NowIn } from '@/lib/copilot/mcpread';
import type { ToolName, ToolOutcome } from '@/lib/copilot/mcp';
import { FOUND_BY_LABEL } from '@/lib/copilot/offer';
import { VERDICT_WORDS } from '@/lib/copilot/outlook';
import { answersFor, handoffFor } from '@/lib/copilot/readouts';
import { SIZE_LABEL, TAG_LABEL } from '@/lib/copilot/roadmap';
import { loadHome } from '@/lib/copilot/store';
import { getProfile } from '@/lib/copilot/base';
import { todayIso } from '@/lib/copilot/db';
import { ASK_LABEL } from '@/lib/copilot/today';
import type { FoundBy, HomeData } from '@/lib/copilot/types';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * One tool, for the person the token is theirs. The read is recorded before it
 * is made, and not made if it cannot be: the list under You → Claude is the
 * person's only view of what Claude has read. A failure is said to Claude, which
 * says it to the person, and recorded beside the connection where the app shows it.
 */
export async function runTool(name: ToolName, args: Record<string, unknown>, who: { pid: string; grant: string }): Promise<ToolOutcome> {
  try {
    await markSeen(who.pid, who.grant, name, null);
  } catch (e) {
    return { text: `The app could not record this read, so it read nothing: ${message(e)}`, isError: true };
  }
  try {
    return { text: await readTool(name, args, who.pid) };
  } catch (e) {
    const why = message(e);
    let unrecorded = '';
    try { await markSeen(who.pid, who.grant, name, why); } catch (e2) { unrecorded = ` It could not be noted in the app either: ${message(e2)}.`; }
    return { text: `The app could not read that: ${why}.${unrecorded}`, isError: true };
  }
}

async function readTool(name: ToolName, args: Record<string, unknown>, pid: string): Promise<string> {
  if (name === 'get_record') return handoffFor(pid);
  if (name === 'get_counted_answers') {
    // Only the person's day is needed beside the answers, and the whole home is a long way to go for it.
    const [answers, profile] = await Promise.all([answersFor(pid), getProfile(pid)]);
    return answersText(answers, todayIso(profile?.timezone ?? 'UTC'));
  }
  const home = await loadHome(pid);
  if (!home) throw new Error('There is no account here any more');
  const d = derive(home);
  switch (name) {
    case 'get_overview': return overviewOf(home, d);
    case 'get_plan': return planOf(home, d);
    case 'get_proof': return proofOf(home, d);
    case 'get_conversations': return conversationsOf(home, d, typeof args.limit === 'number' ? args.limit : 20);
  }
}

type Derived = ReturnType<typeof derive>;

/** Reads the home made and could not finish, said by name with their reasons. */
function missingOf(home: HomeData, parts: Array<'lab' | 'plan' | 'assets' | 'recent'>): string[] {
  return [
    parts.includes('lab') && home.lab?.unreadable ? `bets and conversations (${home.lab.unreadable})` : null,
    parts.includes('plan') && home.roadmap?.unreadable ? `the plan (${home.roadmap.unreadable})` : null,
    parts.includes('assets') && home.assets?.unreadable ? `assets (${home.assets.unreadable})` : null,
    ...(parts.includes('recent') ? (home.recent.unreadable ?? []).map((u) => `recent activity (${u})`) : []),
  ].filter((x): x is string => !!x);
}

function betOf(v: BetView, found: FoundBy | null): BetIn {
  const play = playOf(v.bet);
  return {
    belief: v.bet.belief,
    part: LINK_LABEL[v.bet.part],
    state: v.state,
    result: resultLine(v),
    pass: passLine(v.bet, v.last),
    start: v.bet.start,
    ended: v.ended,
    day: v.day,
    days: v.bet.days,
    note: v.note,
    play: play ? `${play.label}${play.from ? ` (${play.from})` : ''}` : null,
    // Only while it runs: an ended bet's verdict is its result, and the ladder is for reading one in progress.
    reading: v.state === 'running' ? readingLine(v, found) : null,
  };
}

function nowOf(d: Derived): NowIn | null {
  const n = d.path.now;
  return n ? { title: n.title, why: n.why, size: n.size } : null;
}

const asksOf = (d: Derived): AskIn[] => d.path.also.map((a) => ({ kind: ASK_LABEL[a.kind], title: a.title, detail: a.detail }));

function overviewOf(home: HomeData, d: Derived): string {
  const chain = d.proof.chain;
  const v = d.path.verdict;
  return overviewText({
    today: home.recent.today,
    offer: home.profile.offer ?? null,
    foundBy: d.proof.found.value ? FOUND_BY_LABEL[d.proof.found.value] : null,
    here: d.path.here,
    goals: d.path.goals.map((g) => ({ title: g.title, status: g.status, horizon: g.horizon, verdict: g.verdict ?? null })),
    outlook: v ? { title: v.title, verdict: VERDICT_WORDS[v.verdict], line: v.line } : null,
    runwayMonths: home.metrics.runway_months,
    verdict: chain.verdict,
    links: chain.links.map((l) => ({ label: l.label, state: LINK_STATE_LABEL[l.state], why: l.why })),
    weak: chain.weak ? LINK_LABEL[chain.weak] : null,
    bet: d.proof.lab.current ? betOf(d.proof.lab.current, d.proof.found.value) : null,
    checkpointDue: d.proof.lab.checkpoint.due,
    now: nowOf(d),
    asks: asksOf(d),
    missing: missingOf(home, ['lab', 'plan']),
  });
}

function planOf(home: HomeData, d: Derived): string {
  const p = d.path.plan;
  return planText({
    today: home.recent.today,
    now: nowOf(d),
    asks: asksOf(d),
    here: d.path.here,
    plan: p.state === 'ready' ? {
      here: p.here ?? null,
      direction: p.direction,
      done: p.done,
      total: p.total,
      drawnAt: p.drawnAt,
      failed: p.failed,
      phases: p.phases.map((ph) => ({
        label: ph.label,
        milestones: ph.milestones.map((m) => ({
          title: m.title, why: m.why, doneWhen: m.doneWhen, goal: m.goalTitle, state: m.state,
          steps: m.steps.map((s) => ({ title: s.title, size: SIZE_LABEL[s.size], tag: TAG_LABEL[s.tag], who: s.who, state: s.state })),
        })),
      })),
    } : null,
    ahead: d.path.ahead.stops.map((s) => ({ title: s.title, status: s.status, takes: s.takes, when: s.when, early: s.early })),
    missing: missingOf(home, ['plan', 'recent']),
  });
}

function proofOf(home: HomeData, d: Derived): string {
  const chain = d.proof.chain;
  const cp = d.proof.lab.checkpoint;
  return proofText({
    today: home.recent.today,
    verdict: chain.verdict,
    links: chain.links.map((l) => ({ label: l.label, state: LINK_STATE_LABEL[l.state], what: l.what, facts: l.facts, why: l.why })),
    weak: chain.weak ? LINK_LABEL[chain.weak] : null,
    bets: d.proof.bets.map((b) => betOf(b, d.proof.found.value)),
    checkpoint: { due: cp.due, last: cp.last ? { on: cp.last.on, decision: decisionWords(cp.last), grade: gradeWords(cp.last, cp.grade) } : null },
    history: d.proof.history.map((h) => ({ day: h.day, title: h.title, line: h.line })),
    missing: missingOf(home, ['lab', 'assets']),
  });
}

function conversationsOf(home: HomeData, d: Derived, limit: number): string {
  const talks = home.lab?.talks ?? [];
  return conversationsText({
    today: home.recent.today,
    talks,
    intros: d.proof.intros,
    counts: talkCounts(talks, home.recent.today),
    totals: talkTotals(talks),
    limit,
    missing: missingOf(home, ['lab']),
  });
}
