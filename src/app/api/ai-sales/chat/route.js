/**
 * @fileoverview AI Sales Chat API endpoint with streaming
 * Handles chat conversations with OpenAI GPT-4o
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '../../../../lib/ai-sales/rate-limiter';
import { 
  initializeConversation, 
  processMessage, 
  generateInitialGreeting 
} from '../../../../lib/ai-sales/chat-engine';

export const runtime = 'edge';

/**
 * POST /api/ai-sales/chat
 * Process chat messages with streaming responses
 */
export async function POST(request) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (rateLimitResult) {
      return NextResponse.json(rateLimitResult, { 
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter.toString(),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.reset
        }
      });
    }

    const body = await request.json();
    const { 
      message, 
      sessionId, 
      visitorId, 
      businessId, 
      context, 
      signals 
    } = body;

    // Validate required fields
    if (!sessionId || !visitorId || !businessId) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, visitorId, businessId' },
        { status: 400 }
      );
    }

    // Get business context from database
    const businessContext = await getBusinessContext(businessId);
    if (!businessContext) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Initialize or update conversation context
    let conversationContext = context;
    if (!conversationContext) {
      conversationContext = initializeConversation({
        sessionId,
        visitorId,
        businessContext,
        signals: signals || getDefaultSignals()
      });
    }

    // Handle initial greeting request
    if (!message) {
      const greeting = generateInitialGreeting(conversationContext);
      return NextResponse.json({
        response: greeting,
        context: conversationContext,
        functionResult: null
      });
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          await processMessage({
            message,
            context: conversationContext,
            onStream: (data) => {
              // Send streaming data to client
              const chunk = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
              controller.enqueue(chunk);
            }
          });
          
          // Send final context update
          const finalData = {
            type: 'context_update',
            context: conversationContext
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`));
          
          // End stream
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          
        } catch (error) {
          console.error('Streaming error:', error);
          const errorData = {
            type: 'error',
            error: error.message
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai-sales/chat
 * Get conversation status and context
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing sessionId parameter' },
      { status: 400 }
    );
  }

  // In production, fetch from database
  // For now, return empty context
  return NextResponse.json({
    sessionId,
    hasActiveConversation: false,
    messageCount: 0,
    lastActivity: null
  });
}

/**
 * Get business context and configuration
 * @param {string} businessId - Business ID
 * @returns {Object} Business context
 */
async function getBusinessContext(businessId) {
  // In production, this would fetch from Supabase
  // For demo, return mock data
  return {
    id: businessId,
    name: 'Demo Business',
    products: [
      {
        id: 'starter',
        name: 'Starter Plan',
        description: 'Perfect for small businesses getting started',
        price: 99,
        features: ['Basic features', 'Email support', '5 users']
      },
      {
        id: 'pro',
        name: 'Pro Plan', 
        description: 'Advanced features for growing businesses',
        price: 299,
        features: ['All Starter features', 'Priority support', 'Unlimited users', 'Advanced analytics']
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Custom solution for large organizations',
        price: 999,
        features: ['All Pro features', 'Dedicated support', 'Custom integrations', 'SLA']
      }
    ],
    pricingRules: {
      basePrice: 99,
      minPrice: 49,
      maxDiscount: 30,
      allowNegotiation: true,
      approvedPaymentMethods: ['card', 'bank']
    },
    personality: 'friendly'
  };
}

/**
 * Get default visitor signals
 * @returns {Object} Default signals
 */
function getDefaultSignals() {
  return {
    mouseVelocity: 0,
    scrollDepth: 20,
    timeOnPage: 30,
    ctaHovers: 0,
    pricingViews: 0,
    exitIntent: false,
    inactivityPeriods: 0,
    viewedProducts: [],
    deviceInfo: {
      type: 'desktop',
      browser: 'chrome'
    },
    referrer: 'direct'
  };
}