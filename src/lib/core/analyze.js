// analyze.js - Find what will work (AI-resistant value)
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Core business intelligence - finding profitable opportunities
 * This is AI-resistant because it requires market knowledge and real data
 */
export async function analyzeOpportunity(userData) {
  console.log('Analyzing opportunity for:', userData);
  
  try {
    // Use AI for analysis but focus on accuracy over speed
    const markets = await findProfitableMarkets(userData.skills || []);
    const competition = await analyzeCompetition(markets);
    const opportunity = await identifyGap(markets, competition, userData);
    
    return {
      business: opportunity,
      confidence: calculateSuccessProbability(opportunity),
      quickWins: identifyQuickWins(opportunity),
      marketData: {
        size: markets.estimatedSize,
        competition: competition.level,
        barriers: competition.barriers
      }
    };
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error('Failed to analyze opportunity');
  }
}

async function findProfitableMarkets(skills) {
  const prompt = `
    Analyze profitable market opportunities for someone with these skills: ${skills.join(', ')}
    
    Return markets that are:
    1. Large enough to be profitable ($10k+ monthly potential)
    2. Underserved by current solutions
    3. Accessible to beginners
    4. Have proven willingness to pay
    
    Focus on service-based businesses that can start immediately.
    Return top 3 markets with specific niches.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3
  });

  // Parse and structure the response
  return {
    markets: extractMarkets(response.choices[0].message.content),
    estimatedSize: '$10k-100k monthly potential'
  };
}

async function analyzeCompetition(markets) {
  const prompt = `
    Analyze competition for these markets: ${JSON.stringify(markets)}
    
    For each market, identify:
    1. Number of competitors
    2. Their weaknesses/gaps
    3. Pricing ranges
    4. Barriers to entry
    5. Opportunities for differentiation
    
    Return specific, actionable insights.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3
  });

  return {
    level: 'moderate', // TODO: Extract from response
    barriers: extractBarriers(response.choices[0].message.content),
    opportunities: extractOpportunities(response.choices[0].message.content)
  };
}

async function identifyGap(markets, competition, userData) {
  const prompt = `
    Given these markets: ${JSON.stringify(markets)}
    And this competition analysis: ${JSON.stringify(competition)}
    And user background: ${JSON.stringify(userData)}
    
    Identify the specific business opportunity that:
    1. Matches user's skills/interests
    2. Has clear market demand
    3. Can differentiate from competition
    4. Can start with minimal investment
    5. Has potential for $10k+ monthly revenue
    
    Return a specific business concept with:
    - Exact target customer
    - Specific problem you solve
    - Your unique advantage
    - Revenue model
    - First steps to validate
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5
  });

  return parseBusiness(response.choices[0].message.content, userData);
}

function calculateSuccessProbability(opportunity) {
  // TODO: Implement scoring algorithm based on:
  // - Market size
  // - Competition level
  // - User-market fit
  // - Validation potential
  // - Revenue model clarity
  
  return Math.floor(Math.random() * 30) + 70; // Placeholder: 70-100%
}

function identifyQuickWins(opportunity) {
  // TODO: Generate specific actions to validate and start the business
  return [
    "Create landing page to test demand",
    "Find 5 potential customers for interviews",
    "Research pricing in your market",
    "Set up basic service offering"
  ];
}

// Helper functions for parsing AI responses
function extractMarkets(content) {
  // TODO: Implement proper parsing of market data
  return [
    { name: "Local Service Business", potential: "$15k/month" },
    { name: "Digital Consulting", potential: "$25k/month" },
    { name: "E-commerce Niche", potential: "$20k/month" }
  ];
}

function extractBarriers(content) {
  // TODO: Implement proper parsing
  return ["Limited startup capital", "Building reputation", "Finding first customers"];
}

function extractOpportunities(content) {
  // TODO: Implement proper parsing
  return ["Underserved local market", "Poor competitor UX", "High pricing opportunity"];
}

function parseBusiness(content, userData) {
  // TODO: Implement proper business concept parsing
  return {
    name: `${userData.businessType || 'Consulting'} Business`,
    target: "Small business owners needing help",
    problem: "Lack of professional guidance",
    solution: "Expert consulting and implementation",
    advantage: "Personal attention and proven results",
    revenue: "Monthly retainer + project fees",
    validation: "Interview 10 prospects, create MVP service"
  };
}
