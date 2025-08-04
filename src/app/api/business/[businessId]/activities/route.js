// app/api/business/[businessId]/activities/route.js
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * API endpoint to fetch real AI activities for a business
 * Replaces simulated dashboard activities with real customer acquisition activities
 */
export async function GET(request, { params }) {
  try {
    const { businessId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching activities for business: ${businessId}`);

    // Get real activities from database
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

    // Transform activities for dashboard consumption
    const transformedActivities = (activities || []).map(activity => ({
      id: activity.id,
      icon: activity.icon,
      text: activity.message,
      details: activity.details,
      type: getActivityDisplayType(activity.type),
      time: formatTimeAgo(activity.created_at),
      metadata: activity.metadata,
      created_at: activity.created_at
    }));

    return NextResponse.json({
      success: true,
      activities: transformedActivities,
      total: activities?.length || 0
    });

  } catch (error) {
    console.error('Error in activities API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Transform activity types for dashboard display
 */
function getActivityDisplayType(activityType) {
  const typeMap = {
    'prospect_search': 'success',
    'email_sent': 'working',
    'email_opened': 'success', 
    'email_replied': 'success',
    'meeting_booked': 'success',
    'optimization': 'optimization',
    'metrics_update': 'analytics',
    'campaign_started': 'working'
  };
  
  return typeMap[activityType] || 'working';
}

/**
 * Format timestamp as "time ago" string
 */
function formatTimeAgo(timestamp) {
  const now = new Date();
  const activityTime = new Date(timestamp);
  const diffInSeconds = Math.floor((now - activityTime) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}