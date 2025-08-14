// src/lib/manual-override.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function requiresFounderReview(businessId: string): Promise<boolean> {
  const { data } = await supabase
    .from('businesses')
    .select('manual_approval_required, approved_at')
    .eq('id', businessId)
    .single();
  if (!data) return true;
  if (data.approved_at) return false;
  return !!data.manual_approval_required;
}

export async function requestApproval(businessId: string) {
  // For v1, just insert a notification row and rely on external Slack wiring
  await supabase.from('ai_activities').insert({
    business_id: businessId,
    type: 'manual.approval.requested',
    message: 'Manual approval requested to launch email batch',
    created_at: new Date().toISOString()
  });
}


