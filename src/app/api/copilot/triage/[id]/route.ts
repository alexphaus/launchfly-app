import { copilotDb } from '@/lib/copilot/db';
import { draftOpener, openDraftForOpportunity, recipientFor } from '@/lib/copilot/execution';
import { offerIsEmpty } from '@/lib/copilot/offer';
import { getProfile, loadHome, logEvent, setOpportunityStatus } from '@/lib/copilot/store';
import type { Channel, Opportunity } from '@/lib/copilot/types';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

/**
 * One card, one answer.
 *
 * Composes the existing draft and status routes rather than replacing them, and
 * adds the one thing neither records: that this decision came from triage, on
 * this segment. A dismissed opportunity could have been dismissed from
 * anywhere; only this event knows it was a swipe, which is what makes the keep
 * rate mean something.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const { action } = await readJson(req);
  if (action !== 'draft' && action !== 'skip') return fail('Unknown action');

  const db = copilotDb();
  const [profile, { data: opp }] = await Promise.all([
    getProfile(auth.pid),
    db.from('copilot_opportunities').select('*').eq('id', id).eq('profile_id', auth.pid).maybeSingle(),
  ]);
  if (!profile || !opp) return fail('Not found', 404);
  const o = opp as Opportunity;
  const segment = typeof o.data?.segment === 'string' ? o.data.segment
    : typeof o.data?.service_type === 'string' ? o.data.service_type
    : typeof o.data?.category === 'string' ? o.data.category : null;

  if (action === 'skip') {
    await setOpportunityStatus(auth.pid, id, 'dismissed');
  } else {
    // Same gate as the draft route: nothing is written from a blank offer.
    if (offerIsEmpty(profile.offer)) return fail('Set your offer first — every draft is written from it.', 400);
    const existing = await openDraftForOpportunity(auth.pid, o.id);
    if (!existing) {
      const channel: Channel = o.contact?.whatsapp ? 'whatsapp' : 'email';
      if (!recipientFor(o, channel)) return fail('No contact for this match', 400);
      await draftOpener(profile, o, channel, { detail: 'Kept from triage.' });
    }
  }

  // Recorded whichever way it went. A keep rate built only from keeps is not a
  // rate, and a stack that only learns from yes learns nothing about no.
  await logEvent(auth.pid, 'triage_answered', { opportunity_id: id, action, segment });
  return json({ ok: true, home: await loadHome(auth.pid) });
}
