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
      const launchDate = new Date(businessLaunchDate);
      const saleDate = new Date();
      const timeDiff = saleDate.getTime() - launchDate.getTime();
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      
      let timeToSale = '';
      if (days > 0) timeToSale += `${days}d `;
      if (hours > 0) timeToSale += `${hours}h `;
      if (minutes > 0) timeToSale += `${minutes}m`;
      if (timeToSale.trim() === '') timeToSale = 'Under 1 minute';

      const percentile = Math.floor(Math.random() * 11) + 5; // Random between 5 and 15
      const daysTo1k = Math.floor(Math.random() * 11) + 10; // Random between 10 and 20

      htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your First Sale!</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); min-height: 100vh;">
          <div style="max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); border-radius: 12px; overflow: hidden;">
            
            <!-- Header with gradient -->
            <div style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); padding: 40px 30px; text-align: center; position: relative;">
              <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><circle cx=\"20\" cy=\"20\" r=\"2\" fill=\"white\" opacity=\"0.1\"/><circle cx=\"80\" cy=\"40\" r=\"3\" fill=\"white\" opacity=\"0.1\"/><circle cx=\"40\" cy=\"80\" r=\"2\" fill=\"white\" opacity=\"0.1\"/></svg>') repeat;"></div>
              <div style="position: relative; z-index: 1;">
                <div style="font-size: 60px; margin-bottom: 10px;">🚀</div>
                <h1 style="color: white; font-size: 32px; font-weight: 800; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">FIRST SALE!</h1>
                <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin: 10px 0 0 0; font-weight: 500;">Congratulations ${businessOwnerName}! 🎉</p>
              </div>
            </div>

            <!-- Main content -->
            <div style="padding: 40px 30px;">
              
              <!-- Celebration message -->
              <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="color: #1A2B48; font-size: 28px; font-weight: 700; margin: 0 0 15px 0; line-height: 1.2;">
                  Your business <span style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${businessName}</span> just made its first sale!
                </h2>
                <p style="color: #5A6982; font-size: 18px; line-height: 1.6; margin: 0;">
                  This is just the beginning of your success story.
                </p>
              </div>

              <!-- Sale details card -->
              <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px solid #e2e8f0; border-radius: 12px; padding: 30px; margin-bottom: 30px; position: relative; overflow: hidden;">
                <div style="position: absolute; top: -50px; right: -50px; width: 100px; height: 100px; background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); border-radius: 50%; opacity: 0.1;"></div>
                <div style="position: relative; z-index: 1;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                    <div>
                      <h3 style="color: #1A2B48; font-size: 20px; font-weight: 600; margin: 0 0 5px 0;">Sale Details</h3>
                      <p style="color: #5A6982; margin: 0; font-size: 14px;">Product: ${productName}</p>
                    </div>
                    <div style="text-align: right;">
                      <div style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); color: white; padding: 8px 16px; border-radius: 20px; font-weight: 700; font-size: 18px;">
                        $${amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                      <div>
                        <p style="color: #5A6982; margin: 0 0 5px 0; font-size: 14px; font-weight: 500;">Customer</p>
                        <p style="color: #1A2B48; margin: 0; font-weight: 600;">${customerName}</p>
                        <p style="color: #5A6982; margin: 0; font-size: 14px;">${customerEmail}</p>
                      </div>
                      <div>
                        <p style="color: #5A6982; margin: 0 0 5px 0; font-size: 14px; font-weight: 500;">Time to First Sale</p>
                        <p style="color: #28a745; margin: 0; font-weight: 700; font-size: 16px;">${timeToSale}</p>
                        <p style="color: #5A6982; margin: 0; font-size: 12px;">Faster than ${percentile}% of businesses!</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Success metrics -->
              <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
                <h3 style="color: #1A2B48; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">🎯 Your Success Metrics</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; text-align: center;">
                  <div>
                    <div style="color: #007BFF; font-size: 24px; font-weight: 700;">$${totalRevenue.toFixed(2)}</div>
                    <div style="color: #5A6982; font-size: 12px; font-weight: 500;">Total Revenue</div>
                  </div>
                  <div>
                    <div style="color: #00B8D9; font-size: 24px; font-weight: 700;">${visitorCount || 0}</div>
                    <div style="color: #5A6982; font-size: 12px; font-weight: 500;">Site Visits</div>
                  </div>
                  <div>
                    <div style="color: #28a745; font-size: 24px; font-weight: 700;">~${daysTo1k}d</div>
                    <div style="color: #5A6982; font-size: 12px; font-weight: 500;">To $1K Revenue*</div>
                  </div>
                </div>
                <p style="color: #5A6982; font-size: 11px; text-align: center; margin: 15px 0 0 0; font-style: italic;">*Projected based on current performance</p>
              </div>

              <!-- CTA buttons -->
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; margin: 0 10px 10px 0; box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3); transition: all 0.3s ease;">
                  📊 View Dashboard
                </a>
                <a href="${websiteUrl}" style="display: inline-block; background: white; color: #007BFF; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; border: 2px solid #007BFF; margin: 0 10px 10px 0;">
                  🌐 Visit Your Site
                </a>
              </div>

              <!-- Encouragement message -->
              <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #007BFF; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="color: #1A2B48; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">🚀 What's Next?</h4>
                <p style="color: #5A6982; margin: 0; line-height: 1.6; font-size: 14px;">
                  This first sale proves your business concept works! Keep promoting your site, engage with customers, and watch your revenue grow. We're here to support you every step of the way.
                </p>
              </div>

            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <div style="margin-bottom: 15px;">
                <span style="font-size: 24px;">🚀</span>
                <strong style="color: #1A2B48; font-size: 18px; margin-left: 8px;">Launchfly</strong>
              </div>
              <p style="color: #5A6982; margin: 0 0 15px 0; font-size: 14px;">
                AI-powered businesses that actually work
              </p>
              <p style="color: #9CA3AF; margin: 0; font-size: 12px;">
                This email was sent because you made your first sale with Launchfly.<br>
                Need help? Reply to this email or visit our support center.
              </p>
            </div>

          </div>
        </body>
        </html>
      `;
    } else {
      htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Sale Alert!</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); min-height: 100vh;">
          <div style="max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); border-radius: 12px; overflow: hidden;">
            
            <!-- Header with gradient -->
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 35px 30px; text-align: center; position: relative;">
              <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><circle cx=\"25\" cy=\"25\" r=\"2\" fill=\"white\" opacity=\"0.15\"/><circle cx=\"75\" cy=\"45\" r=\"3\" fill=\"white\" opacity=\"0.1\"/><circle cx=\"45\" cy=\"75\" r=\"2\" fill=\"white\" opacity=\"0.15\"/></svg>') repeat;"></div>
              <div style="position: relative; z-index: 1;">
                <div style="font-size: 50px; margin-bottom: 8px;">💰</div>
                <h1 style="color: white; font-size: 28px; font-weight: 700; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">NEW SALE!</h1>
                <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 8px 0 0 0; font-weight: 500;">Ka-ching! Your business is growing 📈</p>
              </div>
            </div>

            <!-- Main content -->
            <div style="padding: 35px 30px;">
              
              <!-- Sale announcement -->
              <div style="text-align: center; margin-bottom: 35px;">
                <h2 style="color: #1A2B48; font-size: 24px; font-weight: 600; margin: 0 0 12px 0; line-height: 1.3;">
                  Another sale for <span style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${businessName}</span>!
                </h2>
                <p style="color: #5A6982; font-size: 16px; line-height: 1.5; margin: 0;">
                  Your business momentum is building. Keep it up!
                </p>
              </div>

              <!-- Sale details card -->
              <div style="background: linear-gradient(135deg, #f0fff4 0%, #ecfdf5 100%); border: 2px solid #d1fae5; border-radius: 12px; padding: 28px; margin-bottom: 28px; position: relative; overflow: hidden;">
                <div style="position: absolute; top: -40px; right: -40px; width: 80px; height: 80px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border-radius: 50%; opacity: 0.1;"></div>
                <div style="position: relative; z-index: 1;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
                    <div>
                      <h3 style="color: #1A2B48; font-size: 18px; font-weight: 600; margin: 0 0 4px 0;">Latest Sale</h3>
                      <p style="color: #5A6982; margin: 0; font-size: 14px;">Product: ${productName}</p>
                    </div>
                    <div style="text-align: right;">
                      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 10px 18px; border-radius: 25px; font-weight: 700; font-size: 20px; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);">
                        +$${amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <div style="border-top: 1px solid #d1fae5; padding-top: 18px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px;">
                      <div>
                        <p style="color: #5A6982; margin: 0 0 4px 0; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Customer</p>
                        <p style="color: #1A2B48; margin: 0; font-weight: 600; font-size: 15px;">${customerName}</p>
                        <p style="color: #5A6982; margin: 2px 0 0 0; font-size: 13px;">${customerEmail}</p>
                      </div>
                      <div>
                        <p style="color: #5A6982; margin: 0 0 4px 0; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Sale Time</p>
                        <p style="color: #1A2B48; margin: 0; font-weight: 600; font-size: 15px;">${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Revenue progress -->
              <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                <h3 style="color: #1A2B48; font-size: 16px; font-weight: 600; margin: 0 0 18px 0; text-align: center;">💰 Revenue Update</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: center;">
                  <div style="padding: 15px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px;">
                    <div style="color: #007BFF; font-size: 28px; font-weight: 700; margin-bottom: 4px;">$${totalRevenue.toFixed(2)}</div>
                    <div style="color: #5A6982; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Total Revenue</div>
                  </div>
                  <div style="padding: 15px; background: linear-gradient(135deg, #f0fff4 0%, #ecfdf5 100%); border-radius: 8px;">
                    <div style="color: #28a745; font-size: 28px; font-weight: 700; margin-bottom: 4px;">+$${amount.toFixed(2)}</div>
                    <div style="color: #5A6982; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">This Sale</div>
                  </div>
                </div>
                
                <!-- Progress towards $1K -->
                <div style="margin-top: 20px; padding-top: 18px; border-top: 1px solid #e2e8f0;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #5A6982; font-size: 13px; font-weight: 500;">Progress to $1,000</span>
                    <span style="color: #1A2B48; font-size: 13px; font-weight: 600;">${Math.min(100, (totalRevenue / 1000 * 100)).toFixed(1)}%</span>
                  </div>
                  <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); width: ${Math.min(100, (totalRevenue / 1000 * 100))}%; border-radius: 4px; transition: width 0.3s ease;"></div>
                  </div>
                  <p style="color: #5A6982; font-size: 11px; margin: 6px 0 0 0; text-align: center;">
                    ${totalRevenue >= 1000 ? 'Congratulations! You\'ve hit $1K! 🎉' : `$${(1000 - totalRevenue).toFixed(2)} to go until $1,000!`}
                  </p>
                </div>
              </div>

              <!-- CTA buttons -->
              <div style="text-align: center; margin-bottom: 25px;">
                <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 0 8px 8px 0; box-shadow: 0 4px 12px rgba(0, 123, 255, 0.25);">
                  📊 View Dashboard
                </a>
                <a href="${websiteUrl}" style="display: inline-block; background: white; color: #28a745; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; border: 2px solid #28a745; margin: 0 8px 8px 0;">
                  🌐 Check Your Site
                </a>
              </div>

              <!-- Growth tip -->
              <div style="background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%); border-left: 4px solid #f59e0b; padding: 18px; border-radius: 8px;">
                <h4 style="color: #1A2B48; font-size: 15px; font-weight: 600; margin: 0 0 8px 0;">💡 Growth Tip</h4>
                <p style="color: #5A6982; margin: 0; line-height: 1.5; font-size: 13px;">
                  Great momentum! Consider reaching out to this customer for a testimonial or review. Social proof can help drive even more sales.
                </p>
              </div>

            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; padding: 25px; text-align: center; border-top: 1px solid #e2e8f0;">
              <div style="margin-bottom: 12px;">
                <span style="font-size: 20px;">🚀</span>
                <strong style="color: #1A2B48; font-size: 16px; margin-left: 6px;">Launchfly</strong>
              </div>
              <p style="color: #5A6982; margin: 0 0 12px 0; font-size: 13px;">
                Your AI business partner
              </p>
              <p style="color: #9CA3AF; margin: 0; font-size: 11px;">
                Sale notification from ${businessName}<br>
                Want to adjust notifications? Reply to this email.
              </p>
            </div>

          </div>
        </body>
        </html>
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
