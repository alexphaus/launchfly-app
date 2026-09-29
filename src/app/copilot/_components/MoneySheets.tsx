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
import { ROLE_LABEL, currencyClash, currencyMark, dayLabel, moneyText, readMoney, recentLabel, setAsideLine, type MoneyRead } from '@/lib/copilot/money/ledger';
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

export function RunwaySheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const f = home.profile.finance ?? {};
  const read = home.money?.read ?? null;
  const fromStatementBurn = f.source?.monthly_burn === 'statement';
  const [burn, setBurn] = useState(f.monthly_burn?.toString() ?? '');
  const [cash, setCash] = useState(f.cash?.toString() ?? '');
  const [currency, setCurrency] = useState(f.currency || salesCurrency(f, home.goals));
  const [busy, setBusy] = useState(false);
  const preview = computeRunwayMonths({ monthly_burn: Number(burn) || undefined, cash: cash === '' ? undefined : Number(cash) });
  const save = async () => { setBusy(true); await actions.saveFinance({ monthly_burn: burn === '' ? undefined : Number(burn), cash: cash === '' ? undefined : Number(cash), currency }); setBusy(false); };

  const runway = computeRunwayMonths(f);
  const cur = f.currency || currency;
  // Where each number came from, when a statement supplied it. Typing over one
  // makes it yours until a statement dated after today says otherwise.
  const fromBank = [
    f.source?.cash === 'statement' && f.cash_on ? `cash is your balance on ${dayLabel(f.cash_on)}` : null,
    fromStatementBurn && f.burn_to ? `burn is your spending averaged over the rows to ${dayLabel(f.burn_to)}` : null,
  ].filter(Boolean);
  const clash = currencyClash(f, read);
  const aside = setAsideLine(f);
  // The one number the rows cannot give — a budget export prints no balance —
  // asked first, with the burn they did give already filled in.
  const askCash = fromStatementBurn && f.cash == null;
  const sameCurrency = read && read.currencyKnown && currencyMark(f.currency || read.currency) === currencyMark(read.currency);
  const unlabelled = read && !read.currencyKnown;

  return (
    <div className="cp-sheet-embed">
      <h3>Runway</h3>
      {runway != null ? (
        <div className="cp2-mny-hero">
          <b>{runway} month{runway === 1 ? '' : 's'}</b>
          <span>{moneyText(f.cash ?? 0, cur)} cash ÷ {moneyText(f.monthly_burn ?? 0, cur)} a month</span>
        </div>
      ) : askCash ? (
        <div className="cp2-mny-hero">
          <b>{moneyText(f.monthly_burn ?? 0, cur)} a month</b>
          <span>what your statements spend · type your cash to count runway</span>
        </div>
      ) : (
        <p className="desc">Cash divided by what you spend a month. Under four months, the copilot favours work that pays fast over big builds.</p>
      )}

      {/* A failed write is said here, not shown as a runway that never came (invariant 13). */}
      {home.money?.settleError && <div className="cp-error">{home.money.settleError}</div>}
      {aside && <div className="cp-note">{aside}</div>}
      {unlabelled
        ? <div className="cp-note">Your statement does not say its currency, so runway does not use it yet. <button className="cp2-bank-inline" onClick={() => actions.openSheet({ kind: 'bank' })}>Say which</button> and the burn is counted from it.</div>
        : clash
        ? <div className="cp-note">{clash}</div>
        : fromBank.length > 0
        ? <div className="cp-note">From your bank statements: {fromBank.join('; ')}. Type a number to use yours instead — a newer statement replaces it again.</div>
        : !read && home.money?.ready && <div className="cp-note">Or skip the typing: <button className="cp2-bank-inline" onClick={() => actions.openSheet({ kind: 'bank' })}>upload a bank statement</button> and both are read off it.</div>}

      <div className="cp-field">
        <label className="cp-label">Cash on hand / Monthly burn / Currency</label>
        <div className="cp-input-row">
          <input className="cp-input" inputMode="decimal" autoFocus={askCash || !fromStatementBurn} value={cash} onChange={(e) => setCash(e.target.value)} placeholder="Cash" aria-label="Cash on hand" />
          <input className="cp-input" inputMode="decimal" value={burn} onChange={(e) => setBurn(e.target.value)} placeholder="A month" aria-label="Monthly burn" />
          <input className="cp-input" style={{ maxWidth: 70 }} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} aria-label="Currency" />
        </div>
        <div className="cp-help">{preview != null ? `That is ${preview} months of runway.` : 'Enter both to see runway.'}</div>
      </div>
      <div className="cp-btn-row">
        <button className="cp-btn primary" disabled={busy} onClick={save}>Save</button>
        <button className="cp-btn" onClick={actions.closeSheet}>Back</button>
      </div>

      {/* Only when the rows are in runway's own currency: euro bills under a peso runway explain nothing. */}
      {sameCurrency && read.spend.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Where it goes</span><span className="count">a month, last {read.perMonth?.over ?? 0} days</span></div>
          {read.spend.map((s) => (
            <div key={s.key} className="cp-kv"><span>{s.name}</span><b>{readMoney(read)(s.perMonth)}</b></div>
          ))}
        </>
      )}
      {sameCurrency && read.recurring.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Repeat bills</span><span className="count">{readMoney(read)(read.recurringPerMonth)} a month</span></div>
          {read.recurring.map((r) => (
            <div key={r.key} className="cp-kv"><span>{r.name}</span><b>{readMoney(read)(r.amount)} {EVERY[r.every]} · next {dayLabel(r.next)}</b></div>
          ))}
        </>
      )}
      {sameCurrency && <Months read={read} />}
    </div>
  );
}
