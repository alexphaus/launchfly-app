// src/lib/copilot/execution.ts
// "AI drafted" → "AI done". An execution is a send-ready draft tied to an action
// and an opportunity. Nothing leaves without the user tapping Approve & send.
// Channels reuse Launchfly's existing WhatsApp provider and Resend.

import { Resend } from 'resend';
import { getWhatsAppProvider } from '@/lib/whatsapp-provider';
import { openerTemplate } from './agent/starter';
import { copilotDb, todayIso } from './db';
import { getProfile, logEvent, setActionStatus } from './base';
import { limitsFor } from './plans';
import type { Channel, Execution, Opportunity, Profile, QueueItem } from './types';

/** Follow-ups are titled this way so the offer cascade can leave them alone. */
export const FOLLOW_UP_TITLE_PREFIX = 'Follow-up to ';
/** States in which a draft is still the user's to send. */
export const OPEN_DRAFT_STATES = ['needs_approval', 'approved', 'failed'] as const;

/**
 * Whether THIS profile may send through the API on each channel.
 *
 * The rule that matters: a profile may only send through the API when it owns
 * the identity the message would go out under. WhatsApp needs its own linked
 * business (its own instance); email needs its own verified from address. The
 * server's env credentials are Launchfly's, not the user's — sending a friend's
 * cold outreach from them would impersonate the operator and put that number
 * and domain at risk. Everyone else sends by hand from their own app, which is
 * what `send_mode = 'manual'` is for.
 */
export function channelsConfigured(profile?: (Pick<Profile, 'linked_business_id' | 'send_mode' | 'email_from'> & Partial<Pick<Profile, 'plan' | 'plan_status'>>) | null): { whatsapp: boolean; email: boolean; mode: Profile['send_mode'] } {
  const mode = profile?.send_mode ?? 'manual';
  if (mode !== 'api') return { whatsapp: false, email: false, mode };
  return {
    whatsapp: !!profile?.linked_business_id,
    // Sending from the user's own address is a paid feature; the manual mailto
    // link is always available, so nobody is blocked from actually sending.
    email: !!process.env.RESEND_API_KEY && !!profile?.email_from && limitsFor(profile ?? {}).emailApi,
    mode,
  };
}

/** A link that opens the message pre-filled in the user's OWN WhatsApp or mail client. */
export function deepLink(exec: Pick<Execution, 'channel' | 'recipient' | 'subject' | 'body'>): string {
  if (exec.channel === 'whatsapp') {
    return `https://wa.me/${exec.recipient.replace(/\D/g, '')}?text=${encodeURIComponent(exec.body)}`;
  }
  const params = new URLSearchParams();
  if (exec.subject) params.set('subject', exec.subject);
  params.set('body', exec.body);
  return `mailto:${exec.recipient}?${params.toString()}`;
}

/** Attach the deep link so the client can offer "open in my WhatsApp" for unsent drafts. */
export function withDeepLink<T extends Pick<Execution, 'channel' | 'recipient' | 'subject' | 'body' | 'approval_state'>>(exec: T): T & { deep_link: string | null } {
  return { ...exec, deep_link: exec.approval_state === 'sent' || exec.approval_state === 'cancelled' ? null : deepLink(exec) };
}

export function recipientFor(opp: Pick<Opportunity, 'contact'>, channel: Channel): string | null {
  return (channel === 'whatsapp' ? opp.contact?.whatsapp : opp.contact?.email) || null;
}

/** Create a needs_approval execution for an action. Returns null when the opportunity has no contact on that channel. */
export async function createDraftExecution(
  profileId: string,
  input: { actionId: string; opportunityId: string; channel: Channel; body: string; subject?: string },
): Promise<Execution | null> {
  const db = copilotDb();
  const { data: opp } = await db.from('copilot_opportunities').select('id, contact, title').eq('id', input.opportunityId).eq('profile_id', profileId).maybeSingle();
  if (!opp) return null;
  const recipient = recipientFor(opp as Opportunity, input.channel);
  if (!recipient) return null;
  const { data, error } = await db.from('copilot_executions').insert({
    profile_id: profileId, action_id: input.actionId, opportunity_id: input.opportunityId, channel: input.channel,
    recipient, subject: input.subject ?? (input.channel === 'email' ? `Quick note for ${opp.title}` : null), body: input.body,
  }).select('*').single();
  if (error) throw error;
  return data as Execution;
}

