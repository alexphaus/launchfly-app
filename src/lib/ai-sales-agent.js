// src/lib/ai-sales-agent.js
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { logActivity, ActivityTypes } from './activity-logger.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Objection classification types
export const OBJECTION_TYPES = {
  PRICE: 'price',
  TIMING: 'timing', 
  AUTHORITY: 'authority',
  NEED: 'need',
  COMPETITION: 'competition',
  BUDGET: 'budget',
  UNSURE: 'unsure',
  BUSY: 'busy',
  UNSUBSCRIBE: 'unsubscribe'
};

// Objection keywords for classification
const OBJECTION_KEYWORDS = {
  [OBJECTION_TYPES.PRICE]: ['expensive', 'cost', 'price', 'expensive', 'overpriced', 'cheaper', 'costly', 'budget', 'afford'],
  [OBJECTION_TYPES.TIMING]: ['later', 'not now', 'timing', 'busy', 'schedule', 'next month', 'next quarter', 'not ready'],
  [OBJECTION_TYPES.AUTHORITY]: ['decision', 'boss', 'manager', 'approval', 'committee', 'not my call', 'need to check'],
  [OBJECTION_TYPES.NEED]: ['don\'t need', 'not interested', 'no use', 'doesn\'t apply', 'not relevant', 'no problem'],
  [OBJECTION_TYPES.COMPETITION]: ['competitor', 'already using', 'happy with', 'current solution', 'vendor'],
  [OBJECTION_TYPES.BUDGET]: ['no budget', 'budget constraints', 'spending freeze', 'cost cutting', 'reduced budget'],
  [OBJECTION_TYPES.UNSURE]: ['maybe', 'think about it', 'consider', 'not sure', 'need to think', 'let me think'],
  [OBJECTION_TYPES.BUSY]: ['too busy', 'no time', 'overwhelmed', 'swamped', 'hectic', 'crazy busy'],
  [OBJECTION_TYPES.UNSUBSCRIBE]: ['unsubscribe', 'stop', 'remove', 'don\'t contact', 'opt out']
};

/**
 * Classify objection type from email text
 */
export function classifyObjection(emailText) {
  const lowerText = emailText.toLowerCase();
  
  // Check for unsubscribe first (highest priority)
  if (OBJECTION_KEYWORDS[OBJECTION_TYPES.UNSUBSCRIBE].some(keyword => lowerText.includes(keyword))) {
    return OBJECTION_TYPES.UNSUBSCRIBE;
  }
  
  // Check other objection types
  for (const [type, keywords] of Object.entries(OBJECTION_KEYWORDS)) {
    if (type === OBJECTION_TYPES.UNSUBSCRIBE) continue; // Already checked
    
    const matchCount = keywords.filter(keyword => lowerText.includes(keyword)).length;
    if (matchCount > 0) {
      return type;
    }
  }
  
  return OBJECTION_TYPES.UNSURE;
}

/**
 * Generate AI-powered response to objection
 */
