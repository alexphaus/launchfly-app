/**
 * Cost Guard System
 * 
 * Prevents runaway AI costs with daily budget limits
 * Tracks usage and stops operations when budget exceeded
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export class CostGuard {
  constructor(businessId) {
    this.businessId = businessId;
    this.dailyBudget = parseFloat(process.env.AI_DAILY_BUDGET || '1.00');
    this.warningThreshold = 0.8; // Warn at 80% of budget
  }

  /**
   * Check if an operation can proceed within budget
   * @param {string} operation - The operation being performed
   * @param {number} estimatedCost - Estimated cost in dollars
   * @returns {boolean} True if operation can proceed
   */
  async canProceed(operation, estimatedCost) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's usage
      const { data: usage } = await supabase
        .from('ai_usage')
        .select('total_cost')
        .eq('business_id', this.businessId)
        .eq('date', today)
        .single();

      const currentCost = usage?.total_cost || 0;
      const projectedCost = currentCost + estimatedCost;

      // Check if we're over budget
      if (projectedCost > this.dailyBudget) {
        console.warn(`AI budget exceeded for business ${this.businessId}: $${projectedCost} > $${this.dailyBudget}`);
        
        // Log budget exceeded event
        await this.logBudgetExceeded(operation, estimatedCost, currentCost);
        
        return false;
      }

      // Warn if approaching limit
      if (projectedCost > this.dailyBudget * this.warningThreshold) {
        console.warn(`AI budget warning for business ${this.businessId}: $${projectedCost} approaching $${this.dailyBudget}`);
      }

      // Record the usage
      await this.recordUsage(operation, estimatedCost);
      
      return true;
    } catch (error) {
      console.error('Error checking budget:', error);
      // Default to allowing operation if we can't check budget
      // This prevents system failure due to budget check errors
      return true;
    }
  }

  /**
   * Record AI usage for tracking
   * @param {string} operation - The operation performed
   * @param {number} cost - Actual or estimated cost
   */
  async recordUsage(operation, cost) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get existing record for today
      const { data: existing } = await supabase
        .from('ai_usage')
        .select('*')
        .eq('business_id', this.businessId)
        .eq('date', today)
        .single();

      if (existing) {
        // Update existing record
        await supabase
          .from('ai_usage')
          .update({
            total_cost: existing.total_cost + cost,
            operation_count: existing.operation_count + 1,
            operations: [...(existing.operations || []), {
              operation,
              cost,
              timestamp: new Date().toISOString()
            }],
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Create new record for today
        await supabase
          .from('ai_usage')
          .insert({
            business_id: this.businessId,
            date: today,
            total_cost: cost,
            operation_count: 1,
            operations: [{
              operation,
              cost,
              timestamp: new Date().toISOString()
            }],
            created_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Error recording usage:', error);
      // Don't throw - usage tracking shouldn't break operations
    }
  }

  /**
   * Get remaining budget for today
   * @returns {number} Remaining budget in dollars
   */
  async getRemainingBudget() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: usage } = await supabase
        .from('ai_usage')
        .select('total_cost')
        .eq('business_id', this.businessId)
        .eq('date', today)
        .single();

      const used = usage?.total_cost || 0;
      return Math.max(0, this.dailyBudget - used);
    } catch (error) {
      console.error('Error getting remaining budget:', error);
      return this.dailyBudget;
    }
  }

  /**
   * Get usage statistics
   * @param {number} days - Number of days to look back
   * @returns {Object} Usage statistics
   */
  async getUsageStats(days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data: usage } = await supabase
        .from('ai_usage')
        .select('*')
        .eq('business_id', this.businessId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (!usage || usage.length === 0) {
        return {
          totalCost: 0,
          totalOperations: 0,
          averageDailyCost: 0,
          peakDay: null,
          mostExpensiveOperation: null
        };
      }

      const totalCost = usage.reduce((sum, day) => sum + day.total_cost, 0);
      const totalOperations = usage.reduce((sum, day) => sum + day.operation_count, 0);
      const averageDailyCost = totalCost / usage.length;
      
      // Find peak usage day
      const peakDay = usage.reduce((peak, day) => 
        day.total_cost > (peak?.total_cost || 0) ? day : peak
      , null);

      // Find most expensive operation
      let mostExpensiveOperation = null;
      for (const day of usage) {
        if (day.operations) {
          for (const op of day.operations) {
            if (!mostExpensiveOperation || op.cost > mostExpensiveOperation.cost) {
              mostExpensiveOperation = op;
            }
          }
        }
      }

      return {
        totalCost,
        totalOperations,
        averageDailyCost,
        peakDay: peakDay?.date,
        peakCost: peakDay?.total_cost,
        mostExpensiveOperation,
        dailyBudget: this.dailyBudget,
        daysOverBudget: usage.filter(day => day.total_cost > this.dailyBudget).length
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return null;
    }
  }

  /**
   * Log when budget is exceeded
   */
  async logBudgetExceeded(operation, estimatedCost, currentCost) {
    try {
      await supabase
        .from('ai_budget_events')
        .insert({
          business_id: this.businessId,
          event_type: 'budget_exceeded',
          operation,
          estimated_cost: estimatedCost,
          current_cost: currentCost,
          daily_budget: this.dailyBudget,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging budget exceeded:', error);
    }
  }

  /**
   * Reset daily budget (for testing)
   */
  async resetDailyBudget() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await supabase
        .from('ai_usage')
        .delete()
        .eq('business_id', this.businessId)
        .eq('date', today);
      
      console.log('Daily budget reset for business:', this.businessId);
    } catch (error) {
      console.error('Error resetting budget:', error);
    }
  }

  /**
   * Update daily budget
   */
  setDailyBudget(newBudget) {
    this.dailyBudget = parseFloat(newBudget);
    console.log(`Daily budget updated to $${this.dailyBudget} for business ${this.businessId}`);
  }
}

