/**
 * Weekly Digest & Goal Setting System
 * 
 * Creates a true cofounder relationship with weekly check-ins
 * and goal alignment. Cheap but powerful.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export class WeeklyDigest {
  constructor(businessId) {
    this.businessId = businessId;
  }

  /**
   * Generate weekly digest (no LLM calls - pure data)
   */
  async generateDigest() {
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      
      const lastWeekStart = new Date();
      lastWeekStart.setDate(lastWeekStart.getDate() - 14);

      // Gather metrics for this week and last week
      const [thisWeek, lastWeek, business] = await Promise.all([
        this.getWeekMetrics(weekStart),
        this.getWeekMetrics(lastWeekStart, weekStart),
        this.getBusinessData()
      ]);

      // Calculate trends
      const trends = this.calculateTrends(thisWeek, lastWeek);

      // Get current goal if any
      const currentGoal = await this.getCurrentGoal();

      // Build digest
      const digest = {
        businessName: business.name,
        week: `Week of ${weekStart.toLocaleDateString()}`,
        metrics: {
          thisWeek,
          lastWeek,
          trends
        },
        highlights: this.generateHighlights(thisWeek, lastWeek, trends),
        concerns: this.identifyConcerns(thisWeek, lastWeek, trends),
        currentGoal,
        goalProgress: currentGoal ? this.assessGoalProgress(currentGoal, thisWeek) : null,
        timestamp: new Date().toISOString()
      };

      // Store digest
      await supabase
        .from('weekly_digests')
        .insert({
          business_id: this.businessId,
          week_start: weekStart.toISOString(),
          digest_data: digest,
          created_at: new Date().toISOString()
        });

      return digest;
    } catch (error) {
      console.error('Error generating digest:', error);
      return null;
    }
  }

  /**
   * Get metrics for a specific week
   */
  async getWeekMetrics(startDate, endDate = null) {
    const end = endDate || new Date();
    
    try {
      // Get sales data
      const { data: sales } = await supabase
        .from('sales')
        .select('amount, created_at')
        .eq('business_id', this.businessId)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', end.toISOString());

      // Get activities
      const { data: activities } = await supabase
        .from('ai_activities')
        .select('type, metadata')
        .eq('business_id', this.businessId)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', end.toISOString());

      // Calculate metrics
      const revenue = sales?.reduce((sum, sale) => sum + sale.amount, 0) || 0;
      const salesCount = sales?.length || 0;
      
      const leads = activities?.filter(a => 
        a.type === 'lead_captured' || a.type === 'email_replied'
      ).length || 0;
      
      const outreach = activities?.filter(a => 
        a.type === 'email_sent' || a.type === 'linkedin_outreach'
      ).length || 0;

      return {
        revenue,
        sales: salesCount,
        leads,
        outreach,
        avgOrderValue: salesCount > 0 ? revenue / salesCount : 0,
        conversionRate: outreach > 0 ? (salesCount / outreach * 100).toFixed(1) : 0
      };
    } catch (error) {
      console.error('Error getting week metrics:', error);
      return {
        revenue: 0,
        sales: 0,
        leads: 0,
        outreach: 0,
        avgOrderValue: 0,
        conversionRate: 0
      };
    }
  }

  /**
   * Calculate trends between weeks
   */
  calculateTrends(thisWeek, lastWeek) {
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous * 100).toFixed(1);
    };

    return {
      revenue: {
        change: calculateChange(thisWeek.revenue, lastWeek.revenue),
        direction: thisWeek.revenue > lastWeek.revenue ? 'up' : 'down'
      },
      sales: {
        change: calculateChange(thisWeek.sales, lastWeek.sales),
        direction: thisWeek.sales > lastWeek.sales ? 'up' : 'down'
      },
      leads: {
        change: calculateChange(thisWeek.leads, lastWeek.leads),
        direction: thisWeek.leads > lastWeek.leads ? 'up' : 'down'
      },
      conversion: {
        change: calculateChange(parseFloat(thisWeek.conversionRate), parseFloat(lastWeek.conversionRate)),
        direction: thisWeek.conversionRate > lastWeek.conversionRate ? 'up' : 'down'
      }
    };
  }

  /**
   * Generate highlights (no LLM needed - rule-based)
   */
  generateHighlights(thisWeek, lastWeek, trends) {
    const highlights = [];

    if (thisWeek.revenue > 0) {
      highlights.push(`💰 Generated $${thisWeek.revenue} in revenue`);
    }

    if (trends.revenue.direction === 'up' && parseFloat(trends.revenue.change) > 20) {
      highlights.push(`📈 Revenue up ${trends.revenue.change}% from last week`);
    }

    if (thisWeek.sales > lastWeek.sales) {
      highlights.push(`🎉 ${thisWeek.sales - lastWeek.sales} more sales than last week`);
    }

    if (thisWeek.leads > 5) {
      highlights.push(`🎯 Captured ${thisWeek.leads} new leads`);
    }

    if (parseFloat(thisWeek.conversionRate) > 10) {
      highlights.push(`⚡ Strong ${thisWeek.conversionRate}% conversion rate`);
    }

    return highlights.length > 0 ? highlights : ['🚀 Business is active and engaging prospects'];
  }

  /**
   * Identify concerns (rule-based)
   */
  identifyConcerns(thisWeek, lastWeek, trends) {
    const concerns = [];

    if (thisWeek.revenue === 0 && lastWeek.revenue === 0) {
      concerns.push('No revenue generated yet');
    }

    if (trends.leads.direction === 'down' && parseFloat(trends.leads.change) < -30) {
      concerns.push('Lead generation declining');
    }

    if (thisWeek.outreach > 10 && thisWeek.leads === 0) {
      concerns.push('Outreach not converting to leads');
    }

    if (parseFloat(thisWeek.conversionRate) < 2 && thisWeek.outreach > 20) {
      concerns.push('Low conversion rate needs attention');
    }

    return concerns;
  }

  /**
   * Get current business goal
   */
  async getCurrentGoal() {
    try {
      // Look for the most recent weekly goal
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7)); // Start of this week

      const { data: goal } = await supabase
        .from('ai_memories_simple')
        .select('value')
        .eq('business_id', this.businessId)
        .ilike('key', 'weekly_goal_%')
        .gte('created_at', weekStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (goal) {
        return JSON.parse(goal.value);
      }
    } catch (error) {
      // No goal found
    }
    
    return null;
  }

  /**
   * Assess progress toward current goal
   */
  assessGoalProgress(goal, thisWeekMetrics) {
    if (!goal || !goal.target) return null;

    const progress = {
      goal: goal.description,
      target: goal.target,
      current: 0,
      percentage: 0,
      onTrack: false
    };

    // Parse goal target (simple patterns)
    const targetText = goal.target.toLowerCase();
    
    if (targetText.includes('lead')) {
      const targetNumber = parseInt(targetText.match(/\d+/)?.[0] || '0');
      progress.current = thisWeekMetrics.leads;
      progress.target = targetNumber;
      progress.percentage = targetNumber > 0 ? (thisWeekMetrics.leads / targetNumber * 100) : 0;
    } else if (targetText.includes('sale') || targetText.includes('customer')) {
      const targetNumber = parseInt(targetText.match(/\d+/)?.[0] || '0');
      progress.current = thisWeekMetrics.sales;
      progress.target = targetNumber;
      progress.percentage = targetNumber > 0 ? (thisWeekMetrics.sales / targetNumber * 100) : 0;
    } else if (targetText.includes('revenue') || targetText.includes('$')) {
      const targetNumber = parseInt(targetText.match(/\d+/)?.[0] || '0');
      progress.current = thisWeekMetrics.revenue;
      progress.target = targetNumber;
      progress.percentage = targetNumber > 0 ? (thisWeekMetrics.revenue / targetNumber * 100) : 0;
    }

    progress.onTrack = progress.percentage >= 70; // 70% or more = on track
    progress.percentage = Math.min(100, Math.round(progress.percentage));

    return progress;
  }

  /**
   * Set a new weekly goal
   */
  async setWeeklyGoal(goalDescription, target) {
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7));
      const weekKey = `weekly_goal_${weekStart.getFullYear()}_w${this.getWeekNumber(weekStart)}`;

      const goalData = {
        description: goalDescription,
        target,
        setAt: new Date().toISOString(),
        weekStart: weekStart.toISOString()
      };

      // Store in lightweight memory with maximum importance
      await supabase
        .from('ai_memories_simple')
        .upsert({
          business_id: this.businessId,
          key: weekKey,
          value: JSON.stringify(goalData),
          importance: 1.0,
          created_at: new Date().toISOString()
        });

      return goalData;
    } catch (error) {
      console.error('Error setting weekly goal:', error);
      throw error;
    }
  }

  /**
   * Get business data
   */
  async getBusinessData() {
    const { data } = await supabase
      .from('businesses')
      .select('name, business_data')
      .eq('id', this.businessId)
      .single();
    
    return data || { name: 'Your Business' };
  }

  /**
   * Get week number
   */
  getWeekNumber(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
  }
}

