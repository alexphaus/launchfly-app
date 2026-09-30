// src/lib/copilot/money/statement.ts
// A bank statement, read into rows — and nothing read is trusted until the
// arithmetic says so.
//
// Why this exists. Everything the app knew about somebody's money was typed:
// cash and burn on one sheet, wins one at a time, invoices one at a time. So
// the money factor in scoreMove was 1.0 on nearly every Move (obligations.ts),
// and runway was whatever was typed last month. A statement is the person's
// own record, written by their bank, and it arrives with its history: twelve
// months on day one, not twelve months of collecting.
//
// Two ways in, and they are not trusted the same:
//
//   parsed  CSV, TSV and OFX exports. Deterministic: the bank wrote the rows,
//           this file only splits them. Nothing is invented, so an export with
//           no balance column is used as it is.
//   read    PDFs and screenshots, where a model copies the rows out
//           (extract.ts). A model can drop a row, misread a digit or flip a
//           sign, so its reading is a proposal until the balances printed on
//           the statement reconcile — opening + every row = closing — or the
//           person looks at the totals and says they match (checkBalances).
//
// Pure: no DB import, no Node import. The route reads the file, this turns it
// into rows, ledger.ts turns rows into what the screen says.

/* ─── Shapes ──────────────────────────────────────────────────────────────── */

export interface StatementRow {
  /** YYYY-MM-DD, the day it posted. */
  on: string;
  /** Signed, in the statement's currency: money in is positive, money out negative. */
  amount: number;
  /** As printed, trimmed. */
  description: string;
  /** The running balance after this row, when the statement prints one. */
  balance: number | null;
  /** A name for the other side, when whatever read the row gave one. The description decides otherwise. */
  counterparty?: string | null;
  /** What it was for, when the file says — a budgeting app's category column. The Money tab groups and picks by it. */
  category?: string | null;
}

export interface StatementAccount {
  /** "BPI", "Revolut" — read off the file, never guessed. */
  institution: string | null;
  /** The last digits of the account number, when printed. */
  mask: string | null;
}

export interface Statement {
  rows: StatementRow[];
  currency: string | null;
  account: StatementAccount;
  /** The balance before the first row, as printed. */
  opening: number | null;
  /** The balance after the last row, as printed. */
  closing: number | null;
}

export type StatementFormat = 'csv' | 'ofx' | 'pdf' | 'image';
export type BalanceCheck = 'balanced' | 'unbalanced' | 'no_balances';

/** The file types this reads, for the upload control and the route alike. */
export const STATEMENT_ACCEPT = '.csv,.tsv,.txt,.ofx,.qfx,.pdf,image/png,image/jpeg,image/webp';
/** Past this a file is not a statement, or not one worth a model call per page. */
export const MAX_STATEMENT_BYTES = 10 * 1024 * 1024;
/** Rows past this in one file are a data dump, not a statement; the rest are kept out and said. */
export const MAX_STATEMENT_ROWS = 3000;

/* ─── Which kind of file ──────────────────────────────────────────────────── */

/**
 * What a file is, from its first bytes and then its name. The bytes win: a
 * screenshot saved as "statement.csv" is still an image, and a CSV renamed
 * .txt is still a CSV.
 */
