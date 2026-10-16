// scripts/copilot-ideas-eval.ts
// Which model should write the ideas — and did a change to their prompts make them better or worse?
//
// Ideas are the one place the app is asked for judgement about the world, and
// "it read fine" is how a United States loan program's counselors were offered
// to a founder in Manila, beside two ideas that were one idea. So this runs the
// REAL write (ideas.ts writeIdeaSet: six written, read again, three kept) on
// three businesses whose wrong answers are known, and scores what breaks: no
// set, an idea that does not say what it tests, two ideas through one cause, a
// program or platform from the wrong country, the review not running. The
// pages each business is given are its own fixture's, and one of them is bait:
// the search really does return American pages.
//
// With --judge, another model scores each kept idea from 1 to 5 against a
// rubric — fits where the business is, fits this business, startable this
// week, a count that would show the cause, different from the others — for
// comparing models or prompts on more than the rules. The judge is a model too:
// read the ideas it prints, and pick on the failures, not the averages.
//
//   COPILOT_AI_API_KEY=sk-or-... COPILOT_AI_BASE_URL=https://openrouter.ai/api/v1 \
//     npx tsx scripts/copilot-ideas-eval.ts openai/gpt-5.6-luna z-ai/glm-5.3-flash --judge anthropic/claude-sonnet-5.5
//
// Two calls per business per model, one more with the judge: cents per model.

import type { LinkKey } from '../src/lib/copilot/business';
import { writeIdeaSet, type AskModel, type IdeasContext, type WrittenSet } from '../src/lib/copilot/ideas';
import { extractJson } from '../src/lib/copilot/agent/schema';
import { playLine } from '../src/lib/copilot/lab';

const BASE = process.env.COPILOT_AI_BASE_URL || 'https://openrouter.ai/api/v1';
const KEY = process.env.COPILOT_AI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
/** A model that thinks before it answers spends its thinking from the same cap: COPILOT_AI_MAX_OUTPUT_TOKENS, as in the app. */
const MAX_TOKENS = Number(process.env.COPILOT_AI_MAX_OUTPUT_TOKENS) || 0;

interface Fixture {
  name: string;
  ctx: IdeasContext;
  /** Never in an idea: a program, platform or place from another country, a play the record shows failed as it was. */
  mustNot: Array<{ re: RegExp; why: string }>;
}

const link = (key: LinkKey, label: string, state: string, why: string) => ({ key, label, state, why, facts: '' }) as IdeasContext['links'][number];
const page = (n: number, host: string, title: string, said: string) => ({ n, title, url: `https://${host}/p${n}`, said });
const US_PROGRAMS = { re: /\bSBA\b|\bSCORE\b|Small Business (?:Administration|Development Cent)|\bSBDC\b/i, why: 'a United States program' };

