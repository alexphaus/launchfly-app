// src/lib/email-health/preflight.ts
import dns from 'dns';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';
import { currentCapFor } from './ramp';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const resolveTxt = promisify(dns.resolveTxt);

export async function checkDnsAuth(domain: string): Promise<{ spf: boolean; dkim: boolean; dmarc: boolean }> {
  // Allow override via env for environments without DNS access
  if (process.env.SKIP_DNS_CHECKS === 'true') {
    return { spf: true, dkim: true, dmarc: true };
  }

  const result = { spf: false, dkim: false, dmarc: false };
  try {
    const spfRecords = await resolveTxt(domain);
    result.spf = spfRecords.some((chunks) => chunks.join('').toLowerCase().startsWith('v=spf1'));
  } catch {}

  try {
    const dmarcRecords = await resolveTxt(`_dmarc.${domain}`);
    result.dmarc = dmarcRecords.some((chunks) => chunks.join('').toLowerCase().startsWith('v=dmarc1'));
  } catch {}

  // DKIM is usually selector-specific. We accept presence of any common selectors if configured.
  const selectors = (process.env.DKIM_SELECTORS || 'default,selector1,selector2').split(',');
  for (const sel of selectors) {
    const name = `${sel}._domainkey.${domain}`;
    try {
      const dkimTxt = await resolveTxt(name);
      if (dkimTxt.some((chunks) => chunks.join('').toLowerCase().includes('v=dkim1'))) {
        result.dkim = true;
        break;
      }
    } catch {}
  }

  return result;
}

export async function canSendToday(businessId: string): Promise<{ allowed: boolean; remaining: number; cap: number }> {
  const stageCap = await currentCapFor(businessId);
  const baseCap = parseInt(process.env.DAILY_SEND_CAP || '10', 10);
  const cap = Math.min(stageCap, baseCap);

  // Count sends in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', since);

  const sent = count || 0;
  const remaining = Math.max(0, cap - sent);
  return { allowed: remaining > 0, remaining, cap };
}


