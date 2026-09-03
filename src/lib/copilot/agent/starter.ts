// src/lib/copilot/agent/starter.ts
// Deterministic first brief. Used when no agent is configured, and as the
// fallback when the configured agent fails, so the app always has a Today view.
// It never invents opportunities: matches appear once a real agent runs.

import { CAPACITY_META, type BriefOutput, type ContextPack, type OpportunityAgent } from '../types';

export class StarterAgent implements OpportunityAgent {
  readonly name = 'starter' as const;

  async generateBrief(pack: ContextPack): Promise<BriefOutput> {
    const goal = pack.goals[0];
    const cap = CAPACITY_META[pack.profile.capacity];
    const firstName = pack.profile.name.split(' ')[0];
    const knows = pack.context.filter((c) => c.source !== 'system').length;
    const headline = pack.profile.headline ? `you ${pack.profile.headline.replace(/^i\s+/i, '').replace(/\.$/, '')}` : 'what you do';

    const goalLine = goal
      ? `Your primary goal is "${goal.title}"${goal.target_value ? ` with a target of ${fmt(goal.target_value, goal.unit, goal.metric)}` : ''}${goal.horizon_days ? ` in ${goal.horizon_days} days` : ''}.`
      : 'You have not set a goal yet, so ranking runs on your profile alone.';

    const body = `Day one, ${firstName}. I know ${headline}${pack.profile.location ? ` from ${pack.profile.location}` : ''} and I have ${knows} piece${knows === 1 ? '' : 's'} of context to work with. ${goalLine} Today's capacity is ${cap.label.toLowerCase()}, so the plan below fits in about ${cap.minutes} minutes. Every note you add sharpens the next brief.`;

    const plan: BriefOutput['plan'] = [
      {
        owner: 'ai',
        title: 'One-line positioning you can paste anywhere, ready to review',
        detail: 'Drafted from your profile. Edit it, then reuse it in outreach and bios.',
        ai_draft: pack.profile.headline
          ? `${firstName} — ${pack.profile.headline.replace(/\.$/, '')}.${goal ? ` Currently focused on: ${goal.title.toLowerCase()}.` : ''}`
          : `${firstName} — tell me what you do and I will draft this line for you.`,
        minutes: 5,
      },
      {
        owner: 'you',
        title: goal?.target_value != null && (goal.current_value ?? 0) === 0
          ? `Set where you stand today on "${goal.title}" so progress is real`
          : 'Write down the last 3 people or companies who paid you, and why they did',
        detail: 'This is the highest-signal context for matching. Add it as a note in the You tab.',
        minutes: 10,
      },
      {
        owner: 'you',
        title: 'Add one constraint I should respect (time, location, money, energy)',
        detail: 'Constraints change what counts as a good opportunity.',
        minutes: pack.profile.capacity === 'low' ? 5 : 15,
      },
    ];

    const nudges: BriefOutput['nudges'] = [
      { title: 'Matches appear after the first real agent run. Add context now so it has something to rank.', urgency: 'normal', due_label: 'Today' },
    ];
    if (!pack.sources.some((s) => s.status === 'connected')) {
      nudges.push({ title: 'Nothing is connected yet. Tap Connect on a source to queue it for the agent.', urgency: 'info', due_label: 'Foundation' });
    }

    return { insight: { body, reasoning: 'Starter brief: built from your onboarding answers only. No model was called.' }, plan, nudges, opportunities: [], skills: [], lessons: [] };
  }
}

function fmt(v: number, unit: string | null | undefined, metric: string): string {
  if (metric === 'currency') return `${unit ?? '$'}${v.toLocaleString()}`.replace(/^([A-Z]{3})(\d)/, '$1 $2');
  if (metric === 'percent') return `${v}%`;
  return unit ? `${v.toLocaleString()} ${unit}` : v.toLocaleString();
}
