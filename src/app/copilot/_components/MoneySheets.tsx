'use client';
// The two money tiles, opened: Money in and Runway.
//
// Before statements, Money in opened the list of businesses marked won and
// Runway opened three inputs. With a year of the person's own rows on file,
// both sheets were still answering the question they asked before there were
// rows: a person who had just uploaded ₱46,190 of income tapped Money in and
// saw two $1 wins. So each sheet now leads with what the rows say — who paid
// and how much, month by month; where the money goes and what repeats — and
// keeps what was there below it: the wins you logged, the numbers you typed.
//
// Every figure is off the read (lib/copilot/money/ledger.ts moneyRead) or the
// finance row the read settles (financeFromRead). Nothing here computes one.
import { useState } from 'react';
import { ROLE_LABEL, currencyForZone, dayLabel, moneyText, readMoney, recentLabel, typedInLines, type MoneyRead } from '@/lib/copilot/money/ledger';
import { FX_SOURCE, mainCurrency } from '@/lib/copilot/money/fx';
import { computeRunwayMonths, salesCurrency } from '@/lib/copilot/metrics';
import type { HomeData } from '@/lib/copilot/types';
import { money as short } from './format';
import type { Actions } from './shared';

const EVERY: Record<'week' | 'fortnight' | 'month', string> = { week: 'a week', fortnight: 'every two weeks', month: 'a month' };

/* ─── Money in ────────────────────────────────────────────────────────────── */

export function MoneyInSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const read = home.money?.read ?? null;
  const m = home.metrics;
  // Wins are sales money, in the goal's currency; the rows are in the bank's.
  // Two currencies on one sheet, each said in its own and never added.
  const sales = salesCurrency(home.profile.finance, home.goals);
  const wins = m.won
    ? `${m.won} win${m.won === 1 ? '' : 's'} logged in ${m.window_days} days${m.won_amount ? `, ${short(m.won_amount, sales)}` : ''}`
    : `No wins logged in ${m.window_days} days`;

  if (!read) {
    return (
      <div className="cp-sheet-embed">
        <h3>Money in</h3>
        <p className="desc">What you logged as won. Upload a bank statement and this counts everything that came in, from whom, month by month.</p>
        <button className="cp-btn primary block" onClick={() => actions.openSheet({ kind: 'bank' })}>Upload a statement</button>
        <button className="cp2-mny-link" onClick={() => actions.openSheet({ kind: 'stage', stage: 'won' })}>{wins}</button>
      </div>
    );
  }

  const fmt = readMoney(read);
  const label = recentLabel(read.recent, home.recent.today);
  const unnamed = read.toName.length + read.ownCheck.length;
  return (
    <div className="cp-sheet-embed">
      <h3>Money in</h3>
      <div className="cp2-mny-hero">
        <b>{fmt(read.recent.in)}</b>
        <span>{label.toLowerCase()} · {fmt(read.recent.out)} out · from your bank</span>
      </div>

      <div className="cp-section"><span className="lead">Who paid you</span><span className="count">{label.toLowerCase()}</span></div>
      {read.recent.payers.length
        ? read.recent.payers.slice(0, 8).map((p) => (
          <div key={p.key} className="cp-kv">
            <span>{p.name}<i className="cp2-mny-role">{p.role ? ROLE_LABEL[p.role] : 'not named'}</i></span>
            <b>{fmt(p.total)}{p.count > 1 ? ` · ${p.count}×` : ''}</b>
          </div>
        ))
        : <p className="desc">Nothing came in.</p>}
      {unnamed > 0 && (
        <button className="cp2-mny-link" onClick={() => actions.openSheet({ kind: 'bank' })}>
          {unnamed} to name, one tap each — a client’s payments count as wins
        </button>
      )}

      <Months read={read} />

      <div className="cp-section"><span className="lead">Wins you logged</span><span className="count">from your outreach</span></div>
      <button className="cp2-mny-link" onClick={() => actions.openSheet({ kind: 'stage', stage: 'won' })}>{wins}</button>
    </div>
  );
}

function Months({ read }: { read: MoneyRead }) {
  if (read.months.length < 2) return null;
  return (
    <>
      <div className="cp-section"><span className="lead">By month</span><span className="count">in · out</span></div>
      {read.months.map((mo) => (
        <div key={mo.month} className="cp-kv">
          {/* A half month said as one: 15 days of September is not September. */}
          <span>{mo.label}{mo.partial ? <i className="cp2-mny-role">part</i> : null}</span>
          <b>{readMoney(read)(mo.in)} · {readMoney(read)(mo.out)}</b>
        </div>
      ))}
    </>
  );
}