/**
 * The action id of an open draft already targeting this opportunity, if any.
 * Drafting is idempotent: tapping "Draft WhatsApp" twice, or an agent run
 * re-proposing a match that already has a draft, must not produce two messages
 * queued for the same person.
 */
export async function openDraftForOpportunity(profileId: string, opportunityId: string): Promise<{ actionId: string; executionId: string } | null> {
  const { data } = await copilotDb()
    .from('copilot_executions')
    .select('id, action_id')
    .eq('profile_id', profileId).eq('opportunity_id', opportunityId)
    .in('approval_state', ['needs_approval', 'approved', 'failed'])
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();
  return data?.action_id ? { actionId: data.action_id, executionId: data.id } : null;
}

/**
 * Write an opener for one opportunity from the user's own offer and put it on
 * today's plan, send-ready. Deterministic: the template, not the model. Used by
 * the Draft button and by the rewrite that follows an offer change.
 */
export async function draftOpener(
  profile: Profile,
  opp: Pick<Opportunity, 'id' | 'title' | 'reason' | 'contact'>,
  channel: Channel,
  opts: { detail: string },
): Promise<{ actionId: string; execution: Execution | null }> {
  const db = copilotDb();
  const name = opp.contact?.name || opp.title;
  const draft = openerTemplate(profile, { title: opp.title, summary: opp.reason, contact: opp.contact ?? {} }, channel);
  const { data: action, error } = await db.from('copilot_actions').insert({
    profile_id: profile.id, kind: 'plan', owner: 'ai', minutes: 3, for_date: todayIso(profile.timezone), opportunity_id: opp.id,
    title: `Opener to ${name}, ready to review`, detail: opts.detail, ai_draft: draft,
  }).select('id').single();
  if (error) throw error;
  const execution = await createDraftExecution(profile.id, { actionId: action.id, opportunityId: opp.id, channel, body: draft });
  return { actionId: action.id, execution };
}

/**
 * Retire every open opener, or the ones for the given opportunities, recording
 * why. Follow-ups are never touched: they only use the proof link and are not
 * rewritten. The linked plan rows are dismissed so a stale "AI drafted" line
 * does not linger on Today until the next brief.
 */
export async function cancelOpenDrafts(
  profileId: string,
  opts: { reason: string; opportunityIds?: string[] },
): Promise<{ cancelled: number; opportunityIds: string[] }> {
  const db = copilotDb();
  if (opts.opportunityIds && !opts.opportunityIds.length) return { cancelled: 0, opportunityIds: [] };
  let q = db.from('copilot_executions').select('id, action_id, opportunity_id')
    .eq('profile_id', profileId).in('approval_state', [...OPEN_DRAFT_STATES]);
  if (opts.opportunityIds) q = q.in('opportunity_id', opts.opportunityIds);
  const { data: execs } = await q;
  const rows = (execs ?? []) as Array<{ id: string; action_id: string | null; opportunity_id: string | null }>;
  if (!rows.length) return { cancelled: 0, opportunityIds: [] };

  const actionIds = rows.map((r) => r.action_id).filter((x): x is string => !!x);
  const { data: actions } = actionIds.length
    ? await db.from('copilot_actions').select('id, title').in('id', actionIds)
    : { data: [] as Array<{ id: string; title: string }> };
  const followUpActionIds = new Set((actions ?? []).filter((a: { title: string }) => a.title.startsWith(FOLLOW_UP_TITLE_PREFIX)).map((a: { id: string }) => a.id));

  const targets = rows.filter((r) => !r.action_id || !followUpActionIds.has(r.action_id));
  if (!targets.length) return { cancelled: 0, opportunityIds: [] };

  await db.from('copilot_executions')
    .update({ approval_state: 'cancelled', cancel_reason: opts.reason })
    .in('id', targets.map((r) => r.id));
  const targetActionIds = targets.map((r) => r.action_id).filter((x): x is string => !!x);
  if (targetActionIds.length) {
    await db.from('copilot_actions').update({ status: 'dismissed' }).in('id', targetActionIds).eq('kind', 'plan').eq('status', 'open');
  }
  await logEvent(profileId, 'drafts_cancelled', { reason: opts.reason, count: targets.length });
  return { cancelled: targets.length, opportunityIds: [...new Set(targets.map((r) => r.opportunity_id).filter((x): x is string => !!x))] };
}

