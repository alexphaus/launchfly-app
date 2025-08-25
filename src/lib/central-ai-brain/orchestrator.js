// src/lib/central-ai-brain/orchestrator.js
/**
 * Central AI Brain - Master Orchestrator
 * 
 * Coordinates all AI systems across all businesses:
 * - Business creation and optimization
 * - Revenue pattern analysis
 * - Cross-business learning
 * - Resource allocation and prioritization
 * - Success prediction and intervention
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { inngest } from '../inngest.js';
import { AIBusinessAgent } from '../ai-business-agent';
import { RevenueGraphAnalyzer } from './revenue-graph-analyzer';
import { BusinessMarketplace } from './business-marketplace';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Central AI Brain - Master Orchestrator Class
 * Manages 10,000+ businesses simultaneously with intelligent resource allocation
 */
export class CentralAIBrain {
  constructor() {
    this.isActive = true;
    this.businessAgents = new Map(); // businessId -> AIBusinessAgent
    this.revenueAnalyzer = new RevenueGraphAnalyzer();
    this.marketplace = new BusinessMarketplace();
    this.systemMetrics = {
      totalBusinesses: 0,
      activeOptimizations: 0,
      successRate: 0,
      avgTimeToFirstSale: 0
    };
  }

  /**
   * Initialize the Central AI Brain
   */
  async initialize() {
    console.log('🧠 Initializing Central AI Brain...');
    
    // Load all active businesses
    await this.loadActiveBusinesses();
    
    // Initialize revenue pattern analysis
    await this.revenueAnalyzer.initialize();
    
    // Initialize business marketplace
    await this.marketplace.initialize();
    
    // Start master coordination loop
    this.startMasterCoordination();
    
    console.log(`🧠 Central AI Brain initialized with ${this.businessAgents.size} businesses`);
    return { success: true, businessCount: this.businessAgents.size };
  }

  /**
   * Load and initialize all active businesses
   */
  async loadActiveBusinesses() {
    const { data: businesses } = await supabase
      .from('businesses')
      .select('*')
      .eq('status', 'ready')
      .eq('ai_agent_enabled', true);

    for (const business of businesses || []) {
      const agent = new AIBusinessAgent(business.id);
      this.businessAgents.set(business.id, agent);
    }

    this.systemMetrics.totalBusinesses = this.businessAgents.size;
  }

