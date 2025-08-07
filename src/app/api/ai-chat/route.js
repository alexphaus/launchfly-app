// app/api/ai-chat/route.js
// Conversion-focused AI responses

export async function POST(req) {
  try {
    const { message, stage, product, visitor, context } = await req.json();
    
    // Stage-based system prompts (the conversion ladder)
    const stagePrompts = {
      hook: `You're a friendly sales expert. Ask ONE engaging question about their biggest challenge.
             Product: ${product.name}. Be conversational and curious. Create urgency.`,
      
      qualify: `Connect their problem to the solution. Show how ${product.name} helps.
               Mention that ${context.socialProof} people are looking at this right now.
               Build trust and urgency. Highlight the savings: ${product.savings}.`,
      
      close: `Time to close the deal! Price: ${product.price} (was ${product.fakePrice}).
             They save ${product.savings}. Mention: ${product.scarcity}.
             Offer expires in ${context.urgencyTimer}. Be confident, create FOMO.
             If they object, use their words against them.`,
      
      upsell: `They're ready to buy. Suggest adding the bonuses for just $47 more.
              List the bonuses quickly: ${product.bonuses?.join(', ')}. Make it a no-brainer.`
    };

    // Smart objection handling with psychology
    const objectionResponses = {
      price: `I get it - money matters. That's why I'm giving you ${context.offerCode || 'SAVE20'} for 20% off. Plus you can split it into 3 payments. The real question is: what's it costing you NOT to have this? Which payment plan works better?`,
      
      trust: `Totally fair! That's why we have a 30-day money-back guarantee. Plus, check out our 847 five-star reviews. Zero risk on your end. And honestly, ${context.socialProof} other people are looking at this right now.`,
      
      time: `I hear you on timing. But here's the thing - every day you wait costs you potential results. This offer expires in ${context.urgencyTimer}. The last person who "needed to think about it" came back and the price had gone up. Just saying...`,
      
      think: `Of course! Take a moment. But heads up - ${context.socialProof} others are looking at this and the discount expires in ${context.urgencyTimer}. I'd hate for you to miss out like the last person did.`,
      
      expensive: `I understand! That's exactly why we have the payment plan option. Plus, think about it - you'll make this back in the first week. Most people spend more on coffee in a month than this one-time investment.`,
      
      works: `Great question! It works because it's specifically designed for people like you. We've had ${context.socialProof * 10} customers with the exact same concern, and 94% see results in the first 30 days. That's why we can offer the guarantee.`
    };

    // Detect objections and intent in the message
    let response = '';
    const lowerMessage = message.toLowerCase();
    
    // Handle specific objections first
    if (lowerMessage.includes('expensive') || lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('money')) {
      response = objectionResponses.price;
    } else if (lowerMessage.includes('trust') || lowerMessage.includes('scam') || lowerMessage.includes('legit') || lowerMessage.includes('real')) {
      response = objectionResponses.trust;
    } else if (lowerMessage.includes('think') || lowerMessage.includes('later') || lowerMessage.includes('time') || lowerMessage.includes('decide')) {
      response = objectionResponses.think;
    } else if (lowerMessage.includes('work') || lowerMessage.includes('effective') || lowerMessage.includes('results')) {
      response = objectionResponses.works;
    } else if (lowerMessage.includes('too much') || lowerMessage.includes('afford') || lowerMessage.includes('budget')) {
      response = objectionResponses.expensive;
    } else {
      // Use OpenAI for dynamic responses (with fallback)
      try {
        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: `${stagePrompts[stage]}
                
                Key context:
                - Social proof: ${context.socialProof} people viewing
                - Urgency: Offer expires in ${context.urgencyTimer}
                - Intent score: ${context.intent}/100
                - Stage: ${stage}
                
                Rules:
                - Keep responses under 60 words
                - Create urgency and FOMO
                - Use social proof
                - If closing stage, push for the sale
                - Always mention the savings or discount
                - Be confident and assumptive`
              },
              { role: 'user', content: message }
            ],
            max_tokens: 80,
            temperature: 0.8
          })
        });
        
        if (openAIResponse.ok) {
          const data = await openAIResponse.json();
          response = data.choices[0]?.message?.content || '';
        }
      } catch (error) {
        console.log('OpenAI fallback triggered:', error.message);
      }
      
      // Fallback responses if OpenAI fails
      if (!response) {
        const fallbacks = {
          hook: `That's exactly why most people come here! Tell me more about your situation so I can show you how ${product.name} solves it.`,
          qualify: `Perfect! ${product.name} handles that automatically. Plus you save ${product.savings} with today's offer. Want to see how it works for you specifically?`,
          close: `Based on what you said, this is exactly what you need. Ready to get started? I can apply code ${context.offerCode} for you right now.`,
          upsell: `Smart choice! Should I add the premium bonuses package too? It's normally $297 but I can include it for just $47 more today.`
        };
        response = fallbacks[stage] || fallbacks.hook;
      }
    }

    // Add psychological pressure based on stage
    if (stage === 'close' || stage === 'upsell') {
      if (!response.includes('expire') && !response.includes('others')) {
        response += ` Just so you know, ${context.socialProof} people are viewing this right now and the offer expires in ${context.urgencyTimer}.`;
      }
    }

    // Determine if we should offer a discount code
    let offer = null;
    if ((stage === 'close' || visitor.messageCount >= 2) && !context.offerCode) {
      offer = 'CHAT20';
    } else if (context.offerCode) {
      offer = context.offerCode;
    }

    return Response.json({ 
      response,
      offer,
      stage,
      urgency: context.urgencyTimer,
      socialProof: context.socialProof
    });

  } catch (error) {
    console.error('AI Chat Error:', error);
    
    // Emergency fallback that still converts
    return Response.json({ 
      response: "Look, I'll make this simple: Get 40% off right now with code SAVE40. This offer expires in 5 minutes and I can only extend it to the next 3 people. Want it?",
      offer: 'SAVE40',
      stage: 'close'
    });
  }
}