// src/app/api/stripe/connect/status/route.js
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
        connected: false,
        status: 'not_connected',
        message: 'No Connect account found'
      });
    }

    // Get Connect account details from Stripe
    const account = await stripe.accounts.retrieve(business.stripe_connect_account_id);

    // Check if account is fully onboarded
    const isFullyOnboarded = account.details_submitted && 
                            account.charges_enabled && 
                            account.payouts_enabled;

    // Check for any requirements
    const hasRequirements = account.requirements?.currently_due?.length > 0 ||
                           account.requirements?.eventually_due?.length > 0 ||
                           account.requirements?.past_due?.length > 0;

    // Determine status
    let status = 'not_connected';
    let message = 'Account not set up';

    if (isFullyOnboarded) {
      status = 'connected';
      message = 'Bank account connected and ready for payouts';
    } else if (account.details_submitted) {
      status = 'pending_verification';
      message = 'Bank details submitted, pending verification';
    } else if (hasRequirements) {
      status = 'requires_action';
      message = 'Additional information required';
    } else {
      status = 'incomplete';
      message = 'Onboarding not completed';
    }

    return Response.json({
      success: true,
      connected: isFullyOnboarded,
      status: status,
      message: message,
      account_details: {
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        country: account.country,
        default_currency: account.default_currency,
        business_type: account.business_type
      },
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        eventually_due: account.requirements?.eventually_due || [],
        past_due: account.requirements?.past_due || [],
        disabled_reason: account.requirements?.disabled_reason
      }
    });

  } catch (error) {
    console.error('Connect status check error:', error);
    return Response.json({ 
      error: 'Failed to check Connect status', 
      details: error.message 
    }, { status: 500 });
  }
}

// Update Connect account status after webhook events
export async function POST(request) {
  try {
    const { businessId, connectAccountId, status, requirements } = await request.json();

    if (!businessId || !connectAccountId) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Update business record if needed
    await supabase
      .from('businesses')
      .update({ 
        stripe_connect_account_id: connectAccountId,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId);

    // Log status change activity
    const statusMessages = {
      'connected': 'Bank account successfully connected! You can now receive payouts.',
      'pending_verification': 'Bank details submitted and under review.',
      'requires_action': 'Additional information needed to complete setup.',
      'incomplete': 'Bank account setup needs to be completed.',
      'restricted': 'Account temporarily restricted - please contact support.'
    };

    await supabase
      .from('ai_activities')
      .insert({
        business_id: businessId,
        type: `bank_connection_${status}`,
        icon: status === 'connected' ? '✅' : status === 'requires_action' ? '⚠️' : '🏦',
        message: statusMessages[status] || 'Bank account status updated',
        details: requirements ? `Requirements: ${requirements.join(', ')}` : null,
        metadata: {
          connect_account_id: connectAccountId,
          status: status,
          requirements: requirements
        }
      });

    return Response.json({
      success: true,
      message: 'Connect status updated successfully'
    });

  } catch (error) {
    console.error('Connect status update error:', error);
    return Response.json({ 
      error: 'Failed to update Connect status', 
      details: error.message 
    }, { status: 500 });
  }
}
