'use client';
// Money: the one screen of a budget app its owner actually opened — log a
// move, read the list under the balance with each day's spend on its header,
// glance at the calendar — and nothing else from that app. No charts, no
// analytics, no home screen: those went unopened there, and a screen of them
// here would be the "life OS" DIRECTION.md says no to. What earns the tab is
// that every row logged is a row the rest of the app reads at once: runway,
// money in and the plan move when a coffee is logged, not when a CSV is next
// exported.
//
// Two things that app could not do. Amounts can be shown in another currency
// while the book is still kept in its own — a peso book read in euros, each
// row at its own day's ECB rate (money/book.ts bookView) — and a file shared
// to Copilot from the phone's share sheet lands here and waits for a tap.
//
// Every figure comes off the server's BookView. Nothing here computes one.
//
// Fast because it waits on nothing it can avoid: it opens on the book it last
// drew (bookLocal.ts) while the fresh one loads, and a move logged goes into
// the phone's outbox and the sheet closes — the server is told behind it, and
// until it answers the move is listed under "Sending".
import { Component, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { BookPayload, EntryDefault } from '@/lib/copilot/money/bookstore';
import {
  bookDayLabel, bookMoney, bookRateLine, categoryIcon, parseRepeat, safeLine, safeWhy, shiftMonth, type BookDay, type BookLine, type CalendarCell,
} from '@/lib/copilot/money/book';
import { parseSpoken } from '@/lib/copilot/money/spoken';
import { get, post } from '../api';
import type { Actions } from '../shared';
import type { Arrival } from '../useCopilot';
import { BOOK_VIEW_KEY, local, readCachedBook, useOutbox, writeCachedBook, type Unsent } from './bookLocal';
import EntryPad from './EntryPad';
import { BookGlyph, IconRepeat } from './icons2';

/* ─── State ───────────────────────────────────────────────────────────────── */

/** `heard`: the words said to the header's mic, read into the sheet when it has the book's categories (money/spoken.ts). */
export type BookEntry = ({ kind: 'add'; heard?: string } | { kind: 'edit'; line: BookLine } | { kind: 'balance' }) & { n: number };
type EntryAsk = { kind: 'add'; heard?: string } | { kind: 'edit'; line: BookLine } | { kind: 'balance' };

const VIEW_KEY = BOOK_VIEW_KEY;
const ALT_KEY = 'cp2.book.alt';
const MODE_KEY = 'cp2.book.mode';

/**
 * The book's state, held by the shell rather than the tab, so switching tabs
 * does not throw it away, and the add sheet and its button can live outside
 * the scrolling content where the tab renders.
 */
export function useBook(pid: string, say: (m: string) => void, onMoved: () => void) {
  const [book, setBookState] = useState<BookPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState<BookEntry | null>(null);
  // The sheet body stays mounted while it slides out.
  const lastEntry = useRef<BookEntry | null>(null);
  if (entry) lastEntry.current = entry;
  const at = useRef<{ month: string | null; view: string | null; init: boolean }>({ month: null, view: null, init: false });
  // Which load is the latest: two months tapped through quickly answer out of
  // order, and the older answer must not draw over the newer month.
  const seq = useRef(0);

  const setBook = useCallback((b: BookPayload) => {
    setBookState(b);
    if (!at.current.month || at.current.month === b.today.slice(0, 7)) writeCachedBook(pid, at.current.view, b);
  }, [pid]);

  const load = useCallback(async (next: { month?: string | null; view?: string | null } = {}) => {
    if (!at.current.init) {
      at.current = { ...at.current, view: local.get(VIEW_KEY), init: true };
      // The book as it was last drawn, at once; the fresh one replaces it a moment later.
      const cached = readCachedBook<BookPayload>(pid, at.current.view);
      if (cached && !next.month) setBookState((b) => b ?? cached);
    }
    at.current = { ...at.current, ...next };
    const mine = ++seq.current;
    const q = new URLSearchParams();
    if (at.current.month) q.set('month', at.current.month);
    if (at.current.view) q.set('view', at.current.view);
    try {
      const r = await get<{ book: BookPayload }>(`/money/book?${q}`);
      if (mine !== seq.current) return;
      setBook(r.book);
      setError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e instanceof Error ? e.message : 'Could not open your book.');
    }
  }, [pid, setBook]);

  const outbox = useOutbox(pid, {
    extra: () => ({ month: at.current.month, view: at.current.view }),
    onSent: (data) => {
      if (data.book) { seq.current++; setBook(data.book as BookPayload); }
      onMoved();
    },
    say,
  });

  /** An edit, a delete, a balance: waited for, since the sheet shows what it changed. `said` is the toast when it worked. */
  const write = useCallback(async (body: Record<string, unknown>, said: string): Promise<boolean> => {
    setBusy(true);
    try {
      const r = await post<{ book: BookPayload; stopped?: boolean }>('/money/book', { ...body, month: at.current.month, view: at.current.view });
      seq.current++;
      setBook(r.book);
      onMoved();
      say(r.stopped ? `${said} The repeat stopped too.` : said);
      return true;
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not save that.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [onMoved, say, setBook]);

  /** The currency moves are typed in from now on. Undefined when it could not be kept — said, and the pad keeps the choice for this move. */
  const setEntryDefault = useCallback(async (code: string): Promise<EntryDefault | undefined> => {
    try {
      const r = await post<{ entry: EntryDefault }>('/money/book', { action: 'entry', currency: code });
      setBookState((b) => (b ? { ...b, entry: r.entry } : b));
      return r.entry;
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not keep that currency.');
      return undefined;
    }
  }, [say]);

  const setView = useCallback((v: string | null) => { local.set(VIEW_KEY, v); void load({ view: v }); }, [load]);
  const setMonth = useCallback((m: string) => { void load({ month: m }); }, [load]);
  const openEntry = useCallback((e: EntryAsk) => setEntry({ ...e, n: Date.now() }), []);
  const closeEntry = useCallback(() => setEntry(null), []);
  return {
    book, error, busy, load, write, setView, setMonth, asked: at.current.view, entry, shownEntry: entry ?? lastEntry.current, openEntry, closeEntry,
    outbox, setEntryDefault,
  };
}
export type Book = ReturnType<typeof useBook>;

/**
 * What the service worker kept of a share (public/sw.js), as files — left in the
 * cache until the person decides (spendShared), so a reload before the tap does
 * not lose them without a word (invariant 13).
 */
async function peekShared(): Promise<{ files: File[]; error: string | null }> {
  try {
    if (!('caches' in window)) return { files: [], error: 'This browser kept no shared file. Upload it on Bank statements instead.' };
    const cache = await caches.open('copilot-share');
    const files: File[] = [];
    for (const k of await cache.keys()) {
      const r = await cache.match(k);
      if (!r) continue;
      const blob = await r.blob();
      const name = decodeURIComponent(r.headers.get('x-file-name') || 'shared.csv');
      files.push(new File([blob], name, { type: blob.type || r.headers.get('content-type') || '' }));
    }
    return { files, error: files.length ? null : 'The shared file was not kept. Share it again, or upload it on Bank statements.' };
  } catch (e) {
    return { files: [], error: `The shared file could not be read: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Empties what a share kept, once the person has read it in or turned it away. */
async function spendShared(): Promise<void> {
  try {
    const cache = await caches.open('copilot-share');
    for (const k of await cache.keys()) await cache.delete(k);
  } catch { /* a stale entry is replaced by the next share (public/sw.js empties the cache first) */ }
}

const sizeWords = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/**
 * A shared file waits for a tap. While the worker is active any page can post a
 * form to the share target, and a file imported on arrival was a way for a web
 * page to write rows into the book. Now nothing is read until the person has seen
 * what is waiting and said so.
 */
function SharedFiles({ files, busy, onRead, onDiscard }: { files: File[]; busy: boolean; onRead: () => void; onDiscard: () => void }) {
  return (
    <div className="cp-card cp2-sharedfile" role="group" aria-label="Shared file">
      <h2 className="cp2-bk-h">{files.length === 1 ? 'A file was shared to Copilot' : `${files.length} files were shared to Copilot`}</h2>
      <ul className="cp2-sharedfile-list">
        {files.map((f, i) => <li key={i}>{f.name || 'shared'} <span>{sizeWords(f.size)}</span></li>)}
      </ul>
      <p className="cp-help">Nothing is read into your book until you say so. If you did not share this, discard it.</p>
      <div className="cp2-sharedfile-do">
        <button className="cp-btn primary" disabled={busy} onClick={onRead}>{busy ? 'Reading…' : files.length === 1 ? 'Read it into my book' : 'Read them into my book'}</button>
        <button className="cp-btn" disabled={busy} onClick={onDiscard}>Discard</button>
      </div>
    </div>
  );
}

/* ─── The tab ─────────────────────────────────────────────────────────────── */

export default function MoneyTab({ book, actions, say, arrival, clearArrival }: {
  book: Book; actions: Actions; say: (m: string) => void; arrival: Arrival | null; clearArrival: () => void;
}) {
  const { load } = book;
  useEffect(() => { void load(); }, [load]);

  // Opened from the share sheet or the Log money shortcut. Handled once, here,
  // since the shell cleaned the URL before this tab mounted.
  const took = useRef(false);
  const [held, setHeld] = useState<File[] | null>(null);
  const [reading, setReading] = useState(false);
  const readHeld = useCallback(async () => {
    if (!held) return;
    setReading(true);
    // One at a time: each says how it went, and the last word is the last file's.
    for (const f of held) await actions.uploadStatement(f);
    await spendShared();
    setHeld(null); setReading(false);
    await load();
  }, [held, actions, load]);
  const discardHeld = useCallback(async () => { await spendShared(); setHeld(null); say('Discarded. Nothing was read into your book.'); }, [say]);
  useEffect(() => {
    if (!arrival || took.current) return;
    took.current = true;
    clearArrival();
    if (arrival.add) book.openEntry({ kind: 'add' });
    const shared = arrival.shared;
    if (!shared) return;
    void (async () => {
      if (shared === 'error') say(arrival.why || 'The shared file could not be imported.');
      else if (shared === 'done') say(arrival.why || 'Read the shared file.');
      else if (shared === '0') say('That share had no file in it. Export the CSV and share the file itself.');
      else {
        const got = await peekShared();
        if (got.error) say(got.error);
        else setHeld(got.files);
        return;
      }
      await load();
    })();
  }, [arrival, clearArrival, book, actions, say, load]);

  const b = book.book;
  const body = !b
    ? book.error
      ? <div className="cp-card cp2-bk-msg"><div className="cp-error">{book.error}</div><button className="cp-btn" onClick={() => void load()}>Try again</button></div>
      : <div className="cp-note cp2-bk-wait">Opening your book…</div>
    : !b.ready
    ? <div className="cp-card cp2-bk-msg"><p>{b.notReady}</p></div>
    : !b.started
    ? (
      <div className="cp-card cp2-bk-msg">
        <h2 className="cp2-bk-h">Start your money book</h2>
        <p>Type what you have now, in the currency you spend in. Every move you log from here moves it, and runway reads it.</p>
        <BalanceForm b={b} book={book} first />
      </div>
    )
    : <Started b={b} book={book} actions={actions} say={say} />;
  return (
    <>
      {held && <SharedFiles files={held} busy={reading} onRead={() => void readHeld()} onDiscard={() => void discardHeld()} />}
      {body}
    </>
  );
}

/**
 * A crash in the tab stays in the tab: without this, one bad row took the
 * whole app down to a blank page. It says what broke and offers a reload —
 * the moves waiting in the outbox are on the phone and go after it.
 */
export class MoneyTabGuard extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { error: e instanceof Error ? e.message : String(e) }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="cp-card cp2-bk-msg">
        <h2 className="cp2-bk-h">The Money tab hit an error</h2>
        <p>{this.state.error}</p>
        <p className="cp-help">Nothing you logged is lost: it is on the server, or on this phone waiting to be sent.</p>
        <button className="cp-btn primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}

/** Moves on this phone the server has not confirmed: sending, or refused with the reason. */
export function UnsentMoves({ list, sending, onRetry, onRemove }: { list: Unsent[]; sending: boolean; onRetry: () => void; onRemove: (id: string) => void }) {
  if (!list.length) return null;
  const waiting = list.filter((u) => !u.refused);
  return (
    <>
      <div className="cp2-bk-dayhead">
        <span>{waiting.length && sending ? 'Sending' : 'Not saved yet'}</span>
        {waiting.length > 0 && !sending && <button className="cp2-bank-inline" onClick={onRetry}>Send now</button>}
      </div>
      <div className="cp-list cp2-bk-lines">
        {list.map((u) => (
          <div key={u.id} className={`cp2-bk-line cp2-bk-unsent${u.refused ? ' refused' : ''}`}>
            <span className={`cp2-bk-ico${u.body.kind === 'in' ? ' in' : ''}`} aria-hidden>
              <BookGlyph icon={categoryIcon(u.body.category as string | null, String(u.body.note ?? ''), u.body.kind === 'in' ? 1 : -1)} />
            </span>
            <span className="main">
              <span className="t">{u.said.replace(/^Logged /, '').replace(/\.$/, '')}</span>
              <span className="s">{u.refused ? u.error : u.error === 'No connection.' ? 'On this phone, waiting for a connection' : u.error ? `On this phone, not sent yet: ${u.error}` : 'On this phone, sending…'}</span>
            </span>
            {u.refused && <button className="cp-btn sm" onClick={() => onRemove(u.id)}>Remove</button>}
          </div>
        ))}
      </div>
    </>
  );
}

function Started({ b, book, actions, say }: { b: BookPayload; book: Book; actions: Actions; say: (m: string) => void }) {
  const [mode, setModeState] = useState<'list' | 'calendar'>('list');
  const [alt, setAltState] = useState<string>(b.main !== b.currency ? b.main : b.currency === 'EUR' ? 'USD' : 'EUR');
  useEffect(() => {
    if (local.get(MODE_KEY) === 'calendar') setModeState('calendar');
    const a = local.get(ALT_KEY);
    if (a && a !== b.currency) setAltState(a);
  }, [b.currency]);
  const setMode = (m: 'list' | 'calendar') => { setModeState(m); local.set(MODE_KEY, m); };
  const setAlt = (c: string) => { setAltState(c); local.set(ALT_KEY, c); book.setView(c); };

  const m = (n: number) => bookMoney(n, b.view);
  // What was asked for, not what is shown: with no rate the book shows its own and says why.
  const altOn = !!book.asked && book.asked !== b.currency;
  const choices = [...new Set([alt, b.main, 'EUR', 'USD', 'GBP', 'PHP'])].filter((c) => c !== b.currency);
  const rateLine = bookRateLine(b);
  const safeText = safeLine(b.safe, b.safeShown, b.view);
  // Why, in the book's own currency — the one the rows are in — and the rate when shown in another.
  const safeTold = b.safe && b.balance
    ? `${safeWhy(b.safe, b.balance.amount, b.currency)}${b.view !== b.currency && rateLine ? ` Shown in ${b.view}: ${rateLine}.` : ''}`
    : '';
  const onLine = (l: BookLine) => {
    if (l.book) book.openEntry({ kind: 'edit', line: l });
    else say(`From ${l.source ?? 'a statement'}. Its rows change when the statement does, on Bank statements.`);
  };

  return (
    <>
      <div className="cp-card cp2-bk-top">
        <div className="cp2-bk-toprow">
          <span className="cp2-bk-lbl">Balance</span>
          <div className="cp2-bk-seg" role="group" aria-label="Show amounts in">
            <button className={altOn ? '' : 'on'} aria-pressed={!altOn} onClick={() => book.setView(null)}>{b.currency}</button>
            {/* The other currency: tap to show it, tap again to pick another. */}
            {altOn
              ? <select className="on" value={alt} onChange={(e) => setAlt(e.target.value)} aria-label="Show amounts in">{choices.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              : <button aria-pressed={false} onClick={() => book.setView(alt)}>{alt}</button>}
          </div>
        </div>
        <button className="cp2-bk-bal" onClick={() => book.openEntry({ kind: 'balance' })} aria-label="Change your balance">
          {b.balance ? m(b.balance.shown) : '—'}
        </button>
        {/* What the balance allows today, in the currency shown; tapped, where it comes from. Before, this
            line said how to change the balance — the balance itself still does that when tapped. */}
        {safeText
          ? <button className={`cp2-bk-sub cp2-bk-safe${b.safe && (b.safe.broke || b.safe.left < 0) ? ' over' : ''}`} onClick={() => say(safeTold)}>{safeText}</button>
          : <span className="cp2-bk-sub">{b.balance && b.view !== b.currency ? `${bookMoney(b.balance.amount, b.currency)} logged · ${rateLine}` : 'Tap it to say it again'}</span>}
      </div>
      {b.notReady && <div className="cp-error cp2-bk-gap">{b.notReady}</div>}
      {b.missing && <div className="cp-note">{b.missing}</div>}

      <div className="cp2-bk-bar">
        <div className="cp2-bk-month">
          <button aria-label="Previous month" disabled={b.month <= b.first || book.busy} onClick={() => book.setMonth(shiftMonth(b.month, -1))}>‹</button>
          <b>{b.monthLabel}</b>
          <button aria-label="Next month" disabled={b.month >= b.last || book.busy} onClick={() => book.setMonth(shiftMonth(b.month, 1))}>›</button>
        </div>
        <div className="cp2-bk-seg" role="group" aria-label="View">
          <button className={mode === 'list' ? 'on' : ''} aria-pressed={mode === 'list'} onClick={() => setMode('list')}>List</button>
          <button className={mode === 'calendar' ? 'on' : ''} aria-pressed={mode === 'calendar'} onClick={() => setMode('calendar')}>Calendar</button>
        </div>
      </div>
      <p className="cp2-bk-totals">Spent <b>{m(b.totals.spent)}</b> · Came in <b>{m(b.totals.received)}</b></p>

      <UnsentMoves list={book.outbox.unsent} sending={book.outbox.sending} onRetry={() => void book.outbox.flush()} onRemove={book.outbox.remove} />
      {mode === 'list' ? (
        <>
          {b.pending.length > 0 && b.month === b.today.slice(0, 7) && (
            <>
              <div className="cp2-bk-dayhead"><span>Upcoming</span><span className="n">{b.pending.length}</span></div>
              <div className="cp-list cp2-bk-lines">{b.pending.map((l) => <Line key={l.id} l={l} b={b} when onTap={onLine} />)}</div>
            </>
          )}
          {b.days.length
            ? b.days.map((d) => <Day key={d.on} d={d} b={b} onTap={onLine} />)
            : <div className="cp-empty cp2-bk-empty">Nothing logged in {b.monthLabel}. Tap + to log the first move.</div>}
        </>
      ) : (
        <Calendar key={b.month} b={b} onTap={onLine} />
      )}

      {/* A copy that does not depend on this server: every row, as a file on the phone. */}
      {mode === 'list' && <a className="cp2-bk-export" href="/api/copilot/money/book/export" download>Download everything as CSV</a>}
      {/* Room to scroll the last line out from under the add button. */}
      <div className="cp2-bk-end" aria-hidden />
      {b.unlabelled > 0 && (
        <div className="cp-note">
          {b.unlabelled} row{b.unlabelled === 1 ? '' : 's'} from a file with no currency {b.unlabelled === 1 ? 'is' : 'are'} not in this book.{' '}
          <button className="cp2-bank-inline" onClick={() => actions.openSheet({ kind: 'bank' })}>Say which</button>
        </div>
      )}
    </>
  );
}

function Day({ d, b, onTap }: { d: BookDay; b: BookPayload; onTap: (l: BookLine) => void }) {
  return (
    <>
      <div className="cp2-bk-dayhead">
        <span>{d.label}</span>
        {/* What the day cost, on its header — the one number the old app would not show. */}
        <span className="n">
          {d.spent > 0 && <b>−{bookMoney(d.spent, b.view)}</b>}
          {d.received > 0 && <i>+{bookMoney(d.received, b.view)}</i>}
        </span>
      </div>
      <div className="cp-list cp2-bk-lines">{d.lines.map((l) => <Line key={l.id} l={l} b={b} onTap={onTap} />)}</div>
    </>
  );
}

function Line({ l, b, when, onTap }: { l: BookLine; b: BookPayload; when?: boolean; onTap: (l: BookLine) => void }) {
  const rule = parseRepeat(l.repeat);
  const sub = [
    when ? bookDayLabel(l.on, b.today) : null,
    l.sub,
    rule ? (rule.every === 'week' ? 'weekly' : 'monthly') : null,
    l.source ? `from ${l.source}` : null,
  ].filter(Boolean).join(' · ');
  // The other figure under the amount: the book's own when shown in another
  // currency, else what was typed when that was another — "₱790" under "€12".
  const second = b.view !== b.currency ? bookMoney(Math.abs(l.amount), b.currency)
    : l.entered ? bookMoney(Math.abs(l.entered.amount), l.entered.currency) : null;
  return (
    <button className={`cp2-bk-line${l.book ? '' : ' read'}`} onClick={() => onTap(l)}>
      <span className={`cp2-bk-ico${l.amount > 0 ? ' in' : ''}`} aria-hidden><BookGlyph icon={l.icon} /></span>
      <span className="main">
        <span className="t">{l.label}{rule && <IconRepeat />}</span>
        {sub && <span className="s">{sub}</span>}
      </span>
      <span className="amt">
        <b className={l.amount > 0 ? 'in' : ''}>{l.amount > 0 ? '+' : '−'}{bookMoney(Math.abs(l.shown), b.view)}</b>
        {second && <span className="s">{second}</span>}
      </span>
    </button>
  );
}

/* ─── Calendar ────────────────────────────────────────────────────────────── */

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** "510", "1.2k", "71k", "1.4M": four characters fit a seventh of a phone. */
function compact(n: number): string {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : a >= 1e4 ? `${Math.round(a / 1e3)}k` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}k` : `${Math.round(a)}`;
  return `${n < 0 ? '−' : ''}${s.replace('.0', '')}`;
}

function Calendar({ b, onTap }: { b: BookPayload; onTap: (l: BookLine) => void }) {
  const [show, setShow] = useState<'spent' | 'balance'>('spent');
  // This month opens on today, its moves already under the grid: the day you open the calendar for is usually this one.
  const [picked, setPicked] = useState<string | null>(b.month === b.today.slice(0, 7) ? b.today : null);
  const lead = b.calendar.length ? new Date(`${b.calendar[0].on}T00:00:00Z`).getUTCDay() : 0;
  const day = picked ? b.days.find((d) => d.on === picked) ?? null : null;
  const value = (c: CalendarCell) => (show === 'spent' ? (c.spent > 0 ? compact(c.spent) : '') : c.balance != null ? compact(c.balance) : '');
  return (
    <>
      <div className="cp-card cp2-bk-cal">
        <div className="cp2-bk-calhead">
          <span>{show === 'spent' ? `Spent · ${b.view}` : `Day-end balance · ${b.view}`}</span>
          <div className="cp2-bk-seg sm" role="group" aria-label="Calendar shows">
            <button className={show === 'spent' ? 'on' : ''} aria-pressed={show === 'spent'} onClick={() => setShow('spent')}>Spent</button>
            <button className={show === 'balance' ? 'on' : ''} aria-pressed={show === 'balance'} onClick={() => setShow('balance')}>Balance</button>
          </div>
        </div>
        <div className="cp2-bk-grid" role="grid" aria-label={b.monthLabel}>
          {WEEK.map((w, i) => <span key={i} className="wd" aria-hidden>{w}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`pad${i}`} className="pad" aria-hidden />)}
          {b.calendar.map((c) => (
            <button
              key={c.on}
              className={`cell${c.on === b.today ? ' today' : ''}${c.future ? ' future' : ''}${picked === c.on ? ' picked' : ''}`}
              onClick={() => setPicked(picked === c.on ? null : c.on)}
              aria-label={`${bookDayLabel(c.on, b.today)}: spent ${bookMoney(c.spent, b.view)}${c.balance != null ? `, balance ${bookMoney(c.balance, b.view)}` : ''}`}
            >
              {/* A dot for a day money came in: the number is the one the pill asked for. */}
              <span className="d">{c.day}{c.received > 0 && <i aria-hidden />}</span>
              <span className="v">{value(c)}</span>
            </button>
          ))}
        </div>
      </div>
      {picked && (day ? <Day d={day} b={b} onTap={onTap} /> : <div className="cp-note">Nothing logged on {bookDayLabel(picked, b.today)}.</div>)}
    </>
  );
}

/* ─── The sheets: log a move, say the balance ─────────────────────────────── */

/** The add button, outside the scrolling content so it stays under the thumb. */
/**
 * Whether the list is being read downward. The button sits over the right-hand
 * column, which on this tab is the amounts: on every phone it hid one row's
 * figure wherever the list stopped. Reading down, it steps aside; any move up,
 * or the top of the list, brings it back.
 */
function useReadingDown(scroller: RefObject<HTMLElement | null> | undefined): boolean {
  const [down, setDown] = useState(false);
  useEffect(() => {
    const el = scroller?.current;
    if (!el) return;
    let last = el.scrollTop;
    const onScroll = () => {
      const y = el.scrollTop;
      // A few pixels either way is a thumb resting, not a direction.
      if (Math.abs(y - last) < 6) return;
      setDown(y > last && y > 80);
      last = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scroller]);
  return down;
}

export function BookFab({ book, scroller }: { book: Book; scroller?: RefObject<HTMLElement | null> }) {
  const away = useReadingDown(scroller);
  if (!book.book?.ready || !book.book.started) return null;
  return (
    <button className={`cp2-bk-fab${away ? ' away' : ''}`} onClick={() => book.openEntry({ kind: 'add' })} aria-label="Log a move" tabIndex={away ? -1 : undefined}>+</button>
  );
}

export function BookSheet({ book }: { book: Book }) {
  const e = book.shownEntry;
  const b = book.book;
  if (!e) return null;
  // Opened before the book ever loaded on this phone — the shortcut, a first
  // visit, the mic from another tab. Said, not a blank sheet.
  if (!b) return <div className="cp-sheet-embed"><p className="desc">{book.error ?? 'Opening your book…'}</p></div>;
  // The mic is in the header on every tab, so the sheet can open on a server without the book's migration.
  if (!b.ready) return <div className="cp-sheet-embed"><p className="desc">{b.notReady}</p></div>;
  // The Log money shortcut before the book has a balance: the balance first, since every move counts from it.
  if (!b.started) {
    return (
      <div className="cp-sheet-embed" key={e.n}>
        <h3>Start your money book</h3>
        <p className="desc">Type what you have now, in the currency you spend in. Every move you log from here moves it, and runway reads it.</p>
        <BalanceForm b={b} book={book} first />
      </div>
    );
  }
  if (e.kind === 'balance') {
    return (
      <div className="cp-sheet-embed" key={e.n}>
        <h3>Your balance</h3>
        <p className="desc">What you have now, in {b.currency}. The book counts from it again: moves you logged before stay in the list and stop moving it.</p>
        <BalanceForm b={b} book={book} />
      </div>
    );
  }
  const line = e.kind === 'edit' ? e.line : null;
  const upcomingRepeat = !!line?.repeat && line.on > b.today;
  const spoken = e.kind === 'add' && e.heard ? parseSpoken(e.heard, { categories: b.categories, today: b.today }) : null;
  return (
    <div className="cp-sheet-embed" key={e.n}>
      <EntryPad
        variant="sheet"
        active={!!book.entry}
        currency={b.currency}
        entry={b.entry}
        onEntry={book.setEntryDefault}
        enteredReady={b.enteredReady}
        safe={b.safe}
        categories={b.categories}
        today={b.today}
        line={line}
        spoken={spoken}
        busy={book.busy}
        onSubmit={async (body, said) => {
          // A new move goes through the outbox and the sheet closes at once;
          // a change to one already there is waited for.
          const ok = line ? await book.write({ ...body, action: 'edit', id: line.id }, said) : await book.outbox.log(body, said);
          if (ok) book.closeEntry();
          return ok;
        }}
        onDelete={line ? () => { void book.write({ action: 'delete', id: line.id }, 'Deleted.').then((ok) => { if (ok) book.closeEntry(); }); } : undefined}
        deleteLabel={upcomingRepeat ? 'Tap again: delete it and stop the repeat' : undefined}
      />
    </div>
  );
}

function BalanceForm({ b, book, first }: { b: BookPayload; book: Book; first?: boolean }) {
  const [amount, setAmount] = useState(first ? (b.suggest.balance != null ? String(b.suggest.balance) : '') : b.balance ? String(b.balance.amount) : '');
  const [currency, setCurrency] = useState(b.suggest.currency);
  const save = async () => {
    const ok = await book.write({ action: 'balance', balance: amount, currency: first ? currency : b.currency }, first ? 'Your book is open. Log moves with +.' : 'Balance set. Moves you log from now move it.');
    if (ok && !first) book.closeEntry();
  };
  return (
    <>
      <div className="cp-input-row cp2-bk-balrow">
        <input className="cp-input cp2-bk-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-label="Balance" autoFocus={!first} />
        {first
          ? <select className="cp-input cp2-mny-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency of the book">
              {[...new Set([b.suggest.currency, b.main, 'PHP', 'USD', 'EUR', 'GBP'])].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          : <span className="cp2-bk-cur">{b.currency}</span>}
      </div>
      {first && <p className="cp-help">The book is kept in this currency from now on. You can still show it in another.</p>}
      <button className="cp-btn primary block cp2-bk-save" disabled={book.busy || amount.trim() === ''} onClick={() => void save()}>{first ? 'Start' : 'Save'}</button>
      {!first && <button className="cp-btn block cp2-bk-save" onClick={book.closeEntry}>Back</button>}
    </>
  );
}
