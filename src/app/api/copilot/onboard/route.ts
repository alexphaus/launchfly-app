import { NextResponse } from 'next/server';
import { completeOnboarding, parseOnboarding } from '@/lib/copilot/onboarding';
import { setSessionCookie } from '@/lib/copilot/session';
import { NO_STORE, fail, readJson } from '@/lib/copilot/http';
import { clientIp, rateLimit } from '@/lib/copilot/limits';
import { currentProfileId } from '@/lib/copilot/session';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  // A device that already has a copilot must not create a second one by accident.
  if (await currentProfileId()) return fail('This device already has a copilot. Use "Forget device" first.', 409);
  // Each onboarding runs supply and a brief, so it is rate limited per network.
  const rl = await rateLimit(`onboard:ip:${clientIp(req)}`, 5, 60 * 60);
  if (!rl.ok) return fail('Too many sign-ups from this network. Try again in an hour.', 429);
  let input;
  try { input = parseOnboarding(await readJson(req)); } catch (e) { return fail(e instanceof Error ? e.message : 'Invalid input'); }
  try {
    const pid = await completeOnboarding(input);
    const res = NextResponse.json({ ok: true, profileId: pid }, { headers: NO_STORE });
    setSessionCookie(res, pid);
    return res;
  } catch (e) {
    console.error('[copilot] onboarding failed', e);
    return fail('Could not create your copilot. Check the database migration and try again.', 500);
  }
}
