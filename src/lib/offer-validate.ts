// src/lib/offer-validate.ts
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { sendEmailBatch } from '@/lib/senders/resend';
import { getProspects } from '@/lib/prospects';
import { emit, Event } from '@/lib/events';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function validateOffer({ businessId, niche, variantA, variantB, count = 10 }:
  { businessId: string; niche: string; variantA: string; variantB: string; count?: number }) {
  const prospects = (await getProspects(niche)).slice(0, Math.max(5, Math.min(10, count)));

  const campaignId = randomUUID();
  await supabase.from('campaigns').insert({ id: campaignId, business_id: businessId, name: 'Offer validation', created_at: new Date().toISOString() });

  const buildHtmlA = (p: { name: string }) => `<div>Hi ${p.name}, ${variantA}</div>`;
  const buildHtmlB = (p: { name: string }) => `<div>Hi ${p.name}, ${variantB}</div>`;

  const half = Math.ceil(prospects.length / 2);
  await sendEmailBatch({ businessId, campaignId, prospects: prospects.slice(0, half), buildHtml: buildHtmlA, subject: 'Quick question' });
  await sendEmailBatch({ businessId, campaignId, prospects: prospects.slice(half), buildHtml: buildHtmlB, subject: 'Quick question' });

  await emit(Event.EmailBatchSent, { businessId, campaignId });

  // After 24h evaluate basic clicks/replies
  return { campaignId };
}


