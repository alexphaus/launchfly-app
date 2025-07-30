// lib/core/index.js - The Future-Proof Launchfly Core
import { analyzeOpportunity } from './analyze.js';
import { launchBusiness } from './launch.js';
import { growBusiness } from './grow.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * The Future-Proof Launchfly Core
 * 
 * This is the entire business in one elegant system:
 * 1. Find what will work (analyze.js) - AI-resistant market intelligence
 * 2. Create the business (launch.js) - Technology agnostic execution  
 * 3. Make it successful (grow.js) - The defensible moat
 */
export class LaunchflyCore {
  constructor() {
    console.log('🚀 LaunchflyCore initialized - Future-proof business engine');
  }

  /**
   * The complete business creation and success system
   * This replaces the old "generateBusinessWithAI" approach
   */
  async createSuccessfulBusiness(userData, sessionId, businessId, options = {}) {
    console.log('🎯 Starting complete business success system for:', userData.name);
    
    try {
      // Phase 1: Intelligence Layer (AI-resistant moat)
      await this.updateProgress(sessionId, 'analyzing', 20, 'Analyzing your opportunity...');
      const opportunity = await analyzeOpportunity(userData);
      
      console.log('✅ Opportunity analysis complete:', {
        confidence: opportunity.confidence.percentage,
        revenue: opportunity.revenueProjection?.month6
      });

      // Phase 2: Execution Layer (technology agnostic)
      await this.updateProgress(sessionId, 'building', 50, 'Building your business...');
      const business = await launchBusiness(opportunity, userData, sessionId);
      
      console.log('✅ Business launch complete:', {
        channels: business.acquisition.primaryChannel,
        outreach: business.outreach.plans.length
      });

      // Phase 3: Success Layer (defensible moat)
      await this.updateProgress(sessionId, 'optimizing', 80, 'Setting up growth systems...');
      const growth = await growBusiness(businessId, sessionId, options.targetRevenue || 5000);
      
      console.log('✅ Growth system setup complete:', {
        experiments: growth.growthPlan.length,
        projectedGrowth: growth.projectedGrowth
      });

      // Combine all layers into final business data
      const completeBusinessData = this.combineBusinessLayers(opportunity, business, growth, userData);
      
      // Update database with complete business
      await this.saveFinalBusinessData(businessId, sessionId, completeBusinessData);
      
      await this.updateProgress(sessionId, 'complete', 100, 'Your business is ready to succeed!');
      
      return completeBusinessData;
      
    } catch (error) {
      console.error('❌ Business creation failed:', error);
      await this.updateProgress(sessionId, 'error', 0, 'Something went wrong. Please try again.');
      throw error;
    }
  }

  /**
   * Continuous success optimization - the real value
   * This runs after business creation to ensure ongoing success
   */
  async optimizeForSuccess(businessId, sessionId) {
    console.log('📈 Starting continuous success optimization...');
    
    // Analyze current performance
    const performance = await this.analyzeBusinessPerformance(businessId);
    
    if (performance.needsOptimization) {
      // Run growth optimization
      const optimization = await growBusiness(businessId, sessionId);
      
      // Apply improvements
      await this.applyOptimizations(businessId, optimization);
      
      console.log('✅ Business optimized for better performance');
      return optimization;
    }
    
    console.log('✅ Business is performing well - no optimization needed');
    return { status: 'optimal', performance };
  }

  /**
   * Success guarantee system - this is what we really sell
   */
  async guaranteeSuccess(businessId, sessionId, guarantee = 'first_customer_7_days') {
    console.log('🛡️ Activating success guarantee system...');
    
    const guarantees = {
      'first_customer_7_days': {
        target: 'Get first paying customer',
        timeframe: 7,
        actions: ['intensive_outreach', 'conversion_optimization', 'personal_assistance']
      },
      'profitable_30_days': {
        target: 'Reach profitability',
        timeframe: 30,
        actions: ['growth_acceleration', 'acquisition_scaling', 'optimization_sprint']
      },
      'target_revenue_90_days': {
        target: 'Reach target revenue',
        timeframe: 90,
        actions: ['full_optimization', 'channel_expansion', 'strategic_partnerships']
      }
    };

    const selectedGuarantee = guarantees[guarantee];
    
    // Set up guarantee tracking
    await supabase
      .from('success_guarantees')
      .insert({
        business_id: businessId,
        session_id: sessionId,
        guarantee_type: guarantee,
        target: selectedGuarantee.target,
        deadline: new Date(Date.now() + selectedGuarantee.timeframe * 24 * 60 * 60 * 1000),
        actions: selectedGuarantee.actions,
        status: 'active'
      });

    // Start guarantee fulfillment process
    await this.executeGuaranteeActions(businessId, selectedGuarantee.actions);
    
    return {
      guarantee: selectedGuarantee,
      deadline: new Date(Date.now() + selectedGuarantee.timeframe * 24 * 60 * 60 * 1000),
      tracking_url: `/guarantee/${businessId}`,
      commitment: "We'll work until you succeed or refund 100%"
    };
  }

