// lib/activity-logger.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Activity Logger - Logs real AI activities to database
 * Replaces simulated dashboard activities with real customer acquisition activities
 */

export const ActivityTypes = {
  PROSPECT_SEARCH: 'prospect_search',
  EMAIL_SENT: 'email_sent',
  EMAIL_OPENED: 'email_opened',
  EMAIL_REPLIED: 'email_replied',
  EMAIL_OBJECTION_HANDLED: 'email_objection_handled',
  MEETING_BOOKED: 'meeting_booked',
  LINKEDIN_OUTREACH: 'linkedin_outreach',
  CONTENT_CREATED: 'content_created',
  OPTIMIZATION: 'optimization',
  COMPETITOR_ANALYSIS: 'competitor_analysis',
  CAMPAIGN_STARTED: 'campaign_started',
  METRICS_UPDATE: 'metrics_update',
  STRATEGY_SELECTED: 'strategy_selected',
  
  // Social Selling Activity Types
  SOCIAL_SELLING_CAMPAIGN_LAUNCHED: 'social_selling_campaign_launched',
  SOCIAL_SELLING_CAMPAIGN_STOPPED: 'social_selling_campaign_stopped',
  PLATFORM_LAUNCHED: 'platform_launched',
  PLATFORM_STOPPED: 'platform_stopped',
  DISCOVERY_COMPLETED: 'discovery_completed',
  MONITORING_STARTED: 'monitoring_started',
  MONITORING_STOPPED: 'monitoring_stopped',
  SOCIAL_ENGAGEMENT: 'social_engagement',
  DM_OPPORTUNITY: 'dm_opportunity',
  ENGAGEMENT_STARTED: 'engagement_started',
  CONVERSION_STARTED: 'conversion_started',
  
  // Reddit-specific
  REPLY_OPPORTUNITIES_FOUND: 'reply_opportunities_found',
  
  // Facebook-specific
  FACEBOOK_HARVESTING_STARTED: 'facebook_harvesting_started',
  GROUPS_JOINED: 'groups_joined',
  MEMBERS_IDENTIFIED: 'members_identified',
  FRIEND_REQUESTS_SENT: 'friend_requests_sent',
  DM_CAMPAIGNS_LAUNCHED: 'dm_campaigns_launched',
  HARVESTING_STOPPED: 'harvesting_stopped',
  
  // LinkedIn-specific
  LINKEDIN_OUTBOUND_STARTED: 'linkedin_outbound_started',
  PROSPECT_SEARCH_COMPLETED: 'prospect_search_completed',
  CONNECTION_REQUESTS_SENT: 'connection_requests_sent',
  FOLLOWUP_SEQUENCE_EXECUTED: 'followup_sequence_executed',
  CALLS_BOOKED: 'calls_booked',
  OUTBOUND_STOPPED: 'outbound_stopped',
  
  // Twitter-specific
  TWITTER_REPLY_GUY_STARTED: 'twitter_reply_guy_started',
  REPLIES_SENT: 'replies_sent',
  ENGAGEMENT_DMS_SENT: 'engagement_dms_sent',
  MINI_AUDIENCES_CREATED: 'mini_audiences_created',
  REPLY_GUY_STOPPED: 'reply_guy_stopped',
  
  // Instagram-specific
  INSTAGRAM_DM_CAMPAIGN_STARTED: 'instagram_dm_campaign_started',
  COMPETITOR_FOLLOWERS_IDENTIFIED: 'competitor_followers_identified',
  STRATEGIC_ENGAGEMENT_COMPLETED: 'strategic_engagement_completed',
  VALUE_DMS_SENT: 'value_dms_sent',
  DM_CONVERSIONS_COMPLETED: 'dm_conversions_completed',
  INSTAGRAM_DM_CAMPAIGN_STOPPED: 'instagram_dm_campaign_stopped',
  
  // Cross-platform optimization
  CROSS_PLATFORM_OPTIMIZATION: 'cross_platform_optimization'
};

/**
 * Log a real AI activity
 * @param {string} businessId - Business ID
 * @param {Object} activityData - Activity details
 */
