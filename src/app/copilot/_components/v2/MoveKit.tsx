'use client';
// The ways a tab acts on a move: a sheet of the person's own, a project for the
// agent to approve, or the whole record copied for a chat with Claude. Work's
// chain and Built, and the Lab's plays, all hand work over through these — so a
// move cannot behave one way on one tab and another way on the next, and the
// agent's cap is said the same everywhere it bites.
import { useRef, useState } from 'react';
import type { LinkMove } from '@/lib/copilot/business';
import { MAX_ACTIVE_COMMISSIONS, OBJECTIVE_MAX } from '@/lib/copilot/commission';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from '../shared';
import { IconChevron, IconExternal } from './icons2';

/**
 * Three projects on the go is the cap the server keeps. A move for the agent
 * then offers the chat instead, and says why, rather than failing on the tap.
 */
export const agentIsFull = (home: HomeData): boolean =>
  home.commissions.filter((t) => t.commission.status === 'draft' || t.commission.status === 'active' || t.commission.status === 'blocked').length >= MAX_ACTIVE_COMMISSIONS;

/* ─── The brief, for a chat ───────────────────────────────────────────────── */

const DEFAULT_ASK = 'Look at everything below and tell me the one thing to build or change next.';

/**
 * The handoff route's text with one task line on top: everything the app knows,
 * the working file with its two sources still distinct, and no contact details,
 * because the destination is a third party. Fetched once and kept, because
 * Safari refuses a clipboard write that is not inside the tap, and the first tap
 * spent itself fetching — so the second is a clean gesture, and is asked for.
 */
export interface Brief { copy(ask: string | null): Promise<{ ok: boolean; note: string }> }

export function useBrief(actions: Actions): Brief {
  const text = useRef<string | null>(null);
  return {
    async copy(ask) {
      if (!text.current) {
        const r = await actions.handoff();
        if (!r.ok || !r.text) return { ok: false, note: r.error ?? 'Could not gather what it knows' };
        text.current = r.text;
      }
      const body = `${ask?.trim() || DEFAULT_ASK}\n\nEverything my own app knows about my business is below. Use only what it says, and where it does not say, ask me rather than guess.\n\n${text.current}`;
      try {
        await navigator.clipboard.writeText(body);
        return { ok: true, note: `${body.length.toLocaleString()} characters copied. Open Claude and paste it in.` };
      } catch {
        return { ok: false, note: 'Your brief is ready. Tap once more to put it on your clipboard.' };
      }
    },
  };
}

/* ─── A move: a sheet of yours, a project to approve, or a chat ───────────── */

export const MOVE_SUB = {
  ai: 'Your agent does it — you approve the plan first',
  claude: 'Copies your whole record into a chat with Claude',
  full: `Your agent has ${MAX_ACTIVE_COMMISSIONS} projects on the go, so this copies it for Claude instead`,
} as const;

/** A move for the agent, when the agent cannot take more: the same ask, for a chat. */
export const orChat = (m: LinkMove, full: boolean): LinkMove => (m.by === 'ai' && full ? { ...m, by: 'claude' } : m);

/** One way to act on a move, shared by a part of the chain and a gap in Built, so the two cannot behave differently. */
export function useMove(actions: Actions, brief: Brief) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ key: string; text: string; bad: boolean; claude: boolean } | null>(null);
  const run = async (m: LinkMove, why?: string) => {
    setNote(null);
    if (m.by === 'you') {
      const go = m.go;
      if (!go) return;
      if ('sheet' in go) actions.openSheet({ kind: go.sheet });
      else if ('outreach' in go) actions.openSheet({ kind: 'outreach', stage: go.outreach });
      else actions.setTab(go.tab);
      return;
    }
    setBusy(m.key);
    if (m.by === 'ai') {
      // Written as a draft and opened on its approve button: one more tap, and
      // the person has read what is being authorised before anything runs.
      const r = await actions.createCommission({ objective: (m.ask ?? m.label).slice(0, OBJECTIVE_MAX), why: why?.slice(0, 300), authority: 'read' });
      setBusy(null);
      if (!r.ok) return setNote({ key: m.key, text: r.error ?? 'Could not hand that over', bad: true, claude: false });
      if (r.id) actions.openSheet({ kind: 'commission', id: r.id });
      return;
    }
    const r = await brief.copy(m.ask ?? null);
    setBusy(null);
    setNote({ key: m.key, text: r.note, bad: false, claude: r.ok });
  };
  return { busy, note, run };
}

export function MoveRow({ m, onRun, busy, rerouted }: { m: LinkMove; onRun: () => void; busy: boolean; rerouted: boolean }) {
  return (
    <button className={`cp2-bz-move ${m.by}`} disabled={busy} onClick={onRun}>
      <span className="cp2-bz-move-m">
        <b>{busy ? (m.by === 'ai' ? 'Writing it…' : 'Gathering…') : m.label}</b>
        {m.by !== 'you' && <span>{rerouted ? MOVE_SUB.full : MOVE_SUB[m.by]}</span>}
      </span>
      <IconChevron />
    </button>
  );
}

export function MoveNote({ note }: { note: { text: string; bad: boolean; claude: boolean } }) {
  return (
    <p className={`cp-help ${note.bad ? 'cp2-err' : ''}`}>
      {note.text}
      {note.claude && <> <a className="cp2-bz-open-claude" href="https://claude.ai/new" target="_blank" rel="noreferrer">Open Claude <IconExternal /></a></>}
    </p>
  );
}
