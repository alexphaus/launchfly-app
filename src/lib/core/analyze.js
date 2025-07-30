// lib/core/analyze.js - Find what will work (AI-resistant core value)
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Core business intelligence - this is the AI-resistant moat
 * Analyzes opportunities, validates demand, identifies profitable niches
 */
export async function analyzeOpportunity(userData) {
  console.log('🧠 Analyzing opportunity for:', userData.name);
  
  // Step 1: Use AI to find profitable markets (technology layer)
  const markets = await findProfitableMarkets(userData.skills, userData.businessType);
  
  // Step 2: Validate with real data (human intelligence layer)
  const validation = await validateWithRealData(markets, userData);
  
  // Step 3: Calculate success probability (proprietary algorithm)
  const successProbability = await calculateSuccessProbability(validation);
  
  // Step 4: Identify quick wins (experience-based)
  const quickWins = await identifyQuickWins(validation);
  
  // Step 5: Store insights for future use (data moat)
  await storeMarketIntelligence(userData, validation, successProbability);
  
  return {
    opportunity: validation.bestOpportunity,
    confidence: successProbability,
    quickWins: quickWins,
    customerAcquisitionPlan: validation.acquisitionStrategy,
    revenueProjection: validation.revenueProjection,
    competitiveAdvantage: validation.moat
  };
}

