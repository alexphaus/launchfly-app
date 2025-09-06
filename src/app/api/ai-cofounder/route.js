/**
 * API endpoint for Enhanced AI Cofounder with Integrated Revenue Systems
 * 
 * Provides control and interaction with the unified AI system that coordinates:
 * - AI Cofounder (memory, learning, autonomous thinking)
 * - Central AI Brain (cross-business intelligence)
 * - Revenue Graph Database (conversion patterns)
 * - Guarantee Engine (revenue guarantees)
 * - Real Acquisition Engine (customer acquisition)
 * - Growth Engine (experiments and optimization)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { EnhancedAICofounder } from '@/lib/ai-cofounder/enhanced-orchestrator';
import { getCentralAIBrain } from '@/lib/central-ai-brain/orchestrator';
import { getRevenueGuaranteeEngine } from '@/lib/guarantee-engine/revenue-guarantee';
import { inngest } from '@/lib/inngest/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Store active cofounder instances
const activeCofounders = new Map();

// Initialize Central AI Brain singleton
let centralBrain = null;

/**
 * GET /api/ai-cofounder
 * Get AI cofounder status and information
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const action = searchParams.get('action');

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID required' },
        { status: 400 }
      );
    }

    // Get or create cofounder instance
    let cofounder = activeCofounders.get(businessId);
    if (!cofounder) {
      cofounder = new EnhancedAICofounder(businessId);
      activeCofounders.set(businessId, cofounder);
    }

    switch (action) {
      case 'status':
        return NextResponse.json({
          status: cofounder.getStatus(),
          businessId
        });

      case 'memories':
        const memories = await cofounder.memory.recall(
          searchParams.get('query') || 'recent activities',
          { limit: 20 }
        );
        return NextResponse.json({ memories });

      case 'plan':
        return NextResponse.json({
          plan: cofounder.planner.currentPlan,
          executionHistory: cofounder.planner.executionHistory.slice(-10)
        });

      case 'experiments':
        const experiments = Array.from(cofounder.experiments.activeExperiments.values());
        return NextResponse.json({ experiments });

      case 'conversations':
        const conversations = Array.from(cofounder.conversationEngine.activeConversations.values());
        return NextResponse.json({ conversations });

      case 'metrics':
        const { data: metrics } = await supabase
          .from('business_metrics')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(30);
        
        const { data: activities } = await supabase
          .from('ai_activities')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(50);

        return NextResponse.json({ metrics, activities });
      
      case 'integrated-status':
        // Get comprehensive status from all integrated systems
        const integratedStatus = {
          aiCofounder: cofounder.getStatus(),
          businessId,
          integrations: {}
        };
        
        // Get Central AI Brain status
        if (centralBrain) {
          integratedStatus.integrations.centralBrain = {
            active: true,
            totalBusinesses: centralBrain.businessAgents.size,
            systemMetrics: centralBrain.systemMetrics
          };
        }
        
        // Get Revenue Graph status
        if (centralBrain?.revenueAnalyzer) {
          const { data: patterns } = await supabase
            .from('revenue_patterns')
            .select('count')
            .limit(1);
          
          integratedStatus.integrations.revenueGraph = {
            active: true,
            patternsStored: patterns?.[0]?.count || 0
          };
        }
        
        // Get Guarantee status
        const guaranteeEngine = getRevenueGuaranteeEngine();
        if (guaranteeEngine) {
          const { data: guarantee } = await supabase
            .from('revenue_guarantees')
            .select('*')
            .eq('business_id', businessId)
            .eq('status', 'active')
            .single();
          
          integratedStatus.integrations.guaranteeEngine = {
            active: true,
            currentGuarantee: guarantee
          };
        }
        
        // Get Growth Engine status
        const { data: growthSessions } = await supabase
          .from('growth_sessions')
          .select('*')
          .eq('business_id', businessId)
          .eq('status', 'active')
          .limit(1);
        
        integratedStatus.integrations.growthEngine = {
          active: growthSessions?.length > 0,
          activeSessions: growthSessions?.length || 0
        };
        
        return NextResponse.json(integratedStatus);

      default:
        return NextResponse.json({
          businessId,
          status: cofounder.getStatus(),
          message: 'AI Cofounder is ready'
        });
    }
  } catch (error) {
    console.error('Error in AI Cofounder GET:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
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

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID required' },
        { status: 400 }
      );
    }

    // Get or create cofounder instance
    let cofounder = activeCofounders.get(businessId);
    if (!cofounder) {
      cofounder = new EnhancedAICofounder(businessId);
      activeCofounders.set(businessId, cofounder);
    }

    switch (action) {
      case 'initialize':
        // Initialize Central AI Brain if not already done
        if (!centralBrain) {
          try {
            const { CentralAIBrain } = await import('@/lib/central-ai-brain/orchestrator');
            centralBrain = new CentralAIBrain();
            await centralBrain.initialize();
            console.log('✅ Central AI Brain initialized for integrated operation');
          } catch (error) {
            console.warn('Central AI Brain initialization failed, continuing without it:', error);
          }
        }
        
        const initResult = await cofounder.initialize();
        return NextResponse.json({
          success: true,
          result: initResult,
          integrations: {
            centralBrain: !!centralBrain,
            revenueGraph: !!centralBrain?.revenueAnalyzer,
            guaranteeEngine: !!getRevenueGuaranteeEngine()
          }
        });

      case 'start':
        await cofounder.startAutonomousOperation();
        
        // Also trigger Inngest functions
        await inngest.send({
          name: 'ai-cofounder/started',
          data: { businessId }
        });
        
        return NextResponse.json({
          success: true,
          message: 'AI Cofounder started'
        });

      case 'stop':
        await cofounder.stop();
        return NextResponse.json({
          success: true,
          message: 'AI Cofounder stopped'
        });

      case 'think':
        // Trigger immediate thinking cycle
        const thinkResult = await cofounder.think();
        return NextResponse.json({
          success: true,
          result: thinkResult
        });

      case 'plan':
        // Create or update plan
        const planResult = await cofounder.planner.createPlan(
          data.goals || [],
          data.context || {}
        );
        return NextResponse.json({
          success: true,
          plan: planResult
        });

      case 'execute':
        // Execute current plan
        const executeResult = await cofounder.planner.executePlan();
        return NextResponse.json({
          success: true,
          result: executeResult
        });

      case 'experiment':
        // Launch new experiment
        const experimentResult = await cofounder.experiments.launchExperiment(data);
        return NextResponse.json({
          success: true,
          experiment: experimentResult
        });

      case 'conversation':
        // Start or continue conversation
        if (data.conversationId) {
          // Continue existing conversation
          const response = await cofounder.conversationEngine.processMessage(
            data.conversationId,
            data.message
          );
          return NextResponse.json({
            success: true,
            response
          });
        } else {
          // Start new conversation
          const conversation = await cofounder.conversationEngine.startConversation(
            data.participant,
            data.context
          );
          return NextResponse.json({
            success: true,
            conversation
          });
        }

      case 'remember':
        // Store a memory
        await cofounder.memory.remember(data);
        return NextResponse.json({
          success: true,
          message: 'Memory stored'
        });

      case 'learn':
        // Learn from outcome
        await cofounder.memory.learnFromOutcome(data);
        return NextResponse.json({
          success: true,
          message: 'Learning processed'
        });

      case 'adapt':
        // Adapt current plan
        const adaptResult = await cofounder.planner.adaptPlan(data.reason);
        return NextResponse.json({
          success: true,
          adapted: adaptResult
        });

      case 'set_mode':
        // Change operating mode
        cofounder.state.mode = data.mode || 'autonomous';
        return NextResponse.json({
          success: true,
          mode: cofounder.state.mode
        });

      case 'set_focus':
        // Change focus area
        cofounder.state.focus = data.focus || 'growth';
        return NextResponse.json({
          success: true,
          focus: cofounder.state.focus
        });

      case 'enable':
        // Enable AI for business
        await supabase
          .from('businesses')
          .update({ ai_enabled: true })
          .eq('id', businessId);
        
        await cofounder.initialize();
        
        return NextResponse.json({
          success: true,
          message: 'AI Cofounder enabled'
        });

      case 'disable':
        // Disable AI for business
        await supabase
          .from('businesses')
          .update({ ai_enabled: false })
          .eq('id', businessId);
        
        await cofounder.stop();
        activeCofounders.delete(businessId);
        
        return NextResponse.json({
          success: true,
          message: 'AI Cofounder disabled'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in AI Cofounder POST:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-cofounder
 * Clean up AI cofounder data
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID required' },
        { status: 400 }
      );
    }

    // Stop cofounder if running
    const cofounder = activeCofounders.get(businessId);
    if (cofounder) {
      await cofounder.stop();
      activeCofounders.delete(businessId);
    }

    // Clean up data based on what to delete
    const deleteType = searchParams.get('type') || 'all';

    if (deleteType === 'memories' || deleteType === 'all') {
      await supabase
        .from('ai_memories')
        .delete()
        .eq('business_id', businessId);
    }

    if (deleteType === 'experiments' || deleteType === 'all') {
      await supabase
        .from('ai_experiments')
        .delete()
        .eq('business_id', businessId);
    }

    if (deleteType === 'conversations' || deleteType === 'all') {
      await supabase
        .from('ai_conversations')
        .delete()
        .eq('business_id', businessId);
    }

    if (deleteType === 'plans' || deleteType === 'all') {
      await supabase
        .from('ai_business_plans')
        .delete()
        .eq('business_id', businessId);
    }

    return NextResponse.json({
      success: true,
      message: `AI Cofounder data cleaned up (${deleteType})`
    });
  } catch (error) {
    console.error('Error in AI Cofounder DELETE:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
