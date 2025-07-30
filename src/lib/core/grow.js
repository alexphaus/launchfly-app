// grow.js - Make it successful (your real moat)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Growth engine - this is your competitive moat
 * AI can't replicate relationships, reputation, and proven systems
 */
export async function growBusiness(business, sessionId) {
  console.log('Starting growth engine for:', business.name);
  
  let currentBusiness = { ...business, revenue: 0, customers: 0 };
  const goal = business.revenueGoal || 10000; // Default $10k/month goal
  
  try {
    // Growth loop - continue until goal is reached
    while (currentBusiness.revenue < goal) {
      // Generate growth experiments
      const experiments = await generateGrowthExperiments(currentBusiness);
      
      // Run experiments in parallel
      const results = await runExperiments(experiments, sessionId);
      
      // Analyze what worked
      const learnings = await analyzeResults(results, currentBusiness);
      
      // Optimize the business
      currentBusiness = await optimizeBusiness(currentBusiness, learnings);
      
      // Update progress in database
      await updateProgress(sessionId, currentBusiness);
      
      // Safety break for demo/testing
      if (currentBusiness.iterations > 5) break;
    }
    
    return {
      ...currentBusiness,
      status: 'successful',
      completedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Growth error:', error);
    throw new Error('Failed to grow business');
  }
}

async function generateGrowthExperiments(business) {
  // Generate experiments based on current business state
  const experiments = [];
  
  // Traffic experiments
  if (business.traffic < 1000) {
    experiments.push(...generateTrafficExperiments(business));
  }
  
  // Conversion experiments
  if (business.conversionRate < 0.05) {
    experiments.push(...generateConversionExperiments(business));
  }
  
  // Retention experiments
  if (business.customers > 0) {
    experiments.push(...generateRetentionExperiments(business));
  }
  
  // Pricing experiments
  experiments.push(...generatePricingExperiments(business));
  
  return experiments;
}

async function runExperiments(experiments, sessionId) {
  const results = [];
  
  for (const experiment of experiments) {
    console.log(`Running experiment: ${experiment.name}`);
    
    try {
      const result = await executeExperiment(experiment, sessionId);
      results.push({
        experiment: experiment.name,
        success: result.success,
        impact: result.impact,
        cost: result.cost,
        learnings: result.learnings
      });
      
      // Simulate time between experiments
      await wait(1000);
    } catch (error) {
      results.push({
        experiment: experiment.name,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

async function analyzeResults(results, business) {
  const successfulExperiments = results.filter(r => r.success);
  const failedExperiments = results.filter(r => !r.success);
  
  return {
    wins: successfulExperiments.map(e => e.learnings).flat(),
    losses: failedExperiments.map(e => e.experiment),
    totalImpact: successfulExperiments.reduce((sum, e) => sum + (e.impact || 0), 0),
    recommendations: generateRecommendations(successfulExperiments, business)
  };
}

async function optimizeBusiness(business, learnings) {
  const optimized = { ...business };
  
  // Apply successful learnings
  learnings.wins.forEach(win => {
    if (win.type === 'traffic') {
      optimized.traffic = (optimized.traffic || 0) + win.value;
    } else if (win.type === 'conversion') {
      optimized.conversionRate = Math.min((optimized.conversionRate || 0.02) + win.value, 0.1);
    } else if (win.type === 'pricing') {
      optimized.averageOrderValue = (optimized.averageOrderValue || 297) + win.value;
    }
  });
  
  // Calculate new revenue
  optimized.revenue = calculateRevenue(optimized);
  optimized.customers = calculateCustomers(optimized);
  optimized.iterations = (optimized.iterations || 0) + 1;
  
  return optimized;
}

// Traffic generation experiments (your secret sauce)
function generateTrafficExperiments(business) {
  return [
    {
      name: 'LinkedIn Outreach Campaign',
      type: 'traffic',
      description: 'Direct outreach to target prospects',
      expectedImpact: 20,
      cost: 'time',
      duration: '1 week'
    },
    {
      name: 'Content Marketing Push',
      type: 'traffic',
      description: 'Create valuable content for target audience',
      expectedImpact: 15,
      cost: 'time',
      duration: '2 weeks'
    },
    {
      name: 'Community Engagement',
      type: 'traffic',
      description: 'Active participation in industry communities',
      expectedImpact: 10,
      cost: 'time',
      duration: '1 week'
    },
    {
      name: 'Partnership Outreach',
      type: 'traffic',
      description: 'Build referral partnerships',
      expectedImpact: 25,
      cost: 'revenue share',
      duration: '2 weeks'
    }
  ];
}

function generateConversionExperiments(business) {
  return [
    {
      name: 'Optimize Headlines',
      type: 'conversion',
      description: 'A/B test different value propositions',
      expectedImpact: 0.01,
      cost: 'time',
      duration: '1 week'
    },
    {
      name: 'Add Social Proof',
      type: 'conversion',
      description: 'Include testimonials and case studies',
      expectedImpact: 0.015,
      cost: 'time',
      duration: '3 days'
    },
    {
      name: 'Simplify Pricing',
      type: 'conversion',
      description: 'Make pricing clearer and more compelling',
      expectedImpact: 0.02,
      cost: 'time',
      duration: '2 days'
    }
  ];
}

function generateRetentionExperiments(business) {
  return [
    {
      name: 'Customer Success Program',
      type: 'retention',
      description: 'Proactive customer success outreach',
      expectedImpact: 0.2,
      cost: 'time',
      duration: 'ongoing'
    },
    {
      name: 'Upsell Campaign',
      type: 'revenue',
      description: 'Offer additional services to existing customers',
      expectedImpact: 500,
      cost: 'time',
      duration: '1 week'
    }
  ];
}

function generatePricingExperiments(business) {
  return [
    {
      name: 'Premium Package Test',
      type: 'pricing',
      description: 'Test higher-value package',
      expectedImpact: 200,
      cost: 'time',
      duration: '2 weeks'
    },
    {
      name: 'Value-Based Pricing',
      type: 'pricing',
      description: 'Price based on customer outcomes',
      expectedImpact: 300,
      cost: 'time',
      duration: '1 week'
    }
  ];
}

async function executeExperiment(experiment, sessionId) {
  // Simulate experiment execution with realistic results
  const successRate = 0.7; // 70% of experiments succeed
  const success = Math.random() < successRate;
  
  if (success) {
    const impact = experiment.expectedImpact * (0.5 + Math.random() * 1.0); // 50-150% of expected
    
    return {
      success: true,
      impact,
      cost: experiment.cost,
      learnings: [
        {
          type: experiment.type,
          value: impact,
          description: `${experiment.name} increased ${experiment.type} by ${impact}`
        }
      ]
    };
  } else {
    return {
      success: false,
      impact: 0,
      learnings: [`${experiment.name} did not produce expected results`]
    };
  }
}

function generateRecommendations(successfulExperiments, business) {
  const recommendations = [];
  
  if (successfulExperiments.some(e => e.experiment.includes('LinkedIn'))) {
    recommendations.push('Double down on LinkedIn outreach - it\'s working');
  }
  
  if (successfulExperiments.some(e => e.experiment.includes('Content'))) {
    recommendations.push('Scale content marketing efforts');
  }
  
  if (successfulExperiments.some(e => e.experiment.includes('Pricing'))) {
    recommendations.push('Consider premium pricing strategy');
  }
  
  return recommendations;
}

function calculateRevenue(business) {
  const traffic = business.traffic || 0;
  const conversionRate = business.conversionRate || 0.02;
  const averageOrderValue = business.averageOrderValue || 297;
  
  return Math.round(traffic * conversionRate * averageOrderValue);
}

function calculateCustomers(business) {
  const traffic = business.traffic || 0;
  const conversionRate = business.conversionRate || 0.02;
  
  return Math.round(traffic * conversionRate);
}

async function updateProgress(sessionId, business) {
  if (!sessionId) return;
  
  try {
    await supabase
      .from('sessions')
      .update({
        stage: 'growing',
        progress: Math.min(95, 50 + (business.revenue / business.revenueGoal) * 45)
      })
      .eq('id', sessionId);
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export individual functions for testing
export {
  generateGrowthExperiments,
  runExperiments,
  analyzeResults,
  optimizeBusiness
};
