// app/api/webhook/stripe/route.js
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleSuccessfulPayment(session);
      break;
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful:', paymentIntent.id);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

async function handleSuccessfulPayment(session) {
  try {
    console.log('Processing successful payment:', session.id);
    
    const {
      businessId,
      productId,
      businessSubdomain,
      businessOwnerEmail,
      businessOwnerName,
      businessUserId,
      isDemoMode
    } = session.metadata;

    // Handle demo mode purchases
    if (isDemoMode === 'true') {
      console.log('🎭 Demo purchase completed:', {
        sessionId: session.id,
        businessSubdomain,
        amount: session.amount_total / 100
      });
      
      // For demo mode, we don't record in database but can still send notification
      if (resend) {
        const amount = session.amount_total / 100;
        await resend.emails.send({
          from: 'Launchfly <demo@launchfly.ai>',
          to: 'demo@launchfly.ai', // Send to demo email
          subject: '🎭 Demo Purchase Completed!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #5D5FEF;">🎭 Demo Purchase Completed!</h1>
              
              <p style="font-size: 18px; line-height: 1.6;">
                A demo purchase was just completed!
              </p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Demo Purchase Details:</h3>
                <p><strong>Amount:</strong> $${amount}</p>
                <p><strong>Business:</strong> ${businessSubdomain}</p>
                <p><strong>Customer:</strong> ${session.customer_details?.name}</p>
                <p><strong>Email:</strong> ${session.customer_details?.email}</p>
              </div>
              
              <p style="color: #666;">
                This was a demo purchase to test the Stripe integration. No real money was processed.
              </p>
            </div>
          `
        });
      }
      
      console.log('Demo purchase notification sent');
      return;
    }

    // Handle real business purchases
    const { data: business } = await supabase
      .from('businesses')
      .select('total_revenue, first_sale_date')
      .eq('id', businessId)
      .single();

    const isFirstSale = !business?.first_sale_date;
    const amount = session.amount_total / 100; // Convert from cents

    // Record the sale
    const { error: saleError } = await supabase
      .from('sales')
      .insert({
        business_id: businessId,
        product_id: productId,
        customer_email: session.customer_details?.email,
        customer_name: session.customer_details?.name,
        amount: amount,
        currency: 'usd',
        stripe_session_id: session.id,
        payment_status: 'completed'
      });

    if (saleError) {
      console.error('Error recording sale:', saleError);
    }

    // Update business totals
    const newRevenue = (business?.total_revenue || 0) + amount;
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

    // Send email notification to business owner
    if (businessOwnerEmail && resend) {
      const emailSubject = isFirstSale ? 
        '🎉 Congratulations! Your first sale is here!' : 
        '💰 You just made another sale!';

      const emailContent = isFirstSale ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #5D5FEF;">🎉 Your First Sale!</h1>
          
          <p style="font-size: 18px; line-height: 1.6;">
            Congratulations ${businessOwnerName}!<br><br>
            You just made your very first sale! This is a huge milestone.
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Sale Details:</h3>
            <p><strong>Amount:</strong> $${amount}</p>
            <p><strong>Customer:</strong> ${session.customer_details?.name}</p>
            <p><strong>Email:</strong> ${session.customer_details?.email}</p>
          </div>
          
          <p>
            This proves your business idea works! Keep going - this is just the beginning.
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${process.env.NEXT_PUBLIC_URL}/dashboard" style="background: linear-gradient(135deg, #5D5FEF 0%, #00D4FF 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; display: inline-block;">
              View Your Dashboard →
            </a>
          </div>
        </div>
      ` : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #5D5FEF;">💰 Another Sale!</h1>
          
          <p style="font-size: 18px; line-height: 1.6;">
            Great news ${businessOwnerName}!<br><br>
            You just made another sale. Your business is growing!
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Sale Details:</h3>
            <p><strong>Amount:</strong> $${amount}</p>
            <p><strong>Customer:</strong> ${session.customer_details?.name}</p>
            <p><strong>Email:</strong> ${session.customer_details?.email}</p>
            <p><strong>Total Revenue:</strong> $${newRevenue}</p>
          </div>
        </div>
      `;

      await resend.emails.send({
        from: 'Launchfly <sales@launchfly.ai>',
        to: businessOwnerEmail,
        subject: emailSubject,
        html: emailContent
      });
    }

    console.log('Successfully processed payment and sent notifications');
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}