// src/lib/events.ts
import { createClient } from '@supabase/supabase-js';
// Keep loose import to avoid circular issues
// @ts-ignore - dynamic import shape varies in repo
import { sendEvent } from '@/lib/inngest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const Event = {
  BusinessCreated: 'business.created',
  OfferValidated: 'offer.validated',
  OfferPivoted: 'offer.pivoted',
  CampaignLaunched: 'campaign.launched',
  EmailBatchSent: 'email.batch_sent',
  LeadClicked: 'lead.clicked',
  LeadReplied: 'lead.replied',
  PaymentSucceeded: 'payment.succeeded',
  MilestoneHit: 'milestone.hit'
} as const;

export async function emit(type: string, payload: any) {
  await supabase.from('ai_activities').insert({
    business_id: payload.businessId,
    type,
    message: type,
    metadata: payload
  });
  if (process.env.INNGEST_EVENT_KEY) {
    try {
      await sendEvent(type, payload);
    } catch (err) {
      // do not block on inngest
    }
  }
}


