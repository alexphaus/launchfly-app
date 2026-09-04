// src/lib/copilot/execution.ts
// "AI drafted" → "AI done". An execution is a send-ready draft tied to an action
// and an opportunity. Nothing leaves without the user tapping Approve & send.
// Channels reuse Launchfly's existing WhatsApp provider and Resend.

import { Resend } from 'resend';
import { getWhatsAppProvider } from '@/lib/whatsapp-provider';
import { copilotDb, todayIso } from './db';
import { getProfile, logEvent, setActionStatus } from './base';
import type { Channel, Execution, Opportunity, Profile } from './types';

export function channelsConfigured(profile?: Pick<Profile, 'linked_business_id'> | null): { whatsapp: boolean; email: boolean } {
  const envWhatsApp =
    !!(process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN) ||
    !!(process.env.EVOLUTION_BASE_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE);
  return {
    whatsapp: envWhatsApp || !!profile?.linked_business_id,
    email: !!process.env.RESEND_API_KEY && !!(process.env.COPILOT_EMAIL_FROM || process.env.FROM_EMAIL),
  };
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

export async function getExecution(profileId: string, id: string): Promise<Execution | null> {
  const { data } = await copilotDb().from('copilot_executions').select('*').eq('id', id).eq('profile_id', profileId).maybeSingle();
  return (data as Execution | null) ?? null;
}

export async function executionsForActions(profileId: string, actionIds: string[]): Promise<Record<string, Execution>> {
  if (!actionIds.length) return {};
  const { data } = await copilotDb().from('copilot_executions').select('*').eq('profile_id', profileId).in('action_id', actionIds).order('created_at', { ascending: false });
  const out: Record<string, Execution> = {};
  for (const e of (data ?? []) as Execution[]) if (e.action_id && !out[e.action_id]) out[e.action_id] = e;
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
  await db.from('copilot_executions').update({ approval_state: 'approved', body, subject: subject ?? null }).eq('id', exec.id);

  let sent = false; let provider = ''; let externalId: string | undefined; let error: string | undefined;
  try {
    if (exec.channel === 'whatsapp') {
      const wa = await getWhatsAppProvider(profile.linked_business_id ?? undefined);
      provider = wa.name;
      const r = await wa.sendWhatsApp(exec.recipient, body, profile.linked_business_id ?? undefined);
      sent = r.sent; externalId = r.id; error = r.error;
    } else {
      const from = process.env.COPILOT_EMAIL_FROM || process.env.FROM_EMAIL;
      if (!process.env.RESEND_API_KEY || !from) throw new Error('Email is not configured (RESEND_API_KEY, COPILOT_EMAIL_FROM)');
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
    if (exec.action_id) await setActionStatus(profileId, exec.action_id, 'done');
    await logEvent(profileId, 'execution_sent', { execution_id: exec.id, channel: exec.channel, opportunity_id: exec.opportunity_id });
    await scheduleFollowUp(profile, updated as Execution);
  } else {
    await logEvent(profileId, 'execution_failed', { execution_id: exec.id, channel: exec.channel, error });
  }
  return updated as Execution;
}

export async function cancelExecution(profileId: string, executionId: string) {
  await copilotDb().from('copilot_executions').update({ approval_state: 'cancelled' }).eq('id', executionId).eq('profile_id', profileId).in('approval_state', ['needs_approval', 'approved', 'failed']);
}

/** After a send: a nudge in 3 days and a drafted follow-up the user can approve then. */
async function scheduleFollowUp(profile: Profile, exec: Execution) {
  if (!exec.opportunity_id) return;
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
    ai_draft: followUpTemplate(name, firstName, exec.channel),
  }).select('id').single();
  if (action) await createDraftExecution(profile.id, { actionId: action.id, opportunityId: opp.id, channel: exec.channel, body: followUpTemplate(name, firstName, exec.channel), subject: exec.subject ? `Re: ${exec.subject}` : undefined });
}

export function followUpTemplate(name: string, firstName: string, channel: Channel): string {
  const greet = channel === 'whatsapp' ? `Hi ${name}, ` : `Hi ${name},\n\n`;
  return `${greet}quick follow-up on my note from a few days ago. Happy to show you a 2-minute example of what I meant, no strings. Worth a 10-minute call this week?${channel === 'whatsapp' ? ' — ' : '\n\n'}${firstName}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