export function sniffFormat(head: Uint8Array, name: string, mediaType = ''): StatementFormat | 'spreadsheet' | null {
  const b = head;
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (starts(0x25, 0x50, 0x44, 0x46)) return 'pdf'; // %PDF
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image'; // PNG
  if (starts(0xff, 0xd8, 0xff)) return 'image'; // JPEG
  if (starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image'; // RIFF....WEBP
  // XLSX and friends are zip files. Said rather than guessed at: a spreadsheet
  // has to be saved as CSV, and the route tells the person exactly that.
  if (starts(0x50, 0x4b, 0x03, 0x04) || starts(0xd0, 0xcf, 0x11, 0xe0)) return 'spreadsheet';
  const text = asciiHead(b);
  if (/OFXHEADER|<OFX>/i.test(text)) return 'ofx';
  const lower = name.toLowerCase();
  if (/\.(ofx|qfx)$/.test(lower)) return 'ofx';
  if (/\.(csv|tsv|txt)$/.test(lower) || /^text\//.test(mediaType)) return 'csv';
  if (/^image\//.test(mediaType)) return 'image';
  // Text that splits into a few columns is a CSV whatever it was called.
  return looksDelimited(text) ? 'csv' : null;
}

function asciiHead(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < Math.min(b.length, 2048); i++) s += String.fromCharCode(b[i]);
  return s;
}

function looksDelimited(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5);
  return lines.length >= 2 && lines.every((l) => /[,;\t|]/.test(l));
}

/* ─── Numbers ─────────────────────────────────────────────────────────────── */

/** To the cent, so a hundred rows of floating point cannot make a balance miss. */
export const cents = (n: number): number => Math.round(n * 100);

/**
 * Which character is the decimal point in a column of amounts: a vote across
 * the values, since one value alone ("1.234") cannot say. Currency is almost
 * always written to two places, so three digits after a separator mean it was
 * a thousands separator.
 */
export function inferDecimal(values: string[]): '.' | ',' {
  let dot = 0;
  let comma = 0;
  for (const raw of values) {
    const v = raw.replace(/[^\d.,]/g, '');
    if (!v) continue;
    const lastDot = v.lastIndexOf('.');
    const lastComma = v.lastIndexOf(',');
    if (lastDot >= 0 && lastComma >= 0) { if (lastDot > lastComma) dot++; else comma++; continue; }
    const sep = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : null;
    if (!sep) continue;
    const after = v.length - Math.max(lastDot, lastComma) - 1;
    if (after === 3) { if (sep === '.') comma++; else dot++; }
    else if (after >= 1) { if (sep === '.') dot++; else comma++; }
  }
  return comma > dot ? ',' : '.';
}

/**
 * One amount as a bank writes it: "1,234.56", "1.234,56", "(45.00)", "45.00-",
 * "-€45", "45.00 DR", "PHP 1,200". Null for anything that is not a number
 * once the currency and the separators are gone — never a guess.
 */
export function parseAmount(raw: string, decimal: '.' | ',' = '.'): number | null {
  let s = raw.replace(/[   ]/g, ' ').trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  // "45.00 DR", "45.00CR" — the marker has to sit right after a digit, or the
  // D at the end of "45.00 USD" would read as a debit.
  const suffix = s.match(/^(.*?\d)\s*(DR|CR|D|C)\.?$/i);
  if (suffix) {
    if (/^d/i.test(suffix[2])) negative = !negative;
    s = suffix[1];
  }
  s = s.trim();
  if (/-$/.test(s)) { negative = !negative; s = s.slice(0, -1); }
  if (/^[-−–]/.test(s) || /^[^\d-−–]*[-−–]\s*\d/.test(s)) negative = !negative;
  // Currency symbols and codes, wherever they sit.
  s = s.replace(/[-−–+]/g, '').replace(/[A-Za-z$€£¥₱₹₩₦₺₽฿₫]+/g, '').replace(/\s+/g, '');
  if (decimal === ',') s = s.replace(/[.']/g, '').replace(',', '.');
  else s = s.replace(/[,']/g, '');
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/* ─── Dates ───────────────────────────────────────────────────────────────── */

export type DateOrder = 'dmy' | 'mdy';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, ene: 1, enero: 1, janv: 1, janvier: 1, januar: 1,
  feb: 2, february: 2, febrero: 2, fev: 2, fevr: 2, fevrier: 2, februar: 2,
  mar: 3, march: 3, marzo: 3, mars: 3, mrz: 3, marz: 3, maerz: 3,
  apr: 4, april: 4, abr: 4, abril: 4, avr: 4, avril: 4,
  may: 5, mayo: 5, mai: 5,
  jun: 6, june: 6, junio: 6, juin: 6, juni: 6,
  jul: 7, july: 7, julio: 7, juil: 7, juillet: 7, juli: 7,
  aug: 8, august: 8, ago: 8, agosto: 8, aout: 8,
  sep: 9, sept: 9, september: 9, set: 9, septiembre: 9, setiembre: 9, septembre: 9,
  oct: 10, october: 10, octubre: 10, octobre: 10, okt: 10, oktober: 10,
  nov: 11, november: 11, noviembre: 11, novembre: 11,
  dec: 12, december: 12, dic: 12, diciembre: 12, decembre: 12, dez: 12, dezember: 12,
};

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

function isoDay(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** The two numbers of a slashed date that do not include the year, for deciding the order. */
function slashedParts(raw: string): [number, number] | null {
  const m = raw.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * One date as a bank writes it. ISO and compact (20260912) are unambiguous;
 * "12/09/2026" is read in the order given; month names are read in English,
 * Spanish, French and German. A time after the date is ignored. Null for
 * anything else, including a date with no year — a statement row placed in
 * the wrong year is worse than one left out and counted.
 */
export function parseDateCell(raw: string, order: DateOrder = 'dmy'): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return isoDay(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{4})(\d{2})(\d{2})(?:\D|$)/);
  if (m) return isoDay(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) {
    const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return order === 'mdy' ? isoDay(y, a, b) : isoDay(y, b, a);
  }
  const f = fold(s);
  m = f.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]*([a-z]{3,10})\.?[\s\-/.,]*(\d{2,4})\b/);
  if (m && MONTHS[m[2]]) return isoDay(Number(m[3]), MONTHS[m[2]], Number(m[1]));
  m = f.match(/^([a-z]{3,10})\.?[\s\-/.]*(\d{1,2})(?:st|nd|rd|th)?[\s,\-/.]+(\d{2,4})\b/);
  if (m && MONTHS[m[1]]) return isoDay(Number(m[3]), MONTHS[m[1]], Number(m[2]));
  return null;
}

/**
 * Day-first or month-first, for a column of slashed dates. A part over 12
 * settles it. Otherwise the order that keeps the column in date order wins,
 * since a statement is sorted; a tie goes to the hint (the person's timezone,
 * read by the caller).
 */
export function inferDateOrder(values: string[], hint: DateOrder = 'dmy'): DateOrder {
  let dmy = false;
  let mdy = false;
  for (const v of values) {
    const p = slashedParts(v);
    if (!p) continue;
    if (p[0] > 12) dmy = true;
    if (p[1] > 12) mdy = true;
  }
  if (dmy !== mdy) return dmy ? 'dmy' : 'mdy';
  const disorder = (order: DateOrder) => {
    const days = values.map((v) => parseDateCell(v, order)).filter((d): d is string => !!d);
    let up = 0;
    let down = 0;
    for (let i = 1; i < days.length; i++) {
      if (days[i] > days[i - 1]) up++;
      else if (days[i] < days[i - 1]) down++;
    }
    return Math.min(up, down);
  };
  const a = disorder('dmy');
  const b = disorder('mdy');
  return a === b ? hint : a < b ? 'dmy' : 'mdy';
}

/** The person's own convention, from their timezone: month-first in the US, day-first nearly everywhere else. */
export function dateHintFor(timezone: string | null | undefined): DateOrder {
  return /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana|Kentucky|North_Dakota|Juneau|Sitka|Nome|Adak|Metlakatla|Yakutat|Menominee)|^US\/|^Pacific\/Honolulu/.test(timezone ?? '') ? 'mdy' : 'dmy';
}

/* ─── CSV ─────────────────────────────────────────────────────────────────── */

/** The separator a file uses: the candidate that splits its first lines into the same number of fields, most often. */
export function sniffDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 25);
  let best = ',';
  let bestScore = -1;
  for (const d of [',', ';', '\t', '|']) {
    const counts = lines.map((l) => splitLine(l, d).length).filter((n) => n > 1);
    if (!counts.length) continue;
    const mode = modeOf(counts);
    const score = counts.filter((n) => n === mode).length * mode;
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

function modeOf(ns: number[]): number {
  const tally = new Map<number, number>();
  for (const n of ns) tally.set(n, (tally.get(n) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

function splitLine(line: string, d: string): string[] {
  return splitCsv(line, d)[0] ?? [];
}

/**
 * Fields, the RFC 4180 way: quotes around a field, doubled quotes inside one,
 * and a delimiter or a line break inside quotes kept as text. Written out
 * because a bank's "Description" is exactly where a comma turns up.
 */
export function splitCsv(text: string, d: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field.trim() === '') { quoted = true; field = ''; continue; }
    if (c === d) { row.push(field); field = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row.map((x) => x.trim()));
      row = [];
      continue;
    }
    field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row.map((x) => x.trim()));
  return rows;
}

type Role = 'date' | 'description' | 'party' | 'category' | 'amount' | 'debit' | 'credit' | 'balance' | 'currency' | 'type' | 'status' | 'from' | 'to';

/**
 * What a header names. Order matters: "Debit amount" is a debit column, not an
 * amount column, and "Value date" loses to a posting date when both are there.
 */
function roleOf(header: string): Role | null {
  if (header.includes('#')) return null;
  const h = fold(header).replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!h) return null;
  // "Transaction ID", "Card number": identifiers, which would otherwise be
  // joined into the description and split one payee into a hundred.
  if (/\b(id|number|no|nr|num)\b/.test(h)) return null;
  // The person's own name on every card row ("Card Holder Full Name") is not
  // who the money went to.
  if (/\b(holder|cardholder|titular)\b/.test(h)) return null;
  if (/\b(balance|saldo|solde|kontostand|running bal)/.test(h)) return 'balance';
  // Before debit and credit: "Debit/Credit" is a column saying which, not an amount.
  if (/^(dr ?\/ ?cr|cr ?\/ ?dr|debit ?\/ ?credit|credit ?\/ ?debit|type|tipo|transaction type|trans type)$/.test(h)) return 'type';
  // Whether it happened yet: a budgeting app's "Pending", a bank's "State".
  if (/^(pending|status|state|estado|estatus|transaction status|txn status)$/.test(h)) return 'status';
  // A budgeting app's two accounts on a transfer between them.
  if (/^(from account|from acc|source account)$/.test(h)) return 'from';
  if (/^(to account|to acc|destination account)$/.test(h)) return 'to';
  if (/\b(debit|debits|withdrawal|withdrawals|paid out|money out|cargo|cargos|retiro|retiros|egreso|egresos|debe|ausgang|sortie)\b/.test(h)) return 'debit';
  if (/\b(credit|credits|deposit|deposits|paid in|money in|abono|abonos|ingreso|ingresos|haber|eingang|entree)\b/.test(h)) return 'credit';
  if (/\b(currency|moneda|divisa|devise|wahrung)\b/.test(h) || h === 'ccy' || h === 'curr') return 'currency';
  if (/\b(date|fecha|datum|data|posted|booking|buchungstag|valuta)\b/.test(h)) return 'date';
  if (/\b(amount|importe|monto|montant|betrag|valor|value|sum|total)\b/.test(h)) return 'amount';
  if (/\b(category|categoria|categorie|kategorie)\b/.test(h)) return 'category';
  // Who the money was with, when the file says so in a column of its own.
  if (/\b(payee|payer|merchant|counterparty|counter party|beneficiary|recipient|sender|name|nombre|empfanger|beguenstigter)\b/.test(h)) return 'party';
  if (/\b(description|descripcion|details|detail|narrative|narration|memo|concepto|particulars|reference|beschreibung|verwendungszweck|libelle|transaction|remarks|notes?)\b/.test(h)) return 'description';
  return null;
}

interface Columns {
  date: number;
  description: number[];
  party: number[];
  category: number | null;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  currency: number | null;
  type: number | null;
  status: number | null;
  from: number | null;
  to: number | null;
}

const noColumns = (): Omit<Columns, 'date'> => ({ description: [], party: [], category: null, amount: null, debit: null, credit: null, balance: null, currency: null, type: null, status: null, from: null, to: null });

function columnsOf(header: string[]): Columns | null {
  const cols: Columns = { date: -1, ...noColumns() };
  const dates: number[] = [];
  header.forEach((h, i) => {
    const r = roleOf(h);
    if (r === 'date') dates.push(i);
    else if (r === 'description' || r === 'party') cols[r].push(i);
    else if (r && cols[r] == null) cols[r] = i;
  });
  // A posting date over a value date, when a file carries both.
  cols.date = dates.find((i) => !/valu|valor|valuta/.test(fold(header[i]))) ?? dates[0] ?? -1;
  if (cols.date < 0) return null;
  if (cols.amount == null && cols.debit == null && cols.credit == null) return null;
  return cols;
}

/**
 * Headerless files: the column most of whose cells are dates, the numeric
 * columns after it, and the longest text column as the description. Only
 * trusted when the shape is unmistakable — one date column and one or two
 * amount columns.
 */
function columnsFromContent(rows: string[][]): Columns | null {
  const width = modeOf(rows.map((r) => r.length));
  const sample = rows.filter((r) => r.length === width).slice(0, 40);
  if (sample.length < 3) return null;
  const share = (i: number, test: (v: string) => boolean) => sample.filter((r) => test(r[i] ?? '')).length / sample.length;
  let date = -1;
  const numeric: number[] = [];
  let description = -1;
  let longest = 0;
  for (let i = 0; i < width; i++) {
    if (date < 0 && share(i, (v) => !!parseDateCell(v, 'dmy') || !!parseDateCell(v, 'mdy')) > 0.8) { date = i; continue; }
    if (share(i, (v) => v === '' || parseAmount(v, inferDecimal([v])) != null) > 0.9 && share(i, (v) => v !== '') > 0.3) { numeric.push(i); continue; }
    const len = sample.reduce((a, r) => a + (r[i]?.length ?? 0), 0);
    if (len > longest) { longest = len; description = i; }
  }
  if (date < 0 || !numeric.length || description < 0) return null;
  // One amount and maybe a running balance after it; with three numbers the
  // shape is debit, credit, balance.
  const base = { ...noColumns(), date, description: [description] };
  if (numeric.length === 1) return { ...base, amount: numeric[0] };
  if (numeric.length === 2) return { ...base, amount: numeric[0], balance: numeric[1] };
  if (numeric.length === 3) return { ...base, debit: numeric[0], credit: numeric[1], balance: numeric[2] };
  return null;
}

const OPENING = /\b(opening|beginning|starting|previous|brought forward|b\/f|saldo (inicial|anterior)|solde (initial|precedent)|anfangssaldo)\b/i;
const CLOSING = /\b(closing|ending|final|carried forward|c\/f|saldo (final|actual)|solde final|endsaldo|available balance)\b/i;

export interface ParsedCsv {
  statement: Statement;
  /** Lines that could not be read as a transaction at all. */
  dropped: number;
  truncated: number;
  /**
   * Lines read and deliberately left out, by why — said on the statement, so
   * a total that differs from the file is explained rather than suspicious.
   */
  skipped?: Skipped;
}

export interface Skipped {
  /** Not happened yet: marked pending or scheduled, or dated after today. */
  scheduled: number;
  /** Money moved between two accounts inside the same export, which is neither income nor spending. */
  internal: number;
  /** Marked cancelled, declined, failed or reverted. */
  void: number;
  /** In another currency than most of the file: one statement is one currency, and these would be summed as if they were. */
  foreign?: number;
}

/** "Left out 24 scheduled rows and 2 transfers between your own accounts." Null when nothing was. */
export function skippedLine(s: Skipped | null | undefined): string | null {
  if (!s) return null;
  const n = (k: number, one: string, many: string) => (k ? `${k} ${k === 1 ? one : many}` : null);
  const parts = [
    n(s.scheduled, 'scheduled row (pending or dated after today)', 'scheduled rows (pending or dated after today)'),
    n(s.internal, 'transfer between your own accounts', 'transfers between your own accounts'),
    n(s.void, 'cancelled or declined row', 'cancelled or declined rows'),
    n(s.foreign ?? 0, 'row in another currency (upload that currency’s statement on its own)', 'rows in other currencies (upload each currency’s statement on its own)'),
  ].filter(Boolean);
  if (!parts.length) return null;
  return `Left out ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]}.`;
}

/** A pending flag or a status that says it has not happened, or will not. */
const NOT_YET = /^(yes|y|true|1|si|pending|pendiente|en proceso|processing|scheduled|planned|upcoming|future|authorised|authorized|hold|on hold)$/;
// Not refunded or returned: a refund arrives as a row of its own, and dropping the original would leave the refund as income.
const VOID = /^(cancelled|canceled|cancelado|declined|rechazado|failed|reverted|void|voided|rejected)$/;

/**
 * A CSV or TSV export into a statement. Throws with a sentence a person can act
 * on when the file is not one — the route shows it as the import's reason.
 *
 * `today` is the person's own: a budgeting app exports its scheduled bills a
 * year ahead, and a row dated next June is not money anybody has spent.
 */
export function parseCsvStatement(text: string, opts: { dateHint?: DateOrder; today?: string } = {}): ParsedCsv {
  const d = sniffDelimiter(text);
  const all = splitCsv(text, d);
  if (all.length < 2) throw new Error('That file has fewer than two lines, so there are no transactions in it.');

  // Banks put an account line or three above the header. The header is the
  // first line that names a date and an amount.
  let headerAt = -1;
  let cols: Columns | null = null;
  for (let i = 0; i < Math.min(all.length, 30); i++) {
    const c = columnsOf(all[i]);
    if (c) { headerAt = i; cols = c; break; }
  }
  let body = headerAt >= 0 ? all.slice(headerAt + 1) : all;
  if (!cols) {
    cols = columnsFromContent(all);
    if (!cols) throw new Error('Could not find a date column and an amount column in that file. Download the CSV from your bank’s website, or upload the PDF statement instead.');
    body = all;
  }
  const c = cols;
  const preamble = headerAt > 0 ? all.slice(0, headerAt).map((r) => r.join(' ')).join(' ') : '';

  const pick = (r: string[], i: number | null) => (i == null ? '' : r[i] ?? '');
  const order = inferDateOrder(body.map((r) => pick(r, c.date)), opts.dateHint ?? 'dmy');
  const numericCells = [c.amount, c.debit, c.credit, c.balance].flatMap((i) => (i == null ? [] : body.map((r) => pick(r, i))));
  const dec = inferDecimal(numericCells);

  const rows: StatementRow[] = [];
  let dropped = 0;
  const skipped: Skipped = { scheduled: 0, internal: 0, void: 0, foreign: 0 };
  const rowCurrency: string[] = [];
  let opening: number | null = null;
  let closing: number | null = null;
  const currencies = new Map<string, number>();
  const joined = (idx: number[], r: string[]) => idx.map((i) => pick(r, i)).filter(Boolean).join(' · ').replace(/\s+/g, ' ').slice(0, 300);
  for (const r of body) {
    const on = parseDateCell(pick(r, c.date), order);
    const party = c.party.map((i) => pick(r, i)).find((x) => x.trim()) ?? '';
    // What it was: the file's description, else who it was with, else a
    // budgeting app's category — "Dining Out" beats every blank note landing
    // on one payee called "(no description)".
    const description = joined(c.description, r) || party.slice(0, 300) || pick(r, c.category).slice(0, 120);
    const balance = c.balance != null ? parseAmount(pick(r, c.balance), dec) : null;
    if (!on) {
      // "Opening balance" and "Closing balance" lines have no date and are
      // exactly the numbers the check needs.
      const label = r.join(' ');
      const figure = balance ?? (c.amount != null ? parseAmount(pick(r, c.amount), dec) : null);
      if (figure != null && OPENING.test(label)) opening = figure;
      else if (figure != null && CLOSING.test(label)) closing = figure;
      else if (r.some((x) => x.trim())) dropped++;
      continue;
    }
    let amount: number | null = null;
    if (c.amount != null) {
      amount = parseAmount(pick(r, c.amount), dec);
      const type = fold(pick(r, c.type));
      // An unsigned amount with a DR/CR column beside it.
      if (amount != null && amount > 0 && /^(dr|d|debit|debito|cargo|withdrawal|out)\b/.test(type)) amount = -amount;
    }
    if (amount == null && (c.debit != null || c.credit != null)) {
      const out = parseAmount(pick(r, c.debit), dec);
      const inn = parseAmount(pick(r, c.credit), dec);
      if (out != null || inn != null) amount = (inn != null ? Math.abs(inn) : 0) - (out != null ? Math.abs(out) : 0);
    }
    // A dated "Balance brought forward" line carries the opening balance and no amount.
    if ((amount == null || cents(amount) === 0) && balance != null && (OPENING.test(description) || CLOSING.test(description))) {
      if (OPENING.test(description) && opening == null) opening = balance;
      else if (CLOSING.test(description)) closing = balance;
      continue;
    }
    if (amount == null || cents(amount) === 0) { dropped++; continue; }
    const status = fold(pick(r, c.status)).trim();
    if (VOID.test(status)) { skipped.void++; continue; }
    if (NOT_YET.test(status) || (opts.today && on > opts.today)) { skipped.scheduled++; continue; }
    // A transfer between two accounts inside the same export: both sides are
    // the person's, so it is neither income nor spending. Only when the file
    // names both — a bank's "TRANSFER" is money sent to somebody else.
    if (/transfer|transferencia|virement/.test(fold(pick(r, c.type))) && pick(r, c.from).trim() && pick(r, c.to).trim()) { skipped.internal++; continue; }
    const cur = pick(r, c.currency).toUpperCase();
    if (/^[A-Z]{3}$/.test(cur)) currencies.set(cur, (currencies.get(cur) ?? 0) + 1);
    rowCurrency.push(/^[A-Z]{3}$/.test(cur) ? cur : '');
    const category = pick(r, c.category).trim().slice(0, 40) || null;
    rows.push({ on, amount, description: description || '(no description)', balance, counterparty: party.trim() ? party.trim().slice(0, 80) : null, category });
  }
  if (!rows.length) {
    if (skipped.scheduled || skipped.internal || skipped.void) throw new Error(`No row in that file is money that has moved. ${skippedLine(skipped)}`);
    throw new Error('No transactions came out of that file: no row had both a date and an amount.');
  }
  const currency = currencies.size ? [...currencies.entries()].sort((a, b) => b[1] - a[1])[0][0] : currencyIn(preamble);
  // Every row is stored in the file's one currency, so a row that names another is left out, not relabelled.
  const kept = currency ? rows.filter((_, i) => !rowCurrency[i] || rowCurrency[i] === currency) : rows;
  skipped.foreign = rows.length - kept.length;
  const truncated = Math.max(0, kept.length - MAX_STATEMENT_ROWS);
  return {
    statement: { rows: kept.slice(0, MAX_STATEMENT_ROWS), currency, account: accountIn(preamble), opening, closing },
    dropped,
    truncated,
    skipped,
  };
}

/** A three-letter code named in text, when there is exactly one kind. */
function currencyIn(text: string): string | null {
  const codes = (text.toUpperCase().match(/\b(USD|EUR|GBP|PHP|MXN|COP|ARS|CLP|PEN|BRL|CAD|AUD|NZD|INR|SGD|HKD|JPY|CHF|SEK|NOK|DKK|PLN|ZAR|NGN|KES|IDR|MYR|THB|VND|AED)\b/g) ?? []);
  const unique = [...new Set(codes)];
  return unique.length === 1 ? unique[0] : null;
}

/** The last digits of an account number in a preamble line, when one is printed. */
function accountIn(text: string): StatementAccount {
  const m = text.match(/(?:account|acct|cuenta|iban|konto|compte)[^\d]{0,24}([\dX*•\- ]{4,34}\d)/i);
  const digits = m ? m[1].replace(/\D/g, '') : '';
  return { institution: null, mask: digits.length >= 4 ? digits.slice(-4) : null };
}

/* ─── A PDF's text, read without a model ──────────────────────────────────── */

/** A money figure as the last two tokens of a statement line print it: "-3.65", "1,234.56", "(12.00)", "45.00CR". */
const FIGURE = /^[-−–+]?\(?[\d.,']*\d[.,]\d{2}\)?(?:CR|DR)?$/i;

/** Lines that start a page or a table, after which a description starts fresh. */
const PAGE_HEADER = /^(ref:|page \d+|pagina \d+|p[aá]gina \d+|\d+\s*\/\s*\d+$)|\s\d+\s*\/\s*\d+$/i;
const COLUMN_WORDS = /\b(description|date|amount|balance|incoming|outgoing|debit|credit|details|fecha|importe|saldo|concepto|withdrawals|deposits|particulars)\b/gi;

/** The date a line starts with, and the line without it. Only the unambiguous shapes: a year is required. */
function leadingDate(line: string, order: DateOrder): { on: string; rest: string } | null {
  const on = parseDateCell(line, order);
  if (!on) return null;
  const m = line.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?[\s\-/.]*[A-Za-zÀ-ÿ]{3,10}\.?[\s\-/.,]*\d{2,4}|[A-Za-zÀ-ÿ]{3,10}\.?[\s\-/.]*\d{1,2}(?:st|nd|rd|th)?[\s,\-/.]+\d{2,4})/);
  return { on, rest: m ? line.slice(m[0].length).trim() : line };
}

/** The currency a statement declares itself in: "EUR statement", "Currency: PHP", else the one code it names. */
export function statementCurrency(text: string): string | null {
  const head = text.slice(0, 3000);
  const m = head.match(/\b([A-Z]{3})\s+statement\b/) ?? head.match(/\bstatement\s+(?:in\s+)?([A-Z]{3})\b/i) ?? head.match(/\bcurrency\s*[:\-]?\s*([A-Z]{3})\b/i);
  return m ? m[1].toUpperCase() : currencyIn(head);
}

const INSTITUTIONS = /\b(Wise|Revolut|N26|Monzo|Starling|bunq|Payoneer|PayPal|GCash|Maya|BPI|BDO|Metrobank|UnionBank|Security Bank|RCBC|Chase|Wells Fargo|Bank of America|Barclays|HSBC|Lloyds|NatWest|Santander|BBVA|CaixaBank|ING|Deutsche Bank|Nubank|Mercado Pago)\b/i;

/** The account a statement's text names: the bank, and the last digits of an IBAN or account number. */
function accountInText(text: string): StatementAccount {
  const head = text.slice(0, 3000);
  const iban = head.match(/\bIBAN\b[\s:]*([A-Z]{2}\d{2}[A-Z0-9 ]{8,40})/);
  const digits = iban ? iban[1].replace(/\D/g, '') : '';
  const acct = digits.length >= 4 ? { mask: digits.slice(-4) } : accountIn(head);
  const inst = head.match(INSTITUTIONS);
  return { institution: inst ? inst[1] : null, mask: acct.mask };
}

/**
 * A PDF statement's text layer, read by rules instead of a model — the cheap,
 * exact path, tried first. It claims only the two layouts it cannot misread:
 *
 *   a line that starts with its date and ends with the amount and the
 *   running balance ("12/09/2026 STARBUCKS MANILA -5.50 994.50")
 *
 *   a line that ends with the amount and the balance, its date on the very
 *   next line — how Wise prints every row ("Sent money to X -5.00 0.00", then
 *   "30 June 2026 | Transaction: TRANSFER-…"). A description may run over the
 *   two lines before it.
 *
 * A row either rule cannot date, and the whole reading is refused (null): a
 * row dated by guesswork is worse than asking the model. And the caller uses
 * it only when checkBalances says the chain holds line for line, which no
 * misread column survives — so a reading from here is the bank's arithmetic,
 * not a heuristic's.
 */
export function parseStatementText(text: string, opts: { dateHint?: DateOrder } = {}): ParsedCsv | null {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const tails = lines.map((l) => {
    const t = l.split(' ');
    return t.length >= 2 && FIGURE.test(t[t.length - 1]) && FIGURE.test(t[t.length - 2]) ? { head: t.slice(0, -2).join(' '), a: t[t.length - 2], b: t[t.length - 1] } : null;
  });
  if (tails.filter(Boolean).length < 3) return null;
  const dec = inferDecimal(tails.flatMap((t) => (t ? [t.a, t.b] : [])));
  const order = inferDateOrder(lines.map((l) => l.split(' ').slice(0, 3).join(' ')), opts.dateHint ?? 'dmy');

  const rows: StatementRow[] = [];
  let buffer: string[] = [];
  let waiting: { description: string; amount: number; balance: number } | null = null;
  let orphans = 0;
  let dropped = 0;
  lines.forEach((line, i) => {
    const tail = tails[i];
    const dated = leadingDate(line, order);
    if (!tail && (PAGE_HEADER.test(line) || (line.match(COLUMN_WORDS) ?? []).length >= 2)) { buffer = []; return; }
    if (tail) {
      if (waiting) orphans++;
      waiting = null;
      const head = dated ? leadingDate(tail.head, order)?.rest ?? tail.head : tail.head;
      const description = [...buffer.slice(-2), head].join(' ').replace(/\s+/g, ' ').trim().slice(0, 300) || '(no description)';
      buffer = [];
      const amount = parseAmount(tail.a, dec);
      const balance = parseAmount(tail.b, dec);
      if (amount == null || balance == null || cents(amount) === 0) { dropped++; return; }
      if (dated) rows.push({ on: dated.on, amount, balance, description });
      else waiting = { description, amount, balance };
      return;
    }
    if (dated && waiting) {
      rows.push({ on: dated.on, ...waiting });
      waiting = null;
      buffer = [];
      return;
    }
    buffer.push(line);
  });
  if (waiting) orphans++;
  if (orphans || rows.length < 3) return null;
  const truncated = Math.max(0, rows.length - MAX_STATEMENT_ROWS);
  return {
    statement: { rows: rows.slice(0, MAX_STATEMENT_ROWS), currency: statementCurrency(text), account: accountInText(text), opening: null, closing: null },
    dropped,
    truncated,
  };
}

/**
 * A PDF's pages, read by rules — kept only when the running balance holds on
 * every row. Null hands the file to the model. Wise's 101-row statement lands
 * here: exact, instant, and nothing sent anywhere.
 */
export function statementFromPdfText(pages: string[], opts: { dateHint?: DateOrder } = {}): ParsedCsv | null {
  const parsed = parseStatementText(pages.join('\n'), opts);
  return parsed && checkBalances(parsed.statement).check === 'balanced' ? parsed : null;
}

/* ─── OFX ─────────────────────────────────────────────────────────────────── */

/**
 * OFX and QFX — the "Quicken" / "Money" download most banks offer. SGML in 1.x
 * (no closing tags on fields) and XML in 2.x; both carry each transaction in a
 * STMTTRN block with a signed amount, which is the least ambiguous export there is.
 */
export function parseOfxStatement(text: string): ParsedCsv {
  const field = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
    return m ? m[1].trim() : '';
  };
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) ?? [];
  const rows: StatementRow[] = [];
  let dropped = 0;
  for (const b of blocks) {
    const on = parseDateCell(field(b, 'DTPOSTED').slice(0, 8));
    const amount = parseAmount(field(b, 'TRNAMT'), field(b, 'TRNAMT').includes(',') && !field(b, 'TRNAMT').includes('.') ? ',' : '.');
    const name = field(b, 'NAME') || field(b, 'PAYEE');
    const memo = field(b, 'MEMO');
    if (!on || amount == null || cents(amount) === 0) { dropped++; continue; }
    const description = [name, memo && memo !== name ? memo : ''].filter(Boolean).join(' · ') || '(no description)';
    rows.push({ on, amount, description: decodeEntities(description).slice(0, 300), balance: null });
  }
  if (!rows.length) throw new Error('That OFX file has no transactions in it.');
  const ledger = text.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]*)/i);
  const acct = field(text, 'ACCTID').replace(/\D/g, '');
  const org = field(text, 'ORG');
  rows.sort((a, b) => a.on.localeCompare(b.on));
  const truncated = Math.max(0, rows.length - MAX_STATEMENT_ROWS);
  return {
    statement: {
      rows: rows.slice(0, MAX_STATEMENT_ROWS),
      currency: /^[A-Z]{3}$/i.test(field(text, 'CURDEF')) ? field(text, 'CURDEF').toUpperCase() : null,
      account: { institution: org ? decodeEntities(org).slice(0, 60) : null, mask: acct.length >= 4 ? acct.slice(-4) : null },
      opening: null,
      closing: ledger ? parseAmount(ledger[1]) : null,
    },
    dropped,
    truncated,
  };
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'");
}

