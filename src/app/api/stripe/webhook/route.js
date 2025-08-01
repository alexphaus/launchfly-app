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

  // Handle successful checkout
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { businessId, businessName, productId, productName, userId, subdomain } = session.metadata;
    const amount = session.amount_total / 100;
    const customerEmail = session.customer_details.email;
    const customerName = `${session.customer_details.name || ''}`;
    const paymentStatus = session.payment_status;
    const timestamp = new Date().toISOString();
    
    console.log(`Processing successful checkout for ${businessName} - ${productName}`);

    try {
      // 1. Check if this session was already processed (idempotency)
      const { data: existingSale, error: existingError } = await supabase
        .from('sales')
        .select('id')
        .eq('stripe_session_id', session.id)
        .single();

      if (existingSale) {
        console.log(`Skipping duplicate webhook for session ${session.id}`);
        return new Response(JSON.stringify({ received: true, status: 'duplicate' }), { status: 200 });
      }

      // 2. Record the sale in the 'sales' table with detailed information
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          business_id: businessId,
          product_id: productId,
          product_name: productName,
          amount: amount,
          customer_email: customerEmail,
          customer_name: customerName,
          stripe_session_id: session.id,
          payment_status: paymentStatus,
          customer_address: JSON.stringify(session.customer_details.address || {}),
          created_at: timestamp
        })
        .select()
        .single();

      if (saleError) throw new Error(`Failed to record sale: ${saleError.message}`);

      // 3. Update business metrics
      const { data: business, error: businessFetchError } = await supabase
        .from('businesses')
        .select('total_revenue, first_sale_date, sales_count, name, user_id')
        .eq('id', businessId)
        .single();

      if (businessFetchError) throw new Error(`Failed to fetch business: ${businessFetchError.message}`);

      const newTotalRevenue = (parseFloat(business.total_revenue) || 0) + amount;
      const newSalesCount = (parseInt(business.sales_count) || 0) + 1;
      
      const updatePayload = { 
        total_revenue: newTotalRevenue,
        sales_count: newSalesCount,
        last_sale_date: timestamp
      };
      
      // Set first_sale_date if this is the first sale
      if (!business.first_sale_date) {
        updatePayload.first_sale_date = timestamp;
      }

      const { error: businessUpdateError } = await supabase
        .from('businesses')
        .update(updatePayload)
        .eq('id', businessId);

      if (businessUpdateError) throw new Error(`Failed to update business metrics: ${businessUpdateError.message}`);

      // 4. Get the business owner's email for notifications
      const { data: ownerProfile, error: ownerError } = await supabase
        .from('profiles')
        .select('email, first_name')
        .eq('id', userId)
        .single();

      if (ownerError) throw new Error(`Failed to get owner information: ${ownerError.message}`);

      const ownerFirstName = ownerProfile.first_name || 'there';
      const siteUrl = `${process.env.NEXT_PUBLIC_URL}/sites/${subdomain}`;
      const dashboardUrl = `${process.env.NEXT_PUBLIC_URL}/dashboard/${sale.session_id}`;
      
      // 5. Send email to customer
      const customerReceiptEmail = await resend.emails.send({
        from: `${businessName} <orders@launchfly.ai>`,
        to: customerEmail,
        subject: `Your Order is Confirmed - ${productName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 20px 0;">
              <h1 style="color: #4F46E5;">Thank You For Your Purchase!</h1>
            </div>
            
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h2 style="color: #111827; margin-top: 0;">Order Summary</h2>
              <p><strong>Product:</strong> ${productName}</p>
              <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
              <p><strong>Date:</strong> ${new Date(timestamp).toLocaleString()}</p>
              <p><strong>Order ID:</strong> ${sale.id}</p>
            </div>
            
            <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
              <h2 style="color: #111827; margin-top: 0;">What's Next?</h2>
              <p>If your purchase includes digital products, you'll receive access instructions shortly.</p>
              <p>If you have any questions about your order, please contact us.</p>
            </div>
            
            <div style="text-align: center; padding: 20px 0; color: #6B7280; font-size: 14px;">
              <p>Thank you for supporting ${businessName}!</p>
              <p><a href="${siteUrl}" style="color: #4F46E5; text-decoration: none;">Visit our website</a></p>
            </div>
          </div>
        `
      });

      // 6. Send celebration email to business owner
      const isFirstSale = !business.first_sale_date || business.first_sale_date === timestamp;
      
      const ownerNotificationEmail = await resend.emails.send({
        from: 'Launchfly <sales@launchfly.ai>',
        to: ownerProfile.email,
        subject: isFirstSale ? '🎉 Congratulations on Your First Sale!' : '💰 You Just Made a Sale!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 20px 0;">
              <h1 style="color: #4F46E5;">${isFirstSale ? 'You Made Your First Sale!' : 'You Just Made a Sale!'}</h1>
              <p style="font-size: 48px;">🎉</p>
            </div>
            
            <div style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #bae6fd;">
              <h2 style="color: #0369a1; margin-top: 0;">Sale Details</h2>
              <p><strong>Product:</strong> ${productName}</p>
              <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
              <p><strong>Customer:</strong> ${customerEmail}</p>
              <p><strong>Date:</strong> ${new Date(timestamp).toLocaleString()}</p>
            </div>
            
            ${isFirstSale ? `
            <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #fecaca;">
              <h2 style="color: #b91c1c; margin-top: 0;">First Sale Milestone Reached! 🏆</h2>
              <p>This is just the beginning! Now that you've proven your business model works, it's time to scale up.</p>
              <p>Check your dashboard to see your growth metrics and next steps.</p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Your Dashboard</a>
            </div>
            
            <div style="text-align: center; padding: 20px 0; color: #6B7280; font-size: 14px;">
              <p>Keep up the great work!</p>
              <p>The Launchfly Team</p>
            </div>
          </div>
        `
      });
      
      console.log(`Successfully processed payment for ${businessName} - ${productName}`);
      
    } catch (error) {
      console.error('Webhook handler error:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
  
  // Handle other event types if needed
  // else if (event.type === 'payment_intent.succeeded') {
  //   // Handle payment_intent.succeeded event
  // }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
