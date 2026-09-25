// src/lib/copilot/hunting.ts
// Hunts, end to end: adding one, handing an agent hunt to the worker, taking
// delivery of what the worker found, and suggesting what to hunt for.
//
// The web hunts run inside supply (supply/web.ts). What lives here is the part
// with a lifecycle — an agent hunt is a commission, so it inherits that layer's
// rules rather than bending them: the mandate is written as a DRAFT and the user
// grants it in a second act (createCommission says why), it counts against the
// three-mandate cap, and the worker's report is parsed by the same normalizer.
// The one thing added is delivery: a `found` event with a link becomes a match,
// once this app has opened the link. A link that will not open is dropped and
// counted on the hunt, never shown — a model's claimed URL is the exact thing
// invariant 3 keeps from outranking a real listing.

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { extractJson } from './agent/schema';
import { extraBody, maxOutputTokens, resolveLlmConfig } from './agent/llm';
import type { Commission, CommissionEvent } from './commission';
import { copilotDb } from './db';
import {
  SUGGEST_SYSTEM, agentObjective, contactFromHtml, findsFromEvents, normalizeHuntInput, parseSuggestions,
  suggestionsFromOffer, suggestPrompt, withPageContact, type Hunt, type HuntSuggestion,
} from './hunts';
import { offerIsEmpty } from './offer';
import {
  createCommission, deleteDraftCommission, deleteHunt, getProfile, huntForCommission, insertHunt, loadCommissions, loadHunts, loadWorking,
  logEvent, typeAffinityFor, updateHunt,
} from './store';
import { candidateRows } from './supply';
import { openPage } from './supply/page';
import type { SupplyCandidate } from './supply/types';
import { workingBrief } from './working';

/** Add a hunt. An agent hunt also writes its mandate — as a draft, for the user to grant. */
export async function createHunt(profileId: string, raw: unknown, origin: 'user' | 'suggested' = 'user'): Promise<{ hunt: Hunt; commissionId: string | null }> {
  const input = normalizeHuntInput(raw);
  if ('error' in input) throw new Error(input.error);
  // Checked before anything is written: an agent hunt with nobody to take it
  // would sit "waiting for your go-ahead" over a mandate no worker can pick up.
  if (input.kind === 'agent' && !process.env.COPILOT_JOBS_URL) {
    throw new Error('No research worker is connected to this app, so an agent hunt would never run. Use a Companies or People hunt.');
  }
  const hunt = await insertHunt(profileId, { ...input, origin });
  if (input.kind !== 'agent') return { hunt, commissionId: null };
  try {
    const commissionId = await writeMandate(profileId, hunt);
    return { hunt: { ...hunt, commission_id: commissionId }, commissionId };
  } catch (e) {
    // No orphan: a hunt whose mandate could not be written is not a hunt. The
    // row is removed outright — it found nothing, so there is nothing to set aside.
    await copilotDb().from('copilot_hunts').delete().eq('profile_id', profileId).eq('id', hunt.id);
    throw e;
  }
}

/** Hand an agent hunt over again, once its last mandate has finished. */
export async function rerunAgentHunt(profileId: string, id: string): Promise<string> {
  const { hunts } = await loadHunts(profileId);
  const hunt = hunts.find((h) => h.id === id);
  if (!hunt || hunt.kind !== 'agent') throw new Error('Only an agent hunt is handed over.');
  if (hunt.commission_id) {
    const current = (await loadCommissions(profileId)).find((c) => c.id === hunt.commission_id);
    if (current && current.status !== 'done' && current.status !== 'stopped') {
      throw new Error(current.status === 'draft' ? 'It is already waiting for your go-ahead.' : 'It is still with the worker.');
    }
  }
  return writeMandate(profileId, hunt);
}

async function writeMandate(profileId: string, hunt: Hunt): Promise<string> {
  const { objective, why } = agentObjective(hunt);
  // Read ring, always: finding and checking is research. Nothing here may
  // contact anybody — reaching out stays the user's, from Matches.
  const commission = await createCommission(profileId, { objective, why, authority: 'read', budget_minutes: 60 });
  if (!commission) throw new Error('Could not hand that over.');
  await updateHunt(profileId, hunt.id, { commission_id: commission.id, last_dropped: null, last_error: null });
  return commission.id;
}

/**
 * Remove a hunt, setting aside what it found that nobody answered.
 *
 * An agent hunt's mandate goes with it only while it is a draft — never granted,
 * nothing done, nothing to judge. One the worker is holding is refused: it is
 * called off from its own sheet, which asks what it was worth. Stopping it from
 * here would write a close with no verdict, and the week's review reads exactly
 * that as a project that bought nothing, whatever it delivered.
 */
export async function removeHunt(profileId: string, id: string): Promise<{ dropped: number }> {
  const { hunts } = await loadHunts(profileId);
  const hunt = hunts.find((h) => h.id === id);
  if (hunt?.kind === 'agent' && hunt.commission_id) {
    const c = (await loadCommissions(profileId)).find((x) => x.id === hunt.commission_id);
    if (c && (c.status === 'active' || c.status === 'blocked')) {
      throw new Error('It is still with the worker. Open the project and call it off first, so you can say what it was worth.');
    }
    if (c?.status === 'draft') await deleteDraftCommission(profileId, c.id);
  }
  return deleteHunt(profileId, id);
}

const DELIVERY_CONCURRENCY = 4;

