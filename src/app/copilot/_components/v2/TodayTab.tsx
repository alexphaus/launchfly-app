'use client';
// Today: the call, what was done for you, what needs you, what else is worth
// doing — and the one input. Four parts, each with one job; see
// lib/copilot/today.ts for why each Move lives in exactly one of them.
//
// Rows, not cards, below the call. A card per item is how the old Now reached
// nine blocks: every item got the full weight of a decision, so nothing on the
// screen could outrank anything else. Here only the call is a card. Everything
// else is a line that opens its work in a sheet — the work is still one tap
// away, and the screen stays short enough to read at nine in the morning.
import { useState } from 'react';
import { ASK_LABEL, worthDoing, type AskRow, type DoneRow } from '@/lib/copilot/today';
import { agoLabel } from '@/lib/copilot/machine';
import { KIND_LABEL } from '@/lib/copilot/moves';
import type { HomeData, Move } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import { CallCard, FirstRun } from '../views/NowView';
import type { Derived } from './derive';
import { IconAlert, IconCheck, IconChevron } from './icons2';

export default function TodayTab({ home, d, actions, briefing, finding }: { home: HomeData; d: Derived; actions: Actions; briefing: boolean; finding: boolean }) {
  return (
    <>
      {home.decision
        ? <CallCard decision={home.decision} home={home} actions={actions} noOffer={d.noOffer} />
        : d.nothingYet
        ? <FirstRun home={home} actions={actions} finding={finding} />
        : <NoCallYet home={home} actions={actions} briefing={briefing} />}

      <DoneForYou home={home} d={d} actions={actions} />

      {d.asks.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Needs you</span><span className="count">{d.asks.length}</span></div>
          <div className="cp-list cp2-rows">
            {d.asks.map((a) => <AskLine key={a.key} ask={a} actions={actions} />)}
          </div>
        </>
      )}

      <WorthDoing moves={d.worth.shown} more={d.worth.more} all={home.moves} actions={actions} />

      <Tell home={home} actions={actions} briefing={briefing} />
    </>
  );
}

/**
 * No call on a day that is not a first run: the brief has not run yet, or ran
 * and wrote only a read. The read is shown when there is one, because it is the
 * only sentence the model wrote today; otherwise the way to get a call is here.
 */
function NoCallYet({ home, actions, briefing }: { home: HomeData; actions: Actions; briefing: boolean }) {
  if (briefing) return null;
  if (home.insight) {
    return (
      <div className="cp-card cp-insight">
        <div className="cp-eyebrow">{home.insight.eyebrow}</div>
        <p>{home.insight.body}</p>
      </div>
    );
  }
  return (
    <div className="cp-card">
      <div className="cp-eyebrow">Today&rsquo;s call</div>
      <p className="cp2-lede">Nothing has been weighed yet today.</p>
      <button className="cp-btn primary block cp-call-do" onClick={() => void actions.runBrief('manual')}>Pick today&rsquo;s call</button>
    </div>
  );
}

/**
 * What the app did while you were not looking — the promise of the product,
 * finally said on the screen. A job that never ran is said too, in place of the
 * list rather than above it: with no nightly run, everything below was worked
 * out the moment the app opened, and that must not look like a quiet night.
 */
