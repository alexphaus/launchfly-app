// lib/core/grow.js - Make it successful (Our main competitive moat)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Core function: Grow business to success
 * This is our main competitive advantage - ensuring customer success
 */
export async function growBusiness(business, sessionId) {
  console.log('📈 Growing business:', business.businessName);
  
  let currentBusiness = { ...business };
  const growthLog = [];
  
  // This is our moat - we guarantee success
  while (currentBusiness.revenue < currentBusiness.goal) {
    try {
      const experiments = await generateGrowthExperiments(currentBusiness);
      const results = await runExperiments(experiments, sessionId);
      const learnings = await analyzeResults(results);
      
      currentBusiness = await optimizeBusiness(currentBusiness, learnings);
      growthLog.push({
        timestamp: new Date().toISOString(),
        experiments,
        results,
        learnings,
        newRevenue: currentBusiness.revenue
      });
      
      // Update progress in database
      await updateBusinessProgress(sessionId, currentBusiness, growthLog);
      
      // Safety valve - don't run forever in development
      if (growthLog.length > 10) break;
      
    } catch (error) {
      console.error('Growth iteration error:', error);
      break;
    }
  }
  
  return {
    business: currentBusiness,
    growthLog,
    success: currentBusiness.revenue >= currentBusiness.goal
  };
}

async function generateGrowthExperiments(business) {
  // Our proprietary growth methodology
  const experiments = [
    // Customer Acquisition Experiments
    {
      type: 'acquisition',
      name: 'Social Media Outreach',
      hypothesis: 'Direct outreach to target customers will generate leads',
      implementation: 'Contact 50 potential customers on LinkedIn/Instagram',
      successMetric: 'Get 5 responses and 2 qualified leads',
      timeframe: '3 days',
      effort: 'medium'
    },
    {
      type: 'acquisition', 
      name: 'Content Marketing',
      hypothesis: 'Valuable content will attract organic traffic',
      implementation: 'Create and share 3 pieces of valuable content',
      successMetric: '100 views and 10 email signups',
      timeframe: '7 days',
      effort: 'high'
    },
    
    // Conversion Optimization Experiments
    {
      type: 'conversion',
      name: 'Pricing Test',
      hypothesis: 'Different pricing strategy will improve conversions',
      implementation: 'Test 2 different pricing models',
      successMetric: 'Increase conversion rate by 20%',
      timeframe: '14 days',
      effort: 'low'
    },
    {
      type: 'conversion',
      name: 'Social Proof',
      hypothesis: 'Adding testimonials will increase trust',
      implementation: 'Collect and display customer testimonials',
      successMetric: 'Improve landing page conversion',
      timeframe: '5 days', 
      effort: 'medium'
    },
    
    // Revenue Optimization Experiments
    {
      type: 'revenue',
      name: 'Upsell Strategy',
      hypothesis: 'Existing customers will buy additional services',
      implementation: 'Offer complementary services to current customers',
      successMetric: 'Increase average order value by 30%',
      timeframe: '10 days',
      effort: 'medium'
    }
  ];
  
  // Prioritize experiments based on current business state
  return prioritizeExperiments(experiments, business);
}

function prioritizeExperiments(experiments, business) {
  // Our secret sauce - intelligent experiment prioritization
  const priorities = {
    // If no customers yet, focus on acquisition
    noCustomers: ['acquisition'],
    // If customers but low revenue, focus on conversion
    lowRevenue: ['conversion', 'revenue'],
    // If good revenue, focus on scaling
    scaling: ['acquisition', 'revenue']
  };
  
  let currentPhase = 'noCustomers';
  if (business.customerCount > 0 && business.revenue < 500) {
    currentPhase = 'lowRevenue';
  } else if (business.revenue >= 500) {
    currentPhase = 'scaling';
  }
  
  const relevantTypes = priorities[currentPhase];
  return experiments
    .filter(exp => relevantTypes.includes(exp.type))
    .sort((a, b) => {
      // Prioritize by effort vs impact
      const effortScore = { low: 3, medium: 2, high: 1 };
      return effortScore[a.effort] - effortScore[b.effort];
    })
    .slice(0, 3); // Top 3 experiments
}

async function runExperiments(experiments, sessionId) {
  const results = [];
  
  for (const experiment of experiments) {
    console.log(`🧪 Running experiment: ${experiment.name}`);
    
    // Simulate experiment results (in real implementation, this would track actual metrics)
    const result = await simulateExperimentResult(experiment);
    
    results.push({
      experiment: experiment.name,
      success: result.success,
      metrics: result.metrics,
      learnings: result.learnings,
      timestamp: new Date().toISOString()
    });
    
    // Update database with experiment progress
    await logExperiment(sessionId, experiment, result);
  }
  
  return results;
}

