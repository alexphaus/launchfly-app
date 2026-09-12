// src/app/api/copilot/watch/discover/route.ts
// Find feeds worth watching, and prove each one works before offering it.
//
// The watcher is the only sensor that reaches outside the account, and until now
// filling it was the user's problem: you had to already know which subreddit,
// job board or newsletter carries your work. That is most of what somebody would
// be hiring this app to figure out, and it was the blank first screen.
//
// The order here is the whole argument. Exa returns PAGES — real URLs, not a
// model's recollection of one — then every page is turned into feed candidates
// deterministically (a site's own <link rel="alternate">, or normalizeSourceUrl
// for the shapes we know), then every candidate is FETCHED AND PARSED. Only a
// feed that returned real items reaches the screen, carrying one of its own
// headlines as the sample.
//
// So no inferred thing is ever promoted over a sourced one: by the time a card
// exists the feed behind it has already been read. That is invariant 3 holding
// at the point where it would have been easiest to let go — see the comment at
// the top of watch/exa.ts for why a search that returns prose instead of URLs
// could not have been used at all.

import { loadHome, loadWatchSources, saveWatchSource } from '@/lib/copilot/store';
import { getProfile } from '@/lib/copilot/base';
import { rateLimit } from '@/lib/copilot/limits';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';
import { exaConfigured, exaSearch } from '@/lib/copilot/watch/exa';
import {
  MAX_TRIES_PER_PAGE, candidateFeeds, discoveredFrom, discoveryQueries,
  hostOf, newCandidates, rankDiscovered, type DiscoveryCandidate, type Discovered,
} from '@/lib/copilot/watch/discover';
import { MAX_ITEMS_PER_SOURCE, parseFeed } from '@/lib/copilot/watch/feed';
import { USER_AGENT, fetchFeed } from '@/lib/copilot/jobs/watcher';
import { normalizeSourceUrl } from '@/lib/copilot/watch/catalogue';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Same ceiling as /watch/run, and for the same reason: under the proxy limit. */
const BUDGET_MS = 25_000;
/** Exa charges per search. This is a discovery button, not a refresh button. */
const PER_DAY = 12;
/** Pages read per run. Each is one fetch plus up to MAX_TRIES_PER_PAGE more. */
const MAX_VERIFY = 14;
/** We only need the <head>; anything past this is not going to contain one. */
const MAX_PAGE_BYTES = 1_500_000;
const PAGE_TIMEOUT_MS = 8_000;

/** A page, for its autodiscovery links. Failure is normal and never thrown. */
async function fetchPage(url: string, budgetMs: number): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.min(PAGE_TIMEOUT_MS, budgetMs));
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*' },
    });
    if (!res.ok) return null;
    const body = await res.text();
    return body.slice(0, MAX_PAGE_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * One candidate, verified or dropped.
 *
 * A page that already IS a feed skips the page fetch entirely, which is most of
 * what Exa returns for the community shapes — a subreddit converts with no
 * network at all.
 */
async function verify(cand: DiscoveryCandidate, deadline: number): Promise<Discovered | null> {
  const left = () => deadline - Date.now();
  if (left() < 3_000) return null;

  const direct = normalizeSourceUrl(cand.page);
  const tries = direct?.kind === 'feed'
    ? [direct.url]
    : candidateFeeds(cand.page, (await fetchPage(cand.page, left())) ?? undefined);

  for (const url of tries.slice(0, MAX_TRIES_PER_PAGE)) {
    if (left() < 2_500) return null;
    try {
      const items = parseFeed(await fetchFeed(url, left())).slice(0, MAX_ITEMS_PER_SOURCE);
      const found = discoveredFrom(cand, url, items);
      // First one that parses wins. A site serving both RSS and Atom is one
      // source, and offering it twice is how a watchlist fills with duplicates.
      if (found) return found;
    } catch {
      // A 404 on a guessed /feed is the expected case, not an error worth a log.
    }
  }
  return null;
}

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;

  const profile = await getProfile(auth.pid);
  if (!profile) return fail('No profile');

  // Adding one of the results, rather than searching for more. Kept on this
  // route so the thing that verified a feed is the thing that saves it — the
  // sources route re-normalises, which would undo the conversion done above.
  const body: Record<string, unknown> = await readJson(req).catch(() => ({}));
  const add = typeof body.url === 'string' ? body.url.trim() : '';
  if (add) {
    try {
      await saveWatchSource(auth.pid, {
        url: add,
        label: typeof body.label === 'string' ? body.label.slice(0, 80) : undefined,
        intent: typeof body.intent === 'string' ? body.intent.slice(0, 200) : undefined,
        kind: 'feed',
        discovered_by: 'exa',
      });
      return json({ ok: true, home: await loadHome(auth.pid) });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Could not add that source');
    }
  }

  if (!exaConfigured()) {
    return fail('Source discovery is not switched on for this deployment.');
  }

  // The offer gate, one step further out than invariant 1 usually reaches. A
  // search run from a blank offer returns whatever the engine free-associates,
  // and a watchlist nobody recognises is worse than an empty one.
  const queries = discoveryQueries(profile);
  if (!queries.length) {
    return fail('Set what you sell and who for first — that is what the search is built from.');
  }

  const rl = await rateLimit(`copilot:discover:${auth.pid}`, PER_DAY, 86400);
  if (!rl.ok) return fail('That is enough searching for today.', 429);

  const deadline = Date.now() + BUDGET_MS;
  try {
    // Never offer something already on the list, and never two feeds from one
    // host: six pages of the same job board is six nightly model calls asking
    // the same question.
    const seen = new Set((await loadWatchSources(auth.pid)).map((s) => hostOf(s.url)));
    const candidates: DiscoveryCandidate[] = [];

    for (const q of queries) {
      if (Date.now() > deadline - 8_000 || candidates.length >= MAX_VERIFY) break;
      try {
        candidates.push(...newCandidates(await exaSearch(q.query, deadline - Date.now()), q.label, seen));
      } catch (e) {
        // One query failing is not the run failing. The others still ran.
        console.error('[copilot/discover] search failed:', e instanceof Error ? e.message : e);
      }
    }

    if (!candidates.length) {
      return json({ ok: true, found: [], searched: queries.map((q) => q.label), note: 'Nothing new — everything it found is already on your list.' });
    }

    // Safe to run flat out: newCandidates already guarantees one host each, so
    // there is no same-host burst to pace here the way the nightly run has to.
    const settled = await Promise.all(candidates.slice(0, MAX_VERIFY).map((c) => verify(c, deadline)));
    const found = rankDiscovered(settled.filter((d): d is Discovered => !!d));

    return json({
      ok: true,
      found,
      searched: queries.map((q) => q.label),
      // What it looked at versus what survived. A run that read eleven pages and
      // could verify two feeds is a real answer, and saying so is the difference
      // between "nothing found" and "nothing works".
      checked: candidates.length,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not search for sources');
  }
}
