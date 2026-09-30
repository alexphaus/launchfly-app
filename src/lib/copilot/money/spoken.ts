// src/lib/copilot/money/spoken.ts
// A move said out loud — "coffee 130", "grab 240 yesterday", "salary came in
// 50,000" — read into the fields the add sheet already has. Pure: the phone's
// own speech recognition turns the voice into words (v2/VoiceLog.tsx), and this
// turns the words into an amount, a direction, a day and a category.
//
// Nothing here logs. What was heard opens the add sheet filled in, with the
// words themselves shown above it, and "Log it" is still the person's tap: a
// mishearing is caught on the screen, not found in the book a week later. So
// the reading can stay plain — no model, and no number that was not said
// (invariant 2). A category is one of the person's own that was named or,
// failing that, the only one of theirs whose picture the words carry (the
// same pictures the list shows). Whatever else was said is kept as the note,
// in their words.
import { categoryIcon, cleanAmount, wordIcon } from './book';
import { addDay } from './ledger';

export interface SpokenMove {
  /** The words as heard, shown above what was read from them. */
  heard: string;
  kind: 'out' | 'in';
  /** As the amount field takes it ("130", "1500.5"); null when no amount was said. */
  amount: string | null;
  /** Other amounts in the same breath: "coffee 130 and bread 50" is two moves, and the sheet takes the first. */
  more: number[];
  /** A currency named beside the amount ("40 euros", "$12"); null leaves the sheet's own default. */
  currency: string | null;
  on: string;
  /** True when a day was said. */
  onSaid: boolean;
  category: string | null;
  note: string;
}

interface Tok { raw: string; w: string; used: boolean }

// Own keys only: `w in {}` is true for "constructor", and a word is anything said.
const has = (o: object, k: string | undefined): boolean => k != null && Object.prototype.hasOwnProperty.call(o, k);

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
/** After a figure: "5 thousand", "50k", "2 grand". tokens() splits "50k" into "50 k". */
const SCALE: Record<string, number> = { hundred: 100, thousand: 1000, k: 1000, grand: 1000, million: 1e6, m: 1e6, billion: 1e9 };
const isNumWord = (w: string | undefined) => has(UNITS, w) || has(TENS, w);

const MONTHS: Array<[RegExp, number]> = [
  [/^jan(uary)?$/, 1], [/^feb(ruary)?$/, 2], [/^mar(ch)?$/, 3], [/^apr(il)?$/, 4], [/^may$/, 5], [/^june?$/, 6],
  [/^july?$/, 7], [/^aug(ust)?$/, 8], [/^sept?(ember)?$/, 9], [/^oct(ober)?$/, 10], [/^nov(ember)?$/, 11], [/^dec(ember)?$/, 12],
];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Currency words, read only beside the amount — and a word only after it, a
 * mark or a code either side: "I won 500" is not Korean money, and "a pound
 * of beef 300" is not sterling.
 */
const SAID_CURRENCY: Array<[RegExp, string]> = [
  [/^(₱|php|peso|pesos|piso)$/, 'PHP'],
  [/^(€|eur|euro|euros)$/, 'EUR'],
  [/^(£|gbp|pound|pounds|quid)$/, 'GBP'],
  [/^(¥|jpy|yen)$/, 'JPY'],
  [/^(baht|thb)$/, 'THB'],
  [/^(ringgit|myr)$/, 'MYR'],
  [/^(rupiah|idr)$/, 'IDR'],
  [/^(won|krw)$/, 'KRW'],
  [/^(rupee|rupees|inr)$/, 'INR'],
  [/^(yuan|rmb|cny)$/, 'CNY'],
  [/^(\$|usd|dollar|dollars|bucks)$/, 'USD'],
];
/** What may stand before an amount: a mark or a code, never a word ("won", "pound"). */
const MARK_OR_CODE = /^([₱$€£¥]|php|eur|gbp|jpy|thb|myr|idr|krw|inr|cny|rmb|usd)$/;
/** Which dollar: the word before it. */
const DOLLAR_OF: Record<string, string> = { singapore: 'SGD', australian: 'AUD', aussie: 'AUD', canadian: 'CAD', kong: 'HKD', us: 'USD', american: 'USD' };
/** Currency words that mean only money, so they are not left in the note when said away from the amount. */
const ONLY_MONEY = /^(₱|€|£|¥|\$|php|peso|pesos|piso|eur|euro|euros|usd|dollar|dollars|bucks)$/;