/* ─── What was read by a model ────────────────────────────────────────────── */

/**
 * A model's reading of a PDF or a screenshot, held to the same shape as a
 * parsed file. Every field is checked on its own and a row that fails is
 * dropped and counted, never repaired: a row with a made-up date is worse than
 * a row missing, because the balance check can catch a missing one.
 */
export function statementFromReading(raw: unknown): { statement: Statement; dropped: number } {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(o.rows) ? o.rows : Array.isArray(o.transactions) ? o.transactions : null;
  if (!list) throw new Error('The reading came back without any rows.');
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' ? parseAmount(v, inferDecimal([v])) : null);
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const rows: StatementRow[] = [];
  let dropped = 0;
  for (const item of list.slice(0, MAX_STATEMENT_ROWS)) {
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const on = typeof r.date === 'string' ? parseDateCell(r.date) : null;
    const amount = num(r.amount);
    const description = str(r.description, 300);
    if (!on || amount == null || cents(amount) === 0 || !description) { dropped++; continue; }
    const balance = r.balance == null ? null : num(r.balance);
    rows.push({ on, amount, description, balance, counterparty: str(r.counterparty, 80) });
  }
  dropped += Math.max(0, list.length - MAX_STATEMENT_ROWS);
  const currency = str(o.currency, 8);
  const mask = str(o.account_mask, 34)?.replace(/\D/g, '') ?? '';
  return {
    statement: {
      rows,
      currency: currency && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : currency,
      account: { institution: str(o.institution, 60), mask: mask.length >= 4 ? mask.slice(-4) : null },
      opening: o.opening_balance == null ? null : num(o.opening_balance),
      closing: o.closing_balance == null ? null : num(o.closing_balance),
    },
    dropped,
  };
}

