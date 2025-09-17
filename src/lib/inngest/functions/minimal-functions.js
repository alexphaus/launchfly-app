/**
 * Minimal Inngest Functions
 * 
 * Only event-driven, revenue-focused functions
 * Replaces the expensive cron-based systems
 */

import { inngest, EVENTS } from '../client';
import { getMinimalAICofounder } from '@/lib/ai-cofounder/minimal-orchestrator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Handle Stripe checkout events
 */
export const handleCheckoutStarted = inngest.createFunction(
  {
    id: 'minimal-ai-checkout-started',
    name: 'AI Assist - Checkout Started'
  },
  { event: 'checkout.started' },
  async ({ event, step }) => {
    const { businessId, productName, price, customerEmail } = event.data;
    
    const ai = getMinimalAICofounder(businessId);
    
    const result = await step.run('assist-checkout', async () => {
      return await ai.handleRevenueEvent('checkout.started', {
        productName,
        price,
        customerEmail,
        customerType: 'prospect'
      });
    });

    return result;
  }
);

/**
 * Handle abandoned cart events
 */
export const handleCartAbandoned = inngest.createFunction(
  {
    id: 'minimal-ai-cart-abandoned',
    name: 'AI Assist - Cart Abandoned'
  },
  { event: 'cart.abandoned' },
  async ({ event, step }) => {
    const { businessId, sessionId, email, productName } = event.data;
    
    const ai = getMinimalAICofounder(businessId);
    
    const result = await step.run('handle-abandonment', async () => {
      return await ai.handleRevenueEvent('cart.abandoned', {
        sessionId,
        email,
        productName
      });
    });

    return result;
  }
);

/**
 * Handle successful payments
 */
export const handlePaymentCompleted = inngest.createFunction(
  {
    id: 'minimal-ai-payment-completed',
    name: 'AI Learn - Payment Completed'
  },
  { event: 'payment.completed' },
  async ({ event, step }) => {
    const { businessId, amount, productName, customerEmail, acquisitionChannel } = event.data;
    
    const ai = getMinimalAICofounder(businessId);
    
    const result = await step.run('learn-from-success', async () => {
      return await ai.handleRevenueEvent('payment.completed', {
        amount,
        productName,
        customerEmail,
        acquisitionChannel,
        customerType: 'buyer'
      });
    });

    return result;
  }
);

/**
 * Handle new leads
 */
export const handleLeadCaptured = inngest.createFunction(
  {
    id: 'minimal-ai-lead-captured',
    name: 'AI Assist - Lead Captured'
  },
  { event: 'lead.captured' },
  async ({ event, step }) => {
    const { businessId, name, email, interest, source } = event.data;
    
    const ai = getMinimalAICofounder(businessId);
    
    const result = await step.run('handle-new-lead', async () => {
      return await ai.handleRevenueEvent('lead.captured', {
        name,
        email,
        interest,
        source
      });
    });

    return result;
  }
);

/**
 * Handle email replies
 */
export const handleEmailReply = inngest.createFunction(
  {
    id: 'minimal-ai-email-reply',
    name: 'AI Assist - Email Reply'
  },
  { event: 'email.replied' },
  async ({ event, step }) => {
    const { businessId, from, subject, message, thread } = event.data;
    
    const ai = getMinimalAICofounder(businessId);
    
    const result = await step.run('handle-reply', async () => {
      return await ai.handleRevenueEvent('email.replied', {
        from,
        subject,
        message,
        thread
      });
    });

    return result;
  }
);

/**
 * Handle performance alerts (only when something is actually wrong)
 */
export const handlePerformanceAlert = inngest.createFunction(
  {
    id: 'minimal-ai-performance-alert',
    name: 'AI Fix - Performance Alert'
  },
  { event: 'performance.alert' },
  async ({ event, step }) => {
    const { businessId, metric, value, threshold, severity } = event.data;
    
    // Only handle high-severity alerts to avoid noise
    if (severity !== 'high') {
      return { message: 'Low severity alert ignored to save costs' };
    }
    
    const ai = getMinimalAICofounder(businessId);
    
    const result = await step.run('diagnose-issue', async () => {
      return await ai.assist({
        action: 'diagnose',
        data: {
          metric,
          value,
          threshold,
          severity
        }
      });
    });

    return result;
  }
);

/**
 * Daily budget reset (only cron job we keep)
 */
export const resetDailyBudgets = inngest.createFunction(
  {
    id: 'minimal-ai-budget-reset',
    name: 'Reset Daily AI Budgets'
  },
  { cron: '0 0 * * *' }, // Daily at midnight
  async ({ event, step }) => {
    // This is just a safety cleanup - budgets reset automatically by date
    const result = await step.run('log-budget-reset', async () => {
      console.log('Daily budget reset triggered (budgets reset automatically by date)');
      return { message: 'Budget reset logged' };
    });

    return result;
  }
);

/**
 * Export only the minimal functions
 */
export const minimalFunctions = [
  handleCheckoutStarted,
  handleCartAbandoned,
  handlePaymentCompleted,
  handleLeadCaptured,
  handleEmailReply,
  handlePerformanceAlert,
  resetDailyBudgets
];

// Helper function to trigger events from your application
export async function triggerAIEvent(eventType, data) {
  try {
    await inngest.send({
      name: eventType,
      data
    });
    console.log(`AI event triggered: ${eventType}`);
  } catch (error) {
    console.error(`Failed to trigger AI event ${eventType}:`, error);
  }
}

