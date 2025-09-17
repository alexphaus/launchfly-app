/**
 * Unified AI API Endpoint
 * 
 * Single endpoint for all AI interactions
 * Replaces multiple endpoints with one simple interface
 */

import { NextResponse } from 'next/server';
import { getMinimalAICofounder } from '@/lib/ai-cofounder/minimal-orchestrator';
import { WeeklyDigest } from '@/lib/ai-cofounder/weekly-digest';
import { getPatternRecognition } from '@/lib/ai-cofounder/pattern-recognition';
import { getPlaybookMarketplace } from '@/lib/ai-cofounder/playbook-marketplace';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/ai - Get AI status and capabilities
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID required' },
        { status: 400 }
      );
    }

    // Get AI instance
    const ai = getMinimalAICofounder(businessId);
    const status = ai.getStatus();

    // Get usage stats if requested
    if (searchParams.get('includeStats') === 'true') {
      const stats = await ai.costGuard.getUsageStats(7);
      status.usageStats = stats;
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting AI status:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai - Main AI interaction endpoint
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { businessId, action, data, userId } = body;

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID required' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Action required' },
        { status: 400 }
      );
    }

    // Verify business exists and user has access
    const { data: business } = await supabase
      .from('businesses')
      .select('id, ai_enabled')
      .eq('id', businessId)
      .single();

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Check if AI is enabled for this business
    if (business.ai_enabled === false && action !== 'enable') {
      return NextResponse.json(
        { error: 'AI is disabled for this business' },
        { status: 403 }
      );
    }

    // Get AI instance
    const ai = getMinimalAICofounder(businessId);

    // Handle different actions
    let result;
    switch (action) {
      case 'chat':
        // Simple chat interaction
        result = await ai.assist({
          action: 'chat',
          data: {
            message: data.message,
            context: data.context
          },
          userId
        });
        break;

      case 'analyze':
        // Analyze business metrics or data
        result = await ai.assist({
          action: 'analyze',
          data: {
            type: data.type || 'metrics',
            timeframe: data.timeframe || '7d'
          },
          userId
        });
        break;

      case 'optimize':
        // Optimize something (pricing, content, etc.)
        result = await ai.assist({
          action: 'optimize',
          data: {
            target: data.target,
            current: data.current,
            goal: data.goal
          },
          userId
        });
        break;

      case 'generate':
        // Generate content
        result = await ai.assist({
          action: 'generate',
          data: {
            type: data.type,
            topic: data.topic,
            length: data.length,
            tone: data.tone
          },
          userId
        });
        break;

      case 'execute':
        // Execute a specific tool
        result = await ai.assist({
          action: 'execute',
          data: {
            tool: data.tool,
            params: data.params
          },
          userId
        });
        break;

      case 'event':
        // Handle revenue events
        result = await ai.handleRevenueEvent(data.eventType, data.eventData);
        break;

      case 'memory':
        // Memory operations
        if (data.operation === 'recall') {
          const memories = await ai.memory.recall(data.pattern);
          result = { success: true, memories };
        } else if (data.operation === 'remember') {
          await ai.memory.remember(data.key, data.value, data.importance);
          result = { success: true, message: 'Memory stored' };
        } else if (data.operation === 'export') {
          const allMemories = await ai.memory.exportAll();
          result = { success: true, memories: allMemories };
        } else {
          result = { success: false, error: 'Invalid memory operation' };
        }
        break;

      case 'tools':
        // List available tools
        const tools = ai.tools.getDescriptions();
        result = { success: true, tools };
        break;

      case 'budget':
        // Budget operations
        if (data.operation === 'check') {
          const remaining = await ai.costGuard.getRemainingBudget();
          result = { success: true, remaining, daily: ai.costGuard.dailyBudget };
        } else if (data.operation === 'reset') {
          await ai.costGuard.resetDailyBudget();
          result = { success: true, message: 'Budget reset' };
        } else if (data.operation === 'set') {
          ai.costGuard.setDailyBudget(data.amount);
          result = { success: true, message: `Budget set to $${data.amount}` };
        } else {
          result = { success: false, error: 'Invalid budget operation' };
        }
        break;

      case 'enable':
        // Enable AI for business
        await supabase
          .from('businesses')
          .update({ ai_enabled: true })
          .eq('id', businessId);
        result = { success: true, message: 'AI enabled' };
        break;

      case 'disable':
        // Disable AI for business
        await supabase
          .from('businesses')
          .update({ ai_enabled: false })
          .eq('id', businessId);
        result = { success: true, message: 'AI disabled' };
        break;

      case 'digest':
        // Weekly digest operations
        const digest = new WeeklyDigest(businessId);
        if (data.operation === 'generate') {
          const digestData = await digest.generateDigest();
          result = { success: true, digest: digestData };
        } else if (data.operation === 'set_goal') {
          const goal = await digest.setWeeklyGoal(data.description, data.target);
          result = { success: true, goal };
        } else {
          result = { success: false, error: 'Invalid digest operation' };
        }
        break;

      case 'patterns':
        // Pattern recognition operations
        const patterns = getPatternRecognition(businessId);
        if (data.operation === 'history') {
          const history = await patterns.getPatternHistory(data.days || 7);
          result = { success: true, history };
        } else if (data.operation === 'counters') {
          const counters = await patterns.getCurrentCounters();
          result = { success: true, counters };
        } else {
          result = { success: false, error: 'Invalid pattern operation' };
        }
        break;

      case 'playbooks':
        // Playbook marketplace operations
        const marketplace = getPlaybookMarketplace();
        if (data.operation === 'search') {
          const playbooks = await marketplace.getRelevantPlaybooks(businessId, data.situation);
          result = { success: true, playbooks };
        } else if (data.operation === 'apply') {
          const application = await marketplace.applyPlaybook(businessId, data.playbookId, data.customization);
          result = { success: true, application };
        } else {
          result = { success: false, error: 'Invalid playbook operation' };
        }
        break;

      default:
        // Unknown action - try to handle as generic assist
        result = await ai.assist({
          action,
          data,
          userId
        });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in AI endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai - Clean up AI data
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const target = searchParams.get('target') || 'memories';

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID required' },
        { status: 400 }
      );
    }

    const ai = getMinimalAICofounder(businessId);

    switch (target) {
      case 'memories':
        await ai.memory.clearAll();
        break;
      
      case 'usage':
        await ai.costGuard.resetDailyBudget();
        break;
      
      case 'all':
        await ai.memory.clearAll();
        await ai.costGuard.resetDailyBudget();
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid target' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Cleared ${target} for business ${businessId}`
    });
  } catch (error) {
    console.error('Error cleaning AI data:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
