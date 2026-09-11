// src/lib/copilot/agent/starter.ts
// Deterministic brief. Used when no agent is configured, and as the fallback
// when the configured agent fails, so the app always has a Today view.
// It never invents opportunities — but since the loop closed it can rank REAL
// candidates, cite REAL metrics, and draft a real opener the user can send.

import { starterDecision } from '../decision';
import { describeMetrics } from '../metrics';
import { OFFER_TASK_DETAIL, OFFER_TASK_TITLE, offerIsEmpty } from '../offer';
import { CAPACITY_META, type BriefOutput, type ContextPack, type Offer, type OpportunityAgent } from '../types';

export class StarterAgent implements OpportunityAgent {
  readonly name = 'starter' as const;

  async generateBrief(pack: ContextPack): Promise<BriefOutput> {
    const goal = pack.goals[0];
    const cap = CAPACITY_META[pack.profile.capacity];
    const firstName = pack.profile.name.split(' ')[0];
    const m = pack.metrics;
    const currency = goal?.metric === 'currency' ? (goal.unit || '$') : '$';
    const knows = pack.context.filter((c) => c.source !== 'system').length;

    // Rank real candidates: echo the heuristic, nudge reachable ones up.
    const rankings = pack.candidates.map((c) => ({
      id: c.id,
      fit_score: Math.min(85, c.fit_score + (c.contact.whatsapp ? 5 : 0)),
      reason: c.summary,
    }));
    const top = [...pack.candidates].sort((a, b) => b.fit_score - a.fit_score).find((c) => c.contact.whatsapp || c.contact.email);
    // Nothing is drafted from a blank offer. A message written from nothing is
    // not the user's, and the live account proved it: 44 such drafts, 0 sent.
    const noOffer = offerIsEmpty(pack.profile.offer);

    const goalLine = goal
      ? `Goal: "${goal.title}"${goal.target_value ? ` at ${fmt(Number(goal.current_value ?? 0), goal.unit, goal.metric)} of ${fmt(goal.target_value, goal.unit, goal.metric)}` : ''}.`
      : 'No goal set yet, so ranking runs on your profile alone.';

    const supplyLine = noOffer && pack.candidates.length
      ? `There are ${pack.candidates.length} real matches ranked below, but nothing can be drafted until you say what you sell — set your offer and every one gets an opener in your words.`
      : pack.candidates.length ? `There are ${pack.candidates.length} real matches ranked below; the deck asks about them one at a time.`
      : 'No real matches yet. Add who you sell to and where in the You tab, then tap "Find new matches".';

    const body = m.sent > 0
      ? `${firstName}, the numbers: ${describeMetrics(m, currency)}. ${goalLine} ${m.reply_rate != null && m.reply_rate < 0.1 && m.sent >= 10 ? 'Under 10% replies means the opener, not the volume, is the problem. Change the angle before sending more.' : noOffer ? 'Your offer is empty, so nothing new is drafted until you set it.' : m.pipeline.sourced > 0 ? `You have ${m.pipeline.sourced} real matches waiting; the deck asks about the best one first.` : 'Run "Find new matches" so there is something real to send to.'} Capacity is ${cap.label.toLowerCase()}, so today's call is sized for about ${cap.minutes} minutes.`
      : `${firstName}, nothing has gone out yet. ${goalLine} ${supplyLine} I know ${knows} thing${knows === 1 ? '' : 's'} about you so far; every note sharpens the next brief.`;


    // The call is a ladder over the same numbers the insight cites, so the
    // floor is never a blank card: a deterministic decision beats no decision.
    const { decision, dont } = starterDecision({
      metrics: m, candidates: pack.candidates.length,
      offerEmpty: noOffer, hasSegments: pack.profile.target_segments.length > 0,
    });

    return {
      decision, dont,
      insight: { body, reasoning: `Starter brief: computed from ${m.sent} sends, ${m.replies} replies, ${pack.candidates.length} real candidates and your onboarding answers. No model was called.` },
      rankings,
    };
  }
}

export interface OpenerProfile { name: string; headline: string | null; target_area: string | null; location: string | null; offer?: Offer }
export interface OpenerTarget { title: string; summary: string; contact: { name?: string } }

/**
 * A plain, specific opener built from the user's OWN offer. Nothing about the
 * message assumes a vertical: if they filled in the offer it is theirs, and if
 * they did not we fall back to their headline rather than inventing a business.
 * The LLM agent writes better ones; this is the floor, not the ceiling.
 */
export function openerTemplate(profile: OpenerProfile, c: OpenerTarget, channel: 'whatsapp' | 'email'): string {
  const firstName = profile.name.split(' ')[0];
  const who = c.contact.name || c.title;
  const o = profile.offer ?? {};
  const what = o.sells?.trim() || profile.headline?.replace(/^i\s+/i, '').replace(/\.$/, '').trim();
  const problem = o.problem?.trim();
  const proof = o.proof_url?.trim();

  // Only claim to have noticed something we actually know from the listing.
  const observed = /no website/i.test(c.summary) ? 'you have no website listed'
    : /few reviews/i.test(c.summary) ? 'you have only a few reviews online so far'
    : null;

  const opening = what ? `I ${startsWithVerb(what) ? what : `work on ${what}`}` : 'I work with businesses like yours';
  const hook = observed && problem ? `Noticed ${observed} — usually that means ${lower(problem)}.`
    : observed ? `Noticed ${observed}.`
    : problem ? `Most ${o.for_who?.trim() || 'people I work with'} tell me ${lower(problem)}.`
    : null;
  const ask = proof ? `Worth a 10-minute call this week? Here is an example first: ${proof}` : 'Worth a 10-minute call this week? I can show a 2-minute example first, no strings.';

  if (channel === 'whatsapp') return [`Hi ${who}, ${firstName} here.`, `${opening}.`, hook, ask].filter(Boolean).join(' ');
  return `Hi ${who},\n\n${opening}. ${hook ?? ''}\n\n${ask}\n\n${firstName}`.replace(/ \n/g, '\n');
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** "build X" reads as "I build X"; "WhatsApp automations" needs "I work on ...". */
const startsWithVerb = (s: string) => /^(build|make|set up|design|write|run|help|do|create|fix|automate|manage|teach|coach)\b/i.test(s.trim());

function fmt(v: number, unit: string | null | undefined, metric: string): string {
  if (metric === 'currency') return `${unit ?? '$'}${v.toLocaleString()}`.replace(/^([A-Z]{3})(\d)/, '$1 $2');
  if (metric === 'percent') return `${v}%`;
  return unit ? `${v.toLocaleString()} ${unit}` : v.toLocaleString();
}
