// src/lib/copilot/onboarding.ts
// Turns the three onboarding screens into a profile, a goal and the first
// context items, then runs the first brief.

import { copilotDb } from './db';
import { runBrief } from './brief';
import { addContextItem, ensureSources, logEvent } from './store';
import { runSupply } from './supply';
import { CAPACITY_META, OPPORTUNITY_TYPES, type Capacity, type GoalMetric, type Offer, type OpportunityType } from './types';

export interface OnboardingInput {
  name: string;
  email?: string;
  headline?: string;
  target_segments: string[];
  target_area?: string;
  offer: Offer;
  location?: string;
  timezone?: string;
  goal: { title: string; metric?: GoalMetric; unit?: string; target_value?: number; current_value?: number; horizon_days?: number };
  capacity: Capacity;
  hunt_types: OpportunityType[];
  notes?: string;
}

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);

export function parseOnboarding(body: unknown): OnboardingInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const g = (b.goal ?? {}) as Record<string, unknown>;
  const name = s(b.name, 80);
  const goalTitle = s(g.title, 120);
  if (!name) throw new Error('Tell me your name');
  if (!goalTitle) throw new Error('Tell me one goal');
  const capacity = (Object.keys(CAPACITY_META) as Capacity[]).includes(b.capacity as Capacity) ? (b.capacity as Capacity) : 'moderate';
  const metric = (['currency', 'number', 'percent', 'none'] as GoalMetric[]).includes(g.metric as GoalMetric) ? (g.metric as GoalMetric) : 'none';
  const hunt = Array.isArray(b.hunt_types) ? (b.hunt_types as unknown[]).filter((t): t is OpportunityType => OPPORTUNITY_TYPES.includes(t as OpportunityType)) : [];
  const rawSegments = Array.isArray(b.target_segments) ? (b.target_segments as unknown[]).map((x) => s(x, 40)) : s(b.target_segments, 240).split(',');
  const target_segments = [...new Set(rawSegments.map((x) => x.trim()).filter(Boolean))].slice(0, 8);
  const email = s(b.email, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('That email does not look right');
  const o = (b.offer ?? {}) as Record<string, unknown>;
  const proof = s(o.proof_url, 300);
  const offer: Offer = {
    sells: s(o.sells, 240) || undefined,
    for_who: s(o.for_who, 120) || undefined,
    problem: s(o.problem, 240) || undefined,
    price_band: s(o.price_band, 60) || undefined,
    proof_url: proof && /^https?:\/\//i.test(proof) ? proof : undefined,
  };
  return {
    name,
    offer,
    email: email || undefined,
    target_segments,
    target_area: s(b.target_area, 80) || s(b.location, 80) || undefined,
    headline: s(b.headline, 160) || undefined,
    location: s(b.location, 80) || undefined,
    timezone: s(b.timezone, 60) || 'UTC',
    goal: { title: goalTitle, metric, unit: s(g.unit, 12) || undefined, target_value: n(g.target_value), current_value: n(g.current_value), horizon_days: n(g.horizon_days) ?? 90 },
    capacity,
    hunt_types: hunt.length ? hunt : [...OPPORTUNITY_TYPES],
    notes: s(b.notes, 1000) || undefined,
  };
}

export async function completeOnboarding(input: OnboardingInput): Promise<string> {
  const db = copilotDb();
  const { data: profile, error } = await db
    .from('copilot_profiles')
    .insert({
      name: input.name, email: input.email ?? null, headline: input.headline ?? null, location: input.location ?? null, timezone: input.timezone ?? 'UTC',
      capacity: input.capacity, hunt_types: input.hunt_types, target_segments: input.target_segments, target_area: input.target_area ?? null, offer: input.offer,
      onboarding_complete: true, last_seen_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  const pid = profile.id as string;

  await db.from('copilot_goals').insert({
    profile_id: pid, title: input.goal.title, metric: input.goal.metric ?? 'none', unit: input.goal.unit ?? null,
    target_value: input.goal.target_value ?? null, current_value: input.goal.current_value ?? 0, horizon_days: input.goal.horizon_days ?? 90, priority: 1,
  });

  const facts: Array<{ kind: string; content: string; weight?: number }> = [];
  if (input.headline) facts.push({ kind: 'fact', content: `What I do: ${input.headline}`, weight: 1.5 });
  if (input.location) facts.push({ kind: 'fact', content: `Based in ${input.location}` });
  facts.push({ kind: 'preference', content: `Hunting for: ${input.hunt_types.join(', ')}` });
  if (input.target_segments.length) facts.push({ kind: 'preference', content: `Sells to: ${input.target_segments.join(', ')}${input.target_area ? ` in ${input.target_area}` : ''}`, weight: 1.5 });
  const offerLine = [input.offer.sells && `I sell ${input.offer.sells}`, input.offer.for_who && `to ${input.offer.for_who}`, input.offer.problem && `— the problem it solves: ${input.offer.problem}`].filter(Boolean).join(' ');
  if (offerLine) facts.push({ kind: 'fact', content: offerLine, weight: 1.6 });
  if (input.notes) facts.push({ kind: 'fact', content: input.notes, weight: 1.4 });
  for (const f of facts) await addContextItem(pid, { source: 'onboarding', ...f });

  await ensureSources(pid);
  await logEvent(pid, 'onboarding_complete', { capacity: input.capacity, hunt_types: input.hunt_types });

  // Supply that costs nothing per run, so the first brief has real candidates to
  // rank. Google Maps is excluded here: it spends scraping credits and belongs
  // to the daily run and the explicit "Find new matches" tap.
  try { await runSupply(pid, { only: ['hunter', 'remote'], reason: 'onboarding', limit: 25 }); }
  catch (err) { console.error('[copilot] onboarding supply failed:', err); }
  try {
    await runBrief(pid, { reason: 'onboarding' });
  } catch (err) {
    console.error('[copilot] first brief failed:', err);
  }
  return pid;
}
