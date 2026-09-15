// src/lib/copilot/commission.ts
// A mandate: what the app is authorised to get done, and what came of it.
//
// The gap this closes, stated plainly. Every row this product writes is either
// a decision for the user (a Move) or a draft waiting on them (an execution).
// There has never been a representation of work the app OWNS — nothing with a
// state that survives the night and a next step it takes by itself. That is why
// the run button changes nothing you can see: it regenerates prose and produces
// more decisions, and at nine in the morning decisions are what there are
// already too many of.
//
// The split this file assumes:
//
//   the app is the PRINCIPAL   decides what is worth doing and why, grants
//                              authority, takes delivery, records the outcome
//   something else is the HANDS n8n, an agent with browser access, a person
//
// That is not modesty about what a request handler can do; it is where the
// value actually is. Research and browsing get better with a better model and
// will be rented forever. Which of forty things matters this morning, whether
// the last twelve attempts worked, and what this person keeps refusing get
// better only with THIS user's data, and nothing off the shelf can have them.
// So there is no step runner, no retry queue and no tool registry in here.
//
// Pure: no DB import, so copilot-core.test.ts can cover the whole state
// machine. store.ts reads and writes; jobs/commission.ts dispatches.

import type { ArtifactKind, MoveDraft } from './moves';
import type { Goal, Profile } from './types';

/* ─── Authority ───────────────────────────────────────────────────────────── */

export const AUTHORITIES = ['read', 'reach', 'commit'] as const;
export type Authority = (typeof AUTHORITIES)[number];

export interface AuthorityMeta {
  label: string;
  /** Shown before the user grants it. Says what it may do, in their terms. */
  blurb: string;
  /**
   * Whether work in this ring runs without asking again.
   *
   * This is the load-bearing field in the file. `false` does not mean the work
   * cannot happen — it means the worker reports what it WOULD do and the app
   * files it as needs_you, so it arrives as one tap instead of a fait accompli.
   */
  autonomous: boolean;
  /** Why it is not autonomous yet, or null when it is. Rendered as-is. */
  gate: string | null;
}

export const AUTHORITY: Record<Authority, AuthorityMeta> = {
  read: {
    label: 'Research and draft',
    blurb: 'Reads, compares, drafts and documents. Nothing leaves, nobody is contacted.',
    autonomous: true,
    gate: null,
  },
  reach: {
    label: 'Contact people',
    blurb: 'Everything above, and messages people under your own name.',
    // Not yet, and the reason is a rule rather than a missing feature: the
    // WhatsApp and Resend credentials on this server are the operator's, and
    // nobody sends under an identity they do not own. Switching this on means
    // verifying the user's own sending identity first, not relaxing that.
    autonomous: false,
    gate: 'Connect your own email or WhatsApp first — this app will not send as you using its own account.',
  },
  commit: {
    label: 'Spend and commit',
    blurb: 'Money leaves, a price is agreed, somebody is hired.',
    // Never. Not "not yet".
    //
    // An agent that can spend your money while you are walking is not worth
    // more than one that cannot — it is worth less, because you would have to
    // audit everything it did, which is the exact cost the product exists to
    // remove. Work in this ring gets prepared to one tap and stopped there,
    // and that is what makes granting `reach` reasonable at all.
    autonomous: false,
    gate: 'Prepared for you, never done for you. Anything that spends or signs comes back for your tap.',
  },
};

export function isAuthority(v: unknown): v is Authority {
  return typeof v === 'string' && (AUTHORITIES as readonly string[]).includes(v);
}

/**
 * Whether work at this level runs by itself under this mandate.
 *
 * Two gates, both of which must pass: the commission has to have been granted
 * at least this much, and the level itself has to be autonomous. Granting
 * `reach` today therefore buys nothing extra — by design. The mandate records
 * what the user intended, and the second gate decides what actually runs, so
 * switching `reach` on later is one field and not a migration of everybody's
 * commissions.
 */
