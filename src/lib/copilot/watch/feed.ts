// src/lib/copilot/watch/feed.ts
// RSS, Atom and JSON Feed, read into the same three fields the judge needs.
//
// Pure — no DB import, no fetch — so copilot-core.test.ts covers the parsing
// that decides what the model is even shown.
//
// Why by hand rather than a library. This repo has no XML parser and adding one
// for three tag shapes is a dependency that has to be kept alive for years; the
// subset of XML that feeds actually use is small and stable, and the failure
// mode here is benign — a feed that does not parse yields zero items, the source
// records the error and says so on its card. A wrong parse cannot corrupt
// anything downstream because everything it produces still has to survive
// isDeliverable.

/** One entry from a feed, whatever dialect it arrived in. */
export interface FeedItem {
  /** Stable within this source: guid, Atom id, or the link. Drives dedupe. */
  id: string;
  title: string;
  url: string | null;
  /** Body with tags stripped and entities decoded. Often the whole value. */
  text: string;
  /** ISO. Null for the many feeds that publish no dates — hence seen_ids. */
  publishedAt: string | null;
  author: string | null;
}

/** Feeds run long; the judge is shown a summary, not a page. */
export const TEXT_MAX = 700;
export const TITLE_MAX = 200;
/** How many item ids a source remembers. ~6 weeks of a busy subreddit. */
export const SEEN_WINDOW = 300;
/** Most a single source may put in front of the judge in one night. */
export const MAX_ITEMS_PER_SOURCE = 25;

/**
 * The named entities feeds actually contain. Numeric references are decoded
 * arithmetically below, so this only has to cover the names — and an unknown
 * name is left exactly as written rather than mangled, because "&foo;" in a job
 * post is more likely to be somebody's typo than an entity worth guessing at.
 */
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', middot: '\u00b7', bull: '\u2022',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
  pound: '\u00a3', euro: '\u20ac', cent: '\u00a2', deg: '\u00b0', times: '\u00d7',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    const hit = ENTITIES[name] ?? ENTITIES[name.toLowerCase()];
    if (hit) return hit;
    const m = /^#(x?)([0-9a-f]+)$/i.exec(name);
    if (!m) return whole;
    const code = parseInt(m[2], m[1] ? 16 : 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
  });
}

const strip = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n')
  .replace(/<[^>]*>/g, ' ');

/**
 * Feed bodies are usually HTML. The judge reads prose, not markup.
 *
 * Strip, decode, strip again — in that order, and the order is the point. RSS
 * puts real markup in a CDATA block and escapes the ampersands inside it, so
 * decoding first would turn "&amp;amp;" into an entity the strip pass then eats.
 * Atom does the opposite: type="html" arrives fully escaped, so a single
 * strip-then-decode leaves the reader looking at a literal "<p>". Each body needs
 * exactly one decode; the second strip clears whatever that decode revealed.
 */
