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
  const sig = request.headers.get('stripe-signature');
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object);
      break;
    case 'payment_intent.succeeded':
      console.log('PaymentIntent was successful!');
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  return new Response('Success', { status: 200 });
}

async function handleCheckoutSessionCompleted(session) {
  try {
    const { businessId, productId, customerName, subdomain } = session.metadata;
    const customerEmail = session.customer_details.email;
    const amountTotal = session.amount_total / 100; // Convert from cents
    
    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (businessError) {
      console.error('Error fetching business:', businessError);
      return;
    }
    
    // Find the product
    const product = business.business_data?.products?.find(p => p.id === productId);
    if (!product) {
      console.error('Product not found:', productId);
      return;
    }
    
    // Record the sale
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
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (saleError) {
      console.error('Error recording sale:', saleError);
      return;
    }
    
    // Update business total revenue and sale dates
    const currentRevenue = business.total_revenue || 0;
    const newRevenue = currentRevenue + amountTotal;
    const saleDate = new Date().toISOString();
    
    const businessUpdates = {
      total_revenue: newRevenue,
      last_sale_date: saleDate
    };
    
    // Set first sale date if this is the first sale
    if (!business.first_sale_date) {
      businessUpdates.first_sale_date = saleDate;
    }
    
    await supabase
      .from('businesses')
      .update(businessUpdates)
      .eq('id', businessId);
    
    // Send notification emails
    await Promise.all([
      sendCustomerReceiptEmail(customerEmail, customerName, product, amountTotal, business),
      sendBusinessOwnerNotificationEmail(business, product, amountTotal, customerEmail, customerName)
    ]);
    
    // Send SMS notification to business owner if phone number exists
    if (business.phone_number) {
      await sendSMSNotification(business.phone_number, product, amountTotal, customerName);
    }
    
    // Send instant notification
    try {
      await fetch(`${process.env.NEXT_PUBLIC_URL}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: businessId,
          saleId: sale.id,
          type: 'sale'
        })
      });
    } catch (notificationError) {
      console.error('Error sending instant notification:', notificationError);
    }
    
    console.log('✅ Sale processed successfully:', sale.id);
    
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

async function sendCustomerReceiptEmail(customerEmail, customerName, product, amount, business) {
  try {
    await resend.emails.send({
      from: 'Launchfly <noreply@launchfly.ai>',
      to: customerEmail,
      subject: `Receipt for your purchase from ${business.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3b82f6; margin: 0;">Thank you for your purchase!</h1>
          </div>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 15px 0; color: #1f2937;">Order Details</h2>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <strong>Product:</strong>
              <span>${product.name}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <strong>Price:</strong>
              <span>$${amount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <strong>From:</strong>
              <span>${business.name}</span>
            </div>
          </div>
          
          <div style="background: #ecfdf5; border: 1px solid #d1fae5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #065f46;">
              <strong>✅ Payment Confirmed</strong><br>
              Your payment has been processed successfully. You should receive any digital products or further instructions via email shortly.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6b7280; font-size: 14px;">
              If you have any questions about your purchase, please contact ${business.name} directly.
            </p>
          </div>
        </div>
      `
    });
  } catch (error) {
    console.error('Error sending customer receipt email:', error);
  }
}

async function sendBusinessOwnerNotificationEmail(business, product, amount, customerEmail, customerName) {
  try {
    // Get business owner email from form_data
    const ownerEmail = business.form_data?.email;
    if (!ownerEmail) return;
    
    const dashboardUrl = `${process.env.NEXT_PUBLIC_URL}/dashboard/${business.session_id}`;
    
    await resend.emails.send({
      from: 'Launchfly <hello@launchfly.ai>',
      to: ownerEmail,
      subject: `🎉 You made a sale! $${amount.toFixed(2)} from ${business.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #059669; margin: 0;">🎉 Congratulations!</h1>
            <h2 style="color: #3b82f6; margin: 10px 0 0 0;">You just made a sale!</h2>
          </div>
          
          <div style="background: #f0fdf4; border: 2px solid #22c55e; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <div style="font-size: 36px; font-weight: bold; color: #059669; margin-bottom: 10px;">
              $${amount.toFixed(2)}
            </div>
            <div style="color: #374151; font-size: 18px;">
              Revenue added to ${business.name}
            </div>
          </div>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; color: #1f2937;">Sale Details</h3>
            <div style="margin-bottom: 8px;"><strong>Product:</strong> ${product.name}</div>
            <div style="margin-bottom: 8px;"><strong>Amount:</strong> $${amount.toFixed(2)}</div>
            <div style="margin-bottom: 8px;"><strong>Customer:</strong> ${customerName || 'N/A'}</div>
            <div style="margin-bottom: 8px;"><strong>Email:</strong> ${customerEmail}</div>
            <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              View Dashboard →
            </a>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #92400e; text-align: center;">
              <strong>💡 Tip:</strong> Keep momentum going! Check your dashboard for growth insights and next steps.
            </p>
          </div>
        </div>
      `
    });
  } catch (error) {
    console.error('Error sending business owner notification email:', error);
  }
}

async function sendSMSNotification(phoneNumber, product, amount, customerName) {
  // SMS notification would be implemented here if Twilio is configured
  try {
    const twilio = require('twilio');
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      await client.messages.create({
        body: `🎉 SALE ALERT! You just made $${amount.toFixed(2)} from "${product.name}"${customerName ? ` - Customer: ${customerName}` : ''}. Check your dashboard for details!`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
    }
  } catch (error) {
    console.error('Error sending SMS notification:', error);
  }
}
