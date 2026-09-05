// src/lib/copilot/agent/starter.ts
// Deterministic brief. Used when no agent is configured, and as the fallback
// when the configured agent fails, so the app always has a Today view.
// It never invents opportunities — but since the loop closed it can rank REAL
// candidates, cite REAL metrics, and draft a real opener the user can send.

import { describeMetrics } from '../metrics';
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

    const goalLine = goal
      ? `Goal: "${goal.title}"${goal.target_value ? ` at ${fmt(Number(goal.current_value ?? 0), goal.unit, goal.metric)} of ${fmt(goal.target_value, goal.unit, goal.metric)}` : ''}.`
      : 'No goal set yet, so ranking runs on your profile alone.';

    const body = m.sent > 0
      ? `${firstName}, the numbers: ${describeMetrics(m, currency)}. ${goalLine} ${m.reply_rate != null && m.reply_rate < 0.1 && m.sent >= 10 ? 'Under 10% replies means the opener, not the volume, is the problem. Change the angle before sending more.' : m.pipeline.sourced > 0 ? `You have ${m.pipeline.sourced} real matches waiting; today's plan drafts the best one.` : 'Run "Find new matches" so there is something real to send to.'} Capacity is ${cap.label.toLowerCase()}, so the plan fits in about ${cap.minutes} minutes.`
      : `${firstName}, nothing has gone out yet. ${goalLine} ${pack.candidates.length ? `There are ${pack.candidates.length} real matches ranked below; the first message is drafted and waits for your approval.` : 'No real matches yet. Add who you sell to and where in the You tab, then tap "Find new matches".'} I know ${knows} thing${knows === 1 ? '' : 's'} about you so far; every note sharpens the next brief.`;

    const plan: BriefOutput['plan'] = [];
    if (top) {
      const channel = top.contact.whatsapp ? 'whatsapp' as const : 'email' as const;
      plan.push({
        owner: 'ai', minutes: 3,
        title: `Opener to ${top.contact.name || top.title}, ready to review`,
        detail: `Highest-ranked real match with a reachable contact. Edit, then approve to send on ${channel}.`,
        ai_draft: openerTemplate(pack.profile, top, channel),
        opportunity_ref: top.id, channel,
      });
    }
    plan.push({
      owner: 'you',
      title: goal?.target_value != null && Number(goal.current_value ?? 0) === 0 && m.won === 0
        ? `Log where you stand today on "${goal.title}" so progress is real`
        : m.sent > 0 && m.replies === 0
          ? 'Write one sentence on why the last 5 recipients might have ignored you'
          : 'Write down the last 3 people who paid you, and why they did',
      detail: 'Highest-signal context for matching. Add it as a note on Today.',
      minutes: 10,
    });
    if (!pack.profile.target_segments.length) {
      plan.push({ owner: 'you', title: 'Set who you sell to and where, so real matches can be found', detail: 'You tab → Targeting. Two fields.', minutes: 2 });
    } else {
      plan.push({ owner: 'you', title: 'Add one constraint I should respect (time, location, money, energy)', detail: 'Constraints change what counts as a good opportunity.', minutes: pack.profile.capacity === 'low' ? 5 : 15 });
    }

    const nudges: BriefOutput['nudges'] = [];
    if (m.awaiting_approval > 0) nudges.push({ title: `${m.awaiting_approval} drafted message${m.awaiting_approval === 1 ? ' is' : 's are'} waiting for your approval. Nothing goes out until you tap send.`, urgency: 'urgent', due_label: 'Today' });
    if (m.runway_months != null && m.runway_months < 4) nudges.push({ title: `Runway is ${m.runway_months} months. Favour fast-close work over big builds until it passes 6.`, urgency: 'urgent', due_label: 'Finance' });
    if (!pack.candidates.length) nudges.push({ title: 'No real matches in the pipeline. Tap "Find new matches" or add targeting in the You tab.', urgency: 'normal', due_label: 'Today' });
    if (m.sent > 0 && m.replies === 0 && m.sent >= 5) nudges.push({ title: `${m.sent} sent, zero replies. Follow-ups are drafted automatically on day 3; approve them.`, urgency: 'normal', due_label: 'Outreach' });

    return {
      insight: { body, reasoning: `Starter brief: computed from ${m.sent} sends, ${m.replies} replies, ${pack.candidates.length} real candidates and your onboarding answers. No model was called.` },
      rankings, plan, nudges, opportunities: [], skills: [], lessons: [],
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
