'use client';
import { useEffect, useRef, useState } from 'react';
import { computeRunwayMonths } from '@/lib/copilot/metrics';
import { OFFER_TASK_TITLE, addOpeningToOffer, offerIsEmpty } from '@/lib/copilot/offer';
import { CAPACITY_META, type Action, type Capacity, type Execution, type Goal, type GoalMetric, type HomeData, type Offer, type Opportunity } from '@/lib/copilot/types';
import { OUTCOME_LABEL, TYPE_LABEL, maskPhone, money, relTime, sourceLabel } from './format';
import type { Actions, SheetState } from './shared';
import { STAGE_LABEL, type PipelineStage } from '@/lib/copilot/pipeline';
import { WATCH_INTENTS, startersFor, type WatchIntent } from '@/lib/copilot/watch/catalogue';
import { pruneSuggestions, yieldLine } from '@/lib/copilot/watch/yield';
import type { Discovered } from '@/lib/copilot/watch/discover';
import { BODY_MAX, SECTION, SECTIONS, type WorkingSection } from '@/lib/copilot/working';
import { AUTHORITIES, AUTHORITY, blockedOn, type Authority } from '@/lib/copilot/commission';
import { WORTH, WORTH_KINDS, WORTH_NOTE_MAX, type WorthKind } from '@/lib/copilot/worth';
import type { AskAnswer } from '@/lib/copilot/ask';
import { TREND_LABEL } from './views/WorkingView';
import YouView from './views/YouView';
import { CaptureCard, MoveCard } from './views/NowView';
import { FOCUS_NOTE_MAX, FOCUS_PRESETS, dayLetter, focusWeek, hoursLabel } from '@/lib/copilot/focus';
import { whenLabel } from '@/lib/copilot/review';
import { isSearchableSegment, placeOf, ratingOf } from '@/lib/copilot/matches';
import { useShell } from './shell';
import HuntsSheet from './v2/HuntsSheet';

export default function SheetContent({ sheet, home, actions, briefing = false }: { sheet: SheetState; home: HomeData; actions: Actions; briefing?: boolean }) {
  switch (sheet.kind) {
    case 'you': return <div className="cp-sheet-embed"><YouView home={home} actions={actions} briefing={briefing} /></div>;
    case 'opening': return <OpeningSheet home={home} term={sheet.term} actions={actions} />;
    case 'queue': return <QueueSheet home={home} actions={actions} />;
    case 'stage': return <StageSheet home={home} stage={sheet.stage} actions={actions} />;
    case 'capacity': return <CapacitySheet current={home.profile.capacity} onPick={actions.setCapacity} />;
    case 'action': return <ActionSheet home={home} id={sheet.id} actions={actions} />;
    case 'opp': return <OppSheet home={home} id={sheet.id} actions={actions} />;
    case 'goal': return <GoalSheet goal={home.goals.find((g) => g.id === sheet.id)} actions={actions} />;
    case 'reset': return <ResetSheet actions={actions} />;
    case 'finance': return <FinanceSheet home={home} actions={actions} />;
    case 'targeting': return <TargetingSheet home={home} actions={actions} />;
    case 'account': return <AccountSheet home={home} actions={actions} />;
    case 'won': return <WonSheet home={home} oppId={sheet.oppId} actions={actions} />;
    case 'offer': return <OfferSheet home={home} actions={actions} />;
    case 'watchlist': return <WatchlistSheet home={home} actions={actions} />;
    case 'money': return <MoneySheet home={home} actions={actions} />;
    case 'commission': return <CommissionSheet home={home} id={sheet.id} actions={actions} />;
    case 'handover': return <HandoverSheet home={home} actions={actions} />;
    case 'working': return <WorkingSheet home={home} actions={actions} />;
    case 'ask': return <AskSheet actions={actions} />;
    case 'move': return <MoveSheet home={home} id={sheet.id} actions={actions} />;
    case 'capture': return <CaptureSheet home={home} actions={actions} />;
    case 'focus': return <FocusSheet home={home} actions={actions} />;
    case 'hunts': return <HuntsSheet home={home} actions={actions} />;
  }
}

/* ─── The four-tab shell's sheets ─────────────────────────────────────────── */

/**
 * One Move, whole. /copilot2 lists Moves as rows, and a row cannot carry the
 * artifact — which is the entire difference between a Move and advice — so the
 * row opens this. Snapshotted, like every sheet here, so answering it does not
 * blank the sheet while it slides away.
 */
function MoveSheet({ home, id, actions }: { home: HomeData; id: string; actions: Actions }) {
  const found = home.moves.find((m) => m.id === id) ?? (home.callMove?.id === id ? home.callMove : undefined);
  const snap = useRef(found);
  if (found) snap.current = found;
  const m = snap.current;
  if (!m) return <p className="desc">Already answered.</p>;
  return <div className="cp-sheet-embed"><MoveCard move={m} actions={actions} onAnswered={actions.closeSheet} /></div>;
}

/** The confirm card, opened from a Needs-you row. */
function CaptureSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  if (!home.capture) {
    return (
      <>
        <h3>Nothing to confirm</h3>
        <p className="desc">Every message it saw you open, and every reply it saw come in, has an ending on record.</p>
        <div className="cp-btn-row"><button className="cp-btn" onClick={actions.closeSheet}>Back</button></div>
      </>
    );
  }
  return <div className="cp-sheet-embed"><CaptureCard home={home} actions={actions} onDone={actions.closeSheet} /></div>;
}

/**
 * Deep work: log a block, and see the week. The seven columns are both the
 * chart and the day picker — tapping a day selects it to read and to log for,
 * which is one control instead of a chart beside a date field. The list under
 * them is the table twin: every value the bars show, as text, removable.
 */
function FocusSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const today = home.recent.today;
  const week = focusWeek(home.recent.focus, today);
  const [on, setOn] = useState(today);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const peak = Math.max(...week.days.map((d) => d.minutes), 60);
  const picked = week.days.find((d) => d.on === on) ?? week.days[week.days.length - 1];
  const logs = home.recent.focus
    .filter((l) => week.days.some((d) => d.on === l.on))
    .sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at));
  // "today" reads as a label inside a sentence and as a word at the head of a row.
  const day = (d: string) => { const w = whenLabel(d, today); return w.charAt(0).toUpperCase() + w.slice(1); };
  const save = async () => {
    if (!minutes) return;
    setBusy(true);
    const ok = await actions.logFocus({ minutes, on, note: note.trim() || undefined });
    setBusy(false);
    if (ok) { setMinutes(null); setNote(''); }
  };

  return (
    <>
      <h3>Deep work</h3>
      <p className="desc">
        Time on the thing that moves a goal — no messages, no calls. You log it, because nothing else can count it
        honestly, and a guessed number here would be the most flattering one on the screen.
      </p>

      <div className="cp2-week">
        {week.days.map((d) => (
          <button
            key={d.on}
            className={`cp2-week-col${d.on === on ? ' sel' : ''}`}
            onClick={() => setOn(d.on)}
            aria-pressed={d.on === on}
            aria-label={`${whenLabel(d.on, today)}: ${d.minutes ? hoursLabel(d.minutes) : 'nothing logged'}`}
          >
            <span className="bar">{d.minutes > 0 && <i style={{ height: `${Math.round((d.minutes / peak) * 100)}%` }} />}</span>
            <span className="d">{dayLetter(d.on)}</span>
          </button>
        ))}
      </div>
      <p className="cp2-week-read">
        <b>{day(picked.on)}</b>
        {' · '}{picked.minutes ? hoursLabel(picked.minutes) : 'nothing logged'}
        {' · '}{hoursLabel(week.total)} this week
      </p>

      <div className="cp-field">
        <label className="cp-label">How long{on === today ? ' today' : `, ${whenLabel(on, today)}`}</label>
        <div className="cp-chips">
          {FOCUS_PRESETS.map((p) => (
            <button key={p} className={`cp-fchip ${minutes === p ? 'active' : ''}`} onClick={() => setMinutes(minutes === p ? null : p)}>{hoursLabel(p)}</button>
          ))}
        </div>
      </div>
      <div className="cp-field">
        <label className="cp-label" htmlFor="cp-focus-note">On what — optional</label>
        <input id="cp-focus-note" className="cp-input sm" value={note} maxLength={FOCUS_NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="The booking demo for the resort" />
      </div>
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy || !minutes} onClick={() => void save()}>{busy ? 'Logging…' : minutes ? `Log ${hoursLabel(minutes)}` : 'Pick how long'}</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Done</button>
      </div>

      {logs.length > 0 && (
        <>
          <div className="cp-subhead">Logged this week</div>
          {logs.map((l) => (
            <div key={l.id} className="cp-kv">
              <span>{day(l.on)}{l.note ? ` · ${l.note}` : ''}</span>
              <b>{hoursLabel(l.minutes)}{' '}<button className="cp2-x" onClick={() => void actions.removeFocus(l.id)} aria-label={`Remove ${hoursLabel(l.minutes)} logged ${whenLabel(l.on, today)}`}>×</button></b>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function CapacitySheet({ current, onPick }: { current: Capacity; onPick: (c: Capacity) => void }) {
  return (
    <>
      <h3>Set your capacity</h3>
      <p className="desc">Matches and today&apos;s plan re-rank instantly to fit what you actually have right now.</p>
      {(Object.keys(CAPACITY_META) as Capacity[]).map((c) => (
        <button key={c} className={`cp-option ${current === c ? 'active' : ''}`} onClick={() => onPick(c)}>
          <div><div className="ct">{CAPACITY_META[c].label}</div><div className="cs">{CAPACITY_META[c].sub}</div></div>
        </button>
      ))}
    </>
  );
}

/* ─── Actions: plan items and nudges, with approve-and-send when a draft exists ─── */

function ActionSheet({ home, id, actions }: { home: HomeData; id: string; actions: Actions }) {
  const found = home.plan.find((x) => x.id === id) ?? home.queue.find((x) => x.id === id);
  const snap = useRef(found);
  if (found) snap.current = found;
  const a = snap.current;
  const [copied, setCopied] = useState(false);
  if (!a) return <p className="desc">Gone.</p>;
  // The one task that unblocks everything else gets its own button.
  const isOfferTask = a.title.trim().toLowerCase() === OFFER_TASK_TITLE.toLowerCase();
  const copy = async () => {
    try { await navigator.clipboard.writeText(a.ai_draft ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  const exec = a.execution ?? null;
  return (
    <>
      <div className="meta">
        {a.kind === 'plan' && <span className={`cp-chip ${a.owner}`}>{a.owner === 'ai' ? 'AI drafted' : 'Needs you'}</span>}
        {a.kind === 'nudge' && <span className={`cp-chip ${a.urgency === 'urgent' ? 'done' : 'you'}`}>{a.due_label ?? a.urgency}</span>}
        {a.minutes ? <span className="cp-chip you">{a.minutes} min</span> : null}
        {exec && <ExecChip exec={exec} />}
      </div>
      <h3>{a.title}</h3>
      {a.detail && <p className="desc">{a.detail}</p>}

      {exec ? (
        <ExecutionPanel action={a} exec={exec} home={home} actions={actions} />
      ) : a.ai_draft ? (
        <>
          <div className="cp-draft-label"><span>Draft, ready to review</span><button className="cp-textlink" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button></div>
          <div className="cp-draft">{a.ai_draft}</div>
        </>
      ) : null}

      {isOfferTask && a.status !== 'done' && (
        <button className="cp-btn primary block" style={{ marginTop: 12 }} onClick={() => actions.openSheet({ kind: 'offer' })}>Set your offer</button>
      )}
      <div className="cp-btn-row">
        {a.status !== 'done' && <button className={`cp-btn ${exec || isOfferTask ? '' : 'primary'}`} onClick={() => actions.setActionStatus(a.id, 'done')}>Done</button>}
        {a.status === 'done' && <button className="cp-btn" onClick={() => actions.setActionStatus(a.id, 'open')}>Reopen</button>}
        <button className="cp-btn" onClick={() => actions.setActionStatus(a.id, 'dismissed')}>Skip</button>
      </div>
    </>
  );
}

function ExecChip({ exec }: { exec: Execution }) {
  const s = exec.approval_state;
  if (s === 'sent') return <span className="cp-chip sent">Sent</span>;
  if (s === 'failed') return <span className="cp-chip failed">Failed</span>;
  if (s === 'cancelled') return <span className="cp-chip you">Cancelled</span>;
  return <span className="cp-chip send">Ready to send</span>;
}

function ExecutionPanel({ action, exec, home, actions }: { action: Action; exec: Execution; home: HomeData; actions: Actions }) {
  const [body, setBody] = useState(exec.body);
  const [subject, setSubject] = useState(exec.subject ?? '');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const editable = ['needs_approval', 'approved', 'failed'].includes(exec.approval_state);
  // The app only sends through the API when this copilot owns the identity the
  // message goes out under. Otherwise the user sends from their own app.
  const canApiSend = home.channels[exec.channel];
  const send = async () => { setBusy(true); try { await actions.sendAction(action.id, { body, subject: exec.channel === 'email' ? subject : undefined }); } finally { setBusy(false); } };
  const logSent = async () => { setBusy(true); try { await actions.markSent(action.id, { body, subject: exec.channel === 'email' ? subject : undefined }); } finally { setBusy(false); } };
  // Rebuild the link from the edited text, not the stored draft.
  const link = exec.channel === 'whatsapp'
    ? `https://wa.me/${exec.recipient.replace(/\D/g, '')}?text=${encodeURIComponent(body)}`
    : `mailto:${exec.recipient}?${new URLSearchParams({ ...(subject ? { subject } : {}), body }).toString()}`;
  return (
    <>
      <div className="cp-kv"><span>Channel</span><b>{exec.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}</b></div>
      <div className="cp-kv"><span>To</span><b>{exec.channel === 'whatsapp' ? maskPhone(exec.recipient) : exec.recipient}</b></div>
      {exec.approval_state === 'sent' && <div className="cp-kv"><span>Sent</span><b className="cp-ok">{relTime(exec.sent_at)}{exec.dispatch === 'manual' ? ' · by you' : exec.provider ? ` via ${exec.provider}` : ''}</b></div>}
      {exec.approval_state === 'failed' && exec.error && <div className="cp-error" style={{ marginTop: 10 }}>{exec.error}</div>}

      {editable ? (
        <>
          {exec.channel === 'email' && <div className="cp-field" style={{ marginTop: 12 }}><label className="cp-label">Subject</label><input className="cp-input sm" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>}
          <div className="cp-field" style={{ marginTop: exec.channel === 'email' ? 0 : 12 }}>
            <label className="cp-label">Message · edit before sending</label>
            <textarea className="cp-input" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
          </div>
          {canApiSend ? (
            <>
              <div className="cp-btn-row" style={{ marginTop: 4 }}>
                <button className="cp-btn primary" disabled={busy || !body.trim()} onClick={send}>{busy ? 'Sending…' : exec.approval_state === 'failed' ? 'Retry send' : 'Approve & send'}</button>
                <button className="cp-btn" disabled={busy} onClick={() => actions.cancelDraft(action.id)}>Cancel draft</button>
              </div>
              <p className="cp-help">Sends from your own {exec.channel === 'whatsapp' ? 'WhatsApp number' : 'verified address'}. Nothing goes out until you tap send. A follow-up is drafted for day 3.</p>
            </>
          ) : (
            <>
              <div className="cp-btn-row" style={{ marginTop: 4 }}>
                <a className="cp-btn primary" href={link} target="_blank" rel="noreferrer" onClick={() => setOpened(true)} style={{ textDecoration: 'none' }}>
                  Open in {exec.channel === 'whatsapp' ? 'WhatsApp' : 'email'}
                </a>
                <button className={`cp-btn ${opened ? 'dark' : ''}`} disabled={busy || !body.trim()} onClick={logSent}>I sent it</button>
              </div>
              <p className="cp-help">Opens pre-filled in your own {exec.channel === 'whatsapp' ? 'WhatsApp' : 'mail app'}, so it comes from you. Tap “I sent it” and the copilot tracks the reply and drafts the day-3 follow-up.</p>
              <button className="cp-textlink" style={{ marginTop: 10 }} onClick={() => actions.cancelDraft(action.id)}>Cancel draft</button>
            </>
          )}
        </>
      ) : exec.approval_state === 'sent' ? (
        <>
          <div className="cp-draft" style={{ marginTop: 12 }}>{exec.body}</div>
          <div className="cp-inline">
            <button className="cp-btn dark" onClick={() => actions.recordOutcome({ kind: 'reply', action_id: action.id, opportunity_id: action.opportunity_id ?? undefined })}>They replied</button>
            <button className="cp-btn" onClick={() => actions.recordOutcome({ kind: 'no_reply', action_id: action.id, opportunity_id: action.opportunity_id ?? undefined })}>No reply</button>
          </div>
        </>
      ) : null}
    </>
  );
}

/* ─── Opportunities ─────────────────────────────────────────────────────── */

function OppSheet({ home, id, actions }: { home: HomeData; id: string; actions: Actions }) {
  const found = home.opportunities.find((x) => x.id === id) ?? home.pipeline.find((r) => r.opportunity.id === id)?.opportunity;
  const snap = useRef(found);
  if (found) snap.current = found;
  const o = snap.current;
  const [busy, setBusy] = useState(false);
  if (!o) return <p className="desc">Gone.</p>;
  const c = o.contact ?? {};
  const canWa = !!c.whatsapp;
  const canEmail = !!c.email;
  const draft = async (ch: 'whatsapp' | 'email') => { setBusy(true); try { await actions.draftFor(o.id, ch); } finally { setBusy(false); } };
  return (
    <>
      <div className="meta">
        <span className={`cp-tag ${o.status === 'saved' ? 'saved' : ''}`}>{TYPE_LABEL[o.type]}</span>
        {/* No "% match". The score is a heuristic blended with a model's guess,
            and printed as a percentage it read as a measurement (invariant 2).
            It orders lists; it is not shown. */}
        <span className={`cp-badge ${o.source_kind === 'sourced' ? 'real' : 'inferred'}`}>{o.source_kind === 'sourced' ? `Real · ${sourceLabel(o.source)}` : 'Inferred'}</span>
        {o.last_outcome && <span className={`cp-badge ${o.last_outcome === 'won' ? 'won' : 'outcome'}`}>{OUTCOME_LABEL[o.last_outcome]}</span>}
      </div>
      <h3>{o.title}</h3>
      {/* Where it is, with its region: the fact that shows a search answered
          from the wrong city. */}
      {(placeOf(o.data) || ratingOf(o.data)) && <p className="cp-help" style={{ marginTop: -4, marginBottom: 8 }}>{[placeOf(o.data), ratingOf(o.data)].filter(Boolean).join(' · ')}</p>}
      {/* Which of the user's own searches brought this in — the question a hunt
          is judged by, answerable from the card that is being judged. */}
      {typeof o.data?.hunt_label === 'string' && <p className="cp-help" style={{ marginTop: -4, marginBottom: 8 }}>Found by your hunt &ldquo;{o.data.hunt_label}&rdquo;{o.data.found_via === 'agent' ? ' — by the research worker, link checked' : ''}</p>}
      <p className="desc">{o.reason}</p>
      {o.value_label && <div className="cp-mvalue" style={{ marginBottom: 8 }}>{o.value_label}</div>}

      {(c.name || c.whatsapp || c.email || c.website || o.url) && (
        <>
          {c.name && <div className="cp-kv"><span>Contact</span><b>{c.name}</b></div>}
          {c.whatsapp && <div className="cp-kv"><span>WhatsApp</span><b>{maskPhone(c.whatsapp)}</b></div>}
          {c.email && <div className="cp-kv"><span>Email</span><b>{c.email}</b></div>}
          {(c.website || o.url) && <div className="cp-kv"><span>Link</span><b><a href={c.website || o.url!} target="_blank" rel="noreferrer">Open</a></b></div>}
        </>
      )}
      <p className="cp-help" style={{ marginTop: 8 }}>Ordered by how well it fits your offer and goals, your capacity, and what has actually got replies.</p>

      {(c.whatsapp || c.email) && (
        <>
          <div className="cp-subhead">Reach out</div>
          {offerIsEmpty(home.profile.offer) ? (
            <>
              <button className="cp-btn primary block" onClick={() => actions.openSheet({ kind: 'offer' })}>Set your offer to draft</button>
              <p className="cp-help">Every opener is written from what you sell. Nothing is drafted from a blank.</p>
            </>
          ) : (
            <>
              <div className="cp-inline">
                {canWa && <button className="cp-btn primary" disabled={busy} onClick={() => draft('whatsapp')}>Draft WhatsApp</button>}
                {canEmail && <button className="cp-btn primary" disabled={busy} onClick={() => draft('email')}>Draft email</button>}
              </div>
              <p className="cp-help">{home.channels.mode === 'api' ? 'Drafted, then sent from your own account once you approve.' : 'Drafted here, sent from your own WhatsApp or mail app so it comes from you.'}</p>
            </>
          )}
        </>
      )}

      <div className="cp-subhead">What happened?</div>
      <div className="cp-inline">
        <button className="cp-btn" onClick={() => actions.recordOutcome({ kind: 'reply', opportunity_id: o.id })}>Replied</button>
        <button className="cp-btn" onClick={() => actions.recordOutcome({ kind: 'meeting', opportunity_id: o.id })}>Meeting</button>
        <button className="cp-btn dark" onClick={() => actions.openSheet({ kind: 'won', oppId: o.id })}>Won</button>
        <button className="cp-btn" onClick={() => actions.recordOutcome({ kind: 'lost', opportunity_id: o.id })}>Lost</button>
      </div>

      <div className="cp-btn-row">
        {o.status === 'saved'
          ? <button className="cp-btn" onClick={() => actions.setOppStatus(o.id, 'new')}>Unsave</button>
          : <button className="cp-btn" onClick={() => actions.setOppStatus(o.id, 'saved')}>Save</button>}
        <button className="cp-btn" onClick={() => actions.setOppStatus(o.id, 'dismissed')}>Skip</button>
      </div>
    </>
  );
}

function WonSheet({ home, oppId, actions }: { home: HomeData; oppId: string; actions: Actions }) {
  const o = home.opportunities.find((x) => x.id === oppId) ?? home.pipeline.find((r) => r.opportunity.id === oppId)?.opportunity;
  const goal = home.goals.find((g) => g.metric === 'currency');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(goal?.unit || '$');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); await actions.recordOutcome({ kind: 'won', opportunity_id: oppId, amount: amount === '' ? undefined : Number(amount), currency, note: note || undefined }); setBusy(false); };
  return (
    <>
      <h3>Won{o ? `: ${o.title}` : ''}</h3>
      <p className="desc">The amount lands on your revenue goal{goal ? ` (${goal.title})` : ''} and teaches ranking what a good match looks like.</p>
      <div className="cp-field"><label className="cp-label">Amount / currency</label>
        <div className="cp-input-row">
          <input className="cp-input" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1800" />
          <input className="cp-input" style={{ maxWidth: 84 }} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} />
        </div>
      </div>
      <div className="cp-field"><label className="cp-label">Note (optional)</label><input className="cp-input sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Booking flow + 2 automations, paid upfront" maxLength={400} /></div>
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy} onClick={save}>Log win</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Back</button>
      </div>
    </>
  );
}

/* ─── Signals ────────────────────────────────────────────────────────────── */

/**
 * One opening, and the two honest things to do about it: name it in what you
 * send, or stop matching the segments where it shows up. Dropping a segment
 * hides its businesses, so it asks twice.
 *
 * What is deliberately NOT here any more: "add it to what you sell". The term
 * is a condition a scraper saw at the prospect — "no website", "few reviews" —
 * so appending it to `sells` described a business the user does not run.
 * addOpeningToOffer puts it in `problem`, which is the field an opener leads
 * with and the reason the waiting drafts get rewritten.
 */
function OpeningSheet({ home, term, actions }: { home: HomeData; term: string; actions: Actions }) {
  const found = home.diagnosis.openings.find((x) => x.term === term);
  const snap = useRef(found);
  if (found) snap.current = found;
  const t = snap.current;
  const [busy, setBusy] = useState(false);
  const [confirmSeg, setConfirmSeg] = useState<string | null>(null);
  if (!t) return <p className="desc">Gone.</p>;
  const offer = home.profile.offer ?? {};
  const noOffer = offerIsEmpty(offer);
  const already = (offer.problem ?? '').toLowerCase().includes(term.toLowerCase());
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const movement = t.trend === 'new' ? `${t.thisWeek} of them found this week, none before`
    : t.trend === 'rising' ? `${t.thisWeek} found this week against about ${t.prevWeeklyAvg} a week before`
    : t.trend === 'falling' ? `${t.thisWeek} found this week, down from about ${t.prevWeeklyAvg} a week`
    : t.thisWeek ? `${t.thisWeek} found this week` : 'none found this week';
  return (
    <>
      <div className="meta">
        <span className="cp-chip ai">An opening</span>
        <span className={`cp-chip trend ${t.trend}`}>{TREND_LABEL[t.trend]}</span>
      </div>
      <h3 style={{ textTransform: 'capitalize' }}>{term}</h3>
      <p className="desc">{t.count} real {t.count === 1 ? 'business' : 'businesses'} matched to you have this in common — {movement}. Nothing you send mentions it.</p>
      <p className="cp-help">Read off their listings. Nobody asked for it — it is what you could sell against.</p>

      {t.segments.length > 0 && (
        <>
          <div className="cp-subhead">Where it shows up</div>
          {t.segments.map((s) => <div key={s.segment} className="cp-kv"><span style={{ textTransform: 'capitalize' }}>{s.segment}</span><b>{s.count}</b></div>)}
        </>
      )}

      <div className="cp-subhead">Name it</div>
      <button className="cp-btn primary block" disabled={busy || already || noOffer} onClick={() => run(() => actions.saveOffer(addOpeningToOffer(offer, term)))}>
        {already ? 'Already in your openers' : 'Add it to the problem you solve'}
      </button>
      <p className="cp-help">
        {noOffer
          ? 'Set your offer first — an opening is only worth naming next to what you sell.'
          : 'Goes into the problem your offer says it fixes, not into what you sell. Every waiting draft is rewritten to lead with it, and the brief rebuilds.'}
      </p>
      {noOffer && <button className="cp-btn block" style={{ marginTop: 8 }} onClick={() => actions.openSheet({ kind: 'offer' })}>Set your offer</button>}

      {t.segments.length > 0 && (
        <>
          <div className="cp-subhead">Or stop matching where it shows up</div>
          {t.segments.map((s) => (
            confirmSeg === s.segment ? (
              <div key={s.segment} className="cp-btn-row" style={{ marginTop: 0, marginBottom: 8 }}>
                <button className="cp-btn dark" disabled={busy} onClick={() => run(() => actions.dropSegment(s.segment))}>Yes, drop {s.segment}</button>
                <button className="cp-btn" disabled={busy} onClick={() => setConfirmSeg(null)}>Keep</button>
              </div>
            ) : (
              <button key={s.segment} className="cp-btn block" style={{ marginBottom: 8 }} disabled={busy} onClick={() => setConfirmSeg(s.segment)}>Stop matching {s.segment}</button>
            )
          ))}
          <p className="cp-help">Removes the segment from targeting, retires its waiting drafts and sets its businesses aside. Reversible in the database, not in the app — so it asks twice.</p>
        </>
      )}

      <div className="cp-btn-row"><button className="cp-btn" onClick={actions.closeSheet}>Back</button></div>
    </>
  );
}

/* ─── Growth ─────────────────────────────────────────────────────────────── */

/* ─── Goals ─────────────────────────────────────────────────────────────── */

const METRICS: Array<{ v: GoalMetric; l: string }> = [{ v: 'currency', l: 'Money' }, { v: 'number', l: 'Count' }, { v: 'percent', l: 'Percent' }, { v: 'none', l: 'Just a goal' }];

function GoalSheet({ goal, actions }: { goal: Goal | undefined; actions: Actions }) {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [metric, setMetric] = useState<GoalMetric>(goal?.metric ?? 'currency');
  const [unit, setUnit] = useState(goal?.unit ?? (goal ? '' : '$'));
  const [target, setTarget] = useState(goal?.target_value?.toString() ?? '');
  const [current, setCurrent] = useState(goal?.current_value?.toString() ?? '');
  const [note, setNote] = useState(goal?.note ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await actions.saveGoal({ id: goal?.id, title, metric, unit: metric === 'none' ? '' : unit, target_value: target === '' ? undefined : Number(target), current_value: current === '' ? undefined : Number(current), note });
    setBusy(false);
  };
  return (
    <>
      <h3>{goal ? 'Update goal' : 'New goal'}</h3>
      <p className="desc">Goals drive ranking. Wins you log move the number automatically; edit it here when money arrives another way.</p>
      <div className="cp-field"><label className="cp-label">Goal</label><input className="cp-input sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monthly revenue" /></div>
      <div className="cp-field"><label className="cp-label">Measured as</label>
        <div className="cp-chips">{METRICS.map((m) => <button key={m.v} className={`cp-fchip ${metric === m.v ? 'active' : ''}`} onClick={() => setMetric(m.v)}>{m.l}</button>)}</div>
      </div>
      {metric !== 'none' && (
        <div className="cp-field"><label className="cp-label">Now / Target{metric !== 'percent' && ' / Unit'}</label>
          <div className="cp-input-row">
            <input className="cp-input sm" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0" />
            <input className="cp-input sm" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="2000" />
            {metric !== 'percent' && <input className="cp-input sm" style={{ maxWidth: 80 }} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={metric === 'currency' ? '$' : 'clients'} />}
          </div>
        </div>
      )}
      <div className="cp-field"><label className="cp-label">Why it matters (optional)</label><input className="cp-input sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Close before relocation" /></div>
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy || !title.trim()} onClick={save}>Save</button>
        {goal && <button className="cp-btn" disabled={busy} onClick={() => actions.saveGoal({ id: goal.id, status: 'done' })}>Mark done</button>}
      </div>

      {/* The goal is where a mandate is written, so the chain the app could
          never show — goal, the bet that moves it, the work, today's move —
          starts at the link that makes it true rather than at a form floating
          on its own. */}
      {goal && <HandoverForm goalId={goal.id} goalTitle={goal.title} actions={actions} embedded />}
    </>
  );
}

/**
 * Hand a piece of work over.
 *
 * Shared by the goal sheet, where the work is attached to the number it moves,
 * and by its own entry on Now, which is how anybody without a goal gets in at
 * all — for months the only door was four taps inside a saved goal, so an
 * account with no goal simply could not hand anything over and nothing said so.
 *
 * Authority is chosen here and shown with what it actually does, because it is
 * the only field on this form that decides whether anything touches the world.
 * The two rings that cannot act by themselves say so before they are picked —
 * a capability the app is vague about is one somebody will discover by being
 * disappointed.
 */

/**
 * Objectives at the length one actually has to be.
 *
 * Not decoration: "Find jobs" and "Find a good deal" are real objectives from
 * this account, and both came back with nothing because there was nothing in
 * them to act on. A worker is only as specific as its brief, and a one-line
 * field with no example gets a three-word answer. Tapping one fills the box so
 * the shape is learned by editing rather than by reading a hint.
 */
export const OBJECTIVE_EXAMPLES = [
  'Quote three suppliers for the signage job and say which is cheapest delivered',
  'Find 20 resorts near me with no website and a phone number on file',
  'Compare what the three closest competitors charge and how they package it',
];

function HandoverForm({
  goalId, goalTitle, goals, actions, onDone, embedded = false,
}: {
  goalId?: string;
  goalTitle?: string;
  /** Offered as a picker when the form is not already bound to one. */
  goals?: Goal[];
  actions: Actions;
  onDone?: () => void;
  /** Inside the goal sheet it is a section that opens; on its own it is the sheet. */
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(!embedded);
  const [objective, setObjective] = useState('');
  const [why, setWhy] = useState('');
  const [pickedGoal, setPickedGoal] = useState<string>(goalId ?? '');
  const [authority, setAuthority] = useState<Authority>('read');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (embedded && !open) {
    return (
      <>
        <div className="cp-section"><span className="lead">Hand work over</span></div>
        <button className="cp-btn block" onClick={() => setOpen(true)}>Put something to work on this</button>
        <p className="cp-help">Something you would otherwise do yourself — research, a comparison, a shortlist.</p>
      </>
    );
  }

  const write = async () => {
    if (!objective.trim()) return setError('What should it get done?');
    setBusy(true); setError(null);
    const r = await actions.createCommission({
      objective: objective.trim(),
      why: why.trim() || undefined,
      goal_id: pickedGoal || undefined,
      authority,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not write that');
    setOpen(!embedded); setObjective(''); setWhy('');
    onDone?.();
  };

  return (
    <>
      {embedded
        ? <div className="cp-section"><span className="lead">Hand work over</span></div>
        : (
          <>
            <h3>Hand something over</h3>
            <p className="desc">
              It researches, compares and drafts while you are doing something else, and reports
              back here. It never contacts anyone and never spends anything.
            </p>
          </>
        )}

      <div className="cp-field">
        <label className="cp-label" htmlFor="cp-objective">What should it get done?</label>
        <input
          id="cp-objective" className="cp-input sm" value={objective}
          onChange={(e) => { setObjective(e.target.value); setError(null); }}
          placeholder={OBJECTIVE_EXAMPLES[0]}
        />
        {/* A worker is only as specific as its brief. */}
        {!objective.trim() && (
          <div className="cp-chips" style={{ marginTop: 8 }}>
            {OBJECTIVE_EXAMPLES.map((ex) => (
              <button key={ex} className="cp-fchip" onClick={() => setObjective(ex)}>{ex.split(' ').slice(0, 4).join(' ')}…</button>
            ))}
          </div>
        )}
      </div>

      <div className="cp-field">
        <label className="cp-label" htmlFor="cp-why">
          {goalTitle ? `Why this moves ${goalTitle} — optional` : 'Why it matters — optional'}
        </label>
        <input id="cp-why" className="cp-input sm" value={why} onChange={(e) => setWhy(e.target.value)}
          placeholder="Nothing is in the pipeline and the queue is empty" />
      </div>

      {/* Only when it is not already bound to one. A goal is what lets the app
          show the chain — goal, the work that moves it, today's move — so it is
          offered, never required: plenty of real work moves nothing countable. */}
      {!goalId && goals && goals.length > 0 && (
        <div className="cp-field">
          <label className="cp-label">Which goal does it move? — optional</label>
          <div className="cp-chips">
            {goals.slice(0, 4).map((g) => (
              <button key={g.id} className={`cp-fchip ${pickedGoal === g.id ? 'active' : ''}`}
                onClick={() => setPickedGoal(pickedGoal === g.id ? '' : g.id)}>{g.title}</button>
            ))}
          </div>
        </div>
      )}

      <div className="cp-field">
        <label className="cp-label">What it may do</label>
        <div className="cp-chips">
          {AUTHORITIES.map((a) => (
            <button key={a} className={`cp-fchip ${authority === a ? 'active' : ''}`} onClick={() => setAuthority(a)}>{AUTHORITY[a].label}</button>
          ))}
        </div>
        <p className="cp-help">{AUTHORITY[authority].blurb} {AUTHORITY[authority].gate ?? ''}</p>
      </div>

      {error && <div className="cp-note">{error}</div>}
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy || !objective.trim()} onClick={() => void write()}>{busy ? 'Writing…' : 'Write it'}</button>
        <button className="cp-btn ghost" disabled={busy} onClick={() => { if (embedded) setOpen(false); else actions.closeSheet(); }}>Cancel</button>
      </div>
      <p className="cp-help">Nothing runs until you read it and approve it.</p>
    </>
  );
}

function HandoverSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  return <HandoverForm goals={home.goals} actions={actions} onDone={() => actions.closeSheet()} />;
}

/* ─── You: finance, targeting, account ──────────────────────────────────── */

function FinanceSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const f = home.profile.finance ?? {};
  const [burn, setBurn] = useState(f.monthly_burn?.toString() ?? '');
  const [cash, setCash] = useState(f.cash?.toString() ?? '');
  const [currency, setCurrency] = useState(f.currency || home.goals.find((g) => g.metric === 'currency')?.unit || '$');
  const [busy, setBusy] = useState(false);
  const preview = computeRunwayMonths({ monthly_burn: Number(burn) || undefined, cash: cash === '' ? undefined : Number(cash) });
  const save = async () => { setBusy(true); await actions.saveFinance({ monthly_burn: burn === '' ? undefined : Number(burn), cash: cash === '' ? undefined : Number(cash), currency }); setBusy(false); };
  return (
    <>
      <h3>Runway</h3>
      <p className="desc">Two numbers, no bank connection. Runway shapes the read: under four months, the copilot favours fast-close work over big builds.</p>
      <div className="cp-field"><label className="cp-label">Monthly burn / Cash on hand / Currency</label>
        <div className="cp-input-row">
          <input className="cp-input" inputMode="decimal" autoFocus value={burn} onChange={(e) => setBurn(e.target.value)} placeholder="1200" />
          <input className="cp-input" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="5000" />
          <input className="cp-input" style={{ maxWidth: 70 }} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} />
        </div>
        <div className="cp-help">{preview != null ? `That is ${preview} months of runway.` : 'Enter both to see runway.'}</div>
      </div>
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy} onClick={save}>Save</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Back</button>
      </div>
    </>
  );
}

function TargetingSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const [segments, setSegments] = useState(home.profile.target_segments.join(', '));
  const [area, setArea] = useState(home.profile.target_area ?? home.profile.location ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    setBusy(true);
    const ok = await actions.saveTargeting({ target_segments: segments.split(',').map((s) => s.trim()).filter(Boolean), target_area: area.trim() });
    setBusy(false); setSaved(ok);
  };
  return (
    <>
      <h3>Who do you sell to?</h3>
      <p className="desc">These two fields drive real supply. Each segment is searched on Google Maps as typed, as &ldquo;segment in area&rdquo; — so name the kind of business, and give the area its country.</p>
      <div className="cp-field"><label className="cp-label">Segments, comma separated</label><input className="cp-input sm" autoFocus value={segments} onChange={(e) => setSegments(e.target.value)} placeholder="pest control, aircon service, plumbing" /></div>
      {(() => {
        const refused = segments.split(',').map((x) => x.trim()).filter((x) => x && !isSearchableSegment(x));
        const one = refused.length === 1;
        return refused.length > 0 && <p className="cp-help">{refused.map((x) => `\u201c${x}\u201d`).join(', ')} {one ? 'is one letter' : 'are one letter each'}, and each segment is searched exactly as typed — so {one ? 'it is' : 'they are'} left out. Name the kind of business instead.</p>;
      })()}
      <div className="cp-field"><label className="cp-label">Area, with the country</label><input className="cp-input sm" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Puerto Princesa, Philippines" /></div>
      {/* Said before the search, not after sixty wrong results: a bare city
          name is ambiguous to Maps, and it will not ask which one you meant. */}
      {!!area.trim() && !area.includes(',') && <p className="cp-help">&ldquo;{area.trim()}&rdquo; alone can match a city of that name in another country. Add the country after a comma.</p>}
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy || !segments.trim()} onClick={save}>Save</button>
        {saved
          ? <button className="cp-btn dark" onClick={() => { actions.closeSheet(); void actions.findMatches(); }}>Find matches now</button>
          : <button className="cp-btn" onClick={actions.closeSheet}>Back</button>}
      </div>
    </>
  );
}

function AccountSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const [email, setEmail] = useState(home.account.email ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const shell = useShell();
  const send = async () => {
    setState('sending'); setError(null);
    const r = await actions.requestLoginLink(email.trim());
    if (r.ok) setState('sent'); else { setState('error'); setError(r.error ?? 'Could not send'); }
  };
  const togglePush = async () => { setPushBusy(true); await actions.setPush(!home.push.enabled); setPushBusy(false); };
  return (
    <>
      <h3>Account &amp; notifications</h3>
      <p className="desc">A sign-in link lets you open this copilot on another device and recover it if this one is lost. No password.</p>
      <div className="cp-kv"><span>Email</span><b>{home.account.email ? `${home.account.email}${home.account.verified ? ' · verified' : ' · not verified yet'}` : 'none yet'}</b></div>
      <div className="cp-field" style={{ marginTop: 12 }}><label className="cp-label">{home.account.verified ? 'Send a sign-in link' : 'Verify your email'}</label>
        <div className="cp-input-row">
          <input className="cp-input sm" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button className="cp-btn dark" disabled={state === 'sending' || !email.includes('@')} onClick={send}>{state === 'sending' ? 'Sending…' : 'Send link'}</button>
        </div>
        {state === 'sent' && <div className="cp-status-line cp-ok">Check your inbox. The link works once and expires in 15 minutes.</div>}
        {state === 'error' && <div className="cp-status-line">{error}</div>}
      </div>

      <div className="cp-subhead">Push nudges on this device</div>
      <div className="cp-kv">
        <span>{home.push.publicKey ? 'Urgent nudges and replies, as they happen' : 'Push is not configured on this server yet'}</span>
        <button className={`cp-toggle ${home.push.enabled ? 'on' : ''}`} disabled={pushBusy || !home.push.publicKey} onClick={togglePush}>{home.push.enabled ? 'On' : 'Off'}</button>
      </div>
      <div className="cp-subhead">The small print</div>
      <p className="desc" style={{ marginBottom: 10 }}>
        <a href={`${shell}/privacy`}>What this holds about you</a> · <a href={`${shell}/terms`}>Terms of use</a>
      </p>

      <div className="cp-subhead">Delete everything</div>
      <p className="desc">
        Removes your profile and every goal, match, drafted message, outcome, decision and watched
        source with it. Immediately, and not recoverably. &ldquo;Forget device&rdquo; only signs this
        device out; this is the other one.
      </p>
      {confirming ? (
        <>
          <div className="cp-field">
            <label className="cp-label">Type DELETE to confirm</label>
            <input className="cp-input sm" value={confirm} autoCapitalize="characters" autoCorrect="off"
              spellCheck={false} onChange={(e) => { setConfirm(e.target.value); setDelError(null); }} placeholder="DELETE" />
          </div>
          {delError && <div className="cp-note">{delError}</div>}
          <div className="cp-btn-row">
            <button className="cp-btn dark" disabled={deleting || confirm.trim().toUpperCase() !== 'DELETE'}
              onClick={async () => {
                setDeleting(true);
                const r = await actions.deleteAccount(confirm);
                if (!r.ok) { setDeleting(false); setDelError(r.error ?? 'Could not delete the account'); }
              }}>{deleting ? 'Deleting…' : 'Delete it all'}</button>
            <button className="cp-btn" disabled={deleting} onClick={() => { setConfirming(false); setConfirm(''); setDelError(null); }}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="cp-btn-row"><button className="cp-btn" onClick={() => setConfirming(true)}>Delete my account</button></div>
      )}

      <div className="cp-btn-row"><button className="cp-btn" onClick={actions.closeSheet}>Done</button></div>
    </>
  );
}

function OfferSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const o = home.profile.offer ?? {};
  const [sells, setSells] = useState(o.sells ?? '');
  const [forWho, setForWho] = useState(o.for_who ?? home.profile.target_segments.join(', '));
  const [problem, setProblem] = useState(o.problem ?? '');
  const [price, setPrice] = useState(o.price_band ?? '');
  const [proof, setProof] = useState(o.proof_url ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await actions.saveOffer({ sells, for_who: forWho, problem, price_band: price, proof_url: proof });
    setBusy(false);
  };
  return (
    <>
      <h3>What do you sell?</h3>
      <p className="desc">Every message the copilot drafts is built from this. Without it, drafts fall back to your one-line headline and stay vague.</p>
      <div className="cp-field"><label className="cp-label">I sell / I build</label><input className="cp-input sm" autoFocus value={sells} onChange={(e) => setSells(e.target.value)} placeholder="WhatsApp booking automations" maxLength={240} /></div>
      <div className="cp-field"><label className="cp-label">For</label><input className="cp-input sm" value={forWho} onChange={(e) => setForWho(e.target.value)} placeholder="resorts and tour operators" maxLength={120} /></div>
      <div className="cp-field"><label className="cp-label">The problem it solves</label><input className="cp-input sm" value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="enquiries arrive after hours and go unanswered" maxLength={240} /><div className="cp-help">Written as the customer would feel it, not as a feature.</div></div>
      <div className="cp-field"><label className="cp-label">Price band (optional)</label><input className="cp-input sm" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$400–1,500 per build" maxLength={60} /></div>
      <div className="cp-field"><label className="cp-label">One link that proves it (optional)</label><input className="cp-input sm" type="url" inputMode="url" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="https://…" maxLength={300} /><div className="cp-help">Goes into openers as the example, instead of a vague offer to show one.</div></div>
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy || !sells.trim()} onClick={save}>Save</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Back</button>
      </div>
    </>
  );
}