/* ─── The check ───────────────────────────────────────────────────────────── */

export interface CheckResult {
  check: BalanceCheck;
  /** Why, in a sentence, when it did not balance. */
  detail: string | null;
  /** The rows oldest first, signs corrected when the balances proved them backwards. */
  rows: StatementRow[];
  opening: number | null;
  closing: number | null;
}

/** Below this share of rows carrying a balance, the running balance is not a chain worth checking. */
const CHAIN_SHARE = 0.8;

/**
 * Does it add up? Two ways a statement can prove itself:
 *
 *   the chain    every row's balance is the one before it plus its amount
 *   the totals   the opening balance plus every row is the closing balance
 *
 * Either one proves no row was dropped and no sign was flipped. A file that
 * lists newest first is turned around, and a file whose amounts come out
 * backwards against its own balances (some exports write debits positive) is
 * corrected — the balances are the bank's arithmetic, and they decide.
 */
export function checkBalances(st: Statement): CheckResult {
  let rows = [...st.rows];
  // Newest first is common. Turned round so the running balance reads forward.
  if (rows.length > 1 && rows[0].on > rows[rows.length - 1].on) rows.reverse();
  const withBalance = rows.filter((r) => r.balance != null).length;

  if (rows.length > 1 && withBalance >= rows.length * CHAIN_SHARE) {
    const breaks = (rs: StatementRow[], sign: 1 | -1) => {
      let n = 0;
      for (let i = 1; i < rs.length; i++) {
        const prev = rs[i - 1].balance;
        const cur = rs[i].balance;
        if (prev == null || cur == null) continue;
        if (cents(prev) + cents(sign * rs[i].amount) !== cents(cur)) n++;
      }
      return n;
    };
    // Same-day rows can be listed in either order, so both directions are tried
    // before a break is called one.
    const candidates: Array<{ rs: StatementRow[]; sign: 1 | -1 }> = [
      { rs: rows, sign: 1 }, { rs: [...rows].reverse(), sign: 1 },
      { rs: rows, sign: -1 }, { rs: [...rows].reverse(), sign: -1 },
    ];
    const scored = candidates.map((c) => ({ ...c, breaks: breaks(c.rs, c.sign) })).sort((a, b) => a.breaks - b.breaks);
    const best = scored[0];
    const fixed = best.rs.map((r) => ({ ...r, amount: best.sign * r.amount }));
    const first = fixed.find((r) => r.balance != null)!;
    const last = [...fixed].reverse().find((r) => r.balance != null)!;
    const opening = (cents(first.balance!) - cents(first.amount)) / 100;
    if (best.breaks === 0) return { check: 'balanced', detail: null, rows: fixed, opening, closing: last.balance };
    return {
      check: 'unbalanced',
      detail: `${best.breaks} of ${fixed.length - 1} rows do not follow from the balance before them, so a row may be missing or misread.`,
      rows: fixed,
      opening: st.opening ?? opening,
      closing: st.closing ?? last.balance,
    };
  }

  if (st.opening != null && st.closing != null) {
    const sum = rows.reduce((a, r) => a + cents(r.amount), 0);
    const want = cents(st.closing) - cents(st.opening);
    if (sum === want) return { check: 'balanced', detail: null, rows, opening: st.opening, closing: st.closing };
    if (-sum === want) return { check: 'balanced', detail: null, rows: rows.map((r) => ({ ...r, amount: -r.amount })), opening: st.opening, closing: st.closing };
    return {
      check: 'unbalanced',
      detail: `The opening balance plus these rows comes to ${(cents(st.opening) + sum) / 100}, and the statement says ${st.closing}: off by ${Math.abs(want - sum) / 100}.`,
      rows,
      opening: st.opening,
      closing: st.closing,
    };
  }
  return { check: 'no_balances', detail: null, rows, opening: st.opening, closing: st.closing ?? ([...rows].reverse().find((r) => r.balance != null)?.balance ?? null) };
}

