// src/lib/copilot/base.ts
// Lowest-level helpers shared by every copilot module. Nothing here imports
// another copilot module except db and types, so it can never form a cycle.

import { copilotDb } from './db';
import type { Action, Profile } from './types';

export async function getProfile(profileId: string): Promise<Profile | null> {
  const { data } = await copilotDb().from('copilot_profiles').select('*').eq('id', profileId).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function touchProfile(profileId: string) {
  await copilotDb().from('copilot_profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', profileId);
}

export async function logEvent(profileId: string, event_type: string, payload: Record<string, unknown> = {}) {
  await copilotDb().from('copilot_events').insert({ profile_id: profileId, event_type, payload });
}

const ACTION_EVENT: Record<Action['status'], string> = {
  done: 'action_done',
  dismissed: 'action_dismissed',
  open: 'action_reopened',
};

export async function setActionStatus(profileId: string, id: string, status: Action['status']) {
  const db = copilotDb();
  const { data } = await db.from('copilot_actions').update({ status }).eq('id', id).eq('profile_id', profileId).select('id, kind, owner, title').maybeSingle();
  if (!data) return null;
  await logEvent(profileId, ACTION_EVENT[status], { action_id: id, kind: data.kind, owner: data.owner, title: data.title });
  return data;
}
