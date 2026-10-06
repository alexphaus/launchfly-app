'use client';
// What the money book keeps on the phone: moves not yet sent (the outbox), the
// last book drawn (so the tab opens on it rather than on "Opening…"), and a
// few remembered choices.
//
// The outbox is why "Log it" closes the sheet at once. A move is written here
// first, under an id the phone makes, and then sent; the server stores it
// under that id ('book:<id>', bookstore.ts addEntry), so a send that is retried
// — the answer lost on a jeepney, the app closed mid-send, two screens flushing
// the same queue — is still one row. A move is taken out of the outbox only
// when the server has said it has it. One the server refuses (a rate it does
// not have, a date out of range) stays with the reason beside it until the
// person removes it: never dropped, never retried into the same refusal.
//
// Local storage is this phone's only. Where it cannot be written (a private
// window, a full disk) the sheet waits for the server instead, as it did
// before, and says so when that fails.
import { useCallback, useEffect, useRef, useState } from 'react';

/** The currency the Money tab shows amounts in: an answer about money is said in the one the tab shows (AskSheet). */
export const BOOK_VIEW_KEY = 'cp2.book.view';

export const local = {
  get(k: string): string | null { try { return window.localStorage.getItem(k); } catch { return null; } },
  /** False when it could not be written: the caller decides whether that matters. */
  set(k: string, v: string | null): boolean {
    try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); return true; } catch { return false; }
  },
};

/* ─── The outbox ──────────────────────────────────────────────────────────── */

export interface Unsent {
  id: string;
  /** Exactly what is POSTed, `id` included. */
  body: Record<string, unknown>;
  /** What the screen said when it was logged: "Logged −₱130 · Coffee". */
  said: string;
  at: number;
  /** Why the last send failed, when one did. */
  error: string | null;
  /** The server said no: retrying sends the same no. The person removes it. */
  refused: boolean;
}

const outboxKey = (pid: string) => `cp2.book.outbox.${pid}`;

export function readOutbox(pid: string): Unsent[] {
  try {
    const raw = JSON.parse(local.get(outboxKey(pid)) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw as Unsent[]).filter((u) => u && typeof u.id === 'string' && u.body && typeof u.body === 'object') : [];
  } catch { return []; }
}

function writeOutbox(pid: string, list: Unsent[]): boolean {
  return local.set(outboxKey(pid), list.length ? JSON.stringify(list) : null);
}

/** An id for a move, made here so the server can tell a retry from a second coffee. */
export function newMoveId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const h = [...crypto.getRandomValues(new Uint8Array(16))].map((b, i) => (i === 6 ? (b & 0x0f) | 0x40 : i === 8 ? (b & 0x3f) | 0x80 : b).toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Sent = { ok: true; data: Record<string, unknown> } | { ok: false; refused: boolean; error: string };

/** One POST to the book, with the status kept: a 400 is a no, anything else is "not yet". */
export async function sendToBook(body: Record<string, unknown>): Promise<Sent> {
  try {
    const res = await fetch('/api/copilot/money/book', { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
    if (res.ok) return { ok: true, data };
    return { ok: false, refused: res.status === 400, error: data.error || `The server answered ${res.status}.` };
  } catch (e) {
    return { ok: false, refused: false, error: e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'No connection.' };
  }
}

/** How often a queue with something in it is tried again while the screen is open. */
const RETRY_MS = 20_000;

/**
 * The outbox for one account: `log` a move, and it is sent now and again until
 * the server has it. `extra` rides on every send (the month the tab is on, or
 * the shortcut's `reply: 'balance'`); `onSent` gets each answer.
 */
export function useOutbox(pid: string, opts: { extra: () => Record<string, unknown>; onSent: (data: Record<string, unknown>) => void; say: (m: string) => void }) {
  const [unsent, setUnsent] = useState<Unsent[]>([]);
  const [sending, setSending] = useState(false);
  const flushing = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setSending(true);
    try {
      for (const u of readOutbox(pid)) {
        if (u.refused) continue;
        const r = await sendToBook({ ...u.body, ...optsRef.current.extra() });
        const now = readOutbox(pid);
        if (r.ok) {
          writeOutbox(pid, now.filter((x) => x.id !== u.id));
          setUnsent(readOutbox(pid));
          optsRef.current.onSent(r.data);
          continue;
        }
        writeOutbox(pid, now.map((x) => (x.id === u.id ? { ...x, error: r.error, refused: r.refused } : x)));
        setUnsent(readOutbox(pid));
        // A refusal is this move's; the next one may go. No connection is everyone's: stop.
        if (r.refused) optsRef.current.say(`Not saved: ${r.error}`);
        else break;
      }
    } finally {
      flushing.current = false;
      setSending(false);
    }
  }, [pid]);

  // What an earlier visit left unsent goes now, and again whenever the phone
  // is back online, back on screen, or every little while until it has gone.
  useEffect(() => {
    setUnsent(readOutbox(pid));
    void flush();
    const again = () => { if (readOutbox(pid).some((u) => !u.refused)) void flush(); };
    const visible = () => { if (document.visibilityState === 'visible') again(); };
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(again, RETRY_MS);
    return () => {
      window.removeEventListener('online', again);
      document.removeEventListener('visibilitychange', visible);
      window.clearInterval(timer);
    };
  }, [pid, flush]);

  /**
   * A move logged. True when it is safe on this phone — the sheet can close and
   * the screen can say "Logged". Where the phone cannot keep it, the send is
   * waited for and its answer is the answer.
   */
  const log = useCallback(async (body: Record<string, unknown>, said: string): Promise<boolean> => {
    const id = newMoveId();
    const u: Unsent = { id, body: { ...body, action: 'add', id }, said, at: Date.now(), error: null, refused: false };
    if (writeOutbox(pid, [...readOutbox(pid), u])) {
      setUnsent(readOutbox(pid));
      optsRef.current.say(said);
      void flush();
      return true;
    }
    setSending(true);
    const r = await sendToBook({ ...u.body, ...optsRef.current.extra() });
    setSending(false);
    if (r.ok) { optsRef.current.onSent(r.data); optsRef.current.say(said); return true; }
    optsRef.current.say(r.refused ? r.error : `Not saved — ${r.error} This phone cannot keep it to send later, so log it again when you are online.`);
    return false;
  }, [pid, flush]);

  const remove = useCallback((id: string) => {
    writeOutbox(pid, readOutbox(pid).filter((x) => x.id !== id));
    setUnsent(readOutbox(pid));
  }, [pid]);

  return { unsent, sending, log, flush, remove };
}

/* ─── The last book drawn ─────────────────────────────────────────────────── */

const cacheKey = (pid: string) => `cp2.book.cache.${pid}`;

/**
 * The book as it was last drawn for this month and view, so the tab opens on it
 * and the fresh one replaces it a moment later. Only the current month, the
 * one that opens: an old month is a tap away and not worth a copy.
 */
export function readCachedBook<T>(pid: string, view: string | null): T | null {
  try {
    const c = JSON.parse(local.get(cacheKey(pid)) ?? 'null') as { view: string | null; book: T } | null;
    return c && c.view === view ? c.book : null;
  } catch { return null; }
}

export function writeCachedBook(pid: string, view: string | null, book: unknown): void {
  local.set(cacheKey(pid), JSON.stringify({ view, book }));
}