/* ─── Who, and which row ──────────────────────────────────────────────────── */

/**
 * Words a bank adds to every line that say how money moved, not who it moved
 * with. Stripped so that "POS 4411 STARBUCKS #1203 MANILA" and "STARBUCKS
 * MANILA" land on one counterparty.
 */
const NOISE = new Set([
  'POS', 'VISA', 'MASTERCARD', 'MC', 'AMEX', 'DEBIT', 'CREDIT', 'CARD', 'PURCHASE', 'PAYMENT', 'PAYMENTS', 'PMT', 'PYMT',
  'TRANSFER', 'TRANSFERS', 'TRF', 'TFR', 'XFER', 'TRX', 'TXN', 'TRANSACTION', 'FROM', 'TO', 'REF', 'REFERENCE', 'ONLINE',
  'INTERNET', 'BANKING', 'MOBILE', 'SEPA', 'ACH', 'DD', 'SO', 'FPS', 'BGC', 'CHQ', 'ATM', 'INST', 'INSTANT', 'AUTH',
  'RECURRING', 'VIA', 'THE', 'AND', 'FOR', 'OF', 'BY', 'ON', 'AT', 'IN', 'NO', 'NR', 'ID', 'DE', 'LA', 'EL', 'DEL', 'Y',
  'PAGO', 'COMPRA', 'TRANSFERENCIA', 'DEPOSITO', 'ABONO', 'CARGO', 'RETIRO', 'EFT', 'NEFT', 'IMPS', 'UPI', 'RTGS',
  'INWARD', 'OUTWARD', 'CR', 'DR', 'PURCH', 'WDL', 'DEP', 'CONTACTLESS', 'APPLE', 'GOOGLE', 'PAY', 'PENDING',
  // What the money was, not who it was with: "PAYROLL ACME LTD" is Acme.
  'PAYROLL', 'SALARY', 'SALARIO', 'NOMINA', 'WAGES', 'WAGE', 'PAYOUT', 'REFUND', 'REEMBOLSO',
  // Rails, not people: the wallet or network the money went through.
  'GCASH', 'MAYA', 'PAYMAYA', 'INSTAPAY', 'PESONET', 'BIZUM', 'ZELLE', 'INTERAC', 'ETRANSFER', 'SPEI', 'PIX', 'NEQUI', 'YAPE', 'PLIN',
]);

