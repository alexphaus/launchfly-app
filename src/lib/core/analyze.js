// lib/core/analyze.js - Find what will work (AI-resistant value layer)
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Core function: Analyze opportunity and find profitable business models
 * This is where our market intelligence and data moat lives
 */
export async function analyzeOpportunity(user) {
  console.log('🔍 Analyzing opportunity for:', user.name);
  
  // Use any AI, but focus on accuracy and our proprietary insights
  const markets = await findProfitableMarkets(user.skills, user.businessType);
  const competition = await analyzeCompetition(markets);
  const opportunity = await identifyGap(markets, competition, user.goal);
  
  return {
    business: opportunity,
    quickWins: await identifyQuickWins(opportunity),
    marketData: markets,
    competitiveAdvantage: competition.gaps
  };
}

async function findProfitableMarkets(skills, businessType) {
  const prompt = `Analyze profitable markets for: Skills "${skills}", Type "${businessType}".
  
  Return 3 validated market opportunities with:
  - Market size & demand proof
  - Customer willingness to pay
  - Competition gaps
  - Quick entry strategies
  
  Focus on proven profitable niches, not saturated markets.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system", 
        content: "You are a market research expert who identifies profitable opportunities with data-driven insights."
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.3, // Lower temperature for more consistent analysis
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0].message.content);
}

async function analyzeCompetition(markets) {
  // This is where we build our competitive intelligence moat
  const competitiveAnalysis = {
    directCompetitors: [],
    indirectCompetitors: [],
    gaps: [],
    opportunities: []
  };

  for (const market of markets.opportunities || []) {
    const prompt = `Analyze competition in: ${market.niche}
    
    Find:
    1. Top 5 direct competitors and their weaknesses
    2. Indirect competitors people use instead  
    3. Unmet customer needs
    4. Differentiation opportunities
    
    Return specific, actionable competitive gaps.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a competitive intelligence analyst." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(completion.choices[0].message.content);
    competitiveAnalysis.gaps.push(...(analysis.gaps || []));
    competitiveAnalysis.opportunities.push(...(analysis.opportunities || []));
  }

  return competitiveAnalysis;
}

async function identifyGap(markets, competition, userGoal) {
  const prompt = `Based on this analysis:
  Markets: ${JSON.stringify(markets)}
  Competition: ${JSON.stringify(competition)}
  User Goal: ${userGoal}
  
  Identify THE BEST specific business opportunity that:
  1. Has proven demand & paying customers
  2. Low competition or clear differentiation
  3. Matches user goal & can start immediately
  4. Has clear path to first $1000
  
  Return ONE specific business concept with validation data.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { 
        role: "system", 
        content: "You are a business strategist who identifies specific, profitable opportunities."
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0].message.content);
}

async function identifyQuickWins(opportunity) {
  const prompt = `For this business: ${JSON.stringify(opportunity)}
  
  Identify 3 quick wins to get first customers in 7 days:
  1. Immediate actions to take today
  2. Where to find first 10 customers  
  3. Minimum viable product to start selling
  
  Focus on speed and validation, not perfection.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a lean startup expert focused on rapid customer acquisition." },
      { role: "user", content: prompt }
    ],
    temperature: 0.4,
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0].message.content);
}
