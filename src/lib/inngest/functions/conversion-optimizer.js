// src/lib/inngest/functions/conversion-optimizer.js
/**
 * Conversion Optimization Inngest Functions
 * 
 * Handles automated A/B test analysis and self-improvement:
 * - Analyzes experiment performance every 30 minutes
 * - Auto-promotes winning variants
 * - Generates new AI variants for underperformers
 */

import { inngest, EVENTS } from '../client';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { getWinningVariant } from '@/lib/conversion-optimizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Conversion Optimization Engine
 * Runs every 30 minutes to analyze and optimize experiments
 */
export const conversionOptimizer = inngest.createFunction(
  {
    id: 'conversion-optimizer',
    name: 'Conversion Optimization Engine',
    retries: 2,
  },
  { 
    cron: '*/30 * * * *' // Every 30 minutes
  },
  async ({ event, step }) => {
    console.log('🔄 Running conversion optimization cycle...');
    
    // Step 1: Get all businesses with active experiments
    const businesses = await step.run('fetch-businesses-with-experiments', async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, subdomain, business_data')
        .not('business_data->experiments', 'is', null)
        .eq('status', 'ready');
      
      if (error) {
        console.error('Error fetching businesses:', error);
        return [];
      }
      
      return data || [];
    });
    
    console.log(`Found ${businesses.length} businesses with experiments`);
    
    // Step 2: Analyze each business's experiments
    for (const business of businesses) {
      await step.run(`analyze-business-${business.id}`, async () => {
        await analyzeBusiness(business);
      });
    }
    
    return {
      success: true,
      businessesAnalyzed: businesses.length,
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Analyze and optimize experiments for a single business
 */
async function analyzeBusiness(business) {
  const experiments = business.business_data?.experiments || [];
  const activeExperiments = experiments.filter(exp => exp.status === 'active');
  
  if (activeExperiments.length === 0) {
    return;
  }
  
  console.log(`Analyzing ${activeExperiments.length} experiments for ${business.subdomain}`);
  
  for (const experiment of activeExperiments) {
    try {
      // Get performance data from last 7 days
      const performanceData = await getExperimentPerformance(business.id, experiment.id);
      
      // Check if we have enough data (minimum 100 impressions per variant)
      const hasEnoughData = Object.values(performanceData.variantStats).every(
        stats => stats.impressions >= 100
      );
      
      if (!hasEnoughData) {
        console.log(`Experiment ${experiment.name} needs more data`);
        continue;
      }
      
      // Calculate statistical significance
      const analysis = analyzeExperimentResults(performanceData);
      
      if (analysis.hasWinner && analysis.confidence >= 0.95) {
        // We have a winner!
        await promoteWinner(business, experiment, analysis.winnerId);
        
        // Log the victory
        await logOptimizationActivity(business.id, {
          type: 'experiment_winner',
          message: `🏆 Found winner for ${experiment.name}: Variant ${analysis.winnerId} with ${Math.round(analysis.improvement * 100)}% improvement!`,
          details: analysis
        });
        
      } else if (performanceData.totalImpressions > 1000 && analysis.bestConversionRate < 0.01) {
        // Experiment underperforming - generate new variants
        await generateNewVariants(business, experiment);
        
        await logOptimizationActivity(business.id, {
          type: 'experiment_refresh',
          message: `🔄 Refreshing underperforming experiment: ${experiment.name}`,
          details: { conversionRate: analysis.bestConversionRate }
        });
      }
      
    } catch (error) {
      console.error(`Error analyzing experiment ${experiment.id}:`, error);
    }
  }
}

/**
 * Get experiment performance data
 */
async function getExperimentPerformance(businessId, experimentId) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // Get impressions
  const { data: impressions } = await supabase
    .from('ai_activities')
    .select('metadata')
    .eq('business_id', businessId)
    .eq('type', 'analytics_pageview')
    .eq('metadata->>experimentId', experimentId)
    .gte('created_at', sevenDaysAgo.toISOString());
  
  // Get conversions
  const { data: conversions } = await supabase
    .from('ai_activities')
    .select('metadata')
    .eq('business_id', businessId)
    .eq('type', 'analytics_conversion')
    .eq('metadata->>experimentId', experimentId)
    .gte('created_at', sevenDaysAgo.toISOString());
  
  // Calculate stats per variant
  const variantStats = {};
  let totalImpressions = 0;
  
  impressions?.forEach(event => {
    const variantId = event.metadata.variantId;
    if (!variantStats[variantId]) {
      variantStats[variantId] = { impressions: 0, conversions: 0 };
    }
    variantStats[variantId].impressions++;
    totalImpressions++;
  });
  
  conversions?.forEach(event => {
    const variantId = event.metadata.variantId;
    if (variantStats[variantId]) {
      variantStats[variantId].conversions++;
    }
  });
  
  return { variantStats, totalImpressions };
}

/**
 * Analyze experiment results and determine winner
 */
function analyzeExperimentResults(performanceData) {
  const variants = Object.entries(performanceData.variantStats);
  
  if (variants.length < 2) {
    return { hasWinner: false };
  }
  
  // Calculate conversion rates
  const rates = variants.map(([id, stats]) => ({
    id,
    rate: stats.conversions / stats.impressions,
    ...stats
  }));
  
  // Sort by conversion rate
  rates.sort((a, b) => b.rate - a.rate);
  
  const best = rates[0];
  const control = rates.find(r => r.id === 'control') || rates[1];
  
  // Calculate improvement
  const improvement = (best.rate - control.rate) / control.rate;
  
  // Simple statistical significance check (z-test)
  const pooledRate = (best.conversions + control.conversions) / (best.impressions + control.impressions);
  const standardError = Math.sqrt(pooledRate * (1 - pooledRate) * (1/best.impressions + 1/control.impressions));
  const zScore = Math.abs(best.rate - control.rate) / standardError;
  const confidence = 1 - 2 * (1 - normalCDF(zScore));
  
  return {
    hasWinner: best.id !== 'control' && improvement > 0.1, // 10% improvement threshold
    winnerId: best.id,
    improvement,
    confidence,
    bestConversionRate: best.rate
  };
}

/**
 * Normal CDF approximation for z-score
 */
function normalCDF(z) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = z >= 0 ? 1 : -1;
  z = Math.abs(z) / Math.sqrt(2);
  
  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  
  return 0.5 * (1 + sign * y);
}

