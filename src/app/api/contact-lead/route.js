// app/api/contact-lead/route.js
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { businessId, formData, source } = await request.json();
    
    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*, form_data')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      throw new Error('Business not found');
    }

    // Save lead to database
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        business_id: businessId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        message: formData.message,
        service_interest: formData.service,
        source: source,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (leadError) {
      console.error('Error saving lead:', leadError);
      // Continue even if lead save fails
    }

    // Send notification to business owner
    const businessOwnerEmail = business.form_data?.email;
    const businessName = business.business_data?.businessName || business.name;

    if (businessOwnerEmail && resend) {
      try {
        await resend.emails.send({
          from: 'Launchfly <leads@launchfly.ai>',
          to: businessOwnerEmail,
          subject: `🎉 New lead for ${businessName}!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #007BFF;">New Lead Alert! 🎉</h1>
              
              <p>Great news! You just received a new lead through your website.</p>
              
              <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Lead Details:</h3>
                <p><strong>Name:</strong> ${formData.name}</p>
                <p><strong>Email:</strong> ${formData.email}</p>
                ${formData.phone ? `<p><strong>Phone:</strong> ${formData.phone}</p>` : ''}
                ${formData.service ? `<p><strong>Service Interest:</strong> ${formData.service}</p>` : ''}
                <p><strong>Message:</strong></p>
                <p style="background: white; padding: 15px; border-left: 4px solid #007BFF;">${formData.message}</p>
              </div>
              
              <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>🚀 Quick Response Tips:</h3>
                <ul>
                  <li>Respond within 1 hour for best conversion rates</li>
                  <li>Reference their specific message in your reply</li>
                  <li>Offer a quick consultation call</li>
                  <li>Include your calendar link for easy booking</li>
                </ul>
              </div>
              
              <p>Remember: The faster you respond, the more likely you are to convert this lead into a customer!</p>
              
              <hr>
              <p style="color: #666; font-size: 14px;">
                This lead came through your Launchfly website. 
                <a href="${process.env.NEXT_PUBLIC_URL}/dashboard">View your dashboard</a> for more details.
              </p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Error sending notification email:', emailError);
      }
    }

    // Send auto-response to lead
    if (resend) {
      try {
        await resend.emails.send({
          from: `${businessName} <hello@launchfly.ai>`,
          to: formData.email,
          subject: `Thank you for contacting ${businessName}!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #007BFF;">Thank You ${formData.name}!</h1>
              
              <p>Thank you for reaching out to ${businessName}. We've received your message and will get back to you within 24 hours.</p>
              
              <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Your Message:</h3>
                <p style="background: white; padding: 15px; border-left: 4px solid #007BFF;">${formData.message}</p>
              </div>
              
              <p>In the meantime, feel free to:</p>
              <ul>
                <li>Check out our other services on our website</li>
                <li>Follow us on social media for tips and updates</li>
                <li>Reply to this email if you have any additional questions</li>
              </ul>
              
              <p>We're excited to help you achieve your goals!</p>
              
              <p>Best regards,<br>
              The ${businessName} Team</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Error sending auto-response:', emailError);
      }
    }

    // Track conversion
    await trackConversion(businessId, 'lead_generated');

    return Response.json({ 
      success: true, 
      message: 'Lead captured successfully',
      leadId: lead?.id 
    });

  } catch (error) {
    console.error('Contact lead error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process contact form',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function trackConversion(businessId, conversionType) {
  try {
    await supabase
      .from('conversions')
      .insert({
        business_id: businessId,
        conversion_type: conversionType,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error tracking conversion:', error);
  }
}