function DoneForYou({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const r = d.done;
  const tz = home.profile.timezone;
  const at = r.nightlyAt ? clock(r.nightlyAt, tz) : null;
  const go = (row: DoneRow) => {
    if (row.target === 'matches') actions.setTab('matches');
    else if (row.target === 'sources') actions.openSheet({ kind: 'watchlist' });
    else if (row.target === 'project' && row.id) actions.openSheet({ kind: 'commission', id: row.id });
    else if (row.target === 'replies') actions.openSheet({ kind: 'stage', stage: 'replied' });
  };

  return (
    <>
      <div className="cp-section">
        <span className="lead">Done for you</span>
        <span className="count">{at ? `ran ${at}` : 'last 24 hours'}</span>
      </div>
      <div className="cp-list cp2-rows cp2-done">
        {r.stale && (
          <div className="cp2-row warn">
            <span className="cp2-mark warn"><IconAlert /></span>
            <span className="cp2-row-main">
              <span className="t">Nothing ran overnight</span>
              <span className="s">
                {home.lastCronRun
                  ? `The nightly job last finished ${agoLabel(home.lastCronRun, d.now)}. Until it runs again, this only changes when you open the app.`
                  : 'The nightly job has never run, so nothing is found while you are away. Everything here was worked out when you opened the app.'}
              </span>
            </span>
          </div>
        )}
        {r.broke.length > 0 && (
          <div className="cp2-row warn">
            <span className="cp2-mark warn"><IconAlert /></span>
            <span className="cp2-row-main">
              <span className="t">{r.broke.length === 1 ? 'A check failed on the last run' : `${r.broke.length} checks failed on the last run`}</span>
              <span className="s">{r.broke.join(' · ')}</span>
            </span>
          </div>
        )}
        {r.rows.map((row) => {
          // A row reporting a failure wears the warning mark, never the tick.
          const body = (
            <>
              <span className={`cp2-mark ${row.tone === 'warn' ? 'warn' : 'done'}`}>{row.tone === 'warn' ? <IconAlert /> : <IconCheck />}</span>
              <span className="cp2-row-main">
                <span className="t">{row.label}</span>
                <span className="s">{row.detail}</span>
              </span>
            </>
          );
          // The Moves are listed right below this card, so their row goes
          // nowhere — and a row that goes nowhere is text, not a button.
          return row.target === 'moves'
            ? <div key={row.key} className="cp2-row">{body}</div>
            : <button key={row.key} className="cp2-row" onClick={() => go(row)}>{body}<IconChevron /></button>;
        })}
        {/* Not under a failure: a night where checks broke is not a quiet one. */}
        {!r.rows.length && !r.stale && !r.broke.length && (
          <div className="cp2-row">
            <span className="cp2-mark"><IconCheck /></span>
            <span className="cp2-row-main">
              <span className="t">Quiet night</span>
              <span className="s">{r.looked ? `${r.looked} checks looked and nothing new turned up.` : 'Nothing new turned up.'} {home.watchSources.length ? '' : 'Add a source and it reads it every night.'}</span>
            </span>
          </div>
        )}
      </div>
    </>
  );
}

/** One ask. The chip says what kind of answer it wants before the words do. */
function AskLine({ ask, actions }: { ask: AskRow; actions: Actions }) {
  const open = () => {
    if (ask.kind === 'confirm') actions.openSheet({ kind: 'capture' });
    else if (ask.kind === 'send') actions.openSheet({ kind: 'queue' });
    else if (ask.id) actions.openSheet({ kind: 'commission', id: ask.id });
  };
  return (
    <button className={`cp2-row ask ${ask.kind}`} onClick={open}>
      <span className="cp2-row-main">
        <span className={`cp2-kind ${ask.kind}`}>{ASK_LABEL[ask.kind]}</span>
        <span className="t cp2-clamp2">{ask.title}</span>
        <span className="s cp2-clamp1">{ask.detail}</span>
      </span>
      <IconChevron />
    </button>
  );
}

/**
 * The other Moves worth doing today, three at most, as rows. The work behind
 * each — the drafted message, the link, the finding — opens in a sheet, because
 * a Move without its artifact is advice and the row is only the way in.
 */
function WorthDoing({ moves, more, all, actions }: { moves: Move[]; more: number; all: Move[]; actions: Actions }) {
  const [open, setOpen] = useState(false);
  if (!moves.length) return null;
  // "Show more" is the same selection, uncapped — one rule for what belongs here.
  const list = open ? worthDoing(all, Number.POSITIVE_INFINITY).shown : moves;
  return (
    <>
      <div className="cp-section"><span className="lead">Worth doing</span><span className="count">worked out from your rows</span></div>
      <div className="cp-list cp2-rows">
        {list.map((m) => (
          <button key={m.id} className="cp2-row" onClick={() => actions.openSheet({ kind: 'move', id: m.id })}>
            <span className="cp2-row-main">
              <span className="cp2-kindline">
                <span className="cp2-kind move">{KIND_LABEL[m.kind]}</span>
                {/* Said when the work is already done and only needs a yes. */}
                {m.artifact.kind === 'message' && <span className="cp2-ai">Drafted</span>}
                {m.cost_label && <span className="cp2-cost">{m.cost_label}</span>}
              </span>
              <span className="t cp2-clamp2">{m.headline}</span>
            </span>
            <IconChevron />
          </button>
        ))}
      </div>
      {more > 0 && !open && <button className="cp2-more" onClick={() => setOpen(true)}>{more} more</button>}
    </>
  );
}

/** The one input in the app: what changed, in the person's own words. */
function Tell({ home, actions, briefing }: { home: HomeData; actions: Actions; briefing: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!note.trim()) return;
    setSending(true);
    const saved = await actions.addNote(note.trim(), true);
    if (saved) { setNote(''); setOpen(false); }
    setSending(false);
  };
  if (!open) {
    return (
      <button className="cp-tell cp2-tell" onClick={() => setOpen(true)}>
        <span className="t">Tell it what changed</span>
        <span className="s">{home.contextCount} things it knows · changes tomorrow&rsquo;s call</span>
      </button>
    );
  }
  return (
    <div className="cp-composer cp2-tell">
      <textarea
        autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000}
        placeholder="Maria replied. Burn is down to 200. I have an interview Thursday…"
      />
      <div className="bar">
        <span className="hint">Changes tomorrow&rsquo;s call.</span>
        <button className="cp-btn" disabled={sending} onClick={() => { setOpen(false); setNote(''); }}>Cancel</button>
        <button className="cp-btn primary" disabled={sending || briefing || !note.trim()} onClick={() => void submit()}>Add &amp; re-plan</button>
      </div>
    </div>
  );
}

/** "5:02 AM" where the person lives — the same on the server render and the client. */
function clock(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 16);
  }
}