export function stripTags(s: string): string {
  return strip(decodeEntities(strip(s)))
    .replace(/[ \t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** Every <tag>…</tag> at any depth, contents only. Namespaces (dc:, content:) match. */
function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[a-z0-9]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9]+:)?${tag}\\s*>`, 'gi');
  const out: string[] = [];
  for (let m = re.exec(xml); m; m = re.exec(xml)) out.push(m[1]);
  return out;
}

/** First of the named tags that has content. Order is preference order. */
function pick(block: string, ...tags: string[]): string | null {
  for (const t of tags) {
    const hit = blocks(block, t)[0];
    if (hit?.trim()) return hit;
  }
  return null;
}

/** An attribute off the first matching tag, including self-closing ones. */
function attrOf(block: string, tag: string, name: string, where?: (attrs: string) => boolean): string | null {
  const re = new RegExp(`<(?:[a-z0-9]+:)?${tag}\\s([^>]*)>`, 'gi');
  for (let m = re.exec(block); m; m = re.exec(block)) {
    const attrs = m[1];
    if (where && !where(attrs)) continue;
    const v = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(attrs);
    if (v?.[1]?.trim()) return decodeEntities(v[1].trim());
  }
  return null;
}

/** RFC 822 (RSS) and ISO 8601 (Atom) both land here; Date.parse reads both. */
export function toIso(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const t = Date.parse(raw.trim());
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function item(raw: {
  id?: string | null; title?: string | null; url?: string | null; text?: string | null;
  date?: string | null; author?: string | null;
}): FeedItem | null {
  const title = raw.title ? stripTags(raw.title).slice(0, TITLE_MAX) : '';
  const url = raw.url?.trim() || null;
  // An item with no id and no link cannot be deduped, and an item that cannot be
  // deduped comes back every night forever. Dropping it is cheaper than that.
  const id = (raw.id?.trim() || url || '').slice(0, 300);
  if (!id || !title) return null;
  return {
    id,
    title,
    url,
    text: raw.text ? stripTags(raw.text).slice(0, TEXT_MAX) : '',
    publishedAt: toIso(raw.date),
    author: raw.author ? stripTags(raw.author).slice(0, 80) || null : null,
  };
}

function parseJsonFeed(body: string): FeedItem[] | null {
  let json: unknown;
  try { json = JSON.parse(body); } catch { return null; }
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
  const items = root && Array.isArray(root.items) ? root.items : null;
  if (!items) return null;
  return items.map((raw) => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : null);
    const author = r.author && typeof r.author === 'object' ? str((r.author as Record<string, unknown>).name) : str(r.author);
    return item({
      id: str(r.id), title: str(r.title), url: str(r.url) ?? str(r.external_url),
      text: str(r.content_text) ?? str(r.content_html) ?? str(r.summary),
      date: str(r.date_published) ?? str(r.date_modified), author,
    });
  }).filter((i): i is FeedItem => !!i);
}

/**
 * Whatever came back from the URL, as items.
 *
 * Tries JSON Feed first (cheap and unambiguous), then RSS `<item>`, then Atom
 * `<entry>`. Returns an empty array rather than throwing: a source that yields
 * nothing is a state the caller already has to handle, and a throw here would
 * take the whole nightly run's source loop with it.
 */
export function parseFeed(body: string): FeedItem[] {
  if (!body?.trim()) return [];
  const asJson = parseJsonFeed(body);
  if (asJson) return asJson;

  const rss = blocks(body, 'item');
  if (rss.length) {
    return rss.map((b) => item({
      id: pick(b, 'guid', 'id'), title: pick(b, 'title'),
      url: pick(b, 'link')?.trim() || attrOf(b, 'link', 'href'),
      text: pick(b, 'encoded', 'description', 'summary'),
      date: pick(b, 'pubDate', 'date', 'published', 'updated'),
      author: pick(b, 'creator', 'author'),
    })).filter((i): i is FeedItem => !!i);
  }

  return blocks(body, 'entry').map((b) => item({
    id: pick(b, 'id'), title: pick(b, 'title'),
    // Atom links are attributes, and an entry carries several: alternate is the
    // human page, the others are the feed itself, a comment stream, an enclosure.
    url: attrOf(b, 'link', 'href', (a) => /rel\s*=\s*["']alternate["']/i.test(a))
      ?? attrOf(b, 'link', 'href', (a) => !/\brel\s*=/i.test(a))
      ?? attrOf(b, 'link', 'href'),
    text: pick(b, 'content', 'summary'),
    date: pick(b, 'published', 'updated'),
    author: pick(b, 'name', 'author'),
  })).filter((i): i is FeedItem => !!i);
}

/**
 * What this source has not shown us before, newest first.
 *
 * Dates are used for ORDER, never for the cut. Half the feeds worth watching
 * publish no dates at all, and a cut on `last_checked_at` silently shows nothing
 * for those forever — which looks exactly like a working watcher with a quiet
 * week. `seen` is the cut, and it is exact.
 *
 * `maxAgeDays` is the one date rule, and it only applies to items that HAVE a
 * date: on the night a source is first added its whole backlog is unseen, and
 * judging a two-year-old job posting is a model call spent on nothing.
 */
export function unseenItems(
  items: FeedItem[],
  seen: string[],
  opts: { now: Date; maxAgeDays?: number; max?: number } ,
): FeedItem[] {
  const known = new Set(seen);
  const cutoff = opts.maxAgeDays ? opts.now.getTime() - opts.maxAgeDays * 86_400_000 : null;
  return items
    .filter((i) => !known.has(i.id))
    .filter((i) => {
      if (cutoff == null || !i.publishedAt) return true;
      const t = Date.parse(i.publishedAt);
      return !Number.isFinite(t) || t >= cutoff;
    })
    .sort((a, b) => {
      // Undated items sort last but are not dropped — see above.
      const at = a.publishedAt ? Date.parse(a.publishedAt) : -Infinity;
      const bt = b.publishedAt ? Date.parse(b.publishedAt) : -Infinity;
      return bt - at || a.id.localeCompare(b.id);
    })
    .slice(0, opts.max ?? MAX_ITEMS_PER_SOURCE);
}

/**
 * The source's memory after a check: everything it saw this time, appended to
 * what it knew, trimmed to the window. Trimmed from the FRONT, so the ids that
 * fall off are the oldest — the ones whose items are furthest down a feed that
 * only ever grows at the top, and therefore least likely to come back.
 */
export function trimSeen(previous: string[], added: string[], max = SEEN_WINDOW): string[] {
  const merged = [...previous.filter((id) => !added.includes(id)), ...added];
  return merged.slice(Math.max(0, merged.length - max));
}
