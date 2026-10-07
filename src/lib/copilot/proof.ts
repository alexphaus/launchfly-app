// src/lib/copilot/proof.ts
// Proof, assembled: the one place the home payload becomes the chain's input,
// for the screen (derive.ts) and for the model calls (proofai.ts) alike — so
// what the person sees and what a model is told about the business cannot
// disagree about a single count.
//
// Proof is the tab that answers whether the business is proven and what is
// being bet to find out. It replaced Work and the Lab, which split that one
// question into two tabs: the verdict on one, the bet that moves it on the
// other. Its parts, each from its own pure module:
//
//   the verdict   the chain (business.ts): five parts, each with a state by a
//                 rule from the rows, the weak one first
//   the bet       one at a time, judged by the rows (lab.ts), with ideas a
//                 model writes for it (ideas.ts)
//   the assets    offer, demo, script, landing page, workflow, price test — each
//                 versioned, by AI or by you, tied to its bet (assets.ts)
//   the history   everything above, dated, in one list (history.ts)
//
// Pure: no DB import.

import { ASSET_KINDS, type Asset, type AssetKind } from './assets';
import { talkTotals } from './ideas';
import { CHECKPOINT_DAYS, daysBetween, dayWords, resultLine, type BetView, type IdeaSet, type LabMetric, type Talk, type Tally } from './lab';
import { LINK_KEYS, LINK_LABEL, PIVOT_REACH, restartsOf, type Chain, type ChainBet, type ChainInput, type LinkKey } from './business';
import type { Angle } from './experiment';
import type { Agent } from './machine';
import { foundByOf, isFoundBy } from './offer';
import { SECTIONS, type WorkingSection } from './working';
import type { CommissionThread, FoundBy, HomeData } from './types';

/** What the person wrote in the working file, by section: their words, never a reading the app counted. */
export function saidOf(home: Pick<HomeData, 'working'>): Partial<Record<WorkingSection, string[]>> {
  const said: Partial<Record<WorkingSection, string[]>> = {};
  for (const sec of SECTIONS) {
    const lines = (home.working ?? []).filter((w) => w.section === sec && w.status === 'live' && w.source === 'you').map((w) => w.body);
    if (lines.length) said[sec] = lines;
  }
  return said;
}

/** The Lab's bets as the chain reads them: which part, how it stands, its count in a line. */
export function chainBets(bets: BetView[]): ChainBet[] {
  return bets.map((v) => ({
    part: v.bet.part, state: v.state, start: v.bet.start,
    line: resultLine(v), when: v.ended ? dayWords(v.ended) : null, result: v.result,
  }));
}

/** The current title of each asset that stands for a part, the newest of its kind. */
export function assetTitles(assets: Asset[]): ChainInput['assets'] {
  const of = (k: AssetKind) => assets.find((a) => a.kind === k && !a.retired)?.title ?? null;
  return { demo: of('demo'), script: of('script'), landing: of('landing_page'), workflow: of('workflow') };
}

export interface ChainExtras {
  agents: Agent[];
  /** Businesses that cleared the bar and wait in the deck (matches.ts). */
  worthAMessage: number;
  /** The app runs its own web searches for this account. */
  webReady: boolean;
  /** The sales currency (metrics.ts salesCurrency). */
  currency: string;
  /** The condition most matches share that the offer does not name. */
  topOpening: string | null;
}

/**
 * The chain's input from the home payload. Every count is the diagnosis's own,
 * so the chain and the funnel cannot disagree; the bets, talks and assets are
 * the Lab's and the asset store's, so a business the app cannot count is read
 * through what the person can.
 */
