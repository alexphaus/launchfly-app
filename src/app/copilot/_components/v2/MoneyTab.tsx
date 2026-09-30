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
// to Copilot from the phone's share sheet lands here, imported.
//
// Every figure comes off the server's BookView. Nothing here computes one.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookPayload } from '@/lib/copilot/money/bookstore';
import { bookDayLabel, bookMoney, bookRateLine, parseRepeat, shiftMonth, type BookDay, type BookLine, type CalendarCell } from '@/lib/copilot/money/book';
import { currencyMark } from '@/lib/copilot/money/fx';
import { addDay } from '@/lib/copilot/money/ledger';
import { get, post } from '../api';
import type { Actions } from '../shared';
import type { Arrival } from '../useCopilot';
import { IconRepeat } from './icons2';

/* ─── State ───────────────────────────────────────────────────────────────── */

export type BookEntry = ({ kind: 'add' } | { kind: 'edit'; line: BookLine } | { kind: 'balance' }) & { n: number };
type EntryAsk = { kind: 'add' } | { kind: 'edit'; line: BookLine } | { kind: 'balance' };

const VIEW_KEY = 'cp2.book.view';
const ALT_KEY = 'cp2.book.alt';
const MODE_KEY = 'cp2.book.mode';
/** Per-phone conveniences only: a blocked store costs the remembered choice, never the screen. */
const local = {
  get(k: string): string | null { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string | null) { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch { /* per-phone only */ } },
};

/**
 * The book's state, held by the shell rather than the tab, so switching tabs
 * does not throw it away, and the add sheet and its button can live outside
 * the scrolling content where the tab renders.
 */