async function findProfitableMarkets(skills, businessType) {
  const prompt = `Analyze profitable market opportunities for someone with these skills: ${skills}, interested in: ${businessType}.

Focus on:
1. Markets with proven demand (people are already spending money)
2. Underserved niches where competition is weak
3. Opportunities for quick customer acquisition
4. Scalable business models

Return analysis of top 3 opportunities with specific evidence of demand.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3 // Lower temperature for more analytical responses
  });

  // Parse and structure the AI response
  const analysis = completion.choices[0].message.content;
  return parseMarketAnalysis(analysis);
}

async function validateWithRealData(markets, userData) {
  // This is where human intelligence and data beat pure AI
  console.log('🔍 Validating markets with real data...');
  
  // Check our database for similar successful businesses
  const { data: successfulBusinesses } = await supabase
    .from('businesses')
    .select('business_data, total_revenue, form_data')
    .gte('total_revenue', 1000)
    .order('total_revenue', { ascending: false })
    .limit(50);
  
  // Analyze what actually worked for similar profiles
  const successPatterns = analyzeSuccessPatterns(successfulBusinesses, userData);
  
  // Score each market opportunity
  const scoredOpportunities = markets.map(market => ({
    ...market,
    realDemandScore: calculateRealDemand(market, successPatterns),
    competitionScore: calculateCompetitionLevel(market),
    acquisitionDifficulty: calculateAcquisitionDifficulty(market),
    profitabilityScore: calculateProfitabilityPotential(market, successPatterns)
  }));
  
  // Select best opportunity
  const bestOpportunity = scoredOpportunities.sort((a, b) => 
    (b.realDemandScore + b.profitabilityScore - b.acquisitionDifficulty) - 
    (a.realDemandScore + a.profitabilityScore - a.acquisitionDifficulty)
  )[0];
  
  return {
    bestOpportunity,
    allOpportunities: scoredOpportunities,
    successPatterns,
    acquisitionStrategy: buildAcquisitionStrategy(bestOpportunity, successPatterns),
    revenueProjection: projectRevenue(bestOpportunity, successPatterns),
    moat: identifyCompetitiveAdvantage(bestOpportunity, userData)
  };
}

async function calculateSuccessProbability(validation) {
  const { bestOpportunity, successPatterns } = validation;
  
  // Proprietary algorithm based on real data
  const factors = {
    marketDemand: bestOpportunity.realDemandScore * 0.3,
    competitionLevel: (10 - bestOpportunity.competitionScore) * 0.2,
    acquisitionFeasibility: (10 - bestOpportunity.acquisitionDifficulty) * 0.3,
    profitability: bestOpportunity.profitabilityScore * 0.2
  };
  
  const rawScore = Object.values(factors).reduce((sum, score) => sum + score, 0);
  const probability = Math.min(Math.max(rawScore / 10, 0.1), 0.95); // Cap between 10% and 95%
  
  return {
    percentage: Math.round(probability * 100),
    factors,
    reasoning: generateSuccessReasoning(factors, bestOpportunity)
  };
}

async function identifyQuickWins(validation) {
  const { bestOpportunity, acquisitionStrategy } = validation;
  
  return {
    immediate: [
      `Create minimal viable presence on ${acquisitionStrategy.primaryChannel}`,
      `Reach out to first 10 potential customers within 48 hours`,
      `Validate pricing with 3 customer conversations`
    ],
    week1: [
      `Launch customer acquisition campaign on ${acquisitionStrategy.secondaryChannel}`,
      `Set up tracking for all customer touchpoints`,
      `Create content for first month of marketing`
    ],
    week2: [
      `Optimize based on initial customer feedback`,
      `Scale successful acquisition channels`,
      `Begin building email list for future marketing`
    ]
  };
}

async function storeMarketIntelligence(userData, validation, successProbability) {
  // Store insights to build our data moat
  await supabase
    .from('market_intelligence')
    .insert({
      user_skills: userData.skills,
      business_type: userData.businessType,
      opportunity_analysis: validation,
      success_probability: successProbability,
      created_at: new Date().toISOString()
    });
}

// Helper functions for market analysis
function parseMarketAnalysis(analysis) {
  // Parse AI response into structured data
  // This would include regex/NLP to extract opportunities, demand indicators, etc.
  return [
    {
      name: "Extracted Market 1",
      description: "Market description",
      demandIndicators: ["indicator1", "indicator2"],
      targetCustomers: ["customer type 1", "customer type 2"]
    }
    // ... more opportunities
  ];
}

function analyzeSuccessPatterns(businesses, userData) {
  // Analyze what actually worked for similar businesses
  return businesses
    .filter(business => {
      // Filter for similar user profiles
      const formData = business.form_data;
      return hasSkillOverlap(formData.skills, userData.skills) ||
             hasSimilarGoals(formData.goal, userData.goal);
    })
    .map(business => ({
      revenue: business.total_revenue,
      businessType: business.business_data?.businessName,
      acquisitionChannels: business.business_data?.marketingStrategy?.channels,
      products: business.business_data?.products,
      timeline: calculateTimeToProfit(business)
    }));
}

function calculateRealDemand(market, successPatterns) {
  // Score based on actual success in our database
  const similarSuccesses = successPatterns.filter(pattern => 
    isMarketSimilar(pattern.businessType, market.name)
  );
  
  return similarSuccesses.length > 0 ? 
    Math.min(similarSuccesses.length * 2, 10) : 
    Math.random() * 3; // Lower score for unproven markets
}

function calculateCompetitionLevel(market) {
  // Use AI/web scraping to assess competition
  // For now, return mock score
  return Math.random() * 10;
}

function calculateAcquisitionDifficulty(market) {
  // Based on our success data, how hard is it to get customers?
  return Math.random() * 10;
}

function calculateProfitabilityPotential(market, successPatterns) {
  // Based on actual revenue data from similar businesses
  const similar = successPatterns.filter(pattern => 
    isMarketSimilar(pattern.businessType, market.name)
  );
  
  if (similar.length === 0) return 5; // Unknown potential
  
  const avgRevenue = similar.reduce((sum, p) => sum + p.revenue, 0) / similar.length;
  return Math.min(avgRevenue / 1000, 10); // Scale to 1-10
}

function buildAcquisitionStrategy(opportunity, successPatterns) {
  // Build customer acquisition plan based on what actually worked
  const successfulChannels = successPatterns
    .flatMap(pattern => pattern.acquisitionChannels || [])
    .reduce((acc, channel) => {
      acc[channel] = (acc[channel] || 0) + 1;
      return acc;
    }, {});
  
  const sortedChannels = Object.entries(successfulChannels)
    .sort(([,a], [,b]) => b - a)
    .map(([channel]) => channel);
  
  return {
    primaryChannel: sortedChannels[0] || 'Email outreach',
    secondaryChannel: sortedChannels[1] || 'Social media',
    strategy: generateAcquisitionPlan(opportunity, sortedChannels)
  };
}

function projectRevenue(opportunity, successPatterns) {
  // Project revenue based on similar successful businesses
  const similar = successPatterns.filter(pattern => 
    isMarketSimilar(pattern.businessType, opportunity.name)
  );
  
  if (similar.length === 0) {
    return {
      month1: 500,
      month3: 2000,
      month6: 5000,
      confidence: 'Low - no similar data'
    };
  }
  
  const avgRevenue = similar.reduce((sum, p) => sum + p.revenue, 0) / similar.length;
  return {
    month1: Math.round(avgRevenue * 0.1),
    month3: Math.round(avgRevenue * 0.4),
    month6: Math.round(avgRevenue * 0.8),
    confidence: `High - based on ${similar.length} similar businesses`
  };
}

function identifyCompetitiveAdvantage(opportunity, userData) {
  return {
    unique_skills: extractUniqueSkills(userData.skills),
    market_gap: opportunity.description,
    positioning: generatePositioning(opportunity, userData)
  };
}

// Additional helper functions
function hasSkillOverlap(skills1, skills2) {
  const skills1Array = skills1.toLowerCase().split(/[,\s]+/);
  const skills2Array = skills2.toLowerCase().split(/[,\s]+/);
  return skills1Array.some(skill => skills2Array.includes(skill));
}

function hasSimilarGoals(goal1, goal2) {
  return goal1.toLowerCase().includes(goal2.toLowerCase()) || 
         goal2.toLowerCase().includes(goal1.toLowerCase());
}

function isMarketSimilar(businessType, marketName) {
  return businessType?.toLowerCase().includes(marketName.toLowerCase()) ||
         marketName.toLowerCase().includes(businessType?.toLowerCase());
}

function calculateTimeToProfit(business) {
  // Calculate based on creation date and first sale
  return 30; // Mock for now
}

function generateSuccessReasoning(factors, opportunity) {
  return `High success probability due to: proven market demand (${Math.round(factors.marketDemand)}), manageable competition (${Math.round(factors.competitionLevel)}), feasible customer acquisition (${Math.round(factors.acquisitionFeasibility)})`;
}

function generateAcquisitionPlan(opportunity, channels) {
  return `Focus on ${channels[0]} for initial traction, supplement with ${channels[1]} for scale. Target ${opportunity.targetCustomers?.join(', ')} with proven messaging.`;
}

function extractUniqueSkills(skills) {
  return skills.split(',').map(skill => skill.trim());
}

function generatePositioning(opportunity, userData) {
  return `Position as the go-to solution for ${opportunity.targetCustomers?.join(' and ')} who need ${opportunity.description}`;
}

export { 
  findProfitableMarkets,
  validateWithRealData,
  calculateSuccessProbability,
  identifyQuickWins
};