export function chainInputOf(home: HomeData, x: ChainExtras): ChainInput {
  const d = home.diagnosis;
  const count = (k: string) => d.stages.find((st) => st.key === k)?.count ?? 0;
  const goal = home.goals.find((g) => g.metric === 'currency') ?? null;
  const offer = home.profile.offer ?? {};
  return {
    offer,
    said: saidOf(home),
    segments: home.profile.target_segments,
    area: home.profile.target_area || home.profile.location || null,
    web: x.webReady,
    funnel: { matched: count('matched'), sent: count('sent'), replied: count('replied'), meetings: count('meeting'), won: count('won'), outside: d.outsideFunnel },
    worthAMessage: x.worthAMessage,
    bySegment: d.bySegment ?? [],
    byChannel: d.byChannel ?? [],
    // A diagnosis from before amounts were read still knows how many won: each
    // is a win of no known amount, never a win of zero.
    wins: d.wins ?? Array.from({ length: count('won') }, () => null),
    queue: offer.sells?.trim() ? home.queue.length : 0,
    wonRecent: { amount: home.metrics.won_amount, days: home.metrics.window_days },
    goal: goal ? { title: goal.title, target: goal.target_value, current: goal.current_value } : null,
    currency: goal?.unit || x.currency,
    workerConnected: home.workerConnected,
    agents: x.agents,
    topOpening: x.topOpening,
    foundBy: foundByOf(offer, count('sent'), count('matched')).value,
    bets: chainBets(home.lab?.bets ?? []),
    talks: talkTotals(home.lab?.talks ?? []),
    assets: assetTitles(home.assets?.assets ?? []),
    eras: erasOf(home),
  };
}

/**
 * Each part a pivot restarted, with the rows since its day: the funnel's from
 * the server (era.ts), the conversations from the log. A pivot whose counts are
 * not in the payload — one cached from before the server counted them — leaves
 * its parts read all time, as they were, rather than read as empty.
 */
export function erasOf(home: Pick<HomeData, 'lab'>): ChainInput['eras'] {
  const restarts = restartsOf(home.lab?.checkpoints ?? []);
  const out: NonNullable<ChainInput['eras']> = {};
  for (const k of LINK_KEYS) {
    const r = restarts[k];
    const counts = r ? home.lab?.eras?.[r.on] : undefined;
    if (!r || !counts) continue;
    out[k] = { ...counts, since: r.on, pivot: r.pivot, talks: talkTotals((home.lab?.talks ?? []).filter((t) => t.on >= r.on)) };
  }
  return Object.keys(out).length ? out : undefined;
}

/** "Who buys, how they hear, how they say yes and what they pay": the parts a pivot restarts, said before it is made. */
export function pivotWords(part: LinkKey): string {
  const names = PIVOT_REACH[part].map((k, n) => (n ? LINK_LABEL[k].toLowerCase() : LINK_LABEL[k]));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
}

/** How buyers find the business, and whether the person said so or the rows did. */
export function foundOf(home: HomeData): { value: ReturnType<typeof foundByOf>['value']; said: boolean } {
  const count = (k: string) => home.diagnosis.stages.find((st) => st.key === k)?.count ?? 0;
  const o = home.profile.offer;
  return isFoundBy(o?.found_by) ? { value: o!.found_by!, said: true } : foundByOf(o, count('sent'), count('matched'));
}

/** The line under the greeting on Proof: the verdict, the bet or the checkpoint, and what waits on the person. */
export function proofLine(chain: Pick<Chain, 'verdict'>, lab: { current: BetView | null; checkpoint: { due: boolean }; part: string | null }, waiting: number): string {
  const verdict = chain.verdict.proven ? 'Proven' : chain.verdict.title === 'Not started' ? 'Not started' : 'Not proven';
  const bet = lab.checkpoint.due
    ? 'checkpoint due'
    : lab.current
    ? `day ${lab.current.day} of ${lab.current.bet.days}${lab.part ? ` on ${lab.part}` : ''}`
    : 'no bet running';
  return [verdict, bet, waiting ? `${waiting} waiting on you` : null].filter(Boolean).join(' · ');
}

/** The asset kinds a business has, for a prompt: what not to suggest making twice. */
export function assetKindsOf(assets: Asset[]): AssetKind[] {
  return ASSET_KINDS.filter((k) => assets.some((a) => a.kind === k && !a.retired));
}


/* ─── The bet on the screen ───────────────────────────────────────────────── */

/** Where a bet's next count happens: a screen in the app, or a sheet to log it on. */
export type BetNextGo = 'swipe' | 'replied' | 'talk' | 'sale' | 'meeting' | 'count' | 'projects';

/**
 * What moves a bet's count, one tap from the bet: the place the thing it counts
 * happens. A sale or a meeting comes through the people written to when buyers
 * are reached by outreach, and is logged by hand every other way — "who
 * replied" is an empty list to a shop whose buyers walk in.
 */
