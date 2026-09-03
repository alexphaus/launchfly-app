import { requestSource } from '@/lib/copilot/store';
import { SOURCE_KEYS, type SourceKey } from '@/lib/copilot/types';
import { fail, json, profileIdOr401 } from '@/lib/copilot/http';

export const runtime = 'nodejs';

/** Foundation only: records that the user wants this source connected. */
export async function POST(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { key } = await ctx.params;
  if (!SOURCE_KEYS.includes(key as SourceKey)) return fail('Unknown source');
  await requestSource(auth.pid, key as SourceKey);
  return json({ ok: true, status: 'requested' });
}
