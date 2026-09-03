import { loadHome, touchProfile } from '@/lib/copilot/store';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const home = await loadHome(auth.pid);
  if (!home) return fail('Profile not found', 404);
  void touchProfile(auth.pid);
  return json(home);
}
