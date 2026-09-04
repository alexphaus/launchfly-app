import { loadHome, setTargeting } from '@/lib/copilot/store';
import { json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

/** Who you sell to and where. Drives the supply adapters. */
export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const segments = Array.isArray(b.target_segments) ? (b.target_segments as unknown[]).filter((x): x is string => typeof x === 'string')
    : typeof b.target_segments === 'string' ? b.target_segments.split(',') : undefined;
  await setTargeting(auth.pid, { target_segments: segments?.map((x) => x.slice(0, 40)), target_area: typeof b.target_area === 'string' ? b.target_area.slice(0, 80) : undefined });
  return json({ ok: true, home: await loadHome(auth.pid) });
}