/** Said for money that came in. Checked before the spending words, so "paid me" is not "paid". */
const IN_WORDS: string[][] = [['came', 'in'], ['got', 'paid'], ['paid', 'me'], ['received'], ['receive'], ['earned'], ['income'], ['sold'], ['refund'], ['refunded'], ['sweldo']];
const OUT_WORDS: string[][] = [['spent'], ['spend'], ['paid'], ['pay'], ['bought'], ['buy'], ['sent'], ['send'], ['gave'], ['gastos']];
const KIND_WORD = new Set([...IN_WORDS, ...OUT_WORDS].flat());

/** Words that carry nothing when they are all that is left at either end of the note. */
const FILLER = new Set([
  'i', "i've", 'ive', 'just', 'on', 'for', 'a', 'an', 'the', 'of', 'at', 'to', 'in', 'by', 'from', 'and', 'then', 'plus', 'also', 'with', 'my',
  'it', 'was', 'is', 'that', 'this', 'um', 'uh', 'log', 'add', 'expense', 'about', 'around', 'like', 'so', 'okay', 'ok',
]);
/** Where a second move starts in one breath: "coffee 130 and bread 50". */
const JOINS = new Set(['and', 'then', 'plus', 'also']);

/**
 * The words, split for reading. A comma between digits is a thousands mark, as
 * the amount field reads it. "One fifty" comes back from recognition as the
 * time "1:50", so a time is read as its digits.
 */
