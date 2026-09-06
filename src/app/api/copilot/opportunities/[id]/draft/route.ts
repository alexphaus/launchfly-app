import { copilotDb } from '@/lib/copilot/db';
import { draftOpener, openDraftForOpportunity, recipientFor } from '@/lib/copilot/execution';
import { offerIsEmpty } from '@/lib/copilot/offer';
import { getProfile, loadHome, logEvent } from '@/lib/copilot/store';
import type { Channel, Opportunity } from '@/lib/copilot/types';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';

/** On-demand: draft an opener for one opportunity and put it on today's plan, send-ready. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const { id } = await ctx.params;
  const b = await readJson(req);
  const db = copilotDb();
  const [profile, { data: opp }] = await Promise.all([
    getProfile(auth.pid),
    db.from('copilot_opportunities').select('*').eq('id', id).eq('profile_id', auth.pid).maybeSingle(),
  ]);
  if (!profile || !opp) return fail('Not found', 404);
  const o = opp as Opportunity;

  // Nothing is drafted from a blank offer — the message would not be theirs.
  if (offerIsEmpty(profile.offer)) return fail('Set your offer first — every draft is written from it.', 400);

  // Already drafted and still waiting? Send them to it rather than queueing a second message.
  const existing = await openDraftForOpportunity(auth.pid, o.id);
  if (existing) return json({ ok: true, actionId: existing.actionId, existing: true, home: await loadHome(auth.pid) });
  const channel: Channel = b.channel === 'email' ? 'email' : o.contact?.whatsapp ? 'whatsapp' : 'email';
  if (!recipientFor(o, channel)) return fail(`No ${channel} contact for this match`, 400);

  try {
    const { actionId, execution } = await draftOpener(profile, o, channel, { detail: `Drafted on request. Edit, then approve to send on ${channel}.` });
    await logEvent(auth.pid, 'draft_requested', { opportunity_id: o.id, channel });
    return json({ ok: true, actionId, execution, home: await loadHome(auth.pid) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not draft', 500);
  }
}
