'use client';
import { useRef, useState } from 'react';
import { computeRunwayMonths } from '@/lib/copilot/metrics';
import { OFFER_TASK_TITLE, offerIsEmpty } from '@/lib/copilot/offer';
import { CAPACITY_META, type Action, type Capacity, type Execution, type Goal, type GoalMetric, type HomeData, type Offer, type Opportunity } from '@/lib/copilot/types';
import { OUTCOME_LABEL, TYPE_LABEL, maskPhone, relTime, sourceLabel } from './format';
import type { Actions, SheetState } from './shared';
import YouView from './views/YouView';

export default function SheetContent({ sheet, home, actions, briefing = false }: { sheet: SheetState; home: HomeData; actions: Actions; briefing?: boolean }) {
  switch (sheet.kind) {
    case 'you': return <div className="cp-sheet-embed"><YouView home={home} actions={actions} briefing={briefing} /></div>;
    case 'capacity': return <CapacitySheet current={home.profile.capacity} onPick={actions.setCapacity} />;
    case 'action': return <ActionSheet home={home} id={sheet.id} actions={actions} />;
    case 'opp': return <OppSheet home={home} id={sheet.id} actions={actions} />;
    case 'lesson': return <LessonSheet home={home} id={sheet.id} actions={actions} />;
    case 'goal': return <GoalSheet goal={home.goals.find((g) => g.id === sheet.id)} actions={actions} />;
    case 'reset': return <ResetSheet actions={actions} />;
    case 'finance': return <FinanceSheet home={home} actions={actions} />;
    case 'targeting': return <TargetingSheet home={home} actions={actions} />;
    case 'account': return <AccountSheet home={home} actions={actions} />;
    case 'won': return <WonSheet home={home} oppId={sheet.oppId} actions={actions} />;
    case 'offer': return <OfferSheet home={home} actions={actions} />;
  }
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
  const found = home.plan.find((x) => x.id === id) ?? home.queue.find((x) => x.id === id) ?? home.nudges.find((x) => x.id === id);
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
        <span className="cp-score">{o.score}% match</span>
        <span className={`cp-badge ${o.source_kind === 'sourced' ? 'real' : 'inferred'}`}>{o.source_kind === 'sourced' ? `Real · ${sourceLabel(o.source)}` : 'Inferred'}</span>
        {o.last_outcome && <span className={`cp-badge ${o.last_outcome === 'won' ? 'won' : 'outcome'}`}>{OUTCOME_LABEL[o.last_outcome]}</span>}
      </div>
      <h3>{o.title}</h3>
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
      <p className="cp-help" style={{ marginTop: 8 }}>Fit {o.fit_score} · effort {o.effort}. Final score blends your goals, capacity and what has actually got replies.</p>

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

/* ─── Growth ─────────────────────────────────────────────────────────────── */

function LessonSheet({ home, id, actions }: { home: HomeData; id: string; actions: Actions }) {
  const l = home.lessons.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  if (!l) return <p className="desc">Gone.</p>;
  const done = async () => {
    setBusy(true);
    try {
      const saved = await actions.addNote(`Completed lesson: ${l.title}`, false);
      if (!saved) return;
      await actions.setGrowthStatus(l.id, 'done');
      actions.closeSheet();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="meta">{l.minutes ? <span className="cp-chip you">{l.minutes} min</span> : null}<span className="cp-chip ai">Worth learning</span></div>
      <h3>{l.title}</h3>
      {l.note && <p className="desc">{l.note}</p>}
      {l.url && <a className="cp-btn dark block" href={l.url} target="_blank" rel="noreferrer">Open</a>}
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy} onClick={done}>I learned this</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Later</button>
      </div>
    </>
  );
}

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
    </>
  );
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
      <p className="desc">These two fields drive real supply. Segments are searched on Google Maps and matched against your prospect pipeline.</p>
      <div className="cp-field"><label className="cp-label">Segments, comma separated</label><input className="cp-input sm" autoFocus value={segments} onChange={(e) => setSegments(e.target.value)} placeholder="pest control, aircon service, plumbing" /></div>
      <div className="cp-field"><label className="cp-label">Area</label><input className="cp-input sm" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Puerto Princesa, Palawan" /></div>
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
