import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('Received Stripe webhook:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata;
    
    try {
      // Record the sale in database
      const saleData = {
        business_id: metadata.business_id,
        customer_email: session.customer_details?.email || metadata.customer_email,
        customer_name: session.customer_details?.name || metadata.customer_name || 'Unknown',
        product_name: metadata.product_name,
        amount: session.amount_total / 100, // Convert from cents
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent,
        created_at: new Date().toISOString(),
      };

      // Insert sale record
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([saleData])
        .select()
        .single();

      if (saleError) {
        console.error('Error recording sale:', saleError);
        throw saleError;
      }

      console.log('Sale recorded:', sale.id);

      // Check if this is the first sale
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('first_sale_date, total_revenue, form_data')
        .eq('id', metadata.business_id)
        .single();

      if (businessError) {
        console.error('Error fetching business:', businessError);
        throw businessError;
      }

      const isFirstSale = !business.first_sale_date;
      const newTotalRevenue = (business.total_revenue || 0) + (session.amount_total / 100);

      // Update business with sale info
      const businessUpdates = {
        total_revenue: newTotalRevenue,
      };

      if (isFirstSale) {
        businessUpdates.first_sale_date = new Date().toISOString();
      }

      await supabase
        .from('businesses')
        .update(businessUpdates)
        .eq('id', metadata.business_id);

      // Send success email to business owner
      const businessOwnerEmail = business.form_data?.email || metadata.business_owner_email;
      
      if (businessOwnerEmail) {
        await sendSaleNotification({
          businessOwnerEmail,
          businessName: metadata.business_name,
          customerName: saleData.customer_name,
          customerEmail: saleData.customer_email,
          productName: metadata.product_name,
          amount: session.amount_total / 100,
          isFirstSale,
          totalRevenue: newTotalRevenue,
          subdomain: metadata.subdomain
        });
      }

      console.log('Sale processing completed successfully');

    } catch (error) {
      console.error('Error processing sale:', error);
      // Don't return error to Stripe to avoid retries for non-recoverable errors
    }
  }

  return Response.json({ received: true });
}

async function sendSaleNotification({
  businessOwnerEmail,
  businessName,
  customerName,
  customerEmail,
  productName,
  amount,
  isFirstSale,
  totalRevenue,
  subdomain
}) {
  try {
    const subject = isFirstSale 
      ? `🎉 Your first sale! $${amount} from ${customerName}`
      : `💰 New sale! $${amount} from ${customerName}`;

    const celebrationMessage = isFirstSale 
      ? `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin: 20px 0; text-align: center;">
          <h2 style="margin: 0 0 10px 0; font-size: 28px;">🎉 CONGRATULATIONS! 🎉</h2>
          <p style="margin: 0; font-size: 18px; opacity: 0.9;">You just made your first sale!</p>
        </div>
      `
      : '';

    const dashboardUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard`;
    const websiteUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/${subdomain}`;

    await resend.emails.send({
      from: 'Launchfly Sales <sales@launchfly.ai>',
      to: businessOwnerEmail,
      subject: subject,
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${celebrationMessage}
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px; margin: 20px 0;">
            <h1 style="color: #1f2937; margin: 0 0 20px 0;">New Sale Alert!</h1>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151; margin: 0 0 15px 0;">Sale Details:</h3>
              <p style="margin: 5px 0; color: #6b7280;"><strong>Product:</strong> ${productName}</p>
              <p style="margin: 5px 0; color: #6b7280;"><strong>Amount:</strong> $${amount}</p>
              <p style="margin: 5px 0; color: #6b7280;"><strong>Customer:</strong> ${customerName}</p>
              <p style="margin: 5px 0; color: #6b7280;"><strong>Email:</strong> ${customerEmail}</p>
              <p style="margin: 5px 0; color: #6b7280;"><strong>Business:</strong> ${businessName}</p>
            </div>

            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #065f46; margin: 0 0 10px 0;">💰 Revenue Update</h3>
              <p style="color: #047857; margin: 0; font-size: 18px; font-weight: bold;">Total Revenue: $${totalRevenue}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 10px;">
                View Dashboard
              </a>
              <a href="${websiteUrl}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 10px;">
                Visit Your Site
              </a>
            </div>

            ${isFirstSale ? `
              <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #92400e; margin: 0 0 10px 0;">🚀 What's Next?</h3>
                <p style="color: #92400e; margin: 0;">This is just the beginning! Your Launchfly business is now generating real revenue. Check your dashboard for growth insights and next steps.</p>
              </div>
            ` : ''}
          </div>

          <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px;">
            <p>Powered by Launchfly - AI Business Builder</p>
          </div>
        </div>
      `
    });

    console.log('Sale notification sent to:', businessOwnerEmail);
  } catch (error) {
    console.error('Error sending sale notification:', error);
  }
}