/**
 * Re-draft openers for opportunities whose drafts were just retired, so the
 * queue is full again the moment the offer is saved rather than three days
 * later. Only businesses still open and reachable; WhatsApp preferred.
 */
export async function regenerateOpeners(profile: Profile, opportunityIds: string[], max = 40): Promise<number> {
  if (!opportunityIds.length) return 0;
  const { data } = await copilotDb().from('copilot_opportunities')
    .select('id, title, reason, contact, score')
    .eq('profile_id', profile.id).in('id', opportunityIds).in('status', ['new', 'saved'])
    .order('score', { ascending: false }).limit(max);
  let written = 0;
  for (const o of (data ?? []) as Array<Pick<Opportunity, 'id' | 'title' | 'reason' | 'contact' | 'score'>>) {
    const channel: Channel | null = o.contact?.whatsapp ? 'whatsapp' : o.contact?.email ? 'email' : null;
    if (!channel) continue;
    if (await openDraftForOpportunity(profile.id, o.id)) continue;
    try {
      const r = await draftOpener(profile, o, channel, { detail: 'Rewritten from your offer. Edit, then send.' });
      if (r.execution) written += 1;
    } catch (e) { console.error('[copilot] regenerate opener failed', e); }
  }
  return written;
}

/**
 * Every draft still waiting to be sent, from any day, best match first. This is
 * what Today shows. It is built from executions because plan rows are per-day:
 * a draft from Tuesday that nobody sent used to vanish from view on Wednesday
 * while still blocking a fresh one.
 */
export async function loadSendQueue(profileId: string): Promise<QueueItem[]> {
  const db = copilotDb();
  const { data: execs } = await db.from('copilot_executions').select('*')
    .eq('profile_id', profileId).in('approval_state', [...OPEN_DRAFT_STATES])
    .order('created_at', { ascending: false });
  const rows = (execs ?? []) as Execution[];
  if (!rows.length) return [];

  const actionIds = rows.map((e) => e.action_id).filter((x): x is string => !!x);
  const oppIds = [...new Set(rows.map((e) => e.opportunity_id).filter((x): x is string => !!x))];
  const [{ data: actions }, { data: opps }] = await Promise.all([
    actionIds.length ? db.from('copilot_actions').select('*').in('id', actionIds) : Promise.resolve({ data: [] }),
    oppIds.length ? db.from('copilot_opportunities').select('id, title, contact, data, score').in('id', oppIds) : Promise.resolve({ data: [] }),
  ]);
  const actionById = new Map(((actions ?? []) as QueueItem[]).map((a) => [a.id, a]));
  const oppById = new Map(((opps ?? []) as Array<{ id: string; title: string; contact: Opportunity['contact']; data: Record<string, unknown>; score: number }>).map((o) => [o.id, o]));

  const out: QueueItem[] = [];
  for (const e of rows) {
    const a = e.action_id ? actionById.get(e.action_id) : undefined;
    if (!a) continue;                                   // an execution with no action row cannot be opened in the sheet
    const o = e.opportunity_id ? oppById.get(e.opportunity_id) : undefined;
    const d = (o?.data ?? {}) as Record<string, unknown>;
    const segment = [d.segment, d.service_type, d.category].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
    out.push({
      ...a,
      execution: withDeepLink(e),
      opp: o ? { id: o.id, title: o.title, name: o.contact?.name ?? null, segment: segment ?? null, score: o.score } : null,
    });
  }
  return out.sort((x, y) => (y.opp?.score ?? 0) - (x.opp?.score ?? 0) || y.execution.created_at.localeCompare(x.execution.created_at));
}

