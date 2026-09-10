'use client';
// Now: what to do, and nothing else.
//
// What this screen used to be: a metrics strip, an unmigrated-moves notice, a
// forty-row send queue, a "drafts waiting" chip, the call, seven "also today"
// rows and a "next actions" list — seven sections, in which "send 10 drafts"
// appeared three separate times and the same forty drafts were also rendered on
// the Pipeline tab with a different count.
//
// The rule now is one instruction, one place. The call leads and carries the
// work. Under it: finished work from the jobs, the one judgement cheap enough to
// make with a thumb, the queue as a single row, and everything else folded. The
// numbers moved to Working, which is the tab for asking whether any of it is
// landing.
import { useState } from 'react';
import { VERDICT_LABEL, movedBy, verdictOf, type Decision } from '@/lib/copilot/decision';
import { OFFER_TASK_TITLE, offerIsEmpty } from '@/lib/copilot/offer';
import { PLANS } from '@/lib/copilot/plans';
import { useShell } from '../shell';
import { KIND_LABEL } from '@/lib/copilot/moves';
import type { Execution, HomeData, Move, QueueItem } from '@/lib/copilot/types';
import { money } from '../format';
import TriageStack from '../TriageStack';
import type { Actions } from '../shared';

/** Anything past this is folded. A plan you can finish beats a list you cannot. */
const ALSO_FOLD = 3;

function execChip(e: Execution | null | undefined): { cls: string; label: string } | null {
  if (!e) return null;
  if (e.approval_state === 'sent') return { cls: 'sent', label: 'Sent' };
  if (e.approval_state === 'failed') return { cls: 'failed', label: 'Failed' };
  if (e.approval_state === 'cancelled') return null;
  return { cls: 'send', label: 'Ready to send' };
}

/** Oldest first — eleven days waiting is the number that makes somebody send. */
function oldestWait(queue: QueueItem[]): number {
  if (!queue.length) return 0;
  const oldest = [...queue].sort((a, b) => a.execution.created_at.localeCompare(b.execution.created_at))[0];
  return Math.max(0, Math.floor((Date.now() - new Date(oldest.execution.created_at).getTime()) / 86_400_000));
}