export function canAct(granted: Authority, level: Authority): boolean {
  const rank = (a: Authority) => AUTHORITIES.indexOf(a);
  return rank(level) <= rank(granted) && AUTHORITY[level].autonomous;
}

/* ─── The commission ──────────────────────────────────────────────────────── */

export const COMMISSION_STATUSES = ['draft', 'active', 'blocked', 'done', 'stopped'] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const STEP_STATES = ['todo', 'doing', 'done', 'blocked'] as const;
export type StepState = (typeof STEP_STATES)[number];

export interface CommissionStep {
  n: number;
  /** What this step is, in one line. The user reads the plan before approving. */
  do: string;
  state: StepState;
  note?: string;
}

export interface Commission {
  id: string;
  goal_id: string | null;
  objective: string;
  why: string | null;
  authority: Authority;
  budget_minutes: number;
  status: CommissionStatus;
  plan: CommissionStep[];
  created_at: string;
  approved_at: string | null;
  last_run_at: string | null;
  closed_at: string | null;
  outcome: string | null;
  seen_at: string | null;
}

/**
 * What a WORKER may post. Not the same list as what may exist — see below.
 */
export const WORKER_EVENT_KINDS = ['planned', 'worked', 'found', 'needs_you', 'blocked', 'done', 'failed'] as const;

/**
 * Every kind of line the log can hold, which is the worker's seven plus one the
 * worker may never write.
 *
 * `answered` is the user's reply to a needs_you, recorded by unblockCommission
 * and by nothing else. It is deliberately outside WORKER_EVENT_KINDS, which is
 * what normalizeResult validates against: if a worker could post `answered` it
 * could answer its own question and clear its own gate, which is invariant 10
 * with one extra step — the same reason `status` is parsed and discarded.
 */
export const EVENT_KINDS = [...WORKER_EVENT_KINDS, 'answered'] as const;
export type CommissionEventKind = (typeof EVENT_KINDS)[number];

export interface CommissionArtifact {
  kind: ArtifactKind;
  label: string;
  value: string;
  href?: string | null;
}

export interface CommissionEvent {
  id: string;
  commission_id: string;
  kind: CommissionEventKind;
  step: number | null;
  summary: string;
  artifact: CommissionArtifact | null;
  at: string;
}

export const OBJECTIVE_MAX = 200;
export const WHY_MAX = 300;
export const SUMMARY_MAX = 300;
export const MAX_STEPS = 12;
export const MAX_EVENTS_PER_POST = 20;
/** Worker minutes a single mandate can be granted. A bound on what is rented. */
export const MIN_BUDGET_MINUTES = 15;
export const MAX_BUDGET_MINUTES = 480;
/** Live at once. Three mandates is a person with three priorities; eight is none. */
export const MAX_ACTIVE_COMMISSIONS = 3;

const str = (v: unknown, max: number): string | undefined =>
  (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

/* ─── The brief that goes out ─────────────────────────────────────────────── */

export interface CommissionBrief {
  kind: 'commission';
  commission_id: string;
  objective: string;
  why: string | null;
  /** What it may do without asking. Anything beyond comes back as needs_you. */
  may: Authority;
  may_autonomously: boolean;
  budget_minutes: number;
  plan: CommissionStep[];
  /** Where to post work back to. Saves the worker being configured twice. */
  result_url: string | null;
  who: ReturnType<typeof whoFor>;
  goal: { title: string; target: number | null; unit: string | null } | null;
  /**
   * What has already happened on this mandate, oldest first.
   *
   * This field is why the loop can close. A worker raised a needs_you, the user
   * answered it, and the next dispatch sent objective/may/budget/plan and
   * nothing else — a byte-identical brief. So the worker asked the identical
   * question, forever, and no commission that needed anything from its owner
   * could ever finish. The answer had nowhere to go.
   *
   * Summaries only, capped: the worker produced the artifacts and does not need
   * them posted back, and a mandate running for a month must not grow a payload
   * with it.
   */
  log: BriefLogLine[];
}

export interface BriefLogLine {
  kind: CommissionEventKind;
  step: number | null;
  summary: string;
  at: string;
}

/** Lines of history a brief carries. Enough for a question and its answer to
 *  survive a long run; short enough that the payload stays a brief. */
export const MAX_BRIEF_LOG = 12;

/**
 * The tail of the log, oldest first, as the worker should read it.
 *
 * Oldest-first because it is a transcript: "needs_you: which of the three? /
 * answered: the second one" only reads in that order. Everything else in this
 * file sorts newest-first, for screens.
 */
export function briefLog(events: CommissionEvent[], max = MAX_BRIEF_LOG): BriefLogLine[] {
  return [...events]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-max)
    .map((e) => ({ kind: e.kind, step: e.step, summary: e.summary, at: e.at }));
}

