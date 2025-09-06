// src/app/api/ai-cofounder/route.js
/**
 * AI Cofounder API - Next-Generation Business Intelligence
 * 
 * Endpoints for the adaptive AI cofounder:
 * - Initialize AI cofounder for a business
 * - Trigger thinking/planning cycles
 * - Handle conversations and communications
 * - Get insights and recommendations
 * - Control autonomous operations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  initializeAdaptiveAICofounder, 
  getAICofounder, 
  runAICofounderThinking 
} from '@/lib/ai-cofounder/adaptive-intelligence';
import { 
  handleBusinessMessage,
  initializeConversationEngine 
} from '@/lib/ai-cofounder/conversation-engine';
import { 
  executeTaskAutonomously 
} from '@/lib/ai-cofounder/autonomous-executor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/ai-cofounder
 * Get AI cofounder status and recent activities
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const action = searchParams.get('action');
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    switch (action) {
      case 'status':
        return await getCofounderStatus(businessId);
      case 'insights':
        return await getCofounderInsights(businessId);
      case 'conversations':
        return await getRecentConversations(businessId);
      case 'performance':
        return await getPerformanceAnalysis(businessId);
      default:
        return await getCofounderOverview(businessId);
    }
    
  } catch (error) {
    console.error('Error in AI cofounder GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/ai-cofounder
 * Control AI cofounder operations
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { businessId, action, data } = body;
    
    if (!businessId || !action) {
      return NextResponse.json({ error: 'businessId and action are required' }, { status: 400 });
    }

    switch (action) {
      case 'initialize':
        return await initializeCofounder(businessId);
      case 'think':
        return await triggerThinking(businessId);
      case 'message':
        return await handleMessage(businessId, data);
      case 'execute_task':
        return await executeTask(businessId, data);
      case 'get_recommendations':
        return await getRecommendations(businessId, data);
      case 'update_settings':
        return await updateCofounderSettings(businessId, data);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error in AI cofounder POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Initialize AI cofounder for a business
 */
async function initializeCofounder(businessId) {
  try {
    const result = await initializeAdaptiveAICofounder(businessId);
    
    // Enable AI cofounder in business record
    await supabase
      .from('businesses')
      .update({
        ai_cofounder_enabled: true,
        ai_cofounder_initialized_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId);

    return NextResponse.json({
      success: true,
      message: 'AI Cofounder initialized successfully',
      result
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to initialize AI Cofounder',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Trigger AI cofounder thinking cycle
 */
async function triggerThinking(businessId) {
  try {
    const result = await runAICofounderThinking(businessId);
    
    return NextResponse.json({
      success: true,
      message: 'AI Cofounder thinking cycle completed',
      insights: result.insights?.length || 0,
      actionsExecuted: result.actionsExecuted
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to run thinking cycle',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Handle incoming message to AI cofounder
 */
async function handleMessage(businessId, data) {
  try {
    const { message, channel, sender, context } = data;
    
    const response = await handleBusinessMessage(businessId, message, channel, sender, context);
    
    return NextResponse.json({
      success: true,
      response: response.text,
      actions: response.actions || [],
      metadata: response
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to handle message',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Execute task autonomously
 */
async function executeTask(businessId, taskData) {
  try {
    const result = await executeTaskAutonomously(businessId, taskData);
    
    return NextResponse.json({
      success: true,
      message: `Task "${taskData.name}" executed successfully`,
      result
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to execute task',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Get AI cofounder recommendations
 */
async function getRecommendations(businessId, params) {
  try {
    const cofounder = await getAICofounder(businessId);
    const context = await cofounder.gatherFullContext();
    const insights = await cofounder.generateStrategicInsights(await cofounder.analyzeSituation(context));
    
    // Convert insights to actionable recommendations
    const recommendations = insights.map(insight => ({
      title: insight.title,
      description: insight.description,
      priority: insight.priority,
      expectedImpact: insight.expectedImpact,
      implementation: insight.implementation,
      timeline: insight.timeline
    }));

    return NextResponse.json({
      success: true,
      recommendations,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get recommendations',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Get AI cofounder status
 */
async function getCofounderStatus(businessId) {
  try {
    const { data: business } = await supabase
      .from('businesses')
      .select('ai_cofounder_enabled, ai_cofounder_initialized_at, ai_cofounder_settings')
      .eq('id', businessId)
      .single();

    const { data: recentActivities } = await supabase
      .from('ai_activities')
      .select('*')
      .eq('business_id', businessId)
      .eq('metadata->>cofounderGenerated', 'true')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: currentPlan } = await supabase
      .from('business_plans')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      status: business?.ai_cofounder_enabled ? 'active' : 'inactive',
      initializedAt: business?.ai_cofounder_initialized_at,
      settings: business?.ai_cofounder_settings || {},
      recentActivities: recentActivities || [],
      currentPlan: currentPlan?.plan_data || null,
      lastThinking: recentActivities?.[0]?.created_at
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get status',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Get AI cofounder insights
 */
async function getCofounderInsights(businessId) {
  try {
    const { data: insights } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: analysis } = await supabase
      .from('performance_analysis')
      .select('*')
      .eq('business_id', businessId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      insights: insights || [],
      latestAnalysis: analysis?.analysis_data || null,
      recommendations: analysis?.recommendations || []
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get insights',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Get recent conversations
 */
async function getRecentConversations(businessId) {
  try {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      conversations: conversations || [],
      totalConversations: conversations?.length || 0
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get conversations',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Update AI cofounder settings
 */
async function updateCofounderSettings(businessId, settings) {
  try {
    const { error } = await supabase
      .from('businesses')
      .update({
        ai_cofounder_settings: settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'AI Cofounder settings updated',
      settings
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to update settings',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Get comprehensive AI cofounder overview
 */
async function getCofounderOverview(businessId) {
  try {
    const [status, insights, conversations, performance] = await Promise.all([
      getCofounderStatus(businessId),
      getCofounderInsights(businessId),
      getRecentConversations(businessId),
      getPerformanceAnalysis(businessId)
    ]);

    // Parse JSON responses
    const statusData = await status.json();
    const insightsData = await insights.json();
    const conversationsData = await conversations.json();
    const performanceData = await performance.json();

    return NextResponse.json({
      overview: {
        status: statusData.status,
        lastActive: statusData.lastThinking,
        totalInsights: insightsData.insights?.length || 0,
        totalConversations: conversationsData.totalConversations || 0,
        performanceScore: performanceData.performanceScore || 'N/A'
      },
      recentActivity: statusData.recentActivities?.slice(0, 5) || [],
      topInsights: insightsData.insights?.slice(0, 3) || [],
      activeConversations: conversationsData.conversations?.filter(c => 
        new Date(c.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length || 0
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get overview',
      details: error.message
    }, { status: 500 });
  }
}

async function getPerformanceAnalysis(businessId) {
  try {
    const { data: analysis } = await supabase
      .from('performance_analysis')
      .select('*')
      .eq('business_id', businessId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      performanceScore: analysis?.analysis_data?.overallScore || 0,
      analysis: analysis?.analysis_data || null,
      recommendations: analysis?.recommendations || []
    });
  } catch (error) {
    return NextResponse.json({
      performanceScore: 0,
      analysis: null,
      recommendations: []
    });
  }
}
