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
    { stage: 'analyzing', progress: 25, duration: 3000 },
    { stage: 'researching', progress: 50, duration: 3000 },
    { stage: 'building', progress: 75, duration: 3000 },
    { stage: 'finalizing', progress: 95, duration: 2000 },
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
    
    // Wait for the specified duration
    await new Promise(resolve => setTimeout(resolve, stage.duration));
  }

  // Generate business data (using fallback for now)
  const businessData = {
    businessName: "FitFlow Pro",
    tagline: "Transform Bodies, Transform Lives",
    domain: "fitflowpro.com",
    logo: "💪",
    revenue: "$2,000-$5,000/month",
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
  
  return businessData;
}