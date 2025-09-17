/**
 * Minimal AI Cofounder Orchestrator
 * 
 * An elegant, cost-efficient AI system that:
 * - Reacts to events instead of continuous thinking
 * - Uses the cheapest model that works
 * - Remembers only what matters
 * - Expands with new tools as needed
 * 
 * 80% of the value with 20% of the complexity and cost
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { LightweightMemory } from './lightweight-memory.js';
import { ToolRegistry } from './tool-registry.js';
import { CostGuard } from './cost-guard.js';
import { ModelSelector } from './model-selector.js';
import { recordBusinessEvent } from './pattern-recognition.js';
import { getPlaybookMarketplace } from './playbook-marketplace.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class MinimalAICofounder {
  constructor(businessId) {
    this.businessId = businessId;
    this.memory = new LightweightMemory(businessId);
    this.tools = new ToolRegistry(businessId);
    this.costGuard = new CostGuard(businessId);
    this.modelSelector = new ModelSelector();
    this.context = null;
  }

  /**
   * Single entry point for ALL AI interactions
   * @param {Object} request - The request object with action and data
   * @returns {Object} The AI's response
   */
  async assist(request) {
    try {
      // Check budget before proceeding
      const estimatedCost = this.estimateRequestCost(request);
      if (!await this.costGuard.canProceed(request.action, estimatedCost)) {
        return {
          success: false,
          error: 'Daily AI budget exceeded. Operations will resume tomorrow.',
          budgetExceeded: true
        };
      }

      // Gather context for this request
      const context = await this.gatherContext(request);
      
      // Decide what action to take
      const action = await this.decideAction(context);
      
      // Execute the action
      const result = await this.executeAction(action);
      
      // Record important outcomes only
      if (result.importance >= 0.7) {
        await this.recordOutcome(result);
      }
      
      return {
        success: true,
        result,
        cost: estimatedCost
      };
    } catch (error) {
      console.error('AI Cofounder error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Gather relevant context for the request
   */
  async gatherContext(request) {
    // Get business data
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', this.businessId)
      .single();

    // Get recent memories related to this request
    const memories = await this.memory.recall(request.action);

    // Get current weekly goal (high importance for context)
    const currentGoal = await this.getCurrentWeeklyGoal();

    // Get current metrics
    const { data: metrics } = await supabase
      .from('business_metrics')
      .select('*')
      .eq('business_id', this.businessId)
      .order('created_at', { ascending: false })
      .limit(1);

    // Get relevant playbooks for this situation
    const marketplace = getPlaybookMarketplace();
    const relevantPlaybooks = await marketplace.getRelevantPlaybooks(
      this.businessId, 
      request.action + ' ' + (request.data?.type || '')
    );

    return {
      request,
      business,
      memories,
      currentGoal,
      relevantPlaybooks: relevantPlaybooks.slice(0, 2), // Top 2 most relevant
      metrics: metrics?.[0] || {},
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Decide what action to take based on context
   */
  async decideAction(context) {
    // Use the cheapest model for decision making
    const model = this.modelSelector.getModel('decide');
    
    const prompt = this.buildDecisionPrompt(context);
    
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are a minimal but effective AI business cofounder. 
                   Make smart decisions with available tools. Be cost-conscious.
                   Only suggest actions that directly impact revenue or customer acquisition.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Failed to parse AI decision:', error);
      return {
        action: 'none',
        reason: 'Could not determine appropriate action'
      };
    }
  }

  /**
   * Execute the decided action
   */
  async executeAction(action) {
    if (action.action === 'none') {
      return { message: action.reason, importance: 0.1 };
    }

    // Check if we have the required tool
    if (action.tool && !this.tools.has(action.tool)) {
      return { 
        error: `Tool ${action.tool} not available`,
        importance: 0.3
      };
    }

    // Execute with the appropriate tool
    if (action.tool) {
      const result = await this.tools.use(action.tool, action.params);
      return {
        ...result,
        tool: action.tool,
        importance: action.importance || 0.5
      };
    }

    // Direct response without tool
    return {
      message: action.response,
      importance: action.importance || 0.5
    };
  }

  /**
   * Record important outcomes for learning
   */
  async recordOutcome(result) {
    const key = `outcome_${result.tool || 'direct'}_${Date.now()}`;
    await this.memory.remember(key, result, result.importance);
    
    // Record in playbook marketplace if highly successful
    if (result.importance >= 0.8 && result.success) {
      const marketplace = getPlaybookMarketplace();
      await marketplace.recordSuccessPattern(
        this.businessId,
        result.action || { type: result.tool },
        result,
        this.context
      );
    }
  }

  /**
   * Build a decision prompt based on context
   */
  buildDecisionPrompt(context) {
    const { request, business, memories, currentGoal, relevantPlaybooks, metrics } = context;
    
    const goalContext = currentGoal ? 
      `\nCURRENT WEEKLY GOAL: ${currentGoal.description} (Target: ${currentGoal.target})` : 
      '\nNo current weekly goal set.';
    
    const playbookContext = relevantPlaybooks.length > 0 ? 
      `\nRELEVANT PLAYBOOKS: ${JSON.stringify(relevantPlaybooks.map(p => ({ title: p.title, when_to_use: p.playbook_data.when_to_use })))}` : 
      '';
    
    return `
      Business: ${business.name} (${business.business_data?.industry || 'general'})
      Current Revenue: $${metrics.total_revenue || 0}
      Request: ${JSON.stringify(request)}
      Recent Context: ${JSON.stringify(memories.slice(0, 3))}
      ${goalContext}
      ${playbookContext}
      
      Available Tools: ${this.tools.listAvailable().join(', ')}
      
      Decide the best action to take. Consider:
      1. How does this align with our current weekly goal?
      2. Can we use a proven playbook for this situation?
      3. Will this directly impact revenue or customer acquisition?
      4. What's the simplest solution that works?
      
      Respond with JSON:
      {
        "action": "tool_name or 'none' or 'respond' or 'suggest_playbook'",
        "tool": "tool_name if using a tool",
        "params": { ... tool parameters ... },
        "response": "direct response if no tool needed",
        "playbook_suggestion": "playbook_id if suggesting a playbook",
        "goal_alignment": "how this helps achieve the weekly goal",
        "reason": "why this action",
        "importance": 0.1 to 1.0
      }
    `;
  }

  /**
   * Estimate the cost of a request
   */
  estimateRequestCost(request) {
    // Simple cost estimation based on action type
    const costMap = {
      'chat': 0.002,           // Simple chat response
      'analyze': 0.005,         // Analysis task
      'generate': 0.01,         // Content generation
      'strategize': 0.02,       // Strategy planning
      'image': 0.04,            // Image generation (if needed)
    };

    return costMap[request.action] || 0.003;
  }

  /**
   * Handle specific revenue events
   */
  async handleRevenueEvent(eventType, data) {
    switch (eventType) {
      case 'checkout.started':
        return await this.handleCheckoutStarted(data);
      
      case 'cart.abandoned':
        return await this.handleCartAbandoned(data);
      
      case 'payment.completed':
        return await this.handlePaymentCompleted(data);
      
      case 'lead.captured':
        return await this.handleLeadCaptured(data);
      
      case 'email.replied':
        return await this.handleEmailReply(data);
      
      default:
        return { message: 'Event not handled', importance: 0.1 };
    }
  }

  /**
   * Help close a sale when checkout starts
   */
  async handleCheckoutStarted(data) {
    // Quick, personalized value prop to help close
    const model = this.modelSelector.getModel('generate_copy');
    
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "Generate a short, compelling value proposition for checkout."
        },
        {
          role: "user",
          content: `Product: ${data.productName}\nPrice: ${data.price}\nCustomer: ${data.customerType || 'general'}`
        }
      ],
      max_tokens: 50,
      temperature: 0.7
    });

    return {
      message: response.choices[0].message.content,
      importance: 0.8
    };
  }

  /**
   * Send ONE follow-up for abandoned cart
   */
  async handleCartAbandoned(data) {
    // Check if we already sent a follow-up
    const previousFollowUp = await this.memory.recall(`cart_abandoned_${data.sessionId}`);
    if (previousFollowUp.length > 0) {
      return { message: 'Already sent follow-up', importance: 0.2 };
    }

    // Send one personalized follow-up
    const followUp = await this.tools.use('send_email', {
      to: data.email,
      subject: `Complete your purchase of ${data.productName}`,
      message: `Hi! I noticed you were interested in ${data.productName}. 
                Is there anything I can help with to complete your purchase?
                Reply with any questions!`
    });

    // Remember we sent this
    await this.memory.remember(
      `cart_abandoned_${data.sessionId}`,
      { sent: true, timestamp: new Date() },
      0.6
    );

    return {
      ...followUp,
      importance: 0.7
    };
  }

  /**
   * Learn from successful payments
   */
  async handlePaymentCompleted(data) {
    // Record the event for pattern recognition
    await recordBusinessEvent(this.businessId, 'payment.completed', {
      amount: data.amount,
      source: data.acquisitionChannel,
      product: data.productName
    });

    // Store what worked
    await this.memory.remember(
      `success_${Date.now()}`,
      {
        product: data.productName,
        price: data.amount,
        customer: data.customerType,
        channel: data.acquisitionChannel
      },
      0.9 // High importance
    );

    // Quick analysis of what worked
    const model = this.modelSelector.getModel('analyze');
    
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "Briefly analyze why this sale succeeded. One sentence."
        },
        {
          role: "user",
          content: JSON.stringify(data)
        }
      ],
      max_tokens: 50,
      temperature: 0.3
    });

    return {
      analysis: response.choices[0].message.content,
      importance: 0.9
    };
  }

  /**
   * Handle new lead with personalized outreach
   */
  async handleLeadCaptured(data) {
    // Record the event for pattern recognition
    await recordBusinessEvent(this.businessId, 'lead.captured', {
      source: data.source,
      interest: data.interest
    });

    // Get business context for personalization
    const { data: business } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', this.businessId)
      .single();

    // Generate personalized outreach
    const model = this.modelSelector.getModel('generate_copy');
    
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "Write a short, personalized outreach email. Be genuine and helpful, not salesy."
        },
        {
          role: "user",
          content: `Business: ${business.business_data?.businessName}
                   Lead: ${data.name || 'there'}
                   Interest: ${data.interest || 'your services'}
                   Value Prop: ${business.business_data?.tagline}`
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    // Send the email
    const result = await this.tools.use('send_email', {
      to: data.email,
      subject: `Thanks for your interest in ${business.business_data?.businessName}`,
      message: response.choices[0].message.content
    });

    // Record email sent event
    if (result.success) {
      await recordBusinessEvent(this.businessId, 'email.sent', {
        type: 'lead_response',
        to: data.email
      });
    }

    return {
      ...result,
      importance: 0.8
    };
  }

  /**
   * Handle prospect replies intelligently
   */
  async handleEmailReply(data) {
    // Record the event for pattern recognition
    await recordBusinessEvent(this.businessId, 'email.replied', {
      from: data.from,
      sentiment: 'unknown' // Will be analyzed below
    });

    // Analyze the reply sentiment and intent
    const model = this.modelSelector.getModel('analyze');
    
    const analysis = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "Analyze this email reply. Determine: sentiment (positive/negative/neutral), intent (interested/objection/question), and suggested response."
        },
        {
          role: "user",
          content: data.message
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(analysis.choices[0].message.content);

    // Generate appropriate response
    if (result.intent === 'interested') {
      // Move to close
      const response = await this.tools.use('send_email', {
        to: data.from,
        subject: `Re: ${data.subject}`,
        message: result.suggested_response || "Great! Let's schedule a quick call to get you started."
      });
      return { ...response, importance: 0.9 };
    } else if (result.intent === 'objection') {
      // Handle objection once
      const response = await this.tools.use('send_email', {
        to: data.from,
        subject: `Re: ${data.subject}`,
        message: result.suggested_response || "I understand your concern. Let me know if you have any questions."
      });
      return { ...response, importance: 0.6 };
    }

    return { message: 'No action needed', importance: 0.2 };
  }

  /**
   * Get current weekly goal
   */
  async getCurrentWeeklyGoal() {
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7));

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
   * Get current status
   */
  getStatus() {
    return {
      businessId: this.businessId,
      availableTools: this.tools.listAvailable(),
      memorySize: this.memory.size,
      dailyBudget: this.costGuard.getRemainingBudget(),
      status: 'ready'
    };
  }
}

// Singleton instance manager
const instances = new Map();

export function getMinimalAICofounder(businessId) {
  if (!instances.has(businessId)) {
    instances.set(businessId, new MinimalAICofounder(businessId));
  }
  return instances.get(businessId);
}
