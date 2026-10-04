'use client';
// Lab: one bet at a time, judged by the rows.
//
//   Checkpoint     every two weeks, once a bet has ended: pivot or persevere,
//                  with what ended, what the chain did since the last answer,
//                  and that answer read back
//   This bet       the belief in the person's words, the pass line written
//                  before it began, the count against it, the play it runs,
//                  and the work an agent or a chat can do to get it ready
//   Plays          from business books, for one part of the business at a
//                  time — the weak link's first, because a bet on a part that
//                  already works teaches nothing
//   Conversations  The Mom Test's log: who, whether they have the problem, and
//                  what they committed. The one count the app cannot take itself
//   Learned        every bet that ended, passed or not, and what the person
//                  tried before the app
//   The clock      runway in bets: the book's pivots left, counted
//
// What it is not, by its owner's brief: no book summaries, no canvases to fill
// in, no daily quotas. A summary is what a chat is for. A canvas is a page of
// claims with nothing to test them against. A quota counts effort; the Lab
// counts results. lib/copilot/lab.ts has the rules, and why a verdict here is
// never a tap.
import { useState } from 'react';
import { LINK_LABEL, LINK_STATE_LABEL, changeLine, type LinkKey, type LinkMove } from '@/lib/copilot/business';
import { commissionChip } from '@/lib/copilot/commission';
import {
  BET_STATE_LABEL, METRIC, NOTE_MAX, PLAY_BY_KEY, TALK_BACK_DAYS,
  betPrice, countedFrom, dayWords, decisionWords, gradeWords, metricWords, overPlan, passLine, playLine, playsFor, talkCounts,
  type BetView, type LabDecision, type LabMetric, type Play,
} from '@/lib/copilot/lab';
import { salesCurrency } from '@/lib/copilot/metrics';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import type { Derived } from './derive';
import { IconChevron } from './icons2';
import { TalkRow } from './LabSheets';
import { MoveNote, MoveRow, agentIsFull, orChat, useBrief, useMove } from './MoveKit';

