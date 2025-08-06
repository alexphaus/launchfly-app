/**
 * @fileoverview Core chat engine for AI Sales Agent
 * Handles conversation flow, context management, and streaming
 */

import openai, { AI_CONFIG } from './openai-client';
import { generateSystemPrompt, generateOpener } from './prompts';
import { availableFunctions, processFunctionCall } from './tools';

/**
 * @typedef {import('../../types/ai-sales').AIAgentContext} AIAgentContext
 * @typedef {import('../../types/ai-sales').Message} Message
 * @typedef {import('../../types/ai-sales').VisitorSignals} VisitorSignals
 */

/**
 * Initialize a new conversation
 * @param {Object} params - Initialization parameters
 * @param {string} params.sessionId - Session ID
 * @param {string} params.visitorId - Visitor ID
 * @param {Object} params.businessContext - Business information
 * @param {VisitorSignals} params.signals - Visitor behavior signals
 * @returns {AIAgentContext} Initialized context
 */
export function initializeConversation(params) {
  const { sessionId, visitorId, businessContext, signals } = params;
  
  // Calculate initial intent score
  const intentScore = calculateIntentScore(signals);
  
  // Determine stage based on signals
  const stage = determineStage(intentScore, signals);
  
  return {
    sessionId,
    visitorId,
    signals,
    intentScore,
    stage,
    businessContext,
    conversationHistory: [],
    currentOffer: null
  };
}

/**
 * Calculate intent score from visitor signals
 * @param {VisitorSignals} signals - Visitor behavior data
 * @returns {number} Intent score (0-100)
 */
export function calculateIntentScore(signals) {
  const weights = {
    scrollDepth: 0.15,
    timeOnPage: 0.2,
    ctaHovers: 0.25,
    pricingViews: 0.3,
    exitIntent: 0.1
  };
  
  let score = 0;
  
  // Scroll depth contribution
  score += (signals.scrollDepth / 100) * weights.scrollDepth * 100;
  
  // Time on page (max contribution at 120 seconds)
  score += Math.min(signals.timeOnPage / 120, 1) * weights.timeOnPage * 100;
  
  // CTA hovers (max contribution at 5 hovers)
  score += Math.min(signals.ctaHovers / 5, 1) * weights.ctaHovers * 100;
  
  // Pricing views (max contribution at 3 views)
  score += Math.min(signals.pricingViews / 3, 1) * weights.pricingViews * 100;
  
  // Exit intent flag
  if (signals.exitIntent) {
    score += weights.exitIntent * 100;
  }
  
  return Math.round(Math.min(score, 100));
}

/**
 * Determine conversation stage from intent score
 * @param {number} intentScore - Calculated intent score
 * @param {VisitorSignals} signals - Visitor signals
 * @returns {string} Conversation stage
 */
export function determineStage(intentScore, signals) {
  if (signals.exitIntent || intentScore > 80) {
    return 'decision';
  } else if (intentScore > 60 || signals.pricingViews > 1) {
    return 'consideration';
  } else if (intentScore > 30) {
    return 'awareness';
  }
  return 'awareness';
}

/**
 * Process a chat message and generate AI response
 * @param {Object} params - Message parameters
 * @param {string} params.message - User message
 * @param {AIAgentContext} params.context - Current conversation context
 * @param {Function} params.onStream - Streaming callback
 * @returns {Object} Response data with any function calls
 */
export async function processMessage({ message, context, onStream }) {
  // Add user message to history
  const userMessage = {
    role: 'user',
    content: message,
    timestamp: Date.now()
  };
  
  context.conversationHistory.push(userMessage);
  
  // Prepare messages for OpenAI
  const messages = [
    {
      role: 'system',
      content: generateSystemPrompt(context.businessContext)
    },
    ...context.conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  ];
  
  try {
    // Create streaming completion
    const stream = await openai.chat.completions.create({
      ...AI_CONFIG,
      messages,
      functions: availableFunctions,
      function_call: 'auto'
    });
    
    let fullResponse = '';
    let functionCall = null;
    
    // Process stream
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (delta?.content) {
        fullResponse += delta.content;
        // Stream content to client
        onStream?.({
          type: 'content',
          content: delta.content
        });
      }
      
      if (delta?.function_call) {
        if (!functionCall) {
          functionCall = {
            name: delta.function_call.name || '',
            arguments: ''
          };
        }
        if (delta.function_call.arguments) {
          functionCall.arguments += delta.function_call.arguments;
        }
      }
    }
    
    // Process any function calls
    let functionResult = null;
    if (functionCall) {
      try {
        const args = JSON.parse(functionCall.arguments);
        functionResult = await processFunctionCall(
          functionCall.name,
          args,
          context
        );
        
        // Stream function result
        onStream?.({
          type: 'function_call',
          functionCall: functionCall.name,
          result: functionResult
        });
      } catch (error) {
        console.error('Function call error:', error);
      }
    }
    
    // Add assistant response to history
    const assistantMessage = {
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now(),
      metadata: {
        intentStage: context.stage,
        functionCall: functionCall ? functionCall.name : null
      }
    };
    
    context.conversationHistory.push(assistantMessage);
    
    // Update context stage based on conversation progress
    updateContextStage(context);
    
    return {
      response: fullResponse,
      functionResult,
      updatedContext: context
    };
    
  } catch (error) {
    console.error('AI processing error:', error);
    throw error;
  }
}

/**
 * Update conversation stage based on progress
 * @param {AIAgentContext} context - Current context
 */
function updateContextStage(context) {
  const messageCount = context.conversationHistory.length;
  const hasDiscussedPricing = context.conversationHistory.some(
    msg => msg.content.toLowerCase().includes('price') || 
           msg.content.toLowerCase().includes('cost')
  );
  const hasOfferActive = context.currentOffer !== null;
  
  // Progress stage based on conversation
  if (context.stage === 'awareness' && messageCount > 4) {
    context.stage = 'consideration';
  } else if (context.stage === 'consideration' && (hasDiscussedPricing || hasOfferActive)) {
    context.stage = 'decision';
  } else if (messageCount > 10 && !hasOfferActive) {
    context.stage = 'decision';
  }
}

/**
 * Generate initial AI greeting
 * @param {AIAgentContext} context - Conversation context
 * @returns {string} Opening message
 */
export function generateInitialGreeting(context) {
  return generateOpener(context.signals);
}

/**
 * Check if conversation should end
 * @param {AIAgentContext} context - Current context
 * @returns {boolean} Whether to end conversation
 */
export function shouldEndConversation(context) {
  const lastMessages = context.conversationHistory.slice(-3);
  const hasGoodbye = lastMessages.some(
    msg => msg.content.toLowerCase().match(/bye|goodbye|thanks|thank you|later/)
  );
  const inactiveTime = Date.now() - lastMessages[lastMessages.length - 1]?.timestamp;
  
  return hasGoodbye || inactiveTime > 600000; // 10 minutes
}