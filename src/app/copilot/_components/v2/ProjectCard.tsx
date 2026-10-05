'use client';
// Work handed over, as Proof shows it: the box to hand something over, one
// project small enough that three fit on a screen, and the agents as one line.
// They were Work's; Proof keeps them under Projects and Agents, and a bet shows
// the projects tied to it on its own card (ProofTab.tsx).
import { useState } from 'react';
import { suggestedAsks, type LinkMove } from '@/lib/copilot/business';
import { MAX_ACTIVE_COMMISSIONS, OBJECTIVE_MAX, blockedOn, commissionChip } from '@/lib/copilot/commission';
import { AGENT_STATE_LABEL, type Agent } from '@/lib/copilot/machine';
import type { CommissionThread, HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import type { Derived } from './derive';
import { AgentGlyph, IconChevron } from './icons2';
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
    if (r.id) actions.openSheet({ kind: 'commission', id: r.id });
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
        <p className="cp-help">No worker is connected to this server, so a project you hand over is written down but nothing picks it up. Copy it for Claude instead, or set <code>COPILOT_JOBS_URL</code>.</p>
      )}
    </div>
  );
}

/**
 * One project, small enough that three fit on a screen. The card used to be one
 * big button, which meant a question could only be answered by opening the
 * project, scrolling past its plan and typing there — so the commonest thing a
 * project wants, an answer, cost the most taps. Now the question has a box on
 * the card, and a breakage its retry; everything else is one tap into the sheet.
 */
export function Project({ thread, actions }: { thread: CommissionThread; actions: Actions }) {
  const c = thread.commission;
  const r = thread.report;
  const chip = commissionChip(c, r);
  const waiting = blockedOn(c, r);
  const ask = waiting === 'you' ? r.yours[0] ?? null : null;
  const fault = waiting === 'worker' ? r.stopped[0] ?? null : null;
  const last = r.did[0] ?? null;
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

  return (
    <div className={`cp2-bz-job ${chip.tone}`}>
      <button className="cp2-bz-job-head" onClick={open}>
        <span className="cp2-bz-job-top">
          <span className={`cp2-bz-chip ${chip.tone}`}>{c.status === 'draft' ? 'Waiting for your OK' : chip.label}</span>
          {r.progress.total > 0 && c.status !== 'draft' && <span className="cp2-bz-job-n">{r.progress.done} of {r.progress.total} done</span>}
          {r.fresh > 0 && <span className="cp2-bz-job-new">{r.fresh} new</span>}
        </span>
        <span className="cp2-bz-job-ob">{c.objective}</span>
        {/* What it got done last — one line, enough to tell whether it is worth keeping. */}
        {!fault && !ask && last && <span className="cp2-bz-job-did">{last.summary}</span>}
        {c.status === 'active' && !last && <span className="cp2-bz-job-did quiet">Nothing back yet.</span>}
      </button>
      {ask && (
        <div className="cp2-bz-ask">
          <p className="cp2-bz-ask-q">{ask.summary}</p>
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
      {fault && (
        <div className="cp2-bz-fault">
          <p>{fault.summary}</p>
          <button className="cp-btn sm" disabled={busy} onClick={() => void retry()}>{busy ? 'Trying again…' : 'Try again'}</button>
        </div>
      )}
      {c.status === 'draft' && <button className="cp2-bz-job-go" onClick={open}>Read it and approve →</button>}
      {error && <p className="cp-help cp2-err">{error}</p>}
    </div>
  );
}

/**
 * The team, as one line. Each agent's work is on the part of the business it
 * runs (the chain); what is left for a roster is whether each is well, and that
 * fits on a line — with every one that is not named on it. The rows fold under
 * it, the Planner's Run now among them.
 */
export function Agents({ agents, line, actions, briefing }: { agents: Agent[]; line: { line: string; trouble: number }; actions: Actions; briefing: boolean }) {
  const [open, setOpen] = useState(false);
  const go = (a: Agent) => {
    if (a.key === 'scout') actions.openSheet({ kind: 'targeting' });
    else if (a.key === 'watcher') actions.openSheet({ kind: 'watchlist' });
    else if (a.key === 'writer') actions.openSheet(a.state === 'setup' ? { kind: 'offer' } : { kind: 'queue' });
    else if (a.key === 'researcher') actions.openSheet({ kind: 'projects' });
  };
  return (
    <>
      <button className="cp2-row cp2-bz-team" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
        <span className="cp2-row-main">
          <span className="t">Agents</span>
          <span className={`s ${line.trouble ? 'cp2-bz-team-bad' : ''}`}>{line.line}</span>
        </span>
        <IconChevron />
      </button>
      {open && agents.map((a) => {
        const body = (
          <>
            <span className={`cp2-agent ${a.key}`}><AgentGlyph agent={a.key} /></span>
            <span className="cp2-row-main">
              <span className="cp2-agent-top">
                <span className="t">{a.name}</span>
                <span className={`cp2-state ${a.state}`}><i />{AGENT_STATE_LABEL[a.state]}</span>
              </span>
              <span className="s">{a.role}</span>
              <span className="cp2-agent-line">{a.line}</span>
            </span>
          </>
        );
        // The Planner is the one agent a tap cannot configure — it runs on the
        // nightly schedule — so its row carries the one thing you can do: run it now.
        return a.key === 'planner' ? (
          <div key={a.key} className="cp2-row">
            {body}
            <button className="cp-connect ghost" disabled={briefing} onClick={() => void actions.runBrief('manual')}>{briefing ? 'Running' : 'Run now'}</button>
          </div>
        ) : (
          <button key={a.key} className="cp2-row" onClick={() => go(a)}>{body}<IconChevron /></button>
        );
      })}
    </>
  );
}
