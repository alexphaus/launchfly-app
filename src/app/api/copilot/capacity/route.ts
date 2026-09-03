import { loadHome, setCapacity } from '@/lib/copilot/store';
import { CAPACITY_META, type Capacity } from '@/lib/copilot/types';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { capacity } = await readJson(req);
  if (!(Object.keys(CAPACITY_META) as Capacity[]).includes(capacity as Capacity)) return fail('Unknown capacity');
  await setCapacity(auth.pid, capacity as Capacity);
  return json({ ok: true, home: await loadHome(auth.pid) });
}