export function useBook(say: (m: string) => void, onMoved: () => void) {
  const [book, setBook] = useState<BookPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState<BookEntry | null>(null);
  // The sheet body stays mounted while it slides out.
  const lastEntry = useRef<BookEntry | null>(null);
  if (entry) lastEntry.current = entry;
  const at = useRef<{ month: string | null; view: string | null; init: boolean }>({ month: null, view: null, init: false });

  const load = useCallback(async (next: { month?: string | null; view?: string | null } = {}) => {
    if (!at.current.init) at.current = { ...at.current, view: local.get(VIEW_KEY), init: true };
    at.current = { ...at.current, ...next };
    const q = new URLSearchParams();
    if (at.current.month) q.set('month', at.current.month);
    if (at.current.view) q.set('view', at.current.view);
    try {
      const r = await get<{ book: BookPayload }>(`/money/book?${q}`);
      setBook(r.book);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open your book.');
    }
  }, []);

  /** One write; the answer is the book as it now is. `said` is the toast when it worked and nothing needs saying instead. */
  const write = useCallback(async (body: Record<string, unknown>, said: string): Promise<boolean> => {
    setBusy(true);
    try {
      const r = await post<{ book: BookPayload; warning?: string | null; stopped?: boolean }>('/money/book', { ...body, month: at.current.month, view: at.current.view });
      setBook(r.book);
      onMoved();
      say(r.warning ?? (r.stopped ? `${said} The repeat stopped too.` : said));
      return true;
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not save that.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [onMoved, say]);

  const setView = useCallback((v: string | null) => { local.set(VIEW_KEY, v); void load({ view: v }); }, [load]);
  const setMonth = useCallback((m: string) => { void load({ month: m }); }, [load]);
  const openEntry = useCallback((e: EntryAsk) => setEntry({ ...e, n: Date.now() }), []);
  const closeEntry = useCallback(() => setEntry(null), []);
  return { book, error, busy, load, write, setView, setMonth, asked: at.current.view, entry, shownEntry: entry ?? lastEntry.current, openEntry, closeEntry };
}
export type Book = ReturnType<typeof useBook>;

/** What the service worker kept of a share (public/sw.js), as files, and the cache emptied. */
async function sharedFiles(): Promise<{ files: File[]; error: string | null }> {
  try {
    if (!('caches' in window)) return { files: [], error: 'This browser kept no shared file. Upload it on Bank statements instead.' };
    const cache = await caches.open('copilot-share');
    const files: File[] = [];
    for (const k of await cache.keys()) {
      const r = await cache.match(k);
      if (r) {
        const blob = await r.blob();
        const name = decodeURIComponent(r.headers.get('x-file-name') || 'shared.csv');
        files.push(new File([blob], name, { type: blob.type || r.headers.get('content-type') || '' }));
      }
      await cache.delete(k);
    }
    return { files, error: files.length ? null : 'The shared file was not kept. Share it again, or upload it on Bank statements.' };
  } catch (e) {
    return { files: [], error: `The shared file could not be read: ${e instanceof Error ? e.message : String(e)}` };
  }
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
        const got = await sharedFiles();
        if (got.error) say(got.error);
        // One at a time: each says how it went, and the last word is the last file's.
        for (const f of got.files) await actions.uploadStatement(f);
      }
      await load();
    })();
  }, [arrival, clearArrival, book, actions, say, load]);

  const b = book.book;
  if (!b) {
    return book.error
      ? <div className="cp-card cp2-bk-msg"><div className="cp-error">{book.error}</div><button className="cp-btn" onClick={() => void load()}>Try again</button></div>
      : <div className="cp-note cp2-bk-wait">Opening your book…</div>;
  }
  if (!b.ready) return <div className="cp-card cp2-bk-msg"><p>{b.notReady}</p></div>;
  if (!b.started) {
    return (
      <div className="cp-card cp2-bk-msg">
        <h2 className="cp2-bk-h">Start your money book</h2>
        <p>Type what you have now, in the currency you spend in. Every move you log from here moves it, and runway reads it.</p>
        <BalanceForm b={b} book={book} first />
      </div>
    );
  }
  return <Started b={b} book={book} actions={actions} say={say} />;
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
        <span className="cp2-bk-sub">
          {b.balance && b.view !== b.currency ? `${bookMoney(b.balance.amount, b.currency)} logged · ${rateLine}` : 'Tap it to say it again'}
        </span>
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
        <Calendar b={b} onTap={onLine} />
      )}

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
  return (
    <button className={`cp2-bk-line${l.book ? '' : ' read'}`} onClick={() => onTap(l)}>
      <span className="main">
        <span className="t">{l.label}{rule && <IconRepeat />}</span>
        {sub && <span className="s">{sub}</span>}
      </span>
      <span className="amt">
        <b className={l.amount > 0 ? 'in' : ''}>{l.amount > 0 ? '+' : '−'}{bookMoney(Math.abs(l.shown), b.view)}</b>
        {b.view !== b.currency && <span className="s">{bookMoney(Math.abs(l.amount), b.currency)}</span>}
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
  const [picked, setPicked] = useState<string | null>(null);
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
export function BookFab({ book }: { book: Book }) {
  if (!book.book?.ready || !book.book.started) return null;
  return <button className="cp2-bk-fab" onClick={() => book.openEntry({ kind: 'add' })} aria-label="Log a move">+</button>;
}

export function BookSheet({ book }: { book: Book }) {
  const e = book.shownEntry;
  const b = book.book;
  if (!e || !b) return null;
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
  return <EntryForm key={e.n} b={b} book={book} line={e.kind === 'edit' ? e.line : null} />;
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

function EntryForm({ b, book, line }: { b: BookPayload; book: Book; line: BookLine | null }) {
  const [kind, setKind] = useState<'out' | 'in'>(line && line.amount > 0 ? 'in' : 'out');
  const [amount, setAmount] = useState(line ? String(Math.abs(line.amount)) : '');
  const [category, setCategory] = useState<string | null>(line?.category ?? null);
  const [typing, setTyping] = useState(false);
  const [note, setNote] = useState(line?.note ?? '');
  const [on, setOn] = useState(line?.on ?? b.today);
  const [repeat, setRepeat] = useState<'week' | 'month' | null>(parseRepeat(line?.repeat)?.every ?? null);
  const [sure, setSure] = useState(false);
  const yesterday = addDay(b.today, -1);
  const cats = kind === 'out' ? b.categories.out : b.categories.in;
  const shown = category && !cats.includes(category) ? [category, ...cats] : cats;
  const n = Number(amount.replace(/,/g, ''));
  const what = note.trim() || category || '';
  const pendingNote = on > b.today ? `Pending until ${bookDayLabel(on, b.today)}: in the list, not in the balance, until then.` : null;
  const upcomingRepeat = !!line && !!line.repeat && line.on > b.today;

  const save = () => book.write(
    { action: line ? 'edit' : 'add', id: line?.id, kind, amount, on, category, note, repeat },
    line ? 'Saved.' : `Logged ${kind === 'out' ? '−' : '+'}${bookMoney(Number.isFinite(n) ? n : 0, b.currency)}${what ? ` · ${what}` : ''}${on > b.today ? `, pending until ${bookDayLabel(on, b.today)}` : ''}.`,
  ).then((ok) => { if (ok) book.closeEntry(); });
  const remove = () => {
    if (!line) return;
    if (!sure) { setSure(true); return; }
    void book.write({ action: 'delete', id: line.id }, 'Deleted.').then((ok) => { if (ok) book.closeEntry(); });
  };

  return (
    <div className="cp-sheet-embed cp2-bk-form">
      <div className="cp2-bk-seg wide" role="group" aria-label="Money in or out">
        <button className={kind === 'out' ? 'on' : ''} aria-pressed={kind === 'out'} onClick={() => { setKind('out'); setCategory(null); }}>Spent</button>
        <button className={kind === 'in' ? 'on' : ''} aria-pressed={kind === 'in'} onClick={() => { setKind('in'); setCategory(null); }}>Came in</button>
      </div>
      <label className="cp2-bk-amtrow">
        <span className="mark">{currencyMark(b.currency)}</span>
        <input className="cp2-bk-amt big" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-label={`Amount in ${b.currency}`} autoFocus={!line} />
      </label>

      <div className="cp-label cp2-bk-flabel">Category</div>
      <div className="cp-chips cp2-bk-chips">
        {shown.map((c) => (
          <button key={c} className={`cp-fchip${category === c ? ' active' : ''}`} aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>{c}</button>
        ))}
        {!typing && <button className="cp-fchip" onClick={() => setTyping(true)}>New…</button>}
      </div>
      {typing && <input className="cp-input cp2-bk-gap" value={category ?? ''} maxLength={40} onChange={(e) => setCategory(e.target.value || null)} placeholder="Category" aria-label="New category" autoFocus />}

      <input className="cp-input cp2-bk-gap" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />

      <div className="cp-label cp2-bk-flabel">Day</div>
      <div className="cp-chips cp2-bk-chips">
        <button className={`cp-fchip${on === b.today ? ' active' : ''}`} aria-pressed={on === b.today} onClick={() => setOn(b.today)}>Today</button>
        <button className={`cp-fchip${on === yesterday ? ' active' : ''}`} aria-pressed={on === yesterday} onClick={() => setOn(yesterday)}>Yesterday</button>
        <input type="date" className={`cp-fchip cp2-bk-date${on !== b.today && on !== yesterday ? ' active' : ''}`} value={on} onChange={(e) => e.target.value && setOn(e.target.value)} aria-label="Another day" />
      </div>
      {pendingNote && <p className="cp-help">{pendingNote}</p>}

      <div className="cp-label cp2-bk-flabel">Repeats</div>
      <div className="cp-chips cp2-bk-chips">
        <button className={`cp-fchip${!repeat ? ' active' : ''}`} aria-pressed={!repeat} onClick={() => setRepeat(null)}>Once</button>
        <button className={`cp-fchip${repeat === 'week' ? ' active' : ''}`} aria-pressed={repeat === 'week'} onClick={() => setRepeat('week')}>Weekly</button>
        <button className={`cp-fchip${repeat === 'month' ? ' active' : ''}`} aria-pressed={repeat === 'month'} onClick={() => setRepeat('month')}>Monthly</button>
      </div>
      {repeat && <p className="cp-help">The next one is written ahead, as pending, and counts on its day.</p>}
      {line?.repeat && !repeat && <p className="cp-help">Saving stops the repeat: the upcoming ones go, the past ones stay.</p>}

      <button className="cp-btn primary block cp2-bk-save" disabled={book.busy || !(n > 0) || !(category || note.trim())} onClick={() => void save()}>{line ? 'Save' : 'Log it'}</button>
      {line && (
        <button className="cp-btn block cp2-bk-save cp2-bk-del" disabled={book.busy} onClick={remove}>
          {sure ? (upcomingRepeat ? 'Tap again: delete it and stop the repeat' : 'Tap again to delete') : 'Delete'}
        </button>
      )}
    </div>
  );
}