/**
 * The worker's finds into Matches. Called after recordCommissionWork, from both
 * places a worker's report arrives (the result socket and the dispatcher's
 * inline answer). A commission that is not a hunt's is left alone.
 *
 * Each link is opened before its find is admitted; the page is also read for an
 * email or WhatsApp link the worker did not mention. What would not open is
 * counted on the hunt and said on its line. Never throws: a delivery that fails
 * must not undo the report it came with, so a failure is recorded on the hunt,
 * where the sheet reads it (invariant 13).
 */
export async function deliverHuntFinds(profileId: string, commission: Pick<Commission, 'id'>, events: Array<Pick<CommissionEvent, 'kind' | 'summary' | 'artifact'>>): Promise<{ accepted: number; dropped: number }> {
  if (!events.some((e) => e.kind === 'found' && e.artifact?.href)) return { accepted: 0, dropped: 0 };
  const hunt = await huntForCommission(profileId, commission.id);
  if (!hunt) return { accepted: 0, dropped: 0 };
  try {
    const finds = findsFromEvents(events, hunt);
    const accepted: SupplyCandidate[] = [];
    const reasons: string[] = [];
    let next = 0;
    const deadline = Date.now() + 40_000;
    await Promise.all(Array.from({ length: Math.min(DELIVERY_CONCURRENCY, finds.length) }, async () => {
      while (next < finds.length) {
        const f = finds[next++];
        const page = await openPage(f.href, { deadline });
        if (!page.ok) { reasons.push(page.reason); continue; }
        accepted.push(page.html ? withPageContact(f.candidate, contactFromHtml(page.html)) : f.candidate);
      }
    }));
    const dropped = finds.length - accepted.length;
    if (accepted.length) {
      const profile = await getProfile(profileId);
      if (!profile) throw new Error('profile not found');
      const rows = candidateRows(profile, accepted, { affinity: await typeAffinityFor(profileId), runId: null, now: new Date() });
      const { error } = await copilotDb().from('copilot_opportunities')
        .upsert(rows, { onConflict: 'profile_id,source,external_id', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    await updateHunt(profileId, hunt.id, {
      last_run_at: new Date().toISOString(),
      last_found: accepted.length,
      last_dropped: dropped,
      // Only when nothing arrived is it a failure; a partial drop is the check
      // working, and the line says how many.
      last_error: finds.length && !accepted.length ? `none of the ${finds.length} links opened (${reasons[0] ?? 'no reason given'})` : null,
    });
    await logEvent(profileId, 'hunt_delivered', { hunt_id: hunt.id, commission_id: commission.id, accepted: accepted.length, dropped, reasons: [...new Set(reasons)].slice(0, 3) });
    return { accepted: accepted.length, dropped };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[copilot/hunts] delivery failed:', message);
    await updateHunt(profileId, hunt.id, { last_run_at: new Date().toISOString(), last_error: `Could not take delivery: ${message}`.slice(0, 200) }).catch(() => {});
    return { accepted: 0, dropped: 0 };
  }
}

/**
 * Three or four hunts to start from, read off the offer. The model is asked
 * when one is configured; otherwise, or when it fails, the buyers the user named
 * are offered as they wrote them — and which of the two it was is returned, so
 * the sheet can say so rather than passing a fallback off as the model's read.
 */
export async function suggestHunts(profileId: string): Promise<{ suggestions: HuntSuggestion[]; from: 'model' | 'offer'; note: string | null }> {
  const profile = await getProfile(profileId);
  if (!profile) throw new Error('Not found');
  // Invariant 1, one step earlier: a suggestion read from a blank offer is the
  // app forming a view of a business it has not been told about.
  if (offerIsEmpty(profile.offer)) throw new Error('Say what you sell first — suggestions are read from it.');
  const { hunts } = await loadHunts(profileId);
  const existing = [...hunts.map((h) => h.query), ...profile.target_segments];
  const area = profile.target_area || profile.location || null;
  const fallback = () => suggestionsFromOffer(profile.offer, area, existing);

  const cfg = resolveLlmConfig();
  if (!cfg) return { suggestions: fallback(), from: 'offer', note: 'No model is configured, so these are the buyers you named.' };
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
    const working = workingBrief(await loadWorking(profileId).catch(() => []));
    const { data: goalRows } = await copilotDb().from('copilot_goals').select('title').eq('profile_id', profileId).eq('status', 'active').order('priority').limit(3);
    const { text } = await generateText({
      model: provider(cfg.model),
      system: SUGGEST_SYSTEM,
      prompt: suggestPrompt({ offer: profile.offer, area, working, goals: ((goalRows ?? []) as Array<{ title: string }>).map((g) => g.title), existing }),
      temperature: 0.4,
      maxRetries: 0,
      maxOutputTokens: maxOutputTokens() ?? 900,
      // Somebody is holding the sheet open. Twenty seconds, then the fallback.
      abortSignal: AbortSignal.timeout(20_000),
    });
    const suggestions = parseSuggestions(extractJson(text), existing);
    if (suggestions.length) return { suggestions, from: 'model', note: null };
    return { suggestions: fallback(), from: 'offer', note: 'The model had nothing usable, so these are the buyers you named.' };
  } catch (e) {
    console.error('[copilot/hunts] suggestion failed:', e instanceof Error ? e.message : String(e));
    return { suggestions: fallback(), from: 'offer', note: 'The model did not answer, so these are the buyers you named.' };
  }
}