export async function getExecution(profileId: string, id: string): Promise<Execution | null> {
  const { data } = await copilotDb().from('copilot_executions').select('*').eq('id', id).eq('profile_id', profileId).maybeSingle();
  return (data as Execution | null) ?? null;
}

export async function executionsForActions(profileId: string, actionIds: string[]): Promise<Record<string, Execution>> {
  if (!actionIds.length) return {};
  const { data } = await copilotDb().from('copilot_executions').select('*').eq('profile_id', profileId).in('action_id', actionIds).order('created_at', { ascending: false });
  const out: Record<string, Execution> = {};
  for (const e of (data ?? []) as Execution[]) if (e.action_id && !out[e.action_id]) out[e.action_id] = withDeepLink(e);
  return out;
}

/** Approve and send. Optional overrides let the user edit the draft first. */
export async function sendExecution(profileId: string, executionId: string, overrides: { body?: string; subject?: string } = {}): Promise<Execution> {
  const db = copilotDb();
  const exec = await getExecution(profileId, executionId);
  if (!exec) throw new Error('Draft not found');
  if (!['needs_approval', 'approved', 'failed'].includes(exec.approval_state)) throw new Error(`Already ${exec.approval_state}`);
  const profile = await getProfile(profileId);
  if (!profile) throw new Error('profile not found');

  const body = (overrides.body ?? exec.body).trim();
  const subject = overrides.subject ?? exec.subject ?? undefined;
  if (!body) throw new Error('Message is empty');

  // Never send under an identity this profile does not own.
  const allowed = channelsConfigured(profile);
  if (!allowed[exec.channel]) {
    throw new Error(exec.channel === 'whatsapp'
      ? 'This copilot has no WhatsApp number of its own. Use "Open in WhatsApp" to send it yourself.'
      : 'This copilot has no verified sending address. Use "Open in email" to send it yourself.');
  }
  await db.from('copilot_executions').update({ approval_state: 'approved', body, subject: subject ?? null }).eq('id', exec.id);

  let sent = false; let provider = ''; let externalId: string | undefined; let error: string | undefined;
  try {
    if (exec.channel === 'whatsapp') {
      const wa = await getWhatsAppProvider(profile.linked_business_id ?? undefined);
      provider = wa.name;
      const r = await wa.sendWhatsApp(exec.recipient, body, profile.linked_business_id ?? undefined);
      sent = r.sent; externalId = r.id; error = r.error;
    } else {
      const from = profile.email_from;   // this profile's own verified sender, never the server's
      if (!process.env.RESEND_API_KEY || !from) throw new Error('No verified sending address for this copilot');
      provider = 'resend';
      const resend = new Resend(process.env.RESEND_API_KEY);
      const r = await resend.emails.send({ from, to: exec.recipient, subject: subject || 'Quick note', text: body });
      sent = !r.error; externalId = r.data?.id; error = r.error?.message;
    }
  } catch (e) {
    sent = false; error = e instanceof Error ? e.message : String(e);
  }

  const { data: updated } = await db.from('copilot_executions').update({
    approval_state: sent ? 'sent' : 'failed', provider, external_message_id: externalId ?? null, error: error ?? null,
    sent_at: sent ? new Date().toISOString() : null,
  }).eq('id', exec.id).select('*').single();

  if (sent) {
    await afterSend(profile, updated as Execution, 'api');
  } else {
    await logEvent(profileId, 'execution_failed', { execution_id: exec.id, channel: exec.channel, error });
  }
  return updated as Execution;
}

/**
 * The user opened the draft in their own WhatsApp or mail client and sent it.
 * Same bookkeeping as an API send — the loop does not care which hand pressed
 * the button, only that a message went out and a reply may follow.
 */
