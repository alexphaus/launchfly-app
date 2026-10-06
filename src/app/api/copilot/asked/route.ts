// src/app/api/copilot/asked/route.ts
// Which counted question was asked, when the app's own rules could not tell
// (lib/copilot/asked.ts). A model may only pick a question off the list, the
// days and what it was about — never an answer: the Ask sheet counts the answer
// from the rows, as it does for a question the rules matched. Nothing is
// written here.
//
// One attempt, bounded under the proxy's ceiling, a daily cap, and every way it
// can fail said in words the sheet shows (invariant 13).
import { generateText } from 'ai';
import { maxOutputTokens, providerFor, resolveLlmConfig } from '@/lib/copilot/agent/llm';
import { extractJson } from '@/lib/copilot/agent/schema';
import { ASKED_SYSTEM, askedPrompt, cleanAsked, normalizeAsked } from '@/lib/copilot/asked';
import { getProfile } from '@/lib/copilot/base';
import { todayIso } from '@/lib/copilot/db';
import { json, profileIdOr401, readJson } from '@/lib/copilot/http';
import { rateLimit } from '@/lib/copilot/limits';

export const runtime = 'nodejs';

/** A breath, not a document: past this it is not a question for a counter. */
const HEARD_MAX = 300;
/** Questions matched by a model per person per day. Past it, the rules and the taps still answer. */
const ASKED_PER_DAY = 300;
/** Inside the tap's patience: the person is waiting to hear an answer. */
const TIMEOUT_MS = 9_000;

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 60) : []);

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const heard = typeof b.heard === 'string' ? b.heard.trim().slice(0, HEARD_MAX) : '';
  if (!cleanAsked(heard)) return json({ ok: true, asked: null, why: 'Nothing was asked.' });
  const cfg = resolveLlmConfig();
  if (!cfg) return json({ ok: true, asked: null, why: 'There is no model on this server, so only the questions on the list are answered.' });
  const rl = await rateLimit(`copilot:asked:${auth.pid}`, ASKED_PER_DAY, 86_400);
  if (!rl.ok) return json({ ok: true, asked: null, why: `${ASKED_PER_DAY} questions worked out today. Tap one on the list instead.` });
  const c = b.categories && typeof b.categories === 'object' ? (b.categories as Record<string, unknown>) : {};
  const categories = { out: strings(c.out), in: strings(c.in) };
  const profile = await getProfile(auth.pid);
  let text: string;
  try {
    ({ text } = await generateText({
      model: providerFor(cfg)(cfg.model),
      system: ASKED_SYSTEM,
      prompt: askedPrompt(heard, { today: todayIso(profile?.timezone ?? 'UTC'), categories }),
      temperature: 0,
      maxRetries: 0,
      maxOutputTokens: maxOutputTokens() ?? 200,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    }));
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const timedOut = (e instanceof Error && e.name === 'TimeoutError') || /abort|timeout/i.test(m);
    return json({ ok: true, asked: null, why: timedOut ? `${cfg.model} did not answer within ${TIMEOUT_MS / 1000}s.` : `The model did not answer (${m.slice(0, 140)}).` });
  }
  let parsed: unknown;
  try { parsed = extractJson(text); } catch { return json({ ok: true, asked: null, why: 'The model did not answer in the shape asked for.' }); }
  const asked = normalizeAsked(parsed, { heard, categories });
  return json({ ok: true, asked, why: asked ? null : 'That is not a question the app can count.' });
}
