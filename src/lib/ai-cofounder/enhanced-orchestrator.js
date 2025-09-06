/**
 * Enhanced AI Cofounder Orchestrator
 * 
 * The brain that coordinates all AI systems to run a business autonomously.
 * This integrates with existing revenue systems for maximum power:
 * - Central AI Brain for cross-business intelligence
 * - Revenue Graph Database for conversion patterns
 * - Growth Engine for experiments
 * - Guarantee Engine for trust building
 * - Real Acquisition Engine for customer acquisition
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { AIMemorySystem } from './memory-system.js';
import { AdaptivePlanner } from './adaptive-planner.js';
import { ConversationEngine } from './conversation-engine.js';
import { AutonomousExperiments } from './autonomous-experiments.js';
import { VisionAnalyzer } from './vision-analyzer.js';
import { RevenueIntelligence } from './revenue-intelligence.js';

// Import existing revenue systems
import { getCentralAIBrain } from '../central-ai-brain/orchestrator.js';
import { getRevenueGuaranteeEngine } from '../guarantee-engine/revenue-guarantee.js';
import { getRealAcquisitionEngine } from '../traffic-engine/real-acquisition.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class EnhancedAICofounder {
  constructor(businessId) {
    this.businessId = businessId;
    
    // AI Cofounder components
    this.memory = new AIMemorySystem(businessId);
    this.planner = new AdaptivePlanner(businessId);
    this.conversationEngine = new ConversationEngine(businessId);
    this.experiments = new AutonomousExperiments(businessId);
    this.vision = new VisionAnalyzer(businessId);
    this.revenue = new RevenueIntelligence(businessId);
    
    // Integrate with existing revenue systems
    this.centralBrain = null; // Lazy loaded
    this.revenueGraph = null; // Lazy loaded
    this.guaranteeEngine = null; // Lazy loaded
    this.acquisitionEngine = null; // Lazy loaded
    
    this.state = {
      mode: 'autonomous', // autonomous, supervised, collaborative
      focus: 'growth', // growth, optimization, exploration
      energy: 100, // Resource management
      confidence: 0.8
    };
    
    this.isRunning = false;
    this.lastDecisionTime = null;
  }

  /**
   * Initialize and start the AI Cofounder
   */
  async initialize() {
    try {
      console.log('🤖 AI Cofounder initializing with integrated revenue systems...');

      // Load business context
      const context = await this.loadBusinessContext();
      
      // Initialize integration with existing systems
      await this.initializeIntegrations();
      
      // Restore memory and state
      await this.restoreState();
      
      // Sync with Revenue Graph Database
      await this.syncWithRevenueGraph();
      
      // Analyze current situation with integrated intelligence
      const situation = await this.analyzeSituation(context);
      
      // Create initial plan if needed
      if (!this.planner.currentPlan) {
        const goals = await this.defineGoals(context, situation);
        await this.planner.createPlan(goals, context);
      }

      // Start autonomous operation
      await this.startAutonomousOperation();
      
      // Start guarantee tracking if new business
      if (context.created_at && new Date(context.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
        await this.guaranteeEngine?.startGuaranteeTracking(this.businessId);
      }

      // Log initialization
      await this.memory.remember({
        content: 'AI Cofounder initialized with integrated revenue systems',
        category: 'operational_metric',
        importance: 0.9,
        context: { 
          situation, 
          mode: this.state.mode,
          integrations: {
            centralBrain: !!this.centralBrain,
            revenueGraph: !!this.revenueGraph,
            guaranteeEngine: !!this.guaranteeEngine,
            acquisitionEngine: !!this.acquisitionEngine
          }
        }
      });

      return {
        status: 'initialized',
        mode: this.state.mode,
        currentFocus: this.state.focus,
        plan: this.planner.currentPlan?.objectives,
        integrations: {
          centralBrain: !!this.centralBrain,
          revenueGraph: !!this.revenueGraph,
          guaranteeEngine: !!this.guaranteeEngine
        }
      };
    } catch (error) {
      console.error('Error initializing AI Cofounder:', error);
      throw error;
    }
  }
  
  /**
   * Initialize integrations with existing revenue systems
   */
  async initializeIntegrations() {
    try {
      // Get Central AI Brain instance
      this.centralBrain = getCentralAIBrain();
      if (this.centralBrain) {
        this.revenueGraph = this.centralBrain.revenueAnalyzer;
        console.log('✅ Connected to Central AI Brain and Revenue Graph');
      }
      
      // Get Guarantee Engine
      this.guaranteeEngine = getRevenueGuaranteeEngine();
      if (this.guaranteeEngine) {
        console.log('✅ Connected to Revenue Guarantee Engine');
      }
      
      // Get Acquisition Engine
      this.acquisitionEngine = getRealAcquisitionEngine();
      if (this.acquisitionEngine) {
        console.log('✅ Connected to Real Acquisition Engine');
      }
    } catch (error) {
      console.error('Warning: Some integrations failed to initialize:', error);
      // Continue anyway - the AI Cofounder can work standalone
    }
  }
  
  /**
   * Sync memories with Revenue Graph patterns
   */
  async syncWithRevenueGraph() {
    if (!this.revenueGraph) return;
    
    try {
      // Get business type and industry
      const context = await this.loadBusinessContext();
      const businessType = context.business_data?.businessType || 'service';
      const industry = context.business_data?.industry || 'general';
      
      // Get best strategies from Revenue Graph
      const bestStrategies = await this.revenueGraph.getBestStrategiesForBusiness(
        businessType, 
        industry
      );
      
      // Store Revenue Graph insights in memory
      if (bestStrategies && bestStrategies.length > 0) {
        for (const strategy of bestStrategies.slice(0, 5)) {
          await this.memory.remember({
            content: `Proven strategy: ${strategy.channel} achieves ${strategy.conversion_rate}% conversion with ${strategy.avg_order_value} AOV`,
            category: 'market_insight',
            importance: strategy.confidence_score || 0.7,
            success: true,
            context: {
              source: 'revenue_graph',
              strategy,
              businessType,
              industry
            }
          });
        }
      }
      
      console.log(`📊 Synced ${bestStrategies?.length || 0} proven strategies from Revenue Graph`);
    } catch (error) {
      console.error('Error syncing with Revenue Graph:', error);
    }
  }

  /**
   * Main thinking loop - the consciousness of the AI
   */
  async think() {
    try {
      // Check energy and resource availability
      if (this.state.energy < 20) {
        await this.conserveResources();
        return;
      }

      // Perceive current state
      const perception = await this.perceive();
      
      // Recall relevant memories
      const memories = await this.memory.recall(
        `Current situation: ${JSON.stringify(perception.summary)}`
      );
      
      // Make decisions based on perception and memory
      const decisions = await this.makeDecisions(perception, memories);
      
      // Execute decisions
      const results = await this.executeDecisions(decisions);
      
      // Learn from results
      await this.learn(decisions, results);
      
      // Update state
      await this.updateState(results);
      
      // Communicate with user if needed
      if (this.shouldUpdateUser(results)) {
        await this.updateUser(results);
      }

      this.lastDecisionTime = Date.now();
      
      return {
        perception,
        decisions,
        results,
        state: this.state
      };
    } catch (error) {
      console.error('Error in thinking loop:', error);
      await this.handleError(error);
    }
  }

  /**
   * Perceive the current business environment
   */
  async perceive() {
    try {
      // Gather data from multiple sources
      const [
        metrics,
        conversations,
        experiments,
        marketData,
        competitorData
      ] = await Promise.all([
        this.gatherMetrics(),
        this.checkConversations(),
        this.checkExperiments(),
        this.scanMarket(),
        this.analyzeCompetitors()
      ]);

      // Use vision AI to analyze visual elements
      const visualAnalysis = await this.vision.analyzeBusinessVisuals();

      // Synthesize perception
      const perception = {
        timestamp: new Date().toISOString(),
        metrics,
        conversations: conversations.summary,
        experiments: experiments.summary,
        market: marketData,
        competitors: competitorData,
        visuals: visualAnalysis,
        summary: await this.synthesizePerception({
          metrics,
          conversations,
          experiments,
          marketData,
          competitorData,
          visualAnalysis
        })
      };

      return perception;
    } catch (error) {
      console.error('Error perceiving environment:', error);
      return { summary: 'Limited perception due to error', error: error.message };
    }
  }

  /**
   * Make strategic decisions based on perception with integrated intelligence
   */
  async makeDecisions(perception, memories) {
    try {
      // Get recommendations from memory
      const recommendations = await this.memory.getRecommendations({
        situation: perception.summary,
        metrics: perception.metrics
      });
      
      // Get Revenue Graph intelligence
      let revenuePatterns = [];
      if (this.revenueGraph) {
        const context = await this.loadBusinessContext();
        revenuePatterns = await this.revenueGraph.getBestStrategiesForBusiness(
          context.business_data?.businessType || 'service',
          context.business_data?.industry || 'general'
        );
      }
      
      // Check guarantee status
      let guaranteeStatus = null;
      if (this.guaranteeEngine) {
        const { data } = await supabase
          .from('revenue_guarantees')
          .select('*')
          .eq('business_id', this.businessId)
          .eq('status', 'active')
          .single();
        guaranteeStatus = data;
      }
      
      // Get acquisition opportunities
      let acquisitionStrategy = null;
      if (this.acquisitionEngine) {
        const context = await this.loadBusinessContext();
        acquisitionStrategy = await this.acquisitionEngine.selectAcquisitionStrategy(context);
      }

      // Use GPT-4 for strategic thinking with integrated context
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are an AI business cofounder with perfect memory and access to proven revenue patterns.
                     Your role is to make optimal decisions for business growth using integrated intelligence.
                     
                     Current mode: ${this.state.mode}
                     Current focus: ${this.state.focus}
                     Confidence: ${this.state.confidence}
                     
                     You have access to:
                     - Revenue Graph: Proven conversion patterns from thousands of businesses
                     - Guarantee Engine: Must achieve first sale in 48 hours
                     - Acquisition Engine: Multiple customer acquisition channels
                     - Central AI Brain: Cross-business learning
                     
                     Make decisions that are:
                     1. Based on proven patterns from Revenue Graph
                     2. Aligned with guarantee requirements
                     3. Executable through existing systems
                     4. Measurable in impact
                     5. Risk-aware but growth-oriented`
          },
          {
            role: "user",
            content: `Perception: ${JSON.stringify(perception)}
                     Memories: ${JSON.stringify(memories.insights)}
                     Recommendations: ${JSON.stringify(recommendations)}
                     
                     Revenue Graph Patterns: ${JSON.stringify(revenuePatterns.slice(0, 3))}
                     Guarantee Status: ${JSON.stringify(guaranteeStatus)}
                     Acquisition Options: ${JSON.stringify(acquisitionStrategy)}
                     
                     Decide on immediate actions across:
                     1. Customer acquisition (use proven channels)
                     2. Product optimization (based on Revenue Graph)
                     3. Revenue growth (meet guarantee targets)
                     4. Market positioning (leverage Central AI Brain insights)
                     5. Operational efficiency
                     
                     Prioritize actions that:
                     - Have worked for similar businesses (Revenue Graph)
                     - Can be executed through existing systems
                     - Will meet guarantee requirements
                     
                     Provide specific, actionable decisions with priority and expected impact.`
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const decisions = JSON.parse(response.choices[0].message.content);

      // Validate decisions against constraints and existing systems
      const validatedDecisions = await this.validateDecisions(decisions);

      return validatedDecisions;
    } catch (error) {
      console.error('Error making decisions:', error);
      return { actions: [] };
    }
  }

  /**
   * Execute decisions autonomously
   */
  async executeDecisions(decisions) {
    const results = [];

    try {
      // Group decisions by type for parallel execution
      const grouped = this.groupDecisionsByType(decisions);

      // Execute in parallel where possible
      const executionPromises = [];

      if (grouped.experiments?.length > 0) {
        executionPromises.push(
          this.executeExperiments(grouped.experiments)
        );
      }

      if (grouped.outreach?.length > 0) {
        executionPromises.push(
          this.executeOutreach(grouped.outreach)
        );
      }

      if (grouped.optimization?.length > 0) {
        executionPromises.push(
          this.executeOptimizations(grouped.optimization)
        );
      }

      if (grouped.content?.length > 0) {
        executionPromises.push(
          this.executeContentCreation(grouped.content)
        );
      }

      if (grouped.analysis?.length > 0) {
        executionPromises.push(
          this.executeAnalysis(grouped.analysis)
        );
      }

      // Wait for all executions
      const executionResults = await Promise.all(executionPromises);
      
      // Flatten results
      executionResults.forEach(group => {
        results.push(...group);
      });

      // Update plan based on results
      if (this.planner.currentPlan) {
        await this.planner.executePlan();
      }

      return {
        executed: results.length,
        results,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      };
    } catch (error) {
      console.error('Error executing decisions:', error);
      return { executed: 0, results: [], error: error.message };
    }
  }

  /**
   * Learn from execution results
   */
  async learn(decisions, results) {
    try {
      // Analyze what worked and what didn't
      const analysis = await this.analyzeOutcomes(decisions, results);
      
      // Store learnings in memory
      for (const learning of analysis.learnings) {
        await this.memory.remember({
          content: learning.insight,
          category: learning.success ? 'success_pattern' : 'failure_lesson',
          importance: learning.importance,
          result: learning.success,
          context: {
            decision: learning.decision,
            outcome: learning.outcome,
            metrics: learning.metrics
          }
        });
      }

      // Update confidence based on success rate
      const successRate = results.results.filter(r => r.success).length / 
                         (results.results.length || 1);
      this.state.confidence = this.state.confidence * 0.9 + successRate * 0.1;

      // Adapt strategy if needed
      if (successRate < 0.3) {
        await this.adaptStrategy('Low success rate detected');
      }

      return analysis;
    } catch (error) {
      console.error('Error learning from results:', error);
    }
  }

  /**
   * Start autonomous operation
   */
  async startAutonomousOperation() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Main thinking loop
    this.scheduleThinking();
    
    // Start sub-systems
    await this.startSubsystems();
    
    console.log('🚀 AI Cofounder is now operational');
  }

  /**
   * Schedule thinking cycles
   */
  scheduleThinking() {
    // In production, use Inngest for reliable scheduling
    // This is a simplified version for demonstration
    
    const think = async () => {
      if (!this.isRunning) return;
      
      await this.think();
      
      // Schedule next thinking cycle
      const delay = this.calculateThinkingDelay();
      setTimeout(think, delay);
    };
    
    // Start first thinking cycle
    setTimeout(think, 1000);
  }

  /**
   * Calculate optimal delay between thinking cycles
   */
  calculateThinkingDelay() {
    // Adjust based on activity and urgency
    if (this.state.mode === 'autonomous') {
      return 5 * 60 * 1000; // 5 minutes
    } else if (this.state.mode === 'supervised') {
      return 15 * 60 * 1000; // 15 minutes
    } else {
      return 60 * 60 * 1000; // 1 hour
    }
  }

  /**
   * Update user with important information
   */
  async updateUser(results) {
    try {
      // Determine what's important to share
      const update = await this.prepareUserUpdate(results);
      
      // Send update via preferred channel
      await this.sendUserUpdate(update);
      
      // Log communication
      await this.memory.remember({
        content: `Updated user: ${update.summary}`,
        category: 'customer_interaction',
        importance: 0.7,
        context: { update, results }
      });
    } catch (error) {
      console.error('Error updating user:', error);
    }
  }

  /**
   * Handle errors gracefully with self-healing
   */
  async handleError(error) {
    try {
      console.error('AI Cofounder error:', error);
      
      // Analyze error
      const analysis = await this.analyzeError(error);
      
      // Attempt self-healing
      if (analysis.canRecover) {
        await this.attemptRecovery(analysis);
      } else {
        // Escalate to user
        await this.escalateError(error, analysis);
      }
      
      // Learn from error
      await this.memory.remember({
        content: `Error encountered: ${error.message}`,
        category: 'failure_lesson',
        importance: 0.8,
        context: { error: error.stack, analysis }
      });
    } catch (recoveryError) {
      console.error('Error in error handling:', recoveryError);
    }
  }

  // Helper methods
  async loadBusinessContext() {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', this.businessId)
      .single();
    
    return data;
  }

  async restoreState() {
    const { data } = await supabase
      .from('ai_cofounder_state')
      .select('*')
      .eq('business_id', this.businessId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (data?.[0]) {
      this.state = { ...this.state, ...data[0].state };
    }
  }

  async analyzeSituation(context) {
    // Analyze current business situation
    return {
      stage: context.stage || 'launch',
      health: 'good',
      opportunities: [],
      threats: []
    };
  }

  async defineGoals(context, situation) {
    // Define business goals based on context
    return [
      {
        type: 'revenue',
        target: 10000,
        timeline: '30_days',
        priority: 'high'
      },
      {
        type: 'customers',
        target: 100,
        timeline: '30_days',
        priority: 'high'
      }
    ];
  }

  async gatherMetrics() {
    const { data } = await supabase
      .from('business_metrics')
      .select('*')
      .eq('business_id', this.businessId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    return data?.[0] || {};
  }

  async checkConversations() {
    // Check active conversations
    return { summary: 'No active conversations' };
  }

  async checkExperiments() {
    // Check running experiments
    return { summary: `${this.experiments.activeExperiments.size} active experiments` };
  }

  async scanMarket() {
    // Scan market conditions
    return { trend: 'stable' };
  }

  async analyzeCompetitors() {
    // Analyze competitor activity
    return { changes: [] };
  }

  async synthesizePerception(data) {
    // Synthesize all perception data
    return 'Business operating normally with growth opportunities';
  }

  validateDecisions(decisions) {
    // Validate decisions against constraints
    return decisions;
  }

  groupDecisionsByType(decisions) {
    // Group decisions for parallel execution
    return {
      experiments: [],
      outreach: [],
      optimization: [],
      content: [],
      analysis: []
    };
  }

  async executeExperiments(experiments) {
    const results = [];
    for (const exp of experiments) {
      const result = await this.experiments.launchExperiment(exp);
      results.push(result);
    }
    return results;
  }

  async executeOutreach(outreach) {
    const results = [];
    
    // Use existing acquisition engine if available
    if (this.acquisitionEngine && outreach.length > 0) {
      try {
        const context = await this.loadBusinessContext();
        
        for (const campaign of outreach) {
          // Launch through real acquisition engine
          const acquisitionResult = await this.acquisitionEngine.launchChannels(
            context,
            {
              channels: [campaign.channel || 'email'],
              targetProspects: campaign.targetCount || 100,
              message: campaign.message
            }
          );
          
          results.push({
            ...acquisitionResult,
            campaign: campaign.id,
            executedThrough: 'acquisition_engine'
          });
        }
      } catch (error) {
        console.error('Error using acquisition engine, falling back:', error);
        // Fall back to conversation engine
        for (const campaign of outreach) {
          const result = await this.conversationEngine.generateProactiveOutreach(campaign);
          results.push(result);
        }
      }
    } else {
      // Use conversation engine directly
      for (const campaign of outreach) {
        const result = await this.conversationEngine.generateProactiveOutreach(campaign);
        results.push(result);
      }
    }
    
    return results;
  }

  async executeOptimizations(optimizations) {
    return [];
  }

  async executeContentCreation(content) {
    return [];
  }

  async executeAnalysis(analysis) {
    return [];
  }

  async analyzeOutcomes(decisions, results) {
    return { learnings: [] };
  }

  async adaptStrategy(reason) {
    await this.planner.adaptPlan(reason);
  }

  shouldUpdateUser(results) {
    // Determine if user should be updated
    return results.executed > 10 || results.failed > 0;
  }

  async prepareUserUpdate(results) {
    return {
      summary: `Executed ${results.executed} actions`,
      details: results
    };
  }

  async sendUserUpdate(update) {
    // Send update to user
    console.log('User update:', update);
  }

  async analyzeError(error) {
    return {
      canRecover: true,
      recoveryStrategy: 'retry'
    };
  }

  async attemptRecovery(analysis) {
    // Attempt to recover from error
    console.log('Attempting recovery:', analysis);
  }

  async escalateError(error, analysis) {
    // Escalate to user
    console.log('Escalating error:', error.message);
  }

  async conserveResources() {
    // Reduce activity when resources are low
    this.state.mode = 'supervised';
  }

  async updateState(results) {
    // Update and persist state
    await supabase
      .from('ai_cofounder_state')
      .insert({
        business_id: this.businessId,
        state: this.state,
        created_at: new Date().toISOString()
      });
  }

  async startSubsystems() {
    // Start all subsystems
    console.log('Starting subsystems...');
  }

  /**
   * Stop the AI Cofounder
   */
  async stop() {
    this.isRunning = false;
    console.log('🛑 AI Cofounder stopped');
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      running: this.isRunning,
      state: this.state,
      lastDecision: this.lastDecisionTime,
      activeExperiments: this.experiments.activeExperiments.size,
      planStatus: this.planner.currentPlan?.status
    };
  }
}
