'use client';
// Log a move: amount on a keypad of its own, a category, done.
//
// Its own keypad, not the phone's keyboard. Timed on the owner's phone, a
// coffee took a tap in the field to wake the keyboard, the typing, a swipe to
// put the keyboard away because it covered the categories, the category, then
// "Log it" — and the keyboard cannot be opened for you when the app starts from
// the Log money shortcut, because a phone only opens one for a tap. The keypad
// is on screen from the first frame. The note, the one field that wants
// letters, still uses the keyboard.
//
// Tap the ₱ to type a move in another currency; it is kept as the default for
// the next one, and each is converted into the book's on its own day
// (bookstore.ts movedColumns). Shared by the Money tab's sheet and the Log
// money page.
import { useEffect, useRef, useState } from 'react';
import { bookDayLabel, bookMoney, categoryIcon, padKey, parseRepeat, type BookLine } from '@/lib/copilot/money/book';
import type { EntryDefault } from '@/lib/copilot/money/bookstore';
import { currencyMark } from '@/lib/copilot/money/fx';
import { addDay } from '@/lib/copilot/money/ledger';
import { BookGlyph } from './icons2';

export interface EntryPadProps {
  /** The book's currency. */
  currency: string;
  /** The currency moves are typed in by default, and its rate into the book's. */
  entry: EntryDefault;
  /** Keep a new default. Resolves to the new one, or undefined when it could not be kept (the caller said why). */
  onEntry?: (code: string) => Promise<EntryDefault | undefined>;
  /** False when logging in another currency is not set up on the server (20261002). */
  enteredReady: boolean;
  categories: { out: string[]; in: string[] };
  today: string;
  line?: BookLine | null;
  busy?: boolean;
  /** Resolves true when the move is kept (sent, or safe on the phone to send). */
  onSubmit: (body: Record<string, unknown>, said: string) => Promise<boolean>;
  onDelete?: () => void;
  deleteLabel?: string;
  /** Called after a move is kept, when the pad stays up for the next one. */
  onLogged?: () => void;
  /** 'page' stays on screen after a move, cleared for the next. */
  variant: 'sheet' | 'page';
  /**
   * On screen. A sheet's body stays mounted after it closes, to slide out —
   * and a keyboard listener left on it would take Enter pressed anywhere as
   * "Log it" again for the move it just logged.
   */
  active?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;
const OFFERED = ['EUR', 'USD', 'GBP', 'PHP'];

/** "1234.5" drawn as "1,234.5": the digits as typed, grouped. */
function grouped(v: string): string {
  if (!v) return '0';
  const [whole, cents] = v.split('.');
  const w = Number(whole || '0').toLocaleString('en-US');
  return cents === undefined ? w : `${w}.${cents}`;
}

export default function EntryPad(p: EntryPadProps) {
  const { line, currency } = p;
  const fromEntered = line?.entered && line.entered.currency !== currency ? line.entered : null;
  const [kind, setKind] = useState<'out' | 'in'>(line && line.amount > 0 ? 'in' : 'out');
  const [amount, setAmount] = useState(line ? String(Math.abs(fromEntered?.amount ?? line.amount)) : '');
  const [typedIn, setTypedIn] = useState<string>(fromEntered?.currency ?? (line ? currency : p.entry?.currency ?? currency));
  const [rate, setRate] = useState(p.entry?.currency === typedIn ? p.entry.rate : null);
  const [category, setCategory] = useState<string | null>(line?.category ?? null);
  const [typing, setTyping] = useState(false);
  const [note, setNote] = useState(line?.note ?? '');
  const [on, setOn] = useState(line?.on ?? p.today);
  const [repeat, setRepeat] = useState<'week' | 'month' | null>(parseRepeat(line?.repeat)?.every ?? null);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);

  // The default can arrive after the pad is drawn (the book loaded behind it).
  const touched = useRef(false);
  useEffect(() => {
    if (line || touched.current) return;
    setTypedIn(p.entry?.currency ?? currency);
    setRate(p.entry?.rate ?? null);
  }, [line, p.entry, currency]);

  // Today can move under the pad (the Log money page learning it from the
  // phone's clock): a move still on the old today moves with it.
  const lastToday = useRef(p.today);
  useEffect(() => {
    if (lastToday.current === p.today) return;
    const was = lastToday.current;
    lastToday.current = p.today;
    setOn((o) => (o === was ? p.today : o));
  }, [p.today]);

  const yesterday = addDay(p.today, -1);
  const cats = kind === 'out' ? p.categories.out : p.categories.in;
  const shownCats = category && !cats.includes(category) ? [category, ...cats] : cats;
  const n = Number(amount || '0');
  const other = typedIn !== currency;
  const blocked = other && !p.enteredReady;
  const ready = n > 0 && !!(category || note.trim()) && !blocked && !busy && !p.busy;
  const what = note.trim() || category || '';

  const press = (key: string) => setAmount((a) => padKey(a, key));

