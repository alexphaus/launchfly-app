'use client';
// Bank statements: upload one, see what it says, and answer the few things only
// the person can — whether a reading's totals match, who a payer is. Nothing
// here is typed that the bank already wrote down (lib/copilot/money).
//
// The order is the order of what needs them: what is being read, what is
// waiting on their eye, the read itself, the questions, then the record of
// what is on file and the way to delete all of it.
import { useState } from 'react';
import { PAYEE_ROLES, ROLE_LABEL, currencyCodeOf, dayLabel, moneyText, type MoneyImport, type PayeeRole } from '@/lib/copilot/money/ledger';
import { STATEMENT_ACCEPT } from '@/lib/copilot/money/statement';
import type { HomeData } from '@/lib/copilot/types';
import type { Actions } from './shared';

/** What the upload takes when no model is set up: exports, and PDFs — most print a balance the rows can be read against. */
const NO_MODEL = '.csv,.tsv,.txt,.ofx,.qfx,.pdf';
const EVERY: Record<'week' | 'fortnight' | 'month', string> = { week: 'a week', fortnight: 'every two weeks', month: 'a month' };

export default function BankSheet({ home, actions }: { home: HomeData; actions: Actions }) {
  const m = home.money;
  const [uploading, setUploading] = useState(false);
  const currency = m?.read?.currency || home.profile.finance?.currency || '$';
  const money = (n: number | null | undefined, cur = currency) => (n == null ? '—' : moneyText(n, cur));

  if (!m || !m.ready) {
    return (
      <>
        <h3>Bank statements</h3>
        <p className="desc">Your bank’s own record, read into rows, so runway, income and repeat bills are counted rather than typed.</p>
        {/* Said as what it is: the server is missing a table, which is not the same as nothing uploaded. */}
        <div className="cp-error">Statements are not set up on this server yet. The database needs supabase/migrations/20260929_copilot_money.sql.</div>
      </>
    );
  }

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    // One at a time: each is its own statement, and the second waits for the first's rows.
    for (const f of Array.from(files)) await actions.uploadStatement(f);
    setUploading(false);
  };

  const reading = m.imports.filter((i) => i.status === 'reading');
  const review = m.imports.filter((i) => i.status === 'review');
  const failed = m.imports.filter((i) => i.status === 'failed');
  const onFile = m.imports.filter((i) => i.status === 'ready');
  const read = m.read;
  // One file whose currency is unknown, asked about at a time: the answer covers
  // its whole account, so the next export of the same app needs no question.
  const unlabelled = [...review, ...onFile].find((i) => !i.currency) ?? null;
  const currencyOptions = [...new Set([
    currencyCodeOf(home.profile.finance?.currency),
    ...m.imports.map((i) => i.currency),
    ...(read?.otherCurrencies.map((o) => o.currency) ?? []),
    'USD', 'EUR',
  ].filter((c): c is string => !!c && /^[A-Z]{3}$/.test(c)))].slice(0, 5);

  return (
    // Embedded, so section headers sit on the cards' edge rather than the tab's.
    <div className="cp-sheet-embed">
      <h3>Bank statements</h3>
      <p className="desc">
        Your bank’s own record, read into rows. Runway, income, who pays you and your repeat bills are counted off
        it instead of typed. The file is not kept, only the rows{m.canRead ? ' — and a screenshot, or a PDF without a running balance, is read by the AI model this app uses' : ''}.
      </p>
      {m.unreadable && <div className="cp-error">Could not read your statements just now: {m.unreadable}</div>}

      <label className={`cp-btn primary block cp2-bank-upload${uploading ? ' busy' : ''}`}>
        {uploading ? 'Uploading…' : m.rows ? 'Upload another statement' : 'Upload a statement'}
        <input
          type="file"
          accept={m.canRead ? STATEMENT_ACCEPT : NO_MODEL}
          multiple
          disabled={uploading}
          onChange={(e) => { const files = e.currentTarget.files; void upload(files).then(() => { e.target.value = ''; }); }}
        />
      </label>
      <p className="cp-help">
        The CSV or OFX download from your bank’s website reads best, then a PDF statement.
        {m.canRead ? ' A screenshot of your banking app works too.' : ' Screenshots, and PDFs that print no running balance, need an AI model on this server, and none is set up.'}
        {' '}Overlapping statements are fine: a row already on file is not counted twice.
      </p>

      {reading.map((i) => (
        <div key={i.id} className="cp-banner cp2-bank-reading"><span className="dot" />Reading {i.fileName ?? 'your statement'}…</div>
      ))}
      {review.map((i) => <ReviewCard key={i.id} i={i} money={money} actions={actions} />)}
      {unlabelled && <CurrencyQuestion key={unlabelled.id} i={unlabelled} options={currencyOptions} actions={actions} />}
      {failed.map((i) => (
        <div key={i.id} className="cp-src cp2-bank-card">
          <div className="ct">Could not read {i.fileName ?? 'that file'}</div>
          <div className="cs bad">{i.error ?? 'No reason was given.'}</div>
          <div className="acts"><button className="cp-connect ghost" onClick={() => void actions.answerMoney({ action: 'discard', id: i.id })}>Remove</button></div>
        </div>
      ))}

      {read && (
        <>
          <div className="cp-section"><span className="lead">What it says</span><span className="count">{read.rows} rows · {dayLabel(read.from)} to {dayLabel(read.to)}</span></div>
          <div className="cp-src cp2-bank-read">{read.lines.map((l) => <p key={l}>{l}</p>)}</div>
        </>
      )}

      {read && read.ownCheck.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Your own account?</span><span className="count">moved, not spent</span></div>
          {read.ownCheck.map((p) => (
            <Question key={p.key} title={p.name} line={`${money(p.total)} out in ${p.count} transfer${p.count === 1 ? '' : 's'} · last ${dayLabel(p.last)}`}
              options={[{ label: 'Yes, it is mine', role: 'self' }, { label: 'No, I pay them', role: 'other' }]}
              onAnswer={(role) => actions.answerMoney({ action: 'name', key: p.key, role })} />
          ))}
        </>
      )}

      {read && read.toName.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Who paid you</span><span className="count">one tap each</span></div>
          <p className="cp-help cp2-bank-why">A client’s payments from the last 30 days count as wins toward your goal. Your own accounts drop out of income and spending.</p>
          {read.toName.map((p) => {
            const s = m.suggest[p.key];
            return (
              <Question key={p.key} title={p.name} line={`${money(p.total)} in ${p.count} payment${p.count === 1 ? '' : 's'} · last ${dayLabel(p.last)}`}
                options={[
                  ...(s ? [{ label: `Client: ${s.title}`, role: 'client' as PayeeRole, opportunityId: s.id }] : []),
                  ...PAYEE_ROLES.map((role) => ({ label: s && role === 'client' ? 'Another client' : ROLE_LABEL[role], role })),
                ]}
                onAnswer={(role, opportunityId) => actions.answerMoney({ action: 'name', key: p.key, role, opportunity_id: opportunityId ?? null })} />
            );
          })}
        </>
      )}

      {m.named.length > 0 && (
        <>
          <div className="cp-subhead">Named by you</div>
          {m.named.map((n) => (
            <div key={n.key} className="cp-kv">
              <span>{n.name}</span>
              <b>
                {ROLE_LABEL[n.role]}{n.linked ? ' · linked' : ''}
                {' '}<button className="cp2-x" aria-label={`Take back what you said about ${n.name}`} onClick={() => void actions.answerMoney({ action: 'name', key: n.key, role: null })}>×</button>
              </b>
            </div>
          ))}
        </>
      )}

      {read && read.recurring.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">Repeat bills</span><span className="count">{money(read.recurringPerMonth)} a month</span></div>
          {read.recurring.map((r) => (
            <div key={r.key} className="cp-kv">
              <span>{r.name}</span>
              <b>{money(r.amount)} {EVERY[r.every]} · next {dayLabel(r.next)}</b>
            </div>
          ))}
        </>
      )}

      {onFile.length > 0 && (
        <>
          <div className="cp-section"><span className="lead">On file</span><span className="count">{onFile.length} statement{onFile.length === 1 ? '' : 's'}</span></div>
          {onFile.map((i) => <OnFileRow key={i.id} i={i} actions={actions} />)}
        </>
      )}

      {(m.rows > 0 || m.imports.length > 0) && <Forget actions={actions} />}
    </div>
  );
}

