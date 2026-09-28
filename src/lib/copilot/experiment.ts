// src/lib/copilot/experiment.ts
// The plan's one experiment: a move the person would probably not have written
// themselves, with a test sized to a day, a date to check it, and a verdict.
//
// Why it exists. The drawn plan was a well-ordered copy of the person's own
// notes — exit fund first, job applications alongside, the laptop later — and
// every line of it traced back to something they had typed. Sensible, and never
// once surprising, because one sample from one prompt returns the most likely
// plan, and the most likely plan is the one the person already had. The moves
// that change an outcome are usually the unlikely ones: the job post that is
// really a buyer, one sale at the whole gap instead of ten small ones, a fact
// that moves the target itself.
//
// So the planner is asked to search before it answers — candidates through
// fixed angles (ANGLES), anything the person already wrote thrown out — and to
// put forward one, or none. The rows keep it honest the same way they keep the
// plan honest:
//
//   the model writes   the move, the evidence, the test, what would show it worked
//   the rows write     whether it was tried, the verdict, and what the next plan
//                      is told about every experiment before it
//
// One at a time. An open experiment is carried by the next draw unchanged, so a
// redraw cannot quietly swap out something the person is in the middle of. One
// nobody started in OFFER_DAYS was not wanted: it is recorded as not tried —
// inferred, never asked (invariant 5) — and the next plan may offer another.
// Two set aside in a row and the plan offers none for PAUSE_DAYS: a no to the
// proposer is heard the way propose.ts hears it.
//
// The verdict is the person's tap: it worked, it did not, or they could not
// tell. The ledger of verdicts by angle is fed to the next draw — a first value
// network, of a kind: with one person it is a record rather than a model, but it
// stops a failed angle being offered a third time and leans into one that
// worked, and it is shaped so many people's could be read together later.
//
// Stored without a migration: the experiment lives in the plan's own row
// (copilot_agent_runs output) and its marks are copilot_events rows of type
// EXPERIMENT_EVENT. Pure: no DB import.

export const ANGLES = ['subtract', 'borrow_demand', 'merge_goals', 'resize', 'fast_test', 'use_asset', 'ask_one', 'change_channel'] as const;
export type Angle = (typeof ANGLES)[number];

export const ANGLE_LABEL: Record<Angle, string> = {
  subtract: 'Stop something',
  borrow_demand: 'Go where it is asked for',
  merge_goals: 'One move, two goals',
  resize: 'Change the size',
  fast_test: 'Test it fast',
  use_asset: 'Use what you have',
  ask_one: 'Ask one person',
  change_channel: 'Change the channel',
};

/** Each angle as the planner is told it. */
export const ANGLE_PROMPT: Record<Angle, string> = {
  subtract: 'stop something that takes hours and returns nothing, and put those hours where the record says something works',
  borrow_demand: 'go where the need is already said out loud: a job post, a request, a thread, a listing asking for exactly this',
  merge_goals: 'one move that serves two of their goals at once',
  resize: 'change the size of the thing: the price, the package, the target or the date',
  fast_test: 'test the riskiest assumption in a day instead of finding out in a month',
  use_asset: 'use something they already have: a past client, finished work, a skill, a person',
  ask_one: 'ask one person who knows: a buyer, a hiring manager, someone a step ahead',
  change_channel: 'change how it reaches people: the channel, the medium, the place',
};

export interface Experiment {
  id: string;
  /** The move, starting with a verb. */
  title: string;
  angle: Angle;
  goalId: string | null;
  /** The evidence for it: their words or their rows. */
  why: string;
  /** What to do, sized to a day. */
  test: string;
  /** The result that would show it worked. */
  watch: string;
  /** Days after starting to look at the result. */
  checkDays: number;
  /** The day a plan first offered it; carried unchanged while it is open. */
  offeredOn: string;
}

export const EXPERIMENT_EVENT = 'roadmap_experiment';
export const EXPERIMENT_STATES = ['started', 'dropped', 'worked', 'failed', 'unclear', 'ignored'] as const;
export type ExperimentState = (typeof EXPERIMENT_STATES)[number];
/** The three answers to "did it work?". */
export const VERDICTS = ['worked', 'failed', 'unclear'] as const;
export type ExperimentVerdict = (typeof VERDICTS)[number];
/** What a person may post. 'ignored' is not among them: it is inferred, never asked (invariant 5). */
export const PERSON_STATES: ExperimentState[] = ['started', 'dropped', 'worked', 'failed', 'unclear'];

export const STATE_WORDS: Record<ExperimentState, string> = {
  started: 'trying it', dropped: 'set aside', worked: 'worked', failed: 'did not work', unclear: 'could not tell', ignored: 'not tried',
};

export interface ExperimentMark {
  id: string;
  title: string;
  angle: Angle | null;
  state: ExperimentState;
  at: string;
  /** Written by the app, not the person: an offer left untried. */
  inferred?: boolean;
}

