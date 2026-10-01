// src/lib/copilot/deckstore.ts
// The Swipe tab's reads and writes. deck.ts is the pure half — what is dealt,
// how each card can be reached, and what a model's message is held to.
//
// Four things happen to a card, and each is recorded where the rest of the app
// already reads it, so nothing on another tab has to learn about this one:
//
//   draft   the message is written for the card, by the model when the server
//           has one, from the offer when it does not — and the card says which,
//           and why, whenever it is not the model's (invariant 13)
//   reach   the right swipe: the message becomes the draft for that business
//           (the approved text, not the template) and goes — from the person's
//           own number or address when they connected one, otherwise it is
//           marked opened and their own app does it (invariant 4)
//   sent    they are back from their app and say it went: the same bookkeeping
//           as "I sent it", with the way it went (a text, a call) kept
//   skip    not for me: the triage route's own record, so the keep-rate that
//           orders the deck learns from a swipe here as it did from the list
//
// Every write names the triage event it shares with the Matches list, so a
// swipe and a tap on the list are one tally.

import { generateText } from 'ai';
import { maxOutputTokens, providerFor, resolveLlmConfig } from './agent/llm';
import { extractJson } from './agent/schema';
import { openerTemplate } from './agent/starter';
import { getProfile, logEvent } from './base';
import { copilotDb } from './db';
import {
  DRAFT_SYSTEM, businessReach, channelOf, checkDraft, draftPrompt, draftSources, factsOf, findReplyTemplate, webUrl,
  type DeckDraft, type DeckReach, type DraftInput, type ReachVia,
} from './deck';
import {
  cancelExecution, cancelOpenDrafts, channelsConfigured, deepLink, draftWithBody, executionsForActions, markSentManually, sendExecution, FOLLOW_UP_TITLE_PREFIX,
} from './execution';
import { rateLimit } from './limits';
import { groupOfKind, placeOf } from './matches';
import type { MoveKind } from './moves';
import { offerIsEmpty } from './offer';
import { clearOpened, loadWorking, markOpened, setMoveStatus, setOpportunityStatus } from './store';
import type { Execution, Move, Opportunity, Profile } from './types';
import { workingBrief } from './working';

/** A no the person can read: a 400 with the reason, never a 500. */
export class DeckRefusal extends Error {}

/**
 * A message is written while the card before it is being read, so this is a
 * wait nobody sees — unless the deck has just opened. Under the 30s the proxy
 * allows a tap, with room for the reads around it.
 */
const DRAFT_TIMEOUT_MS = 20_000;
/** Messages the model writes per person per day. Past it, from the offer, and the card says so. */
export const DRAFTS_PER_DAY = 300;
/** The same daily cap as the send route: it protects the person's number from being flagged. */
const SENDS_PER_DAY = 40;

type Target =
  | { kind: 'business'; opp: Opportunity }
  | { kind: 'draft'; actionId: string; exec: Execution; opp: Opportunity | null; followUp: boolean }
  | { kind: 'find'; move: Move };

export type DeckKind = Target['kind'];

