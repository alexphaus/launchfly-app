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

/**
 * Detects business type from niche AND context (more accurate)
 * Returns one of 5 archetypes for tailored layouts
 * @param {string} niche - The business niche
 * @param {string} context - Additional business context (e.g., from social media)
 * @returns {'event' | 'coaching' | 'emergency' | 'visual' | 'retail' | 'local_service'} The detected business type
 */
export function detectBusinessType(niche, context = '') {
  const combinedText = `${niche || ''} ${context || ''}`.toLowerCase();
  
  // EVENT DETECTION (highest priority - specific dates, tickets, registration)
  const eventKeywords = [
    'event', 'workshop', 'webinar', 'seminar', 'conference', 'summit',
    'master class', 'masterclass', 'bootcamp', 'retreat', 'session',
    'ticket', 'registration', 'register', 'book your spot', 'reserve',
    'limited seats', 'seats available', 'pax', 'per person',
    'jan ', 'feb ', 'mar ', 'apr ', 'may ', 'jun ', 'jul ', 'aug ', 'sep ', 'oct ', 'nov ', 'dec ',
    '2025', '2026', 'pm to register', 'pm me', 'pm to join',
    'hosting', 'we are hosting', 'join us', 'open to all',
    'zumba', 'yoga class', 'dance class', 'fitness class', 'group class'
  ];
  
  const eventPatterns = [
    /\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, // "17 Jan"
    /rm\s*\d+/i, // "RM65" - Malaysian Ringgit pricing
    /\$\s*\d+\s*(per|\/)\s*(person|pax|ticket)/i, // "$50 per person"
    /\d{1,2}:\d{2}\s*(am|pm)/i, // "6:00pm"
    /limited\s*(spots|seats|slots)/i,
    /group\s*(of\s*)?\d+/i, // "group of 5"
  ];
  
  const hasEventKeyword = eventKeywords.some(k => combinedText.includes(k));
  const hasEventPattern = eventPatterns.some(p => p.test(combinedText));
  
  if (hasEventKeyword && hasEventPattern) {
    return 'event';
  }
  
  // EMERGENCY DETECTION (trust/speed focus - plumbers, roofers, etc.)
  const emergencyKeywords = [
    'plumber', 'plumbing', 'roofer', 'roofing', 'locksmith', 'lock',
    'hvac', 'ac repair', 'aircon', 'air conditioning', 'air-con',
    'electrician', 'electrical', 'wiring', 'emergency', '24/7', '24 hour',
    'same day', 'water heater', 'leak', 'flood', 'broken', 'repair',
    'fix', 'burst pipe', 'clogged', 'drain', 'sewage', 'pest control',
    'exterminator', 'garage door', 'appliance repair', 'towing', 'roadside'
  ];
  
  const hasEmergencyKeyword = emergencyKeywords.some(k => combinedText.includes(k));
  if (hasEmergencyKeyword) {
    return 'emergency';
  }
  
  // VISUAL DETECTION (aesthetics/portfolio focus - salons, design, etc.)
  const visualKeywords = [
    'salon', 'spa', 'beauty', 'hair', 'haircut', 'nail', 'nails', 'makeup',
    'interior design', 'interior', 'architect', 'photography', 'photographer',
    'detailing', 'car detailing', 'auto detailing', 'car wash', 'tattoo',
    'florist', 'flowers', 'bakery', 'cake', 'wedding', 'event planner',
    'graphic design', 'branding', 'studio', 'art', 'gallery', 'fashion',
    'jewelry', 'boutique', 'aesthetic', 'lash', 'brow', 'skincare', 'facial'
  ];
  
  const hasVisualKeyword = visualKeywords.some(k => combinedText.includes(k));
  if (hasVisualKeyword) {
    return 'visual';
  }
  
  // COACHING DETECTION (authority/transformation focus)
  const coachingKeywords = [
    'coach', 'coaching', 'consultant', 'consulting', 'mentor', 'mentoring',
    'trainer', 'training', 'advisor', 'advisory', 'expert', 'strategist',
    'therapist', 'counselor', 'counseling', 'speaker', 'author', 'creator',
    'influencer', 'educator', 'teacher', 'tutor', 'course', 'program',
    'mastermind', 'agency', 'freelancer', 'designer', 'developer', 'writer',
    'fitness coach', 'life coach', 'business coach', 'health coach',
    'career coach', 'executive coach', 'relationship coach', 'mindset',
    'transformation', 'personal development', 'self-help', 'wellness coach',
    '1:1', 'one-on-one', 'private coaching', 'group coaching'
  ];
  
  const isCoaching = coachingKeywords.some(k => combinedText.includes(k));
  if (isCoaching) {
    return 'coaching';
  }
  
  // RETAIL DETECTION (menu/location/hours focus)
  const retailKeywords = [
    'restaurant', 'cafe', 'coffee', 'food', 'menu', 'dining',
    'shop', 'store', 'retail', 'boutique', 'grocery', 'market',
    'bar', 'pub', 'brewery', 'bakery', 'deli', 'pizzeria', 'sushi',
    'takeout', 'delivery', 'dine-in', 'reservation'
  ];
  
  const hasRetailKeyword = retailKeywords.some(k => combinedText.includes(k));
  if (hasRetailKeyword) {
    return 'retail';
  }
  
  // Default to local service
  return 'local_service';
}

/**
 * Extracts event-specific details from context
 * @param {string} context - Business context text
 * @returns {Object|null} Event details or null if not an event
 */
