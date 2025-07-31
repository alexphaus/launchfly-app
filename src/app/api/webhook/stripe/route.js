import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { headers } from 'next/headers';
import twilio from 'twilio';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const twilioClient = process.env.TWILIO_ACCOUNT_SID ? 
  twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : 
  null;

// Disable body parsing, need raw body for webhook signature verification
export const runtime = 'nodejs';
export const preferredRegion = 'auto';

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
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('Payment successful:', session);
      
      const businessId = session.metadata.businessId;
      const productId = session.metadata.productId;
      const businessSubdomain = session.metadata.businessSubdomain;
      const businessOwnerEmail = session.metadata.businessOwnerEmail;
      const businessOwnerName = session.metadata.businessOwnerName;
      
      try {
        // Record the sale in database
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert({
            business_id: businessId,
            product_id: productId,
            amount: session.amount_total / 100, // Convert from cents
            currency: session.currency,
            customer_email: session.customer_details.email,
            customer_name: session.customer_details.name,
            stripe_session_id: session.id,
            payment_status: 'completed'
          })
          .select()
          .single();
          
        if (saleError) {
          console.error('Error recording sale:', saleError);
        }
        
        // Check if this is the first sale for the business
        const { data: salesCount, error: countError } = await supabase
          .from('sales')
          .select('id', { count: 'exact' })
          .eq('business_id', businessId);
          
        const isFirstSale = salesCount?.length === 1;
        
        // Update business metrics
        let newRevenue = 0;
        const { data: business, error: bizError } = await supabase
          .from('businesses')
          .select('total_revenue, views, first_sale_date')
          .eq('id', businessId)
          .single();
          
        if (!bizError && business) {
          // Parse numeric type and add new sale amount
          const currentRevenue = parseFloat(business.total_revenue || 0);
          newRevenue = currentRevenue + (session.amount_total / 100);
          
          const updateData = {
            total_revenue: newRevenue,
            last_sale_date: new Date().toISOString()
          };
          
          if (isFirstSale) {
            updateData.first_sale_date = new Date().toISOString();
          }
          
          await supabase
            .from('businesses')
            .update(updateData)
            .eq('id', businessId);
        }
        
        // Send email notification
        if (businessOwnerEmail) {
          // Get session ID from business if available
          const { data: businessWithSession } = await supabase
            .from('businesses')
            .select('session_id')
            .eq('id', businessId)
            .single();
            
          const dashboardUrl = businessWithSession?.session_id 
            ? `${process.env.NEXT_PUBLIC_URL}/dashboard/${businessWithSession.session_id}`
            : `${process.env.NEXT_PUBLIC_URL}/dashboard`;
            
          const emailContent = isFirstSale ? {
            subject: `🎉 Congratulations! Your First Sale on Launchfly!`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #5D5FEF;">🎉 You Made Your First Sale!</h1>
                
                <p style="font-size: 18px; line-height: 1.6;">
                  Congratulations ${businessOwnerName || 'there'}!<br><br>
                  
                  You just made your <strong>FIRST SALE</strong> on your Launchfly business!
                </p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Sale Details:</h3>
                  <p><strong>Amount:</strong> $${(session.amount_total / 100).toFixed(2)}</p>
                  <p><strong>Customer:</strong> ${session.customer_details.name || 'Anonymous'}</p>
                  <p><strong>Email:</strong> ${session.customer_details.email}</p>
                </div>
                
                <p style="font-size: 16px;">
                  This is just the beginning! The AI is working 24/7 to find more customers and optimize your business.
                </p>
                
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${dashboardUrl}" 
                     style="background: linear-gradient(135deg, #5D5FEF 0%, #00D4FF 100%); 
                            color: white; 
                            padding: 16px 32px; 
                            text-decoration: none; 
                            border-radius: 8px; 
                            font-size: 18px; 
                            font-weight: bold; 
                            display: inline-block;">
                    View Your Dashboard →
                  </a>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                  <strong>Pro Tip:</strong> Check your dashboard to see AI-generated insights on how to get your next sale even faster!
                </p>
              </div>
            `
          } : {
            subject: `💰 New Sale Alert - $${(session.amount_total / 100).toFixed(2)}!`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #5D5FEF;">💰 You Made a Sale!</h1>
                
                <p style="font-size: 18px; line-height: 1.6;">
                  Great news ${businessOwnerName || 'there'}!<br><br>
                  
                  You just made another sale on your Launchfly business!
                </p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Sale Details:</h3>
                  <p><strong>Amount:</strong> $${(session.amount_total / 100).toFixed(2)}</p>
                  <p><strong>Customer:</strong> ${session.customer_details.name || 'Anonymous'}</p>
                  <p><strong>Email:</strong> ${session.customer_details.email}</p>
                  <p><strong>Total Revenue:</strong> $${newRevenue.toFixed(2)}</p>
                </div>
                
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${dashboardUrl}" 
                     style="background: linear-gradient(135deg, #5D5FEF 0%, #00D4FF 100%); 
                            color: white; 
                            padding: 16px 32px; 
                            text-decoration: none; 
                            border-radius: 8px; 
                            font-size: 18px; 
                            font-weight: bold; 
                            display: inline-block;">
                    View Your Dashboard →
                  </a>
                </div>
              </div>
            `
          };
          
          await resend.emails.send({
            from: 'Launchfly <sales@launchfly.ai>',
            to: businessOwnerEmail,
            ...emailContent
          });
        }
        
        // Send SMS notification if phone number exists
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
          const { data: businessPhone } = await supabase
            .from('businesses')
            .select('phone_number')
            .eq('id', businessId)
            .single();
            
          if (businessPhone?.phone_number) {
            const smsMessage = isFirstSale 
              ? `🎉 Congratulations! You just made your FIRST SALE for $${(session.amount_total / 100).toFixed(2)}! Check your dashboard to see details.`
              : `💰 New sale alert! You just made $${(session.amount_total / 100).toFixed(2)}. Total revenue: $${newRevenue.toFixed(2)}`;
              
            try {
              await twilioClient.messages.create({
                body: smsMessage,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: businessPhone.phone_number
              });
            } catch (smsError) {
              console.error('SMS notification error:', smsError);
            }
          }
        }
        
        console.log('Sale processed successfully:', { businessId, isFirstSale, amount: session.amount_total / 100 });
        
      } catch (error) {
        console.error('Error processing sale:', error);
      }
      
      break;
    }
    
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object;
      console.log('Payment failed:', paymentIntent);
      // Handle failed payment
      break;
    }
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response('Success', { status: 200 });
}
