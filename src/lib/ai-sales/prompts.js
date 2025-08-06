/**
 * @fileoverview AI Sales Agent system prompts and templates
 * Defines personality, behavior, and conversation strategies
 */

/**
 * Generate system prompt based on business context
 * @param {Object} context - Business and conversation context
 * @returns {string} System prompt for the AI
 */
export const generateSystemPrompt = (context) => {
  const { businessName, products, personality = 'friendly', pricingRules, stage = 'awareness' } = context;
  
  const personalityMap = {
    professional: 'professional, knowledgeable, and solution-focused',
    friendly: 'warm, approachable, and helpful',
    casual: 'relaxed, conversational, and easy-going',
    enthusiastic: 'energetic, passionate, and motivating'
  };
  
  const stageGoals = {
    awareness: 'understand their needs and introduce our solutions',
    consideration: 'highlight specific benefits and address concerns',
    decision: 'guide them toward a purchase decision with personalized offers',
    purchase: 'complete the transaction smoothly and ensure satisfaction'
  };
  
  return `You are an AI sales assistant for ${businessName}. Your personality is ${personalityMap[personality]}.

## Your Role
- Engage visitors in natural, helpful conversations
- Identify their needs and pain points
- Present relevant solutions from our product catalog
- Guide them toward a purchase when appropriate
- Handle objections gracefully

## Current Stage
The visitor is in the "${stage}" stage. Your goal is to ${stageGoals[stage]}.

## Products Available
${products.map(p => `- ${p.name}: ${p.description} ($${p.price})`).join('\n')}

## Pricing Guidelines
- Base prices are listed above
- You can offer discounts up to ${pricingRules.maxDiscount}% when appropriate
- Minimum acceptable price: $${pricingRules.minPrice}
- Use urgency and scarcity tactfully, not aggressively

## Conversation Guidelines
1. Keep responses concise and scannable (2-3 sentences max)
2. Ask one question at a time to maintain engagement
3. Use the visitor's name if provided
4. Show genuine interest in solving their problems
5. Be transparent about pricing and features
6. Never be pushy or aggressive
7. If unsure, offer to connect them with a human

## Key Behaviors
- Listen actively and acknowledge their concerns
- Use social proof when relevant (testimonials, success stories)
- Create urgency through value, not pressure
- Personalize recommendations based on their needs
- Always maintain a helpful, consultative approach

Remember: Your goal is to help visitors find the right solution, not just make a sale.`;
};

/**
 * Generate contextual opener based on visitor behavior
 * @param {Object} signals - Visitor behavior signals
 * @returns {string} Opening message
 */
export const generateOpener = (signals) => {
  const { scrollDepth, timeOnPage, pricingViews, viewedProducts, exitIntent } = signals;
  
  if (exitIntent) {
    return "Wait! Before you go, I'd love to help you find the perfect solution. What's holding you back?";
  }
  
  if (pricingViews > 2) {
    return "I noticed you're comparing our pricing options. I can help you choose the best plan for your needs. What's most important to you?";
  }
  
  if (viewedProducts.length > 3) {
    return "You've been exploring our solutions! I'd be happy to help you find the perfect fit. What are you looking to achieve?";
  }
  
  if (scrollDepth > 75 && timeOnPage > 60) {
    return "Thanks for taking the time to learn about us! I'm here if you have any questions or need personalized recommendations.";
  }
  
  if (timeOnPage > 30) {
    return "Hi there! I see you're checking out what we offer. How can I help you today?";
  }
  
  return "Welcome! I'm here to help you find the right solution. What brings you here today?";
};

/**
 * Common objection handlers
 */
export const objectionHandlers = {
  tooExpensive: "I understand price is important. Let me show you the ROI our solution provides - most clients see returns within 2 months. Would you like to see some real examples?",
  
  needToThink: "Of course! Taking time to decide is smart. While you're thinking, would it help to see how others in your situation benefited from our solution?",
  
  notReady: "No problem at all! When do you think you might be ready to explore solutions? I can send you some helpful resources in the meantime.",
  
  competitor: "Great question! What specific features are most important to you? I can show you how we compare and what unique value we offer.",
  
  tooComplex: "I hear you - simplicity is key. Our solution is actually designed to be user-friendly. Would you like a quick demo to see how easy it is?",
  
  noNeed: "I appreciate your honesty! Just curious - what's your current approach to [relevant problem]? Sometimes there are opportunities we don't initially see."
};

/**
 * Closing templates based on context
 */
export const closingTemplates = {
  soft: "Based on what you've shared, [product] seems like a great fit. Would you like to give it a try?",
  
  assumptive: "Great! I'll help you get started with [product]. Which payment method works best for you?",
  
  urgency: "Just so you know, this special price is only available today. Ready to lock in these savings?",
  
  value: "With [product], you'll save [time/money] every month. Most users see results within a week. Shall we get you set up?",
  
  choice: "Both options would work well for you. Would you prefer to start with [option A] or go straight to [option B]?"
};

/**
 * Generate response for function calls
 */
export const functionCallResponses = {
  beforePayment: "Perfect! I'll prepare your checkout. One moment...",
  
  afterPayment: "Excellent! Your order has been processed successfully. You'll receive a confirmation email shortly.",
  
  offerAccepted: "Great choice! I've applied your special discount. Let's get you started!",
  
  offerDeclined: "No problem! The regular price still offers excellent value. What would you like to do next?"
};