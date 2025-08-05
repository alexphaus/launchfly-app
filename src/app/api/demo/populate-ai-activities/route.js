// src/app/api/demo/populate-ai-activities/route.js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { 
  logActivity, 
  logProspectSearch, 
  logEmailSent, 
  logEmailOpened, 
  logEmailReply,
  logMeetingBooked,
  logOptimization,
  logMetricsUpdate
} from '@/lib/activity-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Demo API endpoint to populate realistic AI activities
 * This helps demonstrate the AI activity page with real-looking data
 */
export async function POST(request) {
  try {
    const { businessId } = await request.json();

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    console.log(`🎯 Populating demo AI activities for business: ${businessId}`);

    // Get business data for context
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    const businessName = business.business_data?.businessName || 'Demo Business';
    const industry = business.business_data?.industry || 'Technology';

    // Create realistic demo activities
    const activities = [];

    // Recent prospect search
    activities.push(await logProspectSearch(businessId, {
      count: 25,
      industry: industry,
      source: 'LinkedIn Sales Navigator',
      searchTerms: `${industry} decision makers, 50-500 employees`
    }));

    // Email outreach activities
    const emails = [
      {
        recipientEmail: 'sarah.johnson@techcorp.com',
        recipientName: 'Sarah Johnson',
        recipientCompany: 'TechCorp Solutions',
        subject: `Quick question about ${industry} growth at TechCorp`,
        emailId: 'demo-email-1'
      },
      {
        recipientEmail: 'mike.chen@innovateco.com',
        recipientName: 'Mike Chen',
        recipientCompany: 'InnovateCo',
        subject: `${businessName} - helping ${industry} companies scale`,
        emailId: 'demo-email-2'
      },
      {
        recipientEmail: 'lisa.rodriguez@growthtech.io',
        recipientName: 'Lisa Rodriguez',
        recipientCompany: 'GrowthTech',
        subject: 'Partnership opportunity for rapid growth',
        emailId: 'demo-email-3'
      }
    ];

    for (const email of emails) {
      activities.push(await logEmailSent(businessId, email));
    }

    // Email opens
    activities.push(await logEmailOpened(businessId, {
      recipientEmail: 'sarah.johnson@techcorp.com',
      emailId: 'demo-email-1',
      subject: emails[0].subject,
      openTime: new Date().toISOString(),
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    }));

    // Email reply
    activities.push(await logEmailReply(businessId, {
      recipientEmail: 'mike.chen@innovateco.com',
      originalEmailId: 'demo-email-2',
      replyText: 'Hi! This looks interesting. Can we schedule a quick call this week?',
      previewText: 'Hi! This looks interesting. Can we schedule...',
      sentiment: 'positive',
      isPositive: true
    }));

    // Meeting booked
    activities.push(await logMeetingBooked(businessId, {
      attendeeEmail: 'mike.chen@innovateco.com',
      attendeeName: 'Mike Chen',
      scheduledTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      duration: 30,
      meetingLink: 'https://zoom.us/j/demo-meeting'
    }));

    // Optimization activity
    activities.push(await logOptimization(businessId, {
      message: 'Email subject line optimization increased open rates',
      details: 'A/B tested 5 different subject line formats, increased open rate from 28% to 35%',
      type: 'email_optimization',
      oldValue: '28%',
      newValue: '35%',
      expectedImprovement: '25% more meetings booked'
    }));

    // Metrics update
    activities.push(await logMetricsUpdate(businessId, {
      message: 'Weekly campaign performance summary',
      details: 'Sent 47 emails, 16 opens, 3 replies, 1 meeting booked this week',
      emailsSent: 47,
      openRate: 34,
      responseRate: 6.4,
      meetingsBooked: 1,
      period: 'week'
    }));

    // Additional prospect search with different criteria
    activities.push(await logProspectSearch(businessId, {
      count: 18,
      industry: 'SaaS',
      source: 'Apollo.io',
      searchTerms: 'SaaS founders, recently funded, hiring'
    }));

    // Content creation activity
    activities.push(await logActivity(businessId, {
      type: 'content_created',
      icon: '✍️',
      message: `Created personalized LinkedIn outreach sequence for ${industry} prospects`,
      details: 'Generated 3 connection request templates and 5 follow-up message variations',
      metadata: {
        contentType: 'linkedin_sequence',
        templateCount: 8,
        industry: industry
      }
    }));

    // Competitor analysis
    activities.push(await logActivity(businessId, {
      type: 'competitor_analysis',
      icon: '🔍',
      message: 'Analyzed top 5 competitors\' outreach strategies',
      details: 'Identified 3 messaging patterns with higher response rates to implement',
      metadata: {
        competitorsAnalyzed: 5,
        newTacticsIdentified: 3,
        implementationPriority: 'high'
      }
    }));

    console.log(`✅ Created ${activities.filter(a => a).length} demo activities for ${businessName}`);

    return NextResponse.json({
      success: true,
      message: `Created ${activities.filter(a => a).length} demo AI activities`,
      activities: activities.filter(a => a)
    });

  } catch (error) {
    console.error('Error populating demo activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to clear demo activities
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // Delete all activities for the business
    const { error } = await supabase
      .from('ai_activities')
      .delete()
      .eq('business_id', businessId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Demo activities cleared'
    });

  } catch (error) {
    console.error('Error clearing demo activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}