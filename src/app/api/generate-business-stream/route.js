// app/api/generate-business-stream/route.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { generateBusinessWithAI } from '@/lib/business-generator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Streaming business generation API
 * Returns Server-Sent Events with real-time updates
 */
export async function POST(request) {
  const { sessionId, businessId, formData } = await request.json();
  
  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      const sendUpdate = (data) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };
      
      try {
        // Initialize status
        await supabase
          .from('businesses')
          .update({ status: 'generating' })
          .eq('id', businessId);

        // Stage 1: Analyzing
        await supabase
          .from('sessions')
          .update({ stage: 'analyzing' })
          .eq('id', sessionId);
        
        sendUpdate({ 
          stage: 'analyzing', 
          message: 'Analyzing your skills and experience...',
          progress: 15
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Stage 2: Researching
        await supabase
          .from('sessions')
          .update({ stage: 'researching' })
          .eq('id', sessionId);
        
        sendUpdate({ 
          stage: 'researching', 
          message: 'Researching your target market...',
          progress: 35
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Stage 3: Building - Start streaming website generation
        await supabase
          .from('sessions')
          .update({ stage: 'building' })
          .eq('id', sessionId);
        
        sendUpdate({ 
          stage: 'building', 
          message: 'Building your website...',
          progress: 60
        });

        // Generate business name first
        const businessNameStream = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "user",
            content: `Based on these user details, generate a professional business name:
            
            Skills: ${formData.skills}
            Business Type: ${formData.businessType}
            Goal: ${formData.goal}
            
            Return only the business name, nothing else.`
          }],
          stream: true,
          max_tokens: 50
        });

        let businessName = '';
        for await (const chunk of businessNameStream) {
          const content = chunk.choices[0]?.delta?.content || '';
          businessName += content;
          
          if (content) {
            sendUpdate({
              stage: 'building',
              type: 'business_name',
              content: businessName.trim(),
              message: 'Creating your business identity...',
              progress: 65
            });
          }
        }

        // Generate website content in chunks
        const websiteStream = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "user",
            content: `Create a professional website for "${businessName.trim()}" with these details:
            
            Skills: ${formData.skills}
            Business Type: ${formData.businessType}
            Goal: ${formData.goal}
            
            Return a JSON object with:
            {
              "heroTitle": "compelling main headline",
              "heroSubtitle": "engaging subtitle",
              "aboutText": "about section content",
              "services": ["service 1", "service 2", "service 3"],
              "features": [{"title": "feature", "description": "desc", "icon": "emoji"}],
              "theme": {"primaryColor": "#hex", "secondaryColor": "#hex", "font": "font-name"}
            }`
          }],
          stream: true,
          max_tokens: 1000
        });

        let websiteContent = '';
        let currentProgress = 65;
        
        for await (const chunk of websiteStream) {
          const content = chunk.choices[0]?.delta?.content || '';
          websiteContent += content;
          currentProgress = Math.min(currentProgress + 0.5, 85);
          
          if (content) {
            // Try to parse partial JSON to show incremental updates
            try {
              // Look for complete JSON objects in the stream
              const jsonMatch = websiteContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const partialData = JSON.parse(jsonMatch[0]);
                sendUpdate({
                  stage: 'building',
                  type: 'website_content',
                  content: partialData,
                  message: 'Designing your website content...',
                  progress: currentProgress
                });
              }
            } catch (e) {
              // Continue streaming even if JSON isn't complete yet
              sendUpdate({
                stage: 'building',
                type: 'website_progress',
                message: 'Generating website content...',
                progress: currentProgress
              });
            }
          }
        }

        // Generate products
        sendUpdate({
          stage: 'building',
          message: 'Creating your products and services...',
          progress: 85
        });

        const productsStream = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "user",
            content: `Create 3 products/services for "${businessName.trim()}" business:
            
            Skills: ${formData.skills}
            Business Type: ${formData.businessType}
            
            Return JSON array:
            [{"name": "product name", "price": "$99", "description": "brief description", "features": ["feature1", "feature2"]}]`
          }],
          stream: true,
          max_tokens: 500
        });

        let productsContent = '';
        for await (const chunk of productsStream) {
          const content = chunk.choices[0]?.delta?.content || '';
          productsContent += content;
          
          if (content) {
            try {
              const products = JSON.parse(productsContent.match(/\[[\s\S]*\]/)?.[0] || '[]');
              if (products.length > 0) {
                sendUpdate({
                  stage: 'building',
                  type: 'products',
                  content: products,
                  message: 'Adding your products...',
                  progress: 90
                });
              }
            } catch (e) {
              // Continue
            }
          }
        }

        // Finalize
        await supabase
          .from('sessions')
          .update({ stage: 'finalizing' })
          .eq('id', sessionId);
        
        sendUpdate({
          stage: 'finalizing',
          message: 'Finalizing your business...',
          progress: 95
        });

        // Save complete business data
        const completeBusinessData = {
          businessName: businessName.trim(),
          websiteContent: JSON.parse(websiteContent.match(/\{[\s\S]*\}/)?.[0] || '{}'),
          products: JSON.parse(productsContent.match(/\[[\s\S]*\]/)?.[0] || '[]'),
          domain: businessName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        };

        await supabase
          .from('businesses')
          .update({
            name: completeBusinessData.businessName,
            subdomain: completeBusinessData.domain,
            business_data: completeBusinessData,
            status: 'ready'
          })
          .eq('id', businessId);

        await supabase
          .from('sessions')
          .update({ stage: 'complete' })
          .eq('id', sessionId);

        sendUpdate({
          stage: 'complete',
          message: 'Your business is ready!',
          progress: 100,
          businessData: completeBusinessData
        });

        controller.close();
        
      } catch (error) {
        console.error('Streaming generation error:', error);
        sendUpdate({
          stage: 'error',
          message: 'Generation failed',
          error: error.message
        });
        controller.close();
      }
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
