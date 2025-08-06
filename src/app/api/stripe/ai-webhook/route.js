/**
 * @fileoverview Stripe webhook handler for AI sales payments
 * Processes payment events and updates order status
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handleSuccessfulPayment } from '../../../../lib/stripe/ai-payment';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const runtime = 'nodejs';

/**
 * POST /api/stripe/ai-webhook
 * Handle Stripe webhook events
 */
export async function POST(request) {
  try {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    if (!sig || !endpointSecret) {
      console.error('Missing stripe signature or webhook secret');
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout session completion
 * @param {Object} session - Stripe checkout session object
 */
async function handleCheckoutCompleted(session) {
  try {
    console.log('Processing completed checkout:', session.id);

    // Check if this is an AI-assisted sale
    if (session.metadata?.aiAssisted === 'true') {
      // Process the successful payment
      const paymentData = await handleSuccessfulPayment(session.id);
      
      // Update conversation status
      await updateConversationStatus({
        conversationId: session.metadata.conversationId,
        status: 'converted',
        paymentData
      });

      // Track analytics event
      await trackAnalyticsEvent({
        event: 'ai_sale_completed',
        visitorId: session.metadata.visitorId,
        conversationId: session.metadata.conversationId,
        amount: session.amount_total,
        currency: session.currency,
        productId: session.metadata.productId
      });

      console.log('AI-assisted sale processed successfully:', paymentData);
    }

  } catch (error) {
    console.error('Error processing checkout completion:', error);
  }
}

/**
 * Handle successful payment intent
 * @param {Object} paymentIntent - Stripe payment intent object
 */
async function handlePaymentSucceeded(paymentIntent) {
  try {
    console.log('Payment succeeded:', paymentIntent.id);

    if (paymentIntent.metadata?.aiAssisted === 'true') {
      // Update order status
      await updateOrderStatus({
        paymentIntentId: paymentIntent.id,
        status: 'paid',
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      });

      // Send confirmation notifications
      await sendPaymentNotifications({
        paymentIntentId: paymentIntent.id,
        conversationId: paymentIntent.metadata.conversationId
      });
    }

  } catch (error) {
    console.error('Error processing payment success:', error);
  }
}

/**
 * Handle failed payment
 * @param {Object} paymentIntent - Stripe payment intent object
 */
async function handlePaymentFailed(paymentIntent) {
  try {
    console.log('Payment failed:', paymentIntent.id);

    if (paymentIntent.metadata?.aiAssisted === 'true') {
      // Update conversation with failure info
      await updateConversationStatus({
        conversationId: paymentIntent.metadata.conversationId,
        status: 'payment_failed',
        failureReason: paymentIntent.last_payment_error?.message
      });

      // Track failure event
      await trackAnalyticsEvent({
        event: 'ai_payment_failed',
        conversationId: paymentIntent.metadata.conversationId,
        amount: paymentIntent.amount,
        failureReason: paymentIntent.last_payment_error?.code
      });
    }

  } catch (error) {
    console.error('Error processing payment failure:', error);
  }
}

/**
 * Handle subscription events (for recurring AI sales)
 */
async function handleSubscriptionCreated(subscription) {
  console.log('Subscription created:', subscription.id);
  // Handle subscription creation
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Subscription updated:', subscription.id);
  // Handle subscription updates
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription deleted:', subscription.id);
  // Handle subscription cancellation
}

async function handleInvoicePaymentSucceeded(invoice) {
  console.log('Invoice payment succeeded:', invoice.id);
  // Handle recurring payment success
}

/**
 * Update conversation status in database
 * @param {Object} data - Status update data
 */
async function updateConversationStatus(data) {
  // In production, update Supabase
  console.log('Updating conversation status:', data);
  
  // Example Supabase integration:
  // const { createClient } = require('@supabase/supabase-js');
  // const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  // 
  // await supabase
  //   .from('ai_conversations')
  //   .update({
  //     status: data.status,
  //     payment_data: data.paymentData,
  //     updated_at: new Date().toISOString()
  //   })
  //   .eq('id', data.conversationId);
}

/**
 * Update order status
 * @param {Object} data - Order update data
 */
async function updateOrderStatus(data) {
  console.log('Updating order status:', data);
  
  // In production, update order in database
}

/**
 * Track analytics event
 * @param {Object} event - Event data
 */
async function trackAnalyticsEvent(event) {
  console.log('Tracking analytics event:', event);
  
  // In production, send to PostHog or similar
  // Example PostHog integration:
  // const { PostHog } = require('posthog-node');
  // const posthog = new PostHog(process.env.POSTHOG_PROJECT_API_KEY);
  // 
  // posthog.capture({
  //   distinctId: event.visitorId,
  //   event: event.event,
  //   properties: event
  // });
}

/**
 * Send payment notifications
 * @param {Object} data - Notification data
 */
async function sendPaymentNotifications(data) {
  console.log('Sending payment notifications:', data);
  
  // In production, send emails/notifications
}