export async function markSentManually(profileId: string, executionId: string, overrides: { body?: string; subject?: string } = {}): Promise<Execution> {
  const db = copilotDb();
  const exec = await getExecution(profileId, executionId);
  if (!exec) throw new Error('Draft not found');
  if (exec.approval_state === 'sent') return exec;
  const profile = await getProfile(profileId);
  if (!profile) throw new Error('profile not found');
  const body = (overrides.body ?? exec.body).trim();
  if (!body) throw new Error('Message is empty');

  const { data: updated } = await db.from('copilot_executions').update({
    approval_state: 'sent', dispatch: 'manual', provider: 'manual', body,
    subject: overrides.subject ?? exec.subject ?? null, error: null, sent_at: new Date().toISOString(),
  }).eq('id', exec.id).select('*').single();

  await afterSend(profile, updated as Execution, 'manual');
  return updated as Execution;
}

async function afterSend(profile: Profile, exec: Execution, dispatch: 'api' | 'manual') {
  if (exec.action_id) await setActionStatus(profile.id, exec.action_id, 'done');
  await logEvent(profile.id, 'execution_sent', { execution_id: exec.id, channel: exec.channel, opportunity_id: exec.opportunity_id, dispatch });
  await scheduleFollowUp(profile, exec);
}

export async function cancelExecution(profileId: string, executionId: string) {
  await copilotDb().from('copilot_executions').update({ approval_state: 'cancelled' }).eq('id', executionId).eq('profile_id', profileId).in('approval_state', ['needs_approval', 'approved', 'failed']);
}

/** After a send: a nudge in 3 days and a drafted follow-up the user can approve then. */
async function scheduleFollowUp(profile: Profile, exec: Execution) {
  if (!exec.opportunity_id) return;
  if (!limitsFor(profile).followUps) return;   // paid feature; the send itself still happens
  const db = copilotDb();
  const { data: opp } = await db.from('copilot_opportunities').select('id, title, contact').eq('id', exec.opportunity_id).maybeSingle();
  if (!opp) return;
  const name = (opp.contact as Opportunity['contact'])?.name || opp.title;
  const followDate = addDays(todayIso(profile.timezone), 3);
  const firstName = profile.name.split(' ')[0];

  await db.from('copilot_actions').insert({
    profile_id: profile.id, kind: 'nudge', owner: 'you', urgency: 'normal', due_label: 'Follow up',
    title: `No reply from ${name} yet? A short follow-up on day 3 doubles response rates.`,
    opportunity_id: opp.id, for_date: followDate,
  });
  const { data: action } = await db.from('copilot_actions').insert({
    profile_id: profile.id, kind: 'plan', owner: 'ai', minutes: 3, for_date: followDate, opportunity_id: opp.id,
    title: `${FOLLOW_UP_TITLE_PREFIX}${name}, ready to review`,
    detail: 'Auto-drafted 3 days after your first message. Edit before sending if they replied elsewhere.',
    ai_draft: followUpTemplate(name, firstName, exec.channel, profile.offer?.proof_url),
  }).select('id').single();
  if (action) await createDraftExecution(profile.id, { actionId: action.id, opportunityId: opp.id, channel: exec.channel, body: followUpTemplate(name, firstName, exec.channel, profile.offer?.proof_url), subject: exec.subject ? `Re: ${exec.subject}` : undefined });
}

export function followUpTemplate(name: string, firstName: string, channel: Channel, proofUrl?: string | null): string {
  const greet = channel === 'whatsapp' ? `Hi ${name}, ` : `Hi ${name},\n\n`;
  const proof = proofUrl ? ` Here is an example of the kind of thing I mean: ${proofUrl}.` : ' Happy to show you a 2-minute example of what I meant, no strings.';
  return `${greet}quick follow-up on my note from a few days ago.${proof} Worth a 10-minute call this week?${channel === 'whatsapp' ? ' — ' : '\n\n'}${firstName}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
