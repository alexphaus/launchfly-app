// src/lib/copilot/nightly.ts
// The nightly pass as the screen reads it: who started it, which step it is on,
// and what each step did or why it broke. Pure, so the report on You and the
// rule for when a "running" row is dead are testable without a database.
//
// The pass itself is runNightlyPass in daily.ts. The cron and "Run again" both
// go through it, so the button runs the night rather than a lookalike of it.

/**
 * The schedule, and only the schedule. lastCronRun and /health count a 'cron'
 * brief as proof the scheduled task exists, so nothing a person taps may ever
 * record one. Otherwise pressing "Run again" hides a broken schedule, which is
 * the one thing the "Nothing ran overnight" notice is there to catch.
 */
export const CRON_REASON = 'cron';
/** The same pass, started by hand from You → Settings. */
export const NIGHTLY_NOW = 'nightly_now';

/**
 * True for both ways the nightly pass can run. Both run off the proxy (the
 * cron inside the container, the button in `after()`, after the response has
 * gone), so both can give the agent the long budget. Both also end in the
 * morning push, because the push is part of what the night produces.
 */
export function isNightlyPass(reason: string | null | undefined): boolean {
  return reason === CRON_REASON || reason === NIGHTLY_NOW;
}

/**
 * How long a pass may say "running" before the screen stops believing it.
 *
 * The slowest pass that is still alive is about eight and a half minutes: Maps'
 * three 90s segments, the remote supply agent's 90s and the brief's 120s. A row
 * still running at fifteen belongs to a process that is gone. A redeploy
 * restarts the container, `after()` work dies with it, and nobody will ever
 * finish that row. Without this the button would read "Running" forever, like
 * the card that said "Nothing back yet" about an agent that had died.
 */
export const NIGHTLY_STALE_MS = 15 * 60_000;

export type NightlyStep = 'supply' | 'reconcile' | 'jobs' | 'brief';
export const NIGHTLY_STEPS: NightlyStep[] = ['supply', 'reconcile', 'jobs', 'brief'];

/** The names the Work tab already uses, so the report and the team agree. */
const STEP_NAME: Record<NightlyStep, string> = { supply: 'Scout', reconcile: 'Replies', jobs: 'Checks', brief: 'Call' };
const STEP_DOING: Record<NightlyStep, string> = {
  supply: 'finding new matches',
  reconcile: 'reading replies',
  jobs: 'running the checks',
  brief: 'picking today’s call',
};

/**
 * The finished pass as stored on its row. It is read back from JSON written by
 * whichever version ran it, so every field is optional and read defensively.
 * While the row is still running, the only field is `step`.
 */
export interface NightlyOutput {
  step?: NightlyStep;
  supply?: {
    found?: number; inserted?: number; partial?: boolean; error?: string;
    perAdapter?: Record<string, { found?: number; inserted?: number; skipped?: string; error?: string }>;
  } | null;
  reconcile?: { checked?: number; matched?: number; error?: string } | null;
  jobs?: {
    ran?: number; produced?: number; written?: number; error?: string;
    perJob?: Record<string, { produced?: number; written?: number; skipped?: string; error?: string }>;
  } | null;
  brief?: { agent?: string; fellBack?: boolean; graded?: { ignored?: number; verified?: number }; pushed?: number; skipped?: string } | null;
  /** Adapter and job labels at the time of the run, so the report can say "Google Maps" instead of "google_maps". */
  labels?: { supply?: Record<string, string>; jobs?: Record<string, string> };
  /** Progress writes that failed. The pass carried on, but what the screen showed while it ran was stale. */
  unrecorded?: string[];
}

/** One copilot_agent_runs row of kind 'nightly', as the client receives it. */
export interface NightlyRun {
  id: string;
  status: 'running' | 'ok' | 'error';
  reason: string | null;
  started_at: string;
  finished_at: string | null;
  output: NightlyOutput | null;
  error: string | null;
}

/** The columns a nightly row is read with. One list, so the route and loadHome cannot drift. */
export const NIGHTLY_COLUMNS = 'id, status, started_at, finished_at, output, error, input_summary';

/**
 * A raw row, as the client sees it. The status column only accepts three values,
 * but anything else is read as a failure rather than trusted, since a status
 * this code does not know is not one it can report as fine.
 */