/* ─── Runway ──────────────────────────────────────────────────────────────── */

const MONTH_NAME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (m: string) => MONTH_NAME[Number(m.slice(5, 7)) - 1] ?? m;
/** "Sep", "Aug and Sep", "Jul to Sep". */
function monthsSpan(months: string[]): string {
  if (months.length <= 1) return months.map(monthName).join('');
  if (months.length === 2) return `${monthName(months[0])} and ${monthName(months[1])}`;
  return `${monthName(months[0])} to ${monthName(months[months.length - 1])}`;
}

/**
 * Runway, and what a month costs.
 *
 * The monthly spend is the app's to count, not the person's to work out. It
 * was already counted off the statements and the Money tab — but it sat in an
 * input box under "Spent a month" with Save and Back beneath it, so the sheet
 * read as a form to fill, and its owner asked why they had to figure out their
 * own spending when the app had their records. Now the figure leads, with the
 * months it was counted from and each month's total; typing a number of your
 * own is a link, and a number typed earlier can be handed back to the rows.
 * The boxes are open from the start only when there is nothing to count from.
 */
export function RunwaySheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const f = home.profile.finance ?? {};
  const read = home.money?.read ?? null;
  const main = mainCurrency(f, home.goals);
  const fromStatementBurn = f.source?.monthly_burn === 'statement';
  // A number typed in another currency is shown as typed, in its own currency:
  // the person wrote ₱71,804, not the $1,238 it is worth today.
  const [cash, setCash] = useState(f.typed_in?.cash ? String(f.typed_in.cash.amount) : f.cash?.toString() ?? '');
  const [cashCurrency, setCashCurrency] = useState(f.typed_in?.cash?.currency ?? main);
  const [burn, setBurn] = useState(f.typed_in?.monthly_burn ? String(f.typed_in.monthly_burn.amount) : f.monthly_burn?.toString() ?? '');
  const [burnCurrency, setBurnCurrency] = useState(f.typed_in?.monthly_burn?.currency ?? main);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  // The Money tab's balance is the cash (ledger.ts financeFromRead); it moves there, with each move logged.
  const fromBook = f.source?.cash === 'book' || !!f.book;
  const save = async () => {
    setBusy(true);
    await actions.saveFinance({
      cash: cash === '' || fromBook ? undefined : Number(cash),
      monthly_burn: burn === '' ? undefined : Number(burn),
      cash_currency: cashCurrency,
      burn_currency: burnCurrency,
    });
    setBusy(false);
  };
  const useEstimate = async () => {
    setBusy(true);
    await actions.saveFinance({ burn: 'rows' });
    setBusy(false);
  };
  // Previewed only when both are in the main currency: anything else is converted on save, at the rate the server has.
  const preview = fromBook ? (burnCurrency === main && f.cash != null ? computeRunwayMonths({ monthly_burn: Number(burn) || undefined, cash: f.cash }) : null)
    : cashCurrency === main && burnCurrency === main
    ? computeRunwayMonths({ monthly_burn: Number(burn) || undefined, cash: cash === '' ? undefined : Number(cash) })
    : null;

  const runway = computeRunwayMonths(f);
  const typedLines = typedInLines(f);
  // The one number a budget export cannot give — it prints no balance — asked first, with the burn it did give filled in.
  const askCash = fromStatementBurn && f.cash == null && !f.typed_in?.cash;
  const unlabelled = read && !read.currencyKnown;
  const notMain = read && read.currencyKnown && !read.inMain;
  const options = currencyChoices(home, main);

  // What the rows say a month costs: the latest whole months, or the span before one is whole (ledger.ts moneyRead).
  const estimate = read?.inMain && read.perMonth && read.perMonth.out > 0 ? read.perMonth : null;
  const fmt = read ? readMoney(read) : (n: number) => moneyText(n, main);
  const counted = estimate?.months?.length
    ? estimate.months.map((m) => {
      const mo = read!.months.find((x) => x.month === m);
      return mo ? `${monthName(m)} ${fmt(mo.out)}` : monthName(m);
    })
    : null;
  // Not which currencies: a statement that stopped months ago is converted in the read but not in this average.
  const converted = read?.inMain && read.converted.length ? ` Converted to ${main} at ${FX_SOURCE}.` : '';
  const basis = estimate
    ? counted
      ? `Your last ${counted.length === 1 ? 'whole month' : `${counted.length} whole months`}: ${counted.join(', ')}.${converted}`
      : `Your spending over the last ${estimate.over} days, averaged to a month — a whole month on file makes it the month's own.${converted}`
    : null;
  // Typed on this sheet — or set before statements said where a number came from.
  const burnTyped = f.monthly_burn != null && !fromStatementBurn || !!f.typed_in?.monthly_burn;
  // The boxes open by themselves only when there is nothing to count from, or the cash is the one number missing.
  const showFields = editing || askCash || (!estimate && !burnTyped);

  return (
    <div className="cp-sheet-embed">
      <h3>Runway</h3>
      {runway != null ? (
        <div className="cp2-mny-hero">
          <b>{runway} month{runway === 1 ? '' : 's'}</b>
          <span>{moneyText(f.cash ?? 0, main)} cash ÷ {moneyText(f.monthly_burn ?? 0, main)} a month</span>
        </div>
      ) : askCash ? (
        <div className="cp2-mny-hero">
          <b>{moneyText(f.monthly_burn ?? 0, main)} a month</b>
          <span>what your records spend · type your cash to count runway</span>
        </div>
      ) : (
        <p className="desc">Cash divided by what you spend a month, in {main}. Under four months, the copilot favours work that pays fast over big builds.</p>
      )}

      {/* A failed write is said here, not shown as a runway that never came (invariant 13). */}
      {home.money?.settleError && <div className="cp-error">{home.money.settleError}</div>}
      {typedLines.map((l) => <div key={l} className="cp-note">{l}</div>)}
      {fromBook && f.source?.cash === 'book' && !f.typed_in?.cash && <div className="cp-note">Cash is your balance on the Money tab. Log a move there and runway follows it.</div>}
      {unlabelled
        ? <div className="cp-note">Your statement does not say its currency, so runway does not use it yet. <button className="cp2-bank-inline" onClick={() => actions.openSheet({ kind: 'bank' })}>Say which</button> and it is converted to {main}.</div>
        : notMain
        ? <div className="cp-note">Your statements are in {read.currency} and there is no rate to put them in {main} yet, so runway does not use them. It tries again shortly.</div>
        : !read && home.money?.ready && !fromBook && <div className="cp-note">Or skip the typing: <button className="cp2-bank-inline" onClick={() => actions.openSheet({ kind: 'bank' })}>upload a bank statement</button>, or log what you spend on the Money tab, and both are counted for you.</div>}

      {/* What a month costs, and where the number came from. */}
      {fromStatementBurn && basis && (
        <div className="cp2-rw-basis">
          <span className="t">A month: about {moneyText(f.monthly_burn ?? 0, main)}</span>
          <span className="s">{basis}</span>
        </div>
      )}
      {burnTyped && !editing && (
        <div className="cp2-rw-basis">
          <span className="t">A month: {f.typed_in?.monthly_burn ? moneyText(f.typed_in.monthly_burn.amount, f.typed_in.monthly_burn.currency) : moneyText(f.monthly_burn ?? 0, main)}, as you typed it</span>
          {estimate && <span className="s">Your records say about {fmt(estimate.out)}{counted ? `, from ${monthsSpan(estimate.months!)}` : ''}.</span>}
          {estimate && <button className="cp-btn sm cp2-rw-use" disabled={busy} onClick={() => void useEstimate()}>{busy ? 'Saving…' : 'Use your records instead'}</button>}
        </div>
      )}

      {showFields ? (
        <>
          {!fromBook && (
            <div className="cp-field">
              <label className="cp-label" htmlFor="cp2-rw-cash">Cash on hand</label>
              <div className="cp-input-row">
                <input id="cp2-rw-cash" className="cp-input" inputMode="decimal" autoFocus={askCash || !estimate} value={cash} onChange={(e) => setCash(e.target.value)} placeholder="Cash" />
                <CurrencyPick value={cashCurrency} options={options} onChange={setCashCurrency} label="Currency of the cash" />
              </div>
            </div>
          )}
          <div className="cp-field">
            <label className="cp-label" htmlFor="cp2-rw-burn">Spent a month</label>
            <div className="cp-input-row">
              <input id="cp2-rw-burn" className="cp-input" inputMode="decimal" value={burn} onChange={(e) => setBurn(e.target.value)} placeholder="A month" />
              <CurrencyPick value={burnCurrency} options={options} onChange={setBurnCurrency} label="Currency of the monthly spend" />
            </div>
            <div className="cp-help">
              {preview != null ? `That is ${preview} months of runway.`
                : (!fromBook && cashCurrency !== main) || burnCurrency !== main ? `Counted in ${main}: converted at the newest ${FX_SOURCE} when you save.`
                : 'Enter both to see runway.'}
              {estimate && ' A newer statement replaces a typed number again.'}
            </div>
          </div>
          <div className="cp-btn-row">
            <button className="cp-btn primary" disabled={busy} onClick={save}>Save</button>
            <button className="cp-btn" onClick={() => (editing ? setEditing(false) : actions.closeSheet())}>{editing ? 'Cancel' : 'Back'}</button>
          </div>
        </>
      ) : (
        <button className="cp2-mny-link cp2-rw-own" onClick={() => setEditing(true)}>{burnTyped ? 'Change the number you typed' : 'Use a number of your own instead'}</button>
      )}

      {/* Converted into the main currency like runway itself, so the lines add up to the burn above. */}
      {read?.inMain && read.spend.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Where it goes</span><span className="count">a month, {estimate?.months?.length ? monthsSpan(estimate.months) : `last ${read.perMonth?.over ?? 0} days`}</span></div>
          {read.spend.map((x) => (
            <div key={x.key} className="cp-kv"><span>{x.name}</span><b>{readMoney(read)(x.perMonth)}</b></div>
          ))}
        </>
      )}
      {read?.inMain && read.recurring.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Repeat bills</span><span className="count">{readMoney(read)(read.recurringPerMonth)} a month</span></div>
          {read.recurring.map((r) => (
            <div key={r.key} className="cp-kv"><span>{r.name}</span><b>{readMoney(read)(r.amount)} {EVERY[r.every]} · next {dayLabel(r.next)}</b></div>
          ))}
        </>
      )}
      {read?.inMain && <Months read={read} />}
    </div>
  );
}