function tokens(text: string): Tok[] {
  return text
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
    .replace(/\b(\d{1,2}):(\d{2})\b/g, '$1$2')
    .replace(/([₱$€£¥])/g, ' $1 ')
    .replace(/(\d)(k|m)\b/gi, '$1 $2')
    .split(/[\s\-–—/]+/)
    .map((t) => t.replace(/^[+("“'‘]+|[.,!?;:)"”'’]+$/g, ''))
    .filter(Boolean)
    .map((raw) => ({ raw, w: raw.toLowerCase(), used: false }));
}

/** "groceries" and "grocery", "coffees" and "coffee": a category named in the plural is still named. */
function stem(w: string): string {
  const s = w.toLowerCase().replace(/'s$/, '');
  if (s.length > 4 && s.endsWith('ies')) return `${s.slice(0, -3)}y`;
  if (s.length > 4 && /(ss|x|ch|sh)es$/.test(s)) return s.slice(0, -2);
  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
  return s;
}
const words = (s: string) => s.toLowerCase().split(/[\s\-–—/&]+/).map((w) => w.replace(/[^\p{L}\p{N}']/gu, '')).filter(Boolean).map(stem);

/** A figure at `i`: digits with a scale after them ("5 thousand 500", "50 k"), or one said in words ("fifteen hundred"). */
function readNumber(ts: Tok[], i: number): { value: number; end: number; digits: boolean } | null {
  const w = ts[i]?.w;
  if (!w) return null;
  if (/^\d+(\.\d+)?$/.test(w)) {
    let value = Number(w);
    let j = i + 1;
    let last = 0;
    while (ts[j] && !ts[j].used && has(SCALE, ts[j].w)) { last = SCALE[ts[j].w]; value *= last; j++; }
    if (last && ts[j] && !ts[j].used && /^\d+$/.test(ts[j].w) && Number(ts[j].w) < last) { value += Number(ts[j].w); j++; }
    return { value, end: j, digits: true };
  }
  let total = 0;
  let cur = 0;
  let seen = false;
  let j = i;
  for (; j < ts.length && !ts[j].used; j++) {
    const x = ts[j].w;
    if (has(UNITS, x)) { cur += UNITS[x]; seen = true; }
    else if (has(TENS, x)) { cur += TENS[x]; seen = true; }
    else if (x === 'a' && !seen && (ts[j + 1]?.w === 'hundred' || ts[j + 1]?.w === 'thousand')) { cur = 1; seen = true; }
    else if (x === 'hundred' && seen) cur = (cur || 1) * 100;
    else if ((x === 'thousand' || x === 'million' || x === 'billion') && seen) { total += (cur || 1) * SCALE[x]; cur = 0; }
    else if (x === 'and' && seen && isNumWord(ts[j + 1]?.w)) continue;
    else break;
  }
  return seen ? { value: total + cur, end: j, digits: false } : null;
}

const iso = (y: number, m: number, d: number): string | null => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null;
};
const gapDays = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const ORDINAL = /^(\d{1,2})(st|nd|rd|th)$/;
const dayOfMonth = (w: string | undefined): number | null => {
  const m = w?.match(/^(\d{1,2})(st|nd|rd|th)?$/);
  const d = m ? Number(m[1]) : NaN;
  return d >= 1 && d <= 31 ? d : null;
};
const monthOf = (w: string): number | null => {
  for (const [re, n] of MONTHS) if (re.test(w)) return n;
  return null;
};

/**
 * The day said, and the tokens that said it: a relative day, a weekday, a
 * month and a day ("september 5", "5th of sept"), or an ordinal alone ("the
 * 28th") — this month's when it has come, else last month's, since a move said
 * out loud is mostly one that has happened. A month and day with no year is the
 * one within half a year of today. A bare "30" before a month stays an amount:
 * "coffee 30 sept" is thirty pesos, not a date with nothing spent.
 */
function readDay(ts: Tok[], today: string): string | null {
  const use = (from: number, to: number) => { for (let k = from; k < to; k++) ts[k].used = true; };
  const [ty, tm, td] = today.split('-').map(Number);
  for (let i = 0; i < ts.length; i++) {
    const w = ts[i].w;
    const next = ts[i + 1]?.w;
    if (w === 'day' && next === 'before' && ts[i + 2]?.w === 'yesterday') { use(i, i + 3); return addDay(today, -2); }
    if (w === 'yesterday' || w === 'kahapon') { use(i, i + 1); return addDay(today, -1); }
    if (w === 'last' && next === 'night') { use(i, i + 2); return addDay(today, -1); }
    if (w === 'this' && (next === 'morning' || next === 'afternoon' || next === 'evening')) { use(i, i + 2); return today; }
    if (w === 'today' || w === 'tonight' || w === 'ngayon') { use(i, i + 1); return today; }
    if (w === 'tomorrow' || w === 'bukas') { use(i, i + 1); return addDay(today, 1); }
    if (next === 'days' && ts[i + 2]?.w === 'ago') {
      const n = readNumber(ts, i);
      if (n && n.end === i + 1 && Number.isInteger(n.value) && n.value >= 1 && n.value <= 366) { use(i, i + 3); return addDay(today, -n.value); }
    }
    const wd = WEEKDAYS.indexOf(w.replace(/s$/, ''));
    if (wd >= 0) {
      const now = new Date(`${today}T00:00:00Z`).getUTCDay();
      const prev = ts[i - 1]?.w;
      const back = (now - wd + 7) % 7;
      if (prev === 'next') { use(i - 1, i + 1); return addDay(today, (7 - back) % 7 || 7); }
      if (prev === 'last') { use(i - 1, i + 1); return addDay(today, -(back || 7)); }
      use(i, i + 1);
      return addDay(today, -back);
    }
    const mo = monthOf(w);
    if (mo) {
      let d: number | null = null;
      let from = i;
      let to = i + 1;
      const after = dayOfMonth(next);
      if (after && !ts[i + 1].used) { d = after; to = i + 2; }
      else if (ORDINAL.test(ts[i - 1]?.w ?? '') && !ts[i - 1].used) { d = dayOfMonth(ts[i - 1].w); from = i - 1; }
      else if (ts[i - 1]?.w === 'of' && dayOfMonth(ts[i - 2]?.w) && !ts[i - 2].used) { d = dayOfMonth(ts[i - 2].w); from = i - 2; }
      if (d) {
        // A year only when it is plausibly one: "sept 5 2000" is two thousand on the fifth.
        const y = ts[to] && /^20\d\d$/.test(ts[to].w) && Math.abs(Number(ts[to].w) - ty) <= 1 ? Number(ts[to].w) : null;
        if (y != null) to++;
        let on = iso(y ?? ty, mo, d);
        if (on && y == null) {
          if (gapDays(today, on) > 183) on = iso(ty - 1, mo, d);
          else if (gapDays(on, today) > 183) on = iso(ty + 1, mo, d);
        }
        if (on) { use(from, to); return on; }
      }
    }
    // "the 28th": an ordinal alone. A bare "28" is an amount.
    const ord = w.match(ORDINAL);
    if (ord) {
      const d = Number(ord[1]);
      const on = d <= td ? iso(ty, tm, d) : tm === 1 ? iso(ty - 1, 12, d) : iso(ty, tm - 1, d);
      if (on) { use(i, i + 1); return on; }
    }
  }
  return null;
}

/** Money in or out, when a word said it. */
function readKind(ts: Tok[], end: number): 'in' | 'out' | null {
  for (const [list, kind] of [[IN_WORDS, 'in'], [OUT_WORDS, 'out']] as const) {
    for (let i = 0; i < end; i++) {
      for (const phrase of list) {
        if (i + phrase.length > end) continue;
        if (!phrase.every((p, k) => !ts[i + k].used && ts[i + k].w === p)) continue;
        for (let k = 0; k < phrase.length; k++) ts[i + k].used = true;
        return kind;
      }
    }
  }
  return null;
}

/** The currency named by the word at `i`, and where its words start ("hong kong dollars" is three). */
function currencyAt(ts: Tok[], i: number): { code: string; from: number } | null {
  const t = ts[i];
  if (!t || t.used) return null;
  for (const [re, code] of SAID_CURRENCY) {
    if (!re.test(t.w)) continue;
    if (code !== 'USD' || t.w === '$' || t.w === 'usd') return { code, from: i };
    const before = ts[i - 1]?.w;
    if (!has(DOLLAR_OF, before)) return { code, from: i };
    return { code: DOLLAR_OF[before!], from: before === 'kong' && ts[i - 2]?.w === 'hong' ? i - 2 : i - 1 };
  }
  return null;
}

/** A currency right beside the amount at [start, end): after it ("40 euros", "40 in euros", "40 singapore dollars") or before it ("$12"). */
function readCurrency(ts: Tok[], start: number, end: number): string | null {
  let j = end;
  while (j < end + 3 && ts[j] && !ts[j].used && (ts[j].w === 'in' || ts[j].w === 'of' || ts[j].w === 'hong' || has(DOLLAR_OF, ts[j].w))) j++;
  for (const i of j > end ? [j, end] : [end]) {
    const after = currencyAt(ts, i);
    if (!after) continue;
    for (let k = end; k <= i; k++) ts[k].used = true;
    return after.code;
  }
  const before = MARK_OR_CODE.test(ts[start - 1]?.w ?? '') ? currencyAt(ts, start - 1) : null;
  if (before) {
    for (let k = before.from; k < start; k++) ts[k].used = true;
    return before.code;
  }
  return null;
}

/**
 * Read a move out of what was said. `categories` are the person's own, as the
 * sheet offers them; `today` is the book's.
 */
export function parseSpoken(text: string, opts: { categories: { out: string[]; in: string[] }; today: string }): SpokenMove {
  const heard = text.trim().replace(/\s+/g, ' ');
  const ts = tokens(heard);
  const said = readDay(ts, opts.today);

  // Every figure left once the day has taken its own. Said in digits beats said
  // in words: in "one coffee 130" the amount is 130.
  const found: Array<{ value: number; start: number; end: number; digits: boolean }> = [];
  for (let i = 0; i < ts.length; i++) {
    if (ts[i].used) continue;
    const n = readNumber(ts, i);
    if (!n) continue;
    found.push({ ...n, start: i });
    i = n.end - 1;
  }
  const pool = found.some((f) => f.digits) ? found.filter((f) => f.digits) : found;
  const first = pool[0] ?? null;
  const rest = pool.slice(1);
  for (const f of found) for (let k = f.start; k < f.end; k++) ts[k].used = true;

  // One move per breath. After an "and" the words are the next move's; with no
  // "and", the way the first was said decides — "coffee 130 bread 50" puts the
  // words before each amount, "130 coffee 50 bread" after it.
  let limit = ts.length;
  if (first && rest.length) {
    let join = -1;
    for (let k = rest[0].start - 1; k >= first.end; k--) if (JOINS.has(ts[k].w)) { join = k; break; }
    const wordsFirst = ts.slice(0, first.start).some((t) => !t.used && !FILLER.has(t.w) && !KIND_WORD.has(t.w));
    limit = join >= 0 ? join : wordsFirst ? first.end : rest[0].start;
  }

  const currency = first ? readCurrency(ts, first.start, first.end) : null;
  for (let k = 0; k < limit; k++) if (!ts[k].used && ONLY_MONEY.test(ts[k].w)) ts[k].used = true;
  let kind = readKind(ts, limit);

  const left = ts.slice(0, limit).filter((t) => !t.used);
  const leftWords = left.map((t) => stem(t.w));
  const named = (list: string[]): string | null => {
    let best: string | null = null;
    let bestLen = 0;
    for (const c of list) {
      const cw = words(c);
      if (!cw.length || cw.length <= bestLen) continue;
      for (let i = 0; i + cw.length <= leftWords.length; i++) {
        if (cw.every((x, k) => leftWords[i + k] === x)) { best = c; bestLen = cw.length; break; }
      }
    }
    return best;
  };
  const inCat = named(opts.categories.in);
  const outCat = named(opts.categories.out);
  let category = kind === 'in' ? inCat ?? outCat : outCat ?? inCat;
  if (!kind && category && category === inCat && category !== outCat) kind = 'in';

  const kept = left.map((t) => t.raw);
  while (kept.length && FILLER.has(kept[0].toLowerCase())) kept.shift();
  while (kept.length && FILLER.has(kept[kept.length - 1].toLowerCase())) kept.pop();
  const phrase = kept.join(' ');

  // Nothing named: the words' picture, when it is the picture of just one of their categories.
  const icon = phrase ? wordIcon(phrase) : null;
  if (!kind && !category && (icon === 'salary' || icon === 'client')) kind = 'in';
  const finalKind = kind ?? 'out';
  if (!category && icon) {
    const sign = finalKind === 'in' ? 1 : -1;
    const same = (finalKind === 'in' ? opts.categories.in : opts.categories.out).filter((c) => categoryIcon(c, '', sign) === icon);
    if (same.length === 1) category = same[0];
  }

  // The note is what was said beyond the category's own name.
  const note = category && words(phrase).join(' ') === words(category).join(' ') ? '' : phrase.charAt(0).toUpperCase() + phrase.slice(1);
  const amount = first && first.value > 0 && first.value < 1e9 ? cleanAmount(String(Math.round(first.value * 100) / 100)) : '';

  return {
    heard,
    kind: finalKind,
    amount: amount && Number(amount) > 0 ? amount : null,
    more: rest.map((r) => r.value),
    currency,
    on: said ?? opts.today,
    onSaid: !!said,
    category,
    note: note.slice(0, 200),
  };
}
