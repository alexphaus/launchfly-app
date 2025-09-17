/**
 * Pattern Recognition Engine
 * 
 * Spots important business patterns from data without expensive analysis
 * Triggers focused AI analysis only when patterns indicate real issues/opportunities
 */

import { createClient } from '@supabase/supabase-js';
import { getMinimalAICofounder } from './minimal-orchestrator.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export class PatternRecognition {
  constructor(businessId) {
    this.businessId = businessId;
    
    // Define patterns to watch for
    this.patterns = [
      {
        id: 'leaky_funnel',
        name: 'Leaky Funnel Alert',
        condition: (counters) => 
          counters.leads_captured > 10 && counters.payments_completed < 1,
        severity: 'high',
        analysisType: 'conversion_analysis'
      },
      {
        id: 'winning_channel',
        name: 'Winning Channel Detected',
        condition: (counters) => 
          counters.payments_completed >= 3 && this.hasDominantSource(counters.payment_sources),
        severity: 'opportunity',
        analysisType: 'channel_optimization'
      },
      {
        id: 'checkout_friction',
        name: 'Checkout Friction Alert',
        condition: (counters) => 
          counters.carts_abandoned > 5 && this.isRecentTimeframe(counters.last_abandonment, 24),
        severity: 'medium',
        analysisType: 'checkout_optimization'
      },
      {
        id: 'pricing_resistance',
        name: 'Pricing Resistance Pattern',
        condition: (counters) => 
          counters.checkouts_started > 20 && (counters.payments_completed / counters.checkouts_started) < 0.1,
        severity: 'medium',
        analysisType: 'pricing_analysis'
      },
      {
        id: 'engagement_surge',
        name: 'High Engagement Opportunity',
        condition: (counters) => 
          counters.email_replies > 5 && this.isRecentTimeframe(counters.last_reply, 48),
        severity: 'opportunity',
        analysisType: 'engagement_optimization'
      },
      {
        id: 'revenue_milestone',
        name: 'Revenue Milestone Achieved',
        condition: (counters) => 
          this.checkMilestone(counters.total_revenue, [100, 500, 1000, 5000, 10000]),
        severity: 'celebration',
        analysisType: 'growth_strategy'
      }
    ];
  }

  /**
   * Increment event counter (called from event handlers)
   */
  async incrementCounter(eventType, metadata = {}) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get existing counters for today
      const { data: existing } = await supabase
        .from('ai_event_counters')
        .select('*')
        .eq('business_id', this.businessId)
        .eq('date', today)
        .single();

      let counters = existing?.counters || {};
      
      // Increment the specific counter
      const counterKey = this.getCounterKey(eventType);
      counters[counterKey] = (counters[counterKey] || 0) + 1;
      
      // Update metadata for pattern analysis
      if (eventType === 'payment.completed' && metadata.source) {
        if (!counters.payment_sources) counters.payment_sources = {};
        counters.payment_sources[metadata.source] = (counters.payment_sources[metadata.source] || 0) + 1;
      }
      
      if (eventType === 'cart.abandoned') {
        counters.last_abandonment = new Date().toISOString();
      }
      
      if (eventType === 'email.replied') {
        counters.last_reply = new Date().toISOString();
      }
      
      if (eventType === 'payment.completed') {
        counters.total_revenue = (counters.total_revenue || 0) + (metadata.amount || 0);
      }

      // Upsert counters
      await supabase
        .from('ai_event_counters')
        .upsert({
          business_id: this.businessId,
          date: today,
          counters,
          updated_at: new Date().toISOString()
        });

      // Check for pattern matches
      await this.checkPatterns(counters);

    } catch (error) {
      console.error('Error incrementing counter:', error);
    }
  }

  /**
   * Check if any patterns match current counters
   */
  async checkPatterns(counters) {
    try {
      for (const pattern of this.patterns) {
        if (pattern.condition(counters)) {
          // Check if we've already triggered this pattern recently
          const recentTrigger = await this.hasRecentTrigger(pattern.id);
          if (recentTrigger) continue;

          // Trigger pattern analysis
          await this.triggerPatternAnalysis(pattern, counters);
        }
      }
    } catch (error) {
      console.error('Error checking patterns:', error);
    }
  }

  /**
   * Trigger focused AI analysis for a pattern
   */
  async triggerPatternAnalysis(pattern, counters) {
    try {
      console.log(`🔍 Pattern detected: ${pattern.name} for business ${this.businessId}`);

      // Record pattern trigger
      await supabase
        .from('pattern_triggers')
        .insert({
          business_id: this.businessId,
          pattern_id: pattern.id,
          pattern_name: pattern.name,
          severity: pattern.severity,
          counters,
          triggered_at: new Date().toISOString()
        });

      // Get AI instance and trigger analysis
      const ai = getMinimalAICofounder(this.businessId);
      
      const analysisResult = await ai.assist({
        action: 'analyze',
        data: {
          type: pattern.analysisType,
          pattern: pattern.name,
          counters,
          severity: pattern.severity
        }
      });

      // Store analysis result with high importance
      if (analysisResult.success) {
        await supabase
          .from('ai_memories_simple')
          .insert({
            business_id: this.businessId,
            key: `pattern_analysis_${pattern.id}_${Date.now()}`,
            value: JSON.stringify({
              pattern: pattern.name,
              analysis: analysisResult.result,
              counters,
              actionable: true
            }),
            importance: pattern.severity === 'high' ? 0.9 : 0.8,
            created_at: new Date().toISOString()
          });
      }

      return analysisResult;
    } catch (error) {
      console.error('Error triggering pattern analysis:', error);
    }
  }

  /**
   * Check if pattern was recently triggered (avoid spam)
   */
  async hasRecentTrigger(patternId) {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      const { data } = await supabase
        .from('pattern_triggers')
        .select('id')
        .eq('business_id', this.businessId)
        .eq('pattern_id', patternId)
        .gte('triggered_at', oneDayAgo.toISOString())
        .limit(1);

      return data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get counter key for event type
   */
  getCounterKey(eventType) {
    const keyMap = {
      'lead.captured': 'leads_captured',
      'payment.completed': 'payments_completed',
      'checkout.started': 'checkouts_started',
      'cart.abandoned': 'carts_abandoned',
      'email.sent': 'emails_sent',
      'email.replied': 'email_replies'
    };
    
    return keyMap[eventType] || eventType.replace('.', '_');
  }

  /**
   * Check if one source dominates payments
   */
  hasDominantSource(sources) {
    if (!sources || Object.keys(sources).length < 2) return false;
    
    const total = Object.values(sources).reduce((sum, count) => sum + count, 0);
    const maxSource = Math.max(...Object.values(sources));
    
    return (maxSource / total) > 0.6; // 60%+ from one source = dominant
  }

  /**
   * Check if timestamp is within timeframe
   */
  isRecentTimeframe(timestamp, hours) {
    if (!timestamp) return false;
    
    const eventTime = new Date(timestamp);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);
    
    return eventTime > cutoff;
  }

  /**
   * Check if we hit a revenue milestone
   */
  checkMilestone(currentRevenue, milestones) {
    // Check if we recently crossed a milestone
    const lastCheck = this.getLastMilestoneCheck();
    
    for (const milestone of milestones) {
      if (currentRevenue >= milestone && (!lastCheck || lastCheck < milestone)) {
        this.setLastMilestoneCheck(milestone);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get/set milestone tracking (simple in-memory for now)
   */
  getLastMilestoneCheck() {
    return this._lastMilestone || 0;
  }

  setLastMilestoneCheck(milestone) {
    this._lastMilestone = milestone;
  }

  /**
   * Get current counters for business
   */
  async getCurrentCounters() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data } = await supabase
        .from('ai_event_counters')
        .select('counters')
        .eq('business_id', this.businessId)
        .eq('date', today)
        .single();

      return data?.counters || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Get pattern trigger history
   */
  async getPatternHistory(days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data } = await supabase
        .from('pattern_triggers')
        .select('*')
        .eq('business_id', this.businessId)
        .gte('triggered_at', startDate.toISOString())
        .order('triggered_at', { ascending: false });

      return data || [];
    } catch (error) {
      console.error('Error getting pattern history:', error);
      return [];
    }
  }
}

// Singleton instances for each business
const instances = new Map();

export function getPatternRecognition(businessId) {
  if (!instances.has(businessId)) {
    instances.set(businessId, new PatternRecognition(businessId));
  }
  return instances.get(businessId);
}

/**
 * Helper function to increment counters from anywhere in the app
 */
export async function recordBusinessEvent(businessId, eventType, metadata = {}) {
  try {
    const patternEngine = getPatternRecognition(businessId);
    await patternEngine.incrementCounter(eventType, metadata);
  } catch (error) {
    console.error('Error recording business event:', error);
    // Don't throw - event recording shouldn't break the main flow
  }
}