export default function NowView({ home, actions, briefing, finding }: { home: HomeData; actions: Actions; briefing: boolean; finding: boolean }) {
  const shell = useShell();
  const [showWhy, setShowWhy] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [moreAlso, setMoreAlso] = useState(false);
  const b = home.billing;
  const noOffer = offerIsEmpty(home.profile.offer);
  const queue = home.queue;
  // With a blank offer the call, its button and this row all say the same thing.
  // The row is the one that carries no new information, so it goes.
  const plan = home.decision && noOffer ? home.plan.filter((a) => a.title !== OFFER_TASK_TITLE) : home.plan;
  // One folded list, not two sections. "Also today" and "Next actions" were
  // different queries rendering the same kind of row, one above the other.
  const alsoToday = [...plan.filter((a) => a.status === 'open'), ...home.nudges];
  const alsoDone = plan.filter((a) => a.status === 'done');
  const visibleAlso = moreAlso ? alsoToday : alsoToday.slice(0, ALSO_FOLD);
  // The call leads, always. It used to sit below forty queue rows unless the
  // offer was blank, which put the one decision on the screen out of sight.
  const call = home.decision ? <CallCard decision={home.decision} home={home} actions={actions} noOffer={noOffer} /> : null;
  // When the queue itself won the day there is no separate queue row: that is
  // the same instruction twice, which is the whole thing this screen fixes.
  const queueIsCall = home.callMove?.job === 'send_queue';
  const waited = oldestWait(queue);
  // A brand new account. Three separate empty boxes stacked up read as a broken
  // app; one card reads as a new one.
  const nothingYet = !home.decision && !home.insight && !queue.length && !alsoToday.length && !home.moves.length;

  const submit = async (regenerate: boolean) => {
    if (!note.trim()) return;
    setSending(true);
    const saved = await actions.addNote(note.trim(), regenerate);
    if (saved) setNote('');
    setSending(false);
  };

  return (
    <>
      {(briefing || finding) && <div className="cp-banner"><span className="dot" />{finding ? 'Finding real matches' : 'Building today’s brief'}</div>}

      {call}

      {b.matches.remaining === 0 && (
        <div className="cp-card cp-wall">
          <div className="cp-eyebrow">Out of matches</div>
          <p>
            You have used all {b.matches.limit} matches on {PLANS[b.effective].name} this month. Your brief,
            drafts and funnel keep running on what you already have — only new supply stops.
          </p>
          {b.effective !== 'operator' && (
            <a className="cp-btn primary block" href={`${shell}/pricing`}>
              See plans — {PLANS[b.effective === 'free' ? 'pro' : 'operator'].limits.matchesPerMonth.toLocaleString()} a month
            </a>
          )}
          <p className="cp-wall-sub">
            Resets on the 1st.{b.effective === 'operator' && ' If you are hitting 2,000 a month, get in touch and we will size something.'}
          </p>
        </div>
      )}

      {nothingYet && <FirstRun home={home} actions={actions} finding={finding} />}

      {/* The read only appears here when there is no call to carry it. With a
          call it lives inside that card, and the full read is on Working. */}
      {home.insight && !home.decision && !nothingYet && (
        <div className="cp-card cp-insight">
          <div className="cp-eyebrow">{home.insight.eyebrow}</div>
          <p>{home.insight.body}</p>
          {home.insight.reasoning && (
            <>
              <button className="cp-go" onClick={() => setShowWhy((v) => !v)}>{showWhy ? 'Hide the reasoning' : 'See the reasoning →'}</button>
              {showWhy && <div className="cp-reasoning">{home.insight.reasoning}</div>}
            </>
          )}
        </div>
      )}

      {/* Finished work from every job. The one promoted to the call is not in
          here — loadHome takes it out, because rendering it twice is exactly the
          duplication this screen exists to remove. */}
      {home.moves.length > 0 ? (
        <>
          <div className="cp-section">
            <span className="lead">Done while you slept</span>
            <span className="count">{home.moves.length}</span>
          </div>
          {home.moves.map((m) => <MoveCard key={m.id} move={m} actions={actions} />)}
        </>
      ) : home.movesBlocked ? (
        // Silence and "not wired up" looked identical here, so a working build
        // read as a broken one. An empty day still renders nothing at all —
        // this only speaks when something is actually missing.
        <div className="cp-empty" style={{ marginBottom: 14 }}>
          {home.movesBlocked === 'migration' ? (
            <>
              <b>Moves are not switched on yet</b>
              The copilot_moves table is missing. Run the migration
              20260910_copilot_moves.sql.
            </>
          ) : (
            <>
              <b>No sensors connected</b>
              Moves are found overnight from things the copilot can see: a sale, your runway,
              what your matches keep asking for. Finish setting up and the first ones appear
              after the next run.
            </>
          )}
        </div>
      ) : null}

      {/* The triage deck, which used to be a section on a tab of its own. It is
          one judgement, answerable with a thumb, so it is one card. */}
      {home.triage.length > 0 && (
        <>
          <div className="cp-section">
            <span className="lead">Worth messaging?</span>
            <span className="count">{home.triage.length} to judge</span>
          </div>
          <TriageStack cards={home.triage} actions={actions} />
        </>
      )}

      {/* The queue, as one row. It was forty rows here and forty-two on
          Pipeline, from two different reads, and 45 of 54 drafts were never
          sent — a list of forty-five is a decision about forty-five things. */}
      {!noOffer && !queueIsCall && queue.length > 0 && (
        <div className="cp-card">
          <div className="cp-call-top">
            <div className="cp-eyebrow">To send</div>
            {waited > 0 && <span className="cp-chip">{waited}d oldest</span>}
          </div>
          <h2 className="cp-call-head">{queue.length} draft{queue.length === 1 ? '' : 's'} written and not sent</h2>
          <button className="cp-btn primary block cp-call-do" onClick={() => actions.openSheet({ kind: 'queue' })}>
            Open the queue
          </button>
        </div>
      )}

      {/* Everything else, folded. Two sections of the same kind of row became
          one, and the count says what is behind the fold rather than hiding it. */}
      {alsoToday.length > 0 && (
        <>
          <div className="cp-section">
            <span className="lead">Also today</span>
            <span className="count">{alsoToday.length + home.planOverflow}</span>
          </div>
          <div className="cp-list">
            {visibleAlso.map((a) => {
              const ec = execChip(a.execution);
              return (
                <button key={a.id} className="cp-row" onClick={() => actions.openSheet({ kind: 'action', id: a.id })}>
                  <span className={`cp-chip ${ec ? ec.cls : a.owner}`}>{ec ? ec.label : a.owner === 'ai' ? 'AI drafted' : 'Needs you'}</span>
                  <span className="txt">{a.minutes && a.owner === 'you' ? `${a.minutes} min — ` : ''}{a.title}</span>
                </button>
              );
            })}
          </div>
          {alsoToday.length > ALSO_FOLD && (
            <button className="cp-textlink cp-fold" onClick={() => setMoreAlso((v) => !v)}>
              {moreAlso ? 'Show fewer' : `Show ${alsoToday.length - ALSO_FOLD} more`}
            </button>
          )}
          {(alsoDone.length > 0 || home.planOverflow > 0) && (
            <div className="cp-note" style={{ marginTop: 8 }}>
              {alsoDone.length > 0 && `${alsoDone.length} done today. `}
              {home.planOverflow > 0 && `${home.planOverflow} more behind these.`}
            </div>
          )}
        </>
      )}

      <div className="cp-section"><span className="lead">Tell the copilot</span><span className="count">{home.contextCount} in context</span></div>
      <div className="cp-composer">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed? A win, a number, a constraint, a person, a lead that went cold…" maxLength={2000} />
        <div className="bar">
          <span className="hint">Lands in your context. Sharpens the next brief.</span>
          <button className="cp-btn" disabled={sending || !note.trim()} onClick={() => submit(false)}>Add</button>
          <button className="cp-btn primary" disabled={sending || briefing || !note.trim()} onClick={() => submit(true)}>Add &amp; re-plan</button>
        </div>
      </div>
    </>
  );
}

