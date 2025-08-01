import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Health check endpoint
export async function GET() {
  return Response.json({ 
    status: 'Stripe webhook endpoint is active',
    timestamp: new Date().toISOString(),
    env_check: {
      stripe_secret: !!process.env.STRIPE_SECRET_KEY,
      webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: !!process.env.SUPABASE_SERVICE_KEY
    }
  });
}

export async function POST(request) {
  console.log('=== STRIPE WEBHOOK RECEIVED ===');
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  console.log('Body length:', body.length);
  console.log('Signature:', signature ? 'Present' : 'Missing');

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('✅ Webhook signature verified');
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('Received Stripe webhook:', event.type);
  console.log('Webhook data:', JSON.stringify(event.data.object, null, 2));

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata;
    
    console.log('Processing checkout.session.completed');
    console.log('Session metadata:', metadata);
    console.log('Session customer_details:', session.customer_details);
    
    try {
      // Validate required metadata
      if (!metadata.business_id) {
        throw new Error('Missing business_id in metadata');
      }
      
      if (!metadata.product_id) {
        throw new Error('Missing product_id in metadata');
      }
      
      // Record the sale in database - match your actual schema
      const saleData = {
        business_id: metadata.business_id,
        product_id: metadata.product_id,
        amount: session.amount_total / 100, // Convert from cents
        currency: 'usd',
        customer_email: session.customer_details?.email || metadata.customer_email,
        customer_name: session.customer_details?.name || metadata.customer_name || 'Unknown',
        stripe_session_id: session.id,
        payment_status: 'completed'
      };

      console.log('Inserting sale data:', saleData);

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
        .select('user_id, name, subdomain, form_data, launch_date, created_at, views, first_sale_date, total_revenue')
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
        last_sale_date: new Date().toISOString(),
      };

      if (isFirstSale) {
        businessUpdates.first_sale_date = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('businesses')
        .update(businessUpdates)
        .eq('id', metadata.business_id);

      if (updateError) {
        console.error('Error updating business:', updateError);
        throw updateError;
      }

      // Send success email to business owner
      const businessOwnerEmail = business.form_data?.email || metadata.business_owner_email;
      
      if (businessOwnerEmail) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', business.user_id)
          .single();

        if (profileError) {
          console.warn(`Could not fetch profile for user ${business.user_id}:`, profileError.message);
        }
        const businessOwnerName = profile?.full_name || business.form_data.name;

        await sendSaleNotification({
          businessOwnerEmail,
          businessOwnerName,
          businessName: business.name,
          customerName: saleData.customer_name,
          customerEmail: saleData.customer_email,
          productName: metadata.product_name,
          amount: session.amount_total / 100,
          isFirstSale,
          totalRevenue: newTotalRevenue,
          subdomain: business.subdomain,
          businessLaunchDate: business.launch_date || business.created_at,
          visitorCount: business.views || 0
        });
      }

      console.log('Sale processing completed successfully');

    } catch (error) {
      console.error('Error processing sale:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Return error response to help with debugging
      return new Response(JSON.stringify({ 
        error: 'Failed to process sale', 
        details: error.message 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return Response.json({ received: true });
}

async function sendSaleNotification({
  businessOwnerEmail,
  businessOwnerName,
  businessName,
  customerName,
  customerEmail,
  productName,
  amount,
  isFirstSale,
  totalRevenue,
  subdomain,
  businessLaunchDate,
  visitorCount
}) {
  try {
    const subject = isFirstSale 
      ? `🎉 You did it! Your first sale for ${businessName}!`
      : `💰 New Sale: $${amount.toFixed(2)} for ${businessName}`;

    const dashboardUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard`;
    const websiteUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/${subdomain}`;

    let htmlContent;

    if (isFirstSale) {
      htmlContent = `
        <div style="font-family: 'Inter', Arial, sans-serif; background: #F9FAFB; color: #1A2B48; padding: 0; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 18px; box-shadow: 0 8px 32px rgba(0,123,255,0.08); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #fff; font-size: 2.2rem; font-weight: 900; margin-bottom: 12px;">
                🎉 Congratulations, ${businessOwnerName}!
              </h1>
              <p style="color: #fff; font-size: 1.1rem; margin-bottom: 0;">
                You just made your <strong>first sale</strong> for <span style="color: #FF6B6B;">${businessName}</span>!
              </p>
            </div>
            <div style="padding: 32px 24px;">
              <p style="font-size: 1.1rem; margin-bottom: 18px;">
                <strong>Customer:</strong> ${customerName} (${customerEmail})
              </p>
              <p style="font-size: 1.1rem; margin-bottom: 18px;">
                <strong>Product:</strong> ${productName}
              </p>
              <p style="font-size: 1.1rem; margin-bottom: 18px;">
                <strong>Amount:</strong> <span style="color: #007BFF; font-weight: bold;">$${amount.toFixed(2)}</span>
              </p>
              <hr style="border: none; border-top: 1px solid #E4E7EB; margin: 24px 0;">
              <p style="font-size: 1rem; margin-bottom: 12px;">
                <strong>🚀 Time to First Sale:</strong> ${timeToSale}
              </p>
              <p style="font-size: 1rem; margin-bottom: 12px;">
                <strong>🌟 You beat ${percentile}% of new businesses!</strong>
              </p>
              <p style="font-size: 1rem; margin-bottom: 12px;">
                <strong>📈 Projected days to $1,000:</strong> ${daysTo1k} days
              </p>
              <p style="font-size: 1rem; margin-bottom: 12px;">
                <strong>👀 Visitors so far:</strong> ${visitorCount}
              </p>
              <p style="font-size: 1rem; margin-bottom: 12px;">
                <strong>Total Revenue:</strong> <span style="color: #007BFF; font-weight: bold;">$${totalRevenue.toFixed(2)}</span>
              </p>
              <div style="margin: 32px 0; text-align: center;">
                <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); color: #fff; padding: 16px 32px; border-radius: 8px; font-size: 1.1rem; font-weight: bold; text-decoration: none; box-shadow: 0 4px 16px rgba(0,123,255,0.12);">
                  View Your Dashboard →
                </a>
              </div>
              <div style="text-align: center; margin-top: 24px;">
                <a href="${websiteUrl}" style="color: #007BFF; font-weight: bold; text-decoration: underline;">Visit Your Website</a>
              </div>
            </div>
            <div style="background: #F9FAFB; color: #5A6982; text-align: center; padding: 18px;">
              <p style="margin: 0; font-size: 0.95rem;">
                This is just the beginning. The AI is already working to find your next customer!
              </p>
              <p style="margin: 0; font-size: 0.95rem;">
                Need help? <a href="mailto:support@launchfly.ai" style="color: #00B8D9; text-decoration: underline;">Contact Support</a>
              </p>
            </div>
          </div>
        </div>
      `;
    } else {
      htmlContent = `
        <div style="font-family: 'Inter', Arial, sans-serif; background: #F9FAFB; color: #1A2B48; padding: 0; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 18px; box-shadow: 0 8px 32px rgba(0,123,255,0.08); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #fff; font-size: 2.2rem; font-weight: 900; margin-bottom: 12px;">
                💰 New Sale for ${businessName}!
              </h1>
              <p style="color: #fff; font-size: 1.1rem; margin-bottom: 0;">
                Another customer just purchased <strong>${productName}</strong>!
              </p>
            </div>
            <div style="padding: 32px 24px;">
              <p style="font-size: 1.1rem; margin-bottom: 18px;">
                <strong>Customer:</strong> ${customerName} (${customerEmail})
              </p>
              <p style="font-size: 1.1rem; margin-bottom: 18px;">
                <strong>Product:</strong> ${productName}
              </p>
              <p style="font-size: 1.1rem; margin-bottom: 18px;">
                <strong>Amount:</strong> <span style="color: #007BFF; font-weight: bold;">$${amount.toFixed(2)}</span>
              </p>
              <hr style="border: none; border-top: 1px solid #E4E7EB; margin: 24px 0;">
              <p style="font-size: 1rem; margin-bottom: 12px;">
                <strong>Total Revenue:</strong> <span style="color: #007BFF; font-weight: bold;">$${totalRevenue.toFixed(2)}</span>
              </p>
              <p style="font-size: 1rem; margin-bottom: 12px;">
                <strong>👀 Visitors so far:</strong> ${visitorCount}
              </p>
              <div style="margin: 32px 0; text-align: center;">
                <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); color: #fff; padding: 16px 32px; border-radius: 8px; font-size: 1.1rem; font-weight: bold; text-decoration: none; box-shadow: 0 4px 16px rgba(0,123,255,0.12);">
                  View Your Dashboard →
                </a>
              </div>
              <div style="text-align: center; margin-top: 24px;">
                <a href="${websiteUrl}" style="color: #007BFF; font-weight: bold; text-decoration: underline;">Visit Your Website</a>
              </div>
            </div>
            <div style="background: #F9FAFB; color: #5A6982; text-align: center; padding: 18px;">
              <p style="margin: 0; font-size: 0.95rem;">
                Keep up the momentum! The AI is working to bring you even more customers.
              </p>
              <p style="margin: 0; font-size: 0.95rem;">
                Need help? <a href="mailto:support@launchfly.ai" style="color: #00B8D9; text-decoration: underline;">Contact Support</a>
              </p>
            </div>
          </div>
        </div>
      `;
    }

    await resend.emails.send({
      from: 'Launchfly Sales <hello@launchfly.ai>',
      to: businessOwnerEmail,
      subject: subject,
      html: htmlContent
    });

    console.log(`Sale notification sent to ${businessOwnerEmail} for business ${businessName}`);

  } catch (error) {
    console.error('Error sending sale notification email:', error);
  }
}