/** Past one of these, the rest of a line is a reference, not a name: "ACME LTD REF INV-004". */
const REFERENCE = new Set(['REF', 'REFERENCE', 'MEMO', 'NOTE', 'INV', 'INVOICE', 'CONCEPTO', 'REFERENCIA', 'MOTIVO', 'VERWENDUNGSZWECK', 'BILL']);

/**
 * A stable key for who is on the other side of a row. Uppercased, accents off,
 * the bank's own words off, anything that is mostly digits off (card numbers,
 * references, dates, phone numbers), and the first four words kept. "PAYPAL
 * *NETFLIX" and "SQ *CORON REEF" keep what follows the star: the processor is
 * not the counterparty.
 */
export function counterpartyKey(description: string): string {
  let s = description.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const star = s.match(/\b(?:PAYPAL|PP|SQ|SQUARE|SP|STRIPE|TST|GOOGLE|APPLE\.COM\/BILL|AMZN MKTP|AMAZON|VENMO|CASHAPP|CASH APP)\s*\*\s*(.+)$/);
  if (star) s = star[1];
  // What a bank writes around a name: "Sent money to X", "Received money from
  // X with reference ...", "Card transaction of 256.00 PHP issued by X". The
  // name is what follows; the rest is the same for every row and would make
  // every transfer one counterparty called "Sent Money".
  const lead = s.match(/\bISSUED BY\s+(.+)$/)
    ?? s.match(/\b(?:SENT MONEY TO|MONEY SENT TO|SENT TO|PAID TO|PAYMENT TO|TRANSFER TO|TRANSFERENCIA A|ENVIADO A|PAGO A)\s+(.+)$/)
    ?? s.match(/\b(?:RECEIVED MONEY FROM|MONEY RECEIVED FROM|RECEIVED FROM|PAYMENT FROM|TRANSFER FROM|TRANSFERENCIA DE|RECIBIDO DE)\s+(.+)$/);
  if (lead) s = lead[1];
  s = s.replace(/\s+WITH REFERENCE\b.*$/, '');
  const words = s.replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  // A reference, a card number, a phone number: mostly digits and longer than a
  // brand. "5G", "7UP" and "3M" are names and stay.
  const wordy = (w: string) => {
    const digits = w.replace(/\D/g, '').length;
    if (digits === w.length) return false;
    return digits * 2 < w.length || w.length <= 3;
  };
  const kept: string[] = [];
  for (const w of words) {
    if (kept.length && REFERENCE.has(w)) break;
    if (!NOISE.has(w) && !REFERENCE.has(w) && wordy(w)) kept.push(w);
  }
  // A line that is nothing but rails ("GCASH") is still somebody: keep its words rather than call it unknown.
  const named = kept.length ? kept : words.filter(wordy);
  return named.slice(0, 4).join(' ') || 'UNKNOWN';
}