async function loadTarget(pid: string, kind: DeckKind, id: string): Promise<Target> {
  const db = copilotDb();
  if (kind === 'find') {
    const { data } = await db.from('copilot_moves').select('*').eq('id', id).eq('profile_id', pid).maybeSingle();
    if (!data) throw new DeckRefusal('That find is gone. The deck will skip it.');
    return { kind, move: data as Move };
  }
  if (kind === 'draft') {
    const exec = (await executionsForActions(pid, [id]))[id];
    if (!exec) throw new DeckRefusal('That draft is gone. The deck will skip it.');
    if (!['needs_approval', 'approved', 'failed'].includes(exec.approval_state)) throw new DeckRefusal(`That message was already ${exec.approval_state}.`);
    const [{ data: action }, { data: opp }] = await Promise.all([
      db.from('copilot_actions').select('title').eq('id', id).eq('profile_id', pid).maybeSingle(),
      exec.opportunity_id ? db.from('copilot_opportunities').select('*').eq('id', exec.opportunity_id).eq('profile_id', pid).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const title = (action as { title?: string } | null)?.title ?? '';
    return { kind, actionId: id, exec, opp: (opp as Opportunity | null) ?? null, followUp: title.startsWith(FOLLOW_UP_TITLE_PREFIX) };
  }
  const { data } = await db.from('copilot_opportunities').select('*').eq('id', id).eq('profile_id', pid).maybeSingle();
  if (!data) throw new DeckRefusal('That business is gone. The deck will skip it.');
  return { kind, opp: data as Opportunity };
}

const str = (d: Record<string, unknown> | null | undefined, k: string) => {
  const v = d?.[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

/** The card as the prompt reads it — from the rows, never from what the phone sent. */
function cardFor(t: Target): DraftInput['card'] {
  if (t.kind === 'find') {
    const m = t.move;
    let source: string | null = null;
    try { source = m.artifact?.href ? new URL(m.artifact.href).hostname.replace(/^www\./, '') : null; } catch { /* no host */ }
    return {
      kind: 'find', title: m.headline, sub: null, why: m.why ?? [], facts: [], followUp: false, source,
      post: m.artifact?.value && m.artifact.value.trim() !== m.headline.trim() ? m.artifact.value.slice(0, 1600) : null,
    };
  }
  const o = t.opp;
  const what = str(o?.data, 'category') ?? str(o?.data, 'segment');
  return {
    kind: t.kind === 'business' ? 'business' : 'draft',
    title: o?.title ?? (t.kind === 'draft' ? t.exec.recipient : ''),
    sub: [what, placeOf(o?.data)].filter(Boolean).join(' · ') || null,
    why: o?.reason ? [o.reason] : [],
    facts: factsOf(o?.data),
    post: null,
    source: null,
    followUp: t.kind === 'draft' && t.followUp,
  };
}

/** The message from the offer, as the Draft button writes it, for when the model does not. */
function fallbackFor(profile: Profile, t: Target, via: ReachVia): { body: string; subject: string | null } {
  if (t.kind === 'find') return { body: findReplyTemplate(profile.name, profile.offer ?? {}, { title: t.move.headline, group: groupOfKind(t.move.kind as MoveKind) }), subject: null };
  // A written draft already is its own fallback: it is what the queue held.
  if (t.kind === 'draft') return { body: t.exec.body, subject: t.exec.subject };
  const o = t.opp;
  const channel = via === 'email' ? 'email' : 'whatsapp';
  return {
    body: openerTemplate(profile, { title: o.title, summary: o.reason ?? '', contact: o.contact ?? {} }, channel),
    subject: channel === 'email' ? `Quick note for ${o.title}` : null,
  };
}

async function lastSentBody(pid: string, oppId: string): Promise<string | null> {
  const { data } = await copilotDb().from('copilot_executions').select('body')
    .eq('profile_id', pid).eq('opportunity_id', oppId).eq('approval_state', 'sent')
    .order('sent_at', { ascending: false }).limit(1).maybeSingle();
  return (data as { body?: string } | null)?.body ?? null;
}


/**
 * The message for one card, written for the way it will go.
 *
 * Invariant 1 first: with no offer there is nothing to write from, and the
 * deck says so rather than dealing cards with messages written from nothing.
 */
export async function writeDeckDraft(pid: string, kind: DeckKind, id: string, via: ReachVia): Promise<DeckDraft> {
  const profile = await getProfile(pid);
  if (!profile) throw new DeckRefusal('Not found');
  if (offerIsEmpty(profile.offer)) throw new DeckRefusal('Say what you sell first — every message is written from it.');
  const t = await loadTarget(pid, kind, id);
  const card = cardFor(t);
  const offer = () => ({ ...fallbackFor(profile, t, via), from: 'offer' as const });

  const cfg = resolveLlmConfig();
  if (!cfg) return { ...offer(), note: 'No model on this server, so this one is written from your offer.' };
  const rl = await rateLimit(`copilot:deckdraft:${pid}`, DRAFTS_PER_DAY, 86_400);
  if (!rl.ok) return { ...offer(), note: `${DRAFTS_PER_DAY} messages written today. The rest are from your offer until tomorrow.` };

  const [entries, firstMessage] = await Promise.all([
    loadWorking(pid),
    t.kind === 'draft' && t.followUp && t.opp ? lastSentBody(pid, t.opp.id) : Promise.resolve(null),
  ]);
  const working = workingBrief(entries);
  const input: DraftInput = {
    name: profile.name, offer: profile.offer ?? {}, working: working || null, area: profile.target_area || profile.location,
    card, via, firstMessage,
  };
  try {
    const { text } = await generateText({
      model: providerFor(cfg)(cfg.model),
      system: DRAFT_SYSTEM,
      prompt: draftPrompt(input),
      temperature: 0.6,
      maxRetries: 0,
      maxOutputTokens: maxOutputTokens() ?? 600,
      abortSignal: AbortSignal.timeout(DRAFT_TIMEOUT_MS),
    });
    let message: string = text;
    let subject: string | null = null;
    try {
      const j = extractJson(text) as { message?: unknown; subject?: unknown } | null;
      if (j && typeof j.message === 'string') message = j.message;
      if (j && typeof j.subject === 'string') subject = j.subject;
    } catch { /* not JSON: a model that wrote just the message has still written the message */ }
    const checked = checkDraft(message.replace(/^```\w*\s*|\s*```$/g, ''), subject, draftSources(input), via, profile.offer?.proof_url);
    if (checked.ok) return { body: checked.body, subject: checked.subject ?? (via === 'email' ? `Quick note for ${card.title}` : null), from: 'model', note: null };
    return { ...offer(), note: `Written from your offer: the model's version was set aside because ${checked.why}.` };
  } catch (e) {
    const why = e instanceof Error ? (e.name === 'TimeoutError' || /abort/i.test(e.message) ? `it took longer than ${DRAFT_TIMEOUT_MS / 1000}s` : e.message) : String(e);
    return { ...offer(), note: `Written from your offer: the model did not answer (${why.slice(0, 120)}).` };
  }
}

function segmentOfOpp(o: Opportunity): string | null {
  return str(o.data, 'segment') ?? str(o.data, 'service_type') ?? str(o.data, 'category');
}

/**
 * The right swipe. The message is what the person read on the card; it becomes
 * the draft for that business and goes the way they picked.
 */
export async function reachDeckCard(pid: string, kind: DeckKind, id: string, input: { via: ReachVia; body: string; subject?: string | null }): Promise<DeckReach> {
  const body = input.body.trim().slice(0, 4000);
  if (!body) throw new DeckRefusal('The message is empty.');
  const profile = await getProfile(pid);
  if (!profile) throw new DeckRefusal('Not found');
  const t = await loadTarget(pid, kind, id);
  if (t.kind === 'find') {
    // A post is answered on its own site, under the person's own account there.
    // Nothing is recorded until they say they posted it (postedDeckCard).
    return { mode: 'open', actionId: null, link: webUrl(t.move.artifact?.href) };
  }
  if (offerIsEmpty(profile.offer)) throw new DeckRefusal('Say what you sell first — every message is written from it.');
  const channel = channelOf(input.via);

  let drafted: { actionId: string; execution: Execution } | null;
  if (t.kind === 'business') {
    const o = t.opp;
    if (!channel) {
      const site = webUrl(o.contact?.website);
      if (!site) throw new DeckRefusal('They have no website on file.');
      return { mode: 'open', actionId: null, link: site };
    }
    const country = str(o.data, 'country_code')?.toUpperCase() ?? null;
    if (!businessReach(o.contact ?? {}, country).some((r) => r.via === input.via)) throw new DeckRefusal(`They cannot be reached by ${input.via} from what is on file.`);
    drafted = await draftWithBody(profile, o, channel, { body, subject: input.subject ?? null, via: input.via, detail: 'Swiped right on the Swipe tab.' });
    if (!drafted) throw new DeckRefusal('No contact for this business on that channel.');
    // The same record a tap on "Draft" makes from the list: the keep-rate is one tally.
    await logEvent(pid, 'triage_answered', { opportunity_id: o.id, action: 'draft', segment: segmentOfOpp(o), from: 'swipe' });
  } else {
    if (channel !== t.exec.channel) throw new DeckRefusal(`This message is written for ${t.exec.channel === 'email' ? 'email' : 'their phone'}.`);
    const provider = input.via === 'sms' || input.via === 'call' ? input.via : null;
    const { data, error } = await copilotDb().from('copilot_executions')
      .update({ body, subject: channel === 'email' ? (input.subject ?? t.exec.subject) : null, provider })
      .eq('id', t.exec.id).eq('profile_id', pid).select('*').single();
    if (error) throw error;
    drafted = { actionId: t.actionId, execution: data as Execution };
  }

  const exec = drafted.execution;
  const owned = channelsConfigured(profile)[exec.channel] && (input.via === 'whatsapp' || input.via === 'email');
  if (owned) {
    const rl = await rateLimit(`copilot:send:${pid}`, SENDS_PER_DAY, 86_400);
    if (rl.ok) {
      const sent = await sendExecution(pid, exec.id, { body, subject: input.subject ?? undefined });
      if (sent.approval_state === 'sent') return { mode: 'sent', actionId: drafted.actionId, link: null };
      // Their number refused it. Said, and their own app is the way it still goes.
      await markOpened(pid, drafted.actionId);
      return { mode: 'open', actionId: drafted.actionId, link: deepLink(sent), error: `Your number did not send it${sent.error ? ` (${sent.error.slice(0, 160)})` : ''}. Send it from your own app instead.` };
    }
    await markOpened(pid, drafted.actionId);
    return { mode: 'open', actionId: drafted.actionId, link: deepLink(exec), error: `${SENDS_PER_DAY} sent from your number today — that is the cap that keeps it from being flagged. This one goes from your own app.` };
  }
  // Their own app does it. Marked opened, so a person who never comes back to
  // say whether it went is asked on the Path, as a tap on the list is.
  await markOpened(pid, drafted.actionId);
  return { mode: 'open', actionId: drafted.actionId, link: deepLink(exec) };
}

/** Back from their app: it went. The same bookkeeping as "I sent it", with how. */
export async function sentDeckCard(pid: string, actionId: string, input: { via: ReachVia; body?: string; subject?: string | null }): Promise<void> {
  const exec = (await executionsForActions(pid, [actionId]))[actionId];
  if (!exec) throw new DeckRefusal('That draft is gone.');
  await markSentManually(pid, exec.id, { body: input.body?.slice(0, 4000), subject: input.subject ?? undefined, via: input.via });
}

/** Back from their app: it did not go. The draft stays in To send, and the question stops. */
export async function unsentDeckCard(pid: string, actionId: string): Promise<void> {
  await clearOpened(pid, actionId);
}

/**
 * They posted the reply, or sent it through a business's site. There is no
 * recipient to hold a draft for, so it is the find's Move or the business that
 * records it — and the same triage event, so the keep-rate counts it.
 */
export async function postedDeckCard(pid: string, kind: DeckKind, id: string, via: ReachVia): Promise<void> {
  const t = await loadTarget(pid, kind, id);
  if (t.kind === 'find') {
    await setMoveStatus(pid, id, 'done');
    await logEvent(pid, 'triage_answered', { move_id: id, action: 'draft', segment: t.move.kind, from: 'swipe' });
    await logEvent(pid, 'deck_posted', { move_id: id, via });
    return;
  }
  if (t.kind === 'business') {
    await setOpportunityStatus(pid, id, 'acted');
    await logEvent(pid, 'triage_answered', { opportunity_id: id, action: 'draft', segment: segmentOfOpp(t.opp), from: 'swipe' });
    await logEvent(pid, 'deck_posted', { opportunity_id: id, via });
    return;
  }
  throw new DeckRefusal('A written message is marked sent, not posted.');
}

/**
 * Not for me. A business and a find are recorded as the list records them; a
 * written draft is cancelled — not deleted, so the funnel still reads what was
 * written and abandoned — and its business set aside, so it does not come back
 * to New the moment the draft is gone.
 */
export async function skipDeckCard(pid: string, kind: DeckKind, id: string): Promise<void> {
  const t = await loadTarget(pid, kind, id);
  if (t.kind === 'find') {
    await setMoveStatus(pid, id, 'dismissed');
    await logEvent(pid, 'triage_answered', { move_id: id, action: 'skip', segment: t.move.kind, from: 'swipe' });
    return;
  }
  if (t.kind === 'business') {
    // A business can have a draft already: swiped right, called, no answer, put
    // back — and then not for me. Set aside without its draft, the draft stayed
    // in To send for a business nothing else would show, its listing gone from
    // every read (a landline offered WhatsApp, its rating missing).
    await cancelOpenDrafts(pid, { reason: 'swiped_not_for_me', opportunityIds: [id] });
    await setOpportunityStatus(pid, id, 'dismissed');
    await logEvent(pid, 'triage_answered', { opportunity_id: id, action: 'skip', segment: segmentOfOpp(t.opp), from: 'swipe' });
    return;
  }
  await cancelExecution(pid, t.exec.id);
  if (!t.followUp && t.opp) {
    await setOpportunityStatus(pid, t.opp.id, 'dismissed');
    await logEvent(pid, 'triage_answered', { opportunity_id: t.opp.id, action: 'skip', segment: segmentOfOpp(t.opp), from: 'swipe' });
  }
}
