// src/app/api/claim/activate/route.js
// API to activate a claimed prospect business and check status
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, sessionId } = await request.json();

    if (!businessId || !sessionId) {
      return Response.json({ error: 'Missing businessId or sessionId' }, { status: 400 });
    }

    console.log(`🔄 Activating claimed business: ${businessId} with session: ${sessionId}`);

    // Verify the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      return Response.json({ 
        success: false, 
        error: 'Payment not completed',
        status: 'pending_payment'
      }, { status: 400 });
    }

    if (session.metadata?.businessId !== businessId) {
      return Response.json({ 
        success: false, 
        error: 'Session does not match business',
        status: 'invalid_session'
      }, { status: 400 });
    }

    // Check current business status
    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('id, status, name, subdomain, business_data')
      .eq('id', businessId)
      .single();

    if (fetchError || !business) {
      console.error('Business not found:', fetchError);
      return Response.json({ 
        success: false, 
        error: 'Business not found',
        status: 'not_found'
      }, { status: 404 });
    }

    // If already activated, return success
    if (business.status === 'ready') {
      console.log(`✅ Business already activated: ${businessId}`);
      return Response.json({
        success: true,
        status: 'activated',
        business: {
          id: business.id,
          name: business.business_data?.businessName || business.name,
          subdomain: business.subdomain
        }
      });
    }

    // Activate the prospect business
    // Note: Don't use paid_plan_session_id as it has FK to platform_subscriptions
    const { data: updated, error: updateError } = await supabase
      .from('businesses')
      .update({ 
        status: 'ready',
        source: `claimed-prospect:${sessionId}`,
        expires_at: null
      })
      .eq('id', businessId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to activate business:', updateError);
      return Response.json({ 
        success: false, 
        error: 'Failed to activate business: ' + updateError.message,
        status: 'activation_failed'
      }, { status: 500 });
    }

    console.log(`✅ Successfully activated business: ${businessId}`);

    return Response.json({
      success: true,
      status: 'activated',
      business: {
        id: updated.id,
        name: updated.business_data?.businessName || updated.name,
        subdomain: updated.subdomain
      }
    });

  } catch (error) {
    console.error('Activation error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
      status: 'error'
    }, { status: 500 });
  }
}

// GET to check status without activating
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('businessId');

  if (!businessId) {
    return Response.json({ error: 'Missing businessId' }, { status: 400 });
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, status, name, subdomain, business_data')
    .eq('id', businessId)
    .single();

  if (error || !business) {
    return Response.json({ status: 'not_found' }, { status: 404 });
  }

  return Response.json({
    status: business.status === 'ready' ? 'activated' : 'pending',
    business: business.status === 'ready' ? {
      id: business.id,
      name: business.business_data?.businessName || business.name,
      subdomain: business.subdomain
    } : null
  });
}
