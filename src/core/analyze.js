/**
 * analyze.js - Find what will work
 * 
 * This module focuses on analyzing user data to find profitable business opportunities.
 * As per the future-proof approach, this is the first step in the business creation process.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 2 // Retry failed requests up to 2 times
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Wrapper for OpenAI calls with timeout and error handling
 */
async function callOpenAIWithTimeout(apiCall, timeoutMs = 30000) {
  return Promise.race([
    apiCall(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI API call timed out')), timeoutMs)
    )
  ]);
}

/**
 * Validates market demand for a business opportunity
 * 
 * @param {Object} opportunity - The business opportunity to validate
 * @returns {Object} Validation results with confidence score
 */
export async function validateDemand(opportunity) {
  try {
    const prompt = `
      Validate market demand for this business opportunity:
      ${JSON.stringify(opportunity)}
      
      Research and analyze:
      1. Market size and growth trends
      2. Competitor analysis and pricing
      3. Customer pain points and willingness to pay
      4. Barriers to entry and competition level
      5. Revenue potential and scalability
      
      Return a confidence score (0-100) and detailed validation data as JSON.
    `;

    const response = await callOpenAIWithTimeout(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a market research expert who validates business opportunities with real data and analysis." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    );
    
    const validation = JSON.parse(response.choices[0].message.content);
    
    return {
      confidence: validation.confidence || 50,
      marketSize: validation.marketSize || "Unknown",
      competition: validation.competition || "Medium",
      barriers: validation.barriers || "Medium",
      revenueProjection: validation.revenueProjection || "Unknown",
      risks: validation.risks || [],
      validated: validation.confidence > 70
    };
  } catch (error) {
    console.error("Error validating demand:", error);
    return {
      confidence: 50,
      validated: false,
      error: "Validation failed"
    };
  }
}

/**
 * Analyzes user data to find profitable business opportunities
 * 
 * @param {Object} userData - User information from the form
 * @param {string} sessionId - Current session ID
 * @returns {Object} Business opportunity data
 */
export async function analyzeOpportunity(userData, sessionId) {
  console.log('Starting analyze opportunity - setting stage to analyzing');
  // Update session to show we're analyzing
  await supabase
    .from('sessions')
    .update({
      stage: 'analyzing',
      progress: 25
    })
    .eq('id', sessionId);
  
  // Extract relevant data from user input (businessType removed to reduce friction)
  const { name, skills, goal, preferences } = userData;
  
  console.log('Setting stage to researching');
  // Update session to show we're researching
  await supabase
    .from('sessions')
    .update({
      stage: 'researching',
      progress: 40
    })
    .eq('id', sessionId);
  
  try {
    // Use AI to analyze the best market opportunity based on user data
    const prompt = `
      As a business strategist, analyze these user inputs to identify the most profitable business opportunity that matches their skills and goals:
      
      Name: ${name}
      Skills/Interests: ${skills}
      Goal: ${goal}
      Preferences: ${preferences || 'None specified'}
      
      Based on their skills and goals, determine the best business opportunity by finding a specific, profitable market niche that:
      1. Leverages their existing skills and interests
      2. Has proven customer demand and market viability
      3. Can be quickly validated and started
      4. Has reasonable competition or a unique differentiation angle
      5. Can generate revenue within the first few months
      6. Aligns with their stated goal and preferences
      
      IMPORTANT: Focus on identifying the core business opportunity without specifying whether it should be "e-commerce", "service-based", "agency", etc. The business model will be determined separately by AI based on the opportunity characteristics.
      
      Return a JSON object with:
      {
        "businessName": "Creative and memorable business name that reflects the opportunity",
        "niche": "Specific target market/industry segment", 
        "problem": "Clear, specific problem this business would solve",
        "solution": "How this business uniquely solves the problem",
        "targetMarket": "Primary customer segment who would pay for this solution",
        "uniqueAdvantage": "What makes this opportunity special based on user's skills/background",
        "profitPotential": "Realistic monthly revenue estimate (e.g. '$2,500 monthly')",
        "validationStrategy": "Specific way to quickly test market demand for this idea",
        "confidence": 0.85 // 0-1 score based on market opportunity + user skill fit
      }
    `;

    // Call AI service to analyze the opportunity
    const response = await callOpenAIWithTimeout(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a brilliant business strategist that finds profitable opportunities based on people's skills." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    );
    
    // Parse the AI response
    const opportunity = JSON.parse(response.choices[0].message.content);
    
    // Add quick wins to the opportunity
    opportunity.quickWins = await identifyQuickWins(opportunity);
    
    return opportunity;
  } catch (error) {
    console.error("Error analyzing opportunity:", error);
    
    // Provide fallback data if AI fails
    return {
      businessName: `${name}'s ${businessType}`,
      niche: "General market",
      problem: "Customer needs in this industry",
      solution: "Professional services",
      uniqueAdvantage: "Personal expertise and attention",
      profitPotential: "$2,000-$5,000/month",
      validationStrategy: "Direct outreach to potential customers",
      confidence: 0.7,
      quickWins: [
        "Create a simple landing page",
        "Reach out to 10 potential customers",
        "Offer a limited-time launch discount"
      ]
    };
  }
}

/**
 * Identifies quick wins for a business opportunity
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @returns {Array} List of quick win strategies
 */
async function identifyQuickWins(opportunity) {
  try {
    const prompt = `
      For this business opportunity:
      ${JSON.stringify(opportunity)}
      
      Suggest 3 quick wins - specific, actionable steps the business owner can take in the next 48 hours to start making progress.
      Each quick win should be achievable with minimal resources and lead to tangible results.
      Return as a JSON array of strings.
    `;

    const response = await callOpenAIWithTimeout(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You identify practical first steps for new businesses." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    );
    
    const { quickWins } = JSON.parse(response.choices[0].message.content);
    return quickWins || [];
  } catch (error) {
    console.error("Error identifying quick wins:", error);
    return [
      "Create a simple landing page",
      "Reach out to 10 potential customers",
      "Offer a limited-time launch discount"
    ];
  }
}

/**
 * Calculates success probability for a business opportunity
 * This is a placeholder for future ML-based scoring
 * 
 * @param {Object} opportunity - The analyzed business opportunity
 * @returns {number} Success probability score (0-1)
 */
export function calculateSuccessProbability(opportunity) {
  // This would eventually use data from successful businesses to predict outcomes
  // For now, we use a simple heuristic based on the confidence score from the AI
  return opportunity.confidence || 0.7;
}
