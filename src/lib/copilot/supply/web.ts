// src/lib/copilot/supply/web.ts
// The web searches the app plans for itself: companies and people, one Exa
// search each.
//
// What to search for is not asked of anybody. planHunts (hunting.ts) works it
// out from the offer, the working file, the goals and where the user is, keeps
// the searches that bring in people worth writing to, and replaces the ones that
// do not — at the start of every run, so the first run with an offer already
// searches. This adapter runs what was planned, in the category the kind names,
// and turns what came back into candidates the pool already knows how to dedupe,
// rank and meter. Then, for companies only, it opens each site and reads it for
// an email or a WhatsApp link, because a company with no way to reach it is a
// row you can only scroll past. People are contacted by hand from their profile,
// which is also why their profile is never opened: LinkedIn refuses scripts, and
// the search index already says the page exists.
//
// Billable: Exa charges per search. Metered against the monthly allowance like
// Maps (invariant 6 says a FREE adapter must not spend it; this one is not free).
//
// Each hunt records its own run — found, or why it failed — on its row, so a
// hunt that broke never reads as one that found nothing (invariant 13). One
// hunt failing does not stop the others.

import { planHunts } from '../hunting';
import { candidatesFromHits, contactFromHtml, contactPageLink, exaCategoryFor, exaQueryFor, HUNT_RESULTS, withPageContact, type Hunt } from '../hunts';
import { offerIsEmpty } from '../offer';
import { recordHuntRun } from '../store';
import { exaConfigured, exaFind } from '../watch/exa';
import { openPage } from './page';
import type { SupplyAdapter, SupplyCandidate } from './types';

/** Below this there is no point starting a search that cannot finish. */
const MIN_HUNT_MS = 6_000;
/** Sites read at once. Enough to finish a hunt's ten inside the budget; few enough to be polite. */
const PAGE_CONCURRENCY = 5;
const OUT_OF_TIME = 'Out of time on this run — it goes first next time';
/** Never run, or cut off by the clock, sorts first; then whichever ran longest ago. */
const waited = (h: Hunt) => (!h.last_run_at || h.last_error === OUT_OF_TIME ? '' : h.last_run_at);

export const webAdapter: SupplyAdapter = {
  key: 'web',
  label: 'Web search',
  billable: true,
  // The plan needs an offer to be read from; that is the whole of the setup.
  available: (profile) => exaConfigured() && !offerIsEmpty(profile.offer),
  async discover(profile, { limit, deadline }) {
    // Throws when the plan cannot be read, made or saved; runSupply keeps it on
    // this adapter's entry and the Scout on You reads it back (loadHunting).
    // Never an empty list over a failure.
    // Longest-waiting first, so a search the clock cut off really does go first next run.
    const live = (await planHunts(profile, { deadline })).filter((h) => exaCategoryFor(h.kind))
      .sort((a, b) => waited(a).localeCompare(waited(b)));
    if (!live.length) return [];
    // The allowance is shared across hunts rather than spent by the first one:
    // each gets at least a few, and none asks the index for more than a page.
    const per = Math.max(3, Math.min(HUNT_RESULTS, Math.floor(limit / live.length)));
    const out: SupplyCandidate[] = [];
    for (const h of live) {
      if (out.length >= limit) break;
      if (deadline && deadline - Date.now() < MIN_HUNT_MS) {
        await recordHuntRun(profile.id, h.id, { found: 0, error: OUT_OF_TIME });
        continue;
      }
      try {
        const hits = await exaFind(exaQueryFor(h), exaCategoryFor(h.kind)!, { numResults: per, budgetMs: deadline ? Math.min(15_000, deadline - Date.now() - 2_000) : 15_000 });
        let found = candidatesFromHits(hits, h).slice(0, Math.min(per, limit - out.length));
        if (h.kind === 'companies') found = await withContacts(found, deadline);
        out.push(...found);
        await recordHuntRun(profile.id, h.id, { found: found.length, error: null });
      } catch (e) {
        await recordHuntRun(profile.id, h.id, { found: 0, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return out;
  },
};

/**
 * Each company's site, read for a contact: the homepage, and its contact page
 * when the homepage shows no address. A site that will not open keeps the
 * candidate as it was — the search index already vouched for the page; only the
 * way to reach it is missing, and the card says "Link only".
 */
async function withContacts(cands: SupplyCandidate[], deadline?: number): Promise<SupplyCandidate[]> {
  const out = [...cands];
  let next = 0;
  const worker = async () => {
    while (next < out.length) {
      const i = next++;
      const c = out[i];
      if (!c.url || (deadline && deadline - Date.now() < 2_000)) continue;
      const home = await openPage(c.url, { deadline });
      if (!home.ok) continue;
      let found = contactFromHtml(home.html);
      if (!found.email && !found.whatsapp) {
        const contact = contactPageLink(home.html, home.url);
        if (contact) {
          const page = await openPage(contact, { deadline });
          if (page.ok) found = { ...found, ...contactFromHtml(page.html) };
        }
      }
      out[i] = withPageContact(c, found);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PAGE_CONCURRENCY, out.length) }, worker));
  return out;
}