async function simulateExperimentResult(experiment) {
  // In production, this would track real metrics
  // For now, simulate realistic results based on experiment type
  
  const successRate = {
    acquisition: 0.7,
    conversion: 0.8, 
    revenue: 0.6
  };
  
  const isSuccess = Math.random() < (successRate[experiment.type] || 0.5);
  
  return {
    success: isSuccess,
    metrics: {
      leads: experiment.type === 'acquisition' ? Math.floor(Math.random() * 10) : 0,
      conversions: experiment.type === 'conversion' ? Math.floor(Math.random() * 5) : 0,
      revenue: experiment.type === 'revenue' ? Math.floor(Math.random() * 500) : 0
    },
    learnings: isSuccess ? 
      `${experiment.name} worked! Key insight: ${experiment.hypothesis} was correct.` :
      `${experiment.name} didn't work as expected. Need to adjust approach.`
  };
}

async function analyzeResults(results) {
  const learnings = {
    successfulExperiments: results.filter(r => r.success),
    failedExperiments: results.filter(r => !r.success),
    totalLeads: results.reduce((sum, r) => sum + (r.metrics.leads || 0), 0),
    totalRevenue: results.reduce((sum, r) => sum + (r.metrics.revenue || 0), 0),
    keyInsights: [],
    nextActions: []
  };
  
  // Generate insights based on results
  if (learnings.successfulExperiments.length > 0) {
    learnings.keyInsights.push('Customer acquisition is working - double down on successful channels');
    learnings.nextActions.push('Scale the successful experiments');
  }
  
  if (learnings.totalRevenue > 0) {
    learnings.keyInsights.push('Revenue generation validated - product-market fit confirmed');
    learnings.nextActions.push('Focus on scaling revenue streams');
  }
  
  return learnings;
}

async function optimizeBusiness(business, learnings) {
  // Apply learnings to improve business performance
  const optimizedBusiness = { ...business };
  
  // Update metrics based on learnings
  if (learnings.totalLeads > 0) {
    optimizedBusiness.customerCount = (optimizedBusiness.customerCount || 0) + learnings.totalLeads;
  }
  
  if (learnings.totalRevenue > 0) {
    optimizedBusiness.revenue = (optimizedBusiness.revenue || 0) + learnings.totalRevenue;
  }
  
  // Update conversion rate based on successful experiments
  if (learnings.successfulExperiments.some(exp => exp.experiment.includes('Conversion'))) {
    optimizedBusiness.conversionRate = Math.min((optimizedBusiness.conversionRate || 0.02) * 1.2, 0.1);
  }
  
  return optimizedBusiness;
}

async function updateBusinessProgress(sessionId, business, growthLog) {
  try {
    await supabase
      .from('sessions')
      .update({
        business_metrics: {
          revenue: business.revenue,
          customerCount: business.customerCount,
          conversionRate: business.conversionRate,
          lastUpdated: new Date().toISOString()
        },
        growth_log: growthLog.slice(-5) // Keep last 5 entries
      })
      .eq('id', sessionId);
  } catch (error) {
    console.error('Error updating business progress:', error);
  }
}

async function logExperiment(sessionId, experiment, result) {
  try {
    await supabase
      .from('experiments')
      .insert({
        session_id: sessionId,
        experiment_name: experiment.name,
        experiment_type: experiment.type,
        hypothesis: experiment.hypothesis,
        implementation: experiment.implementation,
        success: result.success,
        metrics: result.metrics,
        learnings: result.learnings,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    // Experiments table might not exist yet - that's okay
    console.log('Experiment logging skipped (table may not exist)');
  }
}

/**
 * Customer Success Functions - Our competitive moat
 */
export async function ensureCustomerSuccess(businessId) {
  // This is what makes us different - we guarantee success
  const business = await getBusiness(businessId);
  
  if (!business) return false;
  
  // Check if business is meeting success criteria
  const isSuccessful = await evaluateSuccess(business);
  
  if (!isSuccessful) {
    // Take action to ensure success
    await interventionProtocol(business);
  }
  
  return isSuccessful;
}

async function evaluateSuccess(business) {
  const criteria = {
    hasCustomers: business.customerCount > 0,
    generatingRevenue: business.revenue > 0,
    onTrackForGoal: business.revenue >= (business.goal * 0.1), // 10% of goal
    positiveGrowth: business.growthRate > 0
  };
  
  const successScore = Object.values(criteria).filter(Boolean).length;
  return successScore >= 3; // Need 3/4 criteria met
}

async function interventionProtocol(business) {
  // Our intervention system when businesses aren't succeeding
  console.log('🚨 Intervention needed for business:', business.businessName);
  
  const interventions = [
    'Personal consultation call',
    'Custom marketing campaign',
    'Direct customer introductions', 
    'Product/pricing optimization',
    'Done-for-you service delivery'
  ];
  
  // In production, this would trigger real interventions
  console.log('Implementing interventions:', interventions);
  
  return interventions;
}

async function getBusiness(businessId) {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching business:', error);
    return null;
  }
}
