/**
 * @fileoverview Stripe payment processing for AI Sales Agent
 * Handles checkout sessions and payment processing
 */

import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

/**
 * Create a checkout session for AI-initiated purchases
 * @param {Object} params - Payment parameters
 * @param {string} params.productId - Product ID
 * @param {string} params.productName - Product name
 * @param {number} params.unitPrice - Unit price in dollars
 * @param {number} params.finalPrice - Final price after discounts
 * @param {number} params.quantity - Quantity
 * @param {string} params.customerEmail - Customer email
 * @param {Object} params.metadata - Additional metadata
 * @returns {Object} Checkout session data
 */
export async function createAICheckoutSession(params) {
  const {
    productId,
    productName,
    unitPrice,
    finalPrice,
    quantity = 1,
    customerEmail,
    metadata = {}
  } = params;

  try {
    // Create line items
    const lineItems = [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: productName,
          metadata: {
            productId,
            aiAssisted: 'true'
          }
        },
        unit_amount: Math.round(finalPrice * 100), // Convert to cents
      },
      quantity,
    }];

    // Add discount line item if applicable
    if (finalPrice < unitPrice) {
      const discountAmount = (unitPrice - finalPrice) * quantity;
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'AI Assistant Discount',
            metadata: {
              discountType: 'ai_negotiated'
            }
          },
          unit_amount: -Math.round(discountAmount * 100), // Negative for discount
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,
      customer_email: customerEmail,
      metadata: {
        productId,
        aiAssisted: 'true',
        conversationId: metadata.conversationId || '',
        visitorId: metadata.visitorId || '',
        discountApplied: finalPrice < unitPrice ? 'true' : 'false',
        ...metadata
      },
      payment_intent_data: {
        metadata: {
          productId,
          aiAssisted: 'true',
          conversationId: metadata.conversationId || ''
        }
      },
      // Enable billing address collection for business customers
      billing_address_collection: 'auto',
      // Configure UI
      custom_text: {
        submit: {
          message: 'Complete your AI-assisted purchase'
        }
      }
    });

    return {
      sessionId: session.id,
      url: session.url,
      paymentIntentId: session.payment_intent,
      customerId: session.customer,
      amount: finalPrice * 100,
      currency: 'usd'
    };

  } catch (error) {
    console.error('Stripe checkout session creation failed:', error);
    throw new Error(`Payment session creation failed: ${error.message}`);
  }
}

/**
 * Create a Payment Intent for embedded checkout
 * @param {Object} params - Payment parameters
 * @returns {Object} Payment intent data
 */
export async function createPaymentIntent(params) {
  const {
    amount, // Amount in cents
    currency = 'usd',
    customerEmail,
    metadata = {}
  } = params;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ['card'],
      metadata: {
        aiAssisted: 'true',
        ...metadata
      },
      receipt_email: customerEmail,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency
    };

  } catch (error) {
    console.error('Payment intent creation failed:', error);
    throw new Error(`Payment intent creation failed: ${error.message}`);
  }
}

/**
 * Handle successful payment
 * @param {string} sessionId - Checkout session ID
 * @returns {Object} Payment details
 */
export async function handleSuccessfulPayment(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'customer']
    });

    if (session.payment_status === 'paid') {
      // Process successful payment
      const paymentData = {
        sessionId: session.id,
        paymentIntentId: session.payment_intent.id,
        amount: session.amount_total,
        currency: session.currency,
        customerEmail: session.customer_details.email,
        customerName: session.customer_details.name,
        metadata: session.metadata,
        status: 'completed',
        paidAt: new Date().toISOString()
      };

      // Store payment record in database
      await storePaymentRecord(paymentData);

      // Send confirmation email
      await sendPaymentConfirmation(paymentData);

      return paymentData;
    } else {
      throw new Error('Payment not completed');
    }

  } catch (error) {
    console.error('Payment processing failed:', error);
    throw error;
  }
}

/**
 * Store payment record in database
 * @param {Object} paymentData - Payment data to store
 */
async function storePaymentRecord(paymentData) {
  // In production, store in Supabase
  console.log('Storing payment record:', paymentData);
  
  // Example Supabase integration:
  // const { createClient } = require('@supabase/supabase-js');
  // const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  // 
  // await supabase
  //   .from('ai_sales_payments')
  //   .insert({
  //     session_id: paymentData.sessionId,
  //     payment_intent_id: paymentData.paymentIntentId,
  //     amount: paymentData.amount,
  //     currency: paymentData.currency,
  //     customer_email: paymentData.customerEmail,
  //     customer_name: paymentData.customerName,
  //     metadata: paymentData.metadata,
  //     status: paymentData.status,
  //     paid_at: paymentData.paidAt
  //   });
}

/**
 * Send payment confirmation email
 * @param {Object} paymentData - Payment data
 */
async function sendPaymentConfirmation(paymentData) {
  // In production, send via Resend or similar
  console.log('Sending confirmation email to:', paymentData.customerEmail);
  
  // Example Resend integration:
  // const { Resend } = require('resend');
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // 
  // await resend.emails.send({
  //   from: 'sales@yourcompany.com',
  //   to: paymentData.customerEmail,
  //   subject: 'Payment Confirmation - Thank You!',
  //   html: generateConfirmationEmail(paymentData)
  // });
}

/**
 * Retrieve payment session details
 * @param {string} sessionId - Checkout session ID
 * @returns {Object} Session details
 */
export async function getPaymentSession(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      id: session.id,
      paymentStatus: session.payment_status,
      amount: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_details?.email,
      metadata: session.metadata
    };
  } catch (error) {
    console.error('Failed to retrieve payment session:', error);
    throw error;
  }
}

/**
 * Refund a payment
 * @param {string} paymentIntentId - Payment intent ID
 * @param {number} amount - Amount to refund (optional, full refund if not specified)
 * @returns {Object} Refund details
 */
export async function refundPayment(paymentIntentId, amount = null) {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amount && { amount })
    });

    return {
      id: refund.id,
      amount: refund.amount,
      status: refund.status,
      reason: refund.reason
    };
  } catch (error) {
    console.error('Refund failed:', error);
    throw error;
  }
}