export function betNext(metric: LabMetric, foundBy: FoundBy | null, unit: string | null): { label: string; go: BetNextGo } {
  const outbound = foundBy === 'outreach';
  switch (metric) {
    case 'sent':
    case 'replied': return { label: 'Open Swipe', go: 'swipe' };
    case 'meetings': return outbound ? { label: 'Who replied', go: 'replied' } : { label: 'Log a meeting', go: 'meeting' };
    case 'paid':
    case 'paid_at_price': return outbound ? { label: 'Who replied', go: 'replied' } : { label: 'Log a sale', go: 'sale' };
    case 'talks':
    case 'committed': return { label: 'Log a conversation', go: 'talk' };
    case 'handed': return { label: 'Hand a step over', go: 'projects' };
    case 'logged': return { label: `Log ${unit ?? 'a count'}`, go: 'count' };
  }
}

export interface BetWork {
  /** Projects handed over for it, in the order they were. */
  projects: CommissionThread[];
  /** Assets with a version made for it. */
  assets: Asset[];
  /** The conversations logged since it began, when it counts conversations. */
  talks: { n: number; last: Talk | null } | null;
  /** The counts logged for it, when it counts something the person logs. */
  tallies: { n: number; total: number; last: Tally | null } | null;
}

/**
 * The work done for a bet, from the rows that say so: the projects tied to it,
 * the assets made for it, and what was logged since it began. A bet that shows
 * nothing done for it on day nine is a finding too.
 */
export function betWork(v: BetView, i: { links: Record<string, string[]>; commissions: CommissionThread[]; assets: Asset[]; talks: Talk[]; tallies: Tally[] }): BetWork {
  const b = v.bet;
  const projects = (i.links[b.id] ?? [])
    .map((id) => i.commissions.find((t) => t.commission.id === id) ?? null)
    .filter((t): t is CommissionThread => !!t);
  const assets = i.assets.filter((a) => a.versions.some((x) => x.bet === b.id));
  const countsTalks = b.metric === 'talks' || b.metric === 'committed' || b.tries?.metric === 'talks';
  const since = i.talks.filter((t) => t.on >= b.start && t.on <= v.last);
  const mine = i.tallies.filter((t) => t.bet === b.id);
  return {
    projects,
    assets,
    talks: countsTalks ? { n: since.length, last: since[0] ?? null } : null,
    tallies: b.metric === 'logged' ? { n: mine.length, total: mine.reduce((s, t) => s + t.n, 0), last: mine[0] ?? null } : null,
  };
}

/**
 * Whether the ideas on hand for a part were written before the record moved:
 * a bet has ended since, or two weeks went by. Ideas from before a bet failed
 * would suggest the bet that failed; the point of a model writing them is that
 * they are not the same every time the tab is opened.
 */
export function ideasStale(set: Pick<IdeaSet, 'at'> | null | undefined, bets: BetView[], today: string): boolean {
  if (!set) return true;
  const written = set.at.slice(0, 10);
  if (daysBetween(written, today) >= CHECKPOINT_DAYS) return true;
  return bets.some((b) => b.state !== 'running' && !!b.ended && b.ended > written);
}

/** How many assets in use the AI made and the person made, by the version in use: "2 by AI · 3 by you". */
export function assetMakers(assets: Asset[]): { ai: number; you: number; line: string } {
  const live = assets.filter((a) => !a.retired);
  const ai = live.filter((a) => a.current.by === 'ai').length;
  const you = live.length - ai;
  return { ai, you, line: [ai ? `${ai} by AI` : null, you ? `${you} by you` : null].filter(Boolean).join(' · ') };
}

/**
 * The offer's newest version, when the AI wrote it and it is not the offer in
 * use: a draft waiting for the person to make it theirs or leave it.
 */
export function offerDraftWaiting(assets: Asset[]): { asset: Asset; n: number } | null {
  const offer = assets.find((a) => a.kind === 'offer');
  const newest = offer?.versions[0];
  return offer && newest && newest.by === 'ai' && offer.live !== newest.n ? { asset: offer, n: newest.n } : null;
}

/* ─── The plan's experiment, as a bet ─────────────────────────────────────── */

/** The part of the business each kind of experiment works on, where the kind says; the rest go on the weak part. */
const ANGLE_PART: Partial<Record<Angle, LinkKey>> = {
  change_channel: 'reach', borrow_demand: 'reach', use_asset: 'reach', resize: 'pay', ask_one: 'who',
};

/**
 * The part a bet made from the plan's experiment starts on. Only a first
 * guess: the bet sheet lets the person move it before it starts.
 */
export function experimentPart(angle: Angle, weak: LinkKey | null): LinkKey {
  return ANGLE_PART[angle] ?? weak ?? 'who';
}
