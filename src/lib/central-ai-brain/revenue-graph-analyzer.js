// src/lib/central-ai-brain/revenue-graph-analyzer.js
/**
 * Revenue Graph Database - The Core Competitive Moat
 * 
 * Tracks and analyzes EVERY conversion event across ALL businesses to build
 * proprietary intelligence on what actually converts:
 * 
 * Revenue Graph = Business Type × Industry × Offer × Channel × Message × Timing
 * 
 * This creates unbeatable competitive advantage through network effects:
 * - Business #1: Basic AI
 * - Business #100: Smart AI that knows what works  
 * - Business #1000: Unbeatable AI with perfect conversion intelligence
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class RevenueGraphAnalyzer {
  constructor() {
    this.patterns = new Map(); // Cache for revenue patterns
    this.isInitialized = false;
  }

  /**
   * Initialize the Revenue Graph Analyzer
   */
  async initialize() {
    console.log('📊 Initializing Revenue Graph Analyzer...');
    
    // Create revenue patterns table if not exists
    await this.ensureRevenueGraphTables();
    
    // Load existing patterns into memory
    await this.loadRevenuePatterns();
    
    this.isInitialized = true;
    console.log('📊 Revenue Graph Analyzer initialized');
  }

  /**
   * Ensure all revenue graph tables exist
   */
  async ensureRevenueGraphTables() {
    // This will be handled by migration, but we can check here
    const { error } = await supabase
      .from('revenue_patterns')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') { // Table doesn't exist
      console.log('📊 Revenue patterns table not found. Please run the migration.');
    }
  }

  /**
   * Record a conversion event in the Revenue Graph
   * This is called every time ANY business gets a conversion
   */
  async recordConversion(conversionData) {
    const {
      businessId,
      businessType,
      industry,
      offerType,
      channel,
      messageTemplate,
      timing,
      conversionValue,
      customerData,
      campaignData
    } = conversionData;

    // Extract conversion intelligence
    const pattern = {
      business_type: businessType,
      industry: industry,
      offer_type: offerType,
      channel: channel,
      message_template: messageTemplate,
      timing_pattern: timing,
      conversion_rate: 1, // This conversion succeeded
      avg_order_value: conversionValue,
      customer_profile: customerData,
      campaign_context: campaignData,
      sample_size: 1,
      confidence_score: 0.1, // Low confidence with single data point
      created_at: new Date().toISOString()
    };

    // Store in revenue patterns
    const { data, error } = await supabase
      .from('revenue_patterns')
      .insert(pattern)
      .select()
      .single();

    if (error) {
      console.error('Error recording conversion pattern:', error);
      return null;
    }

    // Update aggregated patterns
    await this.updateAggregatedPattern(pattern);
    
    // Log the learning
    await supabase
      .from('ai_activities')
      .insert({
        business_id: businessId,
        type: 'revenue_learning',
        icon: '📈',
        message: 'Revenue Graph learned from conversion',
        details: `Recorded ${offerType} conversion via ${channel} for ${industry} business`,
        metadata: {
          pattern: pattern,
          learningValue: 'conversion_success',
          timestamp: new Date().toISOString()
        }
      });

    return data;
  }

  /**
   * Record a failed conversion attempt (equally important for learning)
   */
  async recordFailedConversion(failureData) {
    const {
      businessId,
      businessType,
      industry,
      offerType,
      channel,
      messageTemplate,
      timing,
      failureReason
    } = failureData;

    const pattern = {
      business_type: businessType,
      industry: industry,
      offer_type: offerType,
      channel: channel,
      message_template: messageTemplate,
      timing_pattern: timing,
      conversion_rate: 0, // This attempt failed
      avg_order_value: 0,
      failure_reason: failureReason,
      sample_size: 1,
      confidence_score: 0.1,
      created_at: new Date().toISOString()
    };

    await supabase
      .from('revenue_patterns')
      .insert(pattern);

    await this.updateAggregatedPattern(pattern);
  }

  /**
   * Update aggregated patterns for better intelligence
   */
  async updateAggregatedPattern(newPattern) {
    const patternKey = `${newPattern.business_type}_${newPattern.industry}_${newPattern.offer_type}_${newPattern.channel}`;
    
    // Get existing aggregated pattern
    const { data: existing } = await supabase
      .from('revenue_pattern_aggregates')
      .select('*')
      .eq('pattern_key', patternKey)
      .single();

    if (existing) {
      // Update existing aggregate
      const totalSamples = existing.sample_size + newPattern.sample_size;
      const totalConversions = (existing.conversion_rate * existing.sample_size) + (newPattern.conversion_rate * newPattern.sample_size);
      const totalValue = (existing.avg_order_value * existing.sample_size) + (newPattern.avg_order_value * newPattern.sample_size);
      
      const updatedAggregate = {
        conversion_rate: totalConversions / totalSamples,
        avg_order_value: totalValue / totalSamples,
        sample_size: totalSamples,
        confidence_score: Math.min(0.95, totalSamples / 100), // Higher confidence with more samples
        last_updated: new Date().toISOString()
      };

      await supabase
        .from('revenue_pattern_aggregates')
        .update(updatedAggregate)
        .eq('pattern_key', patternKey);
    } else {
      // Create new aggregate
      await supabase
        .from('revenue_pattern_aggregates')
        .insert({
          pattern_key: patternKey,
          business_type: newPattern.business_type,
          industry: newPattern.industry,
          offer_type: newPattern.offer_type,
          channel: newPattern.channel,
          conversion_rate: newPattern.conversion_rate,
          avg_order_value: newPattern.avg_order_value,
          sample_size: newPattern.sample_size,
          confidence_score: newPattern.confidence_score,
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        });
    }
  }

  /**
   * Get the best-performing strategies for a business type
   */
  async getBestStrategiesForBusiness(businessType, industry) {
    const { data: patterns } = await supabase
      .from('revenue_pattern_aggregates')
      .select('*')
      .eq('business_type', businessType)
      .eq('industry', industry)
      .gte('confidence_score', 0.3) // Only patterns with reasonable confidence
      .order('conversion_rate', { ascending: false })
      .limit(10);

    return patterns || [];
  }

  /**
   * Predict business success probability based on Revenue Graph intelligence
   */
  async predictBusinessSuccess(business) {
    const businessType = business.business_data?.businessType || 'service';
    const industry = business.business_data?.industry || 'general';
    
    // Get similar business patterns
    const { data: similarPatterns } = await supabase
      .from('revenue_pattern_aggregates')
      .select('*')
      .eq('business_type', businessType)
      .eq('industry', industry)
      .gte('sample_size', 5); // Only patterns with meaningful sample size

    if (!similarPatterns || similarPatterns.length === 0) {
      return {
        successProbability: 0.5, // Default probability
        projectedRevenue: 1000,
        confidence: 'low',
        recommendations: ['No similar business data available yet']
      };
    }

    // Calculate weighted success probability
    const totalSamples = similarPatterns.reduce((sum, p) => sum + p.sample_size, 0);
    const weightedConversionRate = similarPatterns.reduce((sum, p) => 
      sum + (p.conversion_rate * p.sample_size), 0) / totalSamples;
    const avgOrderValue = similarPatterns.reduce((sum, p) => 
      sum + (p.avg_order_value * p.sample_size), 0) / totalSamples;

    // Estimate monthly revenue based on patterns
    const estimatedMonthlyVisitors = 1000; // Conservative estimate
    const projectedRevenue = estimatedMonthlyVisitors * weightedConversionRate * avgOrderValue;

    // Generate AI-powered recommendations
    const recommendations = await this.generateRecommendations(business, similarPatterns);

    return {
      successProbability: Math.min(0.95, weightedConversionRate * 2), // Cap at 95%
      projectedRevenue: Math.round(projectedRevenue),
      confidence: totalSamples > 50 ? 'high' : totalSamples > 20 ? 'medium' : 'low',
      recommendations: recommendations,
      basedOnSamples: totalSamples,
      similarBusinesses: similarPatterns.length
    };
  }

  /**
   * Generate AI-powered recommendations based on Revenue Graph data
   */
  async generateRecommendations(business, patterns) {
    const topPatterns = patterns
      .sort((a, b) => b.conversion_rate - a.conversion_rate)
      .slice(0, 3);

    const prompt = `Based on revenue pattern data, generate recommendations for this business:
    
    Business: ${JSON.stringify(business.business_data)}
    Current Revenue: $${business.total_revenue || 0}
    
    Top Performing Patterns:
    ${topPatterns.map(p => `
    - ${p.offer_type} via ${p.channel}: ${(p.conversion_rate * 100).toFixed(1)}% conversion, $${p.avg_order_value.toFixed(0)} AOV (${p.sample_size} samples)
    `).join('')}
    
    Provide 3-5 specific, actionable recommendations to improve this business based on what actually works for similar businesses.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    return response.choices[0].message.content.split('\n').filter(line => line.trim().length > 0);
  }

  /**
   * Get top-performing strategies across all businesses
   */
  async getTopPerformingStrategies(limit = 10) {
    const { data: strategies } = await supabase
      .from('revenue_pattern_aggregates')
      .select('*')
      .gte('sample_size', 10) // Only strategies with meaningful data
      .gte('confidence_score', 0.5) // High confidence only
      .order('conversion_rate', { ascending: false })
      .limit(limit);

    return strategies || [];
  }

  /**
   * Analyze conversion timing patterns
   */
  async analyzeTimingPatterns(businessType, industry) {
    const { data: patterns } = await supabase
      .from('revenue_patterns')
      .select('timing_pattern, conversion_rate, created_at')
      .eq('business_type', businessType)
      .eq('industry', industry)
      .gte('conversion_rate', 0.01); // Only successful conversions

    if (!patterns || patterns.length === 0) return null;

    // Analyze timing patterns
    const timingAnalysis = {};
    patterns.forEach(pattern => {
      const timing = pattern.timing_pattern;
      if (timing?.dayOfWeek && timing?.hourOfDay) {
        const key = `${timing.dayOfWeek}_${timing.hourOfDay}`;
        if (!timingAnalysis[key]) {
          timingAnalysis[key] = { count: 0, totalConversion: 0 };
        }
        timingAnalysis[key].count++;
        timingAnalysis[key].totalConversion += pattern.conversion_rate;
      }
    });

    // Find best timing
    const bestTiming = Object.entries(timingAnalysis)
      .map(([key, data]) => ({
        timing: key,
        avgConversion: data.totalConversion / data.count,
        sampleSize: data.count
      }))
      .sort((a, b) => b.avgConversion - a.avgConversion)[0];

    return bestTiming;
  }

  /**
   * Update all revenue patterns (called periodically by Central AI Brain)
   */
  async updatePatterns() {
    console.log('📊 Updating revenue patterns...');
    
    // Recalculate all aggregates
    const { data: allPatterns } = await supabase
      .from('revenue_patterns')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    // Group and update aggregates
    const patternGroups = {};
    allPatterns?.forEach(pattern => {
      const key = `${pattern.business_type}_${pattern.industry}_${pattern.offer_type}_${pattern.channel}`;
      if (!patternGroups[key]) {
        patternGroups[key] = [];
      }
      patternGroups[key].push(pattern);
    });

    // Update each group
    for (const [key, patterns] of Object.entries(patternGroups)) {
      await this.recalculateAggregate(key, patterns);
    }

    console.log('📊 Revenue patterns updated');
  }

  /**
   * Recalculate aggregate for a pattern group
   */
  async recalculateAggregate(patternKey, patterns) {
    const totalSamples = patterns.length;
    const totalConversions = patterns.reduce((sum, p) => sum + p.conversion_rate, 0);
    const totalValue = patterns.reduce((sum, p) => sum + (p.avg_order_value || 0), 0);
    
    const aggregate = {
      conversion_rate: totalConversions / totalSamples,
      avg_order_value: totalValue / totalSamples,
      sample_size: totalSamples,
      confidence_score: Math.min(0.95, totalSamples / 100),
      last_updated: new Date().toISOString()
    };

    await supabase
      .from('revenue_pattern_aggregates')
      .upsert({
        pattern_key: patternKey,
        ...patterns[0], // Use first pattern for metadata
        ...aggregate
      });
  }

  /**
   * Load revenue patterns into memory for fast access
   */
  async loadRevenuePatterns() {
    const { data: patterns } = await supabase
      .from('revenue_pattern_aggregates')
      .select('*')
      .gte('confidence_score', 0.3);

    patterns?.forEach(pattern => {
      this.patterns.set(pattern.pattern_key, pattern);
    });

    console.log(`📊 Loaded ${patterns?.length || 0} revenue patterns into memory`);
  }

  /**
   * Get revenue intelligence summary
   */
  async getRevenueIntelligence() {
    const { data: totalPatterns } = await supabase
      .from('revenue_patterns')
      .select('id', { count: 'exact', head: true });

    const { data: aggregates } = await supabase
      .from('revenue_pattern_aggregates')
      .select('*')
      .gte('confidence_score', 0.5)
      .order('conversion_rate', { ascending: false })
      .limit(5);

    return {
      totalDataPoints: totalPatterns?.length || 0,
      topStrategies: aggregates || [],
      patternsInMemory: this.patterns.size,
      lastUpdated: new Date().toISOString()
    };
  }
}