/**
 * What the worker is told about the person.
 *
 * Same boundary as profileForRemote and for the same reason: this payload
 * leaves the deployment, so it carries no email, no phone, no billing and no
 * id. A worker needs to know what this person sells and to whom; it never needs
 * to be able to identify or bill them.
 */
export function whoFor(p: Profile, working = '') {
  return {
    name: p.name,
    headline: p.headline,
    offer: p.offer,
    location: p.location,
    timezone: p.timezone,
    target_segments: p.target_segments,
    target_area: p.target_area,
    /**
     * The working file, as the block from workingBrief. Live entries only.
     *
     * The offer is five strings — a headline — and research written from a
     * headline comes back generic however good the worker is, because there is
     * nothing specific for it to be specific about. How delivery actually
     * happens, what was quoted and whether it closed, what has already been
     * tried and failed, and what this person will not do are the difference
     * between a commissioned piece of work and a search result.
     *
     * Omitted rather than sent empty: an account with no file should not spend
     * payload on the fact.
     */
    ...(working ? { working } : {}),
  };
}

/**
 * The commission, as a job order.
 *
 * The difference from what remote.ts sends today is the whole point of this
 * layer. That payload says "here is who this person is, send me Moves" — it
 * commissions nothing, names no objective and cannot be reported against, which
 * is why what came back could only ever be a suggestion. This one carries an
 * objective, the authority it may use, a budget, and an id to report against.
 * That is the difference between a second opinion and a contractor.
 */
export function commissionBrief(
  c: Commission,
  profile: Profile,
  goal: Goal | null,
  resultUrl: string | null,
  ctx: { working?: string; events?: CommissionEvent[] } = {},
): CommissionBrief {
  return {
    kind: 'commission',
    commission_id: c.id,
    objective: c.objective,
    why: c.why,
    may: c.authority,
    // Stated explicitly rather than left for the worker to infer from `may`.
    // A worker that guesses this wrong sends something under somebody's name.
    may_autonomously: AUTHORITY[c.authority].autonomous,
    budget_minutes: c.budget_minutes,
    plan: c.plan,
    result_url: resultUrl,
    who: whoFor(profile, ctx.working ?? ''),
    goal: goal ? { title: goal.title, target: goal.target_value, unit: goal.unit } : null,
    log: briefLog(ctx.events ?? []),
  };
}

/* ─── What comes back ─────────────────────────────────────────────────────── */

export interface CommissionResult {
  events: Array<Omit<CommissionEvent, 'id' | 'commission_id' | 'at'>>;
  /** A revised plan, when the worker learned the original was wrong. */
  plan: CommissionStep[] | null;
  /** What the worker says the commission is now. Never trusted directly. */
  claimed: CommissionStatus | null;
}

const ARTIFACT_KINDS: ArtifactKind[] = ['message', 'link', 'text'];

/**
 * The only schemes an artifact may link to.
 *
 * Everything that reaches an href in this app comes from outside it — a worker,
 * a workflow, a feed — and every one of those is a place somebody could put
 * `javascript:`. Allow-list rather than deny-list: data:, blob:, vbscript: and
 * whatever comes next are all refused by not being named.
 */