  // Helper methods for the core system

  combineBusinessLayers(opportunity, business, growth, userData) {
    return {
      // Legacy compatibility (for existing UI)
      businessName: opportunity.opportunity.name || business.business.website.businessName,
      tagline: opportunity.opportunity.description || business.business.website.tagline,
      domain: business.business.website.domain,
      logo: business.business.website.logo,
      revenue: opportunity.revenueProjection?.month6 || '$5,000/month',
      
      // Enhanced business data with success systems
      opportunity: opportunity,
      launch: business,
      growth: growth,
      
      // Success metrics and tracking
      successProbability: opportunity.confidence.percentage,
      quickWins: opportunity.quickWins,
      acquisitionPlan: business.acquisition,
      growthPlan: growth.growthPlan,
      
      // Customer acquisition (the real value)
      customerAcquisition: {
        primaryChannel: business.acquisition.primaryChannel,
        outreachTemplates: business.acquisition.outreachTemplates,
        campaigns: business.campaigns,
        tracking: business.tracking
      },
      
      // Growth and optimization
      optimization: {
        currentPerformance: growth.currentPerformance,
        bottlenecks: growth.currentPerformance?.weaknesses || [],
        experiments: growth.growthPlan.slice(0, 5), // Top 5 experiments
        projectedGrowth: growth.projectedGrowth
      },
      
      // Legacy website data (for backwards compatibility)
      products: this.extractProducts(opportunity, business),
      targetCustomers: opportunity.opportunity.targetCustomers || [],
      monthlyData: this.generateRevenueProjection(opportunity.revenueProjection),
      marketingStrategy: {
        channels: [business.acquisition.primaryChannel, business.acquisition.secondaryChannel],
        firstSteps: opportunity.quickWins?.immediate || [],
        contentIdeas: business.campaigns.contentMarketing?.ideas || []
      },
      theme: business.business.website.theme || this.getDefaultTheme(),
      layout: business.business.website.layout || this.getDefaultLayout()
    };
  }

  async saveFinalBusinessData(businessId, sessionId, businessData) {
    console.log('💾 Saving complete business data...');
    
    // Update business record
    await supabase
      .from('businesses')
      .update({
        name: businessData.businessName,
        subdomain: businessData.domain?.replace('.com', '').toLowerCase() || `business-${Date.now()}`,
        business_data: businessData,
        status: 'ready',
        launch_date: new Date().toISOString()
      })
      .eq('id', businessId);

    // Create success tracking record
    await supabase
      .from('business_success_tracking')
      .insert({
        business_id: businessId,
        session_id: sessionId,
        success_probability: businessData.successProbability,
        acquisition_plan: businessData.acquisitionPlan,
        growth_plan: businessData.growth,
        created_at: new Date().toISOString()
      });

    console.log('✅ Business data saved successfully');
  }

