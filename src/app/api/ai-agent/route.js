// src/app/api/ai-agent/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AdaptiveAIAgent } from '@/lib/adaptive-ai-agent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/ai-agent
 * Get AI agent status for a business, including its current plan and tasks.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const { data: business, error } = await supabase
      .from('businesses')
      .select('id, subdomain, adaptive_agent_enabled, current_plan_id')
      .eq('id', businessId)
      .single();
    
    if (error) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    
    let planData = null;
    if (business.current_plan_id) {
      const { data: plan } = await supabase
        .from('ai_plans')
        .select('*, ai_tasks(*, status)')
        .eq('id', business.current_plan_id)
        .order('priority', { foreignTable: 'ai_tasks', ascending: true })
        .single();
      planData = plan;
    }
    
    return NextResponse.json({
      business,
      plan: planData,
      status: business.adaptive_agent_enabled ? 'active' : 'disabled'
    });
    
  } catch (error) {
    console.error('Error fetching AI agent status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/ai-agent
 * Enable or disable the Adaptive AI Agent for a business.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { businessId, action } = body;
    
    if (!businessId || !action) {
      return NextResponse.json({ error: 'businessId and action are required' }, { status: 400 });
    }
    
    switch (action) {
      case 'enable':
        const agent = new AdaptiveAIAgent(businessId);
        const startResult = await agent.start();

        if (!startResult.success) {
          return NextResponse.json({ error: 'Failed to start agent', details: startResult.error }, { status: 500 });
        }
        
        await logActivity(businessId, 'adaptive_agent_enabled', '🤖', 'Adaptive AI Agent Activated', 'The agent will now create and execute a plan to grow your business.');

        return NextResponse.json({
          success: true,
          message: 'Adaptive AI Agent enabled successfully',
          planId: startResult.planId
        });
      
      case 'disable':
        await supabase
          .from('businesses')
          .update({ adaptive_agent_enabled: false })
          .eq('id', businessId);
        
        await logActivity(businessId, 'adaptive_agent_disabled', '⏸️', 'Adaptive AI Agent Paused', 'The agent will stop executing its plan.');

        return NextResponse.json({
          success: true,
          message: 'Adaptive AI Agent disabled successfully',
        });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error in AI agent control:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

async function logActivity(businessId, type, icon, message, details) {
  await supabase
    .from('ai_activities')
    .insert({
      business_id: businessId,
      type,
      icon,
      message,
      details,
    });
}
