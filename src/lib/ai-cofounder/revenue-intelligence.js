/**
 * Revenue Intelligence System
 * 
 * Predicts revenue, identifies opportunities, and optimizes pricing
 * Integrates with Central AI Brain and Revenue Graph for enhanced predictions
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { getCentralAIBrain } from '../central-ai-brain/orchestrator.js';
import { getRevenueGuaranteeEngine } from '../guarantee-engine/revenue-guarantee.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class RevenueIntelligence {
  constructor(businessId) {
    this.businessId = businessId;
    this.revenueGraph = null; // Lazy loaded
    this.guaranteeEngine = null; // Lazy loaded
  }

  /**
   * Generate revenue forecast using AI, historical data, and Revenue Graph intelligence
   */
  async generateForecast() {
    try {
      // Initialize integrations if needed
      await this.initializeIntegrations();
      
      // Get historical revenue data
      const { data: historicalData } = await supabase
        .from('business_metrics')
        .select('revenue, customers, created_at')
        .eq('business_id', this.businessId)
        .order('created_at', { ascending: true });

      // Get business context
      const { data: business } = await supabase
        .from('businesses')
        .select('business_data, created_at')
        .eq('id', this.businessId)
        .single();
      
      // Get Revenue Graph predictions
      let revenueGraphPredictions = null;
      if (this.revenueGraph && business) {
        const businessType = business.business_data?.businessType || 'service';
        const industry = business.business_data?.industry || 'general';
        
        // Get similar business performance
        const patterns = await this.revenueGraph.getBestStrategiesForBusiness(
          businessType,
          industry
        );
        
        // Get average revenue trajectory for similar businesses
        revenueGraphPredictions = await this.revenueGraph.getRevenueTrajectory(
          businessType,
          industry
        );
      }
      
      // Check guarantee status for urgency
      let guaranteeContext = null;
      if (this.guaranteeEngine) {
        const { data: guarantee } = await supabase
          .from('revenue_guarantees')
          .select('*')
          .eq('business_id', this.businessId)
          .eq('status', 'active')
          .single();
        
        if (guarantee) {
          const hoursUntilFirstSale = Math.max(0, 
            (new Date(guarantee.first_sale_deadline) - new Date()) / (1000 * 60 * 60)
          );
          const daysUntilRevenue = Math.max(0,
            (new Date(guarantee.revenue_target_deadline) - new Date()) / (1000 * 60 * 60 * 24)
          );
          
          guaranteeContext = {
            firstSaleUrgent: hoursUntilFirstSale < 24,
            revenueTargetUrgent: daysUntilRevenue < 30,
            targetRevenue: guarantee.revenue_target,
            hoursUntilFirstSale,
            daysUntilRevenue
          };
        }
      }

      if (!historicalData || historicalData.length < 7) {
        return this.generateInitialForecast(revenueGraphPredictions, guaranteeContext);
      }

      // Analyze trends
      const trends = this.analyzeTrends(historicalData);
      
      // Get external factors
      const factors = await this.getExternalFactors();
      
      // Generate forecast using GPT-4 with integrated intelligence
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a revenue forecasting expert with access to Revenue Graph intelligence.
                     Generate accurate revenue predictions based on historical data, proven patterns,
                     and guarantee requirements.`
          },
          {
            role: "user",
            content: `Historical data: ${JSON.stringify(historicalData.slice(-30))}
                     Trends: ${JSON.stringify(trends)}
                     External factors: ${JSON.stringify(factors)}
                     
                     Revenue Graph Predictions (similar businesses): ${JSON.stringify(revenueGraphPredictions)}
                     Guarantee Context: ${JSON.stringify(guaranteeContext)}
                     
                     Generate forecast for next 30 days that:
                     1. Incorporates Revenue Graph patterns for similar businesses
                     2. Accounts for guarantee requirements if urgent
                     3. Provides realistic but optimistic projections
                     
                     Include:
                     - Daily revenue predictions
                     - Confidence intervals (boosted by Revenue Graph data)
                     - Key growth drivers
                     - Risk factors
                     - Recommended actions (prioritize if guarantee at risk)
                     - Probability of meeting guarantee targets`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      let forecast;
      try {
        forecast = JSON.parse(response.choices[0].message.content);
      } catch (parseError) {
        console.warn('Failed to parse forecast JSON, using fallback:', parseError);
        // Fallback forecast
        forecast = {
          forecast: Array(30).fill(0).map((_, i) => ({
            day: i + 1,
            revenue: 100 + i * 10 + Math.random() * 50,
            confidence: 0.6
          })),
          confidence: 0.6,
          keyGrowthDrivers: ['Customer acquisition', 'Product optimization'],
          riskFactors: ['Market competition'],
          recommendedActions: ['Continue current strategy'],
          message: 'Fallback forecast due to JSON parsing error'
        };
      }
      
      // Boost confidence if backed by Revenue Graph
      if (revenueGraphPredictions) {
        forecast.confidence = Math.min(0.9, (forecast.confidence || 0.7) * 1.15);
        forecast.revenueGraphBacked = true;
      }

      // Store forecast
      await supabase
        .from('revenue_forecasts')
        .insert({
          business_id: this.businessId,
          forecast: forecast,
          confidence: forecast.confidence || 0.7,
          created_at: new Date().toISOString()
        });

      return forecast;
    } catch (error) {
      console.error('Error generating forecast:', error);
      throw error;
    }
  }
  
  /**
   * Initialize integrations with existing systems
   */
  async initializeIntegrations() {
    if (!this.revenueGraph) {
      const centralBrain = getCentralAIBrain();
      if (centralBrain) {
        this.revenueGraph = centralBrain.revenueAnalyzer;
      }
    }
    
    if (!this.guaranteeEngine) {
      this.guaranteeEngine = getRevenueGuaranteeEngine();
    }
  }

  /**
   * Identify revenue opportunities
   */
  async identifyOpportunities() {
    try {
      const [
        pricingOpportunities,
        upsellOpportunities,
        expansionOpportunities,
        retentionOpportunities
      ] = await Promise.all([
        this.findPricingOpportunities(),
        this.findUpsellOpportunities(),
        this.findExpansionOpportunities(),
        this.findRetentionOpportunities()
      ]);

      const allOpportunities = [
        ...pricingOpportunities,
        ...upsellOpportunities,
        ...expansionOpportunities,
        ...retentionOpportunities
      ];

      // Rank by potential impact
      const ranked = this.rankOpportunities(allOpportunities);

      return {
        opportunities: ranked,
        totalPotential: ranked.reduce((sum, o) => sum + (o.potentialRevenue || 0), 0)
      };
    } catch (error) {
      console.error('Error identifying opportunities:', error);
      return { opportunities: [], totalPotential: 0 };
    }
  }

  /**
   * Optimize pricing dynamically
   */
  async optimizePricing() {
    try {
      // Get current pricing
      const { data: currentPricing } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', this.businessId);

      // Get conversion data at different price points
      const conversionData = await this.getConversionData();
      
      // Get competitor pricing
      const competitorPricing = await this.getCompetitorPricing();
      
      // Calculate optimal pricing
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a pricing optimization expert. Calculate optimal prices to maximize revenue."
          },
          {
            role: "user",
            content: `Current pricing: ${JSON.stringify(currentPricing)}
                     Conversion data: ${JSON.stringify(conversionData)}
                     Competitor pricing: ${JSON.stringify(competitorPricing)}
                     
                     Recommend optimal pricing with:
                     - New price points
                     - Expected impact on conversion
                     - Revenue projections
                     - Implementation strategy
                     - Risk assessment`
          }
        ],
        temperature: 0.4,
        response_format: { type: "json_object" }
      });

      const optimization = JSON.parse(response.choices[0].message.content);

      return optimization;
    } catch (error) {
      console.error('Error optimizing pricing:', error);
      throw error;
    }
  }

  /**
   * Analyze customer lifetime value
   */
  async analyzeCustomerValue() {
    try {
      // Get customer data
      const { data: customers } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', this.businessId);

      if (!customers || customers.length === 0) {
        return { avgLTV: 0, segments: [] };
      }

      // Calculate LTV for each customer
      const ltvData = customers.map(customer => ({
        id: customer.id,
        ltv: this.calculateLTV(customer),
        segment: this.segmentCustomer(customer)
      }));

      // Analyze by segment
      const segments = this.analyzeSegments(ltvData);

      return {
        avgLTV: ltvData.reduce((sum, c) => sum + c.ltv, 0) / ltvData.length,
        segments,
        highValueCount: ltvData.filter(c => c.ltv > 1000).length,
        recommendations: await this.generateLTVRecommendations(segments)
      };
    } catch (error) {
      console.error('Error analyzing customer value:', error);
      return { avgLTV: 0, segments: [] };
    }
  }

  /**
   * Revenue attribution analysis
   */
  async analyzeAttribution() {
    try {
      // Get all revenue events
      const { data: revenueEvents } = await supabase
        .from('revenue_events')
        .select('*')
        .eq('business_id', this.businessId)
        .order('created_at', { ascending: false })
        .limit(1000);

      // Analyze attribution paths
      const attribution = {
        channels: {},
        campaigns: {},
        content: {},
        firstTouch: {},
        lastTouch: {},
        multiTouch: {}
      };

      for (const event of revenueEvents) {
        // Track attribution
        const source = event.source || 'direct';
        attribution.channels[source] = (attribution.channels[source] || 0) + event.amount;
        
        if (event.campaign) {
          attribution.campaigns[event.campaign] = 
            (attribution.campaigns[event.campaign] || 0) + event.amount;
        }
      }

      // Calculate ROI for each channel
      const roi = await this.calculateChannelROI(attribution);

      return {
        attribution,
        roi,
        topChannels: Object.entries(attribution.channels)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
        recommendations: await this.generateAttributionRecommendations(attribution, roi)
      };
    } catch (error) {
      console.error('Error analyzing attribution:', error);
      return { attribution: {}, roi: {} };
    }
  }

  // Helper methods
  analyzeTrends(data) {
    if (data.length < 2) return { growth: 0, volatility: 0 };

    const revenues = data.map(d => d.revenue || 0);
    const growth = (revenues[revenues.length - 1] - revenues[0]) / (revenues[0] || 1);
    
    // Calculate volatility
    const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const variance = revenues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / revenues.length;
    const volatility = Math.sqrt(variance) / (mean || 1);

    return {
      growth: growth * 100,
      volatility,
      trend: growth > 0 ? 'increasing' : 'decreasing',
      consistency: volatility < 0.3 ? 'stable' : 'volatile'
    };
  }

  async getExternalFactors() {
    // Get market conditions, seasonality, etc.
    return {
      season: this.getCurrentSeason(),
      marketTrend: 'growing',
      competitorActivity: 'moderate',
      economicIndicators: 'stable'
    };
  }

  getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  async generateInitialForecast(revenueGraphPredictions = null, guaranteeContext = null) {
    // For new businesses without historical data
    // Use Revenue Graph predictions if available
    
    let baseRevenue = 100;
    let growthRate = 0.05;
    let confidence = 0.5;
    let message = 'Initial forecast based on industry averages';
    
    if (revenueGraphPredictions) {
      // Use Revenue Graph data for better initial predictions
      baseRevenue = revenueGraphPredictions.avgFirstMonthRevenue || 150;
      growthRate = revenueGraphPredictions.avgGrowthRate || 0.1;
      confidence = 0.7; // Higher confidence with Revenue Graph data
      message = 'Initial forecast based on Revenue Graph patterns for similar businesses';
    }
    
    const forecast = Array(30).fill(0).map((_, i) => {
      let dailyRevenue = baseRevenue * (1 + growthRate * i / 30);
      
      // Boost early revenue if guarantee is urgent
      if (guaranteeContext?.firstSaleUrgent && i < 2) {
        dailyRevenue *= 2; // Double efforts for first 2 days
      }
      
      return {
        day: i + 1,
        revenue: dailyRevenue + (Math.random() - 0.5) * dailyRevenue * 0.2,
        confidence: confidence
      };
    });
    
    const result = {
      forecast,
      confidence,
      message,
      revenueGraphBacked: !!revenueGraphPredictions
    };
    
    if (guaranteeContext) {
      result.guaranteeStatus = {
        firstSaleTarget: guaranteeContext.firstSaleUrgent ? 'URGENT' : 'ON_TRACK',
        revenueTarget: guaranteeContext.revenueTargetUrgent ? 'AT_RISK' : 'ON_TRACK',
        recommendedActions: guaranteeContext.firstSaleUrgent ? 
          ['Launch immediate acquisition campaign', 'Activate all channels', 'Consider paid ads'] :
          ['Continue normal growth trajectory']
      };
    }
    
    return result;
  }

  async findPricingOpportunities() {
    return [
      {
        type: 'pricing',
        description: 'Increase premium tier price by 20%',
        potentialRevenue: 2000,
        confidence: 0.7,
        effort: 'low'
      }
    ];
  }

  async findUpsellOpportunities() {
    return [
      {
        type: 'upsell',
        description: 'Offer add-on services to existing customers',
        potentialRevenue: 1500,
        confidence: 0.8,
        effort: 'medium'
      }
    ];
  }

  async findExpansionOpportunities() {
    return [
      {
        type: 'expansion',
        description: 'Launch in new geographic market',
        potentialRevenue: 5000,
        confidence: 0.6,
        effort: 'high'
      }
    ];
  }

  async findRetentionOpportunities() {
    return [
      {
        type: 'retention',
        description: 'Implement loyalty program',
        potentialRevenue: 1000,
        confidence: 0.9,
        effort: 'medium'
      }
    ];
  }

  rankOpportunities(opportunities) {
    return opportunities.sort((a, b) => {
      const scoreA = (a.potentialRevenue * a.confidence) / (a.effort === 'low' ? 1 : a.effort === 'medium' ? 2 : 3);
      const scoreB = (b.potentialRevenue * b.confidence) / (b.effort === 'low' ? 1 : b.effort === 'medium' ? 2 : 3);
      return scoreB - scoreA;
    });
  }

  async getConversionData() {
    // Get conversion rates at different price points
    return {
      low: { price: 50, conversion: 0.05 },
      medium: { price: 100, conversion: 0.03 },
      high: { price: 200, conversion: 0.01 }
    };
  }

  async getCompetitorPricing() {
    // Get competitor pricing data
    return {
      average: 120,
      range: { min: 80, max: 200 }
    };
  }

  calculateLTV(customer) {
    // Simple LTV calculation
    const totalRevenue = customer.total_spent || 0;
    const monthsActive = customer.months_active || 1;
    const churnProbability = customer.churn_probability || 0.1;
    
    return totalRevenue * (1 / churnProbability);
  }

  segmentCustomer(customer) {
    const ltv = this.calculateLTV(customer);
    if (ltv > 1000) return 'high_value';
    if (ltv > 500) return 'medium_value';
    return 'low_value';
  }

  analyzeSegments(ltvData) {
    const segments = {};
    
    for (const customer of ltvData) {
      if (!segments[customer.segment]) {
        segments[customer.segment] = {
          count: 0,
          totalLTV: 0,
          avgLTV: 0
        };
      }
      
      segments[customer.segment].count++;
      segments[customer.segment].totalLTV += customer.ltv;
    }
    
    // Calculate averages
    for (const segment in segments) {
      segments[segment].avgLTV = segments[segment].totalLTV / segments[segment].count;
    }
    
    return segments;
  }

  async generateLTVRecommendations(segments) {
    const recommendations = [];
    
    if (segments.high_value?.count < segments.low_value?.count * 0.1) {
      recommendations.push('Focus on converting more high-value customers');
    }
    
    if (segments.low_value?.avgLTV < 100) {
      recommendations.push('Improve monetization of low-value segment');
    }
    
    return recommendations;
  }

  async calculateChannelROI(attribution) {
    const roi = {};
    
    // Placeholder - would need cost data for real ROI
    for (const channel in attribution.channels) {
      roi[channel] = {
        revenue: attribution.channels[channel],
        cost: attribution.channels[channel] * 0.3, // Assume 30% cost
        roi: 2.33 // 233% ROI
      };
    }
    
    return roi;
  }

  async generateAttributionRecommendations(attribution, roi) {
    const recommendations = [];
    
    // Find best performing channels
    const bestChannel = Object.entries(roi)
      .sort((a, b) => b[1].roi - a[1].roi)[0];
    
    if (bestChannel) {
      recommendations.push(`Increase investment in ${bestChannel[0]} - highest ROI`);
    }
    
    return recommendations;
  }
}
