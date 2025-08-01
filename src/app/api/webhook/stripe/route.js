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
            <title>🎉 You Just Made Your First Sale!</title>
            <style>
                body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
                table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
                body { margin: 0 !important; padding: 0 !important; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
                @media screen and (max-width: 600px) {
                    .mobile-padding { padding: 20px !important; }
                }
            </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); overflow: hidden;">
                            <tr>
                                <td align="center" style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); padding: 40px 20px;">
                                    <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
                                    <h1 style="color: #ffffff; font-size: 36px; font-weight: 800; margin: 0 0 10px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">YOU DID IT!</h1>
                                    <p style="color: #ffffff; font-size: 20px; margin: 0; opacity: 0.95;">Your first sale just came through!</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 40px 40px 20px 40px;" class="mobile-padding">
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td align="center">
                                                <div style="background-color: #E6F2FF; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
                                                    <p style="color: #007BFF; font-size: 18px; margin: 0 0 10px 0; font-weight: 600;">Sale Amount</p>
                                                    <p style="color: #1A2B48; font-size: 48px; font-weight: 800; margin: 0;">$${amount.toFixed(2)}</p>
                                                    <p style="color: #5A6982; font-size: 16px; margin: 10px 0 0 0;">${productName}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 0 40px 30px 40px;" class="mobile-padding">
                                    <p style="color: #1A2B48; font-size: 18px; line-height: 1.6; margin: 0 0 20px 0;"><strong>${businessOwnerName}, this is huge!</strong> 🚀</p>
                                    <p style="color: #5A6982; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">You've officially joined the ranks of successful Launchfly entrepreneurs. Your business <strong>${businessName}</strong> is now generating real revenue!</p>
                                    <p style="color: #5A6982; font-size: 16px; line-height: 1.6; margin: 0;">And here's the best part: <strong style="color: #007BFF;">this is just the beginning.</strong> Our AI is already working on bringing you the next 10 customers.</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 0 40px 30px 40px;" class="mobile-padding">
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F9FAFB; border-radius: 12px; padding: 20px;">
                                        <tr>
                                            <td width="33%" align="center" style="padding: 10px;"><p style="color: #5A6982; font-size: 14px; margin: 0;">Time to First Sale</p><p style="color: #1A2B48; font-size: 24px; font-weight: 700; margin: 5px 0 0 0;">${timeToSale}</p></td>
                                            <td width="33%" align="center" style="padding: 10px; border-left: 1px solid #E4E7EB; border-right: 1px solid #E4E7EB;"><p style="color: #5A6982; font-size: 14px; margin: 0;">Total Visitors</p><p style="color: #1A2B48; font-size: 24px; font-weight: 700; margin: 5px 0 0 0;">${visitorCount}</p></td>
                                            <td width="33%" align="center" style="padding: 10px;"><p style="color: #5A6982; font-size: 14px; margin: 0;">Your Percentile</p><p style="color: #28a745; font-size: 24px; font-weight: 700; margin: 5px 0 0 0;">Top ${percentile}%</p></td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 0 40px 40px 40px;" class="mobile-padding">
                                    <a href="${dashboardUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 18px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%);">View Your Dashboard →</a>
                                </td>
                            </tr>
                            <tr>
                                <td style="background-color: #F9FAFB; padding: 30px 40px;" class="mobile-padding">
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td width="50" valign="top"><div style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">💬</div></td>
                                            <td style="padding-left: 15px;">
                                                <p style="color: #1A2B48; font-size: 14px; font-weight: 600; margin: 0 0 5px 0;">Your AI Success Coach</p>
                                                <p style="color: #5A6982; font-size: 14px; line-height: 1.5; margin: 0;">"${businessOwnerName}, you're in the top ${percentile}% of users for speed to first sale! Based on your metrics, I predict you'll hit $1,000 in revenue within ${daysTo1k} days. Let's make it happen!"</p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 30px 40px; border-top: 1px solid #E4E7EB;">
                                    <p style="color: #5A6982; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Launchfly AI. All rights reserved.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
      `;
    } else {
      // Enhanced template for subsequent sales
      htmlContent = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 30px; margin: 20px 0;">
            <h1 style="color: #1f2937; margin: 0 0 10px 0; font-size: 28px; font-weight: bold;">Another Sale! Keep it up!</h1>
            <p style="color: #4b5563; font-size: 16px;">Your business, ${businessName}, just made another sale.</p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="color: #1f2937; margin: 0 0 15px 0;">Sale Details:</h3>
              <p style="margin: 8px 0; color: #4b5563; font-size: 16px;"><strong>Product:</strong> ${productName}</p>
              <p style="margin: 8px 0; color: #4b5563; font-size: 16px;"><strong>Amount:</strong> <span style="color: #16a34a; font-weight: bold;">$${amount.toFixed(2)}</span></p>
              <p style="margin: 8px 0; color: #4b5563; font-size: 16px;"><strong>Customer:</strong> ${customerName}</p>
            </div>

            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
              <h3 style="color: #065f46; margin: 0 0 10px 0;">💰 Total Revenue Update</h3>
              <p style="color: #047857; margin: 0; font-size: 24px; font-weight: bold;">$${totalRevenue.toFixed(2)}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 0 10px;">
                View Dashboard
              </a>
              <a href="${websiteUrl}" style="background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 0 10px;">
                Visit Your Site
              </a>
            </div>
          </div>

          <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px;">
            <p>Powered by Launchfly - Your AI Business Partner</p>
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
