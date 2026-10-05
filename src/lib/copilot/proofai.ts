// src/lib/copilot/proofai.ts
// The two things a model writes on Proof: ideas for a bet, and drafts of an
// asset. Server only — the prompts and the rules a reply is held to are pure
// (ideas.ts, assets.ts); this file reads what they need, calls the model, and
// stores what passed.
//
// The pattern is the deck's (deckstore.ts writeDeckDraft), for the same
// reasons: one attempt, hard bounded under the proxy's ceiling, a daily cap, and
// every way it can fail said to the person in words — no model on the server, a
// cap reached, a timeout, a reply set aside and why (invariant 13). Nothing here
// drafts from a blank offer (invariant 1), and a reply that states a number the
// person never gave is refused (invariant 2).

import { randomUUID } from 'node:crypto';
import { generateText } from 'ai';
import { maxOutputTokens, providerFor, resolveLlmConfig } from './agent/llm';
import { extractJson } from './agent/schema';
import {
  ASSET_DRAFT_SYSTEM, ASSET_LABEL, ASSET_PART, ASSET_VERSION, DRAFT_ASK_MAX, OFFER_ASSET,
  assetDraftPrompt, checkAssetDraft, type AssetDraftContext, type AssetKind,
} from './assets';
import { LINK_STATE_LABEL, businessChain, type LinkKey } from './business';
import { IDEAS_SYSTEM, ideaSources, ideasPrompt, normalizeIdeas, talkTotals, type IdeasContext } from './ideas';
import { LAB_IDEAS, passLine, playOf, resultLine } from './lab';
import { rateLimit } from './limits';
import { matchFeed } from './matches';
import { salesCurrency } from './metrics';
import { offerIsEmpty } from './offer';
import { assetKindsOf, chainInputOf, foundOf } from './proof';
import { ensureOfferHistory, insertAssetEvent, insertLabEvent, loadHome, loadWorking } from './store';
import type { HomeData } from './types';
import { workingBrief } from './working';

/** A no the person can read: a 400 with the reason. */
export class ProofRefusal extends Error {}
/** The model failed or its reply was set aside: a 502 with the reason. */
export class ProofModelError extends Error {}

/**
 * Under the proxy's ceiling for a tap (agent/llm.ts: 30s and not measured
 * higher), with room for the reads around the call. A draft that needs longer
 * is a model that should be faster, and the person is told which.
 */
const IDEAS_TIMEOUT_MS = 25_000;
const DRAFT_TIMEOUT_MS = 25_000;
/** Sets of ideas a person can ask for in a day. Each is one call; past it, the books. */
export const IDEAS_PER_DAY = 30;
/** Asset drafts per person per day. */
export const ASSET_DRAFTS_PER_DAY = 40;

/** Why a call failed, in words: the budget and who set it, not "the operation was aborted". */
function failure(e: unknown, budget: number, model: string): string {
  const m = e instanceof Error ? e.message : String(e);
  if ((e instanceof Error && e.name === 'TimeoutError') || /abort|timeout/i.test(m)) return `${model} did not answer within ${budget / 1000}s — try again, or set a faster model`;
  return `the model did not answer (${m.slice(0, 140)})`;
}

/** Everything both calls read: the home, the chain as Proof shows it, and the working file as written. */
async function contextOf(pid: string): Promise<{ home: HomeData; chain: ReturnType<typeof businessChain>; working: string | null }> {
  const home = await loadHome(pid);
  if (!home) throw new ProofRefusal('Not found');
  if (offerIsEmpty(home.profile.offer)) throw new ProofRefusal('Say what you sell first — every idea and every draft is written from it.');
  const now = new Date(home.generatedAt);
  const worthAMessage = matchFeed({ now, pipeline: home.pipeline, triage: home.triage, moves: home.moves, targetSegments: home.profile.target_segments })
    .filter((i) => !i.below && i.from === 'business').length;
  const chain = businessChain(chainInputOf(home, {
    agents: [], worthAMessage,
    webReady: !!home.hunting?.webReady && !home.hunting?.unreadable,
    currency: salesCurrency(home.profile.finance, home.goals),
    topOpening: home.diagnosis.openings[0]?.term ?? null,
  }));
  const working = workingBrief(await loadWorking(pid)) || null;
  return { home, chain, working };
}

/**
 * Three ideas for one part of the business, written from its record, kept as a
 * set the tab shows until the next is asked for. Throws ProofRefusal for what
 * the person can fix or wait out, ProofModelError for what the model did.
 */
