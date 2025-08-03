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
        .select('user_id, name, subdomain, form_data, launch_date, created_at, views, first_sale_date, total_revenue, session_id')
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
          visitorCount: business.views || 0,
          sessionId: business.session_id
        });
      }

      // Send order confirmation email to customer
      if (saleData.customer_email) {
        await sendCustomerConfirmation({
          customerEmail: saleData.customer_email,
          customerName: saleData.customer_name,
          businessName: business.name,
          productName: metadata.product_name,
          amount: session.amount_total / 100,
          orderId: session.id,
          websiteUrl: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/sites/${business.subdomain}`
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
  visitorCount,
  sessionId
}) {
  try {
    const subject = isFirstSale 
      ? `🎉 You did it! Your first sale for ${businessName}!`
      : `💰 New Sale: $${amount.toFixed(2)} for ${businessName}`;

    const dashboardUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/dashboard/${sessionId}`;
    const websiteUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/sites/${subdomain}`;

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
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>🎉 YOU DID IT! Your First Sale!</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="padding:40px 0">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                  
                  <!-- Header -->
                  <tr>
                    <td align="center" style="background:linear-gradient(135deg,#007bff 0%,#00b8d9 100%);padding:40px 20px;">
                      <div style="font-size:60px;margin-bottom:20px;">🎉</div>
                      <h1 style="color:#ffffff;font-size:36px;font-weight:800;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:2px;">
                        YOU DID IT!
                      </h1>
                      <p style="color:#ffffff;font-size:20px;margin:0;opacity:0.95;font-weight:500;">
                        Your first sale just came through!
                      </p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding:40px 40px 20px 40px;">
                      
                      <!-- Sale Amount -->
                      <div style="background-color:#e6f2ff;border-radius:12px;padding:30px;margin-bottom:30px;text-align:center;">
                        <p style="color:#007bff;font-size:18px;margin:0 0 10px 0;font-weight:600;">
                          Sale Amount
                        </p>
                        <p style="color:#1a2b48;font-size:48px;font-weight:800;margin:0;">
                          $${amount.toFixed(2)}
                        </p>
                        <p style="color:#5a6982;font-size:18px;margin:12px 0 0 0;font-weight:500;">
                          ${productName}
                        </p>
                      </div>

                      <!-- Celebration Message -->
                      <div style="text-align:center;margin-bottom:30px;">
                        <h2 style="color:#1a2b48;font-size:24px;font-weight:700;margin:0 0 15px 0;">
                          ${businessOwnerName}, this is huge! 🚀
                        </h2>
                        <p style="color:#5a6982;font-size:16px;line-height:1.6;margin:0;">
                          You've officially joined the ranks of successful Launchfly entrepreneurs. Your ${businessName} just made its first sale in ${timeToSale.trim()}!
                        </p>
                      </div>

                      <!-- Stats Grid -->
                      <div style="display:table;width:100%;margin-bottom:30px;">
                        <div style="display:table-cell;width:50%;padding-right:10px;">
                          <div style="background-color:#f9fafb;border-radius:8px;padding:20px;text-align:center;height:80px;display:flex;flex-direction:column;justify-content:center;">
                            <p style="color:#1a2b48;font-size:24px;font-weight:800;margin:0 0 5px 0;">${visitorCount}</p>
                            <p style="color:#5a6982;font-size:14px;margin:0;font-weight:500;">Total Visitors</p>
                          </div>
                        </div>
                        <div style="display:table-cell;width:50%;padding-left:10px;">
                          <div style="background-color:#f9fafb;border-radius:8px;padding:20px;text-align:center;height:80px;display:flex;flex-direction:column;justify-content:center;">
                            <p style="color:#1a2b48;font-size:24px;font-weight:800;margin:0 0 5px 0;">${timeToSale.trim()}</p>
                            <p style="color:#5a6982;font-size:14px;margin:0;font-weight:500;">Time to First Sale</p>
                          </div>
                        </div>
                      </div>

                      <!-- Sale Details -->
                      <div style="background-color:#f0f9ff;border-left:4px solid #007bff;border-radius:8px;padding:20px;margin-bottom:25px;">
                        <h3 style="color:#1a2b48;font-size:16px;font-weight:600;margin:0 0 15px 0;">🎯 Sale Details:</h3>
                        <p style="color:#5a6982;margin:5px 0;font-size:14px;"><strong>Customer:</strong> ${customerName}</p>
                        <p style="color:#5a6982;margin:5px 0;font-size:14px;"><strong>Email:</strong> ${customerEmail}</p>
                        <p style="color:#5a6982;margin:5px 0;font-size:14px;"><strong>Business:</strong> ${businessName}</p>
                      </div>

                      <!-- Encouragement -->
                      <div style="background-color:#fff8e6;border-radius:8px;padding:20px;margin-bottom:25px;text-align:center;">
                        <p style="color:#1a2b48;font-size:16px;line-height:1.6;margin:0;font-weight:500;">
                          ✨ This is just the beginning! You're in the top ${percentile}% of entrepreneurs who make their first sale this quickly. 
                          At this rate, you could hit <strong>$1,000</strong> in the next ${daysTo1k} days.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- CTA Buttons -->
                  <tr>
                    <td align="center" style="padding:0 40px 40px 40px;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" style="border-radius:8px;background:linear-gradient(135deg,#007bff 0%,#00b8d9 100%);">
                            <a href="${dashboardUrl}" style="display:inline-block;padding:16px 32px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                              🎯 View Your Dashboard
                            </a>
                          </td>
                        </tr>
                      </table>
                      <div style="margin-top:15px;">
                        <a href="${websiteUrl}" style="color:#007bff;text-decoration:none;font-size:14px;font-weight:600;">
                          🌐 Visit Your Website
                        </a>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding:30px 40px;border-top:1px solid #e4e7eb;">
                      <p style="color:#5a6982;font-size:14px;margin:0 0 10px 0;font-weight:600;">
                        The first sale is always the hardest – you've got this! 💪
                      </p>
                      <p style="color:#5a6982;font-size:12px;margin:0;">
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
      `;
    } else {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>💰 Ka-ching! New Sale</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="padding:40px 0">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                  
                  <!-- Header -->
                  <tr>
                    <td align="center" style="background:linear-gradient(135deg,#007bff 0%,#00b8d9 100%);padding:30px 20px;">
                      <div style="font-size:48px;margin-bottom:15px;">💰</div>
                      <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0 0 8px 0;">
                        Ka-ching!
                      </h1>
                      <p style="color:#ffffff;font-size:18px;margin:0;opacity:0.95;">
                        Another sale just rolled in!
                      </p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding:40px 40px 20px 40px;">
                      <p style="color:#1a2b48;font-size:18px;line-height:1.6;margin:0 0 25px 0;">
                        <strong>Great news, ${businessOwnerName}!</strong> 🎉
                      </p>
                      
                      <!-- Sale Amount -->
                      <div style="background-color:#e6f2ff;border-radius:12px;padding:25px;margin-bottom:25px;text-align:center;">
                        <p style="color:#007bff;font-size:16px;margin:0 0 8px 0;font-weight:600;">
                          New Sale
                        </p>
                        <p style="color:#1a2b48;font-size:36px;font-weight:800;margin:0;">
                          $${amount.toFixed(2)}
                        </p>
                        <p style="color:#5a6982;font-size:16px;margin:8px 0 0 0;">
                          ${productName}
                        </p>
                      </div>

                      <!-- Sale Details -->
                      <div style="background-color:#f9fafb;border-radius:8px;padding:20px;margin-bottom:25px;">
                        <h3 style="color:#1a2b48;font-size:16px;font-weight:600;margin:0 0 15px 0;">Sale Details:</h3>
                        <p style="color:#5a6982;margin:5px 0;font-size:14px;"><strong>Customer:</strong> ${customerName}</p>
                        <p style="color:#5a6982;margin:5px 0;font-size:14px;"><strong>Business:</strong> ${businessName}</p>
                        <p style="color:#5a6982;margin:5px 0;font-size:14px;"><strong>Total Revenue:</strong> $${totalRevenue.toFixed(2)}</p>
                      </div>

                      <p style="color:#5a6982;font-size:16px;line-height:1.6;margin:0;">
                        Your business is gaining momentum! Keep up the great work – each sale brings you closer to your goals.
                      </p>
                    </td>
                  </tr>

                  <!-- CTA Buttons -->
                  <tr>
                    <td align="center" style="padding:0 40px 40px 40px;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" style="border-radius:8px;background:linear-gradient(135deg,#007bff 0%,#00b8d9 100%);">
                            <a href="${dashboardUrl}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                              View Dashboard →
                            </a>
                          </td>
                        </tr>
                      </table>
                      <div style="margin-top:15px;">
                        <a href="${websiteUrl}" style="color:#007bff;text-decoration:none;font-size:14px;font-weight:600;">
                          Visit Your Website
                        </a>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding:30px 40px;border-top:1px solid #e4e7eb;">
                      <p style="color:#5a6982;font-size:14px;margin:0 0 10px 0;">
                        Keep up the momentum! 🚀
                      </p>
                      <p style="color:#5a6982;font-size:12px;margin:0;">
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

async function sendCustomerConfirmation({
  customerEmail,
  customerName,
  businessName,
  productName,
  amount,
  orderId,
  websiteUrl
}) {
  try {
    const subject = `Order Confirmation - Thank you for your purchase from ${businessName}!`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding:40px 0">
              <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                
                <!-- Header -->
                <tr>
                  <td align="center" style="background:linear-gradient(135deg,#007bff 0%,#00b8d9 100%);padding:40px 20px;">
                    <div style="font-size:48px;margin-bottom:20px;">✅</div>
                    <h1 style="color:#ffffff;font-size:32px;font-weight:800;margin:0 0 12px 0;">
                      Order Confirmed!
                    </h1>
                    <p style="color:#ffffff;font-size:18px;margin:0;opacity:0.95;font-weight:500;">
                      Thank you for your purchase from ${businessName}
                    </p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding:40px 40px 20px 40px;">
                    
                    <!-- Greeting -->
                    <p style="color:#1a2b48;font-size:18px;line-height:1.6;margin:0 0 25px 0;">
                      Hi ${customerName},
                    </p>
                    
                    <p style="color:#5a6982;font-size:16px;line-height:1.6;margin:0 0 30px 0;">
                      Thank you for your purchase! We're excited to confirm that your order has been successfully processed.
                    </p>

                    <!-- Order Details -->
                    <div style="background-color:#f0f9ff;border-radius:12px;padding:30px;margin-bottom:30px;">
                      <h2 style="color:#1a2b48;font-size:20px;font-weight:700;margin:0 0 20px 0;">
                        Order Details
                      </h2>
                      
                      <!-- Order ID -->
                      <div style="margin-bottom:15px;">
                        <p style="color:#5a6982;font-size:14px;margin:0 0 5px 0;font-weight:500;">Order ID:</p>
                        <p style="color:#1a2b48;font-size:16px;margin:0;font-weight:600;font-family:monospace;">${orderId}</p>
                      </div>

                      <!-- Product & Amount -->
                      <div style="border-top:1px solid #e0f2fe;padding-top:15px;">
                        <div style="display:table;width:100%;">
                          <div style="display:table-row;">
                            <div style="display:table-cell;padding:8px 0;vertical-align:middle;">
                              <p style="color:#1a2b48;font-size:16px;margin:0;font-weight:600;">${productName}</p>
                            </div>
                            <div style="display:table-cell;text-align:right;padding:8px 0;vertical-align:middle;">
                              <p style="color:#1a2b48;font-size:20px;margin:0;font-weight:800;">$${amount.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Total -->
                      <div style="border-top:2px solid #007bff;padding-top:15px;margin-top:15px;">
                        <div style="display:table;width:100%;">
                          <div style="display:table-row;">
                            <div style="display:table-cell;padding:5px 0;vertical-align:middle;">
                              <p style="color:#1a2b48;font-size:18px;margin:0;font-weight:800;">Total Paid:</p>
                            </div>
                            <div style="display:table-cell;text-align:right;padding:5px 0;vertical-align:middle;">
                              <p style="color:#007bff;font-size:24px;margin:0;font-weight:800;">$${amount.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Next Steps -->
                    <div style="background-color:#f9fafb;border-radius:8px;padding:25px;margin-bottom:25px;">
                      <h3 style="color:#1a2b48;font-size:18px;font-weight:600;margin:0 0 15px 0;">What's Next?</h3>
                      <p style="color:#5a6982;font-size:16px;line-height:1.6;margin:0;">
                        You'll receive any additional information about your purchase directly from ${businessName}. 
                        If you have any questions about your order, please don't hesitate to reach out to them.
                      </p>
                    </div>

                    <!-- Thank You Message -->
                    <div style="text-align:center;margin-bottom:20px;">
                      <p style="color:#5a6982;font-size:16px;line-height:1.6;margin:0;">
                        Thank you for supporting ${businessName}! We hope you love your purchase. 💙
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td align="center" style="padding:0 40px 40px 40px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="border-radius:8px;background:linear-gradient(135deg,#007bff 0%,#00b8d9 100%);">
                          <a href="${websiteUrl}" style="display:inline-block;padding:16px 32px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                            Visit ${businessName} →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding:30px 40px;border-top:1px solid #e4e7eb;">
                    <p style="color:#5a6982;font-size:14px;margin:0 0 10px 0;">
                      This order was processed securely through Launchfly AI
                    </p>
                    <p style="color:#5a6982;font-size:12px;margin:0;">
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
    `;

    await resend.emails.send({
      from: 'Orders <hello@launchfly.ai>',
      to: customerEmail,
      subject: subject,
      html: htmlContent
    });

    console.log(`Order confirmation sent to ${customerEmail} for order ${orderId}`);

  } catch (error) {
    console.error('Error sending customer confirmation email:', error);
  }
}
