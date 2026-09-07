import { createPortalSession } from '@/lib/copilot/billing';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';
import { toShell } from '@/lib/copilot/shell';
import { getProfile } from '@/lib/copilot/store';

export const runtime = 'nodejs';

/** Stripe-hosted billing portal: change card, switch plan, cancel. */
export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const shell = toShell((await readJson(req)).shell);
  const profile = await getProfile(auth.pid);
  if (!profile) return fail('Not found', 404);
  if (!profile.stripe_customer_id) return fail('No subscription to manage yet', 400);
  try {
    return json({ ok: true, url: await createPortalSession(profile, shell) });
  } catch (e) {
    console.error('[copilot] portal failed', e);
    return fail('Could not open the billing portal.', 502);
  }
}