  async updateProgress(sessionId, stage, progress, message) {
    const { error } = await supabase
      .from('sessions')
      .update({
        stage: stage,
        progress: progress,
        stage_message: message
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Failed to update progress:', error);
    } else {
      console.log(`📊 Progress updated: ${stage} (${progress}%) - ${message}`);
    }
  }

  async analyzeBusinessPerformance(businessId) {
    const { data: business } = await supabase
      .from('businesses')
      .select('*, business_success_tracking(*)')
      .eq('id', businessId)
      .single();

    // Simple performance check
    const daysSinceLaunch = business.launch_date ? 
      Math.floor((Date.now() - new Date(business.launch_date)) / (1000 * 60 * 60 * 24)) : 0;
    
    const needsOptimization = 
      business.total_revenue < 500 && daysSinceLaunch > 7 ||
      business.total_revenue < 1000 && daysSinceLaunch > 30;

    return {
      business,
      daysSinceLaunch,
      needsOptimization,
      currentRevenue: business.total_revenue,
      performance: needsOptimization ? 'below_target' : 'on_track'
    };
  }

  async applyOptimizations(businessId, optimization) {
    // Apply the top optimization recommendations
    const topOptimizations = optimization.optimizations?.recommendations?.slice(0, 3) || [];
    
    await supabase
      .from('businesses')
      .update({
        optimizations_applied: topOptimizations,
        last_optimization: new Date().toISOString()
      })
      .eq('id', businessId);

    console.log('🔧 Applied optimizations:', topOptimizations);
  }

  async executeGuaranteeActions(businessId, actions) {
    for (const action of actions) {
      console.log(`🎯 Executing guarantee action: ${action}`);
      
      // In production, this would trigger specific workflows
      await this.executeGuaranteeAction(businessId, action);
    }
  }

  async executeGuaranteeAction(businessId, action) {
    const actionImplementations = {
      'intensive_outreach': async () => {
        // Would trigger automated outreach campaigns
        console.log('🎯 Starting intensive customer outreach...');
      },
      'conversion_optimization': async () => {
        // Would run A/B tests and optimization experiments
        console.log('🔧 Optimizing conversion rates...');
      },
      'personal_assistance': async () => {
        // Would assign human support
        console.log('👥 Assigning personal success manager...');
      },
      'growth_acceleration': async () => {
        // Would scale successful channels
        console.log('📈 Accelerating growth channels...');
      }
    };

    const implementation = actionImplementations[action];
    if (implementation) {
      await implementation();
    }
  }

  // Utility methods for backwards compatibility

  extractProducts(opportunity, business) {
    return opportunity.opportunity.products || 
           business.business.website.products || 
           [
             { name: "Starter Package", price: "$97", description: "Perfect for getting started" },
             { name: "Professional Package", price: "$297", description: "Everything you need to succeed" },
             { name: "Premium Package", price: "$497", description: "Full-service solution" }
           ];
  }

  generateRevenueProjection(revenueProjection) {
    if (revenueProjection) {
      return [
        { month: "Month 1", revenue: revenueProjection.month1 || 500 },
        { month: "Month 2", revenue: Math.round((revenueProjection.month1 || 500) * 1.8) },
        { month: "Month 3", revenue: revenueProjection.month3 || 2000 },
        { month: "Month 4", revenue: Math.round((revenueProjection.month3 || 2000) * 1.4) },
        { month: "Month 5", revenue: Math.round((revenueProjection.month6 || 5000) * 0.8) },
        { month: "Month 6", revenue: revenueProjection.month6 || 5000 }
      ];
    }

    return [
      { month: "Month 1", revenue: 500 },
      { month: "Month 2", revenue: 1200 },
      { month: "Month 3", revenue: 2800 },
      { month: "Month 4", revenue: 4200 },
      { month: "Month 5", revenue: 5500 },
      { month: "Month 6", revenue: 7200 }
    ];
  }

  getDefaultTheme() {
    return {
      colors: {
        primary: "#3b82f6",
        secondary: "#1e40af",
        textDark: "#1f2937",
        textGray: "#6b7280",
        borderColor: "#e5e7eb"
      },
      font: "Inter",
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    };
  }

  getDefaultLayout() {
    return [
      {
        component: "NavBar",
        props: {
          businessName: "Your Business",
          links: ["About", "Services", "Contact"],
          ctaText: "Get Started"
        }
      },
      {
        component: "Hero",
        props: {
          title: "Transform Your Vision Into Reality",
          subtitle: "Professional solutions for your success",
          ctaText: "Start Today"
        }
      },
      {
        component: "FeatureGrid",
        props: {
          title: "Why Choose Us",
          features: [
            { icon: "⚡", title: "Fast Results", description: "See results quickly" },
            { icon: "🎯", title: "Targeted Solutions", description: "Customized for you" },
            { icon: "🚀", title: "Growth Focused", description: "Built to scale" }
          ]
        }
      },
      {
        component: "CallToAction",
        props: {
          title: "Ready to Get Started?",
          ctaText: "Start Now"
        }
      },
      {
        component: "Footer",
        props: {
          businessName: "Your Business"
        }
      }
    ];
  }
}

// Export the core class and individual functions
export { analyzeOpportunity, launchBusiness, growBusiness };

// Create singleton instance
export const launchflyCore = new LaunchflyCore();
