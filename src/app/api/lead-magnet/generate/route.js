import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { businessId, topic, audience, language = 'English' } = await request.json();

    if (!businessId || !topic) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`Genering lead magnet for business ${businessId} on topic: ${topic}`);

    const prompt = `
      You are an expert marketing strategist for LOCAL SERVICE BUSINESSES. Create a high-converting Lead Magnet Asset (Checklist, Price Guide, or Coupon) and Landing Page copy for a local business specializing in: "${topic}".
      
      Target Audience: ${audience || 'Local Homeowners'}
      Language: ${language}
      
      Return a JSON object with this EXACT structure:
      {
        "lead_magnet_title": "Catchy Title for the Asset",
        "lead_magnet_content": [
          { "title": "Section 1", "body": "..." },
          { "title": "Section 2", "body": "..." },
          { "title": "Section 3", "body": "..." }
        ],
        "landing_page": {
          "headline": "Main Headline for Landing Page",
          "subheadline": "Supporting subheadline",
          "cta_text": "Get My Free Quote / Guide",
          "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
          "about_business": "Short professional bio for a local business in this niche (max 50 words)"
        },
        "email_sequence": [
          { "day": 1, "subject": "...", "body": "..." },
          { "day": 2, "subject": "...", "body": "..." },
          { "day": 3, "subject": "...", "body": "..." }
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4-turbo-preview', // Use a smart model
      response_format: { type: 'json_object' },
    });

    const content = JSON.parse(completion.choices[0].message.content);

    // Update business with this content
    // We'll store it in business_data json column
    
    const { data: business } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', businessId)
        .single();

    const currentData = business?.business_data || {};
    
    // Store content in both old and new format for compatibility
    await supabase
      .from('businesses')
      .update({
        name: content.lead_magnet_title || 'Lead Magnet Funnel',
        status: 'active',
        business_data: {
          ...currentData,
          // New format
          leadMagnet: content,
          // Dashboard expected format
          lead_magnet_title: content.lead_magnet_title,
          lead_magnet_content: content.lead_magnet_content,
          landing_page: content.landing_page,
          email_sequence: content.email_sequence
        }
      })
      .eq('id', businessId);

    // Also update the session stage to complete
    await supabase
      .from('sessions')
      .update({ stage: 'complete', progress: 100 })
      .eq('business_id', businessId);

    console.log('Lead magnet generated successfully');

    // Send welcome email with dashboard and funnel links
    try {
      // Fetch business with subdomain and session info
      const { data: businessFull } = await supabase
        .from('businesses')
        .select('id, name, subdomain, business_data, session_id, source')
        .eq('id', businessId)
        .single();
      
      if (businessFull) {
        let customerEmail = null;
        
        // Try to get email from Stripe session
        if (businessFull.source?.startsWith('claimed-prospect:')) {
          const stripeSessionId = businessFull.source.replace('claimed-prospect:', '');
          try {
            const Stripe = (await import('stripe')).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            const stripeSession = await stripe.checkout.sessions.retrieve(stripeSessionId);
            customerEmail = stripeSession.customer_details?.email || stripeSession.customer_email;
          } catch (e) {
            console.error('Failed to fetch Stripe session for email:', e.message);
          }
        }
        
        if (customerEmail) {
          const businessName = businessFull.business_data?.businessName || businessFull.name || 'Your Business';
          const dashboardUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'https://www.launchfly.ai'}/dashboard/${businessFull.session_id}`;
          const funnelUrl = `https://${businessFull.subdomain}.launchfly.ai`;
          
          console.log(`📧 Sending welcome email to: ${customerEmail}`);
          
          await resend.emails.send({
            from: 'Launchfly <hello@launchfly.ai>',
            to: customerEmail,
            subject: `🚀 Your Funnel is Ready: ${businessName}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #7c3aed; margin: 0;">🎉 Your Funnel is Live!</h1>
                </div>
                
                <p>Hey there!</p>
                
                <p>Great news – your <strong>${businessName}</strong> lead generation funnel is now fully set up and ready to start capturing leads!</p>
                
                <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
                  <p style="color: white; margin: 0 0 15px 0; font-size: 16px;">Your Dashboard</p>
                  <a href="${dashboardUrl}" style="display: inline-block; background: white; color: #7c3aed; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Go to Dashboard →</a>
                </div>
                
                <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 25px 0;">
                  <h3 style="margin: 0 0 15px 0; color: #333;">🔗 Your Links</h3>
                  <p style="margin: 8px 0;"><strong>Dashboard:</strong><br><a href="${dashboardUrl}" style="color: #7c3aed;">${dashboardUrl}</a></p>
                  <p style="margin: 8px 0;"><strong>Your Funnel:</strong><br><a href="${funnelUrl}" style="color: #7c3aed;">${funnelUrl}</a></p>
                </div>
                
                <h3 style="color: #333;">📋 Quick Start Checklist</h3>
                <ul style="padding-left: 20px;">
                  <li>✅ Share your funnel link on social media</li>
                  <li>✅ Add it to your email signature</li>
                  <li>✅ Connect your Stripe to accept payments</li>
                  <li>✅ Set up your phone notifications in the dashboard</li>
                </ul>
                
                <p>Save this email – you can use these links anytime to access your dashboard and funnel.</p>
                
                <p>Questions? Just reply to this email!</p>
                
                <p style="margin-top: 30px;">
                  Let's get you some leads! 🚀<br>
                  <strong>The Launchfly Team</strong>
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #888; font-size: 12px; text-align: center;">
                  Launchfly - AI-Powered Lead Generation<br>
                  <a href="https://www.launchfly.ai" style="color: #888;">www.launchfly.ai</a>
                </p>
              </body>
              </html>
            `
          });
          console.log(`✅ Welcome email sent to: ${customerEmail}`);
        }
      }
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError.message);
      // Don't fail the request - email is nice to have
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Lead magnet generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}


