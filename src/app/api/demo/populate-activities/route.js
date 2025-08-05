// src/app/api/demo/populate-activities/route.js
import { NextRequest, NextResponse } from 'next/server';
import { 
  logActivity, 
  logProspectSearch, 
  logEmailSent, 
  logEmailOpened, 
  logEmailReply,
  logMeetingBooked,
  logOptimization,
  logMetricsUpdate,
  ActivityTypes 
} from '@/lib/activity-logger';

/**
 * Demo API endpoint to populate sample customer acquisition activities
 * This shows how the real system works with actual customer hunting activities
 * 
 * Usage: POST /api/demo/populate-activities
 * Body: { businessId: "uuid-here" }
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

    console.log(`Populating demo activities for business: ${businessId}`);

    // Sample business data for demo
    const sampleBusiness = {
      businessName: "TechFlow Solutions",
      industry: "Technology",
      targetCustomers: ["SaaS companies", "Startups"]
    };

    // Create a realistic sequence of customer acquisition activities
    const activities = [];

    // Phase 1: Customer Discovery
    activities.push(
      // AI starts customer acquisition
      logActivity(businessId, {
        type: ActivityTypes.CAMPAIGN_STARTED,
        icon: '🚀',
        message: `AI is now actively hunting for customers for ${sampleBusiness.businessName}`,
        details: 'Customer acquisition engine activated',
        metadata: { businessName: sampleBusiness.businessName }
      }),

      // Prospect search activities
      logProspectSearch(businessId, {
        industry: 'Technology',
        count: 47,
        source: 'Apollo.io',
        searchTerms: 'SaaS companies, 10-100 employees, uses CRM software'
      }),

      logProspectSearch(businessId, {
        industry: 'Business Services',
        count: 32,
        source: 'Hunter.io', 
        searchTerms: 'Fast-growing startups, Series A-B, remote teams'
      }),

      logActivity(businessId, {
        type: ActivityTypes.PROSPECT_SEARCH,
        icon: '🎯',
        message: '79 high-quality prospects identified across all channels',
        details: 'Ready for personalized outreach campaigns',
        metadata: { totalProspects: 79 }
      })
    );

    // Add small delays between activities for realism
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Phase 2: Personalized Outreach
    const prospects = [
      { email: 'sarah@techstartup.com', name: 'Sarah Johnson', company: 'TechStartup Inc' },
      { email: 'mike@growthco.io', name: 'Mike Chen', company: 'GrowthCo' },
      { email: 'lisa@innovate.biz', name: 'Lisa Williams', company: 'Innovate Labs' },
      { email: 'john@scalecorp.com', name: 'John Davis', company: 'ScaleCorp' },
      { email: 'emma@venture.co', name: 'Emma Thompson', company: 'Venture Solutions' }
    ];

    for (const prospect of prospects) {
      activities.push(
        logEmailSent(businessId, {
          recipientEmail: prospect.email,
          recipientName: prospect.name,
          recipientCompany: prospect.company,
          subject: `Quick question about ${prospect.company}'s growth tech stack`,
          emailId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          campaignId: `campaign_${Date.now()}`
        })
      );
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Phase 3: Email Opens and Responses
    activities.push(
      logEmailOpened(businessId, {
        recipientEmail: 'sarah@techstartup.com',
        emailId: 'email_123',
        subject: 'Quick question about TechStartup Inc\'s growth tech stack',
        openTime: new Date().toISOString()
      }),

      logEmailOpened(businessId, {
        recipientEmail: 'mike@growthco.io', 
        emailId: 'email_124',
        subject: 'Quick question about GrowthCo\'s growth tech stack',
        openTime: new Date().toISOString()
      }),

      logEmailReply(businessId, {
        recipientEmail: 'sarah@techstartup.com',
        originalEmailId: 'email_123',
        replyText: 'Interested! Can we chat Tuesday at 2pm?',
        sentiment: 'positive',
        isPositive: true,
        previewText: 'Interested! Can we chat Tuesday at 2pm?'
      }),

      logMeetingBooked(businessId, {
        attendeeEmail: 'sarah@techstartup.com',
        attendeeName: 'Sarah Johnson',
        scheduledTime: 'Tuesday, 2:00 PM EST',
        duration: '15 minutes',
        meetingLink: 'https://calendly.com/techflow/15min'
      })
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Phase 4: Campaign Optimization
    activities.push(
      logOptimization(businessId, {
        message: 'Best performing email template: 47% response rate',
        details: 'Switching all campaigns to winning template',
        type: 'email_template_optimization',
        oldValue: '23% response rate',
        newValue: '47% response rate',
        expectedImprovement: '2x more responses'
      }),

      logOptimization(businessId, {
        message: 'A/B testing new subject line: "How [Company] increased retention 40%"',
        details: 'Testing with 20 prospects',
        type: 'subject_line_optimization',
        expectedImprovement: '25% higher open rates'
      }),

      logActivity(businessId, {
        type: ActivityTypes.OPTIMIZATION,
        icon: '💡',
        message: 'Discovered new customer segment: HR Tech companies',
        details: 'Adding 25 new prospects to outreach',
        metadata: { newSegment: 'HR Tech', prospectsAdded: 25 }
      })
    );

    // Phase 5: Performance Metrics
    activities.push(
      logMetricsUpdate(businessId, {
        message: 'Sent 12 personalized emails today',
        details: '23% open rate, 2 responses',
        emailsSent: 12,
        openRate: '23%',
        responseRate: '17%',
        meetingsBooked: 2,
        period: 'Today'
      }),

      logMetricsUpdate(businessId, {
        message: 'Weekly Results: 47 emails, 8 responses, 3 meetings',
        details: '17% response rate this week',
        emailsSent: 47,
        openRate: '32%',
        responseRate: '17%',
        meetingsBooked: 3,
        period: 'This week'
      })
    );

    // Wait for all activities to be logged
    await Promise.all(activities);

    return NextResponse.json({
      success: true,
      message: 'Demo activities populated successfully',
      businessId,
      activitiesCreated: activities.length,
      phases: [
        'Customer Discovery',
        'Personalized Outreach', 
        'Email Opens & Responses',
        'Campaign Optimization',
        'Performance Metrics'
      ]
    });

  } catch (error) {
    console.error('Error populating demo activities:', error);
    return NextResponse.json(
      { error: 'Failed to populate demo activities' },
      { status: 500 }
    );
  }
}

/**
 * Get demo instructions
 */
export async function GET() {
  return NextResponse.json({
    title: 'Customer Acquisition Demo',
    description: 'This endpoint populates sample customer acquisition activities to demonstrate the real AI system in action.',
    usage: {
      method: 'POST',
      endpoint: '/api/demo/populate-activities',
      body: { businessId: 'your-business-uuid' }
    },
    activities: [
      '🚀 AI starts hunting for customers',
      '🔍 Finds 79 prospects across multiple sources',
      '📤 Sends personalized cold emails',
      '📬 Tracks email opens in real-time',
      '💬 Processes responses and books meetings',
      '📊 Optimizes campaigns based on performance',
      '🚀 Shows real metrics and results'
    ],
    note: 'These are realistic sample activities that show how the AI customer acquisition system works in practice.'
  });
}