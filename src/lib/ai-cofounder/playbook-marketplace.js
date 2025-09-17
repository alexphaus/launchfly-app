/**
 * Playbook Marketplace System
 * 
 * Turns successful AI actions into reusable, validated playbooks
 * Creates network effects where user success benefits all users
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { ModelSelector } from './model-selector.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class PlaybookMarketplace {
  constructor() {
    this.modelSelector = new ModelSelector();
  }

  /**
   * Record a successful outcome for potential playbook creation
   */
  async recordSuccessPattern(businessId, action, outcome, context) {
    try {
      // Only record if outcome was genuinely successful
      if (!outcome.success || outcome.importance < 0.7) {
        return;
      }

      await supabase
        .from('success_patterns')
        .insert({
          business_id: businessId,
          action_type: action.type,
          action_details: action,
          outcome_data: outcome,
          context_data: context,
          success_score: outcome.importance,
          created_at: new Date().toISOString()
        });

      // Check if this pattern is ready for playbook generation
      await this.checkForPlaybookOpportunity(action.type);

    } catch (error) {
      console.error('Error recording success pattern:', error);
    }
  }

  /**
   * Check if we have enough data to create a playbook
   */
  async checkForPlaybookOpportunity(actionType) {
    try {
      // Count successful patterns of this type across all businesses
      const { count } = await supabase
        .from('success_patterns')
        .select('*', { count: 'exact', head: true })
        .eq('action_type', actionType)
        .gte('success_score', 0.8)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      // If we have 5+ successful instances, consider creating a playbook
      if (count >= 5) {
        await this.generatePlaybook(actionType);
      }
    } catch (error) {
      console.error('Error checking playbook opportunity:', error);
    }
  }

  /**
   * Generate a playbook from successful patterns
   */
  async generatePlaybook(actionType) {
    try {
      // Check if we already have a recent playbook for this action type
      const { data: existing } = await supabase
        .from('ai_playbooks')
        .select('id')
        .eq('action_type', actionType)
        .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 14 days
        .limit(1);

      if (existing && existing.length > 0) {
        return; // Already have a recent playbook
      }

      // Get successful patterns for this action type
      const { data: patterns } = await supabase
        .from('success_patterns')
        .select('*')
        .eq('action_type', actionType)
        .gte('success_score', 0.8)
        .order('success_score', { ascending: false })
        .limit(10);

      if (!patterns || patterns.length < 3) {
        return; // Not enough data
      }

      // Anonymize and generalize the patterns
      const anonymizedPatterns = patterns.map(p => ({
        action: this.anonymizeAction(p.action_details),
        outcome: this.anonymizeOutcome(p.outcome_data),
        context: this.anonymizeContext(p.context_data),
        score: p.success_score
      }));

      // Use AI to create a generalized playbook
      const model = this.modelSelector.getModel('strategize');
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: `You are a business strategy expert. Create a reusable playbook from successful patterns.
                     Focus on what made these actions successful and how other businesses can apply the same principles.`
          },
          {
            role: "user",
            content: `Action Type: ${actionType}
                     Successful Patterns: ${JSON.stringify(anonymizedPatterns)}
                     
                     Create a playbook with:
                     1. Title (clear and actionable)
                     2. When to use this playbook
                     3. Step-by-step instructions
                     4. Expected outcomes
                     5. Success factors
                     6. Common mistakes to avoid
                     
                     Format as JSON with these exact fields:
                     {
                       "title": "Playbook title",
                       "when_to_use": "Conditions for using this playbook",
                       "steps": ["Step 1", "Step 2", "Step 3"],
                       "expected_outcomes": "What to expect",
                       "success_factors": ["Factor 1", "Factor 2"],
                       "avoid_mistakes": ["Mistake 1", "Mistake 2"]
                     }`
          }
        ],
        temperature: 0.6,
        response_format: { type: "json_object" }
      });

      const playbook = JSON.parse(response.choices[0].message.content);

      // Store the playbook
      const { data: saved } = await supabase
        .from('ai_playbooks')
        .insert({
          action_type: actionType,
          title: playbook.title,
          playbook_data: playbook,
          source_patterns_count: patterns.length,
          confidence_score: this.calculateConfidence(patterns),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      console.log(`📚 Generated playbook: ${playbook.title}`);
      return saved;

    } catch (error) {
      console.error('Error generating playbook:', error);
    }
  }

  /**
   * Get relevant playbooks for a business situation
   */
  async getRelevantPlaybooks(businessId, situation) {
    try {
      // Get business context
      const { data: business } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', businessId)
        .single();

      const industry = business?.business_data?.industry || 'general';
      const businessType = business?.business_data?.businessType || 'service';

      // Find playbooks that match the situation and business type
      const { data: playbooks } = await supabase
        .from('ai_playbooks')
        .select('*')
        .gte('confidence_score', 0.7)
        .order('confidence_score', { ascending: false })
        .limit(5);

      // Filter and score playbooks based on relevance
      const relevantPlaybooks = playbooks?.map(p => ({
        ...p,
        relevance_score: this.calculateRelevance(p, situation, industry, businessType)
      }))
      .filter(p => p.relevance_score > 0.5)
      .sort((a, b) => b.relevance_score - a.relevance_score) || [];

      return relevantPlaybooks;
    } catch (error) {
      console.error('Error getting relevant playbooks:', error);
      return [];
    }
  }

  /**
   * Apply a playbook to a business
   */
  async applyPlaybook(businessId, playbookId, customization = {}) {
    try {
      // Get the playbook
      const { data: playbook } = await supabase
        .from('ai_playbooks')
        .select('*')
        .eq('id', playbookId)
        .single();

      if (!playbook) {
        throw new Error('Playbook not found');
      }

      // Get AI instance
      const ai = getMinimalAICofounder(businessId);

      // Execute playbook steps
      const results = [];
      for (const step of playbook.playbook_data.steps) {
        try {
          const result = await ai.assist({
            action: 'execute_playbook_step',
            data: {
              step,
              playbook: playbook.title,
              customization
            }
          });
          
          results.push({
            step,
            result,
            success: result.success
          });

          // Add delay between steps to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (stepError) {
          console.error(`Error executing playbook step: ${step}`, stepError);
          results.push({
            step,
            error: stepError.message,
            success: false
          });
        }
      }

      // Record playbook application
      await supabase
        .from('playbook_applications')
        .insert({
          business_id: businessId,
          playbook_id: playbookId,
          results,
          success_rate: results.filter(r => r.success).length / results.length,
          applied_at: new Date().toISOString()
        });

      return {
        success: true,
        playbook: playbook.title,
        steps_executed: results.length,
        success_rate: results.filter(r => r.success).length / results.length,
        results
      };

    } catch (error) {
      console.error('Error applying playbook:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper methods
   */
  anonymizeAction(action) {
    // Remove business-specific details
    const anonymized = { ...action };
    delete anonymized.businessId;
    delete anonymized.customerEmail;
    delete anonymized.customerName;
    
    // Generalize specific values
    if (anonymized.productName) {
      anonymized.productType = this.categorizeProduct(anonymized.productName);
      delete anonymized.productName;
    }
    
    return anonymized;
  }

  anonymizeOutcome(outcome) {
    const anonymized = { ...outcome };
    delete anonymized.customerEmail;
    delete anonymized.messageId;
    return anonymized;
  }

  anonymizeContext(context) {
    const anonymized = { ...context };
    delete anonymized.businessId;
    delete anonymized.customerDetails;
    return anonymized;
  }

  categorizeProduct(productName) {
    const categories = {
      'service': ['consultation', 'coaching', 'audit', 'strategy'],
      'course': ['course', 'training', 'workshop', 'masterclass'],
      'template': ['template', 'kit', 'blueprint', 'framework'],
      'software': ['app', 'tool', 'software', 'platform']
    };

    const name = productName.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category;
      }
    }
    
    return 'service';
  }

  calculateConfidence(patterns) {
    // Higher confidence with more patterns and higher success scores
    const avgScore = patterns.reduce((sum, p) => sum + p.success_score, 0) / patterns.length;
    const countFactor = Math.min(1, patterns.length / 10); // Max factor at 10 patterns
    
    return Math.min(0.95, avgScore * countFactor);
  }

  calculateRelevance(playbook, situation, industry, businessType) {
    let score = 0.5; // Base relevance
    
    // Increase relevance based on action type match
    if (situation.includes(playbook.action_type)) {
      score += 0.3;
    }
    
    // Industry/business type matching would go here
    // For now, return base score
    
    return Math.min(1.0, score);
  }
}

// Singleton instance
let instance = null;

export function getPlaybookMarketplace() {
  if (!instance) {
    instance = new PlaybookMarketplace();
  }
  return instance;
}

