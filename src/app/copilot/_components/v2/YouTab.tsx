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
import type { MatchStage } from '@/lib/copilot/matches';
import { nightlyInFlight, nightlyView, type NightlyLine } from '@/lib/copilot/nightly';
import type { PathIcon } from '@/lib/copilot/pathway';
import type { ReviewChange, ReviewKind, ReviewLine, ReviewProgress, ReviewTarget } from '@/lib/copilot/review';
import { CAPACITY_META, type HomeData } from '@/lib/copilot/types';
import { money } from '../format';
import { creditedGoalId, goalCard } from '@/lib/copilot/goalcard';
import { currencyMark, dayLabel, recentLabel } from '@/lib/copilot/money/ledger';
import { mainCurrency } from '@/lib/copilot/money/fx';
import { HOW_LABEL, sensorViews } from '@/lib/copilot/sensors';
import type { Actions } from '../shared';
import { useShell } from '../shell';
import type { Derived } from './derive';
import { IconAlert, IconCheck, IconChevron, PathGlyph } from './icons2';

export default function YouTab({ home, d, actions, openMatches }: { home: HomeData; d: Derived; actions: Actions; openMatches: (s: MatchStage) => void }) {
  return (
    <>
      <Numbers home={home} d={d} actions={actions} />
      <Week home={home} d={d} actions={actions} openMatches={openMatches} />
      <Goals home={home} actions={actions} />
      <Records home={home} d={d} actions={actions} />
      <Settings home={home} d={d} actions={actions} />
    </>
  );
}

/* ─── The numbers ─────────────────────────────────────────────────────────── */

/**
 * Four stat tiles, each a figure off rows the user made: money in, runway,
 * deep work they logged, replies matched to what they sent. A tile with
 * nothing behind it says what would fill it, rather than showing a zero that
 * looks like a measurement.
 *
 * With statements on file, Money in is what their bank shows came in over the
 * last thirty days of rows, and Runway is the finance row the rows settle. The
 * money card that sat under these repeated both in prose; it went, and the
 * questions it carried ("2 to name") went to the Bank statements row in Records.
 */
