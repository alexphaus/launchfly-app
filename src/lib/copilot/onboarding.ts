// src/lib/copilot/onboarding.ts
// Turns the three onboarding screens into a profile, a goal and the first
// context items, then runs the first brief.

import { copilotDb } from './db';
import { runBrief } from './brief';
import { addContextItem, ensureSources, logEvent, saveWatchSource } from './store';
import { runSupply } from './supply';
import { normalizeSourceUrl, type WatchIntent } from './watch/catalogue';
import { CAPACITY_META, OPPORTUNITY_TYPES, type Capacity, type GoalMetric, type Offer } from './types';

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
  notes?: string;
  /**
   * What the goal turned out to be about. Decides which half of screen three
   * they saw, and which starter feeds were offered.
   */
  intent?: WatchIntent;
  /** Sources to watch from the first night, chosen on screen three. */
  watch: Array<{ url: string; label?: string; intent?: string }>;
}

/** More than this at signup and the first nightly run is mostly model calls. */
export const MAX_ONBOARDING_SOURCES = 6;

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
  const watch: OnboardingInput['watch'] = [];
  for (const raw of (Array.isArray(b.watch) ? b.watch : []).slice(0, MAX_ONBOARDING_SOURCES)) {
    const w = (raw ?? {}) as Record<string, unknown>;
    const url = s(w.url, 600);
    if (url) watch.push({ url, label: s(w.label, 80) || undefined, intent: s(w.intent, 200) || undefined });
  }
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
    notes: s(b.notes, 1000) || undefined,
    intent: (['work', 'clients', 'sell', 'build'] as WatchIntent[]).includes(b.intent as WatchIntent) ? (b.intent as WatchIntent) : undefined,
    watch,
  };
}

export async function completeOnboarding(input: OnboardingInput): Promise<string> {
  const db = copilotDb();
  // Only the columns from the foundation migration go in the insert. Everything
  // added later is applied afterwards, tolerantly, because in this repo code and
  // schema deploy separately and always will: migrations are run by hand. A
  // column that has not landed yet must cost the feature that needs it, never
  // the account. This exact failure — PGRST204 on `offer` — left the live user
  // unable to create a copilot at all, which is the worst possible way to find
  // out that one file had not been pasted into the SQL editor.
  const { data: profile, error } = await db
    .from('copilot_profiles')
    .insert({
      name: input.name, email: input.email ?? null, headline: input.headline ?? null, location: input.location ?? null, timezone: input.timezone ?? 'UTC',
      // Still a column ranking reads, but no longer a question: five types that
      // all mean "somebody to message" is not a choice worth a screen when the
      // goal already said what this person is doing. Default to all and let
      // outcome affinity do the narrowing it was always better at.
      capacity: input.capacity, hunt_types: [...OPPORTUNITY_TYPES],
      onboarding_complete: true, last_seen_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  const pid = profile.id as string;

  await applyLaterColumns(pid, {
    target_segments: input.target_segments,   // 20260904
    target_area: input.target_area ?? null,   // 20260904
    offer: input.offer,                       // 20260905
  });

  await db.from('copilot_goals').insert({
    profile_id: pid, title: input.goal.title, metric: input.goal.metric ?? 'none', unit: input.goal.unit ?? null,
    target_value: input.goal.target_value ?? null, current_value: input.goal.current_value ?? 0, horizon_days: input.goal.horizon_days ?? 90, priority: 1,
  });

  const facts: Array<{ kind: string; content: string; weight?: number }> = [];
  if (input.headline) facts.push({ kind: 'fact', content: `What I do: ${input.headline}`, weight: 1.5 });
  if (input.location) facts.push({ kind: 'fact', content: `Based in ${input.location}` });
  if (input.target_segments.length) facts.push({ kind: 'preference', content: `Sells to: ${input.target_segments.join(', ')}${input.target_area ? ` in ${input.target_area}` : ''}`, weight: 1.5 });
  const offerLine = [input.offer.sells && `I sell ${input.offer.sells}`, input.offer.for_who && `to ${input.offer.for_who}`, input.offer.problem && `— the problem it solves: ${input.offer.problem}`].filter(Boolean).join(' ');
  if (offerLine) facts.push({ kind: 'fact', content: offerLine, weight: 1.6 });
  if (input.notes) facts.push({ kind: 'fact', content: input.notes, weight: 1.4 });
  for (const f of facts) await addContextItem(pid, { source: 'onboarding', ...f });

  await ensureSources(pid);
  await seedWatchSources(pid, input.watch);
  await logEvent(pid, 'onboarding_complete', { capacity: input.capacity, intent: input.intent ?? null, sources: input.watch.length });

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

/**
 * Write the columns that arrived after the foundation migration, one retry
 * apart: the batch first, then field by field if it fails, so a single missing
 * column does not take the others down with it. Never throws — the profile
 * already exists by this point, and losing the targeting is recoverable in the
 * app while losing the account is not.
 */
async function applyLaterColumns(profileId: string, fields: Record<string, unknown>): Promise<void> {
  const db = copilotDb();
  const { error } = await db.from('copilot_profiles').update(fields).eq('id', profileId);
  if (!error) return;
  console.error('[copilot] onboarding: later columns rejected, falling back field by field', error.message);
  for (const [key, value] of Object.entries(fields)) {
    const one = await db.from('copilot_profiles').update({ [key]: value }).eq('id', profileId);
    if (one.error) console.error(`[copilot] onboarding: could not set ${key} — ${one.error.message}. Its migration is probably unapplied.`);
  }
}

/**
 * Create the sources chosen on screen three.
 *
 * Normalised through the same function the Sources sheet uses, so "r/forhire"
 * becomes a feed URL in exactly one place. Never throws: the table arrives in a
 * migration run by hand, and an account that cannot be created because one SQL
 * file has not been pasted in yet is the worst failure this flow has — it has
 * happened once already, on `offer`.
 *
 * The sources are not READ here. Fetching and judging four feeds is four HTTP
 * requests and four model calls inside a POST somebody is waiting on, behind a
 * proxy whose real ceiling nobody has measured. They are read on the first
 * nightly run, and screen three says so rather than implying otherwise.
 */
async function seedWatchSources(profileId: string, watch: OnboardingInput['watch']): Promise<void> {
  for (const w of watch) {
    try {
      const norm = normalizeSourceUrl(w.url);
      if (!norm || norm.kind !== 'feed') continue;
      await saveWatchSource(profileId, { url: norm.url, label: w.label || norm.label, intent: w.intent, kind: 'feed' });
    } catch (err) {
      console.error(`[copilot] onboarding: could not watch ${w.url} —`, err instanceof Error ? err.message : err);
    }
  }
}