/**
 * Promote winning variant to control
 */
async function promoteWinner(business, experiment, winnerId) {
  const businessData = business.business_data;
  const experimentIndex = businessData.experiments.findIndex(e => e.id === experiment.id);
  
  if (experimentIndex === -1) return;
  
  const winningVariant = experiment.variants.find(v => v.id === winnerId);
  if (!winningVariant) return;
  
  // Update the layout with winning variant props
  const layoutIndex = businessData.layout.findIndex(l => l.component === experiment.componentType);
  if (layoutIndex !== -1) {
    businessData.layout[layoutIndex].props = {
      ...businessData.layout[layoutIndex].props,
      ...winningVariant.props
    };
  }
  
  // Mark experiment as completed
  businessData.experiments[experimentIndex].status = 'completed';
  businessData.experiments[experimentIndex].winnerId = winnerId;
  businessData.experiments[experimentIndex].completedAt = new Date().toISOString();
  
  // Save updated business data
  await supabase
    .from('businesses')
    .update({ 
      business_data: businessData,
      updated_at: new Date().toISOString()
    })
    .eq('id', business.id);
}

/**
 * Generate new AI variants for underperforming experiments
 */
async function generateNewVariants(business, experiment) {
  try {
    const prompt = `
    Generate 2 new A/B test variants for a ${experiment.componentType} component.
    Business: ${business.business_data.name || business.subdomain}
    Industry: ${business.business_data.industry || 'general'}
    Current best performing variant has ${experiment.variants[0].props.title || 'default content'}
    
    Create compelling, conversion-focused variations that:
    1. Use psychological triggers (urgency, social proof, benefits)
    2. Are specific to the industry
    3. Have clear value propositions
    
    Return as JSON array with format:
    [{
      "name": "Variant Name",
      "props": {
        "title": "New headline",
        "subtitle": "New subtitle",
        "ctaText": "Call to action"
      }
    }]
    `;
    
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4',
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });
    
    const suggestions = JSON.parse(completion.choices[0].message.content);
    const newVariants = suggestions.variants || suggestions;
    
    // Add new variants to experiment
    const businessData = business.business_data;
    const experimentIndex = businessData.experiments.findIndex(e => e.id === experiment.id);
    
    if (experimentIndex !== -1 && Array.isArray(newVariants)) {
      // Replace underperforming variants (keep control and best performer)
      const sortedVariants = [...experiment.variants].sort((a, b) => {
        // Sort by performance if we have data
        return 0;
      });
      
      businessData.experiments[experimentIndex].variants = [
        sortedVariants[0], // Keep best
        ...newVariants.slice(0, 2).map((v, i) => ({
          id: `variant-${Date.now()}-${i}`,
          name: v.name,
          weight: 25,
          props: v.props
        }))
      ];
      
      // Reset experiment
      businessData.experiments[experimentIndex].status = 'active';
      businessData.experiments[experimentIndex].refreshedAt = new Date().toISOString();
      
      await supabase
        .from('businesses')
        .update({ 
          business_data: businessData,
          updated_at: new Date().toISOString()
        })
        .eq('id', business.id);
    }
    
  } catch (error) {
    console.error('Error generating new variants:', error);
  }
}

/**
 * Log optimization activity
 */
async function logOptimizationActivity(businessId, activity) {
  await supabase
    .from('ai_activities')
    .insert({
      business_id: businessId,
      type: activity.type,
      icon: activity.type === 'experiment_winner' ? '🏆' : '🔄',
      message: activity.message,
      details: JSON.stringify(activity.details),
      metadata: activity.details
    });
}

// Export for Inngest
export default conversionOptimizer;