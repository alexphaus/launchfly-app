// src/lib/copilot/watch/catalogue.ts
// Turning what somebody types into a feed, and knowing where to start.
//
// Pure — no DB import — so copilot-core.test.ts covers it.
//
// Two jobs, and they are the same job. Nobody types a feed URL. They type
// "r/forhire", or paste the subreddit they already read, or a YouTube channel,
// or a Google Alerts link, and if the app answers "that is not an RSS feed" it
// has handed the user the work it exists to do. So normalizeSourceUrl knows the
// handful of shapes that cover most of what a person watches, and the catalogue
// gives a first four to anyone who has not thought about it yet.
//
// It is small on purpose. These are the sites that publish feeds without an API
// key, which is the whole reason this approach beats building adapters: no
// credential, no rate limit to manage, no scraper to keep alive against a site
// that redesigns. Everything else is accepted as typed — if it turns out not to
// be a feed, the source says so on its own card rather than failing silently.

/** Distinct from types.ts SourceKind, which is about evidence, not fetching. */
export type WatchSourceKind = 'feed' | 'page' | 'push';

export interface SourceSuggestion {
  label: string;
  url: string;
  kind: WatchSourceKind;
  /** Why this one is worth watching. Goes into the judge's prompt. */
  intent: string;
}

/** What the user is trying to get out of watching anything at all. */
export type WatchIntent = 'work' | 'clients' | 'sell' | 'build';

export interface WatchIntentDef {
  key: WatchIntent;
  label: string;
  /** Second person, concrete: this is what the user picks between. */
  blurb: string;
  starters: SourceSuggestion[];
}

const reddit = (sub: string, intent: string, label?: string): SourceSuggestion => ({
  label: label ?? `r/${sub}`,
  url: `https://www.reddit.com/r/${sub}/new/.rss`,
  kind: 'feed',
  intent,
});

/**
 * Four intents, because four is what somebody will read on a phone. The starters
 * are deliberately generic — a named subreddit is a better first source than a
 * perfect one nobody adds, and the moment a source produces one useless morning
 * the user deletes it, which is the feedback this design runs on.
 */
export const WATCH_INTENTS: WatchIntentDef[] = [
  {
    key: 'work',
    label: 'Find work',
    blurb: 'Contracts, gigs and roles, posted by people who are hiring today.',
    starters: [
      reddit('forhire', 'Contract and freelance work, posted daily'),
      reddit('jobbit', 'Small paid jobs, usually remote'),
      { label: 'We Work Remotely', url: 'https://weworkremotely.com/remote-jobs.rss', kind: 'feed', intent: 'Remote roles across every category' },
      { label: 'Hacker News: Who is hiring', url: 'https://hnrss.org/newest?q=%22who+is+hiring%22', kind: 'feed', intent: 'The monthly hiring thread and its replies' },
    ],
  },
  {
    key: 'clients',
    label: 'Find clients',
    blurb: 'People describing the problem you solve, before they go looking for a supplier.',
    starters: [
      reddit('smallbusiness', 'Owners describing problems out loud, in public'),
      reddit('Entrepreneur', 'Same, one step earlier'),
      // Both of these end in q= so startersFor drops the user's own words in.
      // A search feed seeded with what they actually sell is the highest-value
      // thing in this whole catalogue, and it costs them no typing.
      { label: 'Reddit search', url: 'https://www.reddit.com/search/.rss?sort=new&q=', kind: 'feed', intent: 'Anyone on Reddit naming the problem you solve, as they post it' },
      { label: 'Hacker News search', url: 'https://hnrss.org/newest?q=', kind: 'feed', intent: 'The same, where the technical buyers are' },
    ],
  },
  {
    key: 'sell',
    label: 'Sell a product',
    blurb: 'Where the people who would buy it are already talking about the problem.',
    starters: [
      { label: 'Hacker News front page', url: 'https://hnrss.org/frontpage', kind: 'feed', intent: 'What the market is paying attention to this week' },
      reddit('SaaS', 'Launches, pricing arguments, and what is not working'),
      reddit('indiebiz', 'Small launches and the reactions to them'),
      { label: 'Product Hunt', url: 'https://www.producthunt.com/feed', kind: 'feed', intent: 'Daily launches, including the ones competing with you' },
    ],
  },
  {
    key: 'build',
    label: 'Keep sharp',
    blurb: 'The one tutorial or teardown worth an hour, instead of the forty that are not.',
    // Every starter has to be a real feed that the watcher can actually read.
    // A card offering "paste a YouTube channel" as if it were a source was here
    // once and it failed its own normaliser — a starter nobody can add is worse
    // than no starter, and the test now catches it.
    starters: [
      { label: 'Hacker News: Show HN', url: 'https://hnrss.org/show', kind: 'feed', intent: 'Things people actually shipped, with the build details' },
      reddit('n8n', 'Automation patterns and the nodes that break'),
      { label: 'Hacker News, 150+ points', url: 'https://hnrss.org/newest?points=150', kind: 'feed', intent: 'Only what the whole industry stopped to read' },
      reddit('automation', 'Workflows people built, and where they broke'),
    ],
  },
];

