// src/app/api/copilot/proposals/route.ts
// The person's answer to what Claude proposed: keep it, or drop it
// (lib/copilot/proposals.ts). Keeping is the person's own write, held again to
// the rule their own entry meets — a conversation is normalizeTalk's, a test is
// normalizeShelf's and its refusals — against the record as it stands now, not
// as it stood when Claude proposed it. Changing one first is the conversation
// sheet's own save (the lab route), which ends the proposal it was opened from.

import { betPrice, countRefusal, LAB_SHELF, LAB_TALK, normalizeShelf, normalizeTalk, shelfRefusal } from '@/lib/copilot/lab';
import { salesCurrency } from '@/lib/copilot/metrics';
import { foundOf } from '@/lib/copilot/proof';
import { openProposals } from '@/lib/copilot/proposals';
import { claimProposal, insertLabEvent, loadHome, loadProposals, unclaimProposal } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const id = typeof b.id === 'string' ? b.id : '';
  if (b.action !== 'keep' && b.action !== 'drop') return fail('Keep it or drop it?');
  try {
    const home = await loadHome(auth.pid);
    if (!home) return fail('Not found', 404);
    const stored = await loadProposals(auth.pid);
    if (stored.unreadable) return fail(`What Claude proposed could not be read just now: ${stored.unreadable}`);
    const p = openProposals(stored.rows, home.recent.today).find((x) => x.id === id);
    // Already answered — a second tap, or the other phone — is not an error to show: the screen catches up.
    if (!p) return json({ ok: true, home });
    if (b.action === 'drop') {
      await claimProposal(auth.pid, id, 'dropped');
      return json({ ok: true, home: await loadHome(auth.pid) });
    }

    // Kept: checked again, as the person's own, before the claim is spent.
    let write: { type: typeof LAB_TALK | typeof LAB_SHELF; payload: Record<string, unknown> };
    if (p.kind === 'talk') {
      const v = normalizeTalk({ ...p.talk, via: null }, home.recent.today);
      if (!v.ok) return fail(v.error);
      write = { type: LAB_TALK, payload: { ...v.value } };
    } else {
      if (home.lab?.unreadable) return fail(`Your shelf could not be read just now, so nothing can be kept on it safely: ${home.lab.unreadable}`);
      const v = normalizeShelf({ ...p.test }, { today: home.recent.today, ...betPrice(home.profile.offer?.price_band, salesCurrency(home.profile.finance, home.goals)) });
      if (!v.ok) return fail(v.error);
      const off = countRefusal(v.value.metric, v.value.tries, foundOf(home).value);
      if (off) return fail(off);
      const no = shelfRefusal(home.lab?.shelf ?? [], v.value);
      if (no) return fail(no);
      write = { type: LAB_SHELF, payload: { ...v.value } };
    }
    // Claimed first, so two taps keep it once; put back if the write does not
    // save, so it waits again rather than vanishing unkept (invariant 13).
    if (!(await claimProposal(auth.pid, id, 'kept'))) return json({ ok: true, home: await loadHome(auth.pid) });
    try {
      await insertLabEvent(auth.pid, write.type, write.payload);
    } catch (e) {
      await unclaimProposal(auth.pid, id);
      throw e;
    }
    return json({ ok: true, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not answer that', 500);
  }
}
