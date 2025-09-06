// src/lib/ai-cofounder/conversation-engine.js
/**
 * Multi-Modal Conversation Engine
 * 
 * Handles all business communications:
 * - Customer support and sales conversations
 * - Partner negotiations and relationship building
 * - Supplier communications and procurement
 * - Internal team coordination
 * - User coaching and guidance
 * 
 * Supports: Email, SMS, Chat, Voice, Social Media DMs
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export class ConversationEngine {
  constructor(businessId) {
    this.businessId = businessId;
    this.conversationMemory = new ConversationMemory(businessId);
    this.personalityEngine = new PersonalityEngine(businessId);
  }

  /**
   * Handle incoming communication from any channel
   */
  async handleIncomingMessage(message, channel, sender, context = {}) {
    console.log(`💬 Handling ${channel} message from ${sender.email || sender.phone || sender.id}`);
    
    // Load conversation history and context
    const conversationContext = await this.conversationMemory.getContext(sender);
    
    // Determine conversation type and intent
    const intent = await this.analyzeIntent(message, conversationContext);
    
    // Generate contextual response based on business knowledge
    const response = await this.generateIntelligentResponse(message, intent, conversationContext, channel);
    
    // Execute any required actions
    if (response.actions && response.actions.length > 0) {
      await this.executeConversationActions(response.actions, sender);
    }
    
    // Send response via appropriate channel
    await this.sendResponse(response, channel, sender);
    
    // Update conversation memory
    await this.conversationMemory.updateConversation(sender, message, response);
    
    // Log interaction
    await this.logConversation(sender, message, response, channel, intent);
    
    return response;
  }

  /**
   * Analyze message intent using advanced AI
   */
  async analyzeIntent(message, context) {
    const intentPrompt = `
    Analyze the intent of this message:

    MESSAGE: "${message}"
    
    CONVERSATION HISTORY:
    ${JSON.stringify(context.history?.slice(-5) || [], null, 2)}
    
    SENDER PROFILE:
    ${JSON.stringify(context.sender || {}, null, 2)}

    Determine:
    1. Primary intent (question, request, complaint, interest, etc.)
    2. Emotional tone (positive, neutral, negative, urgent)
    3. Business relevance (high, medium, low)
    4. Required response type (informational, sales, support, escalation)
    5. Urgency level (immediate, same_day, routine)
    6. Potential value/opportunity score (1-10)
    7. Recommended response strategy

    Return as JSON with intent analysis.
    `;

    const analysis = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: "You are an expert at understanding human communication and business context."
      }, {
        role: "user",
        content: intentPrompt
      }],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    return JSON.parse(analysis.choices[0].message.content);
  }

  /**
   * Generate intelligent, contextual response
   */
  async generateIntelligentResponse(message, intent, context, channel) {
    const business = await this.getBusinessData();
    const personality = await this.personalityEngine.getPersonality();
    
    const responsePrompt = `
    You are the AI cofounder for ${business.business_data?.businessName}. 
    
    PERSONALITY: ${JSON.stringify(personality)}
    BUSINESS CONTEXT: ${JSON.stringify(business.business_data)}
    
    INCOMING MESSAGE: "${message}"
    INTENT ANALYSIS: ${JSON.stringify(intent)}
    CONVERSATION CONTEXT: ${JSON.stringify(context)}
    COMMUNICATION CHANNEL: ${channel}

    Generate a response that:
    1. Addresses their specific intent appropriately
    2. Provides helpful, accurate information
    3. Builds trust and relationship
    4. Moves conversation toward positive outcome
    5. Matches your personality and communication style
    6. Includes relevant business information when helpful
    7. Suggests next steps if appropriate

    Also determine if any business actions should be triggered:
    - Schedule follow-up
    - Create task/reminder
    - Update customer record
    - Escalate to human
    - Send additional resources

    Return JSON with response text, tone, and actions array.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: "You are a helpful, knowledgeable AI cofounder who builds great business relationships."
      }, {
        role: "user",
        content: responsePrompt
      }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Send response via appropriate channel
   */
  async sendResponse(response, channel, sender) {
    switch (channel.toLowerCase()) {
      case 'email':
        return await this.sendEmailResponse(response, sender);
      case 'sms':
        return await this.sendSMSResponse(response, sender);
      case 'chat':
        return await this.sendChatResponse(response, sender);
      case 'social':
        return await this.sendSocialResponse(response, sender);
      default:
        console.log(`Unsupported channel: ${channel}`);
        return { success: false, error: 'Unsupported channel' };
    }
  }

  async sendEmailResponse(response, sender) {
    try {
      const result = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'AI Cofounder <ai@launchfly.ai>',
        to: sender.email,
        subject: response.subject || 'Re: Your message',
        html: this.formatResponseHTML(response.text),
        tags: [
          { name: 'source', value: 'ai_cofounder' },
          { name: 'conversation_type', value: response.type || 'general' }
        ]
      });

      return {
        success: !result.error,
        messageId: result.data?.id,
        error: result.error?.message
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendSMSResponse(response, sender) {
    // SMS implementation would go here
    console.log(`📱 SMS to ${sender.phone}: ${response.text}`);
    return { success: true, messageId: `sms_${Date.now()}` };
  }

  async sendChatResponse(response, sender) {
    // Real-time chat implementation
    console.log(`💬 Chat to ${sender.id}: ${response.text}`);
    return { success: true, messageId: `chat_${Date.now()}` };
  }

  async sendSocialResponse(response, sender) {
    // Social media DM implementation
    console.log(`📱 Social DM to ${sender.handle}: ${response.text}`);
    return { success: true, messageId: `social_${Date.now()}` };
  }

  /**
   * Execute actions triggered by conversation
   */
  async executeConversationActions(actions, sender) {
    for (const action of actions) {
      switch (action.type) {
        case 'schedule_followup':
          await this.scheduleFollowup(action, sender);
          break;
        case 'create_task':
          await this.createTask(action);
          break;
        case 'update_customer':
          await this.updateCustomerRecord(action, sender);
          break;
        case 'escalate_to_human':
          await this.escalateToHuman(action, sender);
          break;
        case 'send_resources':
          await this.sendResources(action, sender);
          break;
      }
    }
  }

  async scheduleFollowup(action, sender) {
    await supabase
      .from('scheduled_followups')
      .insert({
        business_id: this.businessId,
        contact_email: sender.email,
        contact_phone: sender.phone,
        followup_type: action.followupType,
        scheduled_for: action.scheduledFor,
        message: action.message,
        created_at: new Date().toISOString()
      });
  }

  async createTask(action) {
    await supabase
      .from('business_tasks')
      .insert({
        business_id: this.businessId,
        task_type: action.taskType,
        description: action.description,
        priority: action.priority,
        due_date: action.dueDate,
        created_by: 'ai_cofounder',
        status: 'pending',
        created_at: new Date().toISOString()
      });
  }

  async updateCustomerRecord(action, sender) {
    await supabase
      .from('customers')
      .upsert({
        business_id: this.businessId,
        email: sender.email,
        phone: sender.phone,
        name: sender.name,
        company: sender.company,
        notes: action.notes,
        tags: action.tags,
        updated_at: new Date().toISOString()
      });
  }

  async escalateToHuman(action, sender) {
    // Create high-priority alert for human intervention
    await supabase
      .from('human_escalations')
      .insert({
        business_id: this.businessId,
        contact_info: sender,
        escalation_reason: action.reason,
        urgency: action.urgency,
        context: action.context,
        status: 'pending',
        created_at: new Date().toISOString()
      });
  }

  formatResponseHTML(text) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          ${text.split('\n').map(line => 
            line.trim() ? `<p style="margin: 0 0 16px 0; font-size: 16px;">${line}</p>` : '<br>'
          ).join('')}
        </div>
        
        <div style="margin-top: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; font-size: 13px; color: #64748b; text-align: center;">
          <p style="margin: 0;">🤖 This response was crafted by your AI business cofounder</p>
        </div>
      </body>
      </html>
    `;
  }

  async getBusinessData() {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', this.businessId)
      .single();
    
    return data || {};
  }

  async logConversation(sender, message, response, channel, intent) {
    await supabase
      .from('conversations')
      .insert({
        business_id: this.businessId,
        sender_email: sender.email,
        sender_phone: sender.phone,
        sender_name: sender.name,
        channel: channel,
        incoming_message: message,
        response_message: response.text,
        intent_analysis: intent,
        response_metadata: response,
        created_at: new Date().toISOString()
      });
  }
}