export interface NormalizedSource {
  url: string;
  /** A short name for the card. The user can overwrite it. */
  label: string;
  kind: WatchSourceKind;
  /** Set when the input was rewritten, so the UI can say what it did. */
  note?: string;
}

const clean = (s: string) => s.trim().replace(/^<|>$/g, '');

/**
 * What somebody typed, as something fetchable.
 *
 * Returns null only when there is nothing to work with. Anything that looks like
 * a URL is accepted even when this file has never heard of the host — most of
 * the web publishes /feed or /rss and guessing wrong costs one error message on
 * one card, while refusing costs the user the source they actually wanted.
 */
export function normalizeSourceUrl(raw: string): NormalizedSource | null {
  const input = clean(raw);
  if (!input) return null;

  // "r/forhire", "/r/forhire", "reddit.com/r/forhire" — the most common thing
  // anyone will type here, and the one with the largest supply behind it.
  const sub = /(?:^|reddit\.com\/)\/?r\/([A-Za-z0-9_]{2,30})\/?/.exec(input);
  if (sub && !/\.rss(\?|$)/.test(input)) {
    return {
      url: `https://www.reddit.com/r/${sub[1]}/new/.rss`,
      label: `r/${sub[1]}`,
      kind: 'feed',
      note: 'Watching new posts in that subreddit.',
    };
  }

  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  const label = host.split('.').slice(0, -1).join('.') || host;

  // A YouTube channel page is not a feed, but every channel has one — and the
  // id is the only part of the URL the feed endpoint takes.
  if (/(^|\.)youtube\.com$/.test(host)) {
    const chan = /\/channel\/(UC[\w-]{20,})/.exec(u.pathname);
    if (chan) {
      return { url: `https://www.youtube.com/feeds/videos.xml?channel_id=${chan[1]}`, label: 'YouTube channel', kind: 'feed', note: 'Turned the channel into its video feed.' };
    }
    // A @handle URL does not contain the channel id and there is no way to
    // resolve one without fetching the page. Say so rather than saving a URL
    // that will fail every night at three in the morning.
    if (/\/@/.test(u.pathname)) return null;
  }

  // Reddit search and user pages take .rss the same way subreddits do.
  if (/(^|\.)reddit\.com$/.test(host) && !/\.rss$/.test(u.pathname)) {
    u.pathname = `${u.pathname.replace(/\/$/, '')}/.rss`;
    return { url: u.toString(), label: `reddit${u.pathname.replace('/.rss', '')}`, kind: 'feed', note: 'Added .rss — Reddit serves one for every page.' };
  }

  const looksLikeFeed = /\.(rss|xml|atom|json)$/i.test(u.pathname)
    || /\/(feed|rss|atom)\/?$/i.test(u.pathname)
    || /(^|\.)hnrss\.org$/.test(host)
    || u.searchParams.has('channel_id');

  return {
    url: u.toString(),
    label: label.charAt(0).toUpperCase() + label.slice(1),
    kind: looksLikeFeed ? 'feed' : 'page',
    // 'page' is not implemented and the sheet says so. Telling somebody their
    // URL is saved but not watched is honest; watching it badly is not.
    note: looksLikeFeed ? undefined : 'That does not look like a feed. Try adding /feed or /rss to the end.',
  };
}

