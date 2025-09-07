/**
 * AI Activities API
 * Fetches recent AI activities for the dashboard
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID required' },
        { status: 400 }
      );
    }

    // Get recent AI activities
    const { data: activities, error } = await supabase
      .from('ai_activities')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching activities:', error);
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      );
    }

    // Transform activities for display
    const transformedActivities = (activities || []).map(activity => ({
      id: activity.id,
      type: activity.type,
      icon: activity.icon || getActivityIcon(activity.type),
      message: activity.message,
      details: activity.details,
      timestamp: activity.created_at,
      created_at: activity.created_at
    }));

    return NextResponse.json({
      activities: transformedActivities,
      count: transformedActivities.length
    });
  } catch (error) {
    console.error('Error in AI activities API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get appropriate icon for activity type
function getActivityIcon(type) {
  const icons = {
    'customer_acquisition': '🎯',
    'email_sent': '📧',
    'prospect_found': '👤',
    'optimization': '⚡',
    'experiment': '🧪',
    'revenue_generated': '💰',
    'plan_created': '📋',
    'strategy_adapted': '🔄',
    'analysis_completed': '📊',
    'outreach_started': '📢',
    'working': '🤖',
    'thinking': '🧠',
    'success': '✅',
    'error': '❌',
    'warning': '⚠️'
  };
  
  return icons[type] || '🤖';
}
