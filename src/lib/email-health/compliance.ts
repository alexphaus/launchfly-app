// src/lib/email-health/compliance.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function getSuppression(email: string): Promise<{ suppressed: boolean; reason?: string }> {
  const { data } = await supabase
    .from('suppression_list')
    .select('email, reason')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  return { suppressed: !!data, reason: data?.reason };
}

export function withComplianceHeaders({ html, subject, businessId, unsubscribeToken }:
  { html: string; subject: string; businessId: string; unsubscribeToken: string }) {
  const listUnsubUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || ''}/api/unsubscribe/${unsubscribeToken}`;
  const physicalAddress = process.env.PHYSICAL_MAILING_ADDRESS || 'Launchfly, 548 Market St PMB 87532, San Francisco, CA 94104';
  const sender = process.env.SENDER_EMAIL || 'noreply@launchfly.ai';

  const headers = {
    'List-Unsubscribe': `<${listUnsubUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    From: `Launchfly <${sender}>`
  } as Record<string, string>;

  const footer = `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.6">
      You received this because we believe ${physicalAddress} this message is relevant to your business. 
      Unsubscribe anytime via <a href="${listUnsubUrl}">this link</a>.
      <div style="margin-top:8px;white-space:pre-wrap">${physicalAddress}</div>
    </div>
  `;

  const htmlWithFooter = html.includes('</body>')
    ? html.replace('</body>', `${footer}</body>`) 
    : `${html}${footer}`;

  return { headers, html: htmlWithFooter, subject };
}


