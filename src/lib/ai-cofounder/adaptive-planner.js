/**
 * Adaptive Planner-Executor Pattern
 * 
 * This system creates, executes, and adapts business plans autonomously.
 * It learns from outcomes and continuously improves its strategies.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { AIMemorySystem } from './memory-system.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class AdaptivePlanner {
  constructor(businessId) {
    this.businessId = businessId;
    this.memory = new AIMemorySystem(businessId);
    this.currentPlan = null;
    this.executionHistory = [];
  }

  /**
   * Create a comprehensive business plan based on goals and context
   */
  async createPlan(goals, context = {}) {
    try {
      // Get relevant memories and insights
      const memories = await this.memory.recall(`Business planning for: ${JSON.stringify(goals)}`);
      
      // Access collective intelligence
      const sharedKnowledge = await this.memory.accessCollectiveIntelligence(
        `Successful strategies for ${context.industry || 'service business'}`
      );

      // Get current business state
      const businessState = await this.analyzeBusinessState();

      // Generate adaptive plan (with cost-aware model)
      const planResponse = await openai.chat.completions.create({
        model: process.env.AI_PLANNING_MODEL || "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a strategic business planner AI. Create detailed, executable plans 
                     that adapt based on real-time feedback. Your plans should be:
                     1. Specific and measurable
                     2. Time-bound with milestones
                     3. Resource-aware
                     4. Risk-conscious
                     5. Adaptable to changing conditions
                     
                     IMPORTANT: Always respond with valid JSON format.`
          },
          {
            role: "user",
            content: `Create a comprehensive business plan and return it as JSON:
                     
                     Goals: ${JSON.stringify(goals)}
                     Context: ${JSON.stringify(context)}
                     Current State: ${JSON.stringify(businessState)}
                     Historical Insights: ${JSON.stringify(memories.insights)}
                     Proven Strategies: ${JSON.stringify(sharedKnowledge)}
                     
                     Generate a plan with these fields in JSON format:
                     - Strategic objectives with success metrics
                     - Tactical tasks with dependencies
                     - Resource allocation
                     - Risk mitigation strategies
                     - Adaptation triggers and contingencies
                     - Timeline with milestones
                     - Expected outcomes with confidence levels
                     
                     Return the response as a valid JSON object.`
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      let plan;
      try {
        plan = JSON.parse(planResponse.choices[0].message.content);
      } catch (parseError) {
        console.warn('Failed to parse plan JSON, using fallback:', parseError);
        // Fallback plan structure
        plan = {
          objectives: [
            {
              id: 'revenue_growth',
              description: 'Generate first revenue within 48 hours',
              target: '$1000',
              timeline: '30 days',
              priority: 'high'
            }
          ],
          tasks: [
            {
              id: 'customer_acquisition',
              description: 'Launch customer acquisition campaign',
              dependencies: [],
              resources: ['email', 'social_media'],
              timeline: '2 days'
            }
          ],
          confidence: 0.7,
          reasoning: 'Using fallback plan due to JSON parsing error'
        };
      }

      // Enhance plan with execution strategies
      const enhancedPlan = await this.enhancePlanWithExecutionStrategies(plan);

      // Store plan in database
      const { data, error } = await supabase
        .from('ai_business_plans')
        .insert({
          business_id: this.businessId,
          plan: enhancedPlan,
          goals: goals,
          status: 'active',
          created_at: new Date().toISOString(),
          confidence_score: enhancedPlan.confidence || 0.7,
          expected_revenue: enhancedPlan.expectedRevenue || 0,
          adaptation_count: 0
        })
        .select();

      if (error) {
        console.warn('Error storing plan in database:', error);
        // Continue without storing in database
      }

      this.currentPlan = enhancedPlan;
      
      // Remember the plan creation with safe property access
      const objectiveCount = (enhancedPlan && enhancedPlan.objectives && enhancedPlan.objectives.length) || 0;
      await this.memory.remember({
        content: `Created new business plan with ${objectiveCount} objectives`,
        category: 'strategy_decision',
        importance: 0.9,
        context: { planId: data?.[0]?.id, goals }
      });

      return enhancedPlan;
    } catch (error) {
      console.error('Error creating plan:', error);
      throw error;
    }
  }

  /**
   * Execute plan tasks autonomously
   */
  async executePlan() {
    if (!this.currentPlan) {
      throw new Error('No active plan to execute');
    }

    const executionResults = [];

    try {
      // Get executable tasks for current phase
      const tasks = this.getExecutableTasks();

      for (const task of tasks) {
        // Check if task should be executed based on conditions
        const shouldExecute = await this.evaluateTaskConditions(task);
        
        if (!shouldExecute) {
          console.log(`Skipping task ${task.id}: conditions not met`);
          continue;
        }

        // Execute task with appropriate tool
        const result = await this.executeTask(task);
        
        // Record execution
        executionResults.push(result);
        this.executionHistory.push(result);

        // Learn from execution
        await this.memory.remember({
          content: `Executed task: ${task.name}`,
          category: 'operational_metric',
          result: result.success,
          context: {
            task,
            result,
            planPhase: this.currentPlan.currentPhase
          }
        });

        // Update task status
        await this.updateTaskStatus(task.id, result);

        // Check if we need to adapt the plan
        if (result.requiresAdaptation) {
          await this.adaptPlan(result.adaptationReason);
        }
      }

      // Evaluate overall progress
      const progress = await this.evaluateProgress();
      
      // Decide next actions
      const nextActions = await this.decideNextActions(progress);

      return {
        executed: executionResults,
        progress,
        nextActions,
        adaptations: this.currentPlan.adaptationHistory || []
      };
    } catch (error) {
      console.error('Error executing plan:', error);
      
      // Self-heal and continue
      await this.handleExecutionError(error);
      
      throw error;
    }
  }

  /**
   * Execute a specific task using appropriate tools
   */
  async executeTask(task) {
    const startTime = Date.now();
    
    try {
      let result;

      switch (task.type) {
        case 'market_research':
          result = await this.executeMarketResearch(task);
          break;
          
        case 'content_creation':
          result = await this.executeContentCreation(task);
          break;
          
        case 'customer_outreach':
          result = await this.executeCustomerOutreach(task);
          break;
          
        case 'pricing_optimization':
          result = await this.executePricingOptimization(task);
          break;
          
        case 'landing_page_update':
          result = await this.executeLandingPageUpdate(task);
          break;
          
        case 'email_campaign':
          result = await this.executeEmailCampaign(task);
          break;
          
        case 'partnership_outreach':
          result = await this.executePartnershipOutreach(task);
          break;
          
        case 'product_improvement':
          result = await this.executeProductImprovement(task);
          break;
          
        case 'analytics_review':
          result = await this.executeAnalyticsReview(task);
          break;
          
        default:
          result = await this.executeGenericTask(task);
      }

      const executionTime = Date.now() - startTime;

      return {
        taskId: task.id,
        taskType: task.type,
        success: result.success,
        output: result.output,
        metrics: result.metrics,
        executionTime,
        timestamp: new Date().toISOString(),
        requiresAdaptation: result.requiresAdaptation || false,
        adaptationReason: result.adaptationReason
      };
    } catch (error) {
      return {
        taskId: task.id,
        taskType: task.type,
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        requiresAdaptation: true,
        adaptationReason: `Task failed: ${error.message}`
      };
    }
  }

  /**
   * Adapt plan based on real-time feedback and results
   */
  async adaptPlan(reason) {
    try {
      console.log(`Adapting plan due to: ${reason}`);

      // Get recent execution history
      const recentHistory = this.executionHistory.slice(-10);
      
      // Get recommendations from memory
      const recommendations = await this.memory.getRecommendations({
        situation: reason,
        currentPlan: this.currentPlan,
        recentHistory
      });

      // Daily adaptation cap
      const dailyCap = Number(process.env.AI_DAILY_ADAPT_CAP || 4);
      const today = new Date().toISOString().slice(0, 10);
      const todaysAdaptations = (this.currentPlan?.adaptationHistory || []).filter(a => (a.timestamp || '').startsWith(today)).length;
      if (todaysAdaptations >= dailyCap) {
        console.log(`Adaptation skipped: daily cap ${dailyCap} reached`);
        return this.currentPlan;
      }

      // Generate adapted plan (fallback on 429)
      let adaptationResponse;
      try {
        adaptationResponse = await openai.chat.completions.create({
          model: process.env.AI_ADAPT_MODEL || "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an adaptive business strategist. Modify plans based on real-world feedback 
                     while maintaining core objectives. Be decisive and action-oriented.`
          },
          {
            role: "user",
            content: `Adapt this plan and return as JSON:
                     
                     Current Plan: ${JSON.stringify(this.currentPlan)}
                     Adaptation Reason: ${reason}
                     Recent Results: ${JSON.stringify(recentHistory)}
                     Recommendations: ${JSON.stringify(recommendations)}
                     
                     Provide adapted plan with these JSON fields:
                     - Modified tasks and timeline
                     - New strategies to address issues
                     - Updated success metrics
                     - Risk mitigation updates
                     
                     Return as valid JSON object.`
          }
        ],
          temperature: 0.6,
          response_format: { type: "json_object" }
        });
      } catch (err) {
        if (String(err).includes('insufficient_quota') || String(err).includes('429')) {
          console.warn('Adaptation quota hit; falling back to gpt-3.5-turbo');
          adaptationResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `You are an adaptive business strategist. Return valid JSON.`
              },
              {
                role: "user",
                content: `Adapt this plan and return as JSON:\n\nCurrent Plan: ${JSON.stringify(this.currentPlan)}\nAdaptation Reason: ${reason}\nRecent Results: ${JSON.stringify(recentHistory)}\nRecommendations: ${JSON.stringify(recommendations)}\n\nReturn as valid JSON object.`
              }
            ],
            temperature: 0.6,
            response_format: { type: "json_object" }
          });
        } else {
          throw err;
        }
      }

      let adaptedPlan;
      try {
        adaptedPlan = JSON.parse(adaptationResponse.choices[0].message.content);
      } catch (parseError) {
        console.warn('Failed to parse adapted plan JSON, using current plan:', parseError);
        // Keep current plan if adaptation fails
        adaptedPlan = this.currentPlan;
      }

      // Track adaptation
      if (!this.currentPlan.adaptationHistory) {
        this.currentPlan.adaptationHistory = [];
      }
      
      this.currentPlan.adaptationHistory.push({
        timestamp: new Date().toISOString(),
        reason,
        changes: adaptedPlan.changes
      });

      // Merge adapted plan with current
      this.currentPlan = { ...this.currentPlan, ...adaptedPlan };

      // Update in database
      await supabase
        .from('ai_business_plans')
        .update({
          plan: this.currentPlan,
          adaptation_count: this.currentPlan.adaptationHistory.length,
          last_adapted: new Date().toISOString()
        })
        .eq('business_id', this.businessId)
        .eq('status', 'active');

      // Remember the adaptation
      await this.memory.remember({
        content: `Adapted plan: ${reason}`,
        category: 'strategy_decision',
        importance: 0.8,
        context: {
          reason,
          changes: adaptedPlan.changes
        }
      });

      return adaptedPlan;
    } catch (error) {
      console.error('Error adapting plan:', error);
      throw error;
    }
  }

  /**
   * Evaluate overall progress and decide if plan needs major revision
   */
  async evaluateProgress() {
    try {
      const { data: metrics } = await supabase
        .from('business_metrics')
        .select('*')
        .eq('business_id', this.businessId)
        .order('created_at', { ascending: false })
        .limit(1);

      const currentMetrics = metrics?.[0] || {};

      // Calculate progress against objectives
      const objectiveProgress = this.currentPlan.objectives.map(obj => {
        const progress = this.calculateObjectiveProgress(obj, currentMetrics);
        return {
          objective: obj.name,
          target: obj.target,
          current: progress.current,
          percentComplete: progress.percent,
          onTrack: progress.onTrack
        };
      });

      // Overall health score
      const healthScore = objectiveProgress.reduce((sum, p) => 
        sum + p.percentComplete, 0
      ) / objectiveProgress.length;

      // Determine if intervention needed
      const needsIntervention = healthScore < 0.4 || 
        objectiveProgress.filter(p => !p.onTrack).length > objectiveProgress.length / 2;

      return {
        objectives: objectiveProgress,
        healthScore,
        needsIntervention,
        metrics: currentMetrics,
        recommendation: needsIntervention ? 
          'Major plan revision recommended' : 
          'Continue with current plan'
      };
    } catch (error) {
      console.error('Error evaluating progress:', error);
      return { healthScore: 0.5, needsIntervention: false };
    }
  }

  /**
   * Decide next actions based on current state
   */
  async decideNextActions(progress) {
    try {
      // Get AI recommendations
      const recommendations = await this.memory.getRecommendations({
        query: 'What should we do next?',
        progress,
        plan: this.currentPlan
      });

      // Decide specific next actions (cost-aware model with 429 fallback)
      let response;
      try {
        response = await openai.chat.completions.create({
          model: process.env.AI_DECISIONS_MODEL || "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a decisive business strategist. Based on current progress, 
                     recommend specific, immediate actions.`
          },
          {
            role: "user",
            content: `Progress: ${JSON.stringify(progress)}
                     Recommendations: ${JSON.stringify(recommendations)}
                     
                     Provide 3-5 specific next actions with priority and expected impact.
                     Return response as JSON object with an "actions" array.`
          }
        ],
          temperature: 0.6,
          response_format: { type: "json_object" }
        });
      } catch (err) {
        if (String(err).includes('insufficient_quota') || String(err).includes('429')) {
          console.warn('Decisions quota hit; falling back to gpt-3.5-turbo');
          response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: "Return valid JSON only." },
              { role: "user", content: `Progress: ${JSON.stringify(progress)}\nProvide 3-5 next actions as JSON with an \"actions\" array.` }
            ],
            temperature: 0.4,
            response_format: { type: "json_object" }
          });
        } else {
          throw err;
        }
      }

      try {
        return JSON.parse(response.choices[0].message.content);
      } catch (parseError) {
        console.warn('Failed to parse next actions JSON, using fallback:', parseError);
        return {
          actions: [
            {
              id: 'continue_acquisition',
              description: 'Continue customer acquisition efforts',
              priority: 'high',
              expectedImpact: 'Generate leads and revenue'
            }
          ]
        };
      }
    } catch (error) {
      console.error('Error deciding next actions:', error);
      return { actions: [] };
    }
  }

  // Task execution methods
  async executeMarketResearch(task) {
    // Implementation for market research
    const research = await this.conductMarketResearch(task.parameters);
    return {
      success: true,
      output: research,
      metrics: { insightsFound: research.insights?.length || 0 }
    };
  }

  async executeCustomerOutreach(task) {
    // Implementation for customer outreach
    const campaign = await this.runOutreachCampaign(task.parameters);
    return {
      success: campaign.sent > 0,
      output: campaign,
      metrics: { 
        sent: campaign.sent, 
        prospects: campaign.prospects?.length || 0 
      }
    };
  }

  async executeLandingPageUpdate(task) {
    // Implementation for landing page updates
    const update = await this.updateLandingPage(task.parameters);
    return {
      success: true,
      output: update,
      metrics: { elementsUpdated: update.changes?.length || 0 }
    };
  }

  // Helper methods
  getExecutableTasks() {
    if (!this.currentPlan?.tasks) return [];
    
    return this.currentPlan.tasks.filter(task => 
      task.status === 'pending' && 
      this.checkDependencies(task)
    ).slice(0, 5); // Limit concurrent tasks
  }

  checkDependencies(task) {
    if (!task.dependencies || task.dependencies.length === 0) return true;
    
    return task.dependencies.every(depId => {
      const depTask = this.currentPlan.tasks.find(t => t.id === depId);
      return depTask?.status === 'completed';
    });
  }

  async evaluateTaskConditions(task) {
    if (!task.conditions) return true;
    
    // Evaluate each condition
    for (const condition of task.conditions) {
      const met = await this.checkCondition(condition);
      if (!met) return false;
    }
    
    return true;
  }

  async updateTaskStatus(taskId, result) {
    const task = this.currentPlan.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = result.success ? 'completed' : 'failed';
      task.completedAt = new Date().toISOString();
      task.result = result;
    }
  }

  calculateObjectiveProgress(objective, metrics) {
    // Calculate progress based on objective type
    const current = metrics[objective.metric] || 0;
    const percent = (current / objective.target) * 100;
    const onTrack = percent >= (objective.expectedProgress || 50);
    
    return { current, percent, onTrack };
  }

  async analyzeBusinessState() {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', this.businessId)
      .single();
    
    return data;
  }

  async enhancePlanWithExecutionStrategies(plan) {
    // Add execution strategies to each task with safe property access
    if (!plan) {
      return {
        objectives: [],
        tasks: [],
        confidence: 0.5,
        status: 'fallback'
      };
    }
    
    return {
      ...plan,
      objectives: plan.objectives || [],
      tasks: (plan.tasks || []).map(task => ({
        ...task,
        executionStrategy: this.getExecutionStrategy(task.type),
        estimatedDuration: this.estimateTaskDuration(task),
        requiredResources: this.identifyRequiredResources(task)
      })),
      confidence: plan.confidence || 0.7,
      status: 'enhanced'
    };
  }

  getExecutionStrategy(taskType) {
    const strategies = {
      market_research: 'competitor_analysis_and_trend_identification',
      customer_outreach: 'personalized_multi_channel_engagement',
      content_creation: 'ai_generated_with_human_review',
      pricing_optimization: 'dynamic_testing_with_analytics'
    };
    
    return strategies[taskType] || 'standard_execution';
  }

  estimateTaskDuration(task) {
    const baseDurations = {
      market_research: 2,
      customer_outreach: 4,
      content_creation: 3,
      pricing_optimization: 1
    };
    
    return baseDurations[task.type] || 2; // hours
  }

  identifyRequiredResources(task) {
    const resources = {
      market_research: ['gpt-4', 'web_search', 'competitor_data'],
      customer_outreach: ['email_service', 'prospect_database', 'personalization_engine'],
      content_creation: ['gpt-4', 'image_generation', 'brand_assets'],
      pricing_optimization: ['analytics_data', 'competitor_pricing', 'conversion_metrics']
    };
    
    return resources[task.type] || ['gpt-4'];
  }

  async handleExecutionError(error) {
    // Log error
    await this.memory.remember({
      content: `Execution error: ${error.message}`,
      category: 'failure_lesson',
      importance: 0.7,
      context: { error: error.stack }
    });

    // Attempt self-healing
    console.log('Attempting self-healing...');
    // Implementation for self-healing logic
  }

  // Placeholder implementations for specific task types
  async conductMarketResearch(parameters) {
    // Actual implementation would call research APIs
    return { insights: ['insight1', 'insight2'], competitors: [] };
  }

  async runOutreachCampaign(parameters) {
    // Actual implementation would use email service
    return { sent: 10, prospects: [] };
  }

  async updateLandingPage(parameters) {
    // Actual implementation would update CMS
    return { changes: ['hero_text', 'cta_button'] };
  }

  async executeContentCreation(task) {
    return { success: true, output: 'Content created', metrics: {} };
  }

  async executePricingOptimization(task) {
    return { success: true, output: 'Pricing optimized', metrics: {} };
  }

  async executeEmailCampaign(task) {
    return { success: true, output: 'Campaign sent', metrics: {} };
  }

  async executePartnershipOutreach(task) {
    return { success: true, output: 'Partners contacted', metrics: {} };
  }

  async executeProductImprovement(task) {
    return { success: true, output: 'Product improved', metrics: {} };
  }

  async executeAnalyticsReview(task) {
    return { success: true, output: 'Analytics reviewed', metrics: {} };
  }

  async executeGenericTask(task) {
    return { success: true, output: 'Task executed', metrics: {} };
  }

  async checkCondition(condition) {
    // Check if condition is met
    return true; // Placeholder
  }
}