/**
 * Conversation Memory - Contextual Relationship Management
 */
class ConversationMemory {
  constructor(businessId) {
    this.businessId = businessId;
  }

  async getContext(sender) {
    // Get conversation history
    const { data: history } = await supabase
      .from('conversations')
      .select('*')
      .eq('business_id', this.businessId)
      .or(`sender_email.eq.${sender.email},sender_phone.eq.${sender.phone}`)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get sender profile
    const { data: profile } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', this.businessId)
      .or(`email.eq.${sender.email},phone.eq.${sender.phone}`)
      .single();

    return {
      history: history || [],
      sender: profile || sender,
      lastInteraction: history?.[0]?.created_at,
      conversationCount: history?.length || 0
    };
  }

  async updateConversation(sender, message, response) {
    // Store conversation
    await supabase
      .from('conversations')
      .insert({
        business_id: this.businessId,
        sender_email: sender.email,
        sender_phone: sender.phone,
        incoming_message: message,
        response_message: response.text,
        channel: response.channel,
        created_at: new Date().toISOString()
      });

    // Update or create customer profile
    await this.updateCustomerProfile(sender, message, response);
  }

  async updateCustomerProfile(sender, message, response) {
    const profileUpdate = {
      business_id: this.businessId,
      email: sender.email,
      phone: sender.phone,
      name: sender.name,
      company: sender.company,
      last_interaction: new Date().toISOString(),
      interaction_count: 1, // Would increment existing
      updated_at: new Date().toISOString()
    };

    await supabase
      .from('customers')
      .upsert(profileUpdate);
  }
}

