// src/app/api/ai-cofounder/leads/route.js
/**
 * API endpoint for AI Cofounder lead management
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ConversationManager, LeadScoring } from '@/lib/ai-cofounder/core';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/ai-cofounder/leads
 * Get organized lead inbox
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // Get organized inbox
    const organizedInbox = await ConversationManager.organizeInbox(businessId);

    // Get recent notifications
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('business_id', businessId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get AI activity summary
    const { data: recentActivities } = await supabase
      .from('ai_activities')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      organizedInbox,
      notifications: notifications || [],
      recentActivities: recentActivities || [],
      summary: {
        totalLeads: Object.values(organizedInbox).flat().length,
        hotLeads: organizedInbox.hot.length,
        needsAttention: organizedInbox.hot.filter(l => l.needsFollowUp).length
      }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-cofounder/leads
 * Create or update a lead
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { businessId, leadData, action } = body;

    if (!businessId || !leadData) {
      return NextResponse.json(
        { error: 'Business ID and lead data are required' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'create':
        // Create new lead
        const { data: newLead, error: createError } = await supabase
          .from('leads')
          .insert({
            business_id: businessId,
            ...leadData,
            source: leadData.source || 'manual',
            status: 'new',
            score: 0
          })
          .select()
          .single();

        if (createError) throw createError;
        result = newLead;
        break;

      case 'update':
        // Update existing lead
        const { data: updatedLead, error: updateError } = await supabase
          .from('leads')
          .update({
            ...leadData,
            updated_at: new Date().toISOString()
          })
          .eq('id', leadData.id)
          .eq('business_id', businessId)
          .select()
          .single();

        if (updateError) throw updateError;
        result = updatedLead;
        break;

      case 'score':
        // Recalculate lead score
        const score = await LeadScoring.calculateScore(leadData.id, businessId);
        const temperature = LeadScoring.getTemperature(score);

        const { data: scoredLead, error: scoreError } = await supabase
          .from('leads')
          .update({
            score,
            temperature,
            updated_at: new Date().toISOString()
          })
          .eq('id', leadData.id)
          .eq('business_id', businessId)
          .select()
          .single();

        if (scoreError) throw scoreError;
        result = scoredLead;
        break;

      case 'flag_hot':
        // Flag as hot prospect
        const { data: hotLead, error: hotError } = await supabase
          .from('leads')
          .update({
            status: 'hot',
            priority: 'high',
            temperature: 'hot',
            ai_notes: `🔥 Manually flagged as hot prospect at ${new Date().toISOString()}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', leadData.id)
          .eq('business_id', businessId)
          .select()
          .single();

        if (hotError) throw hotError;

        // Create notification
        await supabase
          .from('notifications')
          .insert({
            business_id: businessId,
            type: 'hot_lead',
            priority: 'high',
            title: `🔥 Hot Lead: ${hotLead.name || hotLead.email}`,
            message: 'Manually flagged as hot prospect - immediate action recommended',
            data: { lead_id: hotLead.id }
          });

        result = hotLead;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Log AI activity
    await supabase
      .from('ai_activities')
      .insert({
        business_id: businessId,
        type: `lead_${action}`,
        description: `Lead ${action}: ${result.name || result.email}`,
        data: { lead_id: result.id, action }
      });

    return NextResponse.json({
      success: true,
      lead: result
    });
  } catch (error) {
    console.error('Error processing lead:', error);
    return NextResponse.json(
      { error: 'Failed to process lead', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-cofounder/leads
 * Delete a lead
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const leadId = searchParams.get('leadId');

    if (!businessId || !leadId) {
      return NextResponse.json(
        { error: 'Business ID and Lead ID are required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('business_id', businessId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json(
      { error: 'Failed to delete lead', details: error.message },
      { status: 500 }
    );
  }
}
