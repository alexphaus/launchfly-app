import { runBrief } from '@/lib/copilot/brief';
import { isFoundBy } from '@/lib/copilot/offer';
import { loadHome, setOffer } from '@/lib/copilot/store';
import type { Offer } from '@/lib/copilot/types';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
// Saving the offer may rewrite the queue and rebuild the brief.
export const maxDuration = 90;
const s = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** What you sell, who for, the problem, the price band, one proof link, and how buyers find you. Drives every drafted message. */
export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const url = s(b.proof_url)?.trim();
  if (url && !/^https?:\/\//i.test(url)) return fail('The proof link needs to start with http:// or https://');
  // How buyers find you rides along when the sheet sends it, and is kept as it was when it does not.
  const offer: Offer = { sells: s(b.sells), for_who: s(b.for_who), problem: s(b.problem), price_band: s(b.price_band), proof_url: url, found_by: isFoundBy(b.found_by) ? b.found_by : undefined };
  // The bet this version was written for, kept in the offer's history. An id
  // in the shape the bets have, or none: it is a reference, never text.
  const bet = typeof b.bet === 'string' && /^\d{1,20}$/.test(b.bet) ? b.bet : null;
  let rewritten = 0;
  try {
    ({ rewritten } = await setOffer(auth.pid, offer, { bet }));
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save your offer', 500);
  }
  // The brief ranks and drafts from the offer, so a material change deserves a
  // fresh one now rather than tomorrow. Best effort: the save already landed.
  try { await runBrief(auth.pid, { reason: 'offer' }); } catch (e) { console.error('[copilot] brief after offer failed', e); }
  return json({ ok: true, rewritten, home: await loadHome(auth.pid) });
}
