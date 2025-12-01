// src/app/api/wizard/submit/route.js
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// POST /api/wizard/submit
// Payload: { name, email, niche, skills, availability, subdomain, budget, plan, userId?, paymentSessionId? }
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      password,
      niche,
      skills,
      availability,
      subdomain: desiredSubdomain,
      budget,
      plan = 'starter',
      userId: providedUserId,
      paymentSessionId,
      leadMagnetTopic,
      leadMagnetLanguage,
      template,
      // New Funnel Fields
      targetAudience,
      mainProblem,
      leadMagnetTitle
    } = body || {};

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if professional plan requires payment verification
    const normalizedPlan = String(plan || 'starter').toLowerCase();
    const isProfessionalPlan = ['professional', 'pro', 'professional_lifetime', 'lifetime'].includes(normalizedPlan);
    
    if (isProfessionalPlan && paymentSessionId) {
      // Verify payment session
      const { data: subscription, error: subError } = await supabase
        .from('platform_subscriptions')
        .select('*')
        .eq('stripe_session_id', paymentSessionId)
        .eq('user_email', email)
        .single();
      
      if (subError || !subscription) {
        console.error('Payment verification failed:', subError);
        return Response.json({ 
          error: 'Professional plan requires valid payment. Please complete the checkout process.' 
        }, { status: 400 });
      }
      
      console.log('Professional plan payment verified:', subscription.id);
    } else if (isProfessionalPlan && !paymentSessionId) {
      return Response.json({ 
        error: 'Professional plan requires payment. Please complete the checkout process.' 
      }, { status: 400 });
    }

    const sessionId = nanoid();

    // Resolve user id: accept provided userId or create/find
    let userId = providedUserId;
    if (!userId) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name || 'User' }
      });

      if (authError && authError.message !== 'User already registered') {
        throw authError;
      }

      if (authData?.user?.id) {
        userId = authData.user.id;
      } else {
        // Fetch existing auth user by email via profiles or auth admin list
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();
        if (existingProfile?.id) {
          userId = existingProfile.id;
        } else {
          throw new Error('Unable to resolve user account');
        }
      }
    }

    // Upsert profile with plan
    // Normalize plan aliases
    const normalized = String(plan || 'starter').toLowerCase();
    const aliasMap = { professional: 'pro', professional_lifetime: 'pro', lifetime: 'pro' };
    const planTier = aliasMap[normalized] || normalized;
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
      plan: planTier,
      template,
      leadMagnetTopic,
      leadMagnetLanguage,
      // New Funnel Fields
      targetAudience,
      mainProblem,
      leadMagnetTitle
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
        rev_share_percent: revSharePercent,
        paid_plan_session_id: isProfessionalPlan ? paymentSessionId : null
      })
      .select()
      .single();

    if (bizErr) throw bizErr;

    // Create session - set stage based on template type
    // For lead-magnet templates, we'll set to 'generating' so dashboard doesn't trigger Inngest
    const initialStage = (template === 'lead-magnet' && leadMagnetTopic) ? 'generating' : 'pending';
    
    const { error: sessErr } = await supabase
      .from('sessions')
      .insert({ id: sessionId, business_id: business.id, stage: initialStage, progress: initialStage === 'generating' ? 30 : 0 });
    if (sessErr) throw sessErr;

    // Fire-and-forget: initialize monetization (offers + Stripe Connect)
    // Non-blocking to keep onboarding snappy; failures are logged by the initializer
    try {
      fetch(`${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'http://localhost:3000'}/api/money/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, eagerConnectLink: true })
      }).catch(() => {});

      // Trigger Lead Magnet Generation if applicable
      // This is a simpler, faster generation path for lead magnet funnels
      if (template === 'lead-magnet' && leadMagnetTopic) {
        fetch(`${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'http://localhost:3000'}/api/lead-magnet/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            businessId: business.id, 
            topic: leadMagnetTopic, 
            audience: targetAudience,
            language: leadMagnetLanguage 
          })
        }).catch((err) => console.error('Lead magnet trigger failed:', err));
      }

    } catch (_) {}

    return Response.json({ success: true, sessionId, businessId: business.id, subdomain: safeSubdomain });
  } catch (error) {
    console.error('Wizard submit error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}