/** A currency, picked from the ones this person has anything in. */
function CurrencyPick({ value, options, onChange, label }: { value: string; options: string[]; onChange: (c: string) => void; label: string }) {
  return (
    <select className="cp-input cp2-mny-cur" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {[...new Set([value, ...options])].map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

/** The currencies worth offering: the main one, the time zone's, every one on a statement, then the common few. */
function currencyChoices(home: HomeData, main: string): string[] {
  const m = home.money;
  return [...new Set([
    main,
    currencyForZone(home.profile.timezone),
    ...(m?.imports.map((i) => i.currency) ?? []),
    ...(m?.read?.converted.map((c) => c.currency) ?? []),
    ...(m?.read?.otherCurrencies.map((c) => c.currency) ?? []),
    'USD', 'EUR', 'GBP', 'PHP',
  ].filter((c): c is string => !!c && /^[A-Z]{3}$/.test(c)))];
}

/* ─── The main currency ───────────────────────────────────────────────────── */

/**
 * The one currency the whole app counts in. Statements, balances and numbers
 * typed in any other are converted into it at the ECB rate for their own day
 * (lib/copilot/money/fx.ts); goals keep the unit they were written in.
 */
export function CurrencySheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const main = mainCurrency(home.profile.finance, home.goals);
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = async (c: string) => { setBusy(true); await actions.saveFinance({ main_currency: c }); setBusy(false); };
  const read = home.money?.read ?? null;
  return (
    <div className="cp-sheet-embed">
      <h3>Your currency</h3>
      <p className="desc">
        Everything is counted in {main}: money in, runway, what you spend. Statements and cash in any other currency are
        converted into it at the {FX_SOURCE} for each row&rsquo;s own day, and the screen says which were.
      </p>
      {read?.converted.length ? <div className="cp-note">Converted now: {read.converted.map((c) => `${c.rows} rows in ${c.currency}`).join(', ')}.</div> : null}
      <div className="cp-chips cp2-bank-chips">
        {currencyChoices(home, main).map((c) => (
          <button key={c} className={`cp-fchip${c === main ? ' active' : ''}`} disabled={busy || c === main} onClick={() => void pick(c)} aria-pressed={c === main}>{c}</button>
        ))}
      </div>
      <div className="cp-input-row cp2-bank-cur">
        <input className="cp-input sm" value={other} maxLength={3} onChange={(e) => setOther(e.target.value.toUpperCase())} placeholder="CAD" aria-label="Another currency, three letters" />
        <button className="cp-connect" disabled={busy || !/^[A-Z]{3}$/.test(other)} onClick={() => void pick(other)}>Use it</button>
      </div>
    </div>
  );
}
