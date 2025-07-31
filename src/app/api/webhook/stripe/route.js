import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  const body = await request.text();
  const signature = headers().get('stripe-signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'payment_intent.succeeded':
      console.log('PaymentIntent was successful!');
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response('Success', { status: 200 });
}

async function handleCheckoutCompleted(session) {
  try {
    const { business_id, subdomain, product_id, quantity } = session.metadata;

    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', business_id)
      .single();

    if (businessError) {
      console.error('Error fetching business:', businessError);
      return;
    }

    // Get product details
    const products = business.business_data?.products || [];
    const product = products.find(p => p.id === product_id);

    if (!product) {
      console.error('Product not found:', product_id);
      return;
    }

    const saleAmount = (session.amount_total / 100); // Convert from cents
    const isFirstSale = !business.first_sale_date;

    // Record the sale in database
    const { error: saleError } = await supabase
      .from('sales')
      .insert({
        business_id: business_id,
        stripe_session_id: session.id,
        product_name: product.name,
        amount: saleAmount,
        quantity: parseInt(quantity),
        customer_email: session.customer_details?.email,
        customer_name: session.customer_details?.name,
      });

    if (saleError) {
      console.error('Error recording sale:', saleError);
    }

    // Update business revenue and first sale date
    const updateData = {
      total_revenue: (business.total_revenue || 0) + saleAmount,
    };

    if (isFirstSale) {
      updateData.first_sale_date = new Date().toISOString();
    }

    await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', business_id);

    // Send notification emails
    await sendSaleNotificationEmail(business, product, saleAmount, session.customer_details, isFirstSale);

    // Send SMS notification if phone number is available
    if (business.phone_number) {
      await sendSaleNotificationSMS(business, product, saleAmount, isFirstSale);
    }

  } catch (error) {
    console.error('Error handling checkout completed:', error);
  }
}

async function sendSaleNotificationEmail(business, product, amount, customerDetails, isFirstSale) {
  try {
    const subject = isFirstSale 
      ? `🎉 FIRST SALE! You made $${amount} on ${business.name}!`
      : `💰 New Sale! $${amount} from ${business.name}`;

    const celebrationMessage = isFirstSale 
      ? `
        <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
          <h2 style="color: #000; margin: 0; font-size: 24px;">🎉 CONGRATULATIONS! 🎉</h2>
          <p style="color: #000; margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">This is your very first sale!</p>
        </div>
      `
      : '';

    await resend.emails.send({
      from: 'Launchfly Sales <sales@launchfly.ai>',
      to: business.form_data?.email || 'hello@launchfly.ai',
      subject: subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${celebrationMessage}
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333;">Sale Details</h3>
            <p style="margin: 5px 0;"><strong>Product:</strong> ${product.name}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> $${amount}</p>
            <p style="margin: 5px 0;"><strong>Customer:</strong> ${customerDetails?.name || 'Anonymous'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${customerDetails?.email || 'Not provided'}</p>
            <p style="margin: 5px 0;"><strong>Business:</strong> ${business.name}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard/${business.session_id}" 
               style="background: #007BFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              View Dashboard
            </a>
          </div>
          
          ${isFirstSale ? `
            <div style="border-top: 2px solid #28a745; padding-top: 20px; margin-top: 30px;">
              <h3 style="color: #28a745; margin: 0 0 10px 0;">🚀 What's Next?</h3>
              <p style="margin: 0; line-height: 1.6;">
                You've proven there's demand for your product! Now let's scale this success. 
                Check your dashboard for growth strategies and next steps.
              </p>
            </div>
          ` : ''}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
            <p>Best regards,<br>The Launchfly Team</p>
          </div>
        </div>
      `
    });
  } catch (error) {
    console.error('Error sending sale notification email:', error);
  }
}

async function sendSaleNotificationSMS(business, product, amount, isFirstSale) {
  try {
    // This would require Twilio setup - placeholder for now
    console.log(`SMS notification: ${isFirstSale ? 'FIRST SALE!' : 'New sale!'} $${amount} from ${product.name}`);
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}
