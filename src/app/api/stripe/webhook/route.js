import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleSuccessfulPayment(session);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response('Success', { status: 200 });
}

async function handleSuccessfulPayment(session) {
  try {
    const { businessId, productName, businessName, businessSubdomain } = session.metadata;
    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name;
    const amountPaid = session.amount_total / 100; // Convert from cents

    console.log('Processing successful payment:', {
      businessId,
      productName,
      customerEmail,
      amountPaid
    });

    // Update business with sale information
    const { data: business } = await supabase
      .from('businesses')
      .select('total_revenue, first_sale_date')
      .eq('id', businessId)
      .single();

    const isFirstSale = !business?.first_sale_date;

    await supabase
      .from('businesses')
      .update({
        total_revenue: (business?.total_revenue || 0) + amountPaid,
        first_sale_date: isFirstSale ? new Date().toISOString() : business.first_sale_date
      })
      .eq('id', businessId);

    // Record the sale
    await supabase
      .from('sales')
      .insert({
        business_id: businessId,
        customer_email: customerEmail,
        customer_name: customerName,
        product_name: productName,
        amount: amountPaid,
        stripe_session_id: session.id,
        created_at: new Date().toISOString()
      });

    // Send email notification to business owner
    const { data: businessOwner } = await supabase
      .from('businesses')
      .select('form_data')
      .eq('id', businessId)
      .single();

    const ownerEmail = businessOwner?.form_data?.email;
    const ownerName = businessOwner?.form_data?.name || 'Business Owner';

    if (ownerEmail) {
      await sendSaleNotificationEmail({
        ownerEmail,
        ownerName,
        businessName,
        customerName,
        customerEmail,
        productName,
        amountPaid,
        isFirstSale,
        businessSubdomain
      });
    }

  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

async function sendSaleNotificationEmail({
  ownerEmail,
  ownerName,
  businessName,
  customerName,
  customerEmail,
  productName,
  amountPaid,
  isFirstSale,
  businessSubdomain
}) {
  const subject = isFirstSale 
    ? `🎉 ${ownerName}, you made your FIRST SALE! $${amountPaid}`
    : `💰 New Sale: $${amountPaid} from ${businessName}`;

  const congratsMessage = isFirstSale
    ? `
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
        <h2 style="color: white; margin: 0; font-size: 24px;">🎉 CONGRATULATIONS! 🎉</h2>
        <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">You just made your FIRST SALE!</p>
      </div>
    `
    : '';

  await resend.emails.send({
    from: 'Launchfly <sales@launchfly.ai>',
    to: ownerEmail,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${congratsMessage}
        
        <h1 style="color: #1f2937;">New Sale Alert! 💰</h1>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Sale Details:</h3>
          <p><strong>Product:</strong> ${productName}</p>
          <p><strong>Amount:</strong> $${amountPaid}</p>
          <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
          <p><strong>Business:</strong> ${businessName}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        ${isFirstSale ? `
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;"><strong>🔥 This is just the beginning!</strong> Your business is now proven and profitable. Keep promoting and watch the sales roll in!</p>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/${businessSubdomain}" 
             style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Your Website
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; text-align: center;">
          Keep up the great work! Every sale brings you closer to your goals.
        </p>
      </div>
    `
  });
}
