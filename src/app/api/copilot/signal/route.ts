// src/app/api/copilot/signal/route.ts
// The count link, from the app's side: show it, or make a new one, which ends
// the old one at once (lib/copilot/signal.ts). Signed in only — the links are
// the account's, and whoever holds one can add to its counts.

import { SIGNAL_KINDS, signalUrl, type SignalKind } from '@/lib/copilot/signal';
import { signalToken } from '@/lib/copilot/signalkey';
import { signalKey } from '@/lib/copilot/session';
import { loadHome, makeSignalLink, signalGeneration } from '@/lib/copilot/store';
import { appBaseUrl } from '@/lib/copilot/auth';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

/** One address per kind: a form tool posts its own payload, so the link says what each post counts. Stripe's is the plain one. */
function links(origin: string, pid: string, gen: string) {
  const token = signalToken(pid, gen, signalKey());
  const out = Object.fromEntries(SIGNAL_KINDS.map((k) => [k, signalUrl(origin, token, k)])) as Record<SignalKind, string>;
  return { ...out, stripe: signalUrl(origin, token) };
}

export async function GET(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  try {
    const gen = await signalGeneration(auth.pid);
    return json({ ok: true, links: gen ? links(appBaseUrl(req), auth.pid, gen) : null });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not read your link', 500);
  }
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  if (b.action !== 'make') return fail('Unknown action');
  try {
    const gen = await makeSignalLink(auth.pid);
    return json({ ok: true, links: links(appBaseUrl(req), auth.pid, gen), home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not make a link', 500);
  }
}