export async function logActivity(businessId, activityData) {
  try {
    const activity = {
      business_id: businessId,
      type: activityData.type,
      icon: activityData.icon,
      message: activityData.message,
      details: activityData.details || null,
      metadata: activityData.metadata || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('ai_activities')
      .insert(activity)
      .select()
      .single();

    if (error) {
      console.error('Error logging activity:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in logActivity:', error);
    return null;
  }
}

/**
 * Get activities for a business
 * @param {string} businessId - Business ID
 * @param {number} limit - Number of activities to fetch
 */
export async function getActivities(businessId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('ai_activities')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching activities:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getActivities:', error);
    return [];
  }
}

/**
 * Log prospect discovery activity
 * @param {string} businessId - Business ID
 * @param {Object} searchData - Search parameters and results
 */
export async function logProspectSearch(businessId, searchData) {
  return logActivity(businessId, {
    type: ActivityTypes.PROSPECT_SEARCH,
    icon: '🔍',
    message: `Found ${searchData.count} potential customers in ${searchData.industry}`,
    details: `Searched for: ${searchData.searchTerms}`,
    metadata: {
      industry: searchData.industry,
      count: searchData.count,
      source: searchData.source,
      searchTerms: searchData.searchTerms
    }
  });
}

/**
 * Log email sent activity
 * @param {string} businessId - Business ID
 * @param {Object} emailData - Email details
 */
export async function logEmailSent(businessId, emailData) {
  return logActivity(businessId, {
    type: ActivityTypes.EMAIL_SENT,
    icon: '📤',
    message: `Cold email sent to ${emailData.recipientEmail}`,
    details: `Subject: "${emailData.subject}"`,
    metadata: {
      recipientEmail: emailData.recipientEmail,
      recipientName: emailData.recipientName,
      recipientCompany: emailData.recipientCompany,
      subject: emailData.subject,
      emailId: emailData.emailId,
      campaignId: emailData.campaignId
    }
  });
}

/**
 * Log email opened activity
 * @param {string} businessId - Business ID
 * @param {Object} openData - Email open details
 */
export async function logEmailOpened(businessId, openData) {
  return logActivity(businessId, {
    type: ActivityTypes.EMAIL_OPENED,
    icon: '📬',
    message: `Email opened by ${openData.recipientEmail}`,
    details: `Subject: "${openData.subject}"`,
    metadata: {
      recipientEmail: openData.recipientEmail,
      emailId: openData.emailId,
      openTime: openData.openTime,
      userAgent: openData.userAgent
    }
  });
}

/**
 * Log email reply activity
 * @param {string} businessId - Business ID
 * @param {Object} replyData - Reply details
 */
export async function logEmailReply(businessId, replyData) {
  return logActivity(businessId, {
    type: ActivityTypes.EMAIL_REPLIED,
    icon: '💬',
    message: `Response received! "${replyData.previewText}"`,
    details: `From: ${replyData.recipientEmail}`,
    metadata: {
      recipientEmail: replyData.recipientEmail,
      originalEmailId: replyData.originalEmailId,
      replyText: replyData.replyText,
      sentiment: replyData.sentiment,
      isPositive: replyData.isPositive
    }
  });
}

/**
 * Log meeting booked activity
 * @param {string} businessId - Business ID
 * @param {Object} meetingData - Meeting details
 */
export async function logMeetingBooked(businessId, meetingData) {
  return logActivity(businessId, {
    type: ActivityTypes.MEETING_BOOKED,
    icon: '📅',
    message: `Meeting booked with ${meetingData.attendeeEmail}`,
    details: `Scheduled for: ${meetingData.scheduledTime}`,
    metadata: {
      attendeeEmail: meetingData.attendeeEmail,
      attendeeName: meetingData.attendeeName,
      scheduledTime: meetingData.scheduledTime,
      duration: meetingData.duration,
      meetingLink: meetingData.meetingLink
    }
  });
}

/**
 * Log campaign optimization
 * @param {string} businessId - Business ID
 * @param {Object} optimizationData - Optimization details
 */
export async function logOptimization(businessId, optimizationData) {
  return logActivity(businessId, {
    type: ActivityTypes.OPTIMIZATION,
    icon: '📊',
    message: optimizationData.message,
    details: optimizationData.details,
    metadata: {
      type: optimizationData.type,
      oldValue: optimizationData.oldValue,
      newValue: optimizationData.newValue,
      expectedImprovement: optimizationData.expectedImprovement
    }
  });
}

/**
 * Log campaign metrics update
 * @param {string} businessId - Business ID
 * @param {Object} metricsData - Metrics data
 */
export async function logMetricsUpdate(businessId, metricsData) {
  return logActivity(businessId, {
    type: ActivityTypes.METRICS_UPDATE,
    icon: '🚀',
    message: metricsData.message,
    details: metricsData.details,
    metadata: {
      emailsSent: metricsData.emailsSent,
      openRate: metricsData.openRate,
      responseRate: metricsData.responseRate,
      meetingsBooked: metricsData.meetingsBooked,
      period: metricsData.period
    }
  });
}