/**
 * One draft, two taps. The primary action opens the message in the user's own
 * WhatsApp or mail app (or sends via API when this profile owns the channel);
 * "I sent it" records that it went. Tapping the text opens the full sheet to edit.
 */
/**
 * The one call, and what it is instead of.
 *
 * This card is the difference between an app that lists five good things and
 * one that picks. It leads the screen on purpose: a decision buried under a
 * metrics strip is a suggestion, and suggestions are what a chat window is for.
 * The three buttons are the only place the app finds out whether it was right —
 * so "Wrong call" is offered as plainly as "I did it".
 */
function CallCard({ decision, home, actions, noOffer }: { decision: Decision; home: HomeData; actions: Actions; noOffer: boolean }) {
  const [busy, setBusy] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showArtifact, setShowArtifact] = useState(false);
  // Present when arbitration promoted a Move rather than the brief writing one.
  const move = home.callMove;
  const verdict = verdictOf(decision);
  const moved = movedBy(decision);
  const answered = decision.response !== 'pending';

  const answer = async (r: 'did' | 'rejected' | 'wrong') => {
    setBusy(true);
    await actions.answerCall(r);
    setBusy(false);
  };

  return (
    <>
      {decision.changed.length > 0 && (
        <div className="cp-changed" aria-label="What changed since the last brief">
          {decision.changed.map((c) => (
            <span key={c.what} className="cp-change">
              <b>{c.what}</b> {c.from} <span className="arrow">→</span> {c.to}
            </span>
          ))}
        </div>
      )}

      <div className="cp-card cp-call">
        <div className="cp-call-top">
          {/* When a Move won the day, the kind is the honest label: it is what
              stops every morning reading "Today's call — send the drafts". */}
          <div className="cp-eyebrow">{move ? `Today’s call · ${KIND_LABEL[move.kind]}` : 'Today’s call'}</div>
          {move?.cost_label
            ? <span className="cp-chip">{move.cost_label}</span>
            : decision.confidence === 'low' && <span className="cp-chip unsure">Not sure</span>}
        </div>
        <h2 className="cp-call-head">{decision.headline}</h2>

        {decision.because.length > 0 && (
          <ul className="cp-because">
            {decision.because.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}

        {decision.instead_of && (
          <div className="cp-instead"><b>Instead of</b> {decision.instead_of}</div>
        )}

        {decision.missing && (
          <div className="cp-missing"><b>What would change this</b> {decision.missing}</div>
        )}

        {/* The whole point of promoting a Move: the call arrives carrying the
            work. A Decision has no artifact of its own, which is why this used
            to be a sentence with three verdict buttons under it and nothing to
            actually do. */}
        {move && (
          <>
            {move.artifact.href
              ? <a className="cp-btn primary block cp-call-do" href={move.artifact.href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>{move.artifact.label}</a>
              : <button className="cp-btn primary block cp-call-do" onClick={() => setShowArtifact((v) => !v)}>{showArtifact ? 'Hide it' : move.artifact.label}</button>}
            {(showArtifact || move.artifact.kind === 'text') && <div className="cp-reasoning">{move.artifact.value}</div>}
          </>
        )}

        {/* The call is only a call if you can act on it here. With a blank offer
            the server guarantees this IS the offer call, so the button that used
            to sit in its own wall card below belongs on it. */}
        {noOffer && (
          <button className="cp-btn primary block cp-call-do" onClick={() => actions.openSheet({ kind: 'offer' })}>
            Set your offer — about three minutes
          </button>
        )}

        {/* One line, not a card. A `dont` that merely restates instead_of is not
            worth a second block; the starter no longer emits one at all. */}
        {decision.dont && <div className="cp-notdo"><b>Not today</b> {decision.dont.title}{decision.dont.why ? ` — ${decision.dont.why}` : ''}</div>}

        {answered ? (
          <div className="cp-verdict">
            <span className={`cp-chip verdict ${verdict}`}>{VERDICT_LABEL[verdict]}</span>
            <span className="cp-verdict-note">
              {verdict === 'measuring' && decision.verify.metric !== 'none'
                ? `Reading ${decision.verify.metric.replace('_', ' ')} back in a few days. It was ${decision.verify.baseline} when you decided.`
                : verdict === 'worked' ? `${decision.verify.metric.replace('_', ' ')} moved by ${moved}.`
                : verdict === 'no_movement' ? `${decision.verify.metric.replace('_', ' ')} did not move.`
                : verdict === 'wrong' ? 'Recorded. It will not make this call the same way again.'
                : verdict === 'rejected' ? 'Recorded.'
                : 'Recorded.'}
            </span>
          </div>
        ) : (
          <div className="cp-btn-row">
            <button className="cp-btn primary" disabled={busy} onClick={() => answer('did')}>I did it</button>
            <button className="cp-btn" disabled={busy} onClick={() => answer('rejected')}>Not doing it</button>
            <button className="cp-btn" disabled={busy} onClick={() => answer('wrong')}>Wrong call</button>
          </div>
        )}

        {home.insight && (
          <>
            <button className="cp-go" onClick={() => setShowWhy((v) => !v)}>{showWhy ? 'Hide the read' : 'See the read →'}</button>
            {showWhy && (
              <div className="cp-reasoning">
                {home.insight.body}
                {home.insight.reasoning ? `\n\n${home.insight.reasoning}` : ''}
              </div>
            )}
          </>
        )}
      </div>

    </>
  );
}

/**
 * The only thing on screen when an account has nothing yet.
 *
 * What it replaces: four zeros, "No brief yet", "Nothing pressing" and an empty
 * composer, all at once. That is a well-built shell around no data, and it is
 * what somebody seeing the product for the first time actually judges. One card
 * that says what is happening and offers the one action is the whole fix.
 */
function FirstRun({ home, actions, finding }: { home: HomeData; actions: Actions; finding: boolean }) {
  const segments = home.profile.target_segments;
  const where = home.profile.target_area || home.profile.location;
  const what = segments.slice(0, 3).join(', ');

  if (!segments.length || !where) {
    return (
      <div className="cp-card">
        <div className="cp-eyebrow">Nothing here yet</div>
        <p>Say which kinds of business you want, and where. The copilot goes and finds real ones, then drafts an opener for each.</p>
        <button className="cp-btn primary block cp-call-do" onClick={() => actions.openSheet({ kind: 'targeting' })}>Choose who to look for</button>
      </div>
    );
  }

  if (finding) {
    return (
      <div className="cp-card">
        <div className="cp-eyebrow">Finding businesses</div>
        <p>Looking for {what} in {where}. The first run takes a minute — real listings, not a sample.</p>
      </div>
    );
  }

  // Found businesses but no brief. A supply run that hits its budget returns
  // the matches and skips the brief on purpose, so this state is normal and
  // saying "nothing found" here would be a lie about work the user just paid
  // scraping credits for.
  const found = home.metrics.pipeline.sourced;
  if (found > 0) {
    return (
      <div className="cp-card">
        <div className="cp-eyebrow">{found} found</div>
        <p>{found} business{found === 1 ? '' : 'es'} matched in {where}. Nothing is drafted yet — the copilot writes the openers.</p>
        <button className="cp-btn primary block cp-call-do" onClick={() => void actions.runBrief('manual')}>Draft the openers</button>
      </div>
    );
  }

  return (
    <div className="cp-card">
      <div className="cp-eyebrow">Nothing here yet</div>
      <p>No businesses found yet for {what} in {where}.</p>
      <button className="cp-btn primary block cp-call-do" onClick={() => void actions.findMatches()}>Find businesses now</button>
    </div>
  );
}

/**
 * One finished thing, with the thing attached.
 *
 * The artifact button is the whole point: a row that says "you should contact
 * them" is advice, and advice is what a chat window already gives away. A row
 * carrying the drafted message, opened in the user's own mail app, is work that
 * was done while they slept.
 */
function MoveCard({ move, actions }: { move: Move; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);
  const a = move.artifact;
  const answer = async (status: 'done' | 'dismissed') => {
    setBusy(true);
    try { await actions.answerMove(move.id, status); } finally { setBusy(false); }
  };

  return (
    <div className="cp-card">
      <div className="cp-call-top">
        <div className="cp-eyebrow">{KIND_LABEL[move.kind]}</div>
        {move.cost_label && <span className="cp-chip">{move.cost_label}</span>}
      </div>
      <h2 className="cp-call-head">{move.headline}</h2>

      {move.why.length > 0 && (
        <ul className="cp-because">{move.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
      )}

      {a.href
        ? <a className="cp-btn primary block cp-call-do" href={a.href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>{a.label}</a>
        : <button className="cp-btn primary block cp-call-do" onClick={() => setShown((v) => !v)}>{shown ? 'Hide it' : a.label}</button>}

      {/* A message with nowhere to open still has to be readable, or the work
          is done and unreachable. */}
      {(shown || a.kind === 'text') && <div className="cp-reasoning">{a.value}</div>}

      <div className="cp-btn-row">
        <button className="cp-btn" disabled={busy} onClick={() => answer('done')}>Did it</button>
        <button className="cp-btn" disabled={busy} onClick={() => answer('dismissed')}>Not this one</button>
      </div>
    </div>
  );
}

function QueueRow({ q, home, actions }: { q: QueueItem; home: HomeData; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  const e = q.execution;
  // The business is the identity; the contact's first name is detail. Two rows
  // both headed "Maria" told the user nothing.
  const who = q.opp?.title || q.title.replace(/^Opener to /, '').replace(/, ready to review$/, '');
  const apiSend = home.channels[e.channel];
  const label = e.channel === 'whatsapp' ? 'WhatsApp' : 'Email';
  const sub = [
    q.opp?.name, q.opp?.segment,
    e.approval_state === 'failed' ? 'send failed — retry' : q.title.startsWith('Follow-up') ? 'follow-up' : null,
  ].filter(Boolean).join(' · ') || label;
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return (
    <div className={`cp-qrow ${e.approval_state === 'failed' ? 'failed' : ''}`}>
      <button className="cp-qwho" onClick={() => actions.openSheet({ kind: 'action', id: q.id })}>
        <span className="name">{who}</span>
        <span className="sub">{sub}</span>
      </button>
      <div className="cp-qacts">
        {apiSend
          ? <button className="cp-btn primary sm" disabled={busy} onClick={() => act(() => actions.sendAction(q.id))}>{busy ? '…' : 'Send'}</button>
          : <a className="cp-btn primary sm" href={e.deep_link ?? '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }} title={`Open in ${label}`}>{label}</a>}
        <button className="cp-btn sm" disabled={busy} onClick={() => act(() => actions.markSent(q.id))}>I sent it</button>
      </div>
    </div>
  );
}
