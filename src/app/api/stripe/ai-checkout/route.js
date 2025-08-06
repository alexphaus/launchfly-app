/**
 * @fileoverview Stripe AI checkout API endpoint
 * Creates checkout sessions for AI-initiated purchases
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAICheckoutSession, createPaymentIntent } from '../../../../lib/stripe/ai-payment';
import { checkRateLimit } from '../../../../lib/ai-sales/rate-limiter';

export const runtime = 'nodejs';

/**
 * POST /api/stripe/ai-checkout
 * Create checkout session for AI sales
 */
export async function POST(request) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (rateLimitResult) {
      return NextResponse.json(rateLimitResult, { status: 429 });
    }

    const body = await request.json();
    const {
      type = 'checkout', // 'checkout' or 'payment_intent'
      productId,
      productName,
      unitPrice,
      finalPrice,
      quantity = 1,
      customerEmail,
      customerName,
      metadata = {}
    } = body;

    // Validate required fields
    if (!productId || !productName || !unitPrice || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, productName, unitPrice, customerEmail' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate pricing
    if (finalPrice > unitPrice) {
      return NextResponse.json(
        { error: 'Final price cannot exceed unit price' },
        { status: 400 }
      );
    }

    if (finalPrice <= 0) {
      return NextResponse.json(
        { error: 'Final price must be greater than 0' },
        { status: 400 }
      );
    }

    // Create session based on type
    if (type === 'payment_intent') {
      // For embedded checkout
      const paymentIntent = await createPaymentIntent({
        amount: Math.round(finalPrice * quantity * 100), // Convert to cents
        customerEmail,
        metadata: {
          productId,
          productName,
          unitPrice: unitPrice.toString(),
          finalPrice: finalPrice.toString(),
          quantity: quantity.toString(),
          customerName,
          ...metadata
        }
      });

      return NextResponse.json({
        type: 'payment_intent',
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      });

    } else {
      // For hosted checkout
      const session = await createAICheckoutSession({
        productId,
        productName,
        unitPrice,
        finalPrice,
        quantity,
        customerEmail,
        metadata: {
          customerName,
          ...metadata
        }
      });

      return NextResponse.json({
        type: 'checkout',
        sessionId: session.sessionId,
        url: session.url,
        amount: session.amount,
        currency: session.currency
      });
    }

  } catch (error) {
    console.error('AI checkout error:', error);
    
    // Return appropriate error response
    if (error.message.includes('Invalid API key')) {
      return NextResponse.json(
        { error: 'Payment service configuration error' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Payment processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stripe/ai-checkout
 * Get checkout session status
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

  try {
    const { getPaymentSession } = await import('../../../../lib/stripe/ai-payment');
    const session = await getPaymentSession(sessionId);

    return NextResponse.json({
      sessionId: session.id,
      status: session.paymentStatus,
      amount: session.amount,
      currency: session.currency,
      customerEmail: session.customerEmail,
      metadata: session.metadata
    });

  } catch (error) {
    console.error('Session retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}