  const reset = () => {
    setAmount(''); setCategory(null); setNote(''); setTyping(false); setOn(p.today); setRepeat(null); setKind('out');
  };

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    const said = line ? 'Saved.' : `Logged ${kind === 'out' ? '−' : '+'}${bookMoney(n, typedIn)}${what ? ` · ${what}` : ''}${on > p.today ? `, pending until ${bookDayLabel(on, p.today)}` : ''}.`;
    const ok = await p.onSubmit({ kind, amount, currency: typedIn, on, category, note, repeat }, said);
    setBusy(false);
    if (ok && p.variant === 'page') { reset(); p.onLogged?.(); }
  };

  // A keyboard, where there is one: digits, a point, backspace, Enter.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const active = p.active !== false;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (/^\d$/.test(e.key) || e.key === '.' || e.key === ',') { press(e.key === ',' ? '.' : e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { press('back'); e.preventDefault(); }
      else if (e.key === 'Enter') { void submitRef.current(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const pickCurrency = async (code: string) => {
    touched.current = true;
    setTypedIn(code);
    setRate(p.entry?.currency === code ? p.entry.rate : null);
    // Kept as the default for the next move — not when correcting one already logged.
    if (!line && p.onEntry) {
      const next = await p.onEntry(code);
      if (next !== undefined) setRate(next?.currency === code ? next.rate : null);
    }
  };
  const choices = [...new Set([currency, typedIn, p.entry?.currency, ...OFFERED].filter((c): c is string => !!c))];

  return (
    <div className={`cp2-pad cp2-pad-${p.variant}`}>
      <div className="cp2-bk-seg wide" role="group" aria-label="Money in or out">
        <button className={kind === 'out' ? 'on' : ''} aria-pressed={kind === 'out'} onClick={() => { setKind('out'); setCategory(null); }}>Spent</button>
        <button className={kind === 'in' ? 'on' : ''} aria-pressed={kind === 'in'} onClick={() => { setKind('in'); setCategory(null); }}>Came in</button>
      </div>

      <div className="cp2-pad-amount">
        {/* The mark is the picker: a select laid over it, so the phone's own list opens on a tap. */}
        <label className="cp2-pad-cur">
          <span aria-hidden>{currencyMark(typedIn)}</span>
          <i aria-hidden />
          <select value={typedIn} onChange={(e) => void pickCurrency(e.target.value)} aria-label="Currency this is in">
            {choices.map((c) => <option key={c} value={c}>{c === currency ? `${c} · your book` : c}</option>)}
          </select>
        </label>
        <output className={`cp2-pad-num${amount ? '' : ' empty'}`} aria-live="polite">{grouped(amount)}</output>
      </div>
      {other && (
        <p className="cp2-pad-conv">
          {blocked ? `Logging in ${typedIn} is not set up on this server yet. Pick ${currency} to log it now.`
            : rate && n > 0 ? `≈ ${bookMoney(Math.round(n * rate.rate * 100) / 100, currency)} in your book, at the rate of ${Number(rate.day.slice(8, 10))} ${new Date(`${rate.day}T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`
            : `Counted in ${currency} at the rate on its day.`}
        </p>
      )}

      <div className="cp2-pad-cats" role="group" aria-label="Category">
        {shownCats.map((c) => (
          <button key={c} className={`cp2-pad-cat${category === c ? ' on' : ''}${kind === 'in' ? ' in' : ''}`} aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>
            <BookGlyph icon={categoryIcon(c, '', kind === 'in' ? 1 : -1)} />{c}
          </button>
        ))}
        {!typing && <button className="cp2-pad-cat" onClick={() => setTyping(true)}>New…</button>}
      </div>
      {typing && <input className="cp-input cp2-pad-field" value={category ?? ''} maxLength={40} onChange={(e) => setCategory(e.target.value || null)} placeholder="Category" aria-label="New category" autoFocus />}

      <div className="cp2-pad-when">
        <button className={`cp-fchip${on === p.today ? ' active' : ''}`} aria-pressed={on === p.today} onClick={() => setOn(p.today)}>Today</button>
        <button className={`cp-fchip${on === yesterday ? ' active' : ''}`} aria-pressed={on === yesterday} onClick={() => setOn(yesterday)}>Yesterday</button>
        {/* Another day: a chip that says the day, with the phone's own date picker laid over it — the bare date field was wider than the row. */}
        <label className={`cp-fchip cp2-pad-date${on !== p.today && on !== yesterday ? ' active' : ''}`}>
          {on !== p.today && on !== yesterday ? bookDayLabel(on, p.today) : 'Other day'}
          <input type="date" value={on} onChange={(e) => e.target.value && setOn(e.target.value)} aria-label="Another day" />
        </label>
        <select className={`cp-fchip cp2-pad-rep${repeat ? ' active' : ''}`} value={repeat ?? ''} onChange={(e) => setRepeat((e.target.value || null) as 'week' | 'month' | null)} aria-label="Repeats">
          <option value="">Once</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
      </div>
      {on > p.today && <p className="cp-help">Pending until {bookDayLabel(on, p.today)}: in the list, not in the balance, until then.</p>}
      {repeat && !line?.repeat && <p className="cp-help">The next one is written ahead, as pending, and counts on its day.</p>}
      {line?.repeat && !repeat && <p className="cp-help">Saving stops the repeat: the upcoming ones go, the past ones stay.</p>}

      <input className="cp-input cp2-pad-field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />

      <div className="cp2-pad-keys" role="group" aria-label="Amount keypad">
        {KEYS.map((k) => (
          <button key={k} className="cp2-pad-key" onClick={() => press(k)} aria-label={k === 'back' ? 'Delete a digit' : k === '.' ? 'Point' : k}>
            {k === 'back' ? <svg viewBox="0 0 24 24" aria-hidden><path d="M9 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-6-6 6-6z" /><path d="M12.5 10l4 4M16.5 10l-4 4" /></svg> : k}
          </button>
        ))}
      </div>

      <button className="cp-btn primary block cp2-pad-go" disabled={!ready} onClick={() => void submit()}>
        {busy ? 'Saving…' : line ? 'Save' : 'Log it'}
      </button>
      {p.onDelete && (
        <button className="cp-btn block cp2-pad-del" disabled={busy || p.busy} onClick={() => { if (sure) p.onDelete!(); else setSure(true); }}>
          {sure ? p.deleteLabel ?? 'Tap again to delete' : 'Delete'}
        </button>
      )}
    </div>
  );
}
