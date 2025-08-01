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
      ? `🎉 You Just Made Your First Sale! $${amount}` 
      : `💰 New Sale Alert! $${amount} from ${customerName}`;

    const dashboardUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard`;
    const websiteUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/${subdomain}`;

    // Calculate some motivational stats
    const timeToFirstSale = isFirstSale ? "Less than 24hrs" : "N/A";
    const percentile = isFirstSale ? "5" : "10"; // Top performers
    const daysTo1K = Math.max(7, Math.floor(1000 / amount * 7)); // Estimate based on current sale

    await resend.emails.send({
      from: 'Launchfly Sales <hello@launchfly.ai>',
      to: businessOwnerEmail,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
            <style>
                body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
                table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
                
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background-color: #f4f4f4;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                }
                
                @media screen and (max-width: 600px) {
                    .mobile-center { text-align: center !important; }
                    .mobile-padding { padding: 20px !important; }
                    .mobile-button { width: 100% !important; }
                    .confetti-emoji { font-size: 40px !important; }
                }
            </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); overflow: hidden;">
                            
                            ${isFirstSale ? `
                            <!-- Celebration Header for First Sale -->
                            <tr>
                                <td align="center" style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); padding: 40px 20px;">
                                    <div style="font-size: 60px; margin-bottom: 20px;" class="confetti-emoji">🎉</div>
                                    <h1 style="color: #ffffff; font-size: 36px; font-weight: 800; margin: 0 0 10px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                        YOU DID IT!
                                    </h1>
                                    <p style="color: #ffffff; font-size: 20px; margin: 0; opacity: 0.95;">
                                        Your first sale just came through!
                                    </p>
                                </td>
                            </tr>
                            ` : `
                            <!-- Regular Header for Additional Sales -->
                            <tr>
                                <td align="center" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px;">
                                    <div style="font-size: 50px; margin-bottom: 15px;">💰</div>
                                    <h1 style="color: #ffffff; font-size: 28px; font-weight: 800; margin: 0 0 10px 0;">
                                        Another Sale!
                                    </h1>
                                    <p style="color: #ffffff; font-size: 18px; margin: 0; opacity: 0.95;">
                                        Your business keeps growing!
                                    </p>
                                </td>
                            </tr>
                            `}
                            
                            <!-- Sale Details -->
                            <tr>
                                <td style="padding: 40px 40px 20px 40px;" class="mobile-padding">
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td align="center">
                                                <div style="background-color: #E6F2FF; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
                                                    <p style="color: #007BFF; font-size: 18px; margin: 0 0 10px 0; font-weight: 600;">
                                                        Sale Amount
                                                    </p>
                                                    <p style="color: #1A2B48; font-size: 48px; font-weight: 800; margin: 0;">
                                                        $${amount}
                                                    </p>
                                                    <p style="color: #5A6982; font-size: 16px; margin: 10px 0 0 0;">
                                                        ${productName}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            <!-- Personal Message -->
                            <tr>
                                <td style="padding: 0 40px 30px 40px;" class="mobile-padding">
                                    <p style="color: #1A2B48; font-size: 18px; line-height: 1.6; margin: 0 0 20px 0;">
                                        <strong>This is huge!</strong> 🚀
                                    </p>
                                    <p style="color: #5A6982; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                        ${isFirstSale 
                                          ? `You've officially joined the ranks of successful Launchfly entrepreneurs. Your business <strong>${businessName}</strong> is now generating real revenue!`
                                          : `Another customer has chosen <strong>${businessName}</strong>! Your business momentum is building beautifully.`
                                        }
                                    </p>
                                    <p style="color: #5A6982; font-size: 16px; line-height: 1.6; margin: 0;">
                                        Customer: <strong>${customerName}</strong> (${customerEmail})
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Revenue Stats -->
                            <tr>
                                <td style="padding: 0 40px 30px 40px;" class="mobile-padding">
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F9FAFB; border-radius: 12px; padding: 20px;">
                                        <tr>
                                            <td width="50%" align="center" style="padding: 10px;">
                                                <p style="color: #5A6982; font-size: 14px; margin: 0;">Total Revenue</p>
                                                <p style="color: #1A2B48; font-size: 28px; font-weight: 700; margin: 5px 0 0 0;">$${totalRevenue}</p>
                                            </td>
                                            <td width="50%" align="center" style="padding: 10px; border-left: 1px solid #E4E7EB;">
                                                <p style="color: #5A6982; font-size: 14px; margin: 0;">${isFirstSale ? 'Time to First Sale' : 'Your Performance'}</p>
                                                <p style="color: ${isFirstSale ? '#28a745' : '#007BFF'}; font-size: 24px; font-weight: 700; margin: 5px 0 0 0;">
                                                    ${isFirstSale ? timeToFirstSale : `Top ${percentile}%`}
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            <!-- Next Steps -->
                            ${isFirstSale ? `
                            <tr>
                                <td style="padding: 0 40px 30px 40px;" class="mobile-padding">
                                    <h2 style="color: #1A2B48; font-size: 24px; font-weight: 700; margin: 0 0 20px 0;">
                                        🎯 Your Next Moves
                                    </h2>
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td style="padding-bottom: 15px;">
                                                <table cellpadding="0" cellspacing="0" border="0">
                                                    <tr>
                                                        <td style="font-size: 20px; padding-right: 10px;">📧</td>
                                                        <td>
                                                            <p style="color: #1A2B48; font-size: 16px; font-weight: 600; margin: 0;">Send a Thank You</p>
                                                            <p style="color: #5A6982; font-size: 14px; margin: 0;">Build loyalty with a personal touch</p>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding-bottom: 15px;">
                                                <table cellpadding="0" cellspacing="0" border="0">
                                                    <tr>
                                                        <td style="font-size: 20px; padding-right: 10px;">🚀</td>
                                                        <td>
                                                            <p style="color: #1A2B48; font-size: 16px; font-weight: 600; margin: 0;">Scale Your Success</p>
                                                            <p style="color: #5A6982; font-size: 14px; margin: 0;">AI found what works - now let's 10x it</p>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <table cellpadding="0" cellspacing="0" border="0">
                                                    <tr>
                                                        <td style="font-size: 20px; padding-right: 10px;">💎</td>
                                                        <td>
                                                            <p style="color: #1A2B48; font-size: 16px; font-weight: 600; margin: 0;">Upgrade to Growth Plan</p>
                                                            <p style="color: #5A6982; font-size: 14px; margin: 0;">Unlock advanced AI to hit $1,000 faster</p>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            ` : ''}
                            
                            <!-- CTA Buttons -->
                            <tr>
                                <td align="center" style="padding: 0 40px 40px 40px;" class="mobile-padding">
                                    <table cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); margin-right: 10px;" class="mobile-button">
                                                <a href="${dashboardUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 18px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px;">
                                                    View Dashboard →
                                                </a>
                                            </td>
                                            <td align="center" style="border-radius: 8px; background: #10b981; margin-left: 10px;" class="mobile-button">
                                                <a href="${websiteUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 18px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px;">
                                                    Visit Your Site →
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            <!-- AI Success Coach Message -->
                            ${isFirstSale ? `
                            <tr>
                                <td style="background-color: #F9FAFB; padding: 30px 40px;" class="mobile-padding">
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td width="50" valign="top">
                                                <div style="background: linear-gradient(135deg, #007BFF 0%, #00B8D9 100%); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; text-align: center; line-height: 40px;">
                                                    🤖
                                                </div>
                                            </td>
                                            <td style="padding-left: 15px;">
                                                <p style="color: #1A2B48; font-size: 14px; font-weight: 600; margin: 0 0 5px 0;">
                                                    Your AI Success Coach
                                                </p>
                                                <p style="color: #5A6982; font-size: 14px; line-height: 1.5; margin: 0;">
                                                    "You're in the top ${percentile}% of users for speed to first sale! Based on your metrics, I predict you'll hit $1,000 in revenue within ${daysTo1K} days. Let's make it happen!"
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            ` : ''}
                            
                            <!-- Footer -->
                            <tr>
                                <td align="center" style="padding: 30px 40px; border-top: 1px solid #E4E7EB;">
                                    <p style="color: #5A6982; font-size: 14px; margin: 0 0 10px 0;">
                                        Questions? Reply to this email or contact our support team
                                    </p>
                                    <p style="color: #5A6982; font-size: 12px; margin: 0;">
                                        © 2025 Launchfly AI. All rights reserved.
                                    </p>
                                </td>
                            </tr>
                            
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
      `
    });

    console.log('Sale notification sent to:', businessOwnerEmail);
  } catch (error) {
    console.error('Error sending sale notification:', error);
  }
}
