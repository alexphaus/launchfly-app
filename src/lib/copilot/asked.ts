// src/lib/copilot/asked.ts
// Asked out loud: a question about the record, answered by counting, and said
// back.
//
// The ask.ts argument stands, and this is its spoken half. A free-text question
// answered by a model gets a plausible number that is sometimes wrong, and
// nobody can tell which time (invariant 2). So the question is only ever
// MATCHED — to one of a fixed list the app can count — and the count is the
// app's: the same rows the screens count, the same derivation. The rules match
// what they can; a model, where there is one, may only say which question it
// was (normalizeAsked holds it to the list), never what the answer is. What
// matches nothing is said to be uncountable, with the way to a model that
// reasons (the copy for Claude).
//
// Every answer carries what it counted and over which days. When the rows the
// app holds do not cover the days asked about — the home reads back two weeks
// of sends — the answer says so and gives the days it can, rather than a total
// that quietly means something else.
//
// Pure — no DB import — so copilot-core.test.ts covers the matching and every
// answer. The Ask sheet gathers the rows (AskIt.tsx); the route only matches
// (api/copilot/asked).

import { dayWords, roleOf, TALK_ROLES, TALK_ROLE_LABEL, COMMITMENT_LABEL, type Talk } from './lab';
import { hoursLabel, shiftDay, type FocusLog } from './focus';
import { localDay, RECENT_DAYS } from './review';
import { currencyCodeOf, currencyMark } from './money/fx';
import type { AskAnswer } from './ask';

/* ─── What can be asked ───────────────────────────────────────────────────── */

export const ASKED_IDS = [
  'next', 'bet', 'goal', 'safe', 'spent', 'received', 'balance', 'runway', 'talks', 'intros', 'sales', 'sent', 'focus',
  // ask.ts's five, counted over everything on the server.
  'segments', 'drafts', 'calls', 'stood_down', 'worth',
] as const;
export type AskedId = (typeof ASKED_IDS)[number];

export const PERIODS = ['today', 'yesterday', 'week', 'lastweek', 'month', 'lastmonth', '30d'] as const;
export type Period = (typeof PERIODS)[number];

/** What was asked, matched: the question, over which days, and about what (a category or a word in the book). */
export interface Asked {
  id: AskedId;
  period: Period | null;
  about: string | null;
  /** Who matched it: the app's rules, a model, or the person tapping the question. */
  by: 'rules' | 'model' | 'tap';
}

interface CatalogueEntry {
  /** The question as the sheet writes it, for a tap. */
  q: string;
  /** The days it is about when none were said; null for a question with no days. */
  period: Period | null;
  /** What a model is told it is for. */
  help: string;
}

/**
 * The list. A question earns a place by being one somebody says out loud and one
 * the app can count without guessing. "Should I raise my price?" is the first
 * and not the second: that goes to Claude with the record.
 */
export const ASKED: Record<AskedId, CatalogueEntry> = {
  next: { q: 'What should I do next?', period: null, help: 'what to do next, the one move the app says now' },
  bet: { q: 'How is my bet going?', period: null, help: 'the experiment they are running and its count against its pass line' },
  goal: { q: 'Am I on track for my goal?', period: null, help: 'their goals, how far along, and whether each is on track' },
  safe: { q: 'How much can I spend today?', period: null, help: 'what is safe to spend today from their balance' },
  spent: { q: 'How much did I spend this month?', period: 'month', help: 'money spent over some days, optionally on one category or thing' },
  received: { q: 'What came in this month?', period: 'month', help: 'money received or earned over some days' },
  balance: { q: 'What is my balance?', period: null, help: 'how much money they have now' },
  runway: { q: 'How long will my money last?', period: null, help: 'runway: months their money lasts' },
  talks: { q: 'Who did I talk to this month?', period: '30d', help: 'conversations they logged with people, and who they were' },
  intros: { q: 'Who do I need to follow up?', period: null, help: 'introductions people offered that are not followed up yet' },
  sales: { q: 'How many sales this month?', period: 'month', help: 'sales they logged, how many and how much' },
  sent: { q: 'How many messages went out this week?', period: 'week', help: 'messages sent and replies received' },
  focus: { q: 'How much deep work this week?', period: 'week', help: 'hours of deep work they logged' },
  segments: { q: 'Which kind of business replies?', period: null, help: 'which segment or kind of business replies to their messages' },
  drafts: { q: 'Where do my drafts die?', period: null, help: 'drafts written and what happened to them' },
  calls: { q: 'Which of the app’s calls worked?', period: null, help: 'which of the app’s daily calls worked' },
  stood_down: { q: 'What have I told it to stop suggesting?', period: null, help: 'what they told the app to stop suggesting' },
  worth: { q: 'Has any of this been worth it?', period: null, help: 'whether the work the app took on was worth anything' },
};

/** The questions offered as taps, in the order they are asked most. The five server answers are below them on the sheet. */
export const ASKED_CHIPS: AskedId[] = ['next', 'safe', 'spent', 'bet', 'goal', 'talks', 'intros', 'sales', 'sent', 'received', 'balance', 'runway', 'focus'];

/* ─── Matching what was said ──────────────────────────────────────────────── */