export function extractEventDetails(context) {
  if (!context) return null;
  
  const details = {
    eventName: null,
    eventDate: null,
    eventTime: null,
    venue: null,
    price: null,
    groupPrice: null,
    groupSize: null,
    host: null,
    guestSpeaker: null,
    registrationMethod: null
  };
  
  // Extract event name (look for patterns like "Master Class", "Workshop", etc.)
  const eventNameMatch = context.match(/([\w\s]+(?:master\s*class|workshop|seminar|bootcamp|retreat|jam|session))/i);
  if (eventNameMatch) details.eventName = eventNameMatch[1].trim();
  
  // Extract date (e.g., "17 Jan 2026")
  const dateMatch = context.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})?/i);
  if (dateMatch) {
    details.eventDate = `${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3] || '2026'}`;
  }
  
  // Extract time (e.g., "6:00pm", "6pm–7:30pm")
  const timeMatch = context.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)(?:\s*[–-]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))?)/i);
  if (timeMatch) details.eventTime = timeMatch[1];
  
  // Extract price (RM, $, etc.)
  const priceMatch = context.match(/(?:rm|usd|\$|€|£)\s*(\d+(?:\.\d{2})?)/i);
  if (priceMatch) {
    const currency = context.match(/(rm|usd|\$|€|£)/i)?.[1]?.toUpperCase() || '$';
    details.price = `${currency === 'RM' ? 'RM' : currency}${priceMatch[1]}`;
  }
  
  // Extract group price
  const groupPriceMatch = context.match(/(?:rm|usd|\$|€|£)\s*(\d+)\s*(?:group|per\s*pax|\d+\s*pax)/i);
  if (groupPriceMatch) {
    const currency = context.match(/(rm|usd|\$|€|£)/i)?.[1]?.toUpperCase() || '$';
    details.groupPrice = `${currency === 'RM' ? 'RM' : currency}${groupPriceMatch[1]}`;
  }
  
  // Extract group size
  const groupSizeMatch = context.match(/(\d+)\s*pax/i);
  if (groupSizeMatch) details.groupSize = parseInt(groupSizeMatch[1]);
  
  // Extract venue/location
  const venueMatch = context.match(/(?:at|📍|venue:|location:)\s*([^,\n]+)/i);
  if (venueMatch) details.venue = venueMatch[1].trim();
  
  // Extract guest speaker/instructor
  const speakerMatch = context.match(/(?:with|featuring|by|instructor:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  if (speakerMatch) details.guestSpeaker = speakerMatch[1];
  
  // Extract registration method
  if (context.toLowerCase().includes('pm me') || context.toLowerCase().includes('pm to')) {
    details.registrationMethod = 'direct_message';
  } else if (context.toLowerCase().includes('register') || context.toLowerCase().includes('book')) {
    details.registrationMethod = 'online_registration';
  }
  
  // Only return if we found meaningful event details
  const hasDetails = details.eventDate || details.price || details.eventName;
  return hasDetails ? details : null;
}

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
    
    // Detect business type from niche
    const businessType = detectBusinessType(niche);
    console.log(`🎯 Detected business type: ${businessType} for niche: ${niche}`);
    
    // NEW FUNNEL GENERATOR LOGIC
    if (leadMagnetTitle) {
      console.log(`🧲 Detected Lead Magnet Funnel request: ${leadMagnetTitle}`);
      
      if (businessType === 'coaching') {
        // COACHING/CONSULTING PROMPT
        prompt = `
          You are a world-class marketing strategist for COACHES, CONSULTANTS, and ONLINE EXPERTS. Analyze this Lead Magnet Funnel request:
          
          Niche: ${niche}
          Target Audience: ${targetAudience}
          Main Problem: ${mainProblem}
          Lead Magnet Title: ${leadMagnetTitle}
          
          Your goal is to structure a high-converting funnel that positions the coach as an AUTHORITY and generates STRATEGY CALL BOOKINGS.
          
          Return a JSON object with:
          {
            "businessName": "The coach's brand name or personal name",
            "niche": "${niche}",
            "targetAudience": "${targetAudience}",
            "problem": "${mainProblem}",
            "solution": "Expert coaching/consulting and the '${leadMagnetTitle}' framework",
            "uniqueAdvantage": "Proven methodology for ${targetAudience}",
            "profitPotential": "$5,000-$20,000/month",
            "businessModel": "coaching",
            "businessType": "coaching",
            "leadMagnet": {
              "title": "${leadMagnetTitle}",
              "topic": "${niche} - ${mainProblem}",
              "audience": "${targetAudience}",
              "type": "expert_guide"
            },
            "quickWins": [
              "Share your new guide on LinkedIn",
              "Post a transformation story on Instagram",
              "DM 10 ideal clients with a free value offer"
            ]
          }
        `;
      } else {
        // LOCAL SERVICE PROMPT (Original)
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
            "businessType": "local_service",
            "leadMagnet": {
              "title": "${leadMagnetTitle}",
              "topic": "${niche} - ${mainProblem}",
              "audience": "${targetAudience}",
              "type": "price_guide"
            }
          }
        `;
      }
    } else {
      // FALLBACK FOR LEGACY REQUESTS (Keep simple)
      prompt = `
        Analyze this business request: ${JSON.stringify(userData)}
        Return a JSON object with businessName, niche, problem, solution, businessModel='service', businessType='${businessType}'.
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