export async function writeIdeas(pid: string, part: LinkKey): Promise<{ count: number }> {
  const cfg = resolveLlmConfig();
  if (!cfg) throw new ProofRefusal('There is no model on this server, so ideas come from the books for now.');
  const { home, chain, working } = await contextOf(pid);
  const rl = await rateLimit(`copilot:ideas:${pid}`, IDEAS_PER_DAY, 86_400);
  if (!rl.ok) throw new ProofRefusal(`${IDEAS_PER_DAY} sets of ideas written today. The books are still there until tomorrow.`);
  const found = foundOf(home);
  const ctx: IdeasContext = {
    part, offer: home.profile.offer ?? {}, foundBy: found.value, working,
    links: chain.links,
    bets: (home.lab?.bets ?? []).map((v) => ({ state: v.state, result: v.result, belief: v.bet.belief, part: v.bet.part, line: resultLine(v) })),
    talks: talkTotals(home.lab?.talks ?? []),
    assets: assetKindsOf(home.assets?.assets ?? []),
  };
  let text: string;
  try {
    ({ text } = await generateText({
      model: providerFor(cfg)(cfg.model),
      system: IDEAS_SYSTEM,
      prompt: ideasPrompt(ctx),
      // Higher than a draft's: the point is ideas the catalogue would not have.
      temperature: 0.8,
      maxRetries: 0,
      maxOutputTokens: maxOutputTokens() ?? 1600,
      abortSignal: AbortSignal.timeout(IDEAS_TIMEOUT_MS),
    }));
  } catch (e) {
    throw new ProofModelError(`No new ideas: ${failure(e, IDEAS_TIMEOUT_MS, cfg.model)}.`);
  }
  let parsed: unknown;
  try { parsed = extractJson(text); } catch { throw new ProofModelError('No new ideas: the model did not answer in the shape asked for. Try again.'); }
  const ideas = normalizeIdeas(parsed, { part, foundBy: found.value, sources: ideaSources(ctx) });
  if (!ideas.length) throw new ProofModelError('No new ideas: none of the model\'s held to what a bet needs — a count this business can keep and a line in range. Try again.');
  await insertLabEvent(pid, LAB_IDEAS, { part, ideas, model: cfg.model });
  return { count: ideas.length };
}

export interface DraftAsk {
  /** The kind, for a new asset. */
  kind?: AssetKind;
  /** The asset to revise: the draft becomes its next version. */
  asset?: string;
  /** The bet it is for. */
  bet?: string;
  /** What the person asked for. */
  ask?: string;
}

/**
 * One asset drafted by a model: a new asset, or the next version of one. It is
 * stored as a version by AI — the person keeps it, rewrites it or puts it away,
 * and an offer the model wrote is not the offer until they make it theirs.
 */
export async function draftAsset(pid: string, input: DraftAsk): Promise<{ asset: string; version: string }> {
  const cfg = resolveLlmConfig();
  if (!cfg) throw new ProofRefusal('There is no model on this server. Write it yourself, or copy the brief for Claude.');
  const { home, chain, working } = await contextOf(pid);
  const assets = home.assets?.assets ?? [];
  const target = input.asset ? assets.find((a) => a.id === input.asset) ?? null : null;
  if (input.asset && !target) throw new ProofRefusal('That asset is gone.');
  const kind = target?.kind ?? input.kind;
  if (!kind) throw new ProofRefusal('What should it draft?');
  const bet = input.bet ? (home.lab?.bets ?? []).find((v) => v.bet.id === input.bet) ?? null : null;
  if (input.bet && !bet) throw new ProofRefusal('That bet is not in your record.');
  const rl = await rateLimit(`copilot:assetdraft:${pid}`, ASSET_DRAFTS_PER_DAY, 86_400);
  if (!rl.ok) throw new ProofRefusal(`${ASSET_DRAFTS_PER_DAY} drafts written today. Write this one yourself, or copy it for Claude.`);

  const part = chain.links.find((l) => l.key === ASSET_PART[kind]) ?? null;
  const ask = input.ask?.trim().slice(0, DRAFT_ASK_MAX) || null;
  const ctx: AssetDraftContext = {
    kind, offer: home.profile.offer ?? {}, foundBy: foundOf(home).value, working,
    bet: bet ? { belief: bet.bet.belief, line: passLine(bet.bet, bet.last), play: playOf(bet.bet)?.label ?? null } : null,
    part: part ? { label: part.label, state: LINK_STATE_LABEL[part.state], why: part.why } : null,
    previous: target ? { title: target.current.title, body: target.current.body } : null,
    ask,
  };
  let text: string;
  try {
    ({ text } = await generateText({
      model: providerFor(cfg)(cfg.model),
      system: ASSET_DRAFT_SYSTEM,
      prompt: assetDraftPrompt(ctx),
      temperature: 0.6,
      maxRetries: 0,
      maxOutputTokens: maxOutputTokens() ?? 2200,
      abortSignal: AbortSignal.timeout(DRAFT_TIMEOUT_MS),
    }));
  } catch (e) {
    throw new ProofModelError(`No draft: ${failure(e, DRAFT_TIMEOUT_MS, cfg.model)}.`);
  }
  let parsed: unknown;
  try { parsed = extractJson(text); } catch {
    // A model that wrote the asset without the JSON around it has still written
    // the asset — except an offer, whose fields are the point.
    if (kind === 'offer') throw new ProofModelError('No draft: the model did not answer in the shape asked for. Try again.');
    parsed = { title: ASSET_LABEL[kind], body: text };
  }
  const checked = checkAssetDraft(parsed, ctx);
  if (!checked.ok) throw new ProofModelError(`The draft was set aside because ${checked.why}. Try again, or write it yourself.`);

  // The offer's own history starts before the first version a model writes, so
  // the offer in use is never mistaken for the model's.
  if (kind === 'offer') await ensureOfferHistory(pid, home.profile.offer);
  const assetId = target?.id ?? (kind === 'offer' ? OFFER_ASSET : randomUUID());
  const version = await insertAssetEvent(pid, ASSET_VERSION, {
    asset: assetId, kind, by: 'ai', title: checked.title, body: checked.body, offer: checked.offer,
    note: ask ?? (target ? 'Rewritten by AI' : null), bet: bet?.bet.id ?? null, model: cfg.model,
  });
  return { asset: assetId, version };
}
