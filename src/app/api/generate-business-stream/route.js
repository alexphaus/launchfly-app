// app/api/generate-business-stream/route.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 2
});

export async function POST(request) {
  const { sessionId, businessId, formData } = await request.json();
  
  console.log('Starting streaming business generation:', { sessionId, businessId });

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Helper function to send updates
      const sendUpdate = (data) => {
        const sseData = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(sseData));
      };

      try {
        // Step 1: Initialize with skeleton data (0s)
        await initializeBusiness(businessId, sessionId, formData, sendUpdate);
        
        // Step 2: Generate business name and basic info (2s)
        await new Promise(resolve => setTimeout(resolve, 2000));
        await generateBasicInfo(businessId, formData, sendUpdate);
        
        // Step 3: Generate theme and colors (5s)
        await new Promise(resolve => setTimeout(resolve, 3000));
        await generateTheme(businessId, formData, sendUpdate);
        
        // Step 4: Generate hero content (8s)
        await new Promise(resolve => setTimeout(resolve, 3000));
        await generateHeroContent(businessId, formData, sendUpdate);
        
        // Step 5: Generate products (12s)
        await new Promise(resolve => setTimeout(resolve, 4000));
        await generateProducts(businessId, formData, sendUpdate);
        
        // Step 6: Finalize and activate (15s)
        await new Promise(resolve => setTimeout(resolve, 3000));
        await finalizeBusiness(businessId, sessionId, sendUpdate);
        
      } catch (error) {
        console.error('Streaming generation error:', error);
        sendUpdate({
          type: 'error',
          message: error.message,
          timestamp: Date.now()
        });
        
        // Update database to error state
        await supabase
          .from('businesses')
          .update({ status: 'failed' })
          .eq('id', businessId);
          
        await supabase
          .from('sessions')
          .update({ stage: 'error' })
          .eq('id', sessionId);
      }
      
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function initializeBusiness(businessId, sessionId, formData, sendUpdate) {
  // Create skeleton business data
  const skeletonData = {
    business_name: "Your Business",
    subdomain: null,
    theme: {
      primaryColor: "#3b82f6",
      secondaryColor: "#1e40af",
      backgroundColor: "#ffffff"
    },
    hero: {
      title: "Loading...",
      subtitle: "Please wait while we create your business"
    },
    products: []
  };

  // Update database
  await supabase
    .from('businesses')
    .update({ 
      status: 'generating',
      business_data: skeletonData 
    })
    .eq('id', businessId);

  await supabase
    .from('sessions')
    .update({ stage: 'analyzing' })
    .eq('id', sessionId);

  sendUpdate({
    type: 'skeleton_ready',
    data: skeletonData,
    activity: 'Analyzing your skills and interests ✅',
    timestamp: Date.now()
  });
}

async function generateBasicInfo(businessId, formData, sendUpdate) {
  const businessNamePrompt = `Based on this user data: ${JSON.stringify(formData)}
  Generate a perfect business name that:
  - Reflects their skills/interests
  - Is memorable and brandable
  - Suggests success and professionalism
  
  Return ONLY the business name, nothing else.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: businessNamePrompt }],
    max_tokens: 50,
    temperature: 0.7
  });

  const businessName = response.choices[0].message.content.trim();
  const subdomain = businessName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);

  // Update database
  const { data: existingBusiness } = await supabase
    .from('businesses')
    .select('business_data')
    .eq('id', businessId)
    .single();

  const updatedData = {
    ...existingBusiness.business_data,
    business_name: businessName,
    subdomain: subdomain
  };

  await supabase
    .from('businesses')
    .update({ 
      name: businessName,
      subdomain: subdomain,
      business_data: updatedData 
    })
    .eq('id', businessId);

  await supabase
    .from('sessions')
    .update({ stage: 'researching' })
    .eq('id', sessionId);

  sendUpdate({
    type: 'basic_info_ready',
    data: { business_name: businessName, subdomain: subdomain },
    activity: 'Researching your market and competitors 🔍',
    timestamp: Date.now()
  });
}

async function generateTheme(businessId, formData, sendUpdate) {
  const themePrompt = `Based on this business and user data: ${JSON.stringify(formData)}
  Generate a professional color theme with:
  - Primary color (hex)
  - Secondary color (hex) 
  - Background color (hex)
  - Text color (hex)
  
  Return as JSON only: {"primaryColor": "#hex", "secondaryColor": "#hex", "backgroundColor": "#hex", "textColor": "#hex"}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: themePrompt }],
    max_tokens: 100,
    temperature: 0.7
  });

  const theme = JSON.parse(response.choices[0].message.content.trim());

  // Update database
  const { data: existingBusiness } = await supabase
    .from('businesses')
    .select('business_data')
    .eq('id', businessId)
    .single();

  const updatedData = {
    ...existingBusiness.business_data,
    theme: theme
  };

  await supabase
    .from('businesses')
    .update({ business_data: updatedData })
    .eq('id', businessId);

  await supabase
    .from('sessions')
    .update({ stage: 'building' })
    .eq('id', sessionId);

  sendUpdate({
    type: 'theme_ready',
    data: { theme },
    activity: 'Building your professional website 🎨',
    timestamp: Date.now()
  });
}