/** A reading that could not vouch for itself: the totals, for the person to hold against their statement. */
function ReviewCard({ i, money, actions }: { i: MoneyImport; money: (n: number | null | undefined, cur?: string) => string; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  const cur = i.currency ?? undefined;
  const act = async (action: 'confirm' | 'discard') => { setBusy(true); await actions.answerMoney({ action, id: i.id }); setBusy(false); };
  return (
    <div className="cp-src cp2-bank-card">
      <div className="ct">Check {i.fileName ?? 'this statement'} before it counts</div>
      <div className="cs">
        {i.rowsFound} row{i.rowsFound === 1 ? '' : 's'}
        {i.periodStart && i.periodEnd ? ` · ${dayLabel(i.periodStart)} to ${dayLabel(i.periodEnd)}` : ''}
        {' · '}{money(i.totalIn, cur)} in · {money(i.totalOut, cur)} out
      </div>
      <div className="cs">
        {i.check === 'unbalanced' && i.checkDetail
          ? i.checkDetail
          : 'It printed no balances to check the rows against, so it counts once you say these totals match your statement.'}
        {i.rowsDropped ? ` ${i.rowsDropped} line${i.rowsDropped === 1 ? '' : 's'} could not be read at all.` : ''}
      </div>
      <div className="acts">
        <button className="cp-connect" disabled={busy} onClick={() => void act('confirm')}>They match</button>
        <button className="cp-connect ghost" disabled={busy} onClick={() => void act('discard')}>Discard</button>
      </div>
    </div>
  );
}

/**
 * A file that never said what money it is in — a budgeting app's export, most
 * often. Until it is said, its rows are not added to a statement that names a
 * currency: pesos summed into a euro account read as a fortune.
 */
function CurrencyQuestion({ i, options, actions }: { i: MoneyImport; options: string[]; actions: Actions }) {
  const [busy, setBusy] = useState(false);
  const [other, setOther] = useState('');
  const answer = async (currency: string) => { setBusy(true); await actions.answerMoney({ action: 'currency', id: i.id, currency }); setBusy(false); };
  return (
    <div className="cp-src cp2-bank-card">
      <div className="ct">Which currency is {i.fileName ?? 'this file'} in?</div>
      <div className="cs">The file does not say. Until you do, its {i.rowsFound ?? ''} rows are not added to a statement that names one.</div>
      <div className="cp-chips cp2-bank-chips">
        {options.map((c) => <button key={c} className="cp-fchip" disabled={busy} onClick={() => void answer(c)}>{c}</button>)}
      </div>
      <div className="cp-input-row cp2-bank-cur">
        <input className="cp-input sm" value={other} maxLength={3} onChange={(e) => setOther(e.target.value.toUpperCase())} placeholder="PHP" aria-label="Another currency, three letters" />
        <button className="cp-connect" disabled={busy || !/^[A-Z]{3}$/.test(other)} onClick={() => void answer(other)}>Use it</button>
      </div>
    </div>
  );
}

/** One question, a chip per answer. The answer is the whole interaction. */
function Question({ title, line, options, onAnswer }: {
  title: string;
  line: string;
  options: Array<{ label: string; role: PayeeRole; opportunityId?: string }>;
  onAnswer: (role: PayeeRole, opportunityId?: string) => Promise<{ ok: boolean }>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="cp-src cp2-bank-card">
      <div className="ct">{title}</div>
      <div className="cs">{line}</div>
      <div className="cp-chips cp2-bank-chips">
        {options.map((o) => (
          <button key={o.label} className="cp-fchip" disabled={busy} onClick={async () => { setBusy(true); await onAnswer(o.role, o.opportunityId); setBusy(false); }}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function OnFileRow({ i, actions }: { i: MoneyImport; actions: Actions }) {
  // Two taps: a statement is months of rows, and the first tap says what the second does.
  const [armed, setArmed] = useState(false);
  const checkWord = i.check === 'balanced' ? 'balances add up' : i.check === 'no_balances' ? (i.method === 'parsed' ? 'no balances printed to check' : 'you checked the totals') : 'you checked the totals';
  return (
    <div className="cp-src cp2-bank-card">
      <div className="ct">{i.fileName ?? 'Statement'}</div>
      <div className="cs">
        {i.periodStart && i.periodEnd ? `${dayLabel(i.periodStart)} to ${dayLabel(i.periodEnd)} · ` : ''}
        {i.rowsFound} rows{i.rowsNew != null && i.rowsNew !== i.rowsFound ? ` (${i.rowsNew} new)` : ''}{i.currency ? ` · ${i.currency}` : ''} · {checkWord}
      </div>
      {i.skipped && <div className="cs">{i.skipped}</div>}
      {/* Something that did not follow the rows in — a win that could not be recorded — is said here, beside them. */}
      {i.note && <div className="cs bad">{i.note}</div>}
      <div className="acts">
        <button className="cp-connect ghost" onClick={() => (armed ? void actions.answerMoney({ action: 'discard', id: i.id }) : setArmed(true))}>
          {armed ? 'Remove it and its rows' : 'Remove'}
        </button>
      </div>
      {armed && <div className="cs">Wins its payments already became stay.</div>}
    </div>
  );
}

function Forget({ actions }: { actions: Actions }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return <button className="cp-link cp2-bank-forget" onClick={() => setOpen(true)}>Delete everything read off your bank</button>;
  return (
    <div className="cp-src cp2-bank-card">
      <div className="ct">Delete every row, statement and payer</div>
      <div className="cs">Runway goes back to what you typed, if anything. Wins already recorded stay. Type DELETE to confirm.</div>
      <input className="cp-input sm" value={word} onChange={(e) => setWord(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" />
      <div className="acts">
        <button className="cp-connect" disabled={busy || word.trim().toUpperCase() !== 'DELETE'} onClick={async () => { setBusy(true); const r = await actions.answerMoney({ action: 'forget', confirm: word }); setBusy(false); if (r.ok) setOpen(false); }}>Delete it all</button>
        <button className="cp-connect ghost" onClick={() => { setOpen(false); setWord(''); }}>Keep it</button>
      </div>
    </div>
  );
}