export const CHECK_MIN = 2;
export const CHECK_MAX = 14;
export const CHECK_DEFAULT = 7;
/** An offer nobody started in this many days was not wanted. */
export const OFFER_DAYS = 7;
/** Set aside this many times in a row, and no experiment is offered for PAUSE_DAYS. */
export const PAUSE_AFTER_DROPPED = 2;
export const PAUSE_DAYS = 7;
/** A candidate whose words are this much contained in something the person already has is not new. */
export const NOVELTY_OVERLAP = 0.7;
/** Ledger lines the planner is shown. */
export const MAX_LEDGER = 8;

const TITLE_MAX = 110;
const DAY_MS = 86_400_000;
const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const isAngle = (v: unknown): v is Angle => typeof v === 'string' && (ANGLES as readonly string[]).includes(v);
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 44) || 'x';

/* ─── Marks ───────────────────────────────────────────────────────────────── */

export function experimentMarkFromEvent(e: { payload: unknown; created_at: string }): ExperimentMark | null {
  const p = obj(e.payload);
  const id = typeof p.experiment === 'string' ? p.experiment.slice(0, 64) : '';
  const state = (EXPERIMENT_STATES as readonly string[]).includes(p.state as string) ? (p.state as ExperimentState) : null;
  if (!id || !state) return null;
  return {
    id, state, at: e.created_at,
    title: typeof p.title === 'string' ? p.title.slice(0, TITLE_MAX) : '',
    angle: isAngle(p.angle) ? p.angle : null,
    ...(p.inferred === true ? { inferred: true } : {}),
  };
}

/** The newest mark per experiment. */
export function latestMarks(marks: ExperimentMark[]): Map<string, ExperimentMark> {
  const map = new Map<string, ExperimentMark>();
  for (const m of [...marks].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) map.set(m.id, m);
  return map;
}

export function stateOf(exp: Pick<Experiment, 'id'>, marks: ExperimentMark[]): ExperimentState | null {
  return latestMarks(marks).get(exp.id)?.state ?? null;
}

/** Offered and not answered, or being tried: the next draw carries it. */
export function isOpen(exp: Pick<Experiment, 'id'>, marks: ExperimentMark[]): boolean {
  const s = stateOf(exp, marks);
  return s === null || s === 'started';
}

/** Offered OFFER_DAYS ago or more and never started: not wanted, and said so as inferred. */
export function staleOffer(exp: Pick<Experiment, 'id' | 'offeredOn'>, marks: ExperimentMark[], today: string): boolean {
  if (stateOf(exp, marks) !== null) return false;
  const offered = dayOf(exp.offeredOn);
  return Number.isFinite(offered) && dayOf(today) - offered >= OFFER_DAYS * DAY_MS;
}

/** The person set the last PAUSE_AFTER_DROPPED aside, the newest within PAUSE_DAYS: offer nothing for now. */
export function paused(marks: ExperimentMark[], today: string): boolean {
  const recent = [...latestMarks(marks).values()].filter((m) => !m.inferred).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const run = recent.slice(0, PAUSE_AFTER_DROPPED);
  if (run.length < PAUSE_AFTER_DROPPED || run.some((m) => m.state !== 'dropped')) return false;
  return dayOf(today) - dayOf(run[0].at) < PAUSE_DAYS * DAY_MS;
}

/* ─── Novelty ─────────────────────────────────────────────────────────────── */

const STOP = new Set(('the and for with your you their them they this that these those from into onto about what when then than have has had are was were will would can could should one two '
  + 'not get make more most some any each every only just also very all out over under again still yet now today week weeks day days month who how why which there here its it\'s our '
  + 'send sends reply replies message messages first next new start').split(' '));

/** The words of a line that carry its meaning: lower case, no stop words, no short ones, plurals folded. */
export function contentWords(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 3 || STOP.has(raw)) continue;
    out.add(raw.length > 4 && raw.endsWith('s') && !raw.endsWith('ss') ? raw.slice(0, -1) : raw);
  }
  return out;
}

/**
 * Whether a candidate says something the person does not already have. Its
 * meaningful words, measured against each thing they wrote or were told —
 * notes, the working file, the last plan, open suggestions. A candidate mostly
 * contained in one of those is a restatement, however it is dressed.
 */
export function isNovel(title: string, known: string[]): boolean {
  const words = contentWords(title);
  if (words.size < 2) return true;
  for (const k of known) {
    const kw = contentWords(k);
    let hit = 0;
    for (const w of words) if (kw.has(w)) hit += 1;
    if (hit / words.size >= NOVELTY_OVERLAP) return false;
  }
  return true;
}

/* ─── What comes back ─────────────────────────────────────────────────────── */

export interface ExperimentParseContext {
  /** The plan's own guard: the text if it holds up, null if a number or month in it is unsourced. */
  keep: (text: unknown, kind: 'target' | 'claim') => string | null;
  goalIds: string[];
  today: string;
  /** What the person already has, for isNovel. */
  known: string[];
}