function Numbers({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const m = home.metrics;
  const f = home.forecast;
  const fin = home.profile.finance;
  const read = home.money?.read ?? null;
  // Runway is in the finance row's currency, which follows the bank; d.currency is the sales one.
  const runCur = fin?.currency || d.currency;
  const burnOnly = m.runway_months == null && !!fin?.monthly_burn && fin.cash == null;
  const week = d.week;
  const peak = Math.max(...week.days.map((x) => x.minutes), 60);
  return (
    <div className="cp2-tiles" aria-label="Your numbers">
      {read ? (
        <button className="cp2-tile" onClick={() => actions.openSheet({ kind: 'moneyin' })}>
          <span className="l">Money in</span>
          <span className="v">{read.recent.in > 0 ? money(Math.round(read.recent.in), read.currencyKnown ? currencyMark(read.currency) : '') : '—'}</span>
          <span className="s">{recentLabel(read.recent, home.recent.today).replace(/^./, (c) => c.toLowerCase())} · from your bank</span>
        </button>
      ) : (
        <button className="cp2-tile" onClick={() => actions.openSheet({ kind: 'moneyin' })}>
          <span className="l">Money in</span>
          <span className="v">{m.won_amount ? money(m.won_amount, d.currency) : m.won ? `${m.won} won` : '—'}</span>
          <span className="s">{m.won ? `${m.won} win${m.won === 1 ? '' : 's'} · last ${m.window_days} days` : `Nothing logged as won in ${m.window_days} days`}</span>
        </button>
      )}

      <button className="cp2-tile" onClick={() => actions.openSheet({ kind: 'finance' })}>
        <span className="l">Runway</span>
        <span className="v">{m.runway_months != null ? `${m.runway_months} mo` : burnOnly ? 'Add cash' : 'Set it'}</span>
        <span className="s">
          {/* The rows gave the burn and no balance (a budget export prints none): the one number left to type. */}
          {burnOnly ? `${money(fin?.monthly_burn ?? 0, runCur)}/mo spent · type your cash`
            : m.runway_months == null && read && !read.currencyKnown ? 'Say your statement’s currency'
            : m.runway_months == null ? (home.money?.ready ? 'Upload a statement, or type two numbers' : 'Cash and monthly burn — two numbers')
            : f?.changesTheAnswer ? `${f.forecastMonths} mo with what is owed`
            // Where the number came from, when it came off a statement: a balance from 25 Sep is not today's.
            : fin?.source?.cash === 'statement' && fin.cash_on ? `${money(fin.cash ?? 0, runCur)} on ${dayLabel(fin.cash_on)} · from your bank`
            : fin?.source?.cash === 'book' ? `${money(fin.cash ?? 0, runCur)} · your Money tab balance`
            : `${money(fin?.cash ?? 0, runCur)} cash · ${money(fin?.monthly_burn ?? 0, runCur)}/mo`}
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

function Week({ home, d, actions, openMatches }: { home: HomeData; d: Derived; actions: Actions; openMatches: (s: MatchStage) => void }) {
  const r = d.review;
  const go = (t: ReviewTarget) => {
    if (t === 'queue') actions.openSheet({ kind: 'queue' });
    else if (t === 'sources') actions.openSheet({ kind: 'watchlist' });
    else if (t === 'projects') actions.setTab('work');
    else if (t === 'focus') actions.openSheet({ kind: 'focus' });
    else if (t === 'matches') actions.setTab('swipe');
    else if (t === 'record') actions.openSheet({ kind: 'ask' });
    else if (t === 'won') actions.openSheet({ kind: 'stage', stage: 'won' });
    // A reply is followed up where replies are: the outreach sheet, on its own pill.
    else if (t === 'replied' || t === 'waiting') openMatches(t);
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
          ? <ReviewRows lines={r.value} go={go} tone="value" />
          : <p className="cp2-review-empty">{r.valueEmpty}</p>}
      </div>

      <div className="cp-card cp2-review waste">
        <div className="cp2-review-head"><span className="cp2-mark warn"><IconAlert /></span>What was wasted</div>
        {r.waste.length
          ? <ReviewRows lines={r.waste} go={go} tone="waste" />
          : <p className="cp2-review-empty">Nothing counted as wasted: no stale drafts, no dead sources, no project closed with nothing to show.</p>}
      </div>

      <ChangeCard change={r.change} go={go} />

      <button className="cp2-more" onClick={() => actions.openSheet({ kind: 'ask' })}>Ask your own record</button>
    </>
  );
}

/** One glyph per kind of line, so the card reads at a glance: money, a reply, a thing done, hours. */
const GLYPH: Record<ReviewKind, PathIcon> = {
  money: 'money', worth: 'research', reply: 'reply', meeting: 'meeting', did: 'done', focus: 'focus',
  queue: 'send', calls: 'call', projects: 'research', sources: 'watcher', binned: 'lost',
};

/** Where an opened line leads, said at its foot. */
const OPEN_LABEL: Record<Exclude<ReviewTarget, null>, string> = {
  queue: 'Open the queue', sources: 'Open your sources', projects: 'Open Work', matches: 'Open Swipe',
  focus: 'Log time', record: 'Ask your record about it', won: 'See every win', replied: 'Open your replies', waiting: 'See who you are waiting on',
};

function ReviewRows({ lines, go, tone }: { lines: ReviewLine[]; go: (t: ReviewTarget) => void; tone: 'value' | 'waste' }) {
  return <ul className="cp2-rv-list">{lines.map((l) => <ReviewRow key={l.key} line={l} go={go} tone={tone} />)}</ul>;
}

/**
 * One line of the week: a glance when closed — two lines at most, whatever it
 * says — and the rows behind it when opened: the calls, the days, the drafts,
 * the sources and why each failed. Opening never navigates; the way somewhere
 * is at the foot, once you have seen what it is about. A line with nothing
 * behind it that leads somewhere is a plain link, and one with neither is text.
 *
 * Keyed by the line's own key, so a line left open stays open when the week
 * under it refreshes — logging an hour must not snap the card shut.
 */
function ReviewRow({ line, go, tone }: { line: ReviewLine; go: (t: ReviewTarget) => void; tone: 'value' | 'waste' }) {
  const [open, setOpen] = useState(false);
  const opens = line.detail.length > 0 || line.items.length > 0;
  const head = (
    <>
      <span className={`cp2-rv-glyph ${tone}`}><PathGlyph icon={GLYPH[line.kind]} /></span>
      <span className="cp2-rv-main">
        <span className={`cp2-rv-text${open ? '' : ' cp2-clamp2'}`}>{line.text}</span>
        {/* The day under the text, not beside it: beside it, the pill took a third of
            the width and an opened line ran nine lines tall in what was left. */}
        {(line.when || line.sub) && (
          <span className="cp2-rv-meta">
            {line.when && <span className="cp2-rv-when">{line.when}</span>}
            {line.sub && <span className="cp2-rv-sub">{line.sub}</span>}
          </span>
        )}
      </span>
      {(opens || line.target) && <span className={`cp2-rv-chev${opens ? ' fold' : ''}${open ? ' open' : ''}`}><IconChevron /></span>}
    </>
  );
  return (
    <li className="cp2-rv-row">
      {opens
        ? <button className="cp2-rv-tap" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{head}</button>
        : line.target
        ? <button className="cp2-rv-tap" onClick={() => go(line.target)}>{head}</button>
        : <div className="cp2-rv-tap">{head}</div>}
      {open && (
        <div className="cp2-rv-open">
          {line.detail.map((t) => <p key={t} className="cp2-rv-detail">{t}</p>)}
          {line.items.length > 0 && (
            <ul className="cp2-rv-items">
              {line.items.map((it, i) => (
                <li key={`${i}:${it.text}`} className="cp2-rv-item">
                  <span className="cp2-rv-itop"><span className="t">{it.text}</span>{it.when && <span className="w">{it.when}</span>}</span>
                  {it.note && <span className="n">{it.note}</span>}
                </li>
              ))}
              {line.more > 0 && <li className="cp2-rv-item cp2-rv-rest">and {line.more} more</li>}
            </ul>
          )}
          {line.target && <button className="cp2-link cp2-rv-go" onClick={() => go(line.target)}>{OPEN_LABEL[line.target]} →</button>}
        </div>
      )}
    </li>
  );
}

/**
 * What has to change, and how far this week has got with it. The meter is the
 * experiment's own count off the rows (review.ts) — the same sends the week's
 * dots count — so it moves the moment something goes out; the button is the
 * one tap that moves it, and once the count is met, the one that follows it up.
 */
function ChangeCard({ change, go }: { change: ReviewChange | null; go: (t: ReviewTarget) => void }) {
  return (
    <div className="cp-card cp2-review change">
      <div className="cp2-review-head"><span className="cp2-mark next">→</span>What has to change</div>
      {change ? (
        <>
          <p className="cp2-change-head">{change.head}</p>
          {change.because && <p className="cp2-change-because">{change.because}</p>}
          <p className="cp2-change-body"><b>Try this week</b> {change.body}</p>
          {change.progress && <ChangeMeter progress={change.progress} />}
          {change.next && <p className="cp2-rv-next">{change.next}</p>}
          {change.action && (
            <button className="cp-btn primary block cp-call-do" onClick={() => go(change.action!.target)}>{change.action.label}</button>
          )}
        </>
      ) : (
        <p className="cp2-review-empty">Nothing measured points anywhere yet. Send something, log what comes back, and this fills in.</p>
      )}
    </div>
  );
}

/** One dot per send or reply the experiment asks for, and the words, which say it on their own. */
function ChangeMeter({ progress: p }: { progress: ReviewProgress }) {
  return (
    <div className={`cp2-rv-meter${p.met ? ' met' : ''}`}>
      <span className="cp2-rv-dots" aria-hidden>
        {Array.from({ length: p.of }, (_, i) => <i key={i} className={i < p.done ? 'on' : ''} />)}
      </span>
      <span className="cp2-rv-mlabel">{p.met && <IconCheck />}{p.label}</span>
    </div>
  );
}

/* ─── Goals ───────────────────────────────────────────────────────────────── */

function Goals({ home, actions }: { home: HomeData; actions: Actions }) {
  const m = home.metrics;
  // The one goal a logged win moves; only its card says what wins added.
  const credited = creditedGoalId(home.goals);
  return (
    <>
      <div className="cp-section"><span className="lead">Goals</span><button className="link" onClick={() => actions.openSheet({ kind: 'goal' })}>+ Add</button></div>
      {home.goals.length ? home.goals.map((g) => {
        const card = goalCard(g, { today: home.recent.today, creditedId: credited, wonAmount: m.won_amount, windowDays: m.window_days });
        return (
          <button key={g.id} className="cp-card cp-goal cp2-goal" onClick={() => actions.openSheet({ kind: 'goal', id: g.id })}>
            <div className="top"><span className="name">{g.title}</span><span className="pct">{card.badge}</span></div>
            {/* A meter only where there is a target to be a fraction of. A goal
                with no number behind it gets its note, not an empty bar. */}
            {card.pct !== null && <div className="track"><div className="cp-fill" style={{ width: `${card.pct}%` }} /></div>}
            <div className="sub">{card.sub}</div>
          </button>
        );
      }) : (
        <div className="cp-empty"><b>No goal yet</b>Add one and the call, the projects it proposes and this tab all point at it.</div>
      )}
    </>
  );
}

/* ─── Records ─────────────────────────────────────────────────────────────── */

/**
 * What the app reads instead of asking, one row per sensor (lib/copilot/sensors.ts).
 * A new kind of record is a row in SENSORS and its sheet; this renders whatever
 * is there, and never a row for one that has no sheet yet.
 */
function Records({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const m = home.money;
  const views = sensorViews({
    bank: m ? {
      ready: m.ready,
      rows: m.rows,
      to: m.read?.to ?? null,
      reading: m.imports.filter((i) => i.status === 'reading').length,
      review: m.imports.filter((i) => i.status === 'review').length,
      failed: m.imports.filter((i) => i.status === 'failed').length,
      unreadable: m.unreadable,
      toName: (m.read?.toName.length ?? 0) + (m.read?.ownCheck.length ?? 0),
      unlabelled: m.imports.filter((i) => (i.status === 'ready' || i.status === 'review') && !i.currency).length,
    } : null,
    owed: { open: home.obligations.length },
    focus: { minutesWeek: d.week.total },
    feeds: { total: home.watchSources.length, failing: home.watchSources.filter((s) => !!s.last_error).length },
  });
  return (
    <>
      <div className="cp-section"><span className="lead">Records</span><span className="count">what it reads instead of asking</span></div>
      <div className="cp-list cp2-rows">
        {views.map((v) => (
          <button key={v.key} className="cp2-row" onClick={() => actions.openSheet({ kind: v.sheet })}>
            <span className="cp2-row-main">
              <span className="t">{v.label}</span>
              <span className="s cp2-clamp1">{v.line}</span>
            </span>
            <span className={`cp2-recs-state ${v.state}`}>{v.state === 'on' ? HOW_LABEL[v.how] : v.state === 'attention' ? 'Look' : 'Not yet'}</span>
            <IconChevron />
          </button>
        ))}
      </div>
    </>
  );
}

/* ─── Settings ────────────────────────────────────────────────────────────── */

function Settings({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const shell = useShell();
  const p = home.profile;
  const b = home.billing;
  const rows: Array<{ key: string; l: string; s: string; onClick?: () => void; href?: string; right?: string }> = [
    { key: 'offer', l: 'Your offer', s: p.offer?.sells || 'Not set — nothing is drafted without it', onClick: () => actions.openSheet({ kind: 'offer' }) },
    { key: 'targeting', l: 'Who it looks for', s: p.target_segments.length ? `${p.target_segments.join(', ')}${p.target_area || p.location ? ` · ${p.target_area || p.location}` : ''}` : 'Not set', onClick: () => actions.openSheet({ kind: 'targeting' }) },
    { key: 'working', l: 'How you work', s: `${home.workingProgress?.filled ?? 0} of ${home.workingProgress?.total ?? 6} written${home.workingProgress?.proposals ? ` · ${home.workingProgress.proposals} to check` : ''}`, onClick: () => actions.openSheet({ kind: 'working' }) },
    // The currency every figure is counted in; statements in others are converted into it.
    { key: 'currency', l: 'Currency', s: 'Everything is counted in it · other currencies converted', onClick: () => actions.openSheet({ kind: 'currency' }), right: mainCurrency(p.finance, home.goals) },
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
