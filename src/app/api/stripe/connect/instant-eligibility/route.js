// src/app/api/stripe/connect/instant-eligibility/route.js
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return Response.json({ error: 'Business ID is required' }, { status: 400 });
    }

    // Get business with Connect account ID
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('stripe_connect_account_id, name')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    if (!business.stripe_connect_account_id) {
      return Response.json({
        success: true,
        eligible: false,
        reason: 'No Connect account found'
      });
    }

    try {
      // Get Connect account details from Stripe
      const account = await stripe.accounts.retrieve(business.stripe_connect_account_id);

      // Check basic eligibility requirements
      const basicEligibility = account.details_submitted && 
                              account.charges_enabled && 
                              account.payouts_enabled;

      if (!basicEligibility) {
        return Response.json({
          success: true,
          eligible: false,
          reason: 'Account not fully verified'
        });
      }

      // Check if account has instant payout capability
      const hasInstantCapability = account.capabilities?.transfers === 'active';
      
      // Check external accounts for instant eligibility
      const externalAccounts = account.external_accounts?.data || [];
      const hasEligibleAccount = externalAccounts.some(acc => {
        // Debit cards are typically eligible for instant payouts
        // Some bank accounts with real-time payments are also eligible
        return acc.object === 'card' || 
               (acc.object === 'bank_account' && acc.available_payout_methods?.includes('instant'));
      });

      // Check account history and standing
      const hasGoodStanding = !account.requirements?.disabled_reason &&
                             account.requirements?.currently_due?.length === 0;

      const isEligible = hasInstantCapability && hasEligibleAccount && hasGoodStanding;

      let reason = 'Eligible for instant payouts';
      if (!hasInstantCapability) {
        reason = 'Account not enabled for instant transfers';
      } else if (!hasEligibleAccount) {
        reason = 'No eligible debit card or instant-enabled bank account';
      } else if (!hasGoodStanding) {
        reason = 'Account requires additional verification';
      }

      return Response.json({
        success: true,
        eligible: isEligible,
        reason: reason,
        account_info: {
          has_instant_capability: hasInstantCapability,
          has_eligible_account: hasEligibleAccount,
          good_standing: hasGoodStanding,
          external_accounts_count: externalAccounts.length
        }
      });

    } catch (stripeError) {
      console.error('Error checking instant eligibility:', stripeError);
      return Response.json({
        success: true,
        eligible: false,
        reason: 'Unable to verify instant payout eligibility'
      });
    }

  } catch (error) {
    console.error('Instant eligibility check error:', error);
    return Response.json({ 
      error: 'Failed to check instant eligibility', 
      details: error.message 
    }, { status: 500 });
  }
}
