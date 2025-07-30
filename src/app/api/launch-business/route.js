// app/api/launch-business/route.js - Future-proof business launch API
import { createClient } from '@supabase/supabase-js';
import LaunchflyCore, { ValueLayers, SuccessGuarantees } from '@/lib/core/index.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const launchflyCore = new LaunchflyCore();

/**
 * Future-proof business launch endpoint
 * Focus: Success partnership, not just website generation
 */
export async function POST(request) {
  try {
    const { sessionId, userData, valueLayer = 'best' } = await request.json();
    
    console.log('🚀 Future-proof business launch requested:', { sessionId, valueLayer });
    
    // Update session to show we're starting the success partnership
    await supabase
      .from('sessions')
      .update({
        stage: 'analyzing',
        progress: 10
      })
      .eq('id', sessionId);
    
    // Launch business using the future-proof approach
    const result = await launchflyCore.launchSuccessfulBusiness(userData, sessionId);
    
    if (result.success) {
      // Store the complete result
      await supabase
        .from('businesses')
        .update({
          name: result.opportunity.business.name,
          business_data: {
            ...result,
            valueLayer: ValueLayers[valueLayer],
            guarantee: SuccessGuarantees[valueLayer],
            approach: 'future-proof'
          },
          status: 'ready'
        })
        .eq('session_id', sessionId);
      
      // Mark session as complete
      await supabase
        .from('sessions')
        .update({
          stage: 'complete',
          progress: 100
        })
        .eq('id', sessionId);
      
      return Response.json({
        success: true,
        message: 'Business successfully launched using future-proof approach',
        data: {
          business: result.business,
          opportunity: result.opportunity,
          growth: result.growth,
          guarantee: result.guarantee,
          valueDelivered: ValueLayers[valueLayer]
        }
      });
    } else {
      // Handle fallback
      const fallbackPlan = result.fallback;
      
      await supabase
        .from('sessions')
        .update({
          stage: 'manual_consultation',
          progress: 50
        })
        .eq('id', sessionId);
      
      return Response.json({
        success: false,
        fallback: true,
        message: 'Switching to personalized consultation approach',
        plan: fallbackPlan
      });
    }
    
  } catch (error) {
    console.error('Future-proof launch error:', error);
    
    // Update session to consultation mode
    if (sessionId) {
      await supabase
        .from('sessions')
        .update({
          stage: 'manual_consultation',
          progress: 25
        })
        .eq('id', sessionId);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      fallback: {
        approach: 'manual_consultation',
        message: 'Let us work with you personally to ensure your success',
        nextSteps: [
          'Schedule 1-on-1 consultation',
          'Custom business analysis',
          'Personalized launch strategy',
          'Direct support until profitable'
        ]
      }
    }), {
      status: 200, // Don't return error status, this is a valid fallback
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get available value layers and pricing
 */
export async function GET() {
  return Response.json({
    valueLayers: ValueLayers,
    guarantees: SuccessGuarantees,
    approach: 'future-proof',
    description: 'We focus on your business success, not just website generation'
  });
}

export const runtime = 'nodejs';
export const maxDuration = 60;
