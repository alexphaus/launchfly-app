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
// work. The numbers moved to Working, which is the tab for asking whether any
// of it is landing.
//
// THREE ZONES, and the axis is the point.
//
//   1. The call            one decision, alone, no header above it
//   2. Also needs you      capture, jobs waiting on you, the deck, the queue,
//                          and the one input the scrapers cannot supply
//   3. Since you last      running jobs, finished Moves, what is in motion
//      looked
//
// Before this the screen was grouped by FEATURE — handed-over jobs in one
// section, Moves in another, the queue somewhere below, the composer near the
// top — and the reader's attention bounced between "do something" and "here is
// what happened" four times on the way down. A job in particular was in
// whichever block its feature owned regardless of whether it was waiting on an
// answer or quietly making progress, which are opposite things to a person
// holding a phone at nine in the morning.
//
// The call stays outside zone two deliberately. It is one decision, and putting
// a header above it that announces three things need you is the dilution the
// whole single-call design exists to prevent.
//
// Finished jobs are not here at all. They live on Working, beside the decision
// record, because a finished job with an outcome IS a graded call and "did that
// work" is the question that tab asks.
import { useEffect, useState } from 'react';
import { VERDICT_LABEL, movedBy, verdictOf, type Decision } from '@/lib/copilot/decision';
import { OFFER_TASK_TITLE, offerIsEmpty } from '@/lib/copilot/offer';
import { PLANS } from '@/lib/copilot/plans';
import { useShell } from '../shell';
import { KIND_LABEL } from '@/lib/copilot/moves';
import { splitThreads } from '@/lib/copilot/commission';
import type { Execution, HomeData, Move, QueueItem } from '@/lib/copilot/types';
import { money, relTime } from '../format';
import TriageStack from '../TriageStack';
import JobList from '../CommissionThread';
import type { Actions } from '../shared';

