import { createCheckoutSession } from '@/lib/copilot/billing';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';
import { rateLimit } from '@/lib/copilot/limits';
import { isPlanKey } from '@/lib/copilot/plans';
import { getProfile } from '@/lib/copilot/store';

export const runtime = 'nodejs';

/** Start a Stripe Checkout for a paid plan. Returns a url for the client to follow. */
export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const rl = await rateLimit(`copilot:checkout:${auth.pid}`, 20, 3600);
  if (!rl.ok) return fail('Too many checkout attempts. Try again in an hour.', 429);

  const b = await readJson(req);
  const plan = b.plan;
  if (!isPlanKey(plan) || plan === 'free') return fail('Pick a paid plan', 400);
  const period = b.period === 'yearly' ? 'yearly' : 'monthly';

  const profile = await getProfile(auth.pid);
  if (!profile) return fail('Not found', 404);

  try {
    return json({ ok: true, url: await createCheckoutSession(profile, plan, period) });
  } catch (e) {
    console.error('[copilot] checkout failed', e);
    return fail(e instanceof Error && /no stripe price/i.test(e.message) ? 'That plan is not on sale yet.' : 'Could not start checkout.', 502);
  }
}
