'use client';
// Log a move: the amount on the phone's own number keyboard, a category, done.
//
// The owner tried a keypad drawn on the page and preferred the phone's own:
// it is the keyboard their hands know. So the amount field takes focus as the
// sheet opens — on the same tap as the + — and the number keyboard is up at
// once. A phone opens a keyboard only in answer to a tap, so the Log money
// page, which a shortcut opens with no tap on the page yet, needs one on the
// amount. Enter logs it when it is ready, else puts the keyboard away so the
// categories show.
//
// Tap the ₱ to type a move in another currency; it is kept as the default for
// the next one, and each is converted into the book's on its own day
// (bookstore.ts movedColumns). Shared by the Money tab's sheet and the Log
// money page.
import { useEffect, useRef, useState } from 'react';
import { bookDayLabel, bookMoney, categoryIcon, cleanAmount, parseRepeat, type BookLine } from '@/lib/copilot/money/book';
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
  /** On screen: the amount takes focus when it becomes so. A sheet's body stays mounted after it closes, to slide out. */
  active?: boolean;
}

const OFFERED = ['EUR', 'USD', 'GBP', 'PHP'];

export default function EntryPad(p: EntryPadProps) {
  const { line, currency } = p;
  const fromEntered = line?.entered && line.entered.currency !== currency ? line.entered : null;
  const [kind, setKind] = useState<'out' | 'in'>(line && line.amount > 0 ? 'in' : 'out');
  const [amount, setAmount] = useState(line ? String(Math.abs(fromEntered?.amount ?? line.amount)) : '');
  const [typedIn, setTypedIn] = useState<string>(fromEntered?.currency ?? (line ? currency : p.entry?.currency ?? currency));
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

  const amountRef = useRef<HTMLInputElement>(null);
  const reset = () => {
    setAmount(''); setCategory(null); setNote(''); setTyping(false); setOn(p.today); setRepeat(null); setKind('out');
  };

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    const said = line ? 'Saved.' : `Logged ${kind === 'out' ? '−' : '+'}${bookMoney(n, typedIn)}${what ? ` · ${what}` : ''}${on > p.today ? `, pending until ${bookDayLabel(on, p.today)}` : ''}.`;
    const ok = await p.onSubmit({ kind, amount, currency: typedIn, on, category, note, repeat }, said);
    setBusy(false);
    // The page stays up for the next move: back to the amount, keyboard still up — the tap on "Log it" lets the phone keep it open.
    if (ok && p.variant === 'page') { reset(); amountRef.current?.focus({ preventScroll: true }); p.onLogged?.(); }
  };

  // The keyboard up as the pad appears — focus without scrolling, so the
  // sheet sliding in is not dragged along by the field.
  const active = p.active !== false;
  useEffect(() => {
    if (active && !line) amountRef.current?.focus({ preventScroll: true });
  }, [active, line]);

  const pickCurrency = async (code: string) => {
    touched.current = true;
    setTypedIn(code);
    // Kept as the default for the next move — not when correcting one already logged.
    if (!line && p.onEntry) await p.onEntry(code);
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
          <select value={typedIn} onChange={(e) => void pickCurrency(e.target.value)} aria-label="Currency this is in">
            {choices.map((c) => <option key={c} value={c}>{c === currency ? `${c} · your book` : c}</option>)}
          </select>
        </label>
        <input
          ref={amountRef} className="cp2-pad-num" inputMode="decimal" enterKeyHint="done" autoComplete="off"
          value={amount} placeholder="0" aria-label={`Amount in ${typedIn}`}
          onChange={(e) => setAmount(cleanAmount(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (ready) void submit(); else e.currentTarget.blur(); } }}
        />
      </div>
      {blocked && <p className="cp2-pad-conv">Logging in {typedIn} is not set up on this server yet. Pick {currency} to log it now.</p>}

      {/* The layout the owner kept: every category in view (wrapped, never
          scrolled off the right), then the note, the day and the repeat, each
          under its own label. Tall enough that with the keyboard up the amount,
          the categories and the note stay above it. */}
      <div className="cp-label cp2-pad-label">Category</div>
      <div className="cp-chips cp2-pad-chips" role="group" aria-label="Category">
        {shownCats.map((c) => (
          <button key={c} className={`cp-fchip cp2-pad-chip${category === c ? ' active' : ''}${kind === 'in' ? ' in' : ''}`} aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>
            <BookGlyph icon={categoryIcon(c, '', kind === 'in' ? 1 : -1)} />{c}
          </button>
        ))}
        {!typing && <button className="cp-fchip cp2-pad-chip" onClick={() => setTyping(true)}>New…</button>}
      </div>
      {typing && <input className="cp-input cp2-pad-field" value={category ?? ''} maxLength={40} onChange={(e) => setCategory(e.target.value || null)} placeholder="Category" aria-label="New category" autoFocus />}

      <input className="cp-input cp2-pad-field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />

      <div className="cp-label cp2-pad-label">Day</div>
      <div className="cp-chips cp2-pad-chips">
        <button className={`cp-fchip cp2-pad-chip${on === p.today ? ' active' : ''}`} aria-pressed={on === p.today} onClick={() => setOn(p.today)}>Today</button>
        <button className={`cp-fchip cp2-pad-chip${on === yesterday ? ' active' : ''}`} aria-pressed={on === yesterday} onClick={() => setOn(yesterday)}>Yesterday</button>
        <input type="date" className={`cp-fchip cp2-pad-date${on !== p.today && on !== yesterday ? ' active' : ''}`} value={on} onChange={(e) => e.target.value && setOn(e.target.value)} aria-label="Another day" />
      </div>
      {on > p.today && <p className="cp-help">Pending until {bookDayLabel(on, p.today)}: in the list, not in the balance, until then.</p>}

      <div className="cp-label cp2-pad-label">Repeats</div>
      <div className="cp-chips cp2-pad-chips">
        <button className={`cp-fchip cp2-pad-chip${!repeat ? ' active' : ''}`} aria-pressed={!repeat} onClick={() => setRepeat(null)}>Once</button>
        <button className={`cp-fchip cp2-pad-chip${repeat === 'week' ? ' active' : ''}`} aria-pressed={repeat === 'week'} onClick={() => setRepeat('week')}>Weekly</button>
        <button className={`cp-fchip cp2-pad-chip${repeat === 'month' ? ' active' : ''}`} aria-pressed={repeat === 'month'} onClick={() => setRepeat('month')}>Monthly</button>
      </div>
      {repeat && !line?.repeat && <p className="cp-help">The next one is written ahead, as pending, and counts on its day.</p>}
      {line?.repeat && !repeat && <p className="cp-help">Saving stops the repeat: the upcoming ones go, the past ones stay.</p>}

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