export const SAFE_HREF = /^https?:\/\//i;

function normalizeArtifact(raw: unknown): CommissionArtifact | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const value = str(a.value, 4000);
  const label = str(a.label, 40);
  if (!value || !label) return null;
  // http(s) only, and this is a security check rather than tidiness. The sheet
  // renders this into <a href>, React does not block javascript: URLs, and
  // anything holding COPILOT_INBOUND_SECRET can post an artifact. A scheme-less
  // string here is a script running on the copilot's own origin, one tap away.
  const candidate = str(a.href, 1000);
  const href = candidate && SAFE_HREF.test(candidate) ? candidate : null;
  const kind = ARTIFACT_KINDS.includes(a.kind as ArtifactKind) ? (a.kind as ArtifactKind) : (href ? 'link' : 'text');
  // A link artifact with nowhere to go renders a button that does nothing.
  if (kind === 'link' && !href) return null;
  return { kind, label, value, href };
}

export function normalizeStep(raw: unknown, fallbackN: number): CommissionStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const what = str(s.do ?? s.step ?? s.summary, 200);
  if (!what) return null;
  const n = typeof s.n === 'number' && Number.isFinite(s.n) ? Math.trunc(s.n) : fallbackN;
  const state = STEP_STATES.includes(s.state as StepState) ? (s.state as StepState) : 'todo';
  return { n, do: what, state, ...(str(s.note, 200) ? { note: str(s.note, 200)! } : {}) };
}

export function normalizePlan(raw: unknown): CommissionStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s, i) => normalizeStep(s, i + 1))
    .filter((s): s is CommissionStep => !!s)
    .slice(0, MAX_STEPS);
}

/**
 * Whatever the worker posted, forced into rows this app will show.
 *
 * Nothing here is trusted — same discipline as normalizeRemoteMove, and for a
 * sharper reason. That socket could only pollute one section of one screen; a
 * commission result writes the log a person reads to decide whether the mandate
 * is working, so a worker that lies produces a false record of the app's own
 * behaviour.
 *
 * Two rules worth naming:
 *
 * - `claimed` is parsed but never applied. A worker saying "done" does not make
 *   a commission done; nextStatus decides from what the events actually
 *   contain. Otherwise the cheapest way for a bad worker to look successful is
 *   to report success.
 * - a `done` or `failed` event with no summary is dropped rather than defaulted,
 *   because the summary IS the report for those two.
 */
export function normalizeResult(raw: unknown): CommissionResult {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawEvents = Array.isArray(r.events) ? r.events : [];

  const events = rawEvents
    .map((e) => {
      if (!e || typeof e !== 'object') return null;
      const ev = e as Record<string, unknown>;
      // WORKER_EVENT_KINDS, not EVENT_KINDS: a worker posting `answered` would
      // be answering the question it just asked, on the user's behalf.
      const kind = (WORKER_EVENT_KINDS as readonly string[]).includes(ev.kind as string) ? (ev.kind as CommissionEventKind) : null;
      const summary = str(ev.summary ?? ev.text, SUMMARY_MAX);
      if (!kind || !summary) return null;
      const step = typeof ev.step === 'number' && Number.isFinite(ev.step) ? Math.trunc(ev.step) : null;
      return { kind, step, summary, artifact: normalizeArtifact(ev.artifact) };
    })
    .filter((e): e is CommissionResult['events'][number] => !!e)
    .slice(0, MAX_EVENTS_PER_POST);

  const plan = Array.isArray(r.plan) ? normalizePlan(r.plan) : null;
  const claimed = COMMISSION_STATUSES.includes(r.status as CommissionStatus) ? (r.status as CommissionStatus) : null;

  return { events, plan: plan?.length ? plan : null, claimed };
}

/* ─── The state machine ───────────────────────────────────────────────────── */

