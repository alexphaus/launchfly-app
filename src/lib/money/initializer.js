// src/lib/money/initializer.js
// Initializes the core money-generation stack for a business:
// - Ensures sellable offers exist immediately (curated for fast first sale)
// - Sets up Stripe Connect for direct payouts (with onboarding link)
// - Logs AI activity for observability

import { createClient } from '@supabase/supabase-js';
import { getCuratedOffers } from '@/offers/library';
import { getStripeConnectManager } from '@/lib/revenue-share/stripe-connect';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function normalizeOpportunityFromBusiness(business) {
  const form = business?.form_data || {};
  return {
    businessName: business?.name || form?.name || 'Your Business',
    niche: form?.niche || form?.industry || form?.businessType || 'business',
    businessType: form?.businessType || form?.niche || 'service',
  };
}

function coerceProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.map(p => ({
    ...p,
    id: p.id || (p.name ? p.name.toLowerCase().replace(/\s+/g, '-') : undefined),
  }));
}

async function upsertBusinessData(businessId, mutator) {
  const { data: current, error: loadErr } = await supabase
    .from('businesses')
    .select('business_data')
    .eq('id', businessId)
    .single();
  if (loadErr) throw loadErr;

  const currentData = current?.business_data || {};
  const nextData = await mutator({ ...currentData });

  const { error: updateErr } = await supabase
    .from('businesses')
    .update({ business_data: nextData, updated_at: new Date().toISOString() })
    .eq('id', businessId);
  if (updateErr) throw updateErr;

  return nextData;
}

async function logActivity(businessId, payload) {
  try {
    await supabase
      .from('ai_activities')
      .insert({
        business_id: businessId,
        type: payload.type || 'money_init',
        icon: payload.icon || '💰',
        message: payload.message || 'Money system initialized',
        details: payload.details || null,
        metadata: payload.metadata || null
      });
  } catch (_) {}
}

export async function initializeMonetizationForBusiness({ businessId, eagerConnectLink = true }) {
  if (!businessId) throw new Error('businessId is required');

  // Load business
  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();
  if (bizErr || !business) throw bizErr || new Error('Business not found');

  const opportunity = normalizeOpportunityFromBusiness(business);

  // 1) Ensure sellable offers exist immediately
  let connectOnboardingUrl = null;
  await upsertBusinessData(business.id, async (data) => {
    const existingProducts = Array.isArray(data.products) ? data.products : [];
    if (!existingProducts.length) {
      const curated = getCuratedOffers({
        niche: opportunity.niche,
        businessType: opportunity.businessType,
        businessName: opportunity.businessName
      });
      data.products = coerceProducts(curated);
    }

    // Preserve any existing layout/theme if present; monetization works with or without
    return data;
  });

  await logActivity(business.id, {
    type: 'offers_initialized',
    icon: '🛒',
    message: 'Curated offers are ready for checkout',
    details: 'Baseline catalog created for fast first sale',
    metadata: { count: 3 }
  });

  // 2) Ensure Stripe Connect account and onboarding link (for direct payouts)
  try {
    const manager = getStripeConnectManager();
    let connectAccountId = business.stripe_connect_account_id;
    if (!connectAccountId) {
      const userEmail = business?.form_data?.email || null;
      const account = await manager.createConnectAccount(business, userEmail);
      connectAccountId = account.id;
    }

    if (eagerConnectLink && connectAccountId) {
      connectOnboardingUrl = await manager.createOnboardingLink(connectAccountId, business.id);

      await upsertBusinessData(business.id, async (data) => {
        return { ...data, stripe_connect_onboarding_url: connectOnboardingUrl };
      });

      await logActivity(business.id, {
        type: 'stripe_connect_ready',
        icon: '💳',
        message: 'Stripe Connect onboarding link generated',
        metadata: { connectAccountId }
      });
    }
  } catch (err) {
    // Non-fatal: offers still work via platform charges without Connect
    await logActivity(business.id, {
      type: 'stripe_connect_error',
      icon: '⚠️',
      message: 'Stripe Connect setup skipped or failed',
      details: err?.message || String(err)
    });
  }

  // 3) Return a summary for the caller
  return {
    success: true,
    businessId: business.id,
    offersReady: true,
    connectOnboardingUrl
  };
}

export default initializeMonetizationForBusiness;


