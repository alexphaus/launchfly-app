import { loadHome, setOffer } from '@/lib/copilot/store';
import type { Offer } from '@/lib/copilot/types';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
const s = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** What you sell, who for, the problem, the price band, one proof link. Drives every drafted message. */
export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const url = s(b.proof_url)?.trim();
  if (url && !/^https?:\/\//i.test(url)) return fail('The proof link needs to start with http:// or https://');
  const offer: Offer = { sells: s(b.sells), for_who: s(b.for_who), problem: s(b.problem), price_band: s(b.price_band), proof_url: url };
  await setOffer(auth.pid, offer);
  return json({ ok: true, home: await loadHome(auth.pid) });
}