/**
 * What the commission is now, decided from the log rather than from the claim.
 *
 * Order matters and encodes the safety rule: a needs_you outranks a done. A
 * worker that finished four steps and wants a fifth approved is blocked, not
 * finished, however it labelled its own run — otherwise "done" becomes the way
 * an unapproved action slips past the person who was supposed to approve it.
 */
export function nextStatus(current: CommissionStatus, events: Array<{ kind: CommissionEventKind }>): CommissionStatus {
  // Terminal states are the user's to leave, not a worker's to reopen.
  if (current === 'draft' || current === 'stopped' || current === 'done') return current;
  // And so is 'blocked'. The first version fell through to 'active' here, which
  // meant a worker that raised a needs_you could clear its own gate by posting
  // anything else the next night — the user's question answered for them by the
  // party that asked it. Only unblockCommission moves this, and only the user
  // calls that. A worker reporting 'done' while a question is outstanding is
  // still blocked: the question is what it is blocked ON.
  if (current === 'blocked') return 'blocked';
  if (events.some((e) => e.kind === 'needs_you')) return 'blocked';
  if (events.some((e) => e.kind === 'blocked' || e.kind === 'failed')) return 'blocked';
  if (events.some((e) => e.kind === 'done')) return 'done';
  return 'active';
}

/** Which commissions the dispatcher should hand out tonight. */
export function dueCommissions(all: Commission[], max = MAX_ACTIVE_COMMISSIONS): Commission[] {
  return all
    // Only active. A blocked one is waiting on the user and handing it out
    // again produces a second identical needs_you against the same question.
    .filter((c) => c.status === 'active' && !!c.approved_at)
    .sort((a, b) => (a.last_run_at ?? '').localeCompare(b.last_run_at ?? ''))
    .slice(0, max);
}

/* ─── What the user reads ─────────────────────────────────────────────────── */

export interface CommissionReport {
  /** What got done. Newest first, already trimmed to what is worth reading. */
  did: CommissionEvent[];
  /**
   * A question only the owner can answer. The only thing here that is an ask.
   *
   * `blocked` and `failed` used to be in this bucket too, and that was wrong in
   * a way the screen made obvious: a mandate stopped by a dead search tool got
   * rendered under the heading "Your answer", with a text box and a placeholder
   * about supplier quotes, above a sentence reading "the web-search tool
   * returned an internal request error". There is nothing for a person to type
   * there. A question and a breakage are opposite states — one wants a reply,
   * the other wants a retry — and the whole section read as a fault list
   * because they shared a bucket.
   */
  yours: CommissionEvent[];
  /** The worker could not go on. Not an ask: nobody can answer a 500. */
  stopped: CommissionEvent[];
  /**
   * What the user said back. Its own bucket rather than folded into `did`,
   * because `did` is the worker's work and this is the one kind of line in the
   * log the worker did not write. Shown under the ask it answers, so the sheet
   * reads as the exchange it is.
   */
  said: CommissionEvent[];
  /** Steps finished out of steps planned. Computed, never claimed. */
  progress: { done: number; total: number };
  /** Events since seen_at. Null when they have seen everything. */
  fresh: number;
}

export function reportOf(c: Commission, events: CommissionEvent[], max = 6): CommissionReport {
  const newest = [...events].sort((a, b) => b.at.localeCompare(a.at));
  const seen = c.seen_at ? Date.parse(c.seen_at) : 0;

  return {
    // 'planned' is housekeeping, not work — it says the plan changed, which the
    // plan itself already shows. Leaving it in buries the two lines that matter.
    did: newest.filter((e) => e.kind === 'worked' || e.kind === 'found' || e.kind === 'done').slice(0, max),
    yours: newest.filter((e) => e.kind === 'needs_you').slice(0, max),
    stopped: newest.filter((e) => e.kind === 'blocked' || e.kind === 'failed').slice(0, max),
    said: newest.filter((e) => e.kind === 'answered').slice(0, max),
    progress: {
      done: c.plan.filter((s) => s.state === 'done').length,
      total: c.plan.length,
    },
    fresh: seen ? newest.filter((e) => Date.parse(e.at) > seen).length : newest.length,
  };
}

