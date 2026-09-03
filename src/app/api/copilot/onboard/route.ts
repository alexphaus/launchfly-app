import { NextResponse } from 'next/server';
import { completeOnboarding, parseOnboarding } from '@/lib/copilot/onboarding';
import { setSessionCookie } from '@/lib/copilot/session';
import { NO_STORE, fail, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
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
