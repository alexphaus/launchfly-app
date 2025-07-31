import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleSuccessfulPayment(event.data.object);
      break;
    case 'payment_intent.succeeded':
      console.log('💰 Payment succeeded:', event.data.object.id);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response('Success', { status: 200 });
}

async function handleSuccessfulPayment(session) {
  try {
    console.log('🎉 Processing successful payment:', session.id);

    const {
      business_id: businessId,
      product_id: productId,
      business_name: businessName,
      subdomain
    } = session.metadata;

    // Get customer details from Stripe
    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name;
    const amountTotal = session.amount_total / 100; // Convert from cents

    // Get business details for first sale check
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('first_sale_date, phone_number, user_id')
      .eq('id', businessId)
      .single();

    if (businessError) {
      console.error('Error fetching business:', businessError);
      return;
    }

    const isFirstSale = !business.first_sale_date;

    // Record the sale in database
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        business_id: businessId,
        product_id: productId,
        amount: amountTotal,
        currency: 'usd',
        customer_email: customerEmail,
        customer_name: customerName,
        stripe_session_id: session.id,
        payment_status: 'completed'
      })
      .select()
      .single();

    if (saleError) {
      console.error('Error recording sale:', saleError);
      return;
    }

    // Update business metrics
    const updates = {
      last_sale_date: new Date().toISOString(),
      total_revenue: business.total_revenue ? Number(business.total_revenue) + amountTotal : amountTotal
    };

    if (isFirstSale) {
      updates.first_sale_date = new Date().toISOString();
    }

    await supabase
      .from('businesses')
      .update(updates)
      .eq('id', businessId);

    // Send email notifications
    await Promise.all([
      sendCustomerConfirmation(customerEmail, customerName, session, businessName, subdomain),
      sendBusinessOwnerNotification(businessId, sale, isFirstSale, businessName),
      isFirstSale && sendFirstSaleCelebration(businessId, businessName, customerName, amountTotal, subdomain)
    ].filter(Boolean));

    console.log('✅ Payment processing completed');

  } catch (error) {
    console.error('Error processing payment:', error);
  }
}

async function sendCustomerConfirmation(email, name, session, businessName, subdomain) {
  if (!email) return;

  try {
    await resend.emails.send({
      from: `${businessName} <orders@launchfly.ai>`,
      to: email,
      subject: `🎉 Order Confirmation - ${businessName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3b82f6; margin-bottom: 10px;">Order Confirmed!</h1>
            <p style="color: #666; font-size: 18px;">Thank you for your purchase, ${name || 'valued customer'}!</p>
          </div>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1f2937; margin-top: 0;">Order Details</h2>
            <p><strong>Order ID:</strong> ${session.id}</p>
            <p><strong>Total:</strong> $${(session.amount_total / 100).toFixed(2)}</p>
            <p><strong>Business:</strong> ${businessName}</p>
          </div>
          
          <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #047857;">
              <strong>✅ Your order has been confirmed and you'll receive further instructions shortly.</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #666; margin: 0;">
              Questions? Reply to this email or visit 
              <a href="https://${subdomain}.launchfly.ai" style="color: #3b82f6;">${businessName}</a>
            </p>
          </div>
        </div>
      `
    });
    console.log('✅ Customer confirmation sent to:', email);
  } catch (error) {
    console.error('Error sending customer confirmation:', error);
  }
}

async function sendBusinessOwnerNotification(businessId, sale, isFirstSale, businessName) {
  try {
    // Get business owner email
    const { data: business, error } = await supabase
      .from('businesses')
      .select('user_id, phone_number')
      .eq('id', businessId)
      .single();

    if (error || !business.user_id) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', business.user_id)
      .single();

    if (!profile?.email) return;

    const subject = isFirstSale 
      ? `🎉 FIRST SALE! You just made $${sale.amount} with ${businessName}!`
      : `💰 New Sale! $${sale.amount} from ${businessName}`;

    await resend.emails.send({
      from: 'Launchfly <sales@launchfly.ai>',
      to: profile.email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${isFirstSale ? `
            <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
              <h1 style="margin: 0; font-size: 2.5em;">🎉 CONGRATULATIONS!</h1>
              <p style="margin: 10px 0 0 0; font-size: 1.2em; opacity: 0.95;">You just made your first sale!</p>
            </div>
          ` : `
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #10b981; margin-bottom: 10px;">💰 New Sale!</h1>
            </div>
          `}
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1f2937; margin-top: 0;">Sale Details</h2>
            <p><strong>Customer:</strong> ${sale.customer_name || 'N/A'} (${sale.customer_email || 'N/A'})</p>
            <p><strong>Amount:</strong> $${sale.amount}</p>
            <p><strong>Product:</strong> ${sale.product_id || 'N/A'}</p>
            <p><strong>Business:</strong> ${businessName}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.NEXT_PUBLIC_URL}/dashboard" 
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Dashboard →
            </a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #666; margin: 0;">
              Keep up the great work! 🚀
            </p>
          </div>
        </div>
      `
    });
    
    console.log('✅ Business owner notification sent');
  } catch (error) {
    console.error('Error sending business owner notification:', error);
  }
}

async function sendFirstSaleCelebration(businessId, businessName, customerName, amount, subdomain) {
  // This could also trigger special first-sale bonuses, social media posts, etc.
  console.log(`🎊 First sale celebration for ${businessName}: $${amount} from ${customerName}`);
  
  // You could add additional celebration logic here:
  // - Send to Slack/Discord
  // - Create social media posts
  // - Trigger special bonuses
  // - Update leaderboards
}
