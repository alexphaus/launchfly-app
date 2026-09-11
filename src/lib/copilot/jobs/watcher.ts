// src/lib/copilot/jobs/watcher.ts
// Reads the feeds this person chose, and turns what is new into Moves.
//
// This is the answer to "today's call is send 45 drafts already written". The
// queue could only ever lose to something that arrived from outside, and until
// now nothing could: supply had three compiled-in adapters, every one of them
// pointed at local businesses to message, and everything they found had to be
// typed as an OpportunityType — all five of which are somebody to contact. A
// user whose top goal is getting a job had nothing to look at. A freelancer who
// lives in two subcontract channels had nothing to look at.
//
// So the source list moved into the database and the output moved up a level.
// A feed item becomes a Move, with the eight kinds and an artifact, which is why
// a YouTube tutorial can be a `learn` and a gig post an `earn` without either
// pretending to be a business with a phone number.
//
// The cost model is one model call per source per night — not per item. Six
// feeds is six calls; judging item by item would be hundreds. See watch/judge.ts.

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { extractJson } from '../agent/schema';
import { cronTimeoutMs, extraBody, maxOutputTokens, resolveLlmConfig } from '../agent/llm';
import { MAX_ITEMS_PER_SOURCE, parseFeed, trimSeen, unseenItems } from '../watch/feed';
import { moveKeepRate } from '../moves';
import { JUDGE_SYSTEM, judgePrompt, movesFromVerdicts, parseVerdicts, watchBrief } from '../watch/judge';
import { CAPACITY_META, type WatchSource } from '../types';
import { loadMoveAnswers, loadWatchSources, markWatchSourceChecked } from '../store';
import type { MoveDraft } from '../moves';
import type { Job, JobContext } from './types';

/** Bounded per run: each source costs a fetch and a generation. */
export const MAX_SOURCES_PER_RUN = 6;
/** A feed that has not answered in this long is not going to tonight. */
export const FETCH_TIMEOUT_MS = 20_000;
/** Feeds are text; anything past this is a page that is not a feed. */
export const MAX_FEED_BYTES = 2_000_000;
/**
 * On a source's first night its whole backlog is unseen. Judging a two-year-old
 * job posting is a model call spent on something that is gone.
 */
export const MAX_ITEM_AGE_DAYS = 21;

/** Which sources are due, oldest check first so nothing starves behind a busy feed. */
export function dueSources(sources: WatchSource[], now: Date, max = MAX_SOURCES_PER_RUN): WatchSource[] {
  return sources
    .filter((s) => s.status === 'active' && s.kind === 'feed')
    .filter((s) => {
      if (!s.last_checked_at) return true;
      const since = now.getTime() - Date.parse(s.last_checked_at);
      // A little slack, or a 24h source checked at 21:00:05 waits until tomorrow
      // and then drifts later every night until it skips a day entirely.
      return !Number.isFinite(since) || since >= (s.every_hours * 3600_000) - 300_000;
    })
    .sort((a, b) => (a.last_checked_at ?? '').localeCompare(b.last_checked_at ?? ''))
    .slice(0, max);
}

async function fetchFeed(url: string, budgetMs: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.min(FETCH_TIMEOUT_MS, budgetMs));
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      // Reddit and several job boards return 429 to the default fetch agent and
      // a feed to anything that names itself. This is the whole fix.
      headers: { 'user-agent': 'copilot-watch/1.0 (+feed reader)', accept: 'application/rss+xml, application/atom+xml, application/json, text/xml, */*' },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
    const body = await res.text();
    if (body.length > MAX_FEED_BYTES) throw new Error('that URL returned a page, not a feed');
    return body;
  } finally {
    clearTimeout(t);
  }
}

