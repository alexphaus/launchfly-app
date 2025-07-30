// src/core/analyze.js
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Analyzes user data to find a profitable business opportunity.
 * This is the "Discovery" and "Validation" layer.
 * @param {object} userData - The user's input from the form.
 * @returns {Promise<object>} - A promise that resolves to the business opportunity.
 */
export async function analyzeOpportunity(userData) {
  console.log('Analyzing opportunity for:', userData.name);

  // In the future, this will involve deep market analysis.
  // For now, we'll use AI to generate a business concept based on user input.
  
  const prompt = `
    Based on the following user profile, generate a viable and profitable business concept.
    
    User Skills: ${userData.skills}
    Business Type Interest: ${userData.businessType}
    Business Goal: ${userData.goal}
    Special Preferences: ${userData.preferences}

    The output should be a "business opportunity" object with:
    - niche: A specific market niche.
    - targetAudience: A description of the ideal customer.
    - uniqueSellingProposition: What makes this business unique.
    - potentialServices: A list of 2-3 services to offer.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_object" },
    });

    const opportunity = JSON.parse(response.choices[0].message.content);
    
    console.log('Generated opportunity:', opportunity);
    return opportunity;
  } catch (error) {
    console.error("Error analyzing opportunity:", error);
    // Fallback for safety
    return {
      niche: "AI-Powered Web Design",
      targetAudience: "Small businesses needing a quick online presence.",
      uniqueSellingProposition: "Launch a complete business, not just a website, in minutes.",
      potentialServices: ["AI-generated website", "Branding package", "Initial marketing content"]
    };
  }
}
