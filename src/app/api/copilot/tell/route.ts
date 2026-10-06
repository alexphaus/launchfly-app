// src/app/api/copilot/tell/route.ts
// What was said into the mic, sorted into the record it belongs to
// (lib/copilot/tell.ts). It reads and never writes: the sheet the shell opens
// with the sort is where anything is kept, and only by the person's tap.
//
// A model sorts when there is one, held to the words; when there is none, when
// the day's sorts are spent, or when it fails, the app's own rules sort it and
// the sheet says which and why (invariant 13). There is no failure here that
// costs what was said: the words always come back.

import { generateText } from 'ai';
import { maxOutputTokens, providerFor, resolveLlmConfig } from '@/lib/copilot/agent/llm';
import { extractJson } from '@/lib/copilot/agent/schema';
import { todayIso } from '@/lib/copilot/db';
import { rateLimit } from '@/lib/copilot/limits';
import { getProfile } from '@/lib/copilot/store';
import { TELL_SYSTEM, cleanHeard, normalizeTold, readByRules, tellPrompt, type Reading } from '@/lib/copilot/tell';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * A sort is a sentence in and a few words out. Past this the person is looking
 * at a mic that heard them, and the rules sort it instead — under the proxy's
 * ceiling for a tap with room to spare.
 */
const TELL_TIMEOUT_MS = 9_000;
/** Sorts by a model per person per day. A busy day of logging is dozens; past this the rules sort, and say so. */
const TELL_PER_DAY = 300;

const strings = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, max) : []);

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const profile = await getProfile(auth.pid);
  if (!profile) return fail('Not found', 404);
  const b = await readJson(req);
  const heard = cleanHeard(b.heard);
  if (!heard) return fail('Nothing was heard.');
  const today = todayIso(profile.timezone);
  // The person's own categories, so the rules can tell "food 200" from "Juan 500" when they sort.
  const c = b.categories && typeof b.categories === 'object' ? (b.categories as Record<string, unknown>) : {};
  const categories = { out: strings(c.out, 80), in: strings(c.in, 80) };
  const rules = (why: string): Reading => ({ meta: { heard, by: 'rules', why }, told: readByRules(heard, today, categories) });

  const cfg = resolveLlmConfig();
  if (!cfg) return json({ ok: true, reading: rules('No AI on this server, so the app’s own rules sorted it.') });
  const rl = await rateLimit(`copilot:tell:${auth.pid}`, TELL_PER_DAY, 86_400);
  if (!rl.ok) return json({ ok: true, reading: rules(`${TELL_PER_DAY} sorted by AI today; the app’s own rules sorted this one.`) });

  let text: string;
  try {
    ({ text } = await generateText({
      model: providerFor(cfg)(cfg.model),
      system: TELL_SYSTEM,
      prompt: tellPrompt(heard, {
        today,
        weekday: new Date(`${today}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
        offer: profile.offer ?? {},
      }),
      temperature: 0,
      maxRetries: 0,
      maxOutputTokens: maxOutputTokens() ?? 600,
      abortSignal: AbortSignal.timeout(TELL_TIMEOUT_MS),
    }));
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const why = (e instanceof Error && e.name === 'TimeoutError') || /abort|timeout/i.test(m)
      ? `${cfg.model} did not answer within ${TELL_TIMEOUT_MS / 1000}s`
      : `AI did not answer (${m.slice(0, 120)})`;
    return json({ ok: true, reading: rules(`${why}, so the app’s own rules sorted it.`) });
  }
  let parsed: unknown;
  try { parsed = extractJson(text); } catch {
    return json({ ok: true, reading: rules('AI did not answer in the shape asked for, so the app’s own rules sorted it.') });
  }
  const told = normalizeTold(parsed, { heard, today });
  if (!told) return json({ ok: true, reading: rules('AI’s sort did not hold to what you said, so the app’s own rules sorted it.') });
  const reading: Reading = { meta: { heard, by: 'model', why: null }, told };
  return json({ ok: true, reading });
}
