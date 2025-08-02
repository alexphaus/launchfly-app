// app/api/generate-business-stream/route.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  const { sessionId, businessId, formData } = await request.json();
  
  // Create a readable stream for server-sent events
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      try {
        // Send initial progress update
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: 'analyzing',
          message: 'Analyzing your skills and experience...',
          progress: 10
        })}\n\n`));

        // Update database stage
        await supabase
          .from('sessions')
          .update({ stage: 'analyzing' })
          .eq('id', sessionId);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Generate business name and concept first
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: 'researching',
          message: 'Researching market opportunities...',
          progress: 20
        })}\n\n`));

        await supabase
          .from('sessions')
          .update({ stage: 'researching' })
          .eq('id', sessionId);

        // Stream business concept generation
        const conceptStream = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "user",
            content: `Based on these user details, generate a business concept:
            
Name: ${formData.name}
Skills: ${formData.skills}
Business Type: ${formData.businessType}
Goal: ${formData.goal}

Return ONLY a JSON object with:
{
  "businessName": "specific business name",
  "tagline": "compelling tagline",
  "description": "2-sentence description",
  "niche": "target market"
}`
          }],
          stream: true,
        });

        let conceptData = '';
        for await (const chunk of conceptStream) {
          const content = chunk.choices[0]?.delta?.content || '';
          conceptData += content;
          
          // Send partial concept updates
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'concept_chunk',
            content: content,
            accumulated: conceptData
          })}\n\n`));
        }

        // Parse the complete concept
        let businessConcept;
        try {
          businessConcept = JSON.parse(conceptData);
        } catch (e) {
          // Fallback if parsing fails
          businessConcept = {
            businessName: `${formData.name}'s ${formData.businessType}`,
            tagline: "Professional solutions for your success",
            description: `Leveraging ${formData.skills} to help clients achieve their goals.`,
            niche: formData.businessType.toLowerCase()
          };
        }

        // Send concept completion
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'concept_complete',
          concept: businessConcept,
          progress: 35
        })}\n\n`));

        // Start building phase
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: 'building',
          message: 'Building your website...',
          progress: 40
        })}\n\n`));

        await supabase
          .from('sessions')
          .update({ stage: 'building' })
          .eq('id', sessionId);

        // Stream website content generation
        const websiteStream = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "user",
            content: `Create a complete website structure for "${businessConcept.businessName}":

Business: ${businessConcept.businessName}
Tagline: ${businessConcept.tagline} 
Description: ${businessConcept.description}
Target: ${businessConcept.niche}
Skills: ${formData.skills}

Return ONLY a JSON object with this structure:
{
  "hero": {
    "title": "compelling headline",
    "subtitle": "supporting text",
    "ctaText": "action button text"
  },
  "features": [
    {"icon": "emoji", "title": "feature name", "description": "benefit"},
    {"icon": "emoji", "title": "feature name", "description": "benefit"},
    {"icon": "emoji", "title": "feature name", "description": "benefit"}
  ],
  "products": [
    {
      "name": "service/product name",
      "price": "$XX",
      "description": "what it includes",
      "features": ["benefit 1", "benefit 2", "benefit 3"]
    }
  ],
  "theme": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "style": "modern/professional/creative"
  }
}`
          }],
          stream: true,
        });

        let websiteData = '';
        for await (const chunk of websiteStream) {
          const content = chunk.choices[0]?.delta?.content || '';
          websiteData += content;
          
          // Send website building chunks
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'website_chunk',
            content: content,
            accumulated: websiteData,
            progress: Math.min(40 + (websiteData.length / 50), 80)
          })}\n\n`));
        }

        // Parse complete website data
        let websiteStructure;
        try {
          websiteStructure = JSON.parse(websiteData);
        } catch (e) {
          // Fallback structure
          websiteStructure = {
            hero: {
              title: businessConcept.businessName,
              subtitle: businessConcept.tagline,
              ctaText: "Get Started"
            },
            features: [
              {icon: "⚡", title: "Fast Results", description: "Quick turnaround times"},
              {icon: "🎯", title: "Targeted Solutions", description: "Customized for your needs"},
              {icon: "🚀", title: "Growth Focused", description: "Built to scale"}
            ],
            products: [{
              name: "Starter Package",
              price: "$99",
              description: "Everything you need to get started",
              features: ["Initial consultation", "Custom solution", "Support included"]
            }],
            theme: {
              primaryColor: "#3b82f6",
              secondaryColor: "#8b5cf6",
              style: "modern"
            }
          };
        }

        // Finalizing phase
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'progress',
          stage: 'finalizing',
          message: 'Finalizing your business setup...',
          progress: 85
        })}\n\n`));

        await supabase
          .from('sessions')
          .update({ stage: 'finalizing' })
          .eq('id', sessionId);

        // Combine all data
        const completeBusinessData = {
          businessName: businessConcept.businessName,
          tagline: businessConcept.tagline,
          description: businessConcept.description,
          niche: businessConcept.niche,
          domain: businessConcept.businessName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          website: websiteStructure,
          ...websiteStructure
        };

        // Update database with complete business data
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

        // Send completion
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          businessData: completeBusinessData,
          progress: 100
        })}\n\n`));

        controller.close();

      } catch (error) {
        console.error('Streaming generation error:', error);
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          error: error.message
        })}\n\n`));

        await supabase
          .from('sessions')
          .update({ stage: 'error' })
          .eq('id', sessionId);

        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export const runtime = 'nodejs';
export const maxDuration = 120;
