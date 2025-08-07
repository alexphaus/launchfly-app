// app/api/checkout/route.js
// One-click Stripe checkout for AI Sales Agent

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { 
      productName, 
      productPrice, 
      discountCode, 
      businessId, 
      subdomain,
      chatHistory 
    } = await req.json();

    // Enhanced discount codes with higher conversions
    const discounts = {
      'SAVE20': 20,
      'SAVE40': 40,
      'CHAT20': 20,
      'EXIT40': 40,
      'WELCOME20': 20,
      'SPECIAL30': 30,
      'LAUNCH20': 20,
      'DONTGO30': 30,
      'COMEBACK15': 15,
      'READY25': 25
    };

    let finalPrice = productPrice;
    let discountAmount = 0;
    
    if (discountCode && discounts[discountCode]) {
      const discountPercent = discounts[discountCode];
      discountAmount = productPrice * (discountPercent / 100);
      finalPrice = productPrice - discountAmount;
    }

    // Create enhanced Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            description: discountCode ? 
              `🎉 AI Agent Special: ${discountCode} applied (${discounts[discountCode]}% off)` : 
              '🤖 Recommended by AI Sales Agent',
            images: ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400'], // Professional image
          },
          unit_amount: Math.round(finalPrice * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      
      // Enhanced success/cancel URLs
      success_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'http://localhost:3000'}/sites/${subdomain}/success?session_id={CHECKOUT_SESSION_ID}&ai_assisted=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'http://localhost:3000'}/sites/${subdomain}?cancelled=true&discount=${discountCode}`,
      
      // Enhanced metadata for tracking
      metadata: {
        business_id: businessId || 'unknown',
        ai_chat_messages: chatHistory || '0',
        discount_code: discountCode || 'none',
        source: 'ai_sales_agent',
        original_price: productPrice.toString(),
        discount_amount: discountAmount.toString(),
        conversion_type: 'ai_assisted'
      },
      
      // Conversion optimizations
      billing_address_collection: 'auto',
      phone_number_collection: {
        enabled: true
      },
      
      // Allow promotion codes for additional discounts
      allow_promotion_codes: true,
      
      // Faster checkout
      submit_type: 'pay',
      
      // Customer details
      customer_creation: 'always',
      
      // Payment method options
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
        },
      },
      
      // Shipping for physical products (if needed)
      // shipping_address_collection: {
      //   allowed_countries: ['US', 'CA'],
      // },
    });

    // Track successful checkout session creation
    console.log('AI Sales Agent Checkout Created:', {
      sessionId: session.id,
      productName,
      originalPrice: productPrice,
      finalPrice,
      discountCode,
      discountAmount,
      businessId,
      chatMessages: chatHistory
    });

    return Response.json({ 
      url: session.url,
      sessionId: session.id,
      originalPrice: productPrice,
      finalPrice,
      discountApplied: discounts[discountCode] || 0,
      discountAmount
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    
    // Fallback response with alternative options
    return Response.json(
      { 
        error: 'Checkout temporarily unavailable',
        message: 'Please try again in a moment, or contact support for immediate assistance.',
        fallbackOptions: {
          email: 'support@example.com',
          phone: '+1-555-0123',
          directLink: `https://buy.stripe.com/fallback-link`
        }
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve checkout session details and status
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return Response.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Retrieve session with expanded data
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'payment_intent']
    });
    
    return Response.json({
      status: session.payment_status,
      customerEmail: session.customer_details?.email,
      customerPhone: session.customer_details?.phone,
      amountTotal: session.amount_total,
      currency: session.currency,
      metadata: session.metadata,
      paymentIntentStatus: session.payment_intent?.status,
      created: session.created
    });

  } catch (error) {
    console.error('Session retrieval error:', error);
    
    return Response.json(
      { error: 'Failed to retrieve session details' },
      { status: 500 }
    );
  }
}
