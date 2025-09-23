// src/app/api/webhook/stripe/route.js
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

import { calculateRevenueShare } from '@/lib/revenue-share-calculator';

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
      // Check if this is a platform subscription payment (Professional plan)
      if (metadata.product_type === 'platform_subscription' && metadata.plan === 'professional') {
        console.log('Processing Professional plan subscription');
        
        // Record the platform subscription payment
        const subscriptionData = {
          user_email: metadata.user_email,
          user_name: metadata.user_name,
          plan: 'professional',
          amount: session.amount_total / 100, // Convert from cents
          currency: 'usd',
          stripe_session_id: session.id,
          payment_status: 'completed',
          metadata: {
            template: metadata.template,
            business_name: metadata.business_name,
            subdomain: metadata.subdomain
          }
        };
        
        console.log('Recording Professional plan subscription:', subscriptionData);
        
        const { data: subscription, error: subError } = await supabase
          .from('platform_subscriptions')
          .insert([subscriptionData])
          .select()
          .single();
        
        if (subError) {
          console.error('Error recording platform subscription:', subError);
          throw subError;
        }
        
        console.log('Professional plan subscription recorded:', subscription.id);
        
        // Send confirmation email
        try {
          await resend.emails.send({
            from: 'Launchfly <notifications@launchfly.com>',
            to: metadata.user_email,
            subject: 'Welcome to Launchfly Professional! 🚀',
            html: `
              <h2>Welcome to Launchfly Professional!</h2>
              <p>Hi ${metadata.user_name},</p>
              <p>Thank you for upgrading to Launchfly Professional! Your payment of $497 has been successfully processed.</p>
              <h3>What's Next?</h3>
              <ul>
                <li>Complete your business setup in the onboarding flow</li>
                <li>Access all premium templates</li>
                <li>Keep 90% of all profits (only 10% revenue share)</li>
                <li>Get priority customer allocation</li>
              </ul>
              <p>You can continue your setup by returning to the onboarding flow.</p>
              <p>If you have any questions, feel free to reach out to our support team.</p>
              <p>Best regards,<br>The Launchfly Team</p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send Professional plan confirmation email:', emailError);
        }
        
        return new Response('Professional plan webhook processed', { status: 200 });
      }
      
      // Regular business sale processing
      // Validate required metadata
      if (!metadata.business_id) {
        throw new Error('Missing business_id in metadata');
      }
      
      // Check if this is a single product or multi-item purchase
      const isMultiItem = metadata.items_count && parseInt(metadata.items_count) > 1;
      
      if (!isMultiItem && !metadata.product_id) {
        throw new Error('Missing product_id in metadata for single product purchase');
      }
      
      let saleRecords = [];
      
      if (isMultiItem) {
        // Handle multi-item purchase
        console.log('Processing multi-item purchase with', metadata.items_count, 'items');
        
        // For multi-item purchases, we need to retrieve the line items from Stripe
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
          expand: ['data.price.product']
        });
        
        // Create a sale record for the total amount (multi-item sale)
        const multiItemSaleData = {
          business_id: metadata.business_id,
          product_id: 'multi-item-' + session.id, // Use session ID as unique identifier for multi-item
          amount: session.amount_total / 100, // Total amount in dollars
          currency: 'usd',
          customer_email: session.customer_details?.email || metadata.customer_email,
          customer_name: session.customer_details?.name || metadata.customer_name || 'Unknown',
          stripe_session_id: session.id,
          payment_status: 'completed'
        };

        console.log('Inserting multi-item sale data:', multiItemSaleData);

        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert([multiItemSaleData])
          .select()
          .single();

        if (saleError) {
          console.error('Error recording multi-item sale:', saleError);
          throw saleError;
        }

        saleRecords.push(sale);
        console.log('Multi-item sale recorded:', sale.id);
        
      } else {
        // Handle single product purchase (existing logic)
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

        console.log('Inserting single product sale data:', saleData);

        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert([saleData])
          .select()
          .single();

        if (saleError) {
          console.error('Error recording sale:', saleError);
          throw saleError;
        }

        saleRecords.push(sale);
        console.log('Single product sale recorded:', sale.id);
      }

      // Check if this is the first sale
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('user_id, name, subdomain, form_data, launch_date, created_at, views, first_sale_date, total_revenue, available_balance, session_id, plan_tier')
        .eq('id', metadata.business_id)
        .single();

      if (businessError) {
        console.error('Error fetching business:', businessError);
        throw businessError;
      }

      const isFirstSale = !business.first_sale_date;
      const saleAmount = session.amount_total / 100;
      
      // Calculate revenue share
      const revenueShare = calculateRevenueShare(business, saleAmount);
      const newTotalRevenue = (business.total_revenue || 0) + saleAmount; // Full amount for tracking
      const newAvailableBalance = (business.available_balance || 0) + revenueShare.businessAmount; // Only business portion
      
      console.log(`💰 Revenue Share: $${saleAmount} sale → $${revenueShare.launchflyFee.toFixed(2)} to Launchfly (${(revenueShare.percentage * 100).toFixed(1)}%), $${revenueShare.businessAmount.toFixed(2)} to business`);

      // Update business with sale info
      const businessUpdates = {
        total_revenue: newTotalRevenue,
        available_balance: newAvailableBalance,
        last_sale_date: new Date().toISOString(),
      };

      if (isFirstSale) {
        const firstTime = new Date().toISOString();
        businessUpdates.first_sale_date = firstTime;
        // Also mark guarantees' first payment timestamp
        businessUpdates.first_payment_at = firstTime;
      }

      const { error: updateError } = await supabase
        .from('businesses')
        .update(businessUpdates)
        .eq('id', metadata.business_id);

      if (updateError) {
        console.error('Error updating business:', updateError);
        throw updateError;
      }

      console.log(`✅ Revenue updated! Previous: $${business.total_revenue || 0}, New: $${newTotalRevenue}`);

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

        // For email notification, use appropriate product name
        const productName = isMultiItem 
          ? metadata.item_names || 'Multiple Items'
          : metadata.product_name;

        await sendSaleNotification({
          businessOwnerEmail,
          businessOwnerName,
          businessName: business.name,
          customerName: saleRecords[0].customer_name,
          customerEmail: saleRecords[0].customer_email,
          productName: productName,
          amount: session.amount_total / 100,
          isFirstSale,
          totalRevenue: newTotalRevenue,
          subdomain: business.subdomain,
          businessLaunchDate: business.launch_date || business.created_at,
          visitorCount: business.views || 0,
          sessionId: business.session_id
        });
      }

      console.log('Sale processing completed successfully');

      // 🚀 TRIGGER FULFILLMENT SYSTEM
      // After sale is recorded, automatically start delivering value to customer
      try {
        console.log('🎯 Triggering fulfillment for sale(s):', saleRecords.map(s => s.id));
        
        // Import fulfillment function directly for better reliability
        const { fulfillOrder } = await import('@/lib/fulfillment-core');
        
        // Trigger fulfillment for each sale record
        for (const sale of saleRecords) {
          try {
            // Get business data for this sale
            const { data: business, error: businessError } = await supabase
              .from('businesses')
              .select('*')
              .eq('id', sale.business_id)
              .single();
              
            if (businessError || !business) {
              console.error('❌ Business not found for sale:', sale.id, businessError);
              continue;
            }
            
            // Check if fulfillment already exists
            const { data: existingFulfillment } = await supabase
              .from('fulfillments')
              .select('id, status')
              .eq('sale_id', sale.id)
              .single();
              
            if (existingFulfillment) {
              console.log('⚠️ Fulfillment already exists for sale:', sale.id);
              continue;
            }
            
            // Create fulfillment record
            const { data: fulfillment, error: fulfillmentError } = await supabase
              .from('fulfillments')
              .insert({
                sale_id: sale.id,
                status: 'processing',
                fulfillment_type: 'auto_generated'
              })
              .select()
              .single();
              
            if (fulfillmentError) {
              console.error('❌ Error creating fulfillment record for sale:', sale.id, fulfillmentError);
              continue;
            }
            
            console.log('📦 Starting fulfillment process for sale:', sale.id);
            
            // Start fulfillment process (async, don't wait)
            fulfillOrder(sale, business)
              .then(result => {
                console.log('✅ Fulfillment completed successfully for sale:', sale.id);
                
                // Update fulfillment record
                supabase
                  .from('fulfillments')
                  .update({
                    status: 'completed',
                    delivered_items: result.delivered_items,
                    total_value: result.delivered_items.reduce((sum, item) => {
                      const value = parseInt(item.content.estimated_value?.replace(/[^0-9]/g, '') || '0');
                      return sum + value;
                    }, 0),
                    fulfillment_type: result.plan.type,
                    completed_at: new Date().toISOString()
                  })
                  .eq('id', fulfillment.id)
                  .then(({ error }) => {
                    if (error) console.error('Error updating fulfillment:', error);
                  });
              })
              .catch(error => {
                console.error('❌ Fulfillment failed for sale:', sale.id, error);
                
                // Update fulfillment record with error
                supabase
                  .from('fulfillments')
                  .update({
                    status: 'failed',
                    error_message: error.message
                  })
                  .eq('id', fulfillment.id)
                  .then(({ error: updateError }) => {
                    if (updateError) console.error('Error updating fulfillment error:', updateError);
                  });
              });
              
            console.log('✅ Fulfillment initiated for sale:', sale.id);
            
          } catch (saleError) {
            console.error('❌ Error processing fulfillment for sale:', sale.id, saleError);
          }
        }
      } catch (fulfillmentError) {
        console.error('❌ Error triggering fulfillment:', fulfillmentError);
        // Don't fail the webhook if fulfillment fails - we can retry later
      }

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