export function nightlyFromRow(row: Record<string, unknown>): NightlyRun {
  const summary = (row.input_summary && typeof row.input_summary === 'object' ? row.input_summary : {}) as Record<string, unknown>;
  const status = row.status === 'running' || row.status === 'ok' || row.status === 'error' ? row.status : 'error';
  return {
    id: String(row.id),
    status,
    reason: typeof summary.reason === 'string' ? summary.reason : null,
    started_at: String(row.started_at),
    finished_at: typeof row.finished_at === 'string' ? row.finished_at : null,
    output: row.output && typeof row.output === 'object' ? row.output as NightlyOutput : null,
    error: typeof row.error === 'string' ? row.error : status === 'error' && row.status !== 'error' ? `unknown status "${String(row.status)}"` : null,
  };
}

export type NightlyTone = 'ok' | 'note' | 'broke';
export interface NightlyLine { step: NightlyStep | 'run'; name: string; text: string; tone: NightlyTone }

export type NightlyBy = 'you' | 'schedule';
export type NightlyView =
  | { state: 'never' }
  | { state: 'running'; by: NightlyBy; step: NightlyStep | null; stepN: number; of: number; doing: string; elapsed: string }
  | { state: 'stopped'; by: NightlyBy; startedAgo: string; line: string }
  | { state: 'failed'; by: NightlyBy; ago: string; line: string }
  | { state: 'done'; by: NightlyBy; ago: string; took: string | null; lines: NightlyLine[]; broke: number; headline: string };

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const s = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** "48s", "2m 10s", "1h 4m". A duration, not a clock. */
export function durationLabel(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return sec % 60 ? `${min}m ${sec % 60}s` : `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

/** "just now", "4m ago", "7h ago", "2d ago". Finer than agoLabel, since a run you just started is minutes old. */
export function runAgo(iso: string, now: Date): string {
  const min = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Still going, as far as anyone can tell: running, and not yet past the point where its process must be gone. */
export function nightlyInFlight(run: Pick<NightlyRun, 'status' | 'started_at'> | null | undefined, now: Date): boolean {
  if (!run || run.status !== 'running') return false;
  const age = now.getTime() - Date.parse(run.started_at);
  return Number.isFinite(age) && age <= NIGHTLY_STALE_MS;
}

/** What each step did, and what broke. Skips that are by design ("not configured") are left out, because they are not news. */
export function nightlyLines(out: NightlyOutput | null | undefined): NightlyLine[] {
  const lines: NightlyLine[] = [];
  if (!out) return lines;
  const push = (step: NightlyLine['step'], text: string, tone: NightlyTone) =>
    lines.push({ step, name: step === 'run' ? 'Run' : STEP_NAME[step], text, tone });
  const supplyLabel = (k: string) => out.labels?.supply?.[k] ?? k;
  const jobLabel = (k: string) => out.labels?.jobs?.[k] ?? k;

  // Scout.
  const sup = out.supply;
  if (sup?.error) push('supply', `Could not search: ${sup.error}`, 'broke');
  else if (sup) {
    const found = n(sup.found);
    const inserted = n(sup.inserted);
    const adapters = Object.entries(sup.perAdapter ?? {});
    const finders = adapters.filter(([, a]) => n(a.found) > 0);
    const where = finders.length > 1 ? ` (${finders.map(([k, a]) => `${supplyLabel(k)} ${n(a.found)}`).join(', ')})` : '';
    push('supply', !found
      ? 'Searched · nothing turned up'
      : `Found ${found}${where} · ${inserted ? `${inserted} new` : 'all already seen'}`, 'ok');
    for (const [k, a] of adapters) {
      if (a.error) push('supply', `${supplyLabel(k)}: ${a.error}`, 'broke');
      // A limit, not a fault, but the reason a paid source went quiet.
      else if (a.skipped === 'monthly match allowance used up') push('supply', `${supplyLabel(k)}: monthly match allowance used up`, 'note');
      else if (a.skipped === 'out of time this run') push('supply', `${supplyLabel(k)}: no time left this run`, 'note');
    }
  } else push('supply', 'Did not search this run', 'note');

  // Replies.
  const rec = out.reconcile;
  if (rec?.error) push('reconcile', `Could not read replies: ${rec.error}`, 'broke');
  else if (rec) {
    const checked = n(rec.checked);
    const matched = n(rec.matched);
    push('reconcile', !checked
      ? 'No sent WhatsApp messages from the last 30 days to check'
      : `Checked ${s(checked, 'sent message')} · ${matched ? s(matched, 'new reply', 'new replies') : 'no new replies'}`, 'ok');
  }

  // Checks: every non-outbound job, the Watcher's feeds among them.
  const jobs = out.jobs;
  if (jobs?.error) push('jobs', `Could not run the checks: ${jobs.error}`, 'broke');
  else if (jobs) {
    const written = n(jobs.written);
    push('jobs', `${s(n(jobs.ran), 'check')} ran · ${written ? s(written, 'new next step') : 'nothing new to do'}`, 'ok');
    for (const [k, j] of Object.entries(jobs.perJob ?? {})) {
      if (j.error) push('jobs', `${jobLabel(k)}: ${j.error}`, 'broke');
      else if (j.skipped === 'no time left this run') push('jobs', `${jobLabel(k)}: no time left this run`, 'note');
    }
  }

  // Call.
  const brief = out.brief;
  if (brief?.skipped) push('brief', `Not picked: ${brief.skipped}`, 'note');
  else if (brief) {
    const graded = n(brief.graded?.ignored) + n(brief.graded?.verified);
    const extra = [
      graded ? `${s(graded, 'earlier call')} graded` : null,
      n(brief.pushed) ? 'sent to your phone' : null,
    ].filter(Boolean).join(' · ');
    const tail = extra ? ` · ${extra}` : '';
    // The fallback is a failure even though a call came out of it: the agent
    // died and the rules stood in, and a report that reads "picked" hides that.
    if (brief.fellBack) push('brief', `The agent failed, so the fallback rules picked it${tail}`, 'broke');
    else if (brief.agent === 'starter') push('brief', `Picked by the rules, since no model is set up${tail}`, 'note');
    else push('brief', `Picked by the agent${tail}`, 'ok');
  }

  if (out.unrecorded?.length) push('run', `Progress could not be saved as it went: ${out.unrecorded[0]}`, 'note');
  return lines;
}

/** The short version, for the row and the toast: only what is new. */
export function nightlyHeadline(out: NightlyOutput | null | undefined): string {
  if (!out) return 'finished';
  const matches = out.supply && !out.supply.error ? n(out.supply.inserted) : 0;
  const steps = out.jobs && !out.jobs.error ? n(out.jobs.written) : 0;
  const picked = !!out.brief && !out.brief.skipped;
  const parts = [
    matches ? s(matches, 'new match', 'new matches') : null,
    steps ? s(steps, 'new next step') : null,
    picked ? 'call picked' : 'no call picked',
  ].filter(Boolean) as string[];
  return matches || steps ? parts.join(', ') : `nothing new, ${parts[parts.length - 1]}`;
}

export function nightlyView(run: NightlyRun | null | undefined, now: Date): NightlyView {
  if (!run) return { state: 'never' };
  const by: NightlyBy = run.reason === CRON_REASON ? 'schedule' : 'you';
  const started = Date.parse(run.started_at);
  if (run.status === 'running') {
    if (!nightlyInFlight(run, now)) {
      return {
        state: 'stopped', by, startedAgo: runAgo(run.started_at, now),
        line: 'Stopped without finishing: the server restarted or the run died. What it found before that is kept.',
      };
    }
    const step = run.output?.step && NIGHTLY_STEPS.includes(run.output.step) ? run.output.step : null;
    return {
      state: 'running', by, step,
      stepN: step ? NIGHTLY_STEPS.indexOf(step) + 1 : 0,
      of: NIGHTLY_STEPS.length,
      doing: step ? STEP_DOING[step] : 'starting',
      elapsed: durationLabel(now.getTime() - started),
    };
  }
  const endIso = run.finished_at ?? run.started_at;
  if (run.status === 'error') {
    return { state: 'failed', by, ago: runAgo(endIso, now), line: run.error?.trim() || 'It failed without saying why.' };
  }
  const lines = nightlyLines(run.output);
  return {
    state: 'done', by, ago: runAgo(endIso, now),
    took: run.finished_at ? durationLabel(Date.parse(run.finished_at) - started) : null,
    lines,
    broke: lines.filter((l) => l.tone === 'broke').length,
    headline: nightlyHeadline(run.output),
  };
}

/** What to say when a pass this screen was watching comes to an end. */
export function nightlyToast(view: NightlyView): string | null {
  switch (view.state) {
    case 'done':
      return view.broke
        ? `Nightly run done, but ${s(view.broke, 'thing')} broke. Details under You.`
        : `Nightly run done: ${view.headline}.`;
    case 'failed': return `Nightly run failed: ${view.line}`;
    case 'stopped': return 'The nightly run stopped without finishing.';
    default: return null;
  }
}