/** Lower case, curly quotes straightened, punctuation gone but for apostrophes. */
export function cleanAsked(s: string): string {
  return s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const PERIOD_RULES: Array<[RegExp, Period]> = [
  [/\b(last|past) (30|thirty) days\b|\bpast month\b|\blast month or so\b/, '30d'],
  [/\blast month\b|\bprevious month\b|\bthe month before\b/, 'lastmonth'],
  [/\bthis month\b|\bso far this month\b/, 'month'],
  [/\blast week\b|\bprevious week\b|\bthe week before\b/, 'lastweek'],
  [/\bthis week\b|\bpast week\b|\b(last|past) (7|seven) days\b|\bthe week\b/, 'week'],
  [/\byesterday\b|\blast night\b/, 'yesterday'],
  [/\btoday\b|\bthis (morning|afternoon|evening)\b|\btonight\b/, 'today'],
];

export function periodOf(heard: string): Period | null {
  const q = cleanAsked(heard);
  for (const [re, p] of PERIOD_RULES) if (re.test(q)) return p;
  return null;
}

/**
 * The rules, most particular first: "what should I focus on" is the next move
 * and not deep work, "time I spent" is deep work and not money, "which segment
 * replies" is ask.ts's and not this week's replies.
 */
const RULES: Array<[RegExp, AskedId]> = [
  [/\b(stop(ped)? suggesting|stood down|told (it|you) to stop|barred|never suggest|stop showing)\b/, 'stood_down'],
  [/\b(worth (it|anything|something|the money|the time)|been worth|paid off)\b/, 'worth'],
  [/\b(which|what) (segments?|kinds? of business(es)?|types? of business(es)?|industr(y|ies)|niches?)\b|\bsegments?\b.*\brepl/, 'segments'],
  [/\bdrafts?\b/, 'drafts'],
  [/\b(calls?|suggestions?|picks?)\b.*\bwork(ed|s)?\b|\bwhich of (its|your|the app's) calls\b/, 'calls'],
  [/\bwhat('s| is)? next\b|\bwhat (should|do|shall|can|must) i (do|focus on|work on|start)\b|\bwhat now\b|\bnext (move|step|thing)\b|\bdo next\b|\bwhat to do\b|\bwhere (do|should) i start\b|\bwhat'?s on (my )?(plate|list)\b/, 'next'],
  [/\bdeep work\b|\bfocus(ed)? (time|hours?)\b|\bhours? (of )?(work|focus)\b|\bhow (long|much|many hours) (did|have) i (work|focus)(ed)?\b|\btime (did|have) i (spend|spent)\b|\b(spend|spent) .*\b(time|hours?|minutes)\b/, 'focus'],
  [/\bsafe to spend\b|\b(can|could|should|may) i (still )?(spend|afford)\b|\bleft to spend\b|\bspend today\b|\ballowed to spend\b|\bdaily budget\b|\bbudget (for )?today\b/, 'safe'],
  [/\brunway\b|\bhow long (will|can|would|does|is) (my )?(money|cash|savings|it|this) (going to )?last\b|\blast me\b|\b(before|until) i run out\b|\brun(ning)? out of (money|cash)\b|\bmonths (of money )?left\b/, 'runway'],
  [/\bbalance\b|\bhow much (money|cash) (do|have) i (have|got|left)\b|\bhow much (do|have) i (have|got) (left )?(in|on) (the |my )?(bank|account|wallet|book)\b|\bmoney (do i have|left|in the bank)\b/, 'balance'],
  // "Went out" alone is a message as often as money: only money going out is spending.
  [/\b(spen[dt]|spending|expenses?|outgoings|paid for|cost me|costs? me|money (went|go|goes) out)\b/, 'spent'],
  // "How much did I make" is money in; "how many sales did I make" is sales — so only "how much".
  [/\b(came in|come in|coming in|received|income|earn(ed|ings|t)?|(got|get|been|getting) paid|money in|inflows?)\b|\bhow much (money )?(did|have|do) i (make|made)\b/, 'received'],
  [/\b(bets?|experiments?)\b|\b(how('s| is)|is) (the |my )?test\b/, 'bet'],
  // Who was talked to before what was sold: "how many customers did I talk to" is conversations.
  [/\bintro(duction)?s?\b|\bfollow(ing)?[ -]?ups?\b|\bfollow up\b/, 'intros'],
  [/\b(talk(ed)?|conversations?|spoke|spoken|chatted|met with|meet with|people did i (meet|see))\b/, 'talks'],
  [/\b(sales?|sold|sell|clients? paid|paying clients?|new clients?|customers?|deals?|revenue|closed (any|a))\b|\bdid i (win|close)\b/, 'sales'],
  [/\b(sent|send|messages?|outreach|repl(y|ies|ied)|respon(se|ses|ded)|wrote back|answered)\b/, 'sent'],
  [/\b(goals?|on track|targets?|how close|milestones?|exit fund)\b/, 'goal'],
];

/** Words around a thing asked about that are not the thing: "on food this week" is about food. */
const NOT_ABOUT = /\b(this|last|past|previous|the|my|a|an|today|yesterday|week|month|days?|so|far|tonight|morning|in|total|altogether|stuff|things?|it|that)\b/g;

/** The thing a money question is about, as said: "on food", "for grab". Null when none was. */
export function aboutOf(heard: string): string | null {
  const q = cleanAsked(heard);
  const m = q.match(/\b(?:on|for) ([a-z0-9' ]{2,40})$/)
    ?? q.match(/\b(?:on|for) ([a-z0-9' ]{2,40}?)(?: (?:this|last|past|today|yesterday|so far|in the)\b)/)
    // "How much did coffee cost me": the thing is what did the costing.
    ?? q.match(/\b(?:did|does|do|has|have) (?:the |my )?([a-z0-9' ]{2,30}?) costs? me\b/);
  if (!m) return null;
  const words = m[1].replace(NOT_ABOUT, ' ').replace(/\s+/g, ' ').trim();
  return words.length >= 2 ? words : null;
}

/** "Groceries" for "grocery": what was said, matched to one of their own categories, or null. */
export function categoryOf(about: string | null, categories: readonly string[]): string | null {
  if (!about) return null;
  const a = about.toLowerCase();
  // "Groceries" is "grocery" and "coffees" is "coffee": -ies to -y, else one trailing s.
  const stem = (s: string) => { const w = s.toLowerCase(); return /ies$/.test(w) ? w.replace(/ies$/, 'y') : /[^s]s$/.test(w) ? w.slice(0, -1) : w; };
  return categories.find((c) => c.toLowerCase() === a) ?? categories.find((c) => stem(c) === stem(a)) ?? null;
}

/**
 * The app's own reading of a question: which one on the list it is, the days it
 * is about, and what. Null when nothing on the list is what was asked — a model
 * may try then, and failing that the sheet says it cannot count it.
 */
export function matchAsked(heard: string): Asked | null {
  const q = cleanAsked(heard);
  if (!q) return null;
  const hit = RULES.find(([re]) => re.test(q));
  if (!hit) return null;
  const id = hit[1];
  return { id, period: periodOf(q), about: id === 'spent' || id === 'received' ? aboutOf(q) : null, by: 'rules' };
}

/* ─── Days ────────────────────────────────────────────────────────────────── */

const MONTH_NAME = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface Span {
  from: string;
  to: string;
  /** On screen: "in the last 7 days", "in September". */
  label: string;
}

/**
 * The days a period means, said the way the screens count them: a week is the
 * last seven days, as the Path's week is, and a month is the calendar month, as
 * the book's is. The label goes into the answer, so "this week" is never left
 * to mean two things.
 */
export function spanOf(p: Period, today: string): Span {
  const month = today.slice(0, 7);
  switch (p) {
    case 'today': return { from: today, to: today, label: 'today' };
    case 'yesterday': { const y = shiftDay(today, -1); return { from: y, to: y, label: 'yesterday' }; }
    case 'week': return { from: shiftDay(today, -6), to: today, label: 'in the last 7 days' };
    case 'lastweek': return { from: shiftDay(today, -13), to: shiftDay(today, -7), label: 'in the 7 days before that' };
    case 'month': return { from: `${month}-01`, to: today, label: 'this month' };
    case 'lastmonth': {
      const first = shiftDay(`${month}-01`, -1).slice(0, 7);
      return { from: `${first}-01`, to: shiftDay(`${month}-01`, -1), label: `in ${MONTH_NAME[Number(first.slice(5, 7)) - 1]}` };
    }
    case '30d': return { from: shiftDay(today, -29), to: today, label: 'in the last 30 days' };
  }
}

/** The calendar months a span touches, oldest first: the book is read a month at a time. */
export function monthsOf(span: Pick<Span, 'from' | 'to'>): string[] {
  const out: string[] = [];
  for (let m = span.from.slice(0, 7); m <= span.to.slice(0, 7);) {
    out.push(m);
    const [y, mo] = m.split('-').map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  }
  return out;
}

/** The question as it was understood, written back: what a mishearing or a wrong match is caught by. */
export function askedLine(a: Asked, today: string): string {
  const days = a.period ?? ASKED[a.id].period;
  const span = days ? spanOf(days, today).label : null;
  switch (a.id) {
    case 'spent': return `How much did you spend${a.about ? ` on ${a.about}` : ''}${span ? ` ${span}` : ''}?`;
    case 'received': return `What came in${span ? ` ${span}` : ''}?`;
    case 'talks': return `Who did you talk to${span ? ` ${span}` : ''}?`;
    case 'sales': return `How many sales${span ? ` ${span}` : ''}?`;
    case 'sent': return `How many messages went out${span ? ` ${span}` : ''}?`;
    case 'focus': return `How much deep work${span ? ` ${span}` : ''}?`;
    default: return ASKED[a.id].q.replace(/^Am I\b/, 'Are you').replace(/\bam I\b/g, 'are you').replace(/\bI\b/g, 'you').replace(/\bmy\b/g, 'your');
  }
}

/* ─── Saying money ────────────────────────────────────────────────────────── */

/** What a code is called out loud. A voice reading "₱1,250" says "peso sign" or nothing; "1,250 pesos" it says right. */
const SPOKEN_CURRENCY: Record<string, [string, string]> = {
  USD: ['dollar', 'dollars'], CAD: ['dollar', 'dollars'], AUD: ['dollar', 'dollars'], NZD: ['dollar', 'dollars'], SGD: ['dollar', 'dollars'], HKD: ['dollar', 'dollars'],
  PHP: ['peso', 'pesos'], MXN: ['peso', 'pesos'], COP: ['peso', 'pesos'], ARS: ['peso', 'pesos'], CLP: ['peso', 'pesos'],
  EUR: ['euro', 'euros'], GBP: ['pound', 'pounds'], JPY: ['yen', 'yen'], CNY: ['yuan', 'yuan'], INR: ['rupee', 'rupees'],
  IDR: ['rupiah', 'rupiah'], MYR: ['ringgit', 'ringgit'], THB: ['baht', 'baht'], VND: ['dong', 'dong'], KRW: ['won', 'won'],
  BRL: ['real', 'reais'], ZAR: ['rand', 'rand'], NGN: ['naira', 'naira'], KES: ['shilling', 'shillings'], AED: ['dirham', 'dirhams'], CHF: ['franc', 'francs'],
};

/** "1,250 pesos". Whole units out loud past twenty: the screen keeps the cents, a voice saying them is noise. */
export function spokenMoney(n: number, currency: string): string {
  const code = currencyCodeOf(currency) ?? (currency === '$' ? 'USD' : null);
  const abs = Math.abs(n);
  const amount = abs >= 20 ? Math.round(abs).toLocaleString('en-US') : abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const names = code ? SPOKEN_CURRENCY[code] : null;
  const word = names ? (abs === 1 ? names[0] : names[1]) : (code ?? currency);
  return `${n < 0 ? 'minus ' : ''}${amount} ${word}`;
}

/** "₱1,250" for the screen, the way the book writes it. */
export function screenMoney(n: number, currency: string): string {
  const abs = Math.abs(n);
  const body = abs.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(Math.round(abs * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 });
  const mark = currencyMark(currency);
  return `${n < 0 ? '-' : ''}${/^[A-Za-z]{2,}$/.test(mark) ? `${mark} ` : mark}${body}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
/** "28 Sep to 4 Oct", or the one day: the days a count covers, the way the rest of the app writes a day. */
const daysWords = (s: Pick<Span, 'from' | 'to'>) => (s.from === s.to ? dayWords(s.from) : `${dayWords(s.from)} to ${dayWords(s.to)}`);

/* ─── What each answer is counted from ────────────────────────────────────── */

/** One month of the book, as its route returns it — only what an answer reads. */
export interface BookMonthIn {
  month: string;
  /** The currency the amounts are shown in. */
  view: string;
  ready: boolean;
  notReady: string | null;
  started: boolean;
  days: Array<{ on: string; lines: Array<{ shown: number; category: string | null; label: string }> }>;
  unlabelled: number;
  missing: string | null;
  balance: { shown: number } | null;
  safe: { left: number; perDay: number; days: number; committed: number; spentToday: number; broke: boolean } | null;
  safeShown: number | null;
  categories: { out: string[]; in: string[] };
}

export interface AskedInput {
  today: string;
  timezone: string;
  /** The Path's move now, and what else is waiting on the person. */
  now?: { title: string; why: string | null; size: string | null } | null;
  asks?: Array<{ kind: string; title: string }>;
  /** The bet running, as Proof says it (lab.ts resultLine, passLine). */
  bet?: { belief: string; part: string; day: number; days: number; result: string; pass: string } | null;
  checkpointDue?: boolean;
  goals?: Array<{ title: string; status: string | null; horizon: string | null; verdict: string | null }>;
  /** The lead goal's sentence (outlook.ts), every number in it computed. */
  outlook?: { title: string; line: string } | null;
  /** Runway is cash over what goes out a month (metrics.ts computeRunwayMonths), each said with where it came from. */
  runway?: { months: number | null; cash: number | null; outPerMonth: number | null; currency: string | null; cashFrom?: 'typed' | 'statement' | 'book' | null; outFrom?: 'typed' | 'statement' | null };
  talks?: Talk[];
  intros?: Array<{ who: string | null; days: number; said: string | null }>;
  /** Every sale logged, newest first (HomeData.wins), in the sales currency. */
  wins?: Array<{ at: string; amount: number | null; who: string | null }>;
  salesCurrency?: string;
  /** The last RECENT_DAYS of sends and outcomes (HomeData.recent). */
  sentAt?: string[];
  replies?: string[];
  /** The rolling 30 days the metrics count, for days the recent rows do not reach. */
  metrics?: { windowDays: number; sent: number; replies: number };
  focus?: FocusLog[];
  /** Reads that failed, by name (HomeData.recent.unreadable, the lab's). */
  unreadable?: string[];
  /** The book's months for the days asked about; a string is why it could not be opened. */
  book?: BookMonthIn[] | string;
  /** ask.ts's five, or why they could not be counted. */
  answers?: AskAnswer[] | string;
}

export interface Answer {
  id: AskedId;
  /** The question as understood. */
  asked: string;
  /** The answer in one line, on screen. Never empty. */
  title: string;
  /** The same, to be read aloud: currency in words, nothing a voice stumbles on. */
  say: string;
  /** What is under it. */
  lines: string[];
  /** What it was counted from, and over which days. */
  counted: string | null;
  /** True when there is nothing to count from yet, or the rows could not be read: said, never shown as zero. */
  thin: boolean;
}

const answer = (a: Asked, today: string, title: string, say: string, lines: string[] = [], counted: string | null = null, thin = false): Answer =>
  ({ id: a.id, asked: askedLine(a, today), title, say, lines: lines.filter(Boolean), counted, thin });

/* ─── The answers ─────────────────────────────────────────────────────────── */

/**
 * One answer. Each reads only the part of the input it needs; a part that is
 * absent was not loaded, and a part that is a string failed to load — both are
 * said, so a failed read never answers "nothing".
 */
export function answerAsked(a: Asked, i: AskedInput): Answer {
  const today = i.today;
  const days = a.period ?? ASKED[a.id].period;
  const span = days ? spanOf(days, today) : null;
  switch (a.id) {
    case 'next': {
      const waiting = (i.asks ?? []).map((x) => `${x.kind}: ${x.title}`);
      if (!i.now) return answer(a, today, 'Nothing is waiting on you.', 'Nothing is waiting on you.', waiting, 'From your Path.');
      return answer(a, today, i.now.title, `Next: ${i.now.title}.${i.now.why ? ` ${i.now.why}` : ''}`,
        [i.now.why ?? '', i.now.size ? `${i.now.size.charAt(0).toUpperCase()}${i.now.size.slice(1)}.` : '', ...(waiting.length ? ['Also waiting on you:', ...waiting] : [])],
        'From your Path: the same move it shows.');
    }
    case 'bet': {
      if (!i.bet) {
        const due = i.checkpointDue ? ' A checkpoint is due: decide whether to pivot or persevere.' : '';
        return answer(a, today, 'No bet running.', `No bet is running.${due || ' Start one on Engine.'}`, [due.trim()], 'From Engine.');
      }
      const b = i.bet;
      return answer(a, today, `Day ${b.day} of ${b.days}: ${b.result}`,
        `Your bet, ${b.belief.replace(/\.$/, '')}: day ${b.day} of ${b.days}, ${b.result}. It passes at ${b.pass}.`,
        [`“${b.belief}” — on ${b.part.toLowerCase()}.`, `It passes at ${b.pass}.`, i.checkpointDue ? 'A checkpoint is due as well.' : ''],
        'Counted from the bet’s own rows, as Engine counts it.');
    }
    case 'goal': {
      const goals = i.goals ?? [];
      if (!goals.length) return answer(a, today, 'No goal set.', 'You have not set a goal yet. Add one under You.', [], null, true);
      const lead = goals.find((g) => g.title === i.outlook?.title) ?? goals[0];
      const leadLine = [lead.title, lead.status, lead.horizon].filter(Boolean).join(' · ');
      const sayLead = `${lead.title}: ${lead.status ?? 'no number on it'}${lead.horizon ? `, ${lead.horizon.replace(/ · /g, ', ')}` : ''}.${lead.verdict ? ` ${lead.verdict}.` : ''}`;
      return answer(a, today, `${leadLine}${lead.verdict ? ` — ${lead.verdict}` : ''}`,
        `${sayLead}${i.outlook && i.outlook.title === lead.title ? ` ${i.outlook.line}` : ''}`,
        [i.outlook && i.outlook.title === lead.title ? i.outlook.line : '', ...goals.filter((g) => g !== lead).map((g) => [g.title, g.status, g.horizon, g.verdict].filter(Boolean).join(' · '))],
        'From your goals and what your rows show of the pace.');
    }
    case 'runway': {
      const r = i.runway;
      if (!r || r.months == null) {
        return answer(a, today, 'No runway yet.', 'There is no runway yet: add your cash and what you spend a month, or a bank statement, under You.', [], null, true);
      }
      const cur = r.currency ?? '';
      const from = (s: string | null | undefined) => (s === 'statement' ? ', from your statements' : s === 'book' ? ', from your book' : s === 'typed' ? ', as you typed it' : '');
      return answer(a, today, `${r.months} months of runway`, `${r.months} months of runway.`,
        [r.cash != null && cur ? `Cash: ${screenMoney(r.cash, cur)}${from(r.cashFrom)}.` : '', r.outPerMonth != null && cur ? `Going out: ${screenMoney(r.outPerMonth, cur)} a month${from(r.outFrom)}.` : ''],
        'Your cash divided by what goes out a month.');
    }
    case 'intros': {
      const list = i.intros ?? [];
      if (!list.length) return answer(a, today, 'No introductions waiting.', 'No introductions are waiting on you.', [], 'From the conversations you logged.');
      const named = list.map((x) => `${x.who ?? 'Someone'}, ${plural(x.days, 'day')} ago`);
      return answer(a, today, `${plural(list.length, 'introduction')} waiting`,
        `${plural(list.length, 'introduction')} waiting on you: ${named.join('; ')}.`,
        list.map((x) => `${x.who ?? 'Someone'} offered one ${plural(x.days, 'day')} ago${x.said ? `: “${x.said}”` : ''}`),
        'From the conversations you logged.');
    }
    case 'talks': return talksAnswer(a, i, span!);
    case 'sales': return salesAnswer(a, i, span!);
    case 'sent': return sentAnswer(a, i, span!);
    case 'focus': return focusAnswer(a, i, span!);
    case 'spent':
    case 'received': return moneyAnswer(a, i, span!);
    case 'safe':
    case 'balance': return bookNowAnswer(a, i);
    default: return serverAnswer(a, i);
  }
}

function talksAnswer(a: Asked, i: AskedInput, span: Span): Answer {
  const today = i.today;
  const failed = (i.unreadable ?? []).find((u) => /conversation|bet/i.test(u));
  if (failed) return answer(a, today, 'Your conversations could not be read just now.', `Your conversations could not be read just now: ${failed}.`, [], null, true);
  const talks = (i.talks ?? []).filter((t) => t.on >= span.from && t.on <= span.to).sort((x, y) => y.on.localeCompare(x.on));
  if (!talks.length) return answer(a, today, `No conversations ${span.label}.`, `You logged no conversations ${span.label}.`, [], 'Only the ones you logged: the app cannot hear your calls.');
  const by = TALK_ROLES.map((r) => [r, talks.filter((t) => roleOf(t) === r).length] as const).filter(([, n]) => n > 0);
  const committed = talks.filter((t) => t.commitment !== 'none').length;
  const roles = by.map(([r, n]) => `${n} ${TALK_ROLE_LABEL[r].toLowerCase()}`).join(', ');
  return answer(a, today, `${plural(talks.length, 'conversation')} ${span.label}`,
    `${plural(talks.length, 'conversation')} ${span.label}: ${roles}. ${committed} ended in a commitment.`,
    talks.slice(0, 8).map((t) => `${dayWords(t.on)} · ${t.who ?? 'Someone'} · ${TALK_ROLE_LABEL[roleOf(t)].toLowerCase()} · ${COMMITMENT_LABEL[t.commitment].toLowerCase()}`),
    `Only the ones you logged, ${daysWords(span)}: the app cannot hear your calls.`);
}

function salesAnswer(a: Asked, i: AskedInput, span: Span): Answer {
  const today = i.today;
  const cur = i.salesCurrency ?? '';
  const wins = (i.wins ?? []).filter((w) => { const d = localDay(w.at, i.timezone); return d >= span.from && d <= span.to; });
  if (!wins.length) return answer(a, today, `No sales ${span.label}.`, `No sales logged ${span.label}.`, [], `Counted from the sales you logged, ${daysWords(span)}.`);
  const priced = wins.filter((w) => w.amount != null);
  const total = priced.reduce((s, w) => s + (w.amount ?? 0), 0);
  const unpriced = wins.length - priced.length;
  const money = priced.length && cur ? ` for ${screenMoney(total, cur)}` : '';
  return answer(a, today, `${plural(wins.length, 'sale')} ${span.label}${money}`,
    `${plural(wins.length, 'sale')} ${span.label}${priced.length && cur ? `, ${spokenMoney(total, cur)}` : ''}.${unpriced ? ` ${unpriced} without an amount logged.` : ''}`,
    wins.slice(0, 8).map((w) => `${dayWords(localDay(w.at, i.timezone))} · ${w.who ?? 'A sale'}${w.amount != null && cur ? ` · ${screenMoney(w.amount, cur)}` : ''}`),
    `Counted from the sales you logged, ${daysWords(span)}.${unpriced ? ` ${unpriced} had no amount and are not in the total.` : ''}`);
}

/** The oldest day the home's recent rows reach. Days before it are not counted from them. */
const recentFloor = (today: string) => shiftDay(today, -(RECENT_DAYS - 1));

function sentAnswer(a: Asked, i: AskedInput, span: Span): Answer {
  const today = i.today;
  const failed = (i.unreadable ?? []).filter((u) => /sent messages|logged outcomes/.test(u));
  if (failed.length) return answer(a, today, 'Your sends could not be read just now.', `Your sends could not be read just now: ${failed.join(', ')}.`, [], null, true);
  // Past the two weeks the home reads back, the honest count is the metrics' own
  // thirty days — said as thirty days, not passed off as the days asked about.
  if (span.from < recentFloor(today)) {
    const m = i.metrics;
    if (!m) return answer(a, today, `Sends are counted for the last ${RECENT_DAYS} days here.`, `The app reads back ${RECENT_DAYS} days of sends here, so it cannot count ${span.label}.`, [], null, true);
    return answer(a, today, `${plural(m.sent, 'message')} out in the last ${m.windowDays} days, ${plural(m.replies, 'reply', 'replies')}`,
      `The app reads back ${RECENT_DAYS} days of sends here, so this is the last ${m.windowDays} days instead: ${plural(m.sent, 'message')} out, ${plural(m.replies, 'reply', 'replies')}.`,
      [`Not ${span.label}: the last ${m.windowDays} days.`], `Counted from your sends and the replies matched to them, last ${m.windowDays} days.`);
  }
  const inSpan = (iso: string) => { const d = localDay(iso, i.timezone); return d >= span.from && d <= span.to; };
  const sent = (i.sentAt ?? []).filter(inSpan).length;
  const replies = (i.replies ?? []).filter(inSpan).length;
  return answer(a, today, `${plural(sent, 'message')} out ${span.label}, ${plural(replies, 'reply', 'replies')}`,
    `${plural(sent, 'message')} out ${span.label}, and ${plural(replies, 'reply', 'replies')}.`,
    [], `Counted from your sends and the replies logged, ${daysWords(span)}.`);
}

function focusAnswer(a: Asked, i: AskedInput, span: Span): Answer {
  const today = i.today;
  if ((i.unreadable ?? []).some((u) => /deep-work/.test(u))) return answer(a, today, 'Your deep-work log could not be read just now.', 'Your deep-work log could not be read just now.', [], null, true);
  if (span.from < recentFloor(today)) {
    return answer(a, today, `Deep work is counted for the last ${RECENT_DAYS} days here.`, `The app reads back ${RECENT_DAYS} days of deep work here, so it cannot count ${span.label}. Ask about this week instead.`, [], null, true);
  }
  const logs = (i.focus ?? []).filter((l) => l.on >= span.from && l.on <= span.to);
  const minutes = logs.reduce((s, l) => s + l.minutes, 0);
  const dayCount = new Set(logs.map((l) => l.on)).size;
  if (!minutes) return answer(a, today, `No deep work logged ${span.label}.`, `No deep work logged ${span.label}.`, [], 'From the deep work you logged.');
  const hours = Math.round((minutes / 60) * 10) / 10;
  return answer(a, today, `${hoursLabel(minutes)} of deep work ${span.label}`,
    `${hours === 1 ? 'One hour' : `${hours} hours`} of deep work ${span.label}, on ${plural(dayCount, 'day')}.`,
    [], `From the deep work you logged, ${daysWords(span)}.`);
}

/** Why the book cannot answer, when it cannot. */
function bookProblem(i: AskedInput): string | null {
  if (i.book === undefined) return 'Your book was not opened.';
  if (typeof i.book === 'string') return `Your book could not be opened: ${i.book}`;
  const notReady = i.book.find((m) => !m.ready);
  if (notReady) return notReady.notReady ?? 'Your book is not set up on this server yet.';
  return null;
}

function moneyAnswer(a: Asked, i: AskedInput, span: Span): Answer {
  const today = i.today;
  const problem = bookProblem(i);
  if (problem) return answer(a, today, problem, problem, [], null, true);
  const months = (i.book as BookMonthIn[]).filter((m) => m.month >= span.from.slice(0, 7) && m.month <= span.to.slice(0, 7));
  const view = months[0]?.view ?? '';
  // Amounts in two currencies do not add up; the book shows a month in its own when a rate is missing.
  if (months.some((m) => m.view !== view)) {
    return answer(a, today, 'These months are in different currencies.', 'These months are kept in different currencies, so they do not add up. Ask about one month.', months.map((m) => m.missing ?? ''), null, true);
  }
  const out = a.id === 'spent';
  const cats = months.flatMap((m) => (out ? m.categories.out : m.categories.in));
  const category = categoryOf(a.about, cats);
  const word = !category && a.about ? a.about.toLowerCase() : null;
  const lines = months.flatMap((m) => m.days.filter((d) => d.on >= span.from && d.on <= span.to).flatMap((d) => d.lines))
    .filter((l) => (out ? l.shown < 0 : l.shown > 0))
    .filter((l) => (category ? (l.category ?? '').toLowerCase() === category.toLowerCase() : word ? `${l.label} ${l.category ?? ''}`.toLowerCase().includes(word) : true));
  const total = Math.round(lines.reduce((s, l) => s + Math.abs(l.shown), 0) * 100) / 100;
  const on = category ?? (word ? `“${a.about}”` : null);
  const verb = out ? 'spent' : 'came in';
  const caveats = [
    ...months.map((m) => m.missing ?? '').filter(Boolean),
    months.some((m) => m.unlabelled > 0) ? 'Rows from a file with no currency are not in it until you say which.' : '',
  ];
  const counted = `Counted from your book: ${plural(lines.length, 'move')}, ${daysWords(span)}.`;
  if (!lines.length) {
    const none = `Nothing ${verb}${on ? ` on ${on}` : ''} ${span.label}.`;
    const yours = word && cats.length ? `Your categories: ${[...new Set(cats)].slice(0, 8).join(', ')}.` : '';
    return answer(a, today, none, `${none}${yours ? ` ${yours}` : ''}`, [yours, ...caveats], counted);
  }
  const title = `${screenMoney(total, view)} ${verb}${on ? ` on ${on}` : ''} ${span.label}`;
  // Where it went, when nothing narrower was asked: the categories, biggest first.
  const byCat = new Map<string, number>();
  if (!on) for (const l of lines) byCat.set(l.category ?? l.label, (byCat.get(l.category ?? l.label) ?? 0) + Math.abs(l.shown));
  const top = [...byCat.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
  return answer(a, today, title,
    `${out ? 'You spent' : 'In came'} ${spokenMoney(total, view)}${on ? ` on ${category ?? a.about}` : ''} ${span.label}, across ${plural(lines.length, 'move')}.${top.length ? ` Most on ${top[0][0]}.` : ''}`,
    [top.length ? top.map(([k, v]) => `${k} ${screenMoney(Math.round(v * 100) / 100, view)}`).join(' · ') : '', ...caveats], counted);
}

function bookNowAnswer(a: Asked, i: AskedInput): Answer {
  const today = i.today;
  const problem = bookProblem(i);
  if (problem) return answer(a, today, problem, problem, [], null, true);
  const m = (i.book as BookMonthIn[]).find((x) => x.month === today.slice(0, 7)) ?? (i.book as BookMonthIn[])[0];
  if (!m || !m.started || !m.balance) {
    return answer(a, today, 'No starting balance yet.', 'Your book has no starting balance yet. Set it on the Money tab, and this is counted from it.', [], null, true);
  }
  if (a.id === 'balance') {
    return answer(a, today, screenMoney(m.balance.shown, m.view), `Your balance is ${spokenMoney(m.balance.shown, m.view)}.`, [m.missing ?? ''], 'From your book: the balance you set and every move since.');
  }
  const s = m.safe;
  if (!s || m.safeShown == null) return answer(a, today, 'Nothing to count it from yet.', 'Safe to spend is counted from your balance, and there is none yet.', [], null, true);
  if (s.broke) {
    return answer(a, today, 'Nothing is safe to spend today.', 'Nothing is safe to spend today: what is already coming up takes the whole balance.',
      [`Coming up in the next ${s.days} days: ${screenMoney(s.committed, m.view)}.`], 'From your balance, less what you already promised for the next 30 days.');
  }
  if (m.safeShown < 0) {
    return answer(a, today, `Over today by ${screenMoney(-m.safeShown, m.view)}`, `You are over today's share by ${spokenMoney(-m.safeShown, m.view)}.`,
      [`Today's share was ${screenMoney(s.perDay, m.view)}.`], 'From your balance, less what you already promised for the next 30 days, spread over them.');
  }
  return answer(a, today, `${screenMoney(m.safeShown, m.view)} left to spend today`, `You can spend ${spokenMoney(m.safeShown, m.view)} today.`,
    [s.spentToday ? `Spent today so far: ${screenMoney(s.spentToday, m.view)}.` : '', s.committed ? `Already promised in the next ${s.days} days: ${screenMoney(s.committed, m.view)}.` : ''],
    'From your balance, less what you already promised for the next 30 days, spread over them.');
}

/** ask.ts's five, said: its headline, and its rows under it. */
function serverAnswer(a: Asked, i: AskedInput): Answer {
  const today = i.today;
  if (i.answers === undefined) return answer(a, today, 'Not counted yet.', 'That has not been counted yet.', [], null, true);
  if (typeof i.answers === 'string') return answer(a, today, 'That could not be counted just now.', `That could not be counted just now: ${i.answers}.`, [], null, true);
  const key = a.id === 'segments' ? 'replies' : a.id === 'calls' ? 'worked' : a.id;
  const hit = i.answers.find((x) => x.id === key);
  if (!hit) return answer(a, today, 'That could not be counted just now.', 'That could not be counted just now.', [], null, true);
  return answer(a, today, hit.headline, hit.headline,
    [...hit.rows.map((r) => `${r.label}: ${r.value}${r.note ? ` (${r.note})` : ''}`), !hit.rows.length && hit.thin ? hit.thin : ''],
    'Counted over everything you have done in the app.', !hit.rows.length);
}

/* ─── A model, where the rules do not match ───────────────────────────────── */

export const ASKED_SYSTEM = [
  'You match one question a small business owner asked out loud to one question on a fixed list that their app can answer by counting.',
  'You never answer it, estimate, or add anything: you only say which question on the list it is, the days it is about, and what it is about.',
  'If no question on the list is what they asked, say "none". A question asking for advice or an opinion is "none".',
  'Answer with JSON only.',
].join(' ');

const PERIOD_HELP: Record<Period, string> = {
  today: 'today', yesterday: 'yesterday', week: 'this week, the last 7 days', lastweek: 'last week, the 7 days before that',
  month: 'this calendar month', lastmonth: 'last calendar month', '30d': 'the last 30 days, or "the past month"',
};

export function askedPrompt(heard: string, c: { today: string; categories?: { out: string[]; in: string[] } }): string {
  const cats = [...new Set([...(c.categories?.out ?? []), ...(c.categories?.in ?? [])])];
  return [
    `Today is ${c.today}.`,
    '',
    'What they asked:',
    `"${heard}"`,
    '',
    'Questions their app can count:',
    ...ASKED_IDS.map((id) => `- "${id}": ${ASKED[id].help}`),
    '',
    'Days a question can be about (only if they said which):',
    ...PERIODS.map((p) => `- "${p}": ${PERIOD_HELP[p]}`),
    '',
    ...(cats.length ? [`Their money categories: ${cats.join(', ')}.`] : []),
    'For "spent" or "received", "about" is the category or the thing it was spent on, copied from what they said, else null.',
    '',
    'Return {"id": "..." or "none", "period": "..." or null, "about": "..." or null}',
  ].join('\n');
}

const ABOUT_MAX = 40;

/**
 * A model's match, held to the list and to the words. The question must be one
 * on the list; the days must be one of the periods, and only when the words
 * said some (the rules read them, and the model is not trusted to have heard a
 * week nobody said); "about" must be one of their categories or appear in what
 * was said. A model that gave a number is ignored: there is nowhere for one to go.
 */
export function normalizeAsked(raw: unknown, c: { heard: string; categories?: { out: string[]; in: string[] } }): Asked | null {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const id = typeof o.id === 'string' && (ASKED_IDS as readonly string[]).includes(o.id) ? (o.id as AskedId) : null;
  if (!id) return null;
  const said = periodOf(c.heard);
  const given = typeof o.period === 'string' && (PERIODS as readonly string[]).includes(o.period) ? (o.period as Period) : null;
  const period = said ?? (given && cleanAsked(c.heard).split(' ').some((w) => ['week', 'month', 'today', 'yesterday', 'days', 'tonight'].includes(w)) ? given : null);
  let about: string | null = null;
  if ((id === 'spent' || id === 'received') && typeof o.about === 'string' && o.about.trim()) {
    const a = o.about.trim().slice(0, ABOUT_MAX);
    const cats = [...(c.categories?.out ?? []), ...(c.categories?.in ?? [])];
    about = categoryOf(a, cats) ?? (cleanAsked(c.heard).includes(cleanAsked(a)) ? cleanAsked(a) : null);
  }
  return { id, period, about, by: 'model' };
}

