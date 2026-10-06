'use client';
// The other end of a text share: what public/sw.js kept of it — or share/route.ts's
// page, for the first share before a worker is active — read once, and emptied.
// Client only: Cache Storage is the browser's, and the worker's answer to a share
// is a redirect that carries nothing else.
import { SEED_CACHE, SEED_KEY, seedIsFresh, seedOf, type Seed } from '@/lib/copilot/seed';

/**
 * The words shared to Copilot, as a seed for a bet. Every way it can fail is a
 * sentence the screen says (invariant 13): a share that vanished looks exactly
 * like one that opened a sheet and found nothing.
 *
 * `fresh` is the read on an ordinary open, when nothing says a share was just
 * made: words shared while signed out, kept by the worker and waiting for the
 * first open after sign-in. Only fresh ones are taken (seed.ts SEED_FRESH_MS), and
 * finding nothing is not a failure to say — it is every other open. Once
 * something was found, a failure to read it is said all the same.
 */
export async function takeSharedSeed(opts: { fresh?: boolean } = {}): Promise<{ seed: Seed | null; error: string | null }> {
  const quiet = !!opts.fresh;
  let found = false;
  try {
    if (!('caches' in window)) return { seed: null, error: quiet ? null : 'This browser kept nothing from that share. Start a bet and paste it in.' };
    const cache = await caches.open(SEED_CACHE);
    const kept = await cache.match(SEED_KEY);
    if (!kept) return { seed: null, error: quiet ? null : 'That share was not kept. Share it again.' };
    found = true;
    // Spent on the first read: a share opens one sheet, however often the app is.
    await cache.delete(SEED_KEY);
    const raw = await kept.json();
    if (quiet && !seedIsFresh(raw, Date.now())) return { seed: null, error: null };
    const seed = seedOf(raw);
    return seed ? { seed, error: null } : { seed: null, error: 'There were no words or link in that share.' };
  } catch (e) {
    return { seed: null, error: quiet && !found ? null : `That share could not be read: ${e instanceof Error ? e.message : String(e)}` };
  }
}
