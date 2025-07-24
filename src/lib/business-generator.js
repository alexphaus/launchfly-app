// lib/business-generator.js
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function generateBusinessWithAI(userData, sessionId, businessId) {
  console.log('Starting business generation for session:', sessionId);
  
  const stages = [
    { stage: 'analyzing', progress: 25, duration: 1000 },
    { stage: 'researching', progress: 50, duration: 2000 },
    { stage: 'building', progress: 75, duration: 2000 },
    { stage: 'finalizing', progress: 95, duration: 1000 },
  ];

  // Update progress through stages
  for (const stage of stages) {
    console.log(`Updating to stage: ${stage.stage} with progress: ${stage.progress}`);
    
    const { data, error } = await supabase
      .from('sessions')
      .update({
        stage: stage.stage,
        progress: stage.progress
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating session:', error);
    } else {
      console.log('Successfully updated session:', data);
    }
    
    await new Promise(resolve => setTimeout(resolve, stage.duration));
  }

  // Generate business data with OpenAI
  console.log('Calling OpenAI API...');

  const prompt = `You are a brilliant business strategist. Create a specific, actionable online business based on this profile:

Name: ${userData.name}
Skills/Interests: ${userData.skills}
Business Type: ${userData.businessType}
Goal: ${userData.goal}
Preferences: ${userData.preferences || 'None'}

Generate a comprehensive business plan with:
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
  ]
}

Return ONLY valid JSON.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using gpt-4o-mini for cost efficiency
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
      competitors: businessData.competitors || []
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