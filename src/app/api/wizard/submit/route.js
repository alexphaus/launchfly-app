// src/app/api/wizard/submit/route.js
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// POST /api/wizard/submit
// Payload: { name, email, niche, skills, availability, subdomain, budget, plan }
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      niche,
      skills,
      availability,
      subdomain: desiredSubdomain,
      budget,
      plan = 'starter'
    } = body || {};

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const sessionId = nanoid();

    // Create or fetch user profile
    let userId;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: name || 'User' }
    });

    if (authError && authError.message !== 'User already registered') {
      throw authError;
    }

    if (authData?.user?.id) {
      userId = authData.user.id;
    } else {
      const { data: existing, error: findErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();
      if (findErr || !existing) throw new Error('Unable to find existing user');
      userId = existing.id;
    }

    // Upsert profile with plan
    const planTier = (plan || 'starter').toLowerCase();
    await supabase
      .from('profiles')
      .upsert({ id: userId, email, full_name: name || 'User', plan: planTier }, { onConflict: 'id' });

    // Prepare subdomain
    const safeSubdomain = (desiredSubdomain || `biz-${nanoid(6)}`)
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 32);

    // Map revenue share by plan
    const revShareMap = { starter: 20, pro: 10, scale: 5 };
    const revSharePercent = revShareMap[planTier] ?? 20;

    const formData = {
      name,
      email,
      niche,
      skills,
      availability,
      budget,
      plan: planTier
    };

    // Create business
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .insert({
        user_id: userId,
        name: 'Pending Generation',
        subdomain: safeSubdomain,
        status: 'pending',
        form_data: formData,
        session_id: sessionId,
        guarantee_start_at: new Date().toISOString(),
        plan_tier: planTier,
        rev_share_percent: revSharePercent
      })
      .select()
      .single();

    if (bizErr) throw bizErr;

    // Create session
    const { error: sessErr } = await supabase
      .from('sessions')
      .insert({ id: sessionId, business_id: business.id, stage: 'pending', progress: 0 });
    if (sessErr) throw sessErr;

    return Response.json({ success: true, sessionId, businessId: business.id, subdomain: safeSubdomain });
  } catch (error) {
    console.error('Wizard submit error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}


