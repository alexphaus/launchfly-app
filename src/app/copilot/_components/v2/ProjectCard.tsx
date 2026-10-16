'use client';
// Work handed over, as Proof shows it: the box to hand something over, one
// project small enough that three fit on a screen, and the agents as one line.
// They were Work's; Proof keeps them under Projects and Agents, and a bet shows
// the projects tied to it on its own card (ProofTab.tsx).
import { useState } from 'react';
import { suggestedAsks, type LinkMove } from '@/lib/copilot/business';
import { MAX_ACTIVE_COMMISSIONS, OBJECTIVE_MAX, blockedOn, commissionChip, lapsedOn, refusal } from '@/lib/copilot/commission';
import { jobKindOf, verdictLine } from '@/lib/copilot/contract';
import { dayWords } from '@/lib/copilot/lab';
import { takerOf } from '@/lib/copilot/workers';
import { assetAskLine, assetAsked, assetToRevise } from '@/lib/copilot/assets';
import { offerIsEmpty } from '@/lib/copilot/offer';
import { secondPerson } from '@/lib/copilot/you';
import type { CommissionThread, HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import type { Derived } from './derive';
import { MoveNote, type Brief } from './MoveKit';

/**
 * Build with Claude, turned into the way in: one box for anything you would
 * otherwise do yourself. Handed over, it is a project your agent runs once you
 * approve it; copied, it is the first line of everything the app knows, for a
 * chat. The chips are the chain's own suggestions, the weak link's first, and a
 * tap fills the box rather than sending — it is still yours to edit.
 */
export function Composer({ home, d, actions, brief, full }: { home: HomeData; d: Derived; actions: Actions; brief: Brief; full: boolean }) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<LinkMove | null>(null);
  const [busy, setBusy] = useState<'hand' | 'copy' | null>(null);
  const [note, setNote] = useState<{ text: string; bad: boolean; claude: boolean } | null>(null);
  const chain = d.proof.chain;
  const asks = suggestedAsks(chain);
  const why = picked ? chain.links.find((l) => l.moves.some((m) => m.key === picked.key))?.why : undefined;

  const handOver = async () => {
    const objective = text.trim();
    if (!objective) return;
    // Said before the tap rather than cut by the server: a project's objective
    // has a limit and a chat does not.
    if (objective.length > OBJECTIVE_MAX) return setNote({ text: `A project's brief is ${OBJECTIVE_MAX} characters at most — shorten it, or copy it for Claude.`, bad: true, claude: false });
    setBusy('hand'); setNote(null);
    const r = await actions.createCommission({ objective, why: why?.slice(0, 300), authority: 'read' });
    setBusy(null);
    if (!r.ok) return setNote({ text: r.error ?? 'Could not hand that over', bad: true, claude: false });
    setText(''); setPicked(null);
    if (r.asset) actions.openSheet({ kind: 'asset', id: r.asset });
    else if (r.id) actions.openSheet({ kind: 'commission', id: r.id });
  };
  const copy = async () => {
    setBusy('copy'); setNote(null);
    const r = await brief.copy(text.trim() || null);
    setBusy(null);
    setNote({ text: r.note, bad: false, claude: r.ok });
  };

  return (
    <div className="cp-card cp2-bz-compose">
      <textarea
        // Grows with what is in it, so a suggestion is read whole before it is handed over.
        className="cp-input sm" rows={text ? Math.min(6, Math.max(3, Math.ceil(text.length / 34))) : 2} value={text}
        aria-label="What should it build, find or work out?"
        placeholder="What should it build, find or work out?"
        onChange={(e) => { setText(e.target.value); setNote(null); if (picked && e.target.value !== picked.ask) setPicked(null); }}
      />
      {/* Who would take it, said while it is typed: writing stays in the app,
          research goes to hands that read the web (contract.ts jobKindOf). */}
      {text.trim().length > 8 && home.workers && <p className="cp-help cp2-bz-who">{whoTakes(home, text)}</p>}
      {asks.length > 0 && (
        <div className="cp-chips">
          {asks.map((m) => (
            <button key={m.key} className={`cp-fchip ${picked?.key === m.key ? 'active' : ''}`}
              onClick={() => { setText(m.ask ?? m.label); setPicked(m); setNote(null); }}>{m.label}</button>
          ))}
        </div>
      )}
      <div className="cp-btn-row">
        <button className={`cp-btn ${home.workerConnected ? 'primary' : ''}`} disabled={!text.trim() || busy !== null || full} onClick={() => void handOver()}>
          {busy === 'hand' ? 'Writing it…' : 'Hand it over'}
        </button>
        <button className={`cp-btn ${home.workerConnected ? '' : 'primary'}`} disabled={busy !== null} onClick={() => void copy()}>
          {busy === 'copy' ? 'Gathering…' : 'Copy for Claude'}
        </button>
      </div>
      {note && <MoveNote note={note} />}
      {/* Said before the tap, not after it: three projects is the cap the server keeps. */}
      {full && !note && <p className="cp-help">{MAX_ACTIVE_COMMISSIONS} projects are on the go. Finish or stop one to hand over another.</p>}
      {!home.workerConnected && !full && !note && (
        <p className="cp-help">No worker is connected to this server, so a project you hand over is written down but nothing picks it up. Copy it for Claude instead, or connect one: the Claude agent, <code>COPILOT_JOBS_URL</code>, or a model for writing.</p>
      )}
    </div>
  );
}