/**
 * The model's experiment, held to the rules, or null. Every part is required:
 * an experiment with no evidence is a guess, one with no test is advice, one
 * with no result to watch cannot be graded. The move and the test are targets
 * ("ask two organisers" passes); the evidence is a claim, so every number in it
 * needs a source (roadmap.ts rule 1).
 */
export function parseExperiment(raw: unknown, ctx: ExperimentParseContext): Experiment | null {
  const r = obj(raw);
  if (!Object.keys(r).length) return null;
  const title = ctx.keep(r.title, 'target');
  const why = ctx.keep(r.why, 'claim');
  const test = ctx.keep(r.test, 'target');
  const watch = ctx.keep(r.watch, 'target');
  if (!title || !why || !test || !watch) return null;
  if (!isNovel(title, ctx.known)) return null;
  const days = typeof r.check_days === 'number' && Number.isFinite(r.check_days) ? Math.round(r.check_days) : CHECK_DEFAULT;
  const given = typeof r.id === 'string' && r.id.trim() ? slug(r.id) : slug(title);
  return {
    id: given.startsWith('x-') ? given : `x-${given}`,
    title: title.slice(0, TITLE_MAX),
    angle: isAngle(r.angle) ? r.angle : 'fast_test',
    goalId: typeof r.goal_id === 'string' && ctx.goalIds.includes(r.goal_id) ? r.goal_id : null,
    why, test, watch,
    checkDays: Math.min(CHECK_MAX, Math.max(CHECK_MIN, days)),
    offeredOn: ctx.today,
  };
}

/** An experiment as stored, reshaped rather than trusted. Null when it does not hold together. */
export function storedExperiment(v: unknown): Experiment | null {
  const r = obj(v);
  const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x : null);
  const id = str(r.id);
  const title = str(r.title);
  const why = str(r.why);
  const test = str(r.test);
  const watch = str(r.watch);
  const offeredOn = str(r.offeredOn);
  if (!id || !title || !why || !test || !watch || !offeredOn) return null;
  const days = typeof r.checkDays === 'number' ? r.checkDays : CHECK_DEFAULT;
  return {
    id, title, why, test, watch, offeredOn,
    angle: isAngle(r.angle) ? r.angle : 'fast_test',
    goalId: str(r.goalId),
    checkDays: Math.min(CHECK_MAX, Math.max(CHECK_MIN, Math.round(days))),
  };
}

/* ─── What the Path shows ─────────────────────────────────────────────────── */

export type ExperimentView =
  | { stage: 'offered'; exp: Experiment }
  | { stage: 'trying'; exp: Experiment; since: string; checkOn: string; due: boolean };

/** Offered, or being tried with its check date. Null once answered or set aside. */
export function experimentView(exp: Experiment | null | undefined, marks: ExperimentMark[], today: string): ExperimentView | null {
  if (!exp) return null;
  const mark = latestMarks(marks).get(exp.id);
  if (!mark) return { stage: 'offered', exp };
  if (mark.state !== 'started') return null;
  const checkOn = new Date(dayOf(mark.at) + exp.checkDays * DAY_MS).toISOString().slice(0, 10);
  return { stage: 'trying', exp, since: mark.at, checkOn, due: today >= checkOn };
}

/* ─── What the next plan is told ──────────────────────────────────────────── */

/** Every experiment that ended, newest first: "(Change the channel) Email five of them instead — did not work, 2026-09-20". */
export function ledgerLines(marks: ExperimentMark[], max = MAX_LEDGER): string[] {
  return [...latestMarks(marks).values()]
    .filter((m) => m.state !== 'started')
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, max)
    .map((m) => `${m.angle ? `(${ANGLE_LABEL[m.angle]}) ` : ''}${m.title || m.id} — ${STATE_WORDS[m.state]}, ${m.at.slice(0, 10)}`);
}

export interface AngleRecord { angle: Angle; tried: number; worked: number; failed: number; unclear: number }

/** Verdicts by angle: the record the next search leans on, and the shape many people's could be pooled in. */
export function angleRecord(marks: ExperimentMark[]): AngleRecord[] {
  const by = new Map<Angle, AngleRecord>();
  for (const m of latestMarks(marks).values()) {
    if (!m.angle || !(VERDICTS as readonly string[]).includes(m.state)) continue;
    const r = by.get(m.angle) ?? { angle: m.angle, tried: 0, worked: 0, failed: 0, unclear: 0 };
    r.tried += 1;
    r[m.state as ExperimentVerdict] += 1;
    by.set(m.angle, r);
  }
  return [...by.values()].sort((a, b) => b.tried - a.tried);
}

/** "Change the channel: tried 2, worked 0" — only angles with a verdict. */
export function angleLines(marks: ExperimentMark[]): string[] {
  return angleRecord(marks).map((r) => `${ANGLE_LABEL[r.angle]}: tried ${r.tried}, worked ${r.worked}`);
}