export default function LabTab({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const lab = d.lab;
  // Refused rather than shown empty: an unread Lab drawn as "no bets yet" would
  // invite a second bet beside the one running (invariant 13).
  if (lab.unreadable) {
    return (
      <div className="cp-card">
        <div className="cp-eyebrow">Lab</div>
        <div className="cp-error">Could not read your bets just now: {lab.unreadable}</div>
        <p className="cp-help">Nothing is shown rather than an empty Lab, and a new bet cannot start until it reads. Open the tab again in a minute.</p>
      </div>
    );
  }
  return (
    <>
      {lab.checkpoint.due && <Checkpoint d={d} actions={actions} />}
      {lab.current ? <ThisBet home={home} view={lab.current} actions={actions} /> : <NoBet d={d} />}
      <Plays home={home} d={d} actions={actions} />
      <Conversations home={home} d={d} actions={actions} />
      <Learned d={d} />
      <Clock home={home} d={d} actions={actions} />
    </>
  );
}

/* ─── Pivot or persevere ──────────────────────────────────────────────────── */

function Checkpoint({ d, actions }: { d: Derived; actions: Actions }) {
  const cp = d.lab.checkpoint;
  const links = d.work.chain.links;
  const [decision, setDecision] = useState<LabDecision | null>(null);
  const [part, setPart] = useState<LinkKey | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passed = cp.ended.filter((b) => b.state === 'passed').length;
  const back = cp.last ? gradeWords(cp.last, cp.grade) : null;

  const decide = async () => {
    if (!decision || (decision === 'pivot' && !part)) return;
    setBusy(true); setError(null);
    const r = await actions.lab({
      action: 'checkpoint',
      // The chain as it stands, kept with the answer: the next checkpoint
      // reads the decision back against what the chain did after it.
      checkpoint: { decision, part: decision === 'pivot' ? part : null, note: note.trim() || undefined, chain: Object.fromEntries(links.map((l) => [l.key, l.state])) },
    });
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Could not save that');
  };

  return (
    <div className="cp-card cp2-lab-check">
      <div className="cp-eyebrow">Checkpoint</div>
      <h2 className="cp2-lab-q">Pivot or persevere?</h2>
      <p className="cp2-lede">
        {cp.last ? `Since ${dayWords(cp.last.on)}` : 'So far'}, {cp.ended.length} {cp.ended.length === 1 ? 'bet' : 'bets'} ended and {passed} passed.
      </p>
      <div className="cp2-lab-check-list">
        {cp.ended.map((v) => (
          <div key={v.bet.id} className="cp2-lab-check-bet">
            <span className={`cp2-lab-verdict ${v.state}`}>{BET_STATE_LABEL[v.state]}</span>
            <span className="cp2-clamp2">{v.bet.belief}</span>
          </div>
        ))}
      </div>
      {cp.last && (
        <p className="cp2-lab-readback">
          <b>Last time, {dayWords(cp.last.on)}: {decisionWords(cp.last)}.</b>{back ? ` ${back}` : ''}
          {cp.last.note ? ` You wrote: “${cp.last.note}”` : ''}
        </p>
      )}
      {cp.moved.length > 0 && (
        <p className="cp2-lab-moved">
          Since then: {cp.moved.slice(0, 2).map(changeLine).join('; ')}{cp.moved.length > 2 ? `; and ${cp.moved.length - 2} more` : ''}.
        </p>
      )}

      <div className="cp2-lab-decide">
        <button className={`cp2-lab-opt${decision === 'persevere' ? ' on' : ''}`} aria-pressed={decision === 'persevere'} onClick={() => setDecision('persevere')}>
          <b>Persevere</b>
          <span>Keep the belief. The next bet tests it harder.</span>
        </button>
        <button className={`cp2-lab-opt${decision === 'pivot' ? ' on' : ''}`} aria-pressed={decision === 'pivot'} onClick={() => setDecision('pivot')}>
          <b>Pivot</b>
          <span>Change one part, and the next bet tests the change.</span>
        </button>
      </div>
      {decision === 'pivot' && (
        <div className="cp-field">
          <label className="cp-label">Which part changes</label>
          <div className="cp-chips">
            {links.map((l) => (
              <button key={l.key} className={`cp-fchip ${part === l.key ? 'active' : ''}`} aria-pressed={part === l.key} onClick={() => setPart(l.key)}>{l.label}</button>
            ))}
          </div>
        </div>
      )}
      {decision && (
        <div className="cp-field">
          <label className="cp-label" htmlFor="cp2-lab-why">Why, in a line — optional</label>
          <input id="cp2-lab-why" className="cp-input sm" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="Pest control answered; salons never did" />
        </div>
      )}
      {error && <div className="cp-error">{error}</div>}
      {decision && (
        <button className="cp-btn primary block" disabled={busy || (decision === 'pivot' && !part)} onClick={() => void decide()}>
          {busy ? 'Saving…' : decision === 'persevere' ? 'Persevere' : part ? `Pivot ${LINK_LABEL[part].toLowerCase()}` : 'Pick the part'}
        </button>
      )}
    </div>
  );
}

/* ─── The bet running ─────────────────────────────────────────────────────── */

/** What moves each count, one tap from the bet: the place where the thing it counts happens. */
const NEXT: Record<LabMetric, { label: string; go: (a: Actions) => void }> = {
  sent: { label: 'Open Swipe', go: (a) => a.setTab('swipe') },
  replied: { label: 'Open Swipe', go: (a) => a.setTab('swipe') },
  meetings: { label: 'Who replied', go: (a) => a.openSheet({ kind: 'outreach', stage: 'replied' }) },
  paid: { label: 'Who replied', go: (a) => a.openSheet({ kind: 'outreach', stage: 'replied' }) },
  paid_at_price: { label: 'Who replied', go: (a) => a.openSheet({ kind: 'outreach', stage: 'replied' }) },
  talks: { label: 'Log a conversation', go: (a) => a.openSheet({ kind: 'talk' }) },
  committed: { label: 'Log a conversation', go: (a) => a.openSheet({ kind: 'talk' }) },
  handed: { label: 'Hand a step over', go: (a) => a.setTab('work') },
};

/**
 * A play's prep as a move: the agent's where one is connected, a chat's where
 * none is — the rule Work's chain uses, so the same work is offered the same
 * way on both tabs.
 */
const prepMove = (p: Play, worker: boolean): LinkMove | null =>
  p.prep ? { key: `prep-${p.key}`, label: p.prep.label, by: p.prep.by === 'ai' && worker ? 'ai' : 'claude', ask: p.prep.ask } : null;

function ThisBet({ home, view, actions }: { home: HomeData; view: BetView; actions: Actions }) {
  const b = view.bet;
  const today = home.recent.today;
  const play = b.play ? PLAY_BY_KEY.get(b.play) ?? null : null;
  const brief = useBrief(actions);
  const move = useMove(actions, brief);
  const raw = play ? prepMove(play, home.workerConnected) : null;
  const prep = raw ? orChat(raw, agentIsFull(home)) : null;
  // The prep handed over already: its project, said in place of the button,
  // so a second tap does not start a second one.
  const job = raw?.ask ? home.commissions.find((t) => t.commission.objective === raw.ask && t.commission.status !== 'stopped') ?? null : null;
  const [stopping, setStopping] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pct = Math.min(100, Math.round((view.result / b.target) * 100));
  const over = overPlan(view);
  const next = NEXT[b.metric];
  // A bet decided by rows but planned in conversations still needs its log one tap away.
  const logToo = b.tries?.metric === 'talks' && METRIC[b.metric].from !== 'log';
  const why = play ? `For the bet "${b.belief}", run as ${play.label} from ${play.book}.` : undefined;

  const stop = async () => {
    setBusy(true); setError(null);
    const r = await actions.lab({ action: 'stop', id: b.id, note: note.trim() || undefined });
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Could not call it off');
  };

  return (
    <div className="cp-card cp2-lab-bet">
      <div className="cp-call-top">
        <div className="cp-eyebrow">This bet · day {view.day} of {b.days}{view.last === today ? ' · last day' : ''}</div>
        <span className="cp2-lab-partname">{LINK_LABEL[b.part]}</span>
      </div>
      <h2 className="cp2-lab-belief">&ldquo;{b.belief}&rdquo;</h2>

      <div className="cp2-lab-score">
        <span className="cp2-lab-n"><b>{view.result}</b> of {b.target}</span>
        <span className="cp2-lab-unit">{metricWords(b.metric, b.target, b.priceLabel)}</span>
      </div>
      <div className="cp2-lab-bar" role="progressbar" aria-label="Toward the pass line" aria-valuemin={0} aria-valuemax={b.target} aria-valuenow={Math.min(view.result, b.target)}>
        <i style={{ width: `${pct}%` }} />
      </div>
      {b.tries && view.tries != null && (
        <p className="cp2-lab-tries">{view.tries} of {b.tries.planned} {metricWords(b.tries.metric, b.tries.planned)} so far</p>
      )}
      <p className="cp2-lab-pass"><b>Pass line:</b> {passLine(b, view.last)}.</p>
      <p className="cp2-lab-src">{countedFrom(b.metric, b.start, b.priceLabel)}</p>
      {over && <p className="cp2-lab-over">{over}</p>}

      {play && (
        <div className="cp2-lab-playing">
          <span className="cp2-lab-book">{play.book} · {play.label}</span>
          <p>{play.how}</p>
        </div>
      )}

      {prep && (
        <div className="cp2-lab-prep">
          <span className="cp2-lab-prep-k">Get it ready</span>
          {job ? (
            <button className="cp2-bz-move ai" onClick={() => actions.openSheet({ kind: 'commission', id: job.commission.id })}>
              <span className="cp2-bz-move-m">
                <b>{prep.label}</b>
                <span>Your agent · {commissionChip(job.commission, job.report).label}</span>
              </span>
              <IconChevron />
            </button>
          ) : (
            <>
              <MoveRow m={prep} rerouted={!!raw && prep.by !== raw.by} busy={move.busy === prep.key} onRun={() => void move.run(prep, why)} />
              {move.note?.key === prep.key && <MoveNote note={move.note} />}
            </>
          )}
        </div>
      )}

      {stopping ? (
        <div className="cp2-lab-stop">
          <p>Call it off? It stays in what you learned as called off, with what it counted until today.</p>
          <input className="cp-input sm" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="What you learned — optional" aria-label="What you learned, optional" />
          {error && <div className="cp-error">{error}</div>}
          <div className="cp-btn-row">
            <button className="cp-btn" disabled={busy} onClick={() => void stop()}>{busy ? 'Calling it off…' : 'Call it off'}</button>
            <button className="cp-btn primary" disabled={busy} onClick={() => { setStopping(false); setError(null); }}>Keep it running</button>
          </div>
        </div>
      ) : (
        <div className="cp2-lab-actions">
          <button className="cp-btn primary" onClick={() => next.go(actions)}>{next.label}</button>
          {logToo && <button className="cp-btn" onClick={() => actions.openSheet({ kind: 'talk' })}>Log a conversation</button>}
          <button className="cp2-link muted" onClick={() => setStopping(true)}>Call it off</button>
        </div>
      )}
    </div>
  );
}

function NoBet({ d }: { d: Derived }) {
  const weak = d.work.chain.weak;
  const last = d.lab.learned[0] ?? null;
  return (
    <div className="cp-card cp2-lab-bet">
      <div className="cp-eyebrow">No bet running</div>
      <h2 className="cp2-lab-q">What do you believe that you have not tested?</h2>
      <p className="cp2-lede">
        {weak
          ? `Your weak link is ${LINK_LABEL[weak].toLowerCase()}, so the plays below start there.`
          : 'Pick a part below and a play for it.'}
        {' '}You set the line before it starts, and only what happens after counts.
      </p>
      {last && (
        <p className="cp2-lab-lastbet">
          <span className={`cp2-lab-verdict ${last.state}`}>{BET_STATE_LABEL[last.state]}</span>
          <span>Last bet: {last.result} of {last.bet.target} {metricWords(last.bet.metric, last.bet.target, last.bet.priceLabel)}{last.ended ? `, ${dayWords(last.ended)}` : ''}</span>
        </p>
      )}
    </div>
  );
}

/* ─── The plays ───────────────────────────────────────────────────────────── */

function Plays({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const { links, weak } = d.work.chain;
  const current = d.lab.current;
  // The part the person picked; before that, the one the bet is on, then the weak link.
  const [picked, setPicked] = useState<LinkKey | null>(null);
  const part = picked ?? current?.bet.part ?? weak ?? 'who';
  const link = links.find((l) => l.key === part) ?? null;
  const { priceLabel } = betPrice(home.profile.offer?.price_band, salesCurrency(home.profile.finance, home.goals));
  // The play running is on the bet above, with its own dates and count;
  // listed again here it would be a second copy of the card.
  const plays = playsFor(part).filter((p) => p.key !== current?.bet.play);
  return (
    <>
      <div className="cp-section">
        <span className="lead">Plays</span>
        <span className="count">from books, for one part</span>
      </div>
      <div className="cp2-lab-parts" aria-label="Part of the business">
        {links.map((l) => (
          <button key={l.key} className={`cp2-lab-partchip ${l.state}${l.key === part ? ' on' : ''}`} aria-pressed={l.key === part} onClick={() => setPicked(l.key)}>
            <i aria-hidden />{l.label}
          </button>
        ))}
      </div>
      {link && (
        <p className="cp2-lab-partwhy">
          <b>{LINK_STATE_LABEL[link.state]}{weak === link.key ? ', and the weak link' : ''}.</b> {link.why}
        </p>
      )}
      {current && (
        <p className="cp2-lab-onebet">One bet at a time. The next one can start when this one ends, {dayWords(current.last)}, or once you call it off.</p>
      )}
      <div className="cp2-lab-plays">
        {plays.map((p) => (
          <div key={p.key} className="cp2-lab-playcard">
            <span className="cp2-lab-book">{p.book}</span>
            <b className="cp2-lab-play-t">{p.label}</b>
            <p className="cp2-lab-play-how">{p.how}</p>
            <p className="cp2-lab-play-pass">Pass line: {playLine(p, priceLabel)}</p>
            {!current && <button className="cp-btn sm primary" onClick={() => actions.openSheet({ kind: 'bet', play: p.key })}>Make it my bet</button>}
          </div>
        ))}
        {!current && (
          <button className="cp2-lab-own" onClick={() => actions.openSheet({ kind: 'bet', part })}>
            <span>Write your own bet on {LINK_LABEL[part].toLowerCase()}</span>
            <IconChevron />
          </button>
        )}
      </div>
    </>
  );
}

/* ─── Conversations ───────────────────────────────────────────────────────── */

function Conversations({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const talks = d.lab.talks;
  const today = home.recent.today;
  const c = talkCounts(talks, today);
  return (
    <>
      <div className="cp-section">
        <span className="lead">Conversations</span>
        {talks.length > 0 && <button className="link" onClick={() => actions.openSheet({ kind: 'talks' })}>All {talks.length}</button>}
      </div>
      <div className="cp-card cp2-lab-talks">
        {c.n > 0 ? (
          <div className="cp2-lab-tally">
            <span><b>{c.n}</b>in {TALK_BACK_DAYS} days</span>
            <span><b>{c.committed}</b>committed</span>
            <span><b>{c.have}</b>have the problem</span>
          </div>
        ) : (
          <p className="cp2-lede">
            {talks.length ? `None in the last ${TALK_BACK_DAYS} days.` : 'None logged yet.'} One counts when it ends in another call, an intro or money; a compliment is not a result. Log each the day it happens: the app cannot hear your calls.
          </p>
        )}
        {talks.slice(0, 3).map((t) => <TalkRow key={t.id} talk={t} today={today} />)}
        <button className="cp-btn block" onClick={() => actions.openSheet({ kind: 'talk' })}>Log a conversation</button>
      </div>
    </>
  );
}

/* ─── What you learned ────────────────────────────────────────────────────── */

function Learned({ d }: { d: Derived }) {
  const ended = d.lab.learned;
  const before = d.work.said.tried ?? [];
  const passed = ended.filter((v) => v.state === 'passed').length;
  return (
    <>
      <div className="cp-section">
        <span className="lead">What you learned</span>
        {ended.length > 0 && <span className="count">{passed} of {ended.length} passed</span>}
      </div>
      {!ended.length && !before.length ? (
        <p className="cp2-bz-quiet">Every bet that ends lands here, passed or not. One that did not pass is the cheapest lesson the business will get.</p>
      ) : (
        <div className="cp-list cp2-rows cp2-lab-learned">
          {ended.map((v) => {
            const play = v.bet.play ? PLAY_BY_KEY.get(v.bet.play) : null;
            const over = v.state === 'passed' ? overPlan(v) : null;
            return (
              <div key={v.bet.id} className="cp2-row">
                <span className="cp2-row-main">
                  <span className="t cp2-clamp2">{v.bet.belief}</span>
                  <span className="s">
                    {v.result} of {v.bet.target} {metricWords(v.bet.metric, v.bet.target, v.bet.priceLabel)}
                    {' · '}{LINK_LABEL[v.bet.part]}{play ? ` · ${play.book}` : ''}
                    {' · '}<span className="cp2-lab-nowrap">{dayWords(v.bet.start)}{v.ended && v.ended !== v.bet.start ? `–${dayWords(v.ended)}` : ''}</span>
                  </span>
                  {over && <span className="s cp2-lab-over">{over}</span>}
                  {v.note && <span className="s cp2-lab-note">&ldquo;{v.note}&rdquo;</span>}
                </span>
                <span className={`cp2-lab-verdict ${v.state}`}>{BET_STATE_LABEL[v.state]}</span>
              </div>
            );
          })}
          {/* What the person wrote they tried before the app, in their words: the record did not start with the Lab. */}
          {before.map((line, i) => (
            <div key={`before-${i}`} className="cp2-row">
              <span className="cp2-row-main">
                <span className="t cp2-clamp2">{line}</span>
                <span className="s">Before the app, in your words</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ─── The clock ───────────────────────────────────────────────────────────── */

function Clock({ home, d, actions }: { home: HomeData; d: Derived; actions: Actions }) {
  const c = d.lab.clock;
  const cp = d.lab.checkpoint;
  const today = home.recent.today;
  const back = cp.last ? gradeWords(cp.last, cp.grade) : null;
  const nextLine = !cp.last
    ? 'The first checkpoint comes when a bet ends.'
    : cp.due
      ? null
      : cp.ended.length && cp.nextOn
        ? `The next checkpoint is ${cp.nextOn <= today ? 'today' : dayWords(cp.nextOn)}.`
        : `The next checkpoint comes once a bet has ended${cp.nextOn && cp.nextOn > today ? `, from ${dayWords(cp.nextOn)}` : ''}.`;
  return (
    <>
      <div className="cp-section">
        <span className="lead">The clock</span>
      </div>
      <div className="cp-card cp2-lab-clock">
        {c.betsLeft != null ? (
          <>
            <div className="cp2-lab-clock-n">
              {c.betsLeft > 0 ? <><b>{c.betsLeft}</b> {c.betsLeft === 1 ? 'bet' : 'bets'} left</> : <b className="cp2-err">Less than a bet left</b>}
            </div>
            <p className="cp2-lab-clock-s">
              {c.runwayMonths} months of runway, at {c.betDays} days a bet{c.measured ? ': the pace you have kept so far' : ' until you have run two'}. Runway is how many more tries you get, not how many months.
            </p>
          </>
        ) : (
          <>
            <p className="cp2-lede">Say what is in the bank and what goes out each month, and this counts how many bets the money pays for.</p>
            <button className="cp-btn sm cp2-lab-clock-do" onClick={() => actions.openSheet({ kind: 'finance' })}>Add your runway</button>
          </>
        )}
        {cp.last && !cp.due && (
          <p className="cp2-lab-readback">
            <b>Last checkpoint, {dayWords(cp.last.on)}: {decisionWords(cp.last)}.</b>{back ? ` ${back}` : ''}
          </p>
        )}
        {nextLine && <p className="cp2-lab-clock-s">{nextLine}</p>}
      </div>
    </>
  );
}
