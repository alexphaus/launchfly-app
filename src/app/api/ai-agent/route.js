// src/app/api/ai-agent/route.js
/**
 * AI Business Agent Control API
 * 
 * Endpoints to:
 * - Enable/disable AI agent for a business
 * - Configure AI agent settings
 * - Get AI agent status and performance
 * - Trigger manual optimizations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { startAIBusinessAgent, stopAIBusinessAgent } from '@/lib/ai-business-agent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/ai-agent
 * Get AI agent status for all businesses or specific business
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    
    if (businessId) {
      // Get status for specific business
      const { data: business, error } = await supabase
        .from('businesses')
        .select('id, subdomain, ai_agent_enabled, ai_agent_settings, business_data')
        .eq('id', businessId)
        .single();
      
      if (error) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      }
      
      // Get recent AI activities
      const { data: activities } = await supabase
        .from('ai_activities')
        .select('*')
        .eq('business_id', businessId)
        .in('type', ['ai_optimization', 'market_research', 'competitor_analysis', 'strategy_review'])
        .order('created_at', { ascending: false })
        .limit(10);
      
      // Get performance alerts
      const { data: alerts } = await supabase
        .from('performance_alerts')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5);
      
      return NextResponse.json({
        business: {
          id: business.id,
          subdomain: business.subdomain,
          aiAgentEnabled: business.ai_agent_enabled,
          settings: business.ai_agent_settings,
        },
        recentActivities: activities || [],
        activeAlerts: alerts || [],
        status: business.ai_agent_enabled ? 'active' : 'disabled'
      });
    } else {
      // Get status for all businesses
      const { data: businesses, error } = await supabase
        .from('businesses')
        .select('id, subdomain, ai_agent_enabled, total_revenue, created_at')
        .eq('status', 'ready')
        .order('created_at', { ascending: false });
      
      if (error) {
        return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 500 });
      }
      
      const stats = {
        totalBusinesses: businesses.length,
        aiAgentEnabled: businesses.filter(b => b.ai_agent_enabled).length,
        totalRevenue: businesses.reduce((sum, b) => sum + (b.total_revenue || 0), 0)
      };
      
      return NextResponse.json({
        businesses,
        stats,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Error fetching AI agent status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/ai-agent
 * Enable AI agent for a business or trigger manual optimization
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { businessId, action, settings } = body;
    
    if (!businessId || !action) {
      return NextResponse.json({ error: 'businessId and action are required' }, { status: 400 });
    }
    
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    
    switch (action) {
      case 'enable':
        // Enable AI agent
        const { error: enableError } = await supabase
          .from('businesses')
          .update({
            ai_agent_enabled: true,
            ai_agent_settings: settings || business.ai_agent_settings,
            updated_at: new Date().toISOString()
          })
          .eq('id', businessId);
        
        if (enableError) {
          return NextResponse.json({ error: 'Failed to enable AI agent' }, { status: 500 });
        }
        
        // Start the AI agent
        const startResult = await startAIBusinessAgent(businessId);
        
        // Log the activation
        await supabase
          .from('ai_activities')
          .insert({
            business_id: businessId,
            type: 'ai_agent_enabled',
            icon: '🤖',
            message: '24/7 AI Business Agent activated',
            details: 'AI will now continuously optimize your business performance',
            metadata: { settings: settings || business.ai_agent_settings }
          });
        
        return NextResponse.json({
          success: true,
          message: 'AI agent enabled successfully',
          agentStatus: 'active',
          result: startResult
        });
      
      case 'disable':
        // Disable AI agent
        const { error: disableError } = await supabase
          .from('businesses')
          .update({
            ai_agent_enabled: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', businessId);
        
        if (disableError) {
          return NextResponse.json({ error: 'Failed to disable AI agent' }, { status: 500 });
        }
        
        // Stop the AI agent
        const stopResult = await stopAIBusinessAgent(businessId);
        
        // Log the deactivation
        await supabase
          .from('ai_activities')
          .insert({
            business_id: businessId,
            type: 'ai_agent_disabled',
            icon: '⏸️',
            message: '24/7 AI Business Agent paused',
            details: 'AI optimization has been temporarily disabled',
            metadata: {}
          });
        
        return NextResponse.json({
          success: true,
          message: 'AI agent disabled successfully',
          agentStatus: 'disabled',
          result: stopResult
        });
      
      case 'optimize_now':
        // Trigger immediate optimization
        if (!business.ai_agent_enabled) {
          return NextResponse.json({ error: 'AI agent is not enabled for this business' }, { status: 400 });
        }
        
        // Trigger manual optimization via Inngest
        const { inngest } = await import('@/lib/inngest/client');
        
        await inngest.send({
          name: 'ai-agent.manual-optimization',
          data: {
            businessId,
            trigger: 'manual',
            requestedBy: 'user',
            timestamp: new Date().toISOString()
          }
        });
        
        await supabase
          .from('ai_activities')
          .insert({
            business_id: businessId,
            type: 'manual_optimization',
            icon: '⚡',
            message: 'Manual AI optimization triggered',
            details: 'Running comprehensive business analysis and optimization',
            metadata: { trigger: 'manual' }
          });
        
        return NextResponse.json({
          success: true,
          message: 'Manual optimization triggered successfully',
          status: 'optimization_started'
        });
      
      case 'update_settings':
        // Update AI agent settings
        const { error: settingsError } = await supabase
          .from('businesses')
          .update({
            ai_agent_settings: settings,
            updated_at: new Date().toISOString()
          })
          .eq('id', businessId);
        
        if (settingsError) {
          return NextResponse.json({ error: 'Failed to update AI agent settings' }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          message: 'AI agent settings updated successfully',
          settings
        });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error in AI agent control:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/ai-agent
 * Update AI agent settings
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { businessId, settings } = body;
    
    if (!businessId || !settings) {
      return NextResponse.json({ error: 'businessId and settings are required' }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('businesses')
      .update({
        ai_agent_settings: settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId);
    
    if (error) {
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'AI agent settings updated',
      settings
    });
    
  } catch (error) {
    console.error('Error updating AI agent settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/ai-agent
 * Reset AI agent for a business (clear all data and restart)
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }
    
    // Clear AI agent data
    await Promise.all([
      supabase.from('market_research').delete().eq('business_id', businessId),
      supabase.from('competitor_analysis').delete().eq('business_id', businessId),
      supabase.from('strategy_reviews').delete().eq('business_id', businessId),
      supabase.from('ab_experiments').delete().eq('business_id', businessId),
      supabase.from('performance_alerts').delete().eq('business_id', businessId),
      supabase.from('optimization_history').delete().eq('business_id', businessId)
    ]);
    
    // Reset AI agent settings to defaults
    const defaultSettings = {
      optimization_frequency: "hourly",
      auto_implement_changes: true,
      risk_tolerance: "medium",
      focus_areas: ["conversion", "email", "pricing", "traffic"],
      notification_preferences: {
        major_changes: true,
        daily_summary: true,
        weekly_report: true
      }
    };
    
    await supabase
      .from('businesses')
      .update({
        ai_agent_settings: defaultSettings,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId);
    
    // Log the reset
    await supabase
      .from('ai_activities')
      .insert({
        business_id: businessId,
        type: 'ai_agent_reset',
        icon: '🔄',
        message: 'AI Business Agent reset and restarted',
        details: 'All AI data cleared and agent restarted with fresh analysis',
        metadata: { resetAt: new Date().toISOString() }
      });
    
    return NextResponse.json({
      success: true,
      message: 'AI agent reset successfully',
      settings: defaultSettings
    });
    
  } catch (error) {
    console.error('Error resetting AI agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