/**
 * The starters for one intent, with the user's own words dropped in where a
 * search feed takes them. Not a recommendation engine — a list, so the first
 * screen is never empty and nobody has to know what RSS is to start.
 */
export function startersFor(intent: WatchIntent, seed?: { term?: string | null }): SourceSuggestion[] {
  const def = WATCH_INTENTS.find((i) => i.key === intent);
  if (!def) return [];
  const term = seed?.term?.trim();
  return def.starters.map((s) => (term && s.url.endsWith('q=')
    ? { ...s, url: `${s.url}${encodeURIComponent(`"${term}"`)}`, label: `${s.label}: ${term}` }
    : s));
}

/**
 * Which intent a goal sounds like.
 *
 * Onboarding used to ask everybody the same question — what do you sell, and
 * where are your local customers — and then scrape Google Maps. For somebody
 * whose goal is "get a job, urgent money" every one of those is the wrong
 * question, and the screen they landed on was empty because nothing they had
 * told it could produce anything.
 *
 * So the goal picks the shape of the rest of onboarding. Keyword matching, not a
 * model: this runs while the user is typing, it has to be instant, and being
 * wrong costs one tap on a chip that is right there. A model call here would be
 * slower, cost money, and still be overridable — so it would buy nothing.
 *
 * Ties and misses fall back on whether they have said they sell something, which
 * is the one other thing known at this point in the flow.
 */
const INTENT_WORDS: Record<WatchIntent, RegExp[]> = {
  work: [/\bjobs?\b/i, /\bhir(e|ing)\b/i, /\bemploy/i, /\bsalar/i, /\brole\b/i, /\bposition\b/i, /\bcontract/i, /\bgigs?\b/i, /\bfreelanc/i, /\bsubcontract/i, /\bwork\b/i, /\bpaid\b/i],
  clients: [/\bclients?\b/i, /\bcustomers?\b/i, /\bagency\b/i, /\bretainer/i, /\bleads?\b/i, /\bbookings?\b/i, /\blocal\b/i, /\bservices?\b/i],
  sell: [/\bproducts?\b/i, /\bapp\b/i, /\bsaas\b/i, /\blaunch/i, /\busers?\b/i, /\bsubscri/i, /\bmrr\b/i, /\bmonetize|monetise/i, /\bsell\b/i],
  build: [/\blearn/i, /\bskill/i, /\bstudy/i, /\bcourse\b/i, /\bbuild\b/i, /\bship\b/i, /\bimprove\b/i],
};

export function inferIntent(text: string, opts: { hasOffer?: boolean } = {}): WatchIntent {
  const t = (text || '').trim();
  let best: WatchIntent | null = null;
  let bestScore = 0;
  // Declaration order breaks ties, and it puts earning first on purpose: a goal
  // mentioning both a job and a product is more urgently about the money.
  for (const key of ['work', 'clients', 'sell', 'build'] as WatchIntent[]) {
    const score = INTENT_WORDS[key].filter((re) => re.test(t)).length;
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return best ?? (opts.hasOffer ? 'clients' : 'work');
}

/** The intents that imply having something to sell, and therefore an offer to write. */
export const SELLING_INTENTS: WatchIntent[] = ['clients', 'sell'];