/** Anything past this is folded. A plan you can finish beats a list you cannot. */

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
  // Relative times differ between server and client render; wait for mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [showWhy, setShowWhy] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [tellOpen, setTellOpen] = useState(false);
  const b = home.billing;
  const noOffer = offerIsEmpty(home.profile.offer);
  const queue = home.queue;
  // With a blank offer the call, its button and this row all say the same thing.
  // The row is the one that carries no new information, so it goes.
  const plan = home.decision && noOffer ? home.plan.filter((a) => a.title !== OFFER_TASK_TITLE) : home.plan;
  // The call leads, always. It used to sit below forty queue rows unless the
  // offer was blank, which put the one decision on the screen out of sight.
  const call = home.decision ? <CallCard decision={home.decision} home={home} actions={actions} noOffer={noOffer} /> : null;
  // When the queue itself won the day there is no separate queue row: that is
  // the same instruction twice, which is the whole thing this screen fixes.
  const queueIsCall = home.callMove?.job === 'send_queue';
  const waited = oldestWait(queue);
  // 36 hours: long enough that one missed night is not an alarm, short enough
  // that a scheduled task which never fires cannot hide.
  const nightlyStale = !home.lastCronRun || Date.now() - new Date(home.lastCronRun).getTime() > 36 * 3_600_000;
  // A brand new account. Three separate empty boxes stacked up read as a broken
  // app; one card reads as a new one.
  const nothingYet = !home.decision && !home.insight && !queue.length && !home.motion.length && !home.moves.length;

  // The screen's whole organising idea, in one line. Now used to be grouped by
  // FEATURE — jobs in one section, Moves in another, the queue somewhere below
  // — while the question a person actually has when they open it is temporal:
  // what needs me, and what happened while I was away. So it alternated between
  // asking and reporting four times going down the page, and a handed-over job
  // sat in whichever block its feature owned regardless of which of the two it
  // was. Three zones now: the call, what else needs you, what happened.
  const jobs = splitThreads(home.commissions ?? []);
  // Everything in zone two that is genuinely an ask, so the header can say how
  // many rather than making somebody scroll to find out.
  const asks = (home.capture ? 1 : 0) + jobs.needsYou.length + (home.triage.length ? 1 : 0)
    + (!noOffer && !queueIsCall && queue.length > 0 ? 1 : 0);
  const reports = jobs.running.length + home.moves.length + home.motion.length;

  const submit = async (regenerate: boolean) => {
    if (!note.trim()) return;
    setSending(true);
    const saved = await actions.addNote(note.trim(), regenerate);
    if (saved) { setNote(''); setTellOpen(false); }
    setSending(false);
  };

  return (
    <>
      {(briefing || finding) && <div className="cp-banner"><span className="dot" />{finding ? 'Finding real matches' : 'Building today’s brief'}</div>}

      {/* With no nightly run there are no overnight Moves, no push and no graded
          decisions — every morning is identical because you are the one
          computing it by opening the app. A scheduled task nobody set up looks
          exactly like a quiet week, so it is said out loud. */}
      {nightlyStale && (
        <div className="cp-empty" style={{ marginBottom: 14 }}>
          <b>Nothing is running overnight</b>
          {home.lastCronRun
            ? `The nightly job last finished ${mounted ? relTime(home.lastCronRun) : '…'}. Until it runs again, this screen only changes when you open it.`
            : 'The nightly job has never run, so nothing is found while you are away and no morning nudge is sent. Everything here was computed the moment you opened the app.'}
        </div>
      )}

      {call}

      {/* ── Zone two: everything else that is waiting on a person ──────────
          The call stands alone above this on purpose. It is one decision, and
          wrapping it in a header announcing that three things need you is
          exactly the dilution the single-call design exists to prevent. */}
      {!nothingYet && asks > 0 && (
        <div className="cp-section">
          <span className="lead">Also needs you</span>
          <span className="count">{asks}</span>
        </div>
      )}

      {/* What the app saw and was never told the end of.
          Placed directly under the call because it is the only thing on this
          screen that repairs a number rather than spending one: `sent` is
          upstream of the reply rate, the funnel, verdictOf and the whole starter
          ladder, and it was collected by hoping somebody came back and pressed a
          tertiary button. One gesture for N messages, not N round trips. */}
      {home.capture && (
        <div className="cp-card cp-capture">
          <div className="cp-eyebrow">Confirm</div>
          <h2 className="cp-call-head">{home.capture.headline}</h2>
          <p className="cp-stack-reason">{home.capture.because}</p>
          {home.capture.kind === 'opened' ? (
            <>
              <div className="cp-capture-list">
                {home.opened.map((o) => <div key={o.id} className="cp-capture-row">{o.who}<span>{relTime(o.openedAt)}</span></div>)}
              </div>
              <div className="cp-btn-row">
                <button className="cp-btn primary" onClick={() => void actions.confirmOpened(home.opened.map((o) => o.id), true)}>
                  {home.opened.length === 1 ? 'It went' : 'They all went'}
                </button>
                <button className="cp-btn" onClick={() => void actions.confirmOpened(home.opened.map((o) => o.id), false)}>
                  Not yet
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="cp-capture-list">
                {home.unresolved.map((r) => (
                  <button key={r.opportunityId} className="cp-capture-row tap" onClick={() => actions.openSheet({ kind: 'won', oppId: r.opportunityId })}>
                    {r.who}<span>replied {relTime(r.repliedAt)}</span>
                  </button>
                ))}
              </div>
              <div className="cp-note" style={{ margin: '8px 0 0' }}>Tap one to record where it got to. Won, lost, or still talking.</div>
            </>
          )}
        </div>
      )}

      {/* A job waiting on an answer, a fix, or your approval. It used to sit
          with the running ones under "Working on", which put a question you had
          to answer in the same block as a report you only had to read. */}
      {!nothingYet && <JobList threads={jobs.needsYou} actions={actions} />}

      {/* The triage deck, which used to be a section on a tab of its own. It is
          one judgement, answerable with a thumb, so it is one card. TriageStack
          carries its own section header and returns null when empty — adding a
          second header here rendered "Worth messaging? · 20 to judge" twice, one
          directly above the other. */}
      <TriageStack cards={home.triage} held={home.triageHeld} actions={actions} />

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
          <QueueClear home={home} actions={actions} />
        </div>
      )}

      {tellOpen ? (
        <div className="cp-composer">
          <textarea
            autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000}
            placeholder="Maria replied. Burn is down to 200. Three people asked about the same thing. I have an interview Thursday…"
          />
          <div className="bar">
            <span className="hint">Changes tomorrow&rsquo;s call.</span>
            <button className="cp-btn" disabled={sending} onClick={() => { setTellOpen(false); setNote(''); }}>Cancel</button>
            <button className="cp-btn primary" disabled={sending || briefing || !note.trim()} onClick={() => submit(true)}>Add &amp; re-plan</button>
          </div>
        </div>
      ) : (
        <button className="cp-tell" onClick={() => setTellOpen(true)}>
          <span className="t">Tell the copilot what changed</span>
          <span className="s">{home.contextCount} in context · changes tomorrow&rsquo;s call</span>
        </button>
      )}

      {/* ── Zone three: what happened while you were not here ──────────────
          Nothing in here is an ask. The header stays even when the zone is
          empty, because "nothing came back" is itself the report — the same
          reason the Moves block says so out loud rather than rendering
          nothing. It also carries the way in to handing work over, which for
          months existed only four taps inside a saved goal. */}
      {!nothingYet && (
        <div className="cp-section">
          <span className="lead">Since you last looked</span>
          <button className="cp-connect" onClick={() => actions.openSheet({ kind: 'handover' })}>
            Hand something over
          </button>
        </div>
      )}

      {!nothingYet && <JobList threads={jobs.running} actions={actions} />}

      {/* Said once, to somebody who has never done it. A person with finished
          jobs behind them does not need telling what this is. */}
      {!nothingYet && !jobs.needsYou.length && !jobs.running.length && !jobs.finished.length && (
        <p className="cp-help" style={{ marginTop: -4 }}>
          Nothing handed over. Give it something you would otherwise do yourself — research, a
          comparison, a shortlist — and read what comes back.
        </p>
      )}

      {/* Finished work from every job. The one promoted to the call is not in
          here — loadHome takes it out, because rendering it twice is exactly the
          duplication this screen exists to remove. */}
      {home.moves.length > 0 ? (
        <>
          {/* No header of its own any more. "Done while you slept" and "Since
              you last looked" are the same sentence, and rendering both at the
              same weight made the zone header read as a third peer section
              rather than as the thing containing them. */}
          {home.moves.map((m) => <MoveCard key={m.id} move={m} actions={actions} />)}
        </>
      ) : home.movesBlocked ? (
        // Silence and "not wired up" looked identical here, so a working build
        // read as a broken one. An empty day still renders nothing at all —
        // this only speaks when something is actually missing.
        <div className="cp-empty" style={{ marginBottom: 14 }}>
          {home.movesBlocked === 'quiet' && home.jobsRun?.broke?.length ? (
            // A sensor that BROKE is not a quiet night, and saying "nothing new"
            // over a worker the app could not reach is the screen reporting
            // calm about a thing that is on fire.
            <>
              <b>{home.jobsRun.broke.length === 1 ? 'A sensor failed last night' : `${home.jobsRun.broke.length} sensors failed last night`}</b>
              {home.jobsRun.broke.join(' · ')}
            </>
          ) : home.movesBlocked === 'quiet' ? (
            <>
              <b>Nothing new last night</b>
              {home.jobsRun
                ? `${home.jobsRun.ran} sensor${home.jobsRun.ran === 1 ? '' : 's'} looked${home.jobsRun.produced > home.jobsRun.written ? `, and what they found you have already answered` : ''}. ${home.watchSources.length ? 'Your sources are the part that brings in something from outside — a quiet one is worth replacing.' : 'Nothing is being watched yet, so nothing can arrive from outside.'}`
                : 'The sensors looked and found nothing new.'}
            </>
          ) : home.movesBlocked === 'migration' ? (
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

      {/* What is already running. Every other section on this screen is an ask —
          the call, the composer, the moves, the deck, the queue — and none of
          them answered the question a person actually has at nine at night.

          It replaces "Also today", which rendered the model's plan and nudges:
          asked for in the same response that wrote the call, over the same
          context, so it restated it by construction. The live screen carried four
          rows of "approve and send N drafts" above a queue card saying it a fifth
          time, with the numbers disagreeing. Nothing here is written by a model. */}
      {home.motion.length > 0 && (
        <>
          {/* Subordinate: it is a group INSIDE "since you last looked", not a
              peer of it. At the same weight three identical headers stacked up
              and the zone stopped reading as a zone. */}
          <div className="cp-section sub">
            <span className="lead">In motion</span>
            <span className="count">nothing to do here</span>
          </div>
          <div className="cp-list">
            {home.motion.map((m) => (
              <div key={m.kind} className="cp-motion">
                <span className={`cp-motion-dot ${m.kind}`} />
                <div>
                  <div className="l">{m.label}</div>
                  <div className="s">{m.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

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

      {nothingYet && <FirstRun home={home} actions={actions} finding={finding} />}

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
    </>
  );
}

/**
 * "I am not sending these."
 *
 * A queue you have decided against is not a backlog, it is a dead asset that
 * holds the top of the screen: it feeds awaiting_approval, awaiting_approval
 * feeds the send_queue stake, and the Call proposes sending them every morning
 * for as long as the rows exist. cancelOpenDrafts has been in the codebase
 * since the offer-change path and had no user-facing caller, so there was no
 * way to say so — the only exit was to keep ignoring the same card.
 *
 * Two taps, because sixty-one drafts is not an undo. Nothing is deleted: they
 * move to `cancelled` with a reason, so "written and never sent" stays in the
 * funnel, which is the most informative number this account has produced.
 */
function QueueClear({ home, actions }: { home: HomeData; actions: Actions }) {
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = home.queueTotal || home.queue.length;
  // Drafts whose action row has gone: counted by the metric, absent from the
  // queue, unsendable. Said here because this is the one moment the number
  // changes what somebody decides — they are about to be cleared too.
  const unreachable = Math.max(0, total - home.queue.length);

  if (!arming) {
    return (
      <button className="cp-go" style={{ marginTop: 10 }} onClick={() => setArming(true)}>
        I am not sending these
      </button>
    );
  }
  return (
    <>
      <p className="cp-help" style={{ marginTop: 10 }}>
        Clears {total} draft{total === 1 ? '' : 's'}
        {unreachable > 0 && `, ${unreachable} of which the app can no longer open`}. They are
        kept as written and not sent, so the funnel still counts them — and the call stops
        asking you to send them.
      </p>
      <div className="cp-btn-row">
        <button className="cp-btn" disabled={busy} onClick={async () => {
          setBusy(true); await actions.clearQueue(); setBusy(false); setArming(false);
        }}>{busy ? 'Clearing…' : `Clear all ${total}`}</button>
        <button className="cp-btn ghost" disabled={busy} onClick={() => setArming(false)}>Keep them</button>
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
  // "Not doing it" opens a choice rather than firing. A plain refusal expires
  // after REFUSAL_WINDOW decisions — right for "not today", wrong for somebody
  // who has concluded this kind of work is not their leverage any more and
  // watched the app ask again a fortnight later.
  const [refusing, setRefusing] = useState(false);
  // Present when arbitration promoted a Move rather than the brief writing one.
  const move = home.callMove;
  const verdict = verdictOf(decision);
  const moved = movedBy(decision);
  const answered = decision.response !== 'pending';

  // Once it is answered it is a receipt, not a decision. Leaving the full card
  // at the top meant "Not doing it" left you looking at the thing you had just
  // declined, with the next move below the fold.
  if (answered) {
    return (
      <div className="cp-card cp-answered">
        <div className="cp-call-top">
          <div className="cp-eyebrow">Today&rsquo;s call</div>
          <span className={`cp-chip verdict ${verdict}`}>{VERDICT_LABEL[verdict]}</span>
        </div>
        <p className="cp-answered-head">{decision.headline}</p>
        <p className="cp-answered-note">
          {verdict === 'measuring' && decision.verify.metric !== 'none'
            ? `Reading ${decision.verify.metric.replace('_', ' ')} back in a few days. It was ${decision.verify.baseline} when you decided.`
            : verdict === 'worked' ? `${decision.verify.metric.replace('_', ' ')} moved by ${moved}.`
            : verdict === 'no_movement' ? `${decision.verify.metric.replace('_', ' ')} did not move.`
            : verdict === 'wrong' ? 'Recorded. It will not make this call the same way again.'
            : 'Recorded. Turn the same call down enough times and it stops being offered.'}
        </p>
      </div>
    );
  }

  const answer = async (r: 'did' | 'rejected' | 'wrong', permanent?: boolean) => {
    setBusy(true);
    await actions.answerCall(r, permanent);
    setBusy(false);
    setRefusing(false);
  };

  return (
    <>
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
        {move && (move.artifact.kind === 'text'
          ? <div className="cp-reasoning" style={{ marginTop: 4 }}>{move.artifact.value}</div>
          : move.artifact.href
          ? <a className="cp-btn primary block cp-call-do" href={move.artifact.href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>{move.artifact.label}</a>
          : <>
              <button className="cp-btn primary block cp-call-do" onClick={() => setShowArtifact((v) => !v)}>{showArtifact ? 'Hide it' : move.artifact.label}</button>
              {showArtifact && <div className="cp-reasoning">{move.artifact.value}</div>}
            </>)}

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
          refusing ? (
            <>
              <div className="cp-btn-row">
                <button className="cp-btn" disabled={busy} onClick={() => answer('rejected')}>Just not today</button>
                <button className="cp-btn" disabled={busy} onClick={() => answer('rejected', true)}>Stop suggesting this</button>
              </div>
              <p className="cp-help">
                {/* Says what actually happens, because one of these is permanent
                    and the other is not, and "no" has meant only the second one
                    for the whole life of this product. */}
                &ldquo;Not today&rdquo; fades after a week or so. &ldquo;Stop suggesting this&rdquo; is kept in your
                working file under what you will not do — remove it there to undo.
                {' '}<button className="cp-go" onClick={() => setRefusing(false)}>Back</button>
              </p>
            </>
          ) : (
            <div className="cp-btn-row">
              <button className="cp-btn primary" disabled={busy} onClick={() => answer('did')}>I did it</button>
              <button className="cp-btn" disabled={busy} onClick={() => setRefusing(true)}>Not doing it</button>
              <button className="cp-btn" disabled={busy} onClick={() => answer('wrong')}>Wrong call</button>
            </div>
          )
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

      {/* A `text` artifact IS the content — a finding with nowhere to go — so it
          is always on screen and needs no button. Giving it one produced a
          control that toggled nothing and then read "Hide it" while the text
          stayed exactly where it was. */}
      {a.kind === 'text'
        ? <div className="cp-reasoning" style={{ marginTop: 4 }}>{a.value}</div>
        : a.href
        ? <a className="cp-btn primary block cp-call-do" href={a.href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>{a.label}</a>
        : <>
            <button className="cp-btn primary block cp-call-do" onClick={() => setShown((v) => !v)}>{shown ? 'Hide it' : a.label}</button>
            {/* A message with nowhere to open still has to be readable, or the
                work is done and unreachable. */}
            {shown && <div className="cp-reasoning">{a.value}</div>}
          </>}

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
          : <a className="cp-btn primary sm" href={e.deep_link ?? '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }} title={`Open in ${label}`} onClick={() => actions.markOpened(q.id)}>{label}</a>}
        <button className="cp-btn sm" disabled={busy} onClick={() => act(() => actions.markSent(q.id))}>I sent it</button>
      </div>
    </div>
  );
}
