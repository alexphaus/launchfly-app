import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  const body = await request.text();
  const signature = headers().get('stripe-signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook signature verification failed.`, err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { businessId, productId, productName, userId } = session.metadata;
    const amount = session.amount_total / 100;
    const customerEmail = session.customer_details.email;

    try {
      // 1. Record the sale in a new 'sales' table
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          business_id: businessId,
          product_id: productId,
          product_name: productName,
          amount: amount,
          customer_email: customerEmail,
          stripe_session_id: session.id,
        })
        .select()
        .single();

      if (saleError) throw new Error(`Failed to record sale: ${saleError.message}`);

      // 2. Update business metrics
      const { data: business, error: businessFetchError } = await supabase
        .from('businesses')
        .select('total_revenue, first_sale_date')
        .eq('id', businessId)
        .single();

      if (businessFetchError) throw new Error(`Failed to fetch business: ${businessFetchError.message}`);

      const newTotalRevenue = (business.total_revenue || 0) + amount;
      const updatePayload = { total_revenue: newTotalRevenue };
      if (!business.first_sale_date) {
        updatePayload.first_sale_date = new Date().toISOString();
      }

      const { error: businessUpdateError } = await supabase
        .from('businesses')
        .update(updatePayload)
        .eq('id', businessId);

      if (businessUpdateError) throw new Error(`Failed to update business metrics: ${businessUpdateError.message}`);

      // 3. Send emails
      const { data: ownerProfile, error: ownerError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (ownerError) throw new Error(`Failed to get owner email: ${ownerError.message}`);

      // Email to buyer
      await resend.emails.send({
        from: 'Launchfly <noreply@launchfly.ai>',
        to: customerEmail,
        subject: 'Your Order is Confirmed!',
        html: `<p>Thank you for your purchase of ${productName}. We've received your order and will process it shortly.</p>`,
      });

      // Email to business owner
      await resend.emails.send({
        from: 'Launchfly <congrats@launchfly.ai>',
        to: ownerProfile.email,
        subject: '🎉 You just made a sale!',
        html: `<p>Congratulations! You just sold ${productName} for $${amount}. Keep up the great work!</p>`,
      });

    } catch (error) {
      console.error('Webhook handler error:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
