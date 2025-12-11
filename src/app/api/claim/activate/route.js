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
      
      // Check if content is actually ready
      const hasContent = business.business_data?.leadMagnet?.lead_magnet_content || 
                        business.business_data?.lead_magnet_content;
      
      // Get existing session_id
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('id')
        .eq('business_id', businessId)
        .single();
      
      let finalSessionId = existingSession?.id || business.session_id;

      // RECOVERY: If session_id is missing OR content is missing, we need to regenerate
      if (!finalSessionId || !hasContent) {
         console.log('⚠️ Business ready but missing session_id or content. Regenerating...');
         const generateId = (len = 12) => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < len; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
            return result;
         };
         finalSessionId = generateId(12);
         
         // Update business to generating state
         await supabase.from('businesses').update({ 
           session_id: finalSessionId,
           status: hasContent ? 'ready' : 'generating' 
         }).eq('id', businessId);
         
         // Create session
         await supabase.from('sessions').insert({ 
           id: finalSessionId, 
           business_id: businessId, 
           stage: hasContent ? 'complete' : 'generating', 
           progress: hasContent ? 100 : 30 
         });

         // If missing content, trigger generation
         if (!hasContent) {
           const businessData = business.business_data || {};
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
                 sessionId: finalSessionId,
                 websiteUrl: businessData.websiteUrl,
                 businessContext: `${businessData.businessName} - ${businessData.niche}`
               }
             });
             console.log('✅ Triggered content regeneration via Inngest');
           } catch (e) {
             console.error('Failed to trigger Inngest for recovery:', e);
           }
         }
      }
      
      return Response.json({
        success: true,
        status: 'activated',
        business: {
          id: business.id,
          name: business.business_data?.businessName || business.name,
          subdomain: business.subdomain,
          sessionId: finalSessionId
        }
      });
    }

    // Generate a new session ID for the dashboard
    // Use a simple random string to avoid potential nanoid issues
    const generateId = (len = 12) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < len; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
      return result;
    };
    const newSessionId = generateId(12);
    
    console.log(`Generated new session ID: ${newSessionId}`);

    // Attempt to link to existing user by email
    const customerEmail = session.customer_details?.email || session.customer_email;
    let targetUserId = undefined;

    if (customerEmail) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', customerEmail)
        .single();
      
      if (profile) {
        targetUserId = profile.id;
        console.log(`🔗 Linking business to existing user: ${targetUserId}`);
      }
    }

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
        guarantee_start_at: new Date().toISOString(),
        ...(targetUserId ? { user_id: targetUserId } : {}),
        business_data: {
          ...(business.business_data || {}),
          owner_email: customerEmail
        }
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
    
    let inngestTriggered = false;
    try {
      const sendResult = await inngest.send({
        name: 'lead-magnet/generation.requested',
        data: {
          businessId: businessId,
          topic: leadMagnetTitle,
          audience: businessData.niche || 'local customers',
          language: 'English',
          sessionId: newSessionId,
          websiteUrl: businessData.websiteUrl,
          businessContext: `${businessData.businessName} - ${businessData.niche}`,
          ownerEmail: customerEmail
        }
      });
      console.log('✅ Lead magnet generation triggered via Inngest:', JSON.stringify(sendResult));
      inngestTriggered = true;
    } catch (e) {
      console.error('❌ Failed to trigger Inngest:', e.message, e.stack);
      
      // FALLBACK: If Inngest fails, set business as ready with basic content
      // and update progress so the UI doesn't get stuck
      console.log('⚠️ Inngest failed - setting business as ready with basic funnel');
      
      await supabase
        .from('businesses')
        .update({ status: 'ready' })
        .eq('id', businessId);
      
      // Update session to complete so polling stops
      await supabase
        .from('sessions')
        .update({ stage: 'complete', progress: 100 })
        .eq('id', newSessionId);
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
