// src/core/analyze.js
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
  
  // Extract relevant data from user input
  const { niche, targetAudience, mainProblem, leadMagnetTitle } = userData;
  
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
    let prompt;
    
    // NEW FUNNEL GENERATOR LOGIC
    if (leadMagnetTitle) {
      console.log(`🧲 Detected Lead Magnet Funnel request: ${leadMagnetTitle}`);
      
      prompt = `
        You are a world-class marketing strategist for LOCAL SERVICE BUSINESSES. Analyze this Lead Magnet Funnel request:
        
        Niche: ${niche}
        Target Audience: ${targetAudience}
        Main Problem: ${mainProblem}
        Lead Magnet Title: ${leadMagnetTitle}
        
        Your goal is to structure a high-converting funnel around this concept to generate LEADS and PHONE CALLS.
        
        Return a JSON object with:
        {
          "businessName": "A professional, trustworthy name for this local business",
          "niche": "${niche}",
          "targetAudience": "${targetAudience}",
          "problem": "${mainProblem}",
          "solution": "Expert service and the '${leadMagnetTitle}' asset",
          "uniqueAdvantage": "Local expertise for ${targetAudience}",
          "profitPotential": "$10,000-$50,000/month",
          "businessModel": "local_service",
          "leadMagnet": {
            "title": "${leadMagnetTitle}",
            "topic": "${niche} - ${mainProblem}",
            "audience": "${targetAudience}"
          }
        }
      `;
    } else {
      // FALLBACK FOR LEGACY REQUESTS (Keep simple)
      prompt = `
        Analyze this business request: ${JSON.stringify(userData)}
        Return a JSON object with businessName, niche, problem, solution, businessModel='service'.
      `;
    }

    // Call AI service to analyze the opportunity
    const response = await callOpenAIWithTimeout(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a brilliant business strategist." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    );
    
    // Parse the AI response
    const opportunity = JSON.parse(response.choices[0].message.content);
    
    // Add quick wins
    opportunity.quickWins = [
      "Share your new guide on LinkedIn",
      "Email 5 potential clients",
      "Post a teaser on social media"
    ];
    
    return opportunity;
  } catch (error) {
    console.error("Error analyzing opportunity:", error);
    
    // Fallback data
    return {
      businessName: "New Venture",
      niche: niche || "General",
      problem: mainProblem || "Unknown",
      solution: leadMagnetTitle || "Consulting",
      businessModel: "lead_magnet",
      leadMagnet: {
        title: leadMagnetTitle || "Free Guide",
        topic: niche || "Business",
        audience: targetAudience || "Everyone"
      }
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
