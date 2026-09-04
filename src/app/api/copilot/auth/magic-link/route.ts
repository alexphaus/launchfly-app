import { appBaseUrl, requestMagicLink } from '@/lib/copilot/auth';
import { clientIp } from '@/lib/copilot/limits';
import { currentProfileId } from '@/lib/copilot/session';
import { fail, json, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

/** Email a one-time sign-in link. From inside the app it links the current profile. */
export async function POST(req: Request) {
  const b = await readJson(req);
  if (typeof b.email !== 'string') return fail('Email required');
  const profileId = await currentProfileId();
  const r = await requestMagicLink({ email: b.email, profileId, baseUrl: appBaseUrl(req), ip: clientIp(req) });
  if (!r.ok) return fail(r.error, r.status);
  return json({ ok: true });
}
