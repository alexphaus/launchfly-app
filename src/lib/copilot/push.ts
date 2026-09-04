// src/lib/copilot/push.ts
// Web Push for urgent nudges and replies. Silently disabled until VAPID keys are
// set (generate with: node scripts/copilot-vapid.mjs). Never throws.

import webpush from 'web-push';
import { copilotDb } from './db';

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.COPILOT_VAPID_PUBLIC_KEY;
  const priv = process.env.COPILOT_VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  try {
    webpush.setVapidDetails(process.env.COPILOT_VAPID_SUBJECT || 'mailto:copilot@example.com', pub, priv);
    return (configured = true);
  } catch (e) {
    console.error('[copilot/push] invalid VAPID config:', e);
    return (configured = false);
  }
}

export function vapidPublicKey(): string | null {
  return pushConfigured() ? process.env.COPILOT_VAPID_PUBLIC_KEY! : null;
}

export interface PushSubscriptionInput { endpoint: string; keys: { p256dh: string; auth: string } }

export async function saveSubscription(profileId: string, sub: PushSubscriptionInput, userAgent?: string | null) {
  await copilotDb().from('copilot_push_subscriptions').upsert(
    { profile_id: profileId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent ?? null },
    { onConflict: 'endpoint' },
  );
}

export async function deleteSubscription(profileId: string, endpoint: string) {
  await copilotDb().from('copilot_push_subscriptions').delete().eq('profile_id', profileId).eq('endpoint', endpoint);
}

export async function hasSubscription(profileId: string): Promise<boolean> {
  const { count } = await copilotDb().from('copilot_push_subscriptions').select('id', { count: 'exact', head: true }).eq('profile_id', profileId);
  return (count ?? 0) > 0;
}

export async function sendPush(profileId: string, payload: { title: string; body: string; url?: string; tag?: string }): Promise<{ sent: number }> {
  if (!pushConfigured()) return { sent: 0 };
  const db = copilotDb();
  const { data } = await db.from('copilot_push_subscriptions').select('endpoint, p256dh, auth').eq('profile_id', profileId);
  let sent = 0;
  for (const s of (data ?? []) as { endpoint: string; p256dh: string; auth: string }[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ url: '/copilot', ...payload }), { TTL: 3600 });
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.from('copilot_push_subscriptions').delete().eq('endpoint', s.endpoint);
      else console.error('[copilot/push] send failed:', e instanceof Error ? e.message : e);
    }
  }
  return { sent };
}