const FIXTURES: Fixture[] = [
  {
    // The owner's own case, as its screenshots showed it.
    name: 'App for first-time founders, Manila — how they hear',
    ctx: {
      part: 'reach',
      offer: { sells: 'Founder OS Copilot App', for_who: 'People who want a business but do not know how to start, tech indies, freelancers', problem: 'Not knowing what to do that moves the needle', price_band: '$29/month' },
      foundBy: 'inbound', working: null,
      links: [
        link('who', 'Who buys', 'testing', '2 of 3 people you talked to had the problem.'),
        link('reach', 'How they hear', 'stuck', '0 sign-ups from your page in 14 days.'),
        link('close', 'How they say yes', 'untested', 'Nobody has been asked yet.'),
        link('pay', 'What they pay', 'untested', 'No sale logged.'),
        link('deliver', 'How it gets done', 'untested', 'Nothing delivered yet.'),
      ],
      bets: [{ state: 'failed', result: 0, belief: 'People who already know me will forward my page to founders', part: 'reach', line: '0 of 10 sign-ups' }],
      talks: { n: 3, problem: 2, committed: 0 }, assets: ['landing_page'],
      place: { based: 'Manila', area: null },
      research: {
        queries: ['how a founder OS Copilot App got its first 100 customers without ads', 'where people who want a business but do not know how to start in Manila go to ask for advice'],
        why: null,
        evidence: [
          page(1, 'indie.example', 'How I got my first 100 users without ads', 'I answered questions in founder communities every day for a month, and linked my tool only when it was the answer.'),
          page(2, 'us-mentoring.example', 'Free mentoring for small businesses from SBA resource partners', 'SCORE volunteers and Small Business Development Centers give free counseling to new business owners across the United States.'),
          page(3, 'ph-founders.example', 'Where first-time founders in the Philippines ask for advice', 'Most of my first customers came from Facebook groups for aspiring entrepreneurs in the Philippines.'),
          page(4, 'manila-events.example', 'Startup meetups in Metro Manila this month', 'Pitch nights and founder meetups in Makati and BGC, most of them free to attend.'),
        ],
      },
    },
    mustNot: [US_PROGRAMS],
  },
  {
    name: 'Emergency plumber, Austin — how they hear',
    ctx: {
      part: 'reach',
      offer: { sells: 'Emergency plumbing repairs', for_who: 'Homeowners in north Austin, property managers', problem: 'A leak that cannot wait until Monday', price_band: '$150 call-out' },
      foundBy: 'local', working: null,
      links: [
        link('who', 'Who buys', 'works', '4 jobs paid this month.'),
        link('reach', 'How they hear', 'untested', 'No count of where jobs came from.'),
        link('close', 'How they say yes', 'works', '4 of 5 quotes accepted.'),
        link('pay', 'What they pay', 'works', 'Every job paid at $150 or more.'),
        link('deliver', 'How it gets done', 'testing', 'One job ran over a day.'),
      ],
      bets: [], talks: { n: 5, problem: 5, committed: 4 }, assets: [],
      place: { based: 'Austin, Texas', area: 'North Austin' },
      research: {
        queries: ['how an emergency plumbing repairs got its first 100 customers without ads'],
        why: null,
        evidence: [
          page(1, 'trades.example', 'How UK tradespeople win jobs on Checkatrade', 'Most of our first jobs came from Checkatrade reviews in our postcode.'),
          page(2, 'local-seo.example', 'Getting found on Google Maps as a plumber', 'A complete business profile with photos and recent reviews brought us most emergency calls.'),
          page(3, 'pm-network.example', 'What property managers want from a plumber', 'They keep a short list of vendors who answer the phone at night.'),
        ],
      },
    },
    mustNot: [{ re: /Checkatrade/i, why: 'a platform for the United Kingdom' }],
  },
  {
    name: 'Booking automation for dental clinics, London — how they say yes',
    ctx: {
      part: 'close',
      offer: { sells: 'Booking automation for dental clinics', for_who: 'Dental clinics', problem: 'Missed calls are lost bookings', price_band: '£300 a month' },
      foundBy: 'outreach', working: null,
      links: [
        link('who', 'Who buys', 'works', '4 of 6 clinics had the problem.'),
        link('reach', 'How they hear', 'works', '9 replies from 60 messages.'),
        link('close', 'How they say yes', 'stuck', '0 sales from 5 meetings.'),
        link('pay', 'What they pay', 'untested', 'No sale logged.'),
        link('deliver', 'How it gets done', 'untested', 'Nothing delivered yet.'),
      ],
      bets: [{ state: 'failed', result: 0, belief: 'A free trial turns clinics that meet me into paying ones', part: 'close', line: '0 of 2 sales at your price, from 5 meetings' }],
      talks: { n: 6, problem: 4, committed: 1 }, assets: ['script'],
      heard: [
        'Ana — could buy, agreed to another call: “We lose 2 bookings a week to missed calls”',
        'Someone — sells to them: “Clinics pay £90 a month for answering services”',
      ],
      place: { based: 'London', area: null },
      research: {
        queries: ['how founders of a booking automation for dental clinics turned first conversations into sales'],
        why: null,
        evidence: [
          page(1, 'us-loans.example', 'SBA loans for dental practices', 'Dental practices can use SBA 7(a) loans to buy new equipment and software.'),
          page(2, 'saas-sales.example', 'Why our first clinics said yes', 'We stopped offering trials and started with a paid pilot priced against what one missed booking costs.'),
        ],
      },
    },
    mustNot: [US_PROGRAMS, { re: /free trial/i, why: 'the free trial that already failed, as it was' }],
  },
];

function askVia(model: string): AskModel {
  return async (call) => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model, temperature: call.temperature, max_tokens: MAX_TOKENS || call.maxOutputTokens,
          messages: [{ role: 'system', content: call.system }, { role: 'user', content: call.prompt }],
        }),
        signal: AbortSignal.timeout(call.timeoutMs),
      });
    } catch (e) {
      if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new Error(`${model} did not answer within ${call.timeoutMs / 1000}s`);
      throw e;
    }
    const body = await res.json().catch(() => ({})) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!res.ok || body.error) throw new Error(body.error?.message || `HTTP ${res.status}`);
    return body.choices?.[0]?.message?.content ?? '';
  };
}

const RUBRIC = ['place', 'specific', 'doable', 'telling', 'distinct'] as const;

