import { openerTemplate } from '@/lib/copilot/agent/starter';
import { copilotDb, todayIso } from '@/lib/copilot/db';
import { createDraftExecution, openDraftForOpportunity, recipientFor } from '@/lib/copilot/execution';
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

  // Already drafted and still waiting? Send them to it rather than queueing a second message.
  const existing = await openDraftForOpportunity(auth.pid, o.id);
  if (existing) return json({ ok: true, actionId: existing.actionId, existing: true, home: await loadHome(auth.pid) });
  const channel: Channel = b.channel === 'email' ? 'email' : o.contact?.whatsapp ? 'whatsapp' : 'email';
  if (!recipientFor(o, channel)) return fail(`No ${channel} contact for this match`, 400);

  const name = o.contact?.name || o.title;
  const draft = openerTemplate(profile, { title: o.title, summary: o.reason, contact: o.contact ?? {} }, channel);
  const { data: action, error } = await db.from('copilot_actions').insert({
    profile_id: auth.pid, kind: 'plan', owner: 'ai', minutes: 3, for_date: todayIso(profile.timezone), opportunity_id: o.id,
    title: `Opener to ${name}, ready to review`, detail: `Drafted on request. Edit, then approve to send on ${channel}.`, ai_draft: draft,
  }).select('id').single();
  if (error) return fail(error.message, 500);
  const exec = await createDraftExecution(auth.pid, { actionId: action.id, opportunityId: o.id, channel, body: draft });
  await logEvent(auth.pid, 'draft_requested', { opportunity_id: o.id, channel });
  return json({ ok: true, actionId: action.id, execution: exec, home: await loadHome(auth.pid) });
}