/** One judge call. Separated so the test can drive the parsing without a model. */
async function judge(system: string, prompt: string, budgetMs: number): Promise<unknown> {
  const cfg = resolveLlmConfig();
  if (!cfg) throw new Error('no model configured');
  const extra = extraBody();
  const provider = createOpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    fetch: extra
      ? (input, init) => {
          if (typeof init?.body !== 'string') return fetch(input, init);
          try { return fetch(input, { ...init, body: JSON.stringify({ ...JSON.parse(init.body), ...extra }) }); }
          catch { return fetch(input, init); }
        }
      : undefined,
  });
  const { text } = await generateText({
    model: provider(cfg.model),
    system,
    prompt,
    // Lower than the brief's 0.4. This call is a filter, and a filter that
    // answers differently on the same feed two nights running is not one.
    temperature: 0.2,
    maxRetries: 0,
    maxOutputTokens: maxOutputTokens(),
    abortSignal: AbortSignal.timeout(budgetMs),
  });
  return extractJson(text);
}

export const watcherJob: Job = {
  key: 'watch',
  label: 'What your sources turned up',

  /**
   * Cheap, as the contract requires: profile and environment only. Whether any
   * source is actually on file is a result, read in run() — an account with the
   * watcher available and no sources is not a broken sensor, it is somebody who
   * has not opened the Sources sheet yet, and the sheet is how they fix it.
   */
  available(ctx: JobContext) {
    return !!ctx.profile.onboarding_complete && !!resolveLlmConfig();
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const sources = dueSources(await loadWatchSources(ctx.profile.id), ctx.now);
    if (!sources.length) return [];

    const { goals, metrics } = await ctx.sense();
    // One read for the whole run, and the only thing in this brief that is about
    // the app's own history rather than the user's rows. Without it this judge
    // picked three items out of twenty-five every night and never learned
    // whether any of them were wanted.
    const keeps = moveKeepRate(await loadMoveAnswers(ctx.profile.id));
    const brief = watchBrief({
      profile: ctx.profile,
      goals,
      metrics,
      capacityMinutes: CAPACITY_META[ctx.profile.capacity].minutes,
      keeps,
    });

    const out: MoveDraft[] = [];
    for (const source of sources) {
      // Sequential and deadline-checked. Six feeds in parallel is six fetches
      // and six generations at once against a budget the whole nightly run
      // shares with every other profile.
      const left = ctx.deadline ? ctx.deadline - Date.now() : cronTimeoutMs();
      if (left < 5_000) break;

      try {
        const items = unseenItems(parseFeed(await fetchFeed(source.url, left)), source.seen_ids ?? [], {
          now: ctx.now, maxAgeDays: MAX_ITEM_AGE_DAYS, max: MAX_ITEMS_PER_SOURCE,
        });
        if (!items.length) {
          // Nothing new is the common case and a success. Recording the check
          // is what stops a quiet feed being refetched every single run.
          await markWatchSourceChecked(ctx.profile.id, source.id, { error: null });
          continue;
        }

        const ref = { id: source.id, label: source.label, url: source.url, intent: source.intent };
        const raw = await judge(JUDGE_SYSTEM, judgePrompt(brief, ref, items), Math.min(cronTimeoutMs(), Math.max(0, (ctx.deadline ?? Infinity) - Date.now())));
        out.push(...movesFromVerdicts(parseVerdicts(raw, items), items, ref, ctx.now));

        // Everything shown is marked seen, picked or not. A judged-and-rejected
        // item must never be paid for twice, which is most of what this saves.
        await markWatchSourceChecked(ctx.profile.id, source.id, {
          seen_ids: trimSeen(source.seen_ids ?? [], items.map((i) => i.id)),
          error: null,
        });
      } catch (e) {
        // One bad feed is one card saying so, never the run. The message is the
        // user's, so it is written for them: "404" on its own explains nothing.
        const message = e instanceof Error ? e.message : String(e);
        await markWatchSourceChecked(ctx.profile.id, source.id, { error: message.slice(0, 200) });
        console.error(`[copilot/watch] ${source.url} failed:`, message);
      }
    }
    return out;
  },
};