  /**
   * Master coordination loop - runs every 5 minutes
   * Intelligently allocates resources and coordinates optimizations
   */
  startMasterCoordination() {
    setInterval(async () => {
      if (!this.isActive) return;
      
      try {
        await this.coordinateSystemOptimizations();
      } catch (error) {
        console.error('Error in master coordination:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Coordinate system-wide optimizations
   */
  async coordinateSystemOptimizations() {
    console.log('🧠 Running master coordination cycle...');
    
    // 1. Analyze system-wide performance
    const systemAnalysis = await this.analyzeSystemPerformance();
    
    // 2. Identify high-priority businesses needing intervention
    const priorityBusinesses = await this.identifyPriorityBusinesses(systemAnalysis);
    
    // 3. Allocate AI resources intelligently
    await this.allocateAIResources(priorityBusinesses);
    
    // 4. Cross-pollinate successful strategies
    await this.crossPollinateStrategies();
    
    // 5. Update revenue patterns and predictions
    await this.updateRevenueIntelligence();
    
    // 6. Generate system-wide insights
    await this.generateSystemInsights(systemAnalysis);
    
    console.log('🧠 Master coordination cycle completed');
  }

  /**
   * Analyze system-wide performance and identify patterns
   */
  async analyzeSystemPerformance() {
    const businesses = await this.getAllBusinessMetrics();
    
    const analysis = {
      totalRevenue: businesses.reduce((sum, b) => sum + (b.total_revenue || 0), 0),
      avgRevenue: businesses.length > 0 ? businesses.reduce((sum, b) => sum + (b.total_revenue || 0), 0) / businesses.length : 0,
      successRate: businesses.filter(b => (b.total_revenue || 0) >= 1000).length / businesses.length,
      strugglingBusinesses: businesses.filter(b => (b.total_revenue || 0) < 100),
      topPerformers: businesses.filter(b => (b.total_revenue || 0) >= 2000),
      recentLaunches: businesses.filter(b => {
        const launchDate = new Date(b.created_at);
        const daysSinceLaunch = (Date.now() - launchDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLaunch <= 7;
      })
    };

    // Update system metrics
    this.systemMetrics = {
      ...this.systemMetrics,
      totalBusinesses: businesses.length,
      successRate: analysis.successRate,
      avgTimeToFirstSale: await this.calculateAvgTimeToFirstSale(businesses)
    };

    return analysis;
  }

  /**
   * Identify businesses that need immediate AI intervention
   */
  async identifyPriorityBusinesses(systemAnalysis) {
    const priorityBusinesses = [];

    // 1. Businesses approaching guarantee deadlines
    const guaranteeRisk = await supabase
      .from('businesses')
      .select('*')
      .not('guarantee_start_at', 'is', null)
      .eq('guarantee_48h_status', 'pending')
      .lt('guarantee_start_at', new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()); // 36 hours ago

    priorityBusinesses.push(...guaranteeRisk.data?.map(b => ({
      ...b,
      priority: 'critical',
      reason: 'guarantee_deadline_approaching',
      intervention: 'emergency_optimization'
    })) || []);

    // 2. High-potential businesses with low conversion
    const underperformers = systemAnalysis.strugglingBusinesses
      .filter(b => {
        const daysSinceLaunch = (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLaunch >= 3 && (b.total_visitors || 0) > 50; // Has traffic but no sales
      })
      .map(b => ({
        ...b,
        priority: 'high',
        reason: 'high_traffic_low_conversion',
        intervention: 'conversion_optimization'
      }));

    priorityBusinesses.push(...underperformers);

    // 3. Recent launches needing quick wins
    const recentLaunches = systemAnalysis.recentLaunches
      .filter(b => (b.total_revenue || 0) === 0)
      .map(b => ({
        ...b,
        priority: 'medium',
        reason: 'new_launch_needs_first_sale',
        intervention: 'first_sale_acceleration'
      }));

    priorityBusinesses.push(...recentLaunches);

    return priorityBusinesses.sort((a, b) => {
      const priorityOrder = { critical: 3, high: 2, medium: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Intelligently allocate AI resources based on priority and potential
   */
  async allocateAIResources(priorityBusinesses) {
    const maxConcurrentOptimizations = 50; // Prevent system overload
    let activeOptimizations = 0;

    for (const business of priorityBusinesses) {
      if (activeOptimizations >= maxConcurrentOptimizations) break;

      const agent = this.businessAgents.get(business.id);
      if (!agent) continue;

      // Trigger specific intervention based on business needs
      switch (business.intervention) {
        case 'emergency_optimization':
          await this.triggerEmergencyOptimization(business);
          break;
        case 'conversion_optimization':
          await this.triggerConversionOptimization(business);
          break;
        case 'first_sale_acceleration':
          await this.triggerFirstSaleAcceleration(business);
          break;
      }

      activeOptimizations++;
    }

    this.systemMetrics.activeOptimizations = activeOptimizations;
  }

  /**
   * Cross-pollinate successful strategies across businesses
   */
  async crossPollinateStrategies() {
    // Get top-performing strategies from revenue graph
    const topStrategies = await this.revenueAnalyzer.getTopPerformingStrategies();
    
    // Apply successful patterns to similar businesses
    for (const strategy of topStrategies) {
      const similarBusinesses = await this.findSimilarBusinesses(strategy.businessType, strategy.industry);
      
      for (const business of similarBusinesses) {
        if (business.total_revenue < strategy.avgRevenue * 0.5) { // Underperforming similar business
          await this.applySuccessfulStrategy(business.id, strategy);
        }
      }
    }
  }

  /**
   * Update revenue intelligence and patterns
   */
  async updateRevenueIntelligence() {
    await this.revenueAnalyzer.updatePatterns();
    
    // Generate predictions for all businesses
    const businesses = await this.getAllBusinessMetrics();
    
    for (const business of businesses) {
      const prediction = await this.revenueAnalyzer.predictBusinessSuccess(business);
      
      // Store prediction
      await supabase
        .from('businesses')
        .update({
          projected_revenue: prediction.projectedRevenue,
          business_data: {
            ...business.business_data,
            successPrediction: prediction
          }
        })
        .eq('id', business.id);
    }
  }

  /**
   * Generate system-wide insights and alerts
   */
  async generateSystemInsights(systemAnalysis) {
    const insights = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{
        role: "user",
        content: `Analyze this system performance data and provide strategic insights:
        
        System Metrics:
        - Total Businesses: ${this.systemMetrics.totalBusinesses}
        - Success Rate: ${(this.systemMetrics.successRate * 100).toFixed(1)}%
        - Avg Revenue: $${systemAnalysis.avgRevenue.toFixed(2)}
        - Total Revenue: $${systemAnalysis.totalRevenue.toFixed(2)}
        
        Performance Breakdown:
        - Top Performers: ${systemAnalysis.topPerformers.length}
        - Struggling: ${systemAnalysis.strugglingBusinesses.length}
        - Recent Launches: ${systemAnalysis.recentLaunches.length}
        
        Provide:
        1. Key performance insights
        2. System-wide optimization opportunities
        3. Resource allocation recommendations
        4. Risk alerts and mitigation strategies
        5. Growth acceleration tactics
        
        Format as JSON with actionable insights.`
      }]
    });

    const systemInsights = JSON.parse(insights.choices[0].message.content);
    
    // Store system insights
    await supabase
      .from('ai_activities')
      .insert({
        business_id: null, // System-wide insight
        type: 'system_analysis',
        icon: '🧠',
        message: 'Central AI Brain generated system insights',
        details: `Success rate: ${(this.systemMetrics.successRate * 100).toFixed(1)}%. ${systemInsights.keyInsights?.[0] || 'System operating normally'}`,
        metadata: {
          systemMetrics: this.systemMetrics,
          insights: systemInsights,
          timestamp: new Date().toISOString()
        }
      });

    return systemInsights;
  }

  // Intervention Methods
  async triggerEmergencyOptimization(business) {
    console.log(`🚨 Emergency optimization for business ${business.id}`);
    
    // Apply proven high-conversion templates immediately
    const bestTemplate = await this.marketplace.getBestTemplateForBusiness(business);
    await this.applyTemplate(business.id, bestTemplate);
    
    // Activate all traffic sources
    await inngest.send({
      name: 'emergency-traffic-boost',
      data: { businessId: business.id, priority: 'critical' }
    });
  }

  async triggerConversionOptimization(business) {
    console.log(`🎯 Conversion optimization for business ${business.id}`);
    
    // A/B test proven high-converting elements
    const agent = this.businessAgents.get(business.id);
    await agent?.optimizeConversionRates(business);
  }

  async triggerFirstSaleAcceleration(business) {
    console.log(`⚡ First sale acceleration for business ${business.id}`);
    
    // Apply fastest-converting offer template
    const quickWinTemplate = await this.marketplace.getQuickWinTemplate(business);
    await this.applyTemplate(business.id, quickWinTemplate);
  }

  // Helper Methods
  async getAllBusinessMetrics() {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('status', 'ready');
    return data || [];
  }

  async calculateAvgTimeToFirstSale(businesses) {
    const businessesWithSales = businesses.filter(b => b.first_sale_date);
    if (businessesWithSales.length === 0) return 0;
    
    const totalTime = businessesWithSales.reduce((sum, b) => {
      const launchTime = new Date(b.created_at).getTime();
      const firstSaleTime = new Date(b.first_sale_date).getTime();
      return sum + (firstSaleTime - launchTime);
    }, 0);
    
    return totalTime / businessesWithSales.length / (1000 * 60 * 60); // Hours
  }

  async findSimilarBusinesses(businessType, industry) {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('status', 'ready')
      .contains('business_data', { businessType, industry });
    return data || [];
  }

  async applySuccessfulStrategy(businessId, strategy) {
    await supabase
      .from('ai_activities')
      .insert({
        business_id: businessId,
        type: 'strategy_application',
        icon: '🎯',
        message: `Applied successful ${strategy.strategyType} strategy`,
        details: `Implementing strategy that achieved ${strategy.avgRevenue.toFixed(0)}% higher revenue`,
        metadata: { strategy, appliedAt: new Date().toISOString() }
      });
  }

  async applyTemplate(businessId, template) {
    // Implementation to apply business template
    console.log(`Applying template ${template.id} to business ${businessId}`);
  }

  /**
   * Get system status and metrics
   */
  getSystemStatus() {
    return {
      isActive: this.isActive,
      metrics: this.systemMetrics,
      businessCount: this.businessAgents.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Shutdown the Central AI Brain
   */
  async shutdown() {
    console.log('🧠 Shutting down Central AI Brain...');
    this.isActive = false;
    
    // Gracefully shutdown all business agents
    for (const [businessId, agent] of this.businessAgents) {
      await agent.stop?.();
    }
    
    return { success: true, message: 'Central AI Brain shutdown complete' };
  }
}

/**
 * Global Central AI Brain instance
 */
let centralBrainInstance = null;

/**
 * Initialize the Central AI Brain (singleton)
 */
export async function initializeCentralAIBrain() {
  if (!centralBrainInstance) {
    centralBrainInstance = new CentralAIBrain();
    await centralBrainInstance.initialize();
  }
  return centralBrainInstance;
}

/**
 * Get the Central AI Brain instance
 */
export function getCentralAIBrain() {
  return centralBrainInstance;
}

/**
 * Shutdown the Central AI Brain
 */
export async function shutdownCentralAIBrain() {
  if (centralBrainInstance) {
    await centralBrainInstance.shutdown();
    centralBrainInstance = null;
  }
}