/**
 * The three zones a handed-over job can be in, from the reader's side.
 *
 * Now was organised by FEATURE — jobs here, Moves there, the queue somewhere
 * else — while the question somebody has when they open it is temporal: what
 * needs me, and what happened while I was away. So the screen alternated
 * between asking and reporting four times going down the page, and a job sat in
 * whichever block its feature owned regardless of which of the two it was.
 *
 * A draft counts as needing you. Nothing happens to it until it is approved,
 * and a mandate sitting unapproved is indistinguishable from one the app
 * forgot — which is what the approve button exists to prevent.
 */
export interface ThreadZones<T> {
  /** Waiting on a person: a question, a breakage, or an unapproved draft. */
  needsYou: T[];
  /** Under way. Nothing to do; this is the half that reports. */
  running: T[];
  /** Over. Belongs beside the decision record, not on Now. */
  finished: T[];
}

export function splitThreads<T extends { commission: Pick<Commission, 'status'> }>(threads: T[]): ThreadZones<T> {
  const out: ThreadZones<T> = { needsYou: [], running: [], finished: [] };
  for (const t of threads) {
    switch (t.commission.status) {
      case 'done': case 'stopped': out.finished.push(t); break;
      case 'blocked': case 'draft': out.needsYou.push(t); break;
      default: out.running.push(t);
    }
  }
  return out;
}

export type ChipTone = 'draft' | 'running' | 'needs' | 'fault' | 'done' | 'stopped';

export type BlockedOn = 'you' | 'worker';

/**
 * What a blocked mandate is actually waiting for.
 *
 * `status` says 'blocked' for both, and for a while the screen said "Needs you"
 * for both — so a dead search tool and a real question looked identical, and a
 * morning with three mandates read as three things the user had failed to do.
 * Only one of them was.
 *
 * The newest event decides, because a mandate can carry an old question the user
 * already answered and a fresh failure on top of it. Blocked with nothing
 * recorded at all falls to 'you': there is no reason to show, and the user
 * should always be able to clear it.
 */
export function blockedOn(c: Pick<Commission, 'status'>, r: CommissionReport): BlockedOn | null {
  if (c.status !== 'blocked') return null;
  const ask = r.yours[0];
  const fault = r.stopped[0];
  if (ask && fault) return ask.at >= fault.at ? 'you' : 'worker';
  return fault ? 'worker' : 'you';
}

/**
 * The state, as a chip rather than a sentence.
 *
 * The card used to say "Waiting for you to approve it" in the same grey as
 * everything else, so the one thing that decides whether anything is happening
 * read as a caption. A chip is scannable at arm's length, which is the posture
 * this screen is actually used in.
 */
export function commissionChip(c: Commission, r?: CommissionReport): { label: string; tone: ChipTone } {
  switch (c.status) {
    case 'draft': return { label: 'Not started', tone: 'draft' };
    // Two different states behind one status. "Needs you" on a mandate whose
    // worker crashed is the app blaming the user for its own outage — and with
    // three of them on screen, Working On stopped reading as a report of work
    // and started reading as a list of your failures.
    case 'blocked': return r && blockedOn(c, r) === 'worker'
      ? { label: 'Needs a fix', tone: 'fault' }
      : { label: 'Needs you', tone: 'needs' };
    case 'done': return { label: 'Done', tone: 'done' };
    case 'stopped': return { label: 'Stopped', tone: 'stopped' };
    default: return { label: 'Running', tone: 'running' };
  }
}

/**
 * The meta line under a mandate nobody has approved yet.
 *
 * What it may do and what it may spend, in one line. The card used to carry the
 * whole authority blurb — two sentences of prose repeating the sheet, for a row
 * that is doing nothing by definition.
 */
