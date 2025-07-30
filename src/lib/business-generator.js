// lib/business-generator.js
import { createClient } from '@supabase/supabase-js';
import { analyzeOpportunity, launchBusiness, growBusiness } from '../core';

// Create Supabase client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Generate a complete business using the future-proof architecture
 * This function orchestrates the entire business creation process
 * 
 * @param {Object} userData - User information from the form 
 * @param {string} sessionId - Current session ID
 * @param {string} businessId - Business record ID
 * @returns {Object} Complete business data
 */
export async function generateBusinessWithAI(userData, sessionId, businessId) {
  console.log('Starting business generation for session:', sessionId);
  
  try {
    // Step 1: Analyze opportunity using our core function
    console.log('Analyzing business opportunity...');
    const opportunity = await analyzeOpportunity(userData, sessionId);
    
    // Step 2: Launch the business with the analyzed opportunity
    console.log('Launching business...');
    const businessData = await launchBusiness(opportunity, sessionId, businessId);
    
    // Note: We don't run growBusiness automatically here because
    // that's part of the ongoing value we provide to customers
    // It's called later in the dashboard flow
    
    return businessData;
  } catch (error) {
    console.error('Error generating business:', error);
    
    // Update session to error state
    await supabase
      .from('sessions')
      .update({ stage: 'error' })
      .eq('id', sessionId);
    
    throw error;
  }

  const prompt = `You are a brilliant business strategist. Create a specific, actionable online business based on this profile:

Name: ${userData.name}
Skills/Interests: ${userData.skills}
Business Type: ${userData.businessType}
Goal: ${userData.goal}
Preferences: ${userData.preferences || 'None'}

Generate a comprehensive business plan with theme and layout for a professional website:
{
  "businessName": "Creative and memorable business name",
  "tagline": "One compelling sentence that sells the vision",
  "domain": "available-domain.com",
  "logo": "🎯 (relevant emoji)",
  "monthlyRevenue": "$2,000-$5,000/month",
  "products": [
    {
      "name": "Product name",
      "price": "$97",
      "description": "What this product does"
    }
    // 3 products total
  ],
  "targetCustomers": [
    "Specific customer persona 1",
    "Specific customer persona 2",
    "Specific customer persona 3"
  ],
  "monthlyData": [
    { "month": "Month 1", "revenue": 500 },
    { "month": "Month 2", "revenue": 1200 },
    { "month": "Month 3", "revenue": 2800 },
    { "month": "Month 4", "revenue": 4200 },
    { "month": "Month 5", "revenue": 5500 },
    { "month": "Month 6", "revenue": 7200 }
  ],
  "marketingStrategy": {
    "channels": ["Instagram", "Email", "SEO"],
    "firstSteps": [
      "Specific action 1",
      "Specific action 2",
      "Specific action 3"
    ],
    "contentIdeas": [
      "Content idea 1",
      "Content idea 2"
    ]
  },
  "competitors": [
    {
      "name": "Competitor 1",
      "strength": "What they do well",
      "weakness": "Where you can beat them"
    }
  ],
  "theme": {
    "colors": {
      "primary": "#3b82f6",
      "secondary": "#1e40af",
      "textDark": "#1f2937",
      "textGray": "#6b7280",
      "borderColor": "#e5e7eb"
    },
    "font": "Inter",
    "gradient": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
  },
  "layout": [
    {
      "component": "NavBar",
      "props": {
        "businessName": "Use businessName from above",
        "logo": "Use logo from above", 
        "links": ["About", "Services", "Pricing", "Contact"],
        "ctaText": "Get Started"
      }
    },
    {
      "component": "Hero",
      "props": {
        "title": "Use tagline or create compelling hero title",
        "subtitle": "Compelling subtitle about the business value",
        "ctaText": "Start Today",
        "secondaryCtaText": "Learn More"
      }
    },
    {
      "component": "FeatureGrid",
      "props": {
        "title": "Why Choose Us",
        "features": [
          {
            "icon": "⚡",
            "title": "Feature based on business type",
            "description": "Description of this feature"
          }
          // 3 features total
        ]
      }
    },
    {
      "component": "TestimonialSlider",
      "props": {
        "testimonials": [
          {
            "name": "John Doe",
            "role": "Happy Customer",
            "content": "Realistic testimonial based on business type",
            "avatar": "👨‍💼",
            "rating": 5
          }
          // 2-3 testimonials
        ]
      }
    },
    {
      "component": "PricingTable", 
      "props": {
        "plans": [
          {
            "name": "Basic",
            "price": "Price from products above",
            "description": "Perfect for getting started",
            "features": ["Feature 1", "Feature 2", "Feature 3"],
            "ctaText": "Get Started",
            "popular": false
          }
          // Use products as pricing plans
        ]
      }
    },
    {
      "component": "CallToAction",
      "props": {
        "title": "Ready to Get Started?",
        "subtitle": "Join us today and transform your business",
        "ctaText": "Start Now"
      }
    },
    {
      "component": "Footer",
      "props": {
        "businessName": "Use businessName from above",
        "logo": "Use logo from above",
        "description": "Use tagline from above"
      }
    }
  ]
}

Return ONLY valid JSON.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert business strategist who creates detailed, actionable business plans. Always return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    console.log('OpenAI response received');
    
    const businessData = JSON.parse(completion.choices[0].message.content);
    
    // Ensure all required fields exist with proper structure
    const finalBusinessData = {
      businessName: businessData.businessName || "Your Business",
      tagline: businessData.tagline || "Transform your passion into profit",
      domain: businessData.domain || `business-${Date.now()}.com`,
      logo: businessData.logo || "🚀",
      revenue: businessData.monthlyRevenue || businessData.revenue || "$2,000-$5,000/month",
      monthlyRevenue: businessData.monthlyRevenue || "$2,000-$5,000/month",
      products: businessData.products || [],
      targetCustomers: businessData.targetCustomers || [],
      monthlyData: businessData.monthlyData || [
        { month: "Month 1", revenue: 500 },
        { month: "Month 2", revenue: 1200 },
        { month: "Month 3", revenue: 2800 },
        { month: "Month 4", revenue: 4200 },
        { month: "Month 5", revenue: 5500 },
        { month: "Month 6", revenue: 7200 }
      ],
      marketingStrategy: businessData.marketingStrategy || {},
      competitors: businessData.competitors || [],
      theme: businessData.theme || {
        colors: {
          primary: "#3b82f6",
          secondary: "#1e40af", 
          textDark: "#1f2937",
          textGray: "#6b7280",
          borderColor: "#e5e7eb"
        },
        font: "Inter",
        gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      },
      layout: businessData.layout || []
    };
    
    // Update session to complete
    console.log('Updating session to complete...');
    const { data: finalUpdate, error: finalError } = await supabase
      .from('sessions')
      .update({
        stage: 'complete',
        progress: 100
      })
      .eq('id', sessionId)
      .select()
      .single();
      
    if (finalError) {
      console.error('Error updating session to complete:', finalError);
    } else {
      console.log('Session marked as complete:', finalUpdate);
    }
    
    return finalBusinessData;
    
  } catch (error) {
    console.error('OpenAI generation error:', error);
    console.error('Error details:', error.message);
    
    // If OpenAI fails, return fallback data
    const fallbackData = {
      businessName: "FitFlow Pro",
      tagline: "Transform Bodies, Transform Lives",
      domain: "fitflowpro.com",
      logo: "💪",
      revenue: "$2,000-$5,000/month",
      monthlyRevenue: "$2,000-$5,000/month",
      products: [
        { name: "30-Day Transformation", price: "$97", description: "Personalized fitness plan" },
        { name: "VIP Coaching", price: "$297/mo", description: "1-on-1 weekly sessions" },
        { name: "Nutrition Guide", price: "$47", description: "Complete meal planning" }
      ],
      targetCustomers: [
        "Busy professionals aged 25-40",
        "New moms getting back in shape",
        "Beginners scared of gyms"
      ],
      monthlyData: [
        { month: "Month 1", revenue: 500 },
        { month: "Month 2", revenue: 1200 },
        { month: "Month 3", revenue: 2800 },
        { month: "Month 4", revenue: 4200 },
        { month: "Month 5", revenue: 5500 },
        { month: "Month 6", revenue: 7200 }
      ]
    };
    
    // Still mark as complete even with fallback
    await supabase
      .from('sessions')
      .update({
        stage: 'complete',
        progress: 100
      })
      .eq('id', sessionId);
    
    return fallbackData;
  }
}