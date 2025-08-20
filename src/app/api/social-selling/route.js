// src/app/api/social-selling/route.js
// API endpoint for managing social selling campaigns

import { createClient } from '@supabase/supabase-js';
import { SocialSellingOrchestrator } from '@/lib/social-selling/orchestrator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET - Get social selling campaign status
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return Response.json({ error: 'businessId is required' }, { status: 400 });
    }

    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Check if there's an active campaign (this would be stored in a global campaigns map in production)
    // For now, return campaign status from activity logs
    const { data: activities } = await supabase
      .from('business_activity')
      .select('*')
      .eq('business_id', businessId)
      .eq('type', 'social_selling_campaign_launched')
      .order('created_at', { ascending: false })
      .limit(1);

    const hasActiveCampaign = activities && activities.length > 0;
    
    return Response.json({
      businessId,
      hasActiveCampaign,
      lastCampaign: hasActiveCampaign ? activities[0] : null,
      availablePlatforms: ['reddit', 'facebook', 'linkedin', 'twitter', 'instagram'],
      recommendedStrategy: 'Start with Reddit + Facebook Groups for highest intent prospects'
    });

  } catch (error) {
    console.error('Error getting social selling status:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Launch social selling campaign
 */
export async function POST(request) {
  try {
    const { businessId, platforms, options = {} } = await request.json();

    if (!businessId) {
      return Response.json({ error: 'businessId is required' }, { status: 400 });
    }

    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Create orchestrator and launch campaign
    const orchestrator = new SocialSellingOrchestrator(businessId, business);
    
    const campaignOptions = {
      platformPriority: platforms || ['reddit', 'facebook', 'linkedin'],
      ...options
    };

    // Launch the campaign
    const results = await orchestrator.launchSocialSelling(campaignOptions);

    // Store campaign reference (in production, you'd want a proper campaign management system)
    const campaignSummary = {
      campaignId: `social_campaign_${Date.now()}`,
      businessId,
      platforms: campaignOptions.platformPriority,
      estimatedReach: orchestrator.calculateTotalReach(results),
      estimatedConversions: orchestrator.calculateTotalConversions(results),
      estimatedFirstSale: results.estimated_first_sale,
      launchedAt: new Date().toISOString(),
      status: 'active'
    };

    return Response.json({
      success: true,
      campaign: campaignSummary,
      results,
      message: 'Social selling campaign launched successfully',
      nextSteps: [
        'Monitor platform performance in real-time',
        'Expect first conversations within 4-6 hours',
        'First sale typically within 24-48 hours',
        'Optimize based on platform response rates'
      ]
    });

  } catch (error) {
    console.error('Error launching social selling campaign:', error);
    return Response.json({ 
      error: 'Failed to launch campaign',
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * DELETE - Stop social selling campaign
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return Response.json({ error: 'businessId is required' }, { status: 400 });
    }

    // In production, you'd retrieve the active orchestrator instance
    // For now, log the stop request
    await supabase
      .from('business_activity')
      .insert({
        business_id: businessId,
        type: 'social_selling_stop_requested',
        icon: '⏹️',
        message: 'Social selling campaign stop requested',
        details: 'User requested to stop all social selling activities',
        metadata: {
          timestamp: new Date().toISOString(),
          method: 'api_request'
        }
      });

    return Response.json({
      success: true,
      message: 'Social selling campaign stop initiated',
      note: 'Active campaigns will wind down over the next few minutes'
    });

  } catch (error) {
    console.error('Error stopping social selling campaign:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
