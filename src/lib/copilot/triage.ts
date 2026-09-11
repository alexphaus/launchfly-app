// src/lib/copilot/triage.ts
// One match at a time: draft it, or it is not for you.
//
// Pure — no DB import — so copilot-core.test.ts covers the ordering and the
// learning rule. The reads live in store.ts.
//
// Why a stack here and nowhere else. A deck works when both answers cost the
// same flick, and that is true of exactly one judgement in this app: "is this
// business worth messaging at all". It is emphatically NOT true of the send
// queue or of Today's call, where yes costs ten minutes and no costs a thumb —
// put those behind a swipe and the cheap side wins every session, which is how
// you end up with a cleared deck and nothing sent.
//
// And what a swipe teaches is bounded on purpose. A swipe is a PREFERENCE.
// A reply is the TRUTH. So this signal only ever reorders the pile it came
// from; it never touches the decision record, Signals, or what counts as an
// outcome. Invariant 5 is the same rule for the same reason.

/**
 * Below these the queue is not yet the reason nothing is happening.
 *
 * Lived in WorkingView.tsx and guarded exactly one button — "find new matches" —
 * while the deck, whose every "Draft it" adds to the same queue, had no gate at
 * all. The live app showed "20 to judge" directly above "41 drafts written and
 * not sent": the top of the funnel asking for more input while forty-one outputs
 * sat unsent. One rule, in the pure module both surfaces can import.
 */
export const QUEUE_GATE_DRAFTS = 10;
export const QUEUE_GATE_DAYS = 3;

/**
 * Is the queue deep enough, and stale enough, that adding to it is avoidance?
 *
 * Both conditions, not either. Ten drafts written this morning is a good
 * morning; ten written three days ago and still sitting there is the thing the
 * whole app exists to stop.
 */
export function queueIsBacked(count: number, oldestDays: number): boolean {
  return count >= QUEUE_GATE_DRAFTS && oldestDays >= QUEUE_GATE_DAYS;
}

/** The oldest unsent draft in days, from whatever rows the caller has. */
export function oldestWaitDays(created: string[], now: Date): number {
  if (!created.length) return 0;
  return Math.max(...created.map((c) => Math.floor((now.getTime() - new Date(c).getTime()) / 86_400_000)), 0);
}

/**
 * Where a card came from, because the deck is no longer only about businesses.
 *
 * 'opportunity' is a scraped business with a contact: yes drafts an opener.
 * 'move'        is something a watched feed turned up that you would approach —
 *               a gig, a subcontract brief, a person. Yes keeps it; the artifact
 *               is already attached, so there is nothing to draft.
 */
export type TriageSource = 'opportunity' | 'move';

export interface TriageCard {
  id: string;
  source: TriageSource;
  title: string;
  /** Grouping key — what the learning is per. */
  segment: string | null;
  reason: string;
  score: number;
  contact: { whatsapp: boolean; email: boolean };
  url: string | null;
}

export type TriageAction = 'draft' | 'skip';

/** How many cards the stack holds. Past this it is a list again. */
export const MAX_TRIAGE = 20;

/**
 * Below this a segment's keep rate is one person's mood, not a preference.
 * Same floor as MIN_DEMAND in diagnose.ts, and for the same reason: a rate
 * computed from two swipes will reorder the whole pile on noise.
 */
export const MIN_TRIAGE_SAMPLE = 5;

/** No signal yet means no opinion — not "bad". */
export const NEUTRAL_KEEP_RATE = 0.5;

export interface TriageEvent {
  event_type: string;
  payload: Record<string, unknown> | null;
}

/**
 * How often each segment survived triage. Only segments with enough swipes to
 * mean something appear; everything else is left to score on its merits.
 */
export function segmentKeepRate(events: TriageEvent[]): Map<string, number> {
  const tally = new Map<string, { kept: number; total: number }>();
  for (const e of events) {
    if (e.event_type !== 'triage_answered') continue;
    const segment = typeof e.payload?.segment === 'string' ? e.payload.segment.trim().toLowerCase() : '';
    const action = e.payload?.action;
    if (!segment || (action !== 'draft' && action !== 'skip')) continue;
    const t = tally.get(segment) ?? { kept: 0, total: 0 };
    t.total += 1;
    if (action === 'draft') t.kept += 1;
    tally.set(segment, t);
  }

  const out = new Map<string, number>();
  for (const [segment, t] of tally) {
    if (t.total >= MIN_TRIAGE_SAMPLE) out.set(segment, t.kept / t.total);
  }
  return out;
}

/**
 * What to show first. The learned rate leads, the deterministic score breaks
 * ties — so a segment the user keeps drafting rises, and within it the ranking
 * that was already computed from real signals still decides.
 */
export function orderTriage(cards: TriageCard[], rates: Map<string, number>, max = MAX_TRIAGE): TriageCard[] {
  const rateOf = (c: TriageCard) => (c.segment ? rates.get(c.segment.trim().toLowerCase()) ?? NEUTRAL_KEEP_RATE : NEUTRAL_KEEP_RATE);
  return [...cards]
    .sort((a, b) => (rateOf(b) - rateOf(a)) || (b.score - a.score) || a.id.localeCompare(b.id))
    .slice(0, max);
}

/**
 * A card is only worth a decision if the decision can be acted on. No phone and
 * no email means "draft it" has nowhere to go, and asking someone to judge a
 * business they cannot contact is asking for a swipe that teaches nothing.
 */
export function canTriage(c: Pick<TriageCard, 'contact' | 'source' | 'url'>): boolean {
  // A watched-feed card carries its own destination, so there is nothing to
  // draft and nothing to have a phone number for. Requiring a contact here is
  // what would have silently dropped every one of them.
  if (c.source === 'move') return !!c.url;
  return c.contact.whatsapp || c.contact.email;
}

/**
 * What the two buttons say. They are not the same question for both sources and
 * pretending otherwise is how "Draft it" ends up on a Reddit post with nobody to
 * draft to.
 */
export function triageLabels(source: TriageSource): { yes: string; no: string } {
  return source === 'move'
    ? { yes: 'Keep it', no: 'Not for me' }
    : { yes: 'Draft it', no: 'Not for me' };
}
