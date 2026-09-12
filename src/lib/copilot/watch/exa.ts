// src/lib/copilot/watch/exa.ts
// Exa, used to find PLACES rather than answers.
//
// The distinction is the whole reason this file is allowed to exist next to a
// codebase whose second invariant is that the user's numbers are never invented.
// A model asked "what contract work is out there tonight" produces prose, and
// prose cannot be deduped, dated or checked — INFERRED_SCORE_CAP exists because
// exactly that once outranked real listings. A search asked "where do people
// post this kind of work" produces URLs, and a URL is a fact: it either serves a
// feed that parses or it does not, and discover.ts finds out before the user is
// ever shown it.
//
// So nothing Exa returns reaches a Move. It reaches a candidate, the candidate
// is fetched, and only what parsed is offered. The model proposes; the parser
// disposes — the same shape as valueFromItem dropping any figure whose digits
// are not in the item.
//
// Proven against the same endpoint the Launchfly agent has used in production
// (src/lib/agent/tools.ts), minus the Jina fallback: Jina answers with a text
// blob, and a text blob has no URLs to verify. Returning nothing and saying so
// beats scraping a paragraph for something that looks like a link.

/** What we use of an Exa hit. Everything else in the response is ignored. */
export interface ExaHit {
  title: string;
  url: string;
  publishedDate?: string;
  /** One line for the card, so the user can tell what they are adding. */
  summary?: string;
}

export const EXA_ENDPOINT = 'https://api.exa.ai/search';
/** Per query. Most convert to nothing; the funnel needs width at the top. */
export const EXA_RESULTS_PER_QUERY = 8;
export const EXA_TIMEOUT_MS = 12_000;

export function exaConfigured(): boolean {
  return !!process.env.EXA_API_KEY?.trim();
}

/**
 * The response, as the little of it we trust.
 *
 * Pure so the test can hand it a real Exa body without a network. Anything
 * without an http(s) url is dropped here rather than three functions later —
 * every candidate downstream is already a fetchable address.
 */
export function exaHits(json: unknown): ExaHit[] {
  const results = (json as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  const out: ExaHit[] = [];
  for (const r of results) {
    const row = r as Record<string, unknown>;
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    if (!/^https?:\/\//i.test(url)) continue;
    const title = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : url;
    const summary = typeof row.summary === 'string' && row.summary.trim() ? row.summary.trim() : undefined;
    const publishedDate = typeof row.publishedDate === 'string' ? row.publishedDate : undefined;
    out.push({ title: title.slice(0, 200), url, publishedDate, ...(summary ? { summary: summary.slice(0, 300) } : {}) });
  }
  return out;
}

/**
 * One search. Throws on a bad key or a bad status so the route can say which —
 * a discovery that quietly returns nothing is indistinguishable from a world
 * with nothing in it, and those need different messages.
 */
export async function exaSearch(query: string, budgetMs = EXA_TIMEOUT_MS): Promise<ExaHit[]> {
  const key = process.env.EXA_API_KEY?.trim();
  if (!key) throw new Error('EXA_API_KEY is not set.');

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(1_000, budgetMs));
  try {
    const res = await fetch(EXA_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({
        query,
        type: 'auto',
        numResults: EXA_RESULTS_PER_QUERY,
        // A one-line summary is the only content we take, and only so the card
        // can say what the place is. No highlights, no text: we are not reading
        // these pages for their contents, we are asking whether they publish.
        contents: { summary: true },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Exa ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    return exaHits(await res.json());
  } finally {
    clearTimeout(t);
  }
}