async function generateHeroContent(businessId, formData, sendUpdate) {
  const heroPrompt = `Based on this user data: ${JSON.stringify(formData)}
  Generate compelling hero section content:
  - Powerful headline (under 60 chars)
  - Engaging subtitle (under 120 chars)
  - Call-to-action text
  
  Return as JSON: {"title": "headline", "subtitle": "subtitle", "ctaText": "cta"}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: heroPrompt }],
    max_tokens: 150,
    temperature: 0.7
  });

  const hero = JSON.parse(response.choices[0].message.content.trim());

  // Update database
  const { data: existingBusiness } = await supabase
    .from('businesses')
    .select('business_data')
    .eq('id', businessId)
    .single();

  const updatedData = {
    ...existingBusiness.business_data,
    hero: hero
  };

  await supabase
    .from('businesses')
    .update({ business_data: updatedData })
    .eq('id', businessId);

  sendUpdate({
    type: 'hero_ready',
    data: { hero },
    activity: 'Creating your product lineup 📦',
    timestamp: Date.now()
  });
}

async function generateProducts(businessId, formData, sendUpdate) {
  const productsPrompt = `Based on this user data: ${JSON.stringify(formData)}
  Generate 3 products/services they could offer:
  Each product needs: name, description, price, features (array)
  
  Return as JSON array: [{"name": "", "description": "", "price": "$X", "features": []}]`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: productsPrompt }],
    max_tokens: 500,
    temperature: 0.7
  });

  const products = JSON.parse(response.choices[0].message.content.trim());

  // Update database
  const { data: existingBusiness } = await supabase
    .from('businesses')
    .select('business_data')
    .eq('id', businessId)
    .single();

  const updatedData = {
    ...existingBusiness.business_data,
    products: products
  };

  await supabase
    .from('businesses')
    .update({ business_data: updatedData })
    .eq('id', businessId);

  // Send each product individually for progressive loading
  for (let i = 0; i < products.length; i++) {
    if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000));
    
    sendUpdate({
      type: 'product_ready',
      data: { product: products[i], index: i },
      activity: `Adding product ${i + 1} of ${products.length} ✨`,
      timestamp: Date.now()
    });
  }
}

async function finalizeBusiness(businessId, sessionId, sendUpdate) {
  // Mark as complete
  await supabase
    .from('businesses')
    .update({ 
      status: 'ready',
      launch_date: new Date().toISOString()
    })
    .eq('id', businessId);

  await supabase
    .from('sessions')
    .update({ stage: 'complete' })
    .eq('id', sessionId);

  sendUpdate({
    type: 'business_complete',
    data: { status: 'ready' },
    activity: 'Your business is live! 🚀',
    timestamp: Date.now()
  });

  // Simulate first visitor after a delay
  setTimeout(async () => {
    await supabase
      .from('businesses')
      .update({ views: 1 })
      .eq('id', businessId);

    sendUpdate({
      type: 'first_visitor',
      data: { views: 1 },
      activity: 'First visitor arrived! 🎉',
      timestamp: Date.now()
    });
  }, 3000);
}

export const runtime = 'nodejs';
export const maxDuration = 120;
