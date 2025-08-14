// src/lib/senders/resend.ts
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { canSendToday, checkDnsAuth } from '@/lib/email-health/preflight';
import { getSuppression, withComplianceHeaders } from '@/lib/email-health/compliance';
import { requiresFounderReview, requestApproval } from '@/lib/manual-override';
import { emit, Event } from '@/lib/events';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  campaignId: string;
  businessId: string;
};

export async function sendEmail({ to, subject, html, campaignId, businessId }: SendEmailInput) {
  const suppression = await getSuppression(to);
  if (suppression.suppressed) {
    await supabase.from('emails').insert({
      business_id: businessId,
      campaign_id: campaignId,
      to_email: to,
      subject,
      suppressed: true,
      created_at: new Date().toISOString()
    });
    return { id: null, status: 'suppressed' };
  }

  const token = Buffer.from(JSON.stringify({ email: to, businessId }), 'utf8').toString('base64url');
  const { headers, html: htmlWithCompliance } = withComplianceHeaders({ html, subject, businessId, unsubscribeToken: token });

  const { data, error } = await resend.emails.send({
    from: process.env.SENDER_EMAIL || 'noreply@launchfly.ai',
    to,
    subject,
    html: htmlWithCompliance,
    headers
  } as any);

  const emailRow = {
    business_id: businessId,
    campaign_id: campaignId,
    to_email: to,
    subject,
    provider: 'resend',
    provider_message_id: data?.id || null,
    created_at: new Date().toISOString()
  } as any;
  await supabase.from('emails').insert(emailRow);

  return { id: data?.id || null, status: error ? 'error' : 'sent', error };
}

type Prospect = { name: string; email: string; company?: string; source?: string };

export async function sendEmailBatch({ businessId, campaignId, prospects, buildHtml, subject }:
  { businessId: string; campaignId: string; prospects: Prospect[]; buildHtml: (p: Prospect) => string; subject: string }) {
  // Deliverability check: SPF/DKIM/DMARC must be present
  const sender = (process.env.SENDER_EMAIL || 'noreply@launchfly.ai');
  const domain = sender.split('@')[1];
  if (!domain) return { queued: 0, reason: 'invalid_sender' };
  const auth = await checkDnsAuth(domain);
  if (!auth.spf || !auth.dkim || !auth.dmarc) {
    await supabase.from('ai_activities').insert({
      business_id: businessId,
      type: 'email.deliverability.blocked',
      message: 'Email blocked: DNS auth missing',
      metadata: { auth }
    });
    return { queued: 0, reason: 'dns_auth_missing' };
  }

  // Manual approval gate
  if (await requiresFounderReview(businessId)) {
    await requestApproval(businessId);
    return { queued: 0, reason: 'awaiting_manual_approval' };
  }

  const capInfo = await canSendToday(businessId);
  if (!capInfo.allowed) return { queued: 0, reason: 'cap_reached' };

  const maxToSend = Math.min(capInfo.remaining, prospects.length);
  let sent = 0;

  for (let i = 0; i < maxToSend; i++) {
    const p = prospects[i];
    const html = buildHtml(p);
    const jitterMs = 20000 + Math.floor(Math.random() * 40000); // 20-60s
    // Space out sends
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, jitterMs));
    // eslint-disable-next-line no-await-in-loop
    const res = await sendEmail({ to: p.email, subject, html, campaignId, businessId });
    sent += res.status === 'sent' ? 1 : 0;
  }

  // Update campaign stats via RPC if available
  try {
    await supabase.rpc('increment_campaign_stats', { p_campaign_id: campaignId, p_sent_inc: sent });
  } catch {}

  await emit(Event.EmailBatchSent, { businessId, campaignId, sent });

  return { queued: sent };
}


