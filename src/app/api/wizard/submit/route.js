// src/app/api/wizard/submit/route.js
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { inngest } from '@/lib/inngest/client';
import { detectIndustry, generateFromTemplate, getTemplateById } from '@/lib/industry-templates';

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
      leadMagnetTitle,
      websiteUrl,
      businessContext,
      whatsappNumber,
      socialProofUrl
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
      leadMagnetTitle,
      websiteUrl,
      businessContext
    };

    // === DONE-FOR-YOU TEMPLATE INTEGRATION ===
    // Check if niche matches a pre-built industry template
    // If yes, auto-populate business_data with complete lead magnet content
    let templateBusinessData = null;
    const detectedIndustry = niche ? detectIndustry(niche) : null;
    const industryTemplate = detectedIndustry ? getTemplateById(detectedIndustry) : null;

    if (industryTemplate && detectedIndustry !== 'other') {
      console.log(`🎯 Matched industry template: ${detectedIndustry}`);
      // Generate complete business data from template
      templateBusinessData = generateFromTemplate(detectedIndustry, {
        name: name || 'My Business',
        phone: whatsappNumber || '', // Use provided WhatsApp as business phone
        area: targetAudience || 'your area',
        email: email
      });

      // Inject Social Proof URL into business data
      if (socialProofUrl) {
        templateBusinessData.socialProofUrl = socialProofUrl;
      }

      // Override with any custom values from form
      if (leadMagnetTitle) {
        templateBusinessData.lead_magnet_title = leadMagnetTitle;
      }
      if (targetAudience) {
        templateBusinessData.targetAudience = targetAudience;
      }

      console.log(`✅ Pre-built content loaded for: ${industryTemplate.name}`);
    }

    // Create business
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .insert({
        user_id: userId,
        name: templateBusinessData?.businessName || 'Pending Generation',
        subdomain: safeSubdomain,
        status: templateBusinessData ? 'ready' : 'pending', // Template businesses are ready immediately
        form_data: formData,
        session_id: sessionId,
        guarantee_start_at: new Date().toISOString(),
        plan_tier: planTier,
        rev_share_percent: revSharePercent,
        paid_plan_session_id: isProfessionalPlan ? paymentSessionId : null,

        // New Fields
        whatsapp_notify_number: whatsappNumber || null,
        notify_preference: 'whatsapp',
        // Pre-populate business_data if template matched
        business_data: templateBusinessData || null
      })
      .select()
      .single();

    if (bizErr) throw bizErr;

    // Normalize template and topic for Quick Start flow
    const effectiveTemplate = template || (leadMagnetTitle ? 'lead-magnet' : 'standard');
    const effectiveTopic = leadMagnetTopic || leadMagnetTitle;

    // Create session - set stage based on template type
    // Template-matched businesses are COMPLETE immediately (no AI generation needed)
    // Other lead-magnet templates need generation
    let initialStage = 'pending';
    let initialProgress = 0;

    if (templateBusinessData) {
      // Pre-built template - skip generation, mark as complete
      initialStage = 'complete';
      initialProgress = 100;
      console.log('⚡ Template business - skipping AI generation (content pre-built)');
    } else if (effectiveTemplate === 'lead-magnet' && effectiveTopic) {
      // Custom lead magnet - needs AI generation
      initialStage = 'generating';
      initialProgress = 30;
    }

    const { error: sessErr } = await supabase
      .from('sessions')
      .insert({ id: sessionId, business_id: business.id, stage: initialStage, progress: initialProgress });
    if (sessErr) throw sessErr;

    // Fire-and-forget: initialize monetization (offers + Stripe Connect)
    // Non-blocking to keep onboarding snappy; failures are logged by the initializer
    fetch(`${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'http://localhost:3000'}/api/money/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: business.id, eagerConnectLink: true })
    }).catch(() => { });

    // Trigger Lead Magnet Generation - ONLY if no template match
    // Template-matched businesses already have content, skip AI generation
    if (!templateBusinessData && effectiveTemplate === 'lead-magnet' && effectiveTopic) {
      console.log('Triggering lead magnet generation for:', effectiveTopic);
      try {
        await inngest.send({
          name: 'lead-magnet/generation.requested',
          data: {
            businessId: business.id,
            topic: effectiveTopic,
            audience: targetAudience,
            language: leadMagnetLanguage || 'English',
            sessionId: sessionId,
            websiteUrl,
            businessContext
          }
        });
        console.log('Lead magnet generation triggered via Inngest');
      } catch (err) {
        console.error('Lead magnet trigger failed:', err);
      }
    }

    return Response.json({ success: true, sessionId, businessId: business.id, subdomain: safeSubdomain });
  } catch (error) {
    console.error('Wizard submit error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}



