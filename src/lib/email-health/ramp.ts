// src/lib/email-health/ramp.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const RAMP_STAGES = [10, 20, 40, 80] as const;

export type RampHealth = {
  bounceRate: number;
  complaints: number;
};

async function getEmailHealth(businessId: string): Promise<RampHealth> {
  // Compute bounce rate and complaints from last 7 days of emails
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count: sentCount } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', sevenDaysAgo);

  const { count: bounceCount } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('bounce', true)
    .gte('created_at', sevenDaysAgo);

  const { count: complaintCount } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('complaint', true)
    .gte('created_at', sevenDaysAgo);

  const bounceRate = sentCount && sentCount > 0 ? (bounceCount || 0) / sentCount : 0;
  return { bounceRate, complaints: complaintCount || 0 };
}

async function getRampStage(businessId: string): Promise<number> {
  // Persisted stage in businesses.email_ramp_stage (created via migration). Defaults to 0.
  const { data } = await supabase
    .from('businesses')
    .select('email_ramp_stage')
    .eq('id', businessId)
    .single();
  const stage = (data?.email_ramp_stage ?? 0) as number;
  return Math.max(0, Math.min(stage, RAMP_STAGES.length - 1));
}

async function setRampStage(businessId: string, stage: number): Promise<void> {
  await supabase
    .from('businesses')
    .update({ email_ramp_stage: stage, updated_at: new Date().toISOString() })
    .eq('id', businessId);
}

export async function currentCapFor(businessId: string): Promise<number> {
  const { bounceRate, complaints } = await getEmailHealth(businessId);
  let stage = await getRampStage(businessId);

  // Advance only if healthy
  if (bounceRate < 0.05 && complaints === 0 && stage < RAMP_STAGES.length - 1) {
    stage = stage + 1;
    await setRampStage(businessId, stage);
  }

  // If unhealthy, hold at current stage (no automatic downshift for now)
  return RAMP_STAGES[stage];
}


