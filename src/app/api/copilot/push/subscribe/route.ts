import { deleteSubscription, pushConfigured, saveSubscription, type PushSubscriptionInput } from '@/lib/copilot/push';
import { logEvent } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  if (!pushConfigured()) return fail('Push is not configured on this server', 503);
  const b = (await readJson(req)) as Partial<PushSubscriptionInput>;
  if (typeof b.endpoint !== 'string' || !b.keys || typeof b.keys.p256dh !== 'string' || typeof b.keys.auth !== 'string') return fail('Invalid subscription');
  await saveSubscription(auth.pid, { endpoint: b.endpoint, keys: { p256dh: b.keys.p256dh, auth: b.keys.auth } }, req.headers.get('user-agent'));
  await logEvent(auth.pid, 'push_subscribed');
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  if (typeof b.endpoint !== 'string') return fail('endpoint required');
  await deleteSubscription(auth.pid, b.endpoint);
  return json({ ok: true });
}
