'use client';
// You: how it is going, in the numbers that are actually yours, then the week
// read back, then goals, then everything that is settings.
//
// What left, and why. The Working? tab rendered the funnel, the openings, a
// per-segment read, the log of calls and the findings: five sections of true
// record that its owner opened and found "a log, static, without much value".
// The funnel is still one tap away — it is the path to money on Work, where each
// stage opens the businesses in it — and "Ask your own record" still answers by
// counting. What this tab does instead is ask the three questions a person
// actually has about a week, and answer each with the rows behind it. See
// lib/copilot/review.ts.
import { useEffect, useState } from 'react';
import { PLANS } from '@/lib/copilot/plans';
import { hoursLabel } from '@/lib/copilot/focus';
import { agoLabel } from '@/lib/copilot/machine';
import { nightlyInFlight, nightlyView, type NightlyLine } from '@/lib/copilot/nightly';
import type { ReviewLine, ReviewTarget } from '@/lib/copilot/review';
import { CAPACITY_META, type HomeData } from '@/lib/copilot/types';
import { goalProgress, money } from '../format';
import type { Actions } from '../shared';
import { useShell } from '../shell';
import type { Derived } from './derive';
import { IconAlert, IconCheck, IconChevron } from './icons2';

export default function YouTab({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  return (
    <>
      <Numbers home={home} d={d} actions={actions} />
      <Week home={home} d={d} actions={actions} />
      <Goals home={home} actions={actions} />
      <Settings home={home} d={d} actions={actions} />
    </>
  );
}

/* ─── The numbers ─────────────────────────────────────────────────────────── */

/**
 * Four stat tiles, each a figure off rows the user made: money logged as won,
 * runway from cash and burn they typed, deep work they logged, replies matched
 * to what they sent. A tile with nothing behind it says what would fill it,
 * rather than showing a zero that looks like a measurement.
 */
function Numbers({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const m = home.metrics;
  const f = home.forecast;
  const week = d.week;
  const peak = Math.max(...week.days.map((x) => x.minutes), 60);
  return (
    <div className="cp2-tiles" aria-label="Your numbers">
      <button className="cp2-tile" onClick={() => actions.openSheet({ kind: 'stage', stage: 'won' })}>
        <span className="l">Money in</span>
        <span className="v">{m.won_amount ? money(m.won_amount, d.currency) : m.won ? `${m.won} won` : '—'}</span>
        <span className="s">{m.won ? `${m.won} win${m.won === 1 ? '' : 's'} · last ${m.window_days} days` : `Nothing logged as won in ${m.window_days} days`}</span>
      </button>

      <button className="cp2-tile" onClick={() => actions.openSheet({ kind: 'finance' })}>
        <span className="l">Runway</span>
        <span className="v">{m.runway_months != null ? `${m.runway_months} mo` : 'Set it'}</span>
        <span className="s">
          {m.runway_months == null ? 'Cash and monthly burn — two numbers'
            : f?.changesTheAnswer ? `${f.forecastMonths} mo with what is owed`
            : `${money(home.profile.finance?.cash ?? 0, d.currency)} cash · ${money(home.profile.finance?.monthly_burn ?? 0, d.currency)}/mo`}
        </span>
      </button>

      <button className="cp2-tile" onClick={() => actions.openSheet({ kind: 'focus' })}>
        <span className="l">Deep work</span>
        <span className="v">{week.loggedDays ? hoursLabel(week.total) : 'Log it'}</span>
        {/* Seven days, today in the accent. The values live in the sheet this
            opens — the table twin — so no bar is the only way to read one. */}
        {/* Not before the first log: seven empty stubs read as a broken chart,
            not as a week with nothing in it — the line underneath says that. */}
        {week.loggedDays > 0 && (
          <span className="cp2-spark" aria-hidden>
            {week.days.map((day, i) => (
              <i key={day.on} className={i === week.days.length - 1 ? 'today' : ''} style={{ height: `${Math.max(2, Math.round((day.minutes / peak) * 22))}px` }} />
            ))}
          </span>
        )}
        <span className="s">{week.loggedDays ? `last 7 days · ${hoursLabel(week.today)} today` : 'Nothing logged this week'}</span>
      </button>

      <button className="cp2-tile" onClick={() => actions.openSheet({ kind: 'stage', stage: 'replied' })}>
        <span className="l">Replies</span>
        <span className="v">{m.replies}</span>
        <span className="s">{m.sent ? `from ${m.sent} sent · last ${m.window_days} days` : `none sent in ${m.window_days} days`}</span>
      </button>
    </div>
  );
}

/* ─── The week ────────────────────────────────────────────────────────────── */

function Week({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const r = d.review;
  const go = (t: ReviewTarget) => {
    if (t === 'queue') actions.openSheet({ kind: 'queue' });
    else if (t === 'sources') actions.openSheet({ kind: 'watchlist' });
    else if (t === 'projects') actions.setTab('work');
    else if (t === 'focus') actions.openSheet({ kind: 'focus' });
    else if (t === 'matches') actions.setTab('matches');
    else if (t === 'record') actions.openSheet({ kind: 'ask' });
  };
  const unread = home.recent.unreadable;
  return (
    <>
      <div className="cp-section"><span className="lead">This week</span><span className="count">counted, never estimated</span></div>

      {/* A failed read is said, never rendered as a quiet week — invariant 13. */}
      {unread.length > 0 && (
        <div className="cp-note cp2-err">Could not read your {unread.join(', ')} just now, so some of this week is missing below.</div>
      )}

      <div className="cp-card cp2-review value">
        <div className="cp2-review-head"><span className="cp2-mark done"><IconCheck /></span>What created value</div>
        {r.value.length
          ? <Lines lines={r.value} go={go} />
          : <p className="cp2-review-empty">{r.valueEmpty}</p>}
      </div>

      <div className="cp-card cp2-review waste">
        <div className="cp2-review-head"><span className="cp2-mark warn"><IconAlert /></span>What was wasted</div>
        {r.waste.length
          ? <Lines lines={r.waste} go={go} />
          : <p className="cp2-review-empty">Nothing counted as wasted: no stale drafts, no dead sources, no project closed with nothing to show.</p>}
      </div>

      <div className="cp-card cp2-review change">
        <div className="cp2-review-head"><span className="cp2-mark next">→</span>What has to change</div>
        {r.change ? (
          <>
            <p className="cp2-change-head">{r.change.head}</p>
            {r.change.because && <p className="cp2-change-because">{r.change.because}</p>}
            <p className="cp2-change-body"><b>Try this week</b> {r.change.body}</p>
            {r.change.target === 'queue' && d.queueCount > 0 && (
              <button className="cp-btn primary block cp-call-do" onClick={() => go('queue')}>Open the queue</button>
            )}
          </>
        ) : (
          <p className="cp2-review-empty">Nothing measured points anywhere yet. Send something, log what comes back, and this fills in.</p>
        )}
      </div>

      <button className="cp2-more" onClick={() => actions.openSheet({ kind: 'ask' })}>Ask your own record</button>
    </>
  );
}

function Lines({ lines, go }: { lines: ReviewLine[]; go: (t: ReviewTarget) => void }) {
  return (
    <ul className="cp2-lines">
      {lines.map((l, i) => {
        const inner = (
          <>
            <span className="tx">{l.text}</span>
            {l.when && <span className="when">{l.when}</span>}
          </>
        );
        return (
          <li key={i}>
            {l.target ? <button className="cp2-line" onClick={() => go(l.target)}>{inner}<IconChevron /></button> : <span className="cp2-line">{inner}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/* ─── Goals ───────────────────────────────────────────────────────────────── */

function Goals({ home, actions }: { home: HomeData; actions: Actions }) {
  const m = home.metrics;
  return (
    <>
      <div className="cp-section"><span className="lead">Goals</span><button className="link" onClick={() => actions.openSheet({ kind: 'goal' })}>+ Add</button></div>
      {home.goals.length ? home.goals.map((g) => {
        const pr = goalProgress(g);
        return (
          <button key={g.id} className="cp-card cp-goal cp2-goal" onClick={() => actions.openSheet({ kind: 'goal', id: g.id })}>
            <div className="top"><span className="name">{g.title}</span><span className="pct">{pr.pct !== null ? `${pr.pct}%` : g.horizon_days ? `${g.horizon_days}d` : '—'}</span></div>
            {/* A meter only where there is a target to be a fraction of. A goal
                with no number behind it gets its note, not an empty bar. */}
            {pr.pct !== null && <div className="track"><div className="cp-fill" style={{ width: `${pr.pct}%` }} /></div>}
            <div className="sub">{pr.label}{g.metric === 'currency' && m.won_amount ? ` · ${money(m.won_amount, g.unit || '$')} from logged wins` : ''}</div>
          </button>
        );
      }) : (
        <div className="cp-empty"><b>No goal yet</b>Add one and the call, the projects it proposes and this tab all point at it.</div>
      )}
    </>
  );
}

/* ─── Settings ────────────────────────────────────────────────────────────── */

function Settings({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const shell = useShell();
  const p = home.profile;
  const b = home.billing;
  const failing = home.watchSources.filter((s) => s.last_error).length;
  const rows: Array<{ key: string; l: string; s: string; onClick?: () => void; href?: string; right?: string }> = [
    { key: 'offer', l: 'Your offer', s: p.offer?.sells || 'Not set — nothing is drafted without it', onClick: () => actions.openSheet({ kind: 'offer' }) },
    { key: 'targeting', l: 'Who it looks for', s: p.target_segments.length ? `${p.target_segments.join(', ')}${p.target_area || p.location ? ` · ${p.target_area || p.location}` : ''}` : 'Not set', onClick: () => actions.openSheet({ kind: 'targeting' }) },
    { key: 'working', l: 'How you work', s: `${home.workingProgress?.filled ?? 0} of ${home.workingProgress?.total ?? 6} written${home.workingProgress?.proposals ? ` · ${home.workingProgress.proposals} to check` : ''}`, onClick: () => actions.openSheet({ kind: 'working' }) },
    { key: 'sources', l: 'Sources you watch', s: home.watchSources.length ? `${home.watchSources.length} · read every night${failing ? ` · ${failing} failing` : ''}` : 'None yet', onClick: () => actions.openSheet({ kind: 'watchlist' }) },
    { key: 'money', l: 'Money owed', s: home.obligations.length ? `${home.obligations.length} open` : 'Invoices and bills with dates', onClick: () => actions.openSheet({ kind: 'money' }) },
    { key: 'capacity', l: 'Capacity', s: CAPACITY_META[p.capacity].sub, onClick: () => actions.openSheet({ kind: 'capacity' }), right: CAPACITY_META[p.capacity].label },
    { key: 'account', l: 'Account & notifications', s: home.account.email ? `${home.account.email}${home.account.verified ? ' · verified' : ' · not verified'}${home.push.enabled ? ' · push on' : ''}` : 'This device only — add an email to sign in elsewhere', onClick: () => actions.openSheet({ kind: 'account' }) },
    b.effective === 'free'
      ? { key: 'plan', l: `Plan · ${PLANS[b.effective].name}`, s: `${b.matches.used} of ${b.matches.limit} matches used this month`, href: `${shell}/pricing` }
      : { key: 'plan', l: `Plan · ${PLANS[b.effective].name}`, s: `${b.matches.used} of ${b.matches.limit} matches used this month`, onClick: () => void actions.openBilling() },
  ];
  return (
    <>
      <div className="cp-section"><span className="lead">Settings</span></div>
      <div className="cp-list cp2-rows cp2-settings">
        {rows.map((r) => r.href ? (
          <a key={r.key} className="cp2-row" href={r.href}>
            <span className="cp2-row-main"><span className="t">{r.l}</span><span className="s cp2-clamp1">{r.s}</span></span>
            <IconChevron />
          </a>
        ) : (
          <button key={r.key} className="cp2-row" onClick={r.onClick}>
            <span className="cp2-row-main"><span className="t">{r.l}</span><span className="s cp2-clamp1">{r.s}</span></span>
            {r.right && <span className="cp2-right">{r.right}</span>}
            <IconChevron />
          </button>
        ))}
        <NightlyRow home={home} d={d} actions={actions} />
        {/* The way back. Two layouts over one app, and neither is the real one
            until one of them is the one that gets opened. */}
        <a className="cp2-row" href="/lifeos">
          <span className="cp2-row-main"><span className="t">Classic layout</span><span className="s">Now and Working? — the same account and data</span></span>
          <IconChevron />
        </a>
        <div className="cp2-row">
          <span className="cp2-row-main"><span className="t">{p.name}</span><span className="s cp2-clamp1">{p.headline ?? 'No headline yet'}{p.location ? ` · ${p.location}` : ''}</span></span>
          <button className="cp-connect ghost" onClick={() => actions.openSheet({ kind: 'reset' })}>Forget device</button>
        </div>
      </div>
      <p className="cp-note">
        {home.channels.mode === 'api'
          ? `Sending from your own account: WhatsApp ${home.channels.whatsapp ? 'on' : 'off'} · Email ${home.channels.email ? 'on' : 'off'}.`
          : 'Drafts open pre-filled in your own WhatsApp or mail app, so messages come from you, not from this server.'}
      </p>
    </>
  );
}

/* ─── The nightly run ─────────────────────────────────────────────────────── */

const MARK: Record<NightlyLine['tone'], string> = { ok: '✓', note: '·', broke: '✕' };
/** Said aloud before the line, because the mark and its colour are not. */
const SPOKEN: Record<NightlyLine['tone'], string> = { ok: '', note: 'Note: ', broke: 'Failed: ' };

/** A clock for the elapsed time while a pass runs. Starts from the data's own time, so the first render matches the server's. */
function useNow(start: Date, everyMs: number | null): Date {
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!everyMs) return;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/**
 * "Run again" runs the night, and this row is where it reports.
 *
 * It was "Today's call · Run again", which re-ran the brief alone. Testing what
 * the night does then meant waiting for a night. Now the button starts the
 * cron's own pass for this account (Scout, replies, checks, call), the row
 * follows it step by step, and afterwards it keeps what each step did and
 * what broke, since that is what the test is for.
 *
 * The scheduled run's own time is said separately, underneath. Pressing the
 * button does not count as the schedule, and a schedule that never fires is
 * the thing most worth noticing here.
 */
function NightlyRow({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const [starting, setStarting] = useState(false);
  const run = home.nightly?.run ?? null;
  // One clock for the whole row: whether it is live, how long it has run, and
  // how long ago it ended all read the same instant.
  const now = useNow(d.now, run?.status === 'running' ? 1_000 : 30_000);
  const live = nightlyInFlight(run, now);
  const view = nightlyView(run, now);
  const busy = starting || live;

  const start = async () => {
    setStarting(true);
    try { await actions.runNightly(); } finally { setStarting(false); }
  };

  // "3m 10s" is one reading, and a line break inside it makes two.
  const nb = (x: string) => x.replace(/ /g, '\u00a0');
  const sub = home.nightly?.unreadable
    ? `Could not read the last run: ${home.nightly.unreadable}`
    : view.state === 'never' ? 'Does now what runs overnight: finds matches, reads replies, runs the checks, picks the call'
    : view.state === 'running' ? [
      view.by === 'schedule' ? 'Running on schedule' : 'Running',
      view.stepN ? `${view.stepN} of ${view.of}` : null,
      view.doing,
      nb(view.elapsed),
    ].filter(Boolean).join(' · ')
    : view.state === 'stopped' ? `${view.line} Started ${view.startedAgo}.`
    : view.state === 'failed' ? `Failed ${view.ago}: ${view.line}`
    : `Ran ${view.ago}${view.by === 'schedule' ? ' on schedule' : ''}${view.took ? ` · took ${nb(view.took)}` : ''}`;
  const bad = !!home.nightly?.unreadable || view.state === 'failed' || view.state === 'stopped';
  // Said when the last pass was not the schedule's own. When it was, the row
  // above already says "on schedule", and saying it twice is noise.
  const lastBySchedule = (view.state === 'done' || view.state === 'running' || view.state === 'failed' || view.state === 'stopped') && view.by === 'schedule';

  return (
    <div className="cp2-row cp2-nightly">
      <div className="cp2-nightly-head">
        <span className="cp2-row-main">
          <span className="t">Nightly run</span>
          <span className={`s${bad ? ' bad' : ''}`}>{sub}</span>
        </span>
        <button className="cp-connect ghost" disabled={busy} onClick={() => void start()}>{busy ? 'Running' : 'Run again'}</button>
      </div>
      {view.state === 'running' && (
        <div className="cp2-nightly-track" role="progressbar" aria-label="Nightly run progress" aria-valuemin={0} aria-valuemax={view.of} aria-valuenow={view.stepN}>
          <i style={{ width: `${Math.max(6, ((view.stepN - 0.5) / view.of) * 100)}%` }} />
        </div>
      )}
      {view.state === 'done' && view.lines.length > 0 && (
        <ul className="cp2-nightly-lines">
          {view.lines.map((l, i) => (
            <li key={i} className={l.tone}>
              <span className="cp2-nightly-mark" aria-hidden>{MARK[l.tone]}</span>
              <span className="cp2-nightly-text"><b>{SPOKEN[l.tone] && <span className="cp2-nightly-spoken">{SPOKEN[l.tone]}</span>}{l.name}</b> {l.text}</span>
            </li>
          ))}
        </ul>
      )}
      {!lastBySchedule && (
        <p className="cp2-nightly-sched">
          {home.lastCronRun
            ? `The schedule last ran ${agoLabel(home.lastCronRun, now)}.`
            : 'The schedule has not run for this account yet. Running it here does not count as the schedule.'}
        </p>
      )}
    </div>
  );
}