export async function generateObjectionResponse(objectionData, prospect, business) {
  try {
    const { type, text, conversationHistory = [] } = objectionData;
    
    // Build context from conversation history
    const conversationContext = conversationHistory.length > 0 
      ? `Previous conversation:\n${conversationHistory.map(msg => `${msg.sender}: ${msg.text}`).join('\n')}\n\n`
      : '';
    
    const prompt = `
You are an expert sales agent handling email objections. Generate a persuasive, personalized response.

Business Context:
- Business: ${business.businessName}
- Website: ${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/sites/${business.subdomain}
- Industry: ${business.industry || 'Professional Services'}
- Value Proposition: ${business.tagline || 'Professional solutions'}
- Products: ${business.products?.[0]?.description || 'High-quality services'}

Prospect Context:
- Name: ${prospect.name}
- Company: ${prospect.company}
- Industry: ${prospect.industry || 'Unknown'}
- Company Size: ${prospect.company_size || 'Unknown'}

Objection Details:
- Type: ${type}
- Objection: "${text}"

${conversationContext}
Generate a response that:
1. Acknowledges their concern professionally
2. Addresses the specific objection type
3. Provides value-focused counterpoints
4. Includes a soft call-to-action
5. Keeps it under 120 words
6. Maintains a helpful, not pushy tone

Return JSON with:
{
  "response": "Your response text",
  "confidence": 0.85,
  "nextAction": "follow_up_in_3_days",
  "escalationNeeded": false
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are a skilled sales professional who handles objections with empathy and value-focused responses. Never be pushy or aggressive." 
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      response: result.response,
      confidence: result.confidence || 0.8,
      nextAction: result.nextAction || 'follow_up_in_3_days',
      escalationNeeded: result.escalationNeeded || false,
      objectionType: type
    };

  } catch (error) {
    console.error('Error generating objection response:', error);
    
    // Fallback responses by objection type with business website links
    const businessUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/sites/${business.subdomain}`;
    const fallbackResponses = {
      [OBJECTION_TYPES.PRICE]: `I understand cost is always a consideration. Many of our clients find that our solutions actually reduce their overall expenses through increased efficiency. You can see our full pricing and value proposition at ${businessUrl}. Would you be open to a quick 15-minute call to discuss how we've helped similar companies in your industry?`,
      [OBJECTION_TYPES.TIMING]: `I completely understand timing is everything. Feel free to check out our website (${businessUrl}) when you have a moment, and when would be a better time to revisit this conversation? I'd be happy to reach back out in a few weeks or months when it might be more relevant.`,
      [OBJECTION_TYPES.AUTHORITY]: `I appreciate you being upfront about the decision-making process. You can find detailed information at ${businessUrl} that might be helpful to share with your team. Would it be helpful if I prepared a brief executive summary that you could share with them? This often helps move things forward.`,
      [OBJECTION_TYPES.NEED]: `I understand it might not seem relevant right now. Many of our best clients initially thought the same thing. Take a look at our case studies at ${businessUrl} - you might be surprised at some of the challenges we've helped solve. Would you be open to a quick conversation about how we've helped companies like yours?`,
      [OBJECTION_TYPES.COMPETITION]: `I appreciate you sharing that. Every solution has its strengths. You can see how we compare at ${businessUrl}. Would you be interested in a brief comparison of how we differ from your current provider? Sometimes a fresh perspective can be valuable.`,
      [OBJECTION_TYPES.BUDGET]: `I understand budget constraints are real. Many of our clients find creative ways to work with us, from phased implementations to ROI-based arrangements. Check out our flexible options at ${businessUrl}. Would you be open to exploring some possibilities?`,
      [OBJECTION_TYPES.UNSURE]: `I completely understand wanting to think it through. Sometimes browsing our website (${businessUrl}) can help clarify whether this is a good fit or not. Would a 15-minute call help you make a more informed decision?`,
      [OBJECTION_TYPES.BUSY]: `I totally get it - everyone is swamped these days. That's actually why many of our clients work with us - we help them save time and reduce stress. Take a quick look at ${businessUrl} when you have a moment. When things calm down a bit, would you be open to a quick chat?`,
      [OBJECTION_TYPES.UNSUBSCRIBE]: `I understand and will remove you from our list. Thank you for your time. If you change your mind in the future, you can find us at ${businessUrl} or feel free to reach out directly.`
    };

    return {
      response: fallbackResponses[type] || fallbackResponses[OBJECTION_TYPES.UNSURE],
      confidence: 0.6,
      nextAction: 'follow_up_in_5_days',
      escalationNeeded: false,
      objectionType: type
    };
  }
}

/**
 * Handle email objection with AI response
 */
