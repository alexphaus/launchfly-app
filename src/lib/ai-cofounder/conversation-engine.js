/**
 * Real-time Conversation Engine
 * 
 * Enables the AI cofounder to have natural conversations with:
 * - Customers (sales, support, feedback)
 * - Providers (negotiations, partnerships)
 * - Users (strategy discussions, updates)
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { AIMemorySystem } from './memory-system.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class ConversationEngine {
  constructor(businessId) {
    this.businessId = businessId;
    this.memory = new AIMemorySystem(businessId);
    this.activeConversations = new Map();
    this.conversationStrategies = new Map();
  }

  /**
   * Start a new conversation with dynamic persona and goals
   */
  async startConversation(participant, context) {
    try {
      // Determine conversation strategy
      const strategy = await this.determineStrategy(participant, context);
      
      // Create persona for this conversation
      const persona = await this.createPersona(participant.type, context, strategy);
      
      // Initialize conversation state
      const conversationId = `${this.businessId}-${participant.id}-${Date.now()}`;
      
      const conversation = {
        id: conversationId,
        participant,
        context,
        strategy,
        persona,
        messages: [],
        state: 'active',
        goals: strategy.goals,
        startedAt: new Date().toISOString()
      };

      // Store in database
      await supabase
        .from('ai_conversations')
        .insert({
          id: conversationId,
          business_id: this.businessId,
          participant_id: participant.id,
          participant_type: participant.type,
          conversation_data: conversation,
          status: 'active',
          created_at: new Date().toISOString()
        });

      this.activeConversations.set(conversationId, conversation);
      
      // Generate opening message
      const opening = await this.generateOpening(conversation);
      
      return {
        conversationId,
        opening,
        strategy: strategy.type
      };
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw error;
    }
  }

  /**
   * Process incoming message and generate response
   */
  async processMessage(conversationId, message) {
    try {
      const conversation = this.activeConversations.get(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Add message to history
      conversation.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });

      // Analyze message intent and sentiment
      const analysis = await this.analyzeMessage(message, conversation);
      
      // Update conversation state based on analysis
      await this.updateConversationState(conversation, analysis);
      
      // Check if goals are met or need adjustment
      const goalStatus = await this.evaluateGoals(conversation);
      
      // Generate contextual response
      const response = await this.generateResponse(conversation, analysis, goalStatus);
      
      // Add response to history
      conversation.messages.push({
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        metadata: response.metadata
      });

      // Learn from this interaction
      await this.memory.remember({
        content: `Conversation with ${conversation.participant.type}: ${analysis.summary}`,
        category: 'customer_interaction',
        importance: analysis.importance,
        context: {
          conversationId,
          sentiment: analysis.sentiment,
          intent: analysis.intent,
          outcome: goalStatus
        }
      });

      // Update database
      await this.saveConversation(conversation);

      // Check if follow-up action needed
      const followUp = await this.determineFollowUp(conversation, response);

      return {
        response: response.content,
        sentiment: analysis.sentiment,
        goalProgress: goalStatus,
        followUp,
        shouldEscalate: response.metadata?.escalate || false
      };
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  /**
   * Generate response using persona and strategy
   */
  async generateResponse(conversation, analysis, goalStatus) {
    try {
      // Get relevant memories
      const memories = await this.memory.recall(
        `${conversation.participant.type} ${analysis.intent}`
      );

      // Build conversation context
      const context = this.buildConversationContext(conversation, memories);

      // Generate response with GPT-4
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are ${conversation.persona.description}.
                     
                     Your personality: ${conversation.persona.personality}
                     Your goals: ${JSON.stringify(conversation.goals)}
                     Your approach: ${conversation.strategy.approach}
                     
                     Guidelines:
                     - Be ${conversation.persona.tone}
                     - Focus on ${conversation.strategy.focus}
                     - Use ${conversation.persona.language} language
                     - ${conversation.strategy.guidelines?.join('\n- ')}`
          },
          ...context,
          {
            role: "user",
            content: `Current message: ${conversation.messages[conversation.messages.length - 1].content}
                     
                     Message analysis: ${JSON.stringify(analysis)}
                     Goal progress: ${JSON.stringify(goalStatus)}
                     
                     Generate an appropriate response that:
                     1. Addresses the user's message
                     2. Advances toward our goals
                     3. Maintains consistent persona
                     4. ${analysis.requiresAction ? 'Takes necessary action' : 'Continues conversation naturally'}`
          }
        ],
        temperature: conversation.persona.creativity || 0.7
      });

      const responseContent = response.choices[0].message.content;

      // Determine if response contains commitments or actions
      const metadata = await this.extractResponseMetadata(responseContent, conversation);

      return {
        content: responseContent,
        metadata
      };
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  /**
   * Analyze message for intent, sentiment, and key information
   */
  async analyzeMessage(message, conversation) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Analyze this message in a business conversation context."
          },
          {
            role: "user",
            content: `Message: ${message}
                     Conversation Type: ${conversation.participant.type}
                     Context: ${JSON.stringify(conversation.context)}
                     
                     Provide:
                     - Intent (question, objection, interest, complaint, etc.)
                     - Sentiment (positive, negative, neutral)
                     - Key entities and topics
                     - Urgency level (1-10)
                     - Required action (if any)
                     - Summary in one sentence`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error analyzing message:', error);
      return {
        intent: 'unknown',
        sentiment: 'neutral',
        urgency: 5,
        summary: 'Message analysis failed'
      };
    }
  }

  /**
   * Create dynamic persona based on participant and context
   */
  async createPersona(participantType, context, strategy) {
    const personas = {
      customer: {
        sales: {
          description: "A knowledgeable sales consultant",
          personality: "Helpful, enthusiastic, solution-focused",
          tone: "professional yet friendly",
          language: "clear and benefit-focused",
          creativity: 0.7
        },
        support: {
          description: "A patient support specialist",
          personality: "Empathetic, thorough, problem-solving",
          tone: "understanding and reassuring",
          language: "simple and clear",
          creativity: 0.5
        }
      },
      provider: {
        negotiation: {
          description: "A strategic business partner",
          personality: "Professional, confident, value-driven",
          tone: "respectful and collaborative",
          language: "business-oriented",
          creativity: 0.6
        }
      },
      user: {
        strategy: {
          description: "Your AI business cofounder",
          personality: "Intelligent, proactive, trustworthy",
          tone: "consultative and insightful",
          language: "strategic and data-driven",
          creativity: 0.8
        }
      }
    };

    const basePersona = personas[participantType]?.[strategy.type] || {
      description: "A helpful AI assistant",
      personality: "Professional and helpful",
      tone: "friendly",
      language: "clear",
      creativity: 0.6
    };

    // Customize based on context
    if (context.customization) {
      Object.assign(basePersona, context.customization);
    }

    return basePersona;
  }

  /**
   * Determine conversation strategy based on participant and goals
   */
  async determineStrategy(participant, context) {
    // Get historical data about this participant type
    const history = await this.getParticipantHistory(participant);
    
    // Get business goals
    const businessGoals = await this.getBusinessGoals();

    // Generate strategy
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a conversation strategist. Design optimal conversation strategies."
        },
        {
          role: "user",
          content: `Participant: ${JSON.stringify(participant)}
                   Context: ${JSON.stringify(context)}
                   History: ${JSON.stringify(history)}
                   Business Goals: ${JSON.stringify(businessGoals)}
                   
                   Create a conversation strategy with:
                   - Type (sales, support, negotiation, consultation)
                   - Specific goals for this conversation
                   - Approach and tactics
                   - Focus areas
                   - Guidelines
                   - Success metrics`
        }
      ],
      temperature: 0.6,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Evaluate progress toward conversation goals
   */
  async evaluateGoals(conversation) {
    const goals = conversation.goals || [];
    const progress = [];

    for (const goal of goals) {
      const achieved = await this.checkGoalAchievement(goal, conversation);
      progress.push({
        goal: goal.description,
        achieved,
        progress: achieved ? 100 : this.estimateGoalProgress(goal, conversation)
      });
    }

    return {
      goals: progress,
      overallProgress: progress.reduce((sum, g) => sum + g.progress, 0) / progress.length,
      allAchieved: progress.every(g => g.achieved)
    };
  }

  /**
   * Determine if follow-up action is needed
   */
  async determineFollowUp(conversation, response) {
    // Check if conversation reached a commitment or decision point
    if (response.metadata?.commitment) {
      return {
        type: 'schedule_action',
        action: response.metadata.commitment,
        timeline: response.metadata.timeline || '24_hours'
      };
    }

    // Check if escalation needed
    if (response.metadata?.escalate) {
      return {
        type: 'escalate_to_human',
        reason: response.metadata.escalateReason,
        urgency: 'high'
      };
    }

    // Check if follow-up conversation needed
    const sentiment = conversation.messages[conversation.messages.length - 2]?.sentiment;
    if (sentiment === 'negative' || conversation.strategy.type === 'sales') {
      return {
        type: 'schedule_followup',
        timeline: '48_hours',
        approach: 'check_in'
      };
    }

    return null;
  }

  /**
   * Handle multi-channel conversations (email, chat, SMS)
   */
  async handleMultiChannel(channel, data) {
    try {
      switch (channel) {
        case 'email':
          return await this.handleEmailConversation(data);
        case 'chat':
          return await this.handleChatConversation(data);
        case 'sms':
          return await this.handleSMSConversation(data);
        case 'social':
          return await this.handleSocialConversation(data);
        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }
    } catch (error) {
      console.error(`Error handling ${channel} conversation:`, error);
      throw error;
    }
  }

  /**
   * Generate proactive outreach based on triggers
   */
  async generateProactiveOutreach(trigger) {
    try {
      // Determine who to reach out to
      const targets = await this.identifyOutreachTargets(trigger);
      
      const outreachCampaigns = [];

      for (const target of targets) {
        // Create personalized message
        const message = await this.createProactiveMessage(target, trigger);
        
        // Start conversation
        const conversation = await this.startConversation(target, {
          type: 'proactive',
          trigger,
          message
        });

        outreachCampaigns.push({
          target,
          conversation,
          message,
          scheduledFor: this.calculateOptimalSendTime(target)
        });
      }

      return outreachCampaigns;
    } catch (error) {
      console.error('Error generating proactive outreach:', error);
      throw error;
    }
  }

  // Helper methods
  buildConversationContext(conversation, memories) {
    const recentMessages = conversation.messages.slice(-10);
    
    const context = [
      {
        role: "system",
        content: `Relevant context from memory: ${JSON.stringify(memories.insights)}`
      }
    ];

    // Add conversation history
    recentMessages.forEach(msg => {
      context.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    return context;
  }

  async extractResponseMetadata(response, conversation) {
    // Extract commitments, actions, or escalation needs
    const metadata = {};

    if (response.includes('I will') || response.includes("I'll")) {
      metadata.commitment = response;
      metadata.timeline = '24_hours';
    }

    if (response.includes('speak with a human') || response.includes('escalate')) {
      metadata.escalate = true;
      metadata.escalateReason = 'Complex issue requiring human intervention';
    }

    return metadata;
  }

  async updateConversationState(conversation, analysis) {
    // Update state based on analysis
    if (analysis.sentiment === 'negative' && analysis.urgency > 7) {
      conversation.state = 'urgent';
    } else if (analysis.intent === 'purchase_intent') {
      conversation.state = 'closing';
    } else if (analysis.intent === 'objection') {
      conversation.state = 'objection_handling';
    }
  }

  async saveConversation(conversation) {
    await supabase
      .from('ai_conversations')
      .update({
        conversation_data: conversation,
        last_message_at: new Date().toISOString()
      })
      .eq('id', conversation.id);
  }

  async getParticipantHistory(participant) {
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('participant_id', participant.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    return data || [];
  }

  async getBusinessGoals() {
    const { data } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', this.businessId)
      .single();
    
    return data?.business_data?.goals || [];
  }

  checkGoalAchievement(goal, conversation) {
    // Check if goal has been achieved based on conversation
    // This would be more sophisticated in production
    return false;
  }

  estimateGoalProgress(goal, conversation) {
    // Estimate progress toward goal
    return Math.random() * 100; // Placeholder
  }

  async generateOpening(conversation) {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Generate an opening message as ${conversation.persona.description}`
        },
        {
          role: "user",
          content: `Create opening for ${conversation.participant.type} with goals: ${JSON.stringify(conversation.goals)}`
        }
      ],
      temperature: 0.7
    });

    return response.choices[0].message.content;
  }

  // Channel-specific handlers
  async handleEmailConversation(data) {
    // Handle email-specific logic
    return { handled: true };
  }

  async handleChatConversation(data) {
    // Handle chat-specific logic
    return { handled: true };
  }

  async handleSMSConversation(data) {
    // Handle SMS-specific logic
    return { handled: true };
  }

  async handleSocialConversation(data) {
    // Handle social media-specific logic
    return { handled: true };
  }

  async identifyOutreachTargets(trigger) {
    // Identify who to reach out to based on trigger
    return [];
  }

  async createProactiveMessage(target, trigger) {
    // Create personalized proactive message
    return "Proactive outreach message";
  }

  calculateOptimalSendTime(target) {
    // Calculate best time to send message
    return new Date();
  }
}
