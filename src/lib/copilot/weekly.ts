// src/lib/copilot/weekly.ts
// Once a week, on the profile's Monday: what the market in front of them kept
// asking for. One insight row of kind 'weekly' and one push. Idempotent per ISO
// week, so a cron that runs twice writes once.

import { copilotDb, todayIso } from './db';
import { diagnose, isoWeekKey, type Diagnosis } from './diagnose';
import { sendPush } from './push';
import { getProfile, loadDiagnosisRows } from './store';
import type { Metrics } from './types';

export const WEEKLY_EYEBROW = "This week's market";

/** ISO weekday (1 = Monday … 7 = Sunday) for `now` in the given timezone. */
export function weekdayIn(timezone: string, now = new Date()): number {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(now);
    const i = names.indexOf(s);
    if (i >= 0) return i + 1;
  } catch { /* bad tz falls through */ }
  return now.getUTCDay() || 7;
}

/**
 * The weekly read. Null when there is nothing recurring — sending "0 things"
 * would be filler, and the tab already explains an empty list.
 */
export function composeWeekly(
  d: Pick<Diagnosis, 'demand' | 'segments'>,
  m: Pick<Metrics, 'sent' | 'replies'>,
): { body: string; push: { title: string; body: string } } | null {
  if (!d.demand.length) return null;
  const top = d.demand.slice(0, 3);
  const businesses = d.segments.reduce((n, s) => n + s.businesses, 0);
  const label = (t: (typeof top)[number]) => {
    const where = t.segments[0] ? `, mostly ${t.segments[0].segment}` : '';
    const move = t.trend === 'new' ? ' — new this week' : t.trend === 'rising' ? ' — rising' : t.trend === 'falling' ? ' — fading' : '';
    return `${t.term} (${t.count}${where}${move})`;
  };
  const lines = top.map((t, i) => `${i + 1}. ${label(t)}`).join('\n');
  const tail = m.sent > 0
    ? `You sent ${m.sent} and got ${m.replies} ${m.replies === 1 ? 'reply' : 'replies'} in the last 30 days.`
    : 'Nothing has gone out yet — the queue on Today is where this becomes a pipeline.';
  const body = `Across ${businesses} real ${businesses === 1 ? 'business' : 'businesses'} in your segments, the wants your offer does not cover:\n${lines}\n\nEither add one to what you sell, or stop matching on the segments that need it. ${tail}`;
  const title = `${top.length} ${top.length === 1 ? 'thing' : 'things'} ${businesses} businesses in your segments keep asking for`;
  return { body, push: { title, body: top.map((t) => t.term).join(' · ') } };
}

/**
 * Write this week's Signals read for one profile and push it. Skips unless it
 * is Monday in the profile's timezone (or `force`), and never writes the same
 * ISO week twice.
 */
export async function runWeeklySignals(profileId: string, opts: { now?: Date; force?: boolean } = {}): Promise<{ wrote: boolean; reason?: string }> {
  const now = opts.now ?? new Date();
  const profile = await getProfile(profileId);
  if (!profile) return { wrote: false, reason: 'no profile' };
  if (!opts.force && weekdayIn(profile.timezone, now) !== 1) return { wrote: false, reason: 'not monday' };

  const db = copilotDb();
  const week = isoWeekKey(now);
  // Same week already written? The cron can fire more than once.
  const { data: recent } = await db.from('copilot_insights').select('id, for_date').eq('profile_id', profileId).eq('kind', 'weekly').order('for_date', { ascending: false }).limit(1).maybeSingle();
  if (recent && isoWeekKey(new Date(`${recent.for_date}T00:00:00Z`)) === week) return { wrote: false, reason: 'already written' };

  const rows = await loadDiagnosisRows(profileId);
  const d = diagnose({ ...rows, offer: profile.offer ?? {}, targetSegments: profile.target_segments, now });
  const { data: metrics } = await db.from('copilot_executions').select('approval_state, sent_at').eq('profile_id', profileId).eq('approval_state', 'sent').gte('sent_at', new Date(now.getTime() - 30 * 86_400_000).toISOString());
  const { data: replies } = await db.from('copilot_outcomes').select('id').eq('profile_id', profileId).eq('kind', 'reply').gte('occurred_at', new Date(now.getTime() - 30 * 86_400_000).toISOString());
  const composed = composeWeekly(d, { sent: metrics?.length ?? 0, replies: replies?.length ?? 0 });
  if (!composed) return { wrote: false, reason: 'no demand' };

  await db.from('copilot_insights').insert({
    profile_id: profileId, kind: 'weekly', for_date: todayIso(profile.timezone), eyebrow: WEEKLY_EYEBROW, body: composed.body, reasoning: null,
  });
  await sendPush(profileId, { ...composed.push, url: '/copilot?tab=signals', tag: `weekly-${week}` });
  return { wrote: true };
}
