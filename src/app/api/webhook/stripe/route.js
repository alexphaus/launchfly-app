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
        last_sale_date: new Date().toISOString()
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
      ? `🚀 FIRST SALE ALERT! $${amount} - Your Launchfly business is live!`
      : `🎯 KA-CHING! New $${amount} sale from ${customerName}`;

    const celebrationHeader = isFirstSale 
      ? `
        <div style="background: linear-gradient(135deg, #007BFF 0%, #00D4FF 100%); color: white; padding: 40px 20px; border-radius: 16px; margin: 0 0 30px 0; text-align: center; box-shadow: 0 8px 32px rgba(0, 123, 255, 0.3);">
          <div style="font-size: 48px; margin-bottom: 16px;">🚀</div>
          <h1 style="margin: 0 0 12px 0; font-size: 32px; font-weight: 900; letter-spacing: -0.5px;">FIRST SALE!</h1>
          <p style="margin: 0; font-size: 20px; opacity: 0.95; font-weight: 500;">Your AI-powered business just made money!</p>
          <div style="background: rgba(255, 255, 255, 0.2); display: inline-block; padding: 8px 16px; border-radius: 24px; margin-top: 16px;">
            <span style="font-size: 24px; font-weight: 800;">$${amount}</span>
          </div>
        </div>
      `
      : `
        <div style="background: linear-gradient(135deg, #007BFF 0%, #00D4FF 100%); color: white; padding: 30px 20px; border-radius: 16px; margin: 0 0 30px 0; text-align: center; box-shadow: 0 8px 32px rgba(0, 123, 255, 0.3);">
          <div style="font-size: 40px; margin-bottom: 12px;">💰</div>
          <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 800;">NEW SALE!</h1>
          <div style="background: rgba(255, 255, 255, 0.2); display: inline-block; padding: 8px 16px; border-radius: 24px;">
            <span style="font-size: 24px; font-weight: 800;">$${amount}</span>
          </div>
        </div>
      `;

    const dashboardUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard`;
    const websiteUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/${subdomain}`;

    await resend.emails.send({
      from: 'Launchfly 🚀 <hello@launchfly.ai>',
      to: businessOwnerEmail,
      subject: subject,
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
          ${celebrationHeader}
          
          <!-- Main Content Card -->
          <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(26, 43, 72, 0.08); margin-bottom: 24px;">
            
            <!-- Sale Details -->
            <div style="margin-bottom: 32px;">
              <h2 style="color: #1A2B48; margin: 0 0 20px 0; font-size: 20px; font-weight: 700;">📊 Sale Details</h2>
              <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="display: grid; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-weight: 500;">Product</span>
                    <span style="color: #1A2B48; font-weight: 600;">${productName}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-weight: 500;">Customer</span>
                    <span style="color: #1A2B48; font-weight: 600;">${customerName}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-weight: 500;">Email</span>
                    <span style="color: #1A2B48; font-weight: 600;">${customerEmail}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                    <span style="color: #64748b; font-weight: 500;">Business</span>
                    <span style="color: #1A2B48; font-weight: 600;">${businessName}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Revenue Stats -->
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center;">
              <div style="font-size: 32px; margin-bottom: 8px;">💎</div>
              <h3 style="color: white; margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">Total Business Revenue</h3>
              <div style="color: white; font-size: 36px; font-weight: 900; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">$${totalRevenue.toLocaleString()}</div>
              ${isFirstSale ? 
                `<p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 14px; font-weight: 500;">🎯 You've officially launched your first profitable AI business!</p>` :
                `<p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 14px; font-weight: 500;">🔥 Your business is growing!</p>`
              }
            </div>

            <!-- Action Buttons -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #007BFF 0%, #0056b3 100%); color: white; padding: 16px 28px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block; margin: 8px; box-shadow: 0 4px 14px rgba(0, 123, 255, 0.3); transition: all 0.3s ease;">
                📈 View Dashboard
              </a>
              <a href="${websiteUrl}" style="background: linear-gradient(135deg, #00B8D9 0%, #0094a6 100%); color: white; padding: 16px 28px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block; margin: 8px; box-shadow: 0 4px 14px rgba(0, 184, 217, 0.3);">
                🌐 Visit Your Site
              </a>
            </div>

            ${isFirstSale ? `
              <!-- First Sale Special Message -->
              <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center;">
                <div style="font-size: 28px; margin-bottom: 12px;">🎯</div>
                <h3 style="color: white; margin: 0 0 12px 0; font-weight: 700; font-size: 18px;">You Did It!</h3>
                <p style="color: rgba(255,255,255,0.95); margin: 0 0 16px 0; font-size: 15px; line-height: 1.5;">
                  From idea to first sale in record time! Your AI-powered business is now generating real revenue. 
                  This is just the beginning of your entrepreneurial journey with Launchfly.
                </p>
                <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin-top: 16px;">
                  <p style="color: white; margin: 0; font-size: 14px; font-weight: 600;">
                    💡 Pro Tip: Check your dashboard for AI-powered growth strategies to scale to $10K/month
                  </p>
                </div>
              </div>
            ` : `
              <!-- Regular Sale Message -->
              <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
                <div style="font-size: 24px; margin-bottom: 8px;">⚡</div>
                <h3 style="color: white; margin: 0 0 8px 0; font-weight: 600;">Momentum Building!</h3>
                <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px;">
                  Another sale in the books! Your Launchfly business continues to grow with AI-powered strategies.
                </p>
              </div>
            `}
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding: 20px;">
            <div style="margin-bottom: 16px;">
              <span style="font-size: 24px;">🚀</span>
              <span style="color: #007BFF; font-weight: 700; font-size: 18px; margin-left: 8px;">Launchfly</span>
            </div>
            <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">AI-Powered Business Builder</p>
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">Launch an AI-powered business in 30 minutes. Your first $1,000 is guaranteed.</p>
          </div>
        </div>
      `
    });

    console.log('Sale notification sent to:', businessOwnerEmail);
  } catch (error) {
    console.error('Error sending sale notification:', error);
  }
}