/** Each kept idea scored from 1 to 5 on the rubric by another model; null when it did not answer in shape. */
async function judge(model: string, f: Fixture, set: WrittenSet): Promise<Array<Record<(typeof RUBRIC)[number], number> & { note: string }> | null> {
  const o = f.ctx.offer;
  const prompt = [
    `A small business: sells ${o.sells}, to ${o.for_who}, for ${o.price_band}. Based in ${f.ctx.place?.based ?? 'a place not said'}.`,
    `Experiments already run: ${f.ctx.bets.map((b) => `"${b.belief}" — did not pass (${b.line})`).join('; ') || 'none'}.`,
    '',
    'Experiments proposed to them:',
    ...set.ideas.map((i, n) => `[${n + 1}] ${i.label}: ${i.how} Tests "${i.belief ?? '—'}". Pass line: ${playLine(i, null)}.`),
    '',
    'Score each from 1 (bad) to 5 (good) on:',
    'place: it uses only programs, platforms, events and places that exist where the business is;',
    'specific: it fits this business and its record, not any business;',
    'doable: one person could start it this week;',
    'telling: its count would show whether the cause it relies on works;',
    'distinct: it differs from the other ideas in the cause it works through.',
    'Return JSON only: {"scores": [{"n": 1, "place": 5, "specific": 4, "doable": 5, "telling": 4, "distinct": 5, "note": "one sentence"}]}',
  ].join('\n');
  try {
    const text = await askVia(model)({ system: 'You are a strict, experienced small-business operator scoring proposed experiments. Answer with JSON only.', prompt, temperature: 0, maxOutputTokens: 1500, timeoutMs: 120_000 });
    const raw = extractJson(text) as { scores?: Array<Record<string, unknown>> };
    const scores = (raw.scores ?? []).map((s) => ({ ...Object.fromEntries(RUBRIC.map((k) => [k, Number(s[k]) || 0])), note: String(s.note ?? '') }));
    return scores.length ? scores as Array<Record<(typeof RUBRIC)[number], number> & { note: string }> : null;
  } catch {
    return null;
  }
}

async function run(model: string, judgeModel: string | null): Promise<{ failures: number }> {
  let failures = 0;
  console.log(`\n${model}`);
  console.log('─'.repeat(Math.max(model.length, 60)));
  for (const f of FIXTURES) {
    const began = Date.now();
    console.log(`\n  ${f.name}`);
    let set: WrittenSet;
    try {
      set = await writeIdeaSet(f.ctx, askVia(model));
    } catch (e) {
      failures++;
      console.log(`    ✗ no set — ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const text = (i: WrittenSet['ideas'][number]) => `${i.label} ${i.how} ${i.belief ?? ''}`;
    const checks: Array<{ label: string; pass: boolean; note?: string }> = [
      { label: `${set.ideas.length} kept of ${set.written} written`, pass: set.ideas.length >= 2 },
      { label: 'every idea says what it tests', pass: set.ideas.every((i) => !!i.belief) },
      { label: 'one cause each', pass: new Set(set.ideas.map((i) => i.mechanism)).size === set.ideas.length, note: set.ideas.map((i) => i.mechanism).join(', ') },
      { label: 'read again', pass: set.review.ran, note: set.review.ran ? `${set.review.dropped.length} set aside` : set.review.why },
      ...f.mustNot.map((m) => {
        const hit = set.ideas.find((i) => m.re.test(text(i)));
        return { label: `nothing that is ${m.why}`, pass: !hit, note: hit?.label };
      }),
    ];
    for (const c of checks) {
      if (!c.pass) failures++;
      console.log(`    ${c.pass ? '✓' : '✗'} ${c.label}${c.note ? `  — ${c.note}` : ''}`);
    }
    for (const [n, i] of set.ideas.entries()) {
      console.log(`    ${n + 1}. ${i.label} [${i.mechanism}]${i.sources?.length ? ` · ${i.sources.length} page${i.sources.length === 1 ? '' : 's'}` : ''}`);
      console.log(`       ${i.how}`);
      console.log(`       Tests: ${i.belief ? `“${i.belief}”` : '—'} · ${playLine(i, null)}`);
    }
    if (set.review.ran) for (const d of set.review.dropped) console.log(`    set aside: ${d.label}${d.why ? ` — ${d.why}` : ''}`);
    if (judgeModel) {
      const scores = await judge(judgeModel, f, set);
      if (!scores) console.log('    judge: did not answer in shape');
      else {
        const avg = (k: (typeof RUBRIC)[number]) => (scores.reduce((s, x) => s + x[k], 0) / scores.length).toFixed(1);
        console.log(`    judge (${judgeModel}): ${RUBRIC.map((k) => `${k} ${avg(k)}`).join(' · ')}`);
        for (const [n, s] of scores.entries()) if (s.note) console.log(`       ${n + 1}: ${s.note}`);
      }
    }
    console.log(`    ${((Date.now() - began) / 1000).toFixed(1)}s`);
  }
  return { failures };
}

async function main() {
  const args = process.argv.slice(2);
  const j = args.indexOf('--judge');
  const judgeModel = j >= 0 ? args[j + 1] ?? null : null;
  const models = args.filter((a, i) => a !== '--judge' && (j < 0 || i !== j + 1));
  if (!KEY) { console.error('Set COPILOT_AI_API_KEY (or OPENROUTER_API_KEY).'); process.exit(1); }
  if (!models.length) {
    console.error('Usage: npx tsx scripts/copilot-ideas-eval.ts <model> [model...] [--judge <model>]');
    console.error('Model ids are whatever your endpoint calls them. The one that wins goes in COPILOT_IDEAS_MODEL.');
    process.exit(1);
  }
  console.log(`Endpoint: ${BASE}`);
  console.log(`${FIXTURES.length} businesses per model; each set written, read again and three kept, as in the app.`);
  let failures = 0;
  for (const m of models) failures += (await run(m, judgeModel)).failures;
  console.log('\nPick on the failures, not the totals: "no set" and an idea from the wrong country are');
  console.log('disqualifying; read the ideas themselves before trusting a judge’s average.\n');
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
