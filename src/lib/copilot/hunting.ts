// src/lib/copilot/hunting.ts
// The app deciding what to search the web for, from what it already knows.
//
// Called at the start of every web run (supply/web.ts), so there is no step
// anybody has to take: the first run with an offer plans its searches, and
// every run after keeps them honest — a search that keeps bringing in what
// nobody drafts, or brings in nothing, is retired and replaced (spentHunts).
// The plan is read from the offer, the working file, the goals and where the
// user is; the model is asked when there is one and the time to ask it, and
// otherwise the buyers the user named become the searches, as they wrote them.
//
// Nothing is planned from a blank offer (invariant 1). A failure to plan or to
// save a plan throws, and the supply run records it against the web adapter —
// the Scout on You reads it — because the alternative is the web quietly never
// being searched while the screen looks like a quiet week (invariant 13).

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { extractJson } from './agent/schema';
import { extraBody, maxOutputTokens, resolveLlmConfig } from './agent/llm';
import { copilotDb } from './db';
import {
  AUTO_HUNTS, PLAN_SYSTEM, exaCategoryFor, huntsNeeded, noPlanReason, parsePlan, planFromOffer, planPrompt, spentHunts,
  type Hunt, type HuntPlanItem,
} from './hunts';
import { offerIsEmpty } from './offer';
import { insertPlannedHunts, loadHuntYield, loadHunts, loadWorking, logEvent, retireHunts } from './store';
import type { Profile } from './types';
import { workingBrief } from './working';

/** Less time than this left in the run and the plan is read off the offer instead of asked of the model. */
const MODEL_MIN_MS = 20_000;
const MODEL_TIMEOUT_MS = 15_000;

/** The searches to run now: retire what is spent, plan what is missing, return what is live. */
export async function planHunts(profile: Profile, opts: { deadline?: number } = {}): Promise<Hunt[]> {
  const { hunts, unreadable } = await loadHunts(profile.id);
  if (unreadable) throw new Error(unreadable);
  const now = new Date();

  let live = hunts.filter((h) => h.status === 'active' && exaCategoryFor(h.kind));
  if (live.length) {
    const spent = spentHunts(live, await loadHuntYield(profile.id, live.map((h) => h.id)), now);
    if (spent.length) {
      await retireHunts(profile.id, spent);
      const gone = new Set(spent.map((s) => s.id));
      live = live.filter((h) => !gone.has(h.id));
    }
  }

  const need = huntsNeeded(live, AUTO_HUNTS);
  if (!need || offerIsEmpty(profile.offer)) return live;

  // Everything ever searched, retired included, so the same words are not planned twice.
  const existing = [...hunts.map((h) => h.query), ...profile.target_segments];
  const { items, from, why } = await planFor(profile, existing, need, opts.deadline);
  if (!items.length) {
    // Nothing to run and nothing to add: returning [] would be an empty run,
    // and an empty run looks exactly like a night with nobody in it.
    if (!live.length) throw new Error(noPlanReason(profile.offer, why));
    return live;
  }
  const added = await insertPlannedHunts(profile.id, items);
  await logEvent(profile.id, 'hunts_planned', { from, ...(why ? { why: why.slice(0, 200) } : {}), planned: added.map((h) => ({ kind: h.kind, query: h.query })) });
  return [...live, ...added];
}

async function planFor(profile: Profile, existing: string[], need: number, deadline?: number): Promise<{ items: HuntPlanItem[]; from: 'model' | 'offer'; why?: string }> {
  const area = profile.target_area || profile.location || null;
  const fromOffer = () => ({ items: planFromOffer(profile.offer, area, existing, need), from: 'offer' as const });
  const cfg = resolveLlmConfig();
  if (!cfg) return fromOffer();
  if (deadline && deadline - Date.now() < MODEL_MIN_MS) return { ...fromOffer(), why: 'no time left on this run to ask the model' };
  try {
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
    const working = workingBrief(await loadWorking(profile.id).catch(() => []));
    const { data: goalRows } = await copilotDb().from('copilot_goals').select('title').eq('profile_id', profile.id).eq('status', 'active').order('priority').limit(3);
    const { text } = await generateText({
      model: provider(cfg.model),
      system: PLAN_SYSTEM,
      prompt: planPrompt({ offer: profile.offer, area, working, goals: ((goalRows ?? []) as Array<{ title: string }>).map((g) => g.title), existing }),
      temperature: 0.4,
      maxRetries: 0,
      maxOutputTokens: maxOutputTokens() ?? 700,
      abortSignal: AbortSignal.timeout(deadline ? Math.min(MODEL_TIMEOUT_MS, deadline - Date.now() - 5_000) : MODEL_TIMEOUT_MS),
    });
    const items = parsePlan(extractJson(text), existing, need);
    return items.length ? { items, from: 'model' } : fromOffer();
  } catch (e) {
    // Not a failure of the search: the offer's own words are a plan. Why the
    // model was not used goes on the planning event, and on the Scout when the
    // offer cannot stand in for it (noPlanReason).
    const why = e instanceof Error ? e.message : String(e);
    console.error('[copilot/hunts] planning with the model failed, using the offer:', why);
    return { ...fromOffer(), why };
  }
}