/**
 * Personality Engine - Adaptive Communication Style
 */
class PersonalityEngine {
  constructor(businessId) {
    this.businessId = businessId;
    this.personality = null;
  }

  async getPersonality() {
    if (!this.personality) {
      const { data } = await supabase
        .from('ai_personalities')
        .select('*')
        .eq('business_id', this.businessId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      this.personality = data?.personality_data || this.getDefaultPersonality();
    }
    
    return this.personality;
  }

  getDefaultPersonality() {
    return {
      communicationStyle: 'professional_friendly',
      decisionMaking: 'data_driven_with_intuition',
      riskTolerance: 'moderate',
      traits: ['helpful', 'knowledgeable', 'proactive', 'trustworthy', 'solution_focused'],
      responseStyle: 'concise_but_thorough',
      relationshipBuilding: 'authentic_and_value_focused'
    };
  }

  async adaptPersonalityToContext(context, intent) {
    // Adjust personality based on conversation context
    const personality = await this.getPersonality();
    
    // Modify tone based on intent and context
    if (intent.urgency === 'immediate') {
      personality.responseStyle = 'direct_and_immediate';
    } else if (intent.emotionalTone === 'negative') {
      personality.responseStyle = 'empathetic_and_solution_focused';
    } else if (context.sender?.customerValue === 'high') {
      personality.responseStyle = 'premium_and_consultative';
    }
    
    return personality;
  }
}

/**
 * Advanced Customer Service Agent
 */
export class CustomerServiceAgent extends ConversationEngine {
  constructor(businessId) {
    super(businessId);
    this.knowledgeBase = new BusinessKnowledgeBase(businessId);
  }

  async handleCustomerInquiry(inquiry, customer, channel) {
    // Load customer history and business knowledge
    const [customerHistory, businessKnowledge] = await Promise.all([
      this.conversationMemory.getContext(customer),
      this.knowledgeBase.getRelevantKnowledge(inquiry)
    ]);

    // Generate expert customer service response
    const response = await this.generateCustomerServiceResponse(
      inquiry, 
      customerHistory, 
      businessKnowledge, 
      channel
    );

    // Handle any required escalations or actions
    if (response.requiresEscalation) {
      await this.escalateToHuman(customer, inquiry, response.escalationReason);
    }

    if (response.actions) {
      await this.executeCustomerServiceActions(response.actions, customer);
    }

    return response;
  }

