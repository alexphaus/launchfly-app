'use client';
// Today is a send queue. Everything else on this screen exists to get a message
// out of the door or to record what came back.
import { useState } from 'react';
import { VERDICT_LABEL, movedBy, verdictOf, type Decision } from '@/lib/copilot/decision';
import { OFFER_TASK_TITLE, offerIsEmpty } from '@/lib/copilot/offer';
import { PLANS } from '@/lib/copilot/plans';
import { useShell } from '../shell';
import type { Execution, HomeData, QueueItem } from '@/lib/copilot/types';
import { money } from '../format';
import type { Actions } from '../shared';

/** How many queue rows show before the fold. A queue is a queue; it is not capped, only folded. */
const QUEUE_FOLD = 5;
/** Six reminders under a decision is a list, not a next action. */
const NUDGE_FOLD = 3;

function execChip(e: Execution | null | undefined): { cls: string; label: string } | null {
  if (!e) return null;
  if (e.approval_state === 'sent') return { cls: 'sent', label: 'Sent' };
  if (e.approval_state === 'failed') return { cls: 'failed', label: 'Failed' };
  if (e.approval_state === 'cancelled') return null;
  return { cls: 'send', label: 'Ready to send' };
}

export default function TodayView({ home, actions, briefing, finding }: { home: HomeData; actions: Actions; briefing: boolean; finding: boolean }) {
  const shell = useShell();
  const [showWhy, setShowWhy] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [unfold, setUnfold] = useState(false);
  const [moreNudges, setMoreNudges] = useState(false);
  const urgent = home.nudges.filter((n) => n.urgency === 'urgent').length;
  const m = home.metrics;
  const b = home.billing;
  const currency = home.goals.find((g) => g.metric === 'currency')?.unit || '$';
  const noOffer = offerIsEmpty(home.profile.offer);
  const queue = home.queue;
  // With a blank offer the call, its button and this row all say the same thing.
  // The row is the one that carries no new information, so it goes.
  const plan = home.decision && noOffer ? home.plan.filter((a) => a.title !== OFFER_TASK_TITLE) : home.plan;
  const visible = unfold ? queue : queue.slice(0, QUEUE_FOLD);
  // Rendered in one of two slots, never both.
  const call = home.decision ? <CallCard decision={home.decision} home={home} actions={actions} noOffer={noOffer} /> : null;
  const callFirst = noOffer;
  // A brand new account. Three separate empty boxes stacked up read as a broken
  // app; one card reads as a new one.
  const nothingYet = !home.decision && !home.insight && !queue.length && !plan.length && !home.nudges.length;

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

      {/* With a blank offer nothing can be drafted, so the call IS the screen
          and leads. Otherwise the queue leads: the drafts are the only thing on
          this page anyone can act on, and they used to start below the fold
          behind a decision card and four metrics. */}
      {callFirst && call}

      {/* Sent is the hero. The app has a supply surplus and a sending deficit, and
          the headline number should be on the side that needs to move. */}
      <div className="cp-metrics" aria-label="Your numbers">
        <div className={`cp-stat hero ${m.sent ? 'hot' : ''}`}><div className="v">{m.sent}</div><div className="l">Sent</div></div>
        <div className="cp-stat"><div className="v">{queue.length}</div><div className="l">To send</div></div>
        <div className={`cp-stat ${m.replies ? 'hot' : ''}`}><div className="v">{m.replies}</div><div className="l">Replies</div></div>
        <div className={`cp-stat ${m.won ? 'hot' : ''}`}><div className="v">{m.won_amount ? money(m.won_amount, currency) : m.won}</div><div className="l">Won</div></div>
      </div>
      <div className="cp-metrics-note">Last {m.window_days} days · real numbers from what you actually sent</div>

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

      {noOffer || nothingYet ? null : (
        <>
          <div className="cp-section">
            <span className="lead">To send</span>
            <span className="count">{queue.length ? `${queue.length} waiting` : 'clear'}</span>
          </div>
          {queue.length ? (
            <>
              <div className="cp-list">
                {visible.map((q) => <QueueRow key={q.id} q={q} home={home} actions={actions} />)}
              </div>
              {queue.length > QUEUE_FOLD && (
                <button className="cp-textlink cp-fold" onClick={() => setUnfold((v) => !v)}>
                  {unfold ? 'Show fewer' : `Show ${queue.length - QUEUE_FOLD} more`}
                </button>
              )}
            </>
          ) : (
            <div className="cp-empty"><b>Queue is clear.</b>Every match with a contact has been messaged. Find new ones on Pipeline, or log what came back.</div>
          )}
        </>
      )}

      {/* The read is the reasoning behind the call, so when there is a call it
          lives inside that card. Two AI-written paragraphs stacked at the top of
          Today was the single heaviest thing on this screen. */}
      {home.insight && !home.decision ? (
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
      ) : !home.insight && !home.decision && !nothingYet ? (
        <div className="cp-empty" style={{ marginTop: 14 }}>
          <b>No brief yet</b>
          The copilot writes one read of your day, every day. {briefing ? 'Building it now.' : <button className="cp-textlink" onClick={() => actions.runBrief('manual')}>Build it now</button>}
        </div>
      ) : null}

      {!callFirst && call}

      {(plan.length > 0 || home.planOverflow > 0) && (
        <>
          <div className="cp-section">
            <span className="lead">Also today</span>
            {home.planOverflow > 0 && <span className="count">{plan.filter((a) => a.status === 'open').length} of {plan.filter((a) => a.status === 'open').length + home.planOverflow}</span>}
          </div>
          <div className="cp-list">
            {plan.map((a) => {
              const ec = a.status !== 'done' ? execChip(a.execution) : null;
              return (
                <button key={a.id} className={`cp-row ${a.status === 'done' ? 'done' : ''}`} onClick={() => actions.openSheet({ kind: 'action', id: a.id })}>
                  <span className={`cp-chip ${a.status === 'done' ? 'done' : ec ? ec.cls : a.owner}`}>{a.status === 'done' ? 'Done' : ec ? ec.label : a.owner === 'ai' ? 'AI drafted' : 'Needs you'}</span>
                  <span className="txt">{a.minutes && a.owner === 'you' && a.status !== 'done' ? `${a.minutes} min — ` : ''}{a.title}</span>
                </button>
              );
            })}
          </div>
          {home.planOverflow > 0 && (
            <div className="cp-note" style={{ marginTop: 8 }}>
              {home.planOverflow} more behind these. A plan you can finish beats a list you cannot.
            </div>
          )}
        </>
      )}

      {nothingYet ? null : (
        <>
      <div className="cp-section"><span className="lead">Next actions</span>{urgent > 0 && <span className="count">{urgent} urgent</span>}</div>
      {home.nudges.length ? (
        <>
        <div className="cp-list">
          {(moreNudges ? home.nudges : home.nudges.slice(0, NUDGE_FOLD)).map((n) => (
            <button key={n.id} className={`cp-nrow ${n.urgency}`} onClick={() => actions.openSheet({ kind: 'action', id: n.id })}>
              <div className="cp-ndot" />
              <div><div className="t">{n.title}</div>{n.due_label && <div className="s">{n.due_label}</div>}</div>
            </button>
          ))}
        </div>
        {home.nudges.length > NUDGE_FOLD && (
          <button className="cp-textlink cp-fold" onClick={() => setMoreNudges((v) => !v)}>
            {moreNudges ? 'Show fewer' : `Show ${home.nudges.length - NUDGE_FOLD} more`}
          </button>
        )}
        </>
      ) : (
        <div className="cp-empty"><b>Nothing pressing</b>Nudges show up here when something is about to go cold or needs a decision.</div>
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
          <div className="cp-eyebrow">Today’s call</div>
          {decision.confidence === 'low' && <span className="cp-chip unsure">Not sure</span>}
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

  return (
    <div className="cp-card">
      <div className="cp-eyebrow">{finding ? 'Finding businesses' : 'Nothing here yet'}</div>
      <p>
        {finding
          ? `Looking for ${what} in ${where}. The first run takes a minute — real listings, not a sample.`
          : `No businesses found yet for ${what} in ${where}.`}
      </p>
      {!finding && (
        <button className="cp-btn primary block cp-call-do" onClick={() => void actions.findMatches()}>Find businesses now</button>
      )}
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