function ResetSheet({ actions }: { actions: Actions }) {
  return (
    <>
      <h3>Forget this device?</h3>
      <p className="desc">Your copilot stays in the database. If you verified an email, a sign-in link brings it back on any device. If not, this is one-way.</p>
      <div className="cp-btn-row">
        <button className="cp-btn dark" onClick={actions.resetDevice}>Forget device</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Keep</button>
      </div>
    </>
  );
}

export type { Opportunity };

/* ─── The queue, one draft at a time ─────────────────────────────────────── */

/**
 * Why this is not a list.
 *
 * It was a list: forty rows on Today, forty-two on Pipeline, and 45 of 54 drafts
 * were never sent. A list of forty-five is a decision about forty-five things,
 * and the reliable answer to a decision that size is to close the app. This is a
 * decision about one, ten times — with the message visible, because approving
 * text you cannot see is not approval.
 *
 * Oldest first. Eleven days waiting is the number that makes somebody send, and
 * it is the recipient closest to having forgotten the problem they had.
 */
function QueueSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const ordered = [...home.queue].sort((a, b) => a.execution.created_at.localeCompare(b.execution.created_at));
  const q = ordered[i];
  const sentToday = home.metrics.sent;

  if (!ordered.length) {
    return (
      <>
        <h3>Queue is clear</h3>
        <p className="desc">Every match with a contact has been written to. Find new ones from the funnel on Working, or log what came back.</p>
        <div className="cp-btn-row"><button className="cp-btn" onClick={actions.closeSheet}>Back</button></div>
      </>
    );
  }
  if (!q) {
    return (
      <>
        <h3>That is the last one</h3>
        <p className="desc">Nothing else is waiting. {sentToday} sent in the last {home.metrics.window_days} days.</p>
        <div className="cp-btn-row"><button className="cp-btn" onClick={actions.closeSheet}>Done</button></div>
      </>
    );
  }

  const e = q.execution;
  const apiSend = home.channels[e.channel];
  const label = e.channel === 'whatsapp' ? 'WhatsApp' : 'email';
  const who = q.opp?.title || q.title.replace(/^Opener to /, '').replace(/, ready to review$/, '');
  const waited = Math.max(0, Math.floor((Date.now() - new Date(e.created_at).getTime()) / 86_400_000));
  const next = () => setI((n) => n + 1);
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); next(); } finally { setBusy(false); } };

  return (
    <>
      <div className="meta">
        <span className="cp-chip send">{i + 1} of {ordered.length}</span>
        {waited > 0 && <span className="cp-chip">{waited} day{waited === 1 ? '' : 's'} waiting</span>}
      </div>
      <h3>{who}</h3>
      <p className="desc">{[q.opp?.segment, q.opp?.name, `over ${label}`].filter(Boolean).join(' · ')}</p>

      <div className="cp-draft">
        <div className="cp-draft-label">The message</div>
        {e.subject && <div style={{ fontWeight: 600, marginBottom: 6 }}>{e.subject}</div>}
        <div style={{ whiteSpace: 'pre-wrap' }}>{e.body}</div>
      </div>
      <button className="cp-textlink" style={{ marginTop: 10 }} onClick={() => actions.openSheet({ kind: 'action', id: q.id })}>
        Edit this message
      </button>

      {apiSend
        ? <button className="cp-btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={() => act(() => actions.sendAction(q.id))}>{busy ? 'Sending…' : `Send on ${label}`}</button>
        : <a className="cp-btn primary block" style={{ marginTop: 14, textDecoration: 'none' }} href={e.deep_link ?? '#'} target="_blank" rel="noreferrer" onClick={() => actions.markOpened(q.id)}>Open in {label}</a>}

      <div className="cp-btn-row">
        {/* Manual dispatch: they sent it from their own app, this only records it. */}
        {!apiSend && <button className="cp-btn" disabled={busy} onClick={() => act(() => actions.markSent(q.id))}>I sent it</button>}
        <button className="cp-btn" disabled={busy} onClick={next}>Skip for now</button>
        <button className="cp-btn" disabled={busy} onClick={() => act(() => actions.cancelDraft(q.id))}>Not for me</button>
      </div>
      <p className="cp-help">One at a time. Skipping keeps it in the queue; &ldquo;not for me&rdquo; retires the draft.</p>
    </>
  );
}

/* ─── One funnel stage, opened ───────────────────────────────────────────── */

/**
 * Where the Pipeline tab went. A funnel bar you cannot open is a picture; this
 * is the same count with the businesses behind it, oldest first — the order that
 * says which one is closest to going cold.
 */
function StageSheet({ home, stage, actions }: { home: HomeData; stage: PipelineStage; actions: Actions }) {
  const rows = home.pipeline
    .filter((r) => r.stage === stage)
    .sort((a, b) => (a.execution?.created_at ?? a.opportunity.created_at).localeCompare(b.execution?.created_at ?? b.opportunity.created_at));

  return (
    <>
      <div className="meta"><span className="cp-chip send">{rows.length}</span></div>
      <h3>{STAGE_LABEL[stage]}</h3>
      <p className="desc">
        {stage === 'to_send' ? 'Written and never sent. The oldest is the one whose recipient is closest to having moved on.'
          : stage === 'not_drafted' ? 'Matched, nothing written yet. Judge them on Now.'
          : 'Oldest first.'}
      </p>

      {stage === 'to_send' && rows.length > 0 && (
        <button className="cp-btn primary block" style={{ marginBottom: 12 }} onClick={() => actions.openSheet({ kind: 'queue' })}>
          Work through them, one at a time
        </button>
      )}

      {rows.length === 0
        ? <p className="desc">Nothing at this stage yet.</p>
        : (
          <div className="cp-list" style={{ marginLeft: 0, marginRight: 0 }}>
            {rows.slice(0, 40).map((r) => {
              const d = (r.opportunity.data ?? {}) as Record<string, unknown>;
              const segment = [d.segment, d.service_type, d.category].find((v) => typeof v === 'string' && (v as string).trim()) as string | undefined;
              const since = r.execution?.created_at ?? r.opportunity.created_at;
              const days = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000));
              return (
                <button key={r.opportunity.id} className="cp-prow" onClick={() => actions.openSheet({ kind: 'opp', id: r.opportunity.id })}>
                  <div className="cp-pmain">
                    <div className="t">{r.opportunity.title}</div>
                    <div className="s">{[segment, r.opportunity.last_outcome ? OUTCOME_LABEL[r.opportunity.last_outcome].toLowerCase() : null].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className="cp-score">{days === 0 ? 'today' : `${days}d`}</span>
                </button>
              );
            })}
          </div>
        )}
      {rows.length > 40 && <div className="cp-note" style={{ paddingLeft: 0 }}>Showing the 40 oldest of {rows.length}.</div>}

      <div className="cp-btn-row"><button className="cp-btn" onClick={actions.closeSheet}>Back</button></div>
    </>
  );
}

/* ─── Sources: where this person's supply comes from ─── */

/**
 * The list of places to look, as rows the user owns.
 *
 * This sheet exists because the alternative was a constant in a TypeScript file.
 * Supply was three compiled-in adapters — Hunter, Google Maps, one webhook — and
 * every one of them answered "which local business should I message". Hand the
 * app to somebody whose top goal is a job and there was nothing for it to look
 * at, and no way for them to say so. A URL and a reason is the whole interface.
 */
function WatchlistSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const [url, setUrl] = useState('');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<Discovered[] | null>(null);
  const [findNote, setFindNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sources = home.watchSources;
  const yields = home.sourceYield ?? {};
  // Worst first, and only ever a suggestion — the app removes nothing somebody
  // chose to watch. It earned an opinion by counting; that is the whole extent
  // of the right.
  const prune = pruneSuggestions(Object.values(yields));

  const find = async () => {
    setFinding(true); setError(null); setFindNote(null);
    const r = await actions.discoverSources();
    setFinding(false);
    if (!r.ok) return setError(r.error ?? 'Could not search');
    setFound(r.found ?? []);
    setFindNote(r.note
      ?? ((r.found?.length ?? 0) === 0 && r.checked
        ? `Read ${r.checked} ${r.checked === 1 ? 'page' : 'pages'}, none of them publish a feed this can read.`
        : null));
  };
  // Seeded by what they already told the app they sell, so the search feeds
  // arrive with their own words in them rather than a placeholder.
  const term = home.profile.offer?.sells || home.profile.target_segments[0] || null;
  const [intent, setIntent] = useState<WatchIntent>(sources.length ? 'work' : (home.profile.offer?.sells ? 'clients' : 'work'));

  const add = async (u: string, label?: string, reason?: string) => {
    if (!u.trim() || busy) return;
    setBusy(true); setError(null);
    const r = await actions.addWatchSource({ url: u.trim(), label, intent: reason || why.trim() || undefined });
    setBusy(false);
    if (r.ok) { setUrl(''); setWhy(''); } else setError(r.error ?? 'Could not add that');
  };

  return (
    <>
      <h3>What you watch</h3>
      <p className="desc">
        Every night these get read and anything worth your morning becomes a move, with the link attached.
        Everything else on this app is worked out from your own rows — this is the only part that goes outside and looks.
      </p>

      <div className="cp-section">
        <span className="lead">Find them for me</span>
        <button className="link" disabled={finding} onClick={() => void find()}>
          {finding ? 'Looking…' : found ? 'Look again' : 'Search'}
        </button>
      </div>
      <p className="desc" style={{ marginTop: -6 }}>
        Built from what you sell and who for. Every result below was fetched and read before it got here — if it is
        listed, it works, and the line under it is one of its own headlines.
      </p>

      {findNote && <div className="cp-note">{findNote}</div>}
      {found?.map((d) => {
        const already = sources.some((s) => s.url === d.url);
        return (
          <button key={d.url} className="cp-option" disabled={busy || already}
            onClick={async () => { setBusy(true); await actions.addDiscovered(d); setBusy(false); }}>
            <div>
              <div className="ct">{d.label}</div>
              <div className="cs">{already ? 'Already watching' : d.intent}</div>
              {/* The newest item off the feed. Evidence rather than a pitch:
                  somebody can tell in a second whether this is their world. */}
              <div className="cs quote">“{d.sample}”</div>
              <div className="cs">{d.items} recent {d.items === 1 ? 'item' : 'items'}</div>
            </div>
          </button>
        );
      })}

      <div className="cp-field">
        <label className="cp-label">Or add a feed yourself</label>
        <div className="cp-input-row">
          <input className="cp-input sm" value={url} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') void add(url); }}
            placeholder="r/forhire" />
          <button className="cp-btn dark" disabled={busy || !url.trim()} onClick={() => void add(url)}>{busy ? 'Adding…' : 'Add'}</button>
        </div>
      </div>
      <div className="cp-field">
        <label className="cp-label">Why you want it watched — optional</label>
        <input className="cp-input sm" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="n8n and automation contracts, remote only" />
      </div>
      {error && <div className="cp-note">{error}</div>}

      {sources.length > 0 && (
        <>
          <div className="cp-section">
            <span className="lead">Watching</span>
            <button className="link" disabled={reading} onClick={async () => { setReading(true); await actions.readSourcesNow(); setReading(false); }}>
              {reading ? 'Reading…' : 'Read them now'}
            </button>
          </div>
          <p className="desc" style={{ marginTop: -6 }}>
            Two at a time, oldest first — a fetch and a judgement each, which is as much as one tap can hold.
            Tap again for the next two.
          </p>
          {sources.map((s) => {
            const broken = !!s.last_error || s.kind !== 'feed';
            return (
              <div key={s.id} className="cp-src">
                <div className="ct">{s.label}</div>
                <div className={`cs ${broken ? 'bad' : ''}`}>
                  {s.last_error ? `Last read failed — ${s.last_error}. It gets tried again tonight.`
                    : s.kind !== 'feed' ? 'Saved, but only feeds are read. Try adding /feed or /rss to the end of the URL.'
                    : s.status === 'paused' ? 'Paused. It stays on the list.'
                    : s.last_checked_at ? `Last read ${relTime(s.last_checked_at)}`
                    : 'Not read yet — the first pass runs tonight'}
                </div>
                {s.intent && <div className="cs">{s.intent}</div>}
                {/* Counts, never adjectives. "12 found · 1 kept · 9 binned"
                    lets somebody decide; "low relevance" asks them to trust a
                    word the app made up. */}
                {yieldLine(yields[s.id]) && (
                  <div className={`cs ${yields[s.id]?.verdict === 'noise' ? 'bad' : ''}`}>{yieldLine(yields[s.id])}</div>
                )}
                <div className="acts">
                  {s.status !== 'paused'
                    ? <button className="cp-connect ghost" onClick={() => void actions.setWatchSourceStatus(s.id, 'paused')}>Pause</button>
                    : <button className="cp-connect" onClick={() => void actions.setWatchSourceStatus(s.id, 'active')}>Resume</button>}
                  <button className="cp-connect ghost" onClick={() => void actions.removeWatchSource(s.id)}>Remove</button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {prune.length > 0 && (
        <div className="cp-note">
          {prune.length === 1 ? 'One source is not earning its place' : `${prune.length} sources are not earning their place`}
          {' — '}
          {prune.slice(0, 3).map((y) => sources.find((s) => s.id === y.sourceId)?.label).filter(Boolean).join(', ')}.
          {' '}Every one costs a read and a judgement a night. Removing one is how the rest get more of both.
        </div>
      )}

      <div className="cp-section"><span className="lead">{sources.length ? 'Add another' : 'Or start from one of these'}</span></div>
      <div className="cp-btn-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {WATCH_INTENTS.map((i) => (
          <button key={i.key} className={`cp-chip ${intent === i.key ? 'ai' : 'you'}`} onClick={() => setIntent(i.key)}>{i.label}</button>
        ))}
      </div>
      <p className="desc" style={{ marginTop: 10 }}>{WATCH_INTENTS.find((i) => i.key === intent)?.blurb}</p>
      {startersFor(intent, { term }).map((sug) => {
        const already = sources.some((s) => s.url === sug.url);
        return (
          <button key={sug.url} className="cp-option" disabled={busy || already} onClick={() => void add(sug.url, sug.label, sug.intent)}>
            <div><div className="ct">{sug.label}</div><div className="cs">{already ? 'Already watching' : sug.intent}</div></div>
          </button>
        );
      })}

      <div className="cp-note">
        Reddit, Hacker News, most job boards, Google Alerts, YouTube channels and Substacks all publish a feed with no
        key and no account. Paste the page you already read; it gets turned into one where that is possible.
        {home.watchSources.length === 0 ? ' Nothing here yet means nothing arrives from outside, and the call falls back to work you already had.' : ''}
      </div>
    </>
  );
}

/* ─── Money owed, either way ──────────────────────────────────────────────── */

/**
 * The sensor scoreMove's money factor was built for and never had.
 *
 * Only three jobs could ever set stake.value, two of them from a legacy sales
 * table this product does not use — so on a real account the money factor sat at
 * 1.0 on nearly every Move, and the day collapsed to outreach because nothing
 * else brought a number to the argument. One row here changes that.
 */
function MoneySheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currency = home.profile.finance?.currency || '$';
  const f = home.forecast;

  const add = async () => {
    const n = Number(amount);
    if (!counterparty.trim()) return setError('Who is it with?');
    if (!Number.isFinite(n) || n <= 0) return setError('How much?');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return setError('When is it due?');
    setBusy(true); setError(null);
    const ok = await actions.saveObligation({ direction, counterparty: counterparty.trim(), amount: n, due_on: due, currency });
    setBusy(false);
    if (ok) { setCounterparty(''); setAmount(''); setDue(''); } else setError('Could not save that');
  };

  return (
    <>
      <h3>Money owed, either way</h3>
      <p className="desc">
        Typed by hand — no bank, no parsing. One row per invoice or bill is what turns runway from a
        figure into a forecast, and it is the only thing on this app that can outrank the send queue
        on a number rather than on a hunch.
      </p>

      {f && f.months != null && (
        <div className="cp-kv">
          <span>Runway</span>
          <b>{f.changesTheAnswer
            ? `${f.months} mo on cash · ${f.forecastMonths} mo with what is owed`
            : `${f.months} months`}</b>
        </div>
      )}

      <div className="cp-btn-row" style={{ marginTop: 12 }}>
        <button className={`cp-btn ${direction === 'in' ? 'primary' : ''}`} onClick={() => setDirection('in')}>Owed to me</button>
        <button className={`cp-btn ${direction === 'out' ? 'primary' : ''}`} onClick={() => setDirection('out')}>I owe it</button>
      </div>
      <div className="cp-field"><label className="cp-label">{direction === 'in' ? 'Who owes you' : 'Who you owe'}</label>
        <input className="cp-input sm" value={counterparty} onChange={(e) => { setCounterparty(e.target.value); setError(null); }} placeholder="Sea Nymph Resort" /></div>
      <div className="cp-field"><label className="cp-label">Amount and due date</label>
        <div className="cp-input-row">
          <input className="cp-input sm" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2000" />
          <input className="cp-input sm" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      {error && <div className="cp-note">{error}</div>}
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy} onClick={() => void add()}>{busy ? 'Saving…' : 'Add it'}</button>
      </div>

      {home.obligations.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Open</span><span className="count">{home.obligations.length}</span></div>
          {home.obligations.map((o) => (
            <div key={o.id} className="cp-src">
              <div className="ct">{o.direction === 'in' ? '←' : '→'} {money(o.amount, o.currency || currency)} · {o.counterparty}</div>
              <div className="cs">Due {o.due_on}{o.note ? ` · ${o.note}` : ''}</div>
              <div className="acts">
                <button className="cp-connect" onClick={() => void actions.saveObligation({ id: o.id, status: 'settled' })}>
                  {o.direction === 'in' ? 'Paid' : 'Covered'}
                </button>
                <button className="cp-connect ghost" onClick={() => void actions.removeObligation(o.id)}>Remove</button>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="cp-note">
        Settled rows are kept, not deleted — what actually landed and when is the part that makes the
        next forecast worth believing.
      </div>
    </>
  );
}

/**
 * An artifact's text, clamped.
 *
 * Artifacts are the reason a piece of work beats advice, so they are never
 * summarised or truncated on the server. But a 90-word block dumped whole into
 * a card inside a sheet stops the card being scannable, and the eye skips the
 * section — which costs more than the words were worth. Three lines, and the
 * rest on a tap.
 */
function Artifact({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  // Roughly three lines at this width. Cheap and stable; measuring the box to
  // decide whether a toggle is needed costs a layout pass per artifact.
  const long = value.length > 190;
  if (!long) return <div className="cp-draft">{value}</div>;
  return (
    <>
      <div className={`cp-draft${open ? '' : ' clamp'}`}>{value}</div>
      <button className="cp-connect" onClick={() => setOpen((v) => !v)}>{open ? 'Show less' : 'Show all'}</button>
    </>
  );
}

/* ─── One mandate ─────────────────────────────────────────────────────────── */

/**
 * The plan, the log, and the button that grants authority.
 *
 * Approving happens here and not on the card on purpose. The plan is the thing
 * being authorised, and a one-tap grant from a card nobody expanded is how you
 * end up with a mandate whose steps its owner never read — which is exactly the
 * failure the whole layer is built to prevent.
 */
function CommissionSheet({ home, id, actions }: { home: HomeData; id: string; actions: Actions }) {
  const thread = home.commissions.find((t) => t.commission.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  // Which close is being made, or null while the buttons are still just buttons.
  // Closing is a two-step act now: the second step is the only moment this app
  // ever gets to ask what a piece of work was actually worth, and it is also the
  // cheapest — the person is right there, it just ended, and they know.
  const [closing, setClosing] = useState<'done' | 'stopped' | null>(null);
  const [worth, setWorth] = useState<WorthKind | null>(null);
  const [worthAmount, setWorthAmount] = useState('');
  const [worthNote, setWorthNote] = useState('');
  // In an effect, keyed on the id. The first version did this in the render body
  // behind a ref — and CopilotApp keeps the last sheet MOUNTED after it closes
  // (sheet = top ?? lastSheet.current), so the ref survived the close and
  // reopening the same commission never marked it read again: report.fresh grew
  // forever and the card wore the permanent badge the whole thing exists to
  // prevent. A render-body POST also fires on renders React throws away.
  useEffect(() => {
    void actions.commissionAction(id, 'seen');
    // actions is rebuilt every render; the commission id is what identifies a
    // distinct read, and re-running on every keystroke is not one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!thread) return <><h3>Commission</h3><p className="desc">This one is gone.</p></>;
  const c = thread.commission;
  const meta = AUTHORITY[c.authority];
  const goal = home.goals.find((g) => g.id === c.goal_id);
  // Shown beside the amount field so nobody has to guess which currency a bare
  // number is in. Empty when there is no burn and no currency goal on file, and
  // then the field simply does not name one rather than assuming dollars.
  const currency = home.profile.finance?.currency || home.goals.find((g) => g.metric === 'currency')?.unit || '';
  // What it is actually waiting for. `blocked` covers two opposite states: a
  // question only this person can answer, and a worker that fell over. They
  // want opposite things — a reply and a retry — and rendering both under "Your
  // answer" produced a text box, with a placeholder about supplier quotes, over
  // the sentence "the web-search tool returned an internal request error".
  const waiting = blockedOn(c, thread.report);
  const ask = waiting === 'you' ? thread.report.yours[0] : null;
  const fault = waiting === 'worker' ? thread.report.stopped[0] : null;
  // Rendered beside the field that answers it, and therefore left out of the log
  // below — the same sentence in two places is what this screen keeps deleting.
  const olderAsks = ask ? thread.report.yours.slice(1) : thread.report.yours;
  const olderFaults = fault ? thread.report.stopped.slice(1) : thread.report.stopped;

  // Unblock, then hand it straight back. A stopped job is not in dueCommissions,
  // so "run it now" alone would report nothing to do — the retry has to clear
  // the gate first. One tap, because a transient 500 should cost one tap.
  const retry = async () => {
    setBusy(true); setError(null);
    const r = await actions.commissionAction(id, 'unblock');
    if (!r.ok) { setBusy(false); return setError(r.error ?? 'Could not restart it'); }
    const run = await actions.runCommissionsNow();
    setBusy(false);
    if (!run.ok) setError(run.error ?? 'Restarted, but it could not be handed over just now');
  };

  const act = async (action: 'approve' | 'unblock' | 'stop' | 'done', answer?: string) => {
    setBusy(true); setError(null);
    const r = await actions.commissionAction(id, action, undefined, answer);
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not do that');
    if (action === 'unblock') setAnswer('');
    if (action === 'stop' || action === 'done') actions.closeSheet();
  };

  // Close, with or without a verdict. `skip` is a real path and not a courtesy:
  // a required answer here would be given by whichever button is nearest the
  // thumb, and a ledger of taps looks like evidence while being worse than an
  // empty one.
  const close = async (skip = false) => {
    if (!closing) return;
    setBusy(true); setError(null);
    const amount = Number(worthAmount.replace(/[^\d.]/g, ''));
    const r = await actions.commissionAction(
      id, closing === 'done' ? 'done' : 'stop',
      skip || !worth ? undefined : {
        worth,
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
        note: worthNote.trim() || null,
      },
    );
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not close it');
    // The mandate closed either way, so the sheet goes — but a verdict that did
    // not reach the ledger has to be said out loud rather than dissolve into a
    // success toast. The note stays on screen and the sheet holds.
    if (r.note) return setError(r.note);
    actions.closeSheet();
  };

  return (
    <>
      <h3>{c.objective}</h3>
      <p className="desc">
        {/* The reason is the user's own sentence and they rarely end it with a
            stop, so the goal clause ran straight on: "…nothing is in the
            pipeline It is meant to move Monthly revenue."

            And an empty `why` is an optional field nobody filled in, not a
            failing. It used to read "No reason recorded for this one", which is
            the app tutting at somebody for skipping something it called
            optional. */}
        {c.why && <>{/[.!?]$/.test(c.why) ? c.why : `${c.why}.`} </>}
        {goal ? <>Meant to move <b>{goal.title}</b>.</> : !c.why && <>No goal attached to this one.</>}
      </p>

      {/* What is being authorised, as one block rather than four grey lines. This
          is the thing the user is actually saying yes to. */}
      <div className="cp-grant">
        <div className="t">{meta.label} · up to {c.budget_minutes} min</div>
        <div className="d">{meta.blurb}</div>
        {/* Why it will not act by itself, in the same words every time. A
            capability the app hedges about is one nobody can plan around. */}
        {meta.gate && <div className="gate">{meta.gate}</div>}
        {/* An idle contractor and an absent one look identical from the card,
            and only one of them is worth waiting for. */}
        {!home.workerConnected && (
          <div className="gate">No worker is connected to this deployment, so nothing will pick this up. Set <code>COPILOT_JOBS_URL</code>.</div>
        )}
      </div>

      {c.status === 'draft' && (
        <>
          <button className="cp-btn primary block" disabled={busy} onClick={() => void act('approve')}>
            {busy ? 'Granting…' : 'Approve it'}
          </button>
          <p className="cp-help">Nothing happens until you do. It runs with the next nightly pass.</p>
        </>
      )}
      {error && <div className="cp-note">{error}</div>}

      {/* Where the answer goes, and it goes ABOVE the plan and the log.
          There was nowhere at all. The button said "I have answered" and the app
          wrote a status and nothing else, so the next brief went out identical
          to the last one and the worker asked the same question again — every
          night, forever. No commission that needed anything from its owner could
          finish. What is typed here rides out with the next dispatch.
          It sat under the log in the first version of this fix, which put the
          only reason somebody opens a blocked mandate a full screen below the
          fold on a phone. The browser said so; the JSX did not. */}
      {/* Gated on what it is WAITING for, not on having an event to show.
          loadCommissionEvents caps at 40 per job, so a busy one can push its
          own question out of the window — and gating on `ask` then rendered
          neither block, leaving a blocked job with no way to carry on at all.
          The question is shown when there is one; the way forward always is. */}
      {waiting === 'you' && (
        <>
          <div className="cp-section"><span className="lead">Your answer</span></div>
          {ask && <p className="desc">{ask.summary}</p>}
          <textarea
            id={`cp-answer-${id}`} className="cp-input sm" rows={3} maxLength={300}
            value={answer} onChange={(e) => { setAnswer(e.target.value); setError(null); }}
            placeholder="Pest control first — plumbing quotes take too long to chase."
          />
          {/* Weight follows intent. Both actions are legitimate, but only one of
              them closes the loop, and the empty one was the full-width solid
              blue — the strongest affordance on the screen given to the outcome
              you least want. It earns the emphasis once there is something to
              send. */}
          <button
            className={`cp-btn block ${answer.trim() ? 'primary' : 'ghost'}`}
            style={{ marginTop: 10 }} disabled={busy}
            onClick={() => void act('unblock', answer)}
          >
            {busy ? 'Sending…' : answer.trim() ? 'Send this and carry on' : 'Carry on without an answer'}
          </button>
          <p className="cp-help">
            {answer.trim()
              ? 'It goes out with the next run, so the question is not asked again.'
              : 'Not every question needs typing — but without one it has nothing new to go on and may ask again.'}
          </p>
        </>
      )}

      {/* A breakage, not an ask. It used to render under "Your answer" with a
          text box and a placeholder about supplier quotes, over a sentence
          reading "the web-search tool returned an internal request error" —
          asking somebody to reply to a 500. The only useful action is another
          go, so that is the only one offered. */}
      {fault && (
        <>
          <div className="cp-section"><span className="lead">It could not finish</span></div>
          <p className="desc">{fault.summary}</p>
          <button className="cp-btn primary block" disabled={busy} onClick={() => void retry()}>
            {busy ? 'Trying again…' : 'Try it again'}
          </button>
          <p className="cp-help">
            Nothing here is your fault and nothing has been lost — the plan and everything already
            found are kept. If it stops the same way twice, the worker itself needs looking at.
          </p>
        </>
      )}

      {c.plan.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">The plan</span><span className="count">{thread.report.progress.done} of {thread.report.progress.total} done</span></div>
          {c.plan.map((s) => (
            <div key={s.n} className={`cp-step ${s.state}`}>
              <span className="n">{s.n}</span>
              <div>
                <div className="d">{s.do}</div>
                {s.note && <div className="nt">{s.note}</div>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Everything that happened, newest first. Not a summary of it — the app
          telling you what it did in its own words is the one thing here that
          could be wrong without anybody noticing. */}
      {(olderAsks.length > 0 || olderFaults.length > 0 || thread.report.said.length > 0 || thread.report.did.length > 0) && (
        <>
          <div className="cp-section"><span className="lead">What happened</span></div>
          {/* Earlier asks, then what you told it, then what it did. `said` is the
              one kind of line here the worker did not write, so it says whose it
              is rather than sitting anonymously among the worker's own report. */}
          {[...olderAsks, ...olderFaults, ...thread.report.said, ...thread.report.did].map((e) => (
            <div key={e.id} className="cp-src">
              <div className="ct">{e.summary}</div>
              <div className="cs">{e.kind === 'answered' ? 'You · ' : ''}{relTime(e.at)}{e.step ? ` · step ${e.step}` : ''}</div>
              {e.artifact && (
                e.artifact.href
                  ? <a className="cp-btn sm" href={e.artifact.href} target="_blank" rel="noreferrer">{e.artifact.label}</a>
                  : <Artifact value={e.artifact.value} />
              )}
            </div>
          ))}
        </>
      )}

      {c.status === 'active' && (
        <>
          <button className="cp-btn primary block" disabled={busy} onClick={async () => {
            setBusy(true); setError(null);
            const r = await actions.runCommissionsNow();
            setBusy(false);
            // A toast is gone in four seconds and this is the sentence somebody
            // needs while they go and fix an environment variable.
            if (!r.ok) setError(r.error ?? 'Could not run it');
          }}>
            {busy ? 'Handing it over…' : 'Run it now'}
          </button>
          <p className="cp-help">
            Otherwise it waits for tonight. The worker may take a few minutes; whatever it finds turns up here.
          </p>
        </>
      )}

      {c.status !== 'draft' && c.status !== 'done' && c.status !== 'stopped' && !closing && (
        <div className="cp-btn-row" style={{ marginTop: 14 }}>
          <button className="cp-btn" disabled={busy} onClick={() => { setClosing('done'); setWorth(null); }}>It is finished</button>
          {/* Calling it off pre-selects `nothing`, because that is almost always
              what it means and the escape hatch should not cost thinking. The
              other three stay available: a mandate can produce something real and
              still be worth stopping. */}
          <button className="cp-btn ghost" disabled={busy} onClick={() => { setClosing('stopped'); setWorth('nothing'); }}>Call it off</button>
        </div>
      )}

      {/* The one question this app has never asked.
          A commission could run for a week, spend worker minutes, finish every
          step and close, and the only trace was free text in a column nothing
          read — so the ranker went on weighting this kind of work by a guess
          about a category, and "was any of it worth it" had nowhere to read from.
          Asked here because here is where it is cheap: the work just ended and
          the person deciding is already looking at what came of it. */}
      {closing && (
        <>
          <div className="cp-section" style={{ marginTop: 14 }}>
            <span className="lead">{closing === 'done' ? 'What was it worth?' : 'What was it worth up to now?'}</span>
          </div>
          <p className="desc">
            This is the only thing that changes what gets suggested next.
            {' '}<b>Nothing</b> is a real answer and the most useful one.
          </p>
          {WORTH_KINDS.map((k) => (
            <button key={k} className={`cp-option ${worth === k ? 'active' : ''}`} onClick={() => { setWorth(k); setError(null); }}>
              <div><div className="ct">{WORTH[k].label}</div><div className="cs">{WORTH[k].sub}</div></div>
            </button>
          ))}

          {/* Optional, never required. Somebody who knows it made money but not
              how much would otherwise either abandon the question or type a
              figure — and a typed figure is the invented number invariant 2
              exists to keep out of this database. */}
          {worth && WORTH[worth].amount === 'optional' && (
            <input
              className="cp-input sm" style={{ marginTop: 10 }} inputMode="decimal"
              value={worthAmount} onChange={(e) => setWorthAmount(e.target.value)}
              // Short enough to fit the field at 390px. The long version
              // ("…leave blank if you do not") was clipped mid-word in the
              // browser, which reads as a broken input rather than an optional
              // one — the opposite of what it was there to say. The button
              // below stays enabled without a figure, which says it better.
              placeholder={`How much, if you know${currency ? ` (${currency})` : ''}`}
            />
          )}
          {worth && (
            <input
              className="cp-input sm" style={{ marginTop: 10 }} maxLength={WORTH_NOTE_MAX}
              value={worthNote} onChange={(e) => setWorthNote(e.target.value)}
              placeholder={worth === 'nothing' ? 'What was missing?' : 'What came of it?'}
            />
          )}

          <button
            className={`cp-btn block ${worth ? 'primary' : 'ghost'}`} style={{ marginTop: 12 }}
            disabled={busy || !worth} onClick={() => void close()}
          >
            {busy ? 'Closing…' : closing === 'done' ? 'Finish it' : 'Call it off'}
          </button>
          <div className="cp-btn-row" style={{ marginTop: 8 }}>
            <button className="cp-btn ghost" disabled={busy} onClick={() => void close(true)}>Close without saying</button>
            <button className="cp-btn ghost" disabled={busy} onClick={() => { setClosing(null); setWorth(null); setError(null); }}>Back</button>
          </div>
        </>
      )}
      {c.outcome && <div className="cp-note">{c.outcome}</div>}
    </>
  );
}

/* ─── Questions ───────────────────────────────────────────────────────────── */

/**
 * Five questions about your own rows, and one escape hatch.
 *
 * The app writes constantly and could be asked nothing. Everything on every other
 * screen is a decision it made or a record it rendered; the thing somebody
 * actually says out loud after a fortnight — "which of these segments ever
 * replies?" — had nowhere to go, while the answer sat in the database.
 *
 * A fixed list rather than a text box, and lib/copilot/ask.ts argues it at length.
 * The short version: a typed question has to be answered by a model, a model
 * counting rows will produce a plausible figure, and nobody can tell which time it
 * is wrong. Every answer here is arithmetic.
 *
 * The handoff at the bottom is the other half of the same honesty. These five are
 * what the app can answer by counting; for everything else it hands you the whole
 * record and gets out of the way.
 */
function AskSheet({ actions }: { actions: Actions }) {
  const [answers, setAnswers] = useState<AskAnswer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const r = await actions.askRows();
      if (!live) return;
      if (!r.ok) return setError(r.error ?? 'Could not count that');
      setAnswers(r.answers ?? []);
      // The first question opens itself. A screen of five collapsed rows makes
      // somebody tap before they know whether any of it is worth reading.
      setOpen(r.answers?.[0]?.id ?? null);
    })();
    return () => { live = false; };
    // actions is rebuilt every render and this is a one-shot load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    setCopying(true); setCopied(null); setError(null);
    const r = await actions.handoff();
    if (!r.ok || !r.text) { setCopying(false); return setError(r.error ?? 'Could not gather your context'); }
    try {
      await navigator.clipboard.writeText(r.text);
      setCopied(`${r.chars?.toLocaleString() ?? r.text.length.toLocaleString()} characters copied. Paste it into anything.`);
    } catch {
      // Clipboard access is refused outright in some embedded browsers, and a
      // button that silently does nothing is the worst outcome — the user pastes
      // stale clipboard content into a model and blames the answer.
      setError('This browser would not let the page write to the clipboard. Open the app in Safari or Chrome directly and try again.');
    }
    setCopying(false);
  };

  return (
    <>
      <h3>Ask your own record</h3>
      <p className="desc">
        Every answer here is counted from rows you made. Nothing is estimated, so nothing can be
        confidently wrong.
      </p>

      {error && <div className="cp-note">{error}</div>}
      {!answers && !error && <p className="desc">Counting…</p>}

      {answers?.map((a) => (
        <div key={a.id}>
          <button className={`cp-option ${open === a.id ? 'active' : ''}`} onClick={() => setOpen(open === a.id ? null : a.id)}>
            <div><div className="ct">{a.q}</div><div className="cs">{a.headline}</div></div>
          </button>
          {open === a.id && (
            <div className="cp-list" style={{ marginTop: 8 }}>
              {a.rows.map((r, n) => (
                <div key={`${a.id}-${n}`} className="cp-ctx">
                  <div><div className="l">{r.label}</div>{r.note && <div className="s">{r.note}</div>}</div>
                  <span className="cp-connect ghost">{r.value}</span>
                </div>
              ))}
              {/* Never an empty card. Three bugs in this codebase shared the shape
                  of a component failing, the failure being swallowed, and the
                  screen reporting calm — a blank answer here would be that
                  shape in the one feature whose job is to tell the truth. */}
              {a.thin && <div className="cp-note">{a.thin}</div>}
            </div>
          )}
        </div>
      ))}

      <div className="cp-section" style={{ marginTop: 16 }}><span className="lead">Anything else</span></div>
      <p className="desc">
        Those five are what this app can answer by counting. For everything else, take the whole
        record and ask something that can actually reason — your working file, your funnel, every
        call it made and what you did about it, what you have stood down, what is running.
      </p>
      <button className="cp-btn primary block" disabled={copying} onClick={() => void copy()}>
        {copying ? 'Gathering…' : 'Copy everything it knows'}
      </button>
      {copied && <div className="cp-note">{copied}</div>}
      <p className="cp-help">
        Your rows are yours. If a general model does better with all of this than this app does
        without it, that is worth knowing — and it is the reason this button exists.
      </p>
    </>
  );
}

/* ─── The working file ────────────────────────────────────────────────────── */

/**
 * What the app knows about this business, and what it is waiting to be told.
 *
 * Proposals sit at the top and are the point of the screen. Everything below is
 * a text field somebody has to be bothered to fill in, and nobody fills in a
 * form about their own business for an app. A reading the app computed from
 * their rows, shown with the count behind it and answerable with one tap, is
 * how the file actually gets written — the user corrects rather than composes.
 */
function WorkingSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const entries = home.working ?? [];
  const progress = home.workingProgress ?? { filled: 0, total: SECTIONS.length, proposals: 0 };
  const proposals = entries.filter((e) => e.status === 'proposed');
  const [adding, setAdding] = useState<WorkingSection | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (section: WorkingSection) => {
    if (!draft.trim()) return;
    setBusy(true); setError(null);
    const r = await actions.saveWorking({ section, body: draft.trim() });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not save that');
    setDraft(''); setAdding(null);
  };

  return (
    <>
      <h3>What this app knows about your work</h3>
      {/* It used to claim "every draft" as well. Openers are built by
          openerTemplate from the offer's five strings and have never read this
          file, so one of the three destinations was not true — and a feature
          whose whole argument is that its numbers are traceable cannot be the
          one overstating itself. Research became true the moment workingBrief
          was added to the commission payload; drafts are still owed. */}
      <p className="desc">
        Your daily read, every feed it judges, and anything you commission are written from here.
        Five lines about what you sell is a headline; this is the business.
      </p>

      {proposals.length > 0 && (
        <>
          <div className="cp-section">
            <span className="lead">It noticed</span>
            <span className="count">{proposals.length} waiting</span>
          </div>
          <p className="desc" style={{ marginTop: -6 }}>
            Counted from your own rows. Nothing here reaches a draft until you say it is right.
          </p>
          {proposals.map((e) => (
            <div key={e.id} className="cp-src">
              <div className="ct">{e.body}</div>
              {/* The count is the whole reason this is allowed to be stated at
                  all. A reading without it would be the app forming a view about
                  somebody's business, which is the one thing it must not do. */}
              <div className="cs">{SECTION[e.section].label}{e.evidence ? ` · ${e.evidence}` : ''}</div>
              <div className="acts">
                <button className="cp-connect" disabled={busy} onClick={() => void actions.settleWorking(e.id, 'live')}>That is right</button>
                <button className="cp-connect ghost" disabled={busy} onClick={() => void actions.settleWorking(e.id, 'declined')}>No</button>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="cp-section">
        <span className="lead">The file</span>
        <span className="count">{progress.filled} of {progress.total} filled in</span>
      </div>
      {error && <div className="cp-note">{error}</div>}

      {SECTIONS.map((section) => {
        const meta = SECTION[section];
        const rows = entries.filter((e) => e.section === section && e.status === 'live');
        return (
          <div key={section} className="cp-work">
            <div className="hd">{meta.label}</div>
            <div className="bl">{meta.blurb}</div>
            {rows.map((e) => (
              <div key={e.id} className="ln">
                <span className="tx">{e.body}</span>
                {e.source === 'observed' && e.evidence && <span className="ct-ev">{e.evidence}</span>}
                <button className="x" aria-label="Remove" onClick={() => void actions.removeWorking(e.id)}>×</button>
              </div>
            ))}
            {adding === section ? (
              <>
                <textarea className="cp-input sm" autoFocus rows={3} value={draft} maxLength={BODY_MAX}
                  onChange={(e) => { setDraft(e.target.value); setError(null); }} placeholder={meta.placeholder} />
                <div className="cp-btn-row" style={{ marginTop: 8 }}>
                  <button className="cp-btn primary" disabled={busy || !draft.trim()} onClick={() => void add(section)}>Add</button>
                  <button className="cp-btn ghost" disabled={busy} onClick={() => { setAdding(null); setDraft(''); }}>Cancel</button>
                </div>
              </>
            ) : (
              <button className="cp-connect" onClick={() => { setAdding(section); setDraft(''); }}>
                {rows.length ? 'Add another' : 'Write it'}
              </button>
            )}
            {/* What changes when it is filled in. A form that does not say why
                it wants something gets abandoned, and this one is long. */}
            {!rows.length && <div className="wh">{meta.changes}</div>}
          </div>
        );
      })}
    </>
  );
}