export function commissionTerms(c: Commission): string {
  return `${AUTHORITY[c.authority].label} · up to ${c.budget_minutes} min`;
}

/**
 * The line on the card.
 *
 * Counts and state, never adjectives — same rule the source yield line follows.
 * "3 of 5 done · 2 need you" lets somebody decide whether to open it; "making
 * good progress" asks them to trust a sentence the app wrote about itself.
 */
export function commissionLine(c: Commission, r: CommissionReport): string {
  if (c.status === 'draft') return 'Waiting for you to approve it';
  if (c.status === 'stopped') return 'You called this off';
  if (c.status === 'done') return c.outcome?.slice(0, 120) || 'Finished';
  // A mandate the worker could not finish says so plainly and on its own.
  // Pairing it with "0 of 4 done" reports a shortfall the user did not cause,
  // in the same breath as the reason they did not cause it.
  if (blockedOn(c, r) === 'worker') return 'The worker could not finish — it can be tried again';

  const parts: string[] = [];
  // Only once something has actually moved. "0 of 4 done" on a mandate that has
  // never run is a progress report about no progress.
  if (r.progress.done > 0) parts.push(`${r.progress.done} of ${r.progress.total} done`);
  // Only while it is actually stopped on one. `yours` is the log of every
  // question ever raised, so counting it unconditionally left a mandate reading
  // "1 needs you" for the rest of its life — including immediately after the
  // user answered, which made answering look like it had done nothing.
  if (c.status === 'blocked' && r.yours.length) parts.push(`${r.yours.length} need${r.yours.length === 1 ? 's' : ''} you`);
  else if (!r.did.length) parts.push('Nothing back yet');
  return parts.join(' · ');
}

/**
 * A blocked commission, as a Move.
 *
 * This is how the thread joins the rest of the product rather than sitting
 * beside it. A mandate waiting on the user is work that is not moving, and it
 * has to compete for the morning against the send queue and the money owed on
 * the same terms as everything else — through scoreMove, with a refusal record.
 * A commission with its own permanent slot on the screen would be the one thing
 * in the app that cannot lose, which is the failure the send queue already was.
 */
/**
 * The commission a blocked Move came from, or null.
 *
 * blockedMove writes `commission:${commissionId}:${eventId}`, and both halves
 * are uuids, so this splits on the fixed prefix and the next separator rather
 * than on the last colon. Answering that Move is the user answering the
 * question, which is what lets setMoveStatus carry the mandate forward.
 */
export function commissionIdFromMove(externalId: string | null | undefined): string | null {
  if (!externalId?.startsWith('commission:')) return null;
  const rest = externalId.slice('commission:'.length);
  const at = rest.indexOf(':');
  const id = at > 0 ? rest.slice(0, at) : rest;
  return id || null;
}

export function blockedMove(c: Commission, r: CommissionReport, job: string): MoveDraft | null {
  // `yours` is questions only, so a mandate stopped by a broken tool produces no
  // Move — deliberately. A Move is finished work with something to act on, and
  // "your search tool is returning 500s" is neither. It belongs on the card,
  // with a retry, not in the day's arbitration competing with the send queue.
  const ask = r.yours[0];
  if (!ask) return null;
  return {
    job,
    kind: 'decide',
    // Keyed on the event, so answering this one and the worker raising another
    // tomorrow are two Moves, and the same ask restated is one.
    external_id: `commission:${c.id}:${ask.id}`.slice(0, 200),
    headline: ask.summary.slice(0, 160),
    why: [
      `"${c.objective}" is stopped until you answer this.`,
      ...(c.why ? [c.why] : []),
    ],
    artifact: ask.artifact
      ? { kind: ask.artifact.kind, label: ask.artifact.label, value: ask.artifact.value, href: ask.artifact.href ?? null }
      : { kind: 'text' as const, label: 'Open the commission', value: ask.summary },
    cost_label: '10 min',
  };
}
