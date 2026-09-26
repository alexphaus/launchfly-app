'use client';
// You: how it is going, in the numbers that are actually yours, then the path
// to money and the team running it, then the week read back, then goals, then
// everything that is settings.
//
// The path to money and the team came from Work when the Path replaced it. They
// are how the whole thing is doing rather than what to do next — the Path is for
// that — so they sit with the numbers, where "how is it going" is asked.
//
// What left, and why. The Working? tab rendered the funnel, the openings, a
// per-segment read, the log of calls and the findings: five sections of true
// record that its owner opened and found "a log, static, without much value".
// The funnel is still one tap away — it is the path to money below, where each
// stage opens the businesses in it — and "Ask your own record" still answers by
// counting. What this tab does instead is ask the three questions a person
// actually has about a week, and answer each with the rows behind it. See
// lib/copilot/review.ts.
import { PLANS } from '@/lib/copilot/plans';
import { hoursLabel } from '@/lib/copilot/focus';
import { agoLabel } from '@/lib/copilot/machine';
import type { ReviewLine, ReviewTarget } from '@/lib/copilot/review';
import { CAPACITY_META, type HomeData } from '@/lib/copilot/types';
import { goalProgress, money } from '../format';
import type { Actions } from '../shared';
import { useShell } from '../shell';
import { BuildWithClaude, Machine, Projects, Team } from './Business';
import type { Derived } from './derive';
import { IconAlert, IconCheck, IconChevron } from './icons2';

export default function YouTab({ home, d, actions, briefing }: { home: HomeData; d: Derived; actions: Actions; briefing: boolean }) {
  return (
    <>
      <Numbers home={home} d={d} actions={actions} />
      <Machine stages={d.machine} actions={actions} />
      <Week home={home} d={d} actions={actions} />
      <Goals home={home} actions={actions} />
      <Team agents={d.team} actions={actions} briefing={briefing} />
      <Projects home={home} actions={actions} />
      <BuildWithClaude actions={actions} />
      <Settings home={home} d={d} actions={actions} briefing={briefing} />
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
    // The finished ones are listed further down this tab; the ones under way are on the Path.
    else if (t === 'projects') document.getElementById('cp2-projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

function Settings({ home, d, actions, briefing }: { home: HomeData; d: Derived; actions: Actions; briefing: boolean }) {
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
        <div className="cp2-row">
          <span className="cp2-row-main">
            <span className="t">Today&rsquo;s call</span>
            <span className="s">{home.lastRun ? `${home.lastRun.status === 'error' ? 'Last run failed' : 'Last weighed'} ${home.lastRun.finished_at ? agoLabel(home.lastRun.finished_at, d.now) : ''}` : 'Not weighed yet'}</span>
          </span>
          <button className="cp-connect ghost" disabled={briefing} onClick={() => void actions.runBrief('manual')}>{briefing ? 'Running' : 'Run again'}</button>
        </div>
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
