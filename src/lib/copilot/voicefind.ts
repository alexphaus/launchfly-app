// src/lib/copilot/voicefind.ts
// One search for a bet's people (voices.ts says why, and what a post has to be
// to count): the searches written — by the model when there is one, otherwise
// from the offer's own words — then run against the forums and social sites, and
// what came back held to the rules before anything is kept.
//
// Server-only: it asks a model and the search index. The route stores the
// result and meters it; nothing here writes a row.

import { generateText } from 'ai';
import { extractJson } from './agent/schema';
import { maxOutputTokens, providerFor, resolveLlmConfig } from './agent/llm';
import { shiftDay } from './focus';
import type { Bet } from './lab';
import type { Offer } from './types';
import {
  VOICE_DAYS, VOICE_DOMAINS, VOICE_RESULTS, VOICE_SYSTEM, VOICES_PER_SEARCH,
  parseVoiceQueries, voicePrompt, voiceQueries, voicesFromHits, type Voice, type VoiceHit,
} from './voices';
import { exaPosts } from './watch/exa';

/** The model writes the searches inside this, or the offer's words do. A search is seconds; waiting longer for its words is not worth it. */
const QUERY_TIMEOUT_MS = 12_000;
const SEARCH_TIMEOUT_MS = 15_000;

export interface VoiceFind {
  voices: Voice[];
  queries: string[];
  from: 'model' | 'offer';
  /** Why the model's searches were not used, or why one search of two failed: kept on the row, said on the card. */
  why: string | null;
}

async function queriesFor(offer: Offer, bet: Pick<Bet, 'belief'>): Promise<{ queries: string[]; from: 'model' | 'offer'; why: string | null }> {
  const fromOffer = (why: string | null) => ({ queries: voiceQueries(offer, bet.belief), from: 'offer' as const, why });
  const cfg = resolveLlmConfig();
  if (!cfg) return fromOffer(null);
  try {
    const { text } = await generateText({
      model: providerFor(cfg)(cfg.model),
      system: VOICE_SYSTEM,
      prompt: voicePrompt({ offer, belief: bet.belief }),
      temperature: 0.4,
      maxRetries: 0,
      maxOutputTokens: maxOutputTokens() ?? 600,
      abortSignal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });
    const queries = parseVoiceQueries(extractJson(text));
    return queries ? { queries, from: 'model', why: null } : fromOffer('the model wrote no search that held up');
  } catch (e) {
    // Not a failure of the search: the offer's own words are searches too.
    return fromOffer(`the model did not write the searches: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`);
  }
}

/**
 * Two phrasings, searched at once, their results taken in turn so both find
 * somebody. Throws when every search failed — a search that never ran must not be
 * stored as one that found nobody (invariant 13) — and keeps one failure of two
 * as the reason beside what the other found.
 */
export async function findVoices(i: { offer: Offer; bet: Pick<Bet, 'belief'>; seen: ReadonlySet<string>; today: string; max?: number }): Promise<VoiceFind> {
  const { queries, from, why: queryWhy } = await queriesFor(i.offer, i.bet);
  if (!queries.length) throw new Error('There is nothing to search for: say who buys and the problem in your offer.');
  const since = `${shiftDay(i.today, -VOICE_DAYS)}T00:00:00.000Z`;
  const runs = await Promise.allSettled(queries.map((q) => exaPosts(q, {
    domains: VOICE_DOMAINS, since, numResults: VOICE_RESULTS, budgetMs: SEARCH_TIMEOUT_MS,
    // The sentence picked from each page is the one closest to the problem, in
    // the person's words where they gave them.
    highlight: i.offer.problem?.trim() || i.bet.belief,
  })));
  const done = runs.filter((r): r is PromiseFulfilledResult<VoiceHit[]> => r.status === 'fulfilled').map((r) => r.value);
  const failed = runs.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  const failWhy = failed ? (failed.reason instanceof Error ? failed.reason.message : String(failed.reason)).slice(0, 200) : null;
  if (!done.length) throw new Error(`The search did not run: ${failWhy ?? 'no answer'}`);
  const turns: VoiceHit[] = [];
  for (let n = 0; n < VOICE_RESULTS; n++) for (const hits of done) if (hits[n]) turns.push(hits[n]);
  const voices = voicesFromHits(turns, i.seen, Math.max(0, Math.min(VOICES_PER_SEARCH, i.max ?? VOICES_PER_SEARCH)));
  const why = [failWhy ? `one of the two searches failed: ${failWhy}` : null, queryWhy].filter(Boolean).join('; ') || null;
  return { voices, queries, from, why };
}