/** A row's counterparty: the name a reader gave it when it gave one, else its description's. One function, so the fingerprint and the payer list agree. */
export function rowKey(r: Pick<StatementRow, 'description' | 'counterparty'>): string {
  return counterpartyKey(r.counterparty || r.description);
}

/** "CORON REEF DIVERS" as a person would write it. */
export function displayName(key: string): string {
  if (key === 'UNKNOWN') return 'Unknown';
  return key.toLowerCase().split(' ').map((w) => (w.length <= 3 && /^(llc|ltd|inc|gmbh|sa|sl|bv|plc|co|usa|uk)$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

/** FNV-1a, twice with different offsets: a short, stable id with no Node import. */
function hash64(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193) >>> 0;
    b = (b ^ (b >>> 13)) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** Which account a statement belongs to, as far as the file says. */
export function accountKey(provider: string, a: StatementAccount): string {
  const inst = (a.institution ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  return `${provider}:${inst || '-'}:${a.mask ?? '-'}`;
}

/**
 * One id per row, the same every time the same row is uploaded — which is what
 * lets overlapping statements (August–October, then September–November) be
 * uploaded without a single row counted twice.
 *
 * Built from what the row IS: its account, day, amount and counterparty, plus
 * how many identical rows came before it in the file, so two identical coffees
 * on one day stay two. The description is folded to its counterparty key so a
 * PDF read twice with a word cased differently still lands on the same id.
 */
export function rowFingerprints(account: string, rows: StatementRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = `${account}|${r.on}|${cents(r.amount)}|${rowKey(r)}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return hash64(`${base}|${n}`);
  });
}
