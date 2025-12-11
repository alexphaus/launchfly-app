// src/app/api/claim/activate/route.js
// API to activate a claimed prospect business and check status
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { nanoid } from 'nanoid';
import { inngest } from '@/lib/inngest/client';

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

    // If already activated, return success with session_id
    if (business.status === 'ready') {
      console.log(`✅ Business already activated: ${businessId}`);
      
      // Get existing session_id
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('id')
        .eq('business_id', businessId)
        .single();
      
      return Response.json({
        success: true,
        status: 'activated',
        business: {
          id: business.id,
          name: business.business_data?.businessName || business.name,
          subdomain: business.subdomain,
          sessionId: existingSession?.id || business.session_id
        }
      });
    }

    // Generate a new session ID for the dashboard
    const newSessionId = nanoid(12);

    // Activate the prospect business with full setup
    // Note: Don't use paid_plan_session_id as it has FK to platform_subscriptions
    const { data: updated, error: updateError } = await supabase
      .from('businesses')
      .update({ 
        status: 'generating', // Set to generating while we create the full funnel
        source: `claimed-prospect:${sessionId}`,
        expires_at: null,
        session_id: newSessionId,
        plan_tier: 'starter',
        rev_share_percent: 20,
        guarantee_start_at: new Date().toISOString()
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

    // Create a session record for dashboard access
    const { error: sessError } = await supabase
      .from('sessions')
      .insert({ 
        id: newSessionId, 
        business_id: businessId, 
        stage: 'generating', 
        progress: 30 
      });
    
    if (sessError) {
      console.error('Failed to create session:', sessError);
      // Continue anyway - session is nice to have but not critical
    }

    // Initialize monetization (offers + Stripe Connect)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'https://www.launchfly.ai'}/api/money/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: businessId, eagerConnectLink: true })
      });
    } catch (e) {
      console.error('Money init failed:', e);
    }

    // Trigger full lead magnet generation via Inngest
    // This will create the PDF, email sequences, etc.
    const businessData = updated.business_data || {};
    const leadMagnetTitle = businessData.leadMagnet?.lead_magnet?.title || 
                           businessData.businessName + ' Guide';
    
    try {
      await inngest.send({
        name: 'lead-magnet/generation.requested',
        data: {
          businessId: businessId,
          topic: leadMagnetTitle,
          audience: businessData.niche || 'local customers',
          language: 'English',
          sessionId: newSessionId,
          websiteUrl: businessData.websiteUrl,
          businessContext: `${businessData.businessName} - ${businessData.niche}`
        }
      });
      console.log('✅ Lead magnet generation triggered via Inngest');
    } catch (e) {
      console.error('Failed to trigger Inngest:', e);
      // Mark as ready anyway since they have a basic funnel
      await supabase
        .from('businesses')
        .update({ status: 'ready' })
        .eq('id', businessId);
    }

    console.log(`✅ Successfully activated business: ${businessId} with session: ${newSessionId}`);

    return Response.json({
      success: true,
      status: 'activated',
      business: {
        id: updated.id,
        name: updated.business_data?.businessName || updated.name,
        subdomain: updated.subdomain,
        sessionId: newSessionId
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
    .select('id, status, name, subdomain, business_data, session_id')
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
      subdomain: business.subdomain,
      sessionId: business.session_id
    } : null
  });
}
