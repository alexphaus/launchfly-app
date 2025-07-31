import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { businessId, saleId, type = 'sale' } = await request.json();
    
    // Get business and sale data
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    const { data: sale } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();
    
    if (!business || !sale) {
      return Response.json({ error: 'Business or sale not found' }, { status: 404 });
    }
    
    const ownerEmail = business.form_data?.email;
    const ownerPhone = business.phone_number;
    
    // Send email notification
    if (ownerEmail && type === 'sale') {
      await sendInstantSaleEmail(ownerEmail, business, sale);
    }
    
    // Send SMS notification
    if (ownerPhone && type === 'sale') {
      await sendInstantSaleSMS(ownerPhone, business, sale);
    }
    
    return Response.json({ success: true });
    
  } catch (error) {
    console.error('Error sending notification:', error);
    return Response.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}

async function sendInstantSaleEmail(email, business, sale) {
  await resend.emails.send({
    from: 'Launchfly Sales <sales@launchfly.ai>',
    to: email,
    subject: `🎉 INSTANT SALE ALERT: $${Number(sale.amount).toFixed(2)} from ${business.name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px;">🎉 SALE ALERT!</h1>
          <div style="font-size: 36px; font-weight: bold; margin: 10px 0;">
            $${Number(sale.amount).toFixed(2)}
          </div>
          <p style="margin: 0; opacity: 0.9;">Just earned from ${business.name}</p>
        </div>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #1f2937;">Sale Details</h3>
          <p style="margin: 5px 0;"><strong>Customer:</strong> ${sale.customer_name || sale.customer_email}</p>
          <p style="margin: 5px 0;"><strong>Product:</strong> ${sale.product_id}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date(sale.created_at).toLocaleString()}</p>
        </div>
        
        <div style="text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_URL}/dashboard/${business.session_id}" 
             style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            View Dashboard →
          </a>
        </div>
      </div>
    `
  });
}

async function sendInstantSaleSMS(phoneNumber, business, sale) {
  try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      await client.messages.create({
        body: `🎉 SALE! $${Number(sale.amount).toFixed(2)} just came in from ${business.name}! Customer: ${sale.customer_name || sale.customer_email}. View details at ${process.env.NEXT_PUBLIC_URL}/dashboard/${business.session_id}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
    }
  } catch (error) {
    console.error('SMS notification error:', error);
  }
}
