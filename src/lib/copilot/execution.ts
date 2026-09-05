// src/lib/copilot/execution.ts
// "AI drafted" → "AI done". An execution is a send-ready draft tied to an action
// and an opportunity. Nothing leaves without the user tapping Approve & send.
// Channels reuse Launchfly's existing WhatsApp provider and Resend.

import { Resend } from 'resend';
import { getWhatsAppProvider } from '@/lib/whatsapp-provider';
import { copilotDb, todayIso } from './db';
import { getProfile, logEvent, setActionStatus } from './base';
import { limitsFor } from './plans';
import type { Channel, Execution, Opportunity, Profile } from './types';

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
    title: `Follow-up to ${name}, ready to review`,
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