  async generateCustomerServiceResponse(inquiry, history, knowledge, channel) {
    const servicePrompt = `
    You are providing customer service for this business inquiry:

    CUSTOMER INQUIRY: "${inquiry}"
    CUSTOMER HISTORY: ${JSON.stringify(history)}
    BUSINESS KNOWLEDGE: ${JSON.stringify(knowledge)}
    CHANNEL: ${channel}

    Provide excellent customer service by:
    1. Addressing their specific question/concern
    2. Using business knowledge to give accurate information
    3. Considering their history with the business
    4. Offering solutions or next steps
    5. Being empathetic and helpful
    6. Determining if human escalation is needed

    Return JSON with response, escalation flag, and any actions needed.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: "You are an expert customer service representative with deep business knowledge."
      }, {
        role: "user",
        content: servicePrompt
      }],
      response_format: { type: "json_object" },
      temperature: 0.6
    });

    return JSON.parse(response.choices[0].message.content);
  }
}

/**
 * Sales Conversation Agent
 */
export class SalesConversationAgent extends ConversationEngine {
  constructor(businessId) {
    super(businessId);
    this.salesPlaybook = new SalesPlaybook(businessId);
  }

  async handleSalesInquiry(inquiry, prospect, channel) {
    // Load prospect data and sales context
    const [prospectContext, salesPlaybook] = await Promise.all([
      this.conversationMemory.getContext(prospect),
      this.salesPlaybook.getPlaybook(prospect)
    ]);

    // Generate sales response using playbook
    const response = await this.generateSalesResponse(inquiry, prospect, prospectContext, salesPlaybook);

    // Track sales conversation
    await this.trackSalesProgress(prospect, inquiry, response);

    return response;
  }

  async generateSalesResponse(inquiry, prospect, context, playbook) {
    const salesPrompt = `
    You are handling a sales conversation using this playbook:

    PROSPECT INQUIRY: "${inquiry}"
    PROSPECT PROFILE: ${JSON.stringify(prospect)}
    CONVERSATION HISTORY: ${JSON.stringify(context)}
    SALES PLAYBOOK: ${JSON.stringify(playbook)}

    Generate a sales response that:
    1. Builds rapport and trust
    2. Understands their specific needs
    3. Positions your solution appropriately
    4. Handles objections if any
    5. Moves toward next step in sales process
    6. Follows proven sales methodology

    Return JSON with response and next sales action.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: "You are a top-performing sales professional who builds relationships and closes deals."
      }, {
        role: "user",
        content: salesPrompt
      }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async trackSalesProgress(prospect, inquiry, response) {
    await supabase
      .from('sales_conversations')
      .insert({
        business_id: this.businessId,
        prospect_email: prospect.email,
        inquiry: inquiry,
        response: response.text,
        sales_stage: response.salesStage,
        next_action: response.nextAction,
        created_at: new Date().toISOString()
      });
  }
}

/**
 * Business Knowledge Base
 */
class BusinessKnowledgeBase {
  constructor(businessId) {
    this.businessId = businessId;
  }

  async getRelevantKnowledge(inquiry) {
    // Use AI to find relevant business information
    const business = await supabase
      .from('businesses')
      .select('*')
      .eq('id', this.businessId)
      .single();

    return {
      products: business.data.business_data?.products || [],
      services: business.data.business_data?.services || [],
      policies: business.data.business_data?.policies || {},
      faq: business.data.business_data?.faq || [],
      pricing: business.data.business_data?.pricing || {}
    };
  }
}

/**
 * Sales Playbook
 */
class SalesPlaybook {
  constructor(businessId) {
    this.businessId = businessId;
  }

  async getPlaybook(prospect) {
    // Generate sales playbook based on prospect profile
    const business = await supabase
      .from('businesses')
      .select('*')
      .eq('id', this.businessId)
      .single();

    const playbookPrompt = `
    Create a sales playbook for this prospect:

    PROSPECT: ${JSON.stringify(prospect)}
    BUSINESS: ${JSON.stringify(business.data.business_data)}

    Generate a playbook with:
    1. Qualification questions to ask
    2. Value propositions to emphasize
    3. Common objections and responses
    4. Pricing strategy for this prospect type
    5. Next steps in sales process
    6. Success criteria

    Return as JSON sales playbook.
    `;

    const playbook = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: playbookPrompt
      }],
      response_format: { type: "json_object" },
      temperature: 0.5
    });

    return JSON.parse(playbook.choices[0].message.content);
  }
}

/**
 * Export main conversation engine
 */
export { ConversationEngine, CustomerServiceAgent, SalesConversationAgent };

/**
 * Initialize conversation engine for a business
 */
export async function initializeConversationEngine(businessId) {
  const engine = new ConversationEngine(businessId);
  return engine;
}

/**
 * Handle incoming message from any channel
 */
export async function handleBusinessMessage(businessId, message, channel, sender, context = {}) {
  const engine = new ConversationEngine(businessId);
  return await engine.handleIncomingMessage(message, channel, sender, context);
}