/** The composer's line: what kind of job this reads as, and who would take it. */
function whoTakes(home: HomeData, text: string): string {
  // An asset asked for by name is drafted as one, not handed over (assets.ts assetAsked): said before the tap.
  const asset = home.ai && !offerIsEmpty(home.profile.offer) ? assetAsked(text) : null;
  if (asset) return assetAskLine(asset, !!assetToRevise(asset, home.assets?.assets ?? [], home.page?.live?.asset ?? null));
  const job = jobKindOf(text).kind;
  const taker = takerOf(home.workers ?? [], job, 'read');
  if (!taker) return job === 'write' ? 'Reads as writing — nothing here writes it yet: the app needs a model.' : 'Reads as research — nothing here takes research yet.';
  if (taker.agent === 'writer') return 'Reads as writing: the app writes it itself, in your words.';
  return `Reads as ${job === 'write' ? 'writing' : 'research'}: it goes to ${taker.name}.`;
}

/**
 * One project, small enough that three fit on a screen. The card used to be one
 * big button, which meant a question could only be answered by opening the
 * project, scrolling past its plan and typing there — so the commonest thing a
 * project wants, an answer, cost the most taps. Now the question has a box on
 * the card, and a breakage its retry; everything else is one tap into the sheet.
 */
export function Project({ thread, actions, today, name }: { thread: CommissionThread; actions: Actions; today?: string; name?: string | null }) {
  // A worker's words, to the person (you.ts): "so Alex can move" read on Alex's phone.
  const you = (t: string) => secondPerson(t, name);
  const c = thread.commission;
  const r = thread.report;
  // The day it was for has passed (commission.ts lapsedOn): said instead of the
  // question or the retry, with Stop, and nothing asked of the person. Answering
  // stays one tap away, in the project itself.
  const lapsed = today ? lapsedOn(c, today) : null;
  const chip = lapsed ? { label: 'Its day has passed', tone: 'stopped' as const } : commissionChip(c, r);
  const waiting = lapsed ? null : blockedOn(c, r);
  const ask = waiting === 'you' ? r.yours[0] ?? null : null;
  const refused = waiting === 'worker' ? refusal(r) : null;
  const fault = waiting === 'worker' && !refused ? r.stopped[0] ?? null : null;
  const last = r.did[0] ?? null;
  // A call through the person's own account waiting for their OK: answered with
  // an OK or a no, never typed — the call is already written out. It takes the
  // card's one slot over an ordinary question, which the sheet still shows, and
  // its words are its own question's, matched by id.
  const call = !lapsed && c.status === 'blocked' ? thread.work?.asks[0] ?? null : null;
  const callEvent = call ? r.yours.find((e) => e.id === call.event) ?? null : null;
  // The app's own check of a done it would not take (contract.ts verdictOf).
  const sentBack = r.check && !r.check.passed ? r.check : null;
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = () => actions.openSheet({ kind: 'commission', id: c.id });

  const send = async () => {
    if (!answer.trim()) return;
    setBusy(true); setError(null);
    const res = await actions.commissionAction(c.id, 'unblock', undefined, answer.trim());
    setBusy(false);
    if (!res.ok) return setError(res.error ?? 'Could not send that');
    setAnswer('');
  };
  // Unblock, then hand it straight back — the sheet's retry, on the card. A
  // stopped job is not due, so running alone would report nothing to do.
  const retry = async () => {
    setBusy(true); setError(null);
    const res = await actions.commissionAction(c.id, 'unblock');
    if (!res.ok) { setBusy(false); return setError(res.error ?? 'Could not restart it'); }
    const run = await actions.runCommissionsNow();
    setBusy(false);
    if (!run.ok) setError(run.error ?? 'Restarted, but it could not be handed over just now');
  };
  const confirm = async (allow: boolean) => {
    setBusy(true); setError(null);
    const res = await actions.workAction(c.id, { action: 'confirm', allow, call: call?.call });
    setBusy(false);
    if (!res.ok) setError(res.error ?? 'Could not pass that on');
  };
  const stop = async () => {
    setBusy(true); setError(null);
    const res = await actions.commissionAction(c.id, 'stop');
    setBusy(false);
    if (!res.ok) setError(res.error ?? 'Could not stop it');
  };

  return (
    <div className={`cp2-bz-job ${chip.tone}`}>
      <button className="cp2-bz-job-head" onClick={open}>
        <span className="cp2-bz-job-top">
          <span className={`cp2-bz-chip ${chip.tone}`}>{c.status === 'draft' && !lapsed ? 'Waiting for your OK' : chip.label}</span>
          {r.progress.total > 0 && c.status !== 'draft' && <span className="cp2-bz-job-n">{r.progress.done} of {r.progress.total} done</span>}
          {r.fresh > 0 && <span className="cp2-bz-job-new">{r.fresh} new</span>}
          {thread.work?.with && c.status !== 'done' && c.status !== 'stopped' && <span className="cp2-bz-job-who">{thread.work.with.name}</span>}
        </span>
        <span className="cp2-bz-job-ob">{c.objective}</span>
        {/* What it got done last — one line, enough to tell whether it is worth keeping. */}
        {c.status === 'active' && sentBack && <span className="cp2-bz-job-did bad">Sent back: {verdictLine(sentBack)}</span>}
        {!fault && !ask && last && !(c.status === 'active' && sentBack) && <span className="cp2-bz-job-did">{you(last.summary)}</span>}
        {c.status === 'active' && !last && <span className="cp2-bz-job-did quiet">Nothing back yet.</span>}
      </button>
      {call && (
        <div className="cp2-bz-ask">
          <p className="cp2-bz-ask-q">{callEvent?.summary ?? `OK to ${call.tool} from ${call.account ?? 'your account'}?`}</p>
          {callEvent?.artifact && <pre className="cp2-bz-call">{callEvent.artifact.value}</pre>}
          <div className="cp-btn-row">
            <button className="cp-btn primary sm" disabled={busy} onClick={() => void confirm(true)}>{busy ? 'Sending' : 'OK, send it'}</button>
            <button className="cp-btn ghost sm" disabled={busy} onClick={() => void confirm(false)}>No</button>
          </div>
        </div>
      )}
      {ask && !call && (
        <div className="cp2-bz-ask">
          <p className="cp2-bz-ask-q">{you(ask.summary)}</p>
          <div className="cp2-bz-ask-row">
            <input
              className="cp-input sm" value={answer} maxLength={300} placeholder="Your answer" aria-label={`Answer: ${ask.summary}`}
              onChange={(e) => { setAnswer(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
            />
            <button className="cp-btn primary sm" disabled={busy || !answer.trim()} onClick={() => void send()}>{busy ? 'Sending' : 'Send'}</button>
          </div>
        </div>
      )}
      {/* A breakage, said once and plainly, with the one useful thing: another go. Nobody can answer a 500. */}
      {refused && (
        <div className="cp2-bz-fault">
          <p>Its work did not pass the app&rsquo;s checks: {verdictLine(refused)}.</p>
          <button className="cp-btn sm" disabled={busy} onClick={() => void retry()}>{busy ? 'Trying again…' : 'Try again'}</button>
        </div>
      )}
      {fault && (
        <div className="cp2-bz-fault">
          <p>{you(fault.summary)}</p>
          <button className="cp-btn sm" disabled={busy} onClick={() => void retry()}>{busy ? 'Trying again…' : 'Try again'}</button>
        </div>
      )}
      {lapsed && (
        <div className="cp2-bz-pastday">
          <p>It was for {dayWords(lapsed)}, which has passed — so it is not counted as waiting on you, or as one of your {MAX_ACTIVE_COMMISSIONS}.</p>
          <button className="cp-btn sm" disabled={busy} onClick={() => void stop()}>{busy ? 'Stopping…' : 'Stop it'}</button>
        </div>
      )}
      {c.status === 'draft' && !lapsed && <button className="cp2-bz-job-go" onClick={open}>Read it and approve →</button>}
      {error && <p className="cp-help cp2-err">{error}</p>}
    </div>
  );
}
