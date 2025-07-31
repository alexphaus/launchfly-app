import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET() {
  try {
    // Test Stripe connection
    const account = await stripe.accounts.retrieve();
    
    return Response.json({
      success: true,
      stripe: {
        connected: true,
        accountId: account.id,
        country: account.country,
        defaultCurrency: account.default_currency
      },
      environment: {
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ? 'Set' : 'Missing',
        stripeSecretKey: process.env.STRIPE_SECRET_KEY ? 'Set' : 'Missing',
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? 'Set' : 'Missing',
        resendApiKey: process.env.RESEND_API_KEY ? 'Set' : 'Missing',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
        supabaseKey: process.env.SUPABASE_SERVICE_KEY ? 'Set' : 'Missing'
      }
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      environment: {
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ? 'Set' : 'Missing',
        stripeSecretKey: process.env.STRIPE_SECRET_KEY ? 'Set' : 'Missing',
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? 'Set' : 'Missing',
        resendApiKey: process.env.RESEND_API_KEY ? 'Set' : 'Missing',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
        supabaseKey: process.env.SUPABASE_SERVICE_KEY ? 'Set' : 'Missing'
      }
    });
  }
}