export async function handleEmailObjection(businessId, prospect, objectionText, originalEmailId) {
  try {
    console.log(`🤖 AI Sales Agent handling objection for business: ${businessId}`);
    
    // Get business data
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (!business) {
      throw new Error('Business not found');
    }

    // Classify objection
    const objectionType = classifyObjection(objectionText);
    
    // Get conversation history
    const { data: conversationHistory } = await supabase
      .from('email_conversations')
      .select('*')
      .eq('prospect_email', prospect.email)
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });

    // Generate AI response
    const aiResponse = await generateObjectionResponse({
      type: objectionType,
      text: objectionText,
      conversationHistory: conversationHistory || []
    }, prospect, business);

    // Log the objection handling
    await logActivity(businessId, {
      type: ActivityTypes.EMAIL_OBJECTION_HANDLED,
      icon: '🤖',
      message: `AI handled ${objectionType} objection from ${prospect.name}`,
      details: `Response: "${aiResponse.response.substring(0, 100)}..."`,
      metadata: {
        prospectEmail: prospect.email,
        objectionType,
        objectionText,
        aiResponse,
        confidence: aiResponse.confidence,
        nextAction: aiResponse.nextAction
      }
    });

    // Store conversation
    await supabase.from('email_conversations').insert({
      business_id: businessId,
      prospect_email: prospect.email,
      message_type: 'objection',
      content: objectionText,
      objection_type: objectionType,
      created_at: new Date().toISOString()
    });

    await supabase.from('email_conversations').insert({
      business_id: businessId,
      prospect_email: prospect.email,
      message_type: 'ai_response',
      content: aiResponse.response,
      objection_type: objectionType,
      created_at: new Date().toISOString()
    });

    // Update prospect status
    await supabase
      .from('prospects')
      .update({ 
        status: 'objection_handled',
        last_objection_type: objectionType,
        last_ai_response: aiResponse.response.substring(0, 200),
        updated_at: new Date().toISOString()
      })
      .eq('email', prospect.email);

    return {
      success: true,
      objectionType,
      aiResponse,
      nextAction: aiResponse.nextAction,
      escalationNeeded: aiResponse.escalationNeeded
    };

  } catch (error) {
    console.error('Error handling email objection:', error);
    throw error;
  }
}

/**
 * Send AI-generated response email
 */
export async function sendObjectionResponse(businessId, prospect, aiResponse) {
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const subject = `Re: Quick follow-up - ${prospect.name}`;
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi ${prospect.name},</p>
        
        <p>${aiResponse.response}</p>
        
        <p>Best regards,<br>
        ${process.env.SENDER_NAME || 'The Team'}</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          This email was sent by an AI assistant. 
          <a href="${process.env.UNSUBSCRIBE_URL || '#'}">Unsubscribe</a>
        </p>
      </div>
    `;

    const result = await resend.emails.send({
      from: process.env.SENDER_EMAIL || 'noreply@launchfly.ai',
      to: prospect.email,
      subject,
      html: htmlBody,
      tags: [
        { name: 'business_id', value: businessId },
        { name: 'objection_type', value: aiResponse.objectionType },
        { name: 'ai_response', value: 'true' }
      ]
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    // Log the email send
    await logActivity(businessId, {
      type: ActivityTypes.EMAIL_SENT,
      icon: '📤',
      message: `AI response sent to ${prospect.name}`,
      details: `Objection type: ${aiResponse.objectionType}`,
      metadata: {
        prospectEmail: prospect.email,
        objectionType: aiResponse.objectionType,
        resendId: result.data?.id
      }
    });

    return {
      success: true,
      emailId: result.data?.id,
      sentAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error sending objection response:', error);
    throw error;
  }
}

/**
 * Schedule follow-up based on objection type
 */
export async function scheduleObjectionFollowUp(businessId, prospect, objectionType, nextAction) {
  try {
    const followUpDays = {
      'follow_up_in_1_day': 1,
      'follow_up_in_3_days': 3,
      'follow_up_in_5_days': 5,
      'follow_up_in_1_week': 7,
      'follow_up_in_2_weeks': 14,
      'follow_up_in_1_month': 30
    };

    const daysToWait = followUpDays[nextAction] || 5;
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + daysToWait);

    // Store follow-up task
    await supabase.from('follow_up_tasks').insert({
      business_id: businessId,
      prospect_email: prospect.email,
      objection_type: objectionType,
      follow_up_date: followUpDate.toISOString(),
      status: 'scheduled',
      created_at: new Date().toISOString()
    });

    console.log(`📅 Scheduled follow-up for ${prospect.email} in ${daysToWait} days`);

    return {
      success: true,
      followUpDate: followUpDate.toISOString(),
      daysToWait
    };

  } catch (error) {
    console.error('Error scheduling follow-up:', error);
    throw error;
  }
}
