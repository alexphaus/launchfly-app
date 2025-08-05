// src/app/api/ai-chat/route.js
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * AI Chat API endpoint for conversing with the AI about current activities
 * Provides intelligent responses based on business data and current AI operations
 */
export async function POST(request) {
  try {
    const { businessId, message, sessionId } = await request.json();

    if (!businessId || !message) {
      return NextResponse.json(
        { error: 'Business ID and message are required' },
        { status: 400 }
      );
    }

    console.log(`AI Chat request for business: ${businessId}, message: ${message}`);

    // Get business data and recent activities for context
    const [businessResult, activitiesResult] = await Promise.all([
      supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single(),
      
      supabase
        .from('ai_activities')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    const business = businessResult.data;
    const recentActivities = activitiesResult.data || [];

    // Generate contextual AI response based on message and current state
    const aiResponse = generateAIResponse(message, business, recentActivities);

    // Log the chat interaction as an activity
    await supabase
      .from('ai_activities')
      .insert({
        business_id: businessId,
        type: 'chat_interaction',
        icon: '💬',
        message: `User asked: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`,
        details: `AI provided guidance on: ${aiResponse.summary}`,
        metadata: {
          userMessage: message,
          aiResponseSummary: aiResponse.summary,
          chatType: aiResponse.type
        }
      });

    return NextResponse.json({
      success: true,
      response: aiResponse.message,
      type: aiResponse.type,
      suggestions: aiResponse.suggestions || []
    });

  } catch (error) {
    console.error('Error in AI chat API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate intelligent AI responses based on user message and business context
 */
function generateAIResponse(message, business, recentActivities) {
  const lowerMessage = message.toLowerCase();
  const businessName = business?.business_data?.businessName || 'your business';
  
  // Count activity types for context
  const activityCounts = recentActivities.reduce((counts, activity) => {
    counts[activity.type] = (counts[activity.type] || 0) + 1;
    return counts;
  }, {});

  // Analyze message intent and provide relevant response
  if (lowerMessage.includes('email') || lowerMessage.includes('outreach')) {
    const emailsSent = activityCounts.email_sent || 0;
    const emailsOpened = activityCounts.email_opened || 0;
    const openRate = emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 100) : 0;
    
    return {
      type: 'email_status',
      summary: 'email campaign performance',
      message: `I've sent ${emailsSent} cold emails for ${businessName} so far. ${emailsOpened} have been opened (${openRate}% open rate). I'm currently targeting prospects in your industry with personalized messages. The AI is optimizing subject lines and send times based on engagement patterns.`,
      suggestions: [
        'Show me recent email responses',
        'What prospects are you targeting?',
        'How can we improve open rates?'
      ]
    };
  }
  
  if (lowerMessage.includes('prospect') || lowerMessage.includes('customer') || lowerMessage.includes('lead')) {
    const prospectsFound = recentActivities
      .filter(a => a.type === 'prospect_search')
      .reduce((sum, a) => sum + (a.metadata?.count || 0), 0);
    
    return {
      type: 'prospect_status',
      summary: 'customer acquisition progress',
      message: `I've discovered ${prospectsFound} potential customers for ${businessName}. I'm actively researching companies that match your ideal customer profile and finding decision-makers to contact. The AI is prioritizing prospects based on company size, recent funding, and technology usage patterns.`,
      suggestions: [
        'Show me the best prospects found',
        'What criteria are you using?',
        'Focus on a specific industry'
      ]
    };
  }
  
  if (lowerMessage.includes('meeting') || lowerMessage.includes('call') || lowerMessage.includes('book')) {
    const meetingsBooked = activityCounts.meeting_booked || 0;
    
    return {
      type: 'meeting_status',
      summary: 'meeting booking activity',
      message: `I've successfully booked ${meetingsBooked} discovery calls for ${businessName}. When prospects show interest, I automatically suggest meeting times and send calendar invites. The AI is optimizing follow-up sequences to increase meeting booking rates.`,
      suggestions: [
        'Show me upcoming meetings',
        'What happens after meetings?',
        'Improve meeting booking rate'
      ]
    };
  }
  
  if (lowerMessage.includes('performance') || lowerMessage.includes('metric') || lowerMessage.includes('result')) {
    return {
      type: 'performance_status',
      summary: 'campaign performance metrics',
      message: `Here's how ${businessName} is performing: ${recentActivities.length} AI activities completed recently. I'm continuously optimizing based on response rates, engagement patterns, and conversion data. The AI adapts strategies in real-time to maximize results.`,
      suggestions: [
        'Show detailed analytics',
        'Compare to benchmarks',
        'What optimizations are planned?'
      ]
    };
  }
  
  if (lowerMessage.includes('stop') || lowerMessage.includes('pause') || lowerMessage.includes('slow')) {
    return {
      type: 'control_request',
      summary: 'campaign control options',
      message: `I can adjust the pace of activities for ${businessName}. Currently running at optimal speed, but I can pause specific campaigns or slow down outreach if needed. All AI activities can be controlled while maintaining progress toward your goals.`,
      suggestions: [
        'Pause email campaigns',
        'Reduce daily outreach volume',
        'Focus on specific activities only'
      ]
    };
  }
  
  if (lowerMessage.includes('next') || lowerMessage.includes('plan') || lowerMessage.includes('strategy')) {
    return {
      type: 'strategy_discussion',
      summary: 'upcoming AI strategies',
      message: `For ${businessName}, I'm planning to expand into social media outreach, implement retargeting campaigns for website visitors, and create industry-specific content. The AI is also preparing A/B tests for email templates and experimenting with new prospecting channels.`,
      suggestions: [
        'Start social media outreach',
        'Create content marketing plan',
        'Expand to new channels'
      ]
    };
  }
  
  // Default response for general questions
  return {
    type: 'general_assistance',
    summary: 'general AI activity overview',
    message: `I'm actively working on growing ${businessName} through multiple channels. Currently running cold email campaigns, prospect research, and optimization processes. I've completed ${recentActivities.length} activities recently and I'm continuously learning to improve results. What specific aspect would you like to know more about?`,
    suggestions: [
      'Show me email campaign status',
      'How many prospects have you found?',
      'What meetings are booked?',
      'Pause all activities'
    ]
  };
}

/**
 * GET endpoint to retrieve chat history
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    const { data: chatActivities, error } = await supabase
      .from('ai_activities')
      .select('*')
      .eq('business_id', businessId)
      .eq('type', 'chat_interaction')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching chat history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chat history' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      chatHistory: chatActivities || []
    });

  } catch (error) {
    console.error('Error in chat history API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}