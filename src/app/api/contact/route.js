// app/api/contact/route.js
// Contact form submission handler for generated websites

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { name, email, phone, message, businessId, source } = await request.json();
    
    // Save lead to database
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        business_id: businessId,
        name,
        email,
        phone,
        message,
        source,
        status: 'new'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Get business owner's email
    const { data: business } = await supabase
      .from('businesses')
      .select('user_id, business_data, profiles!inner(email)')
      .eq('id', businessId)
      .single();
    
    // Send email notification to business owner
    await resend.emails.send({
      from: 'Launchfly <notifications@launchfly.ai>',
      to: business.profiles.email,
      subject: `New lead for ${business.business_data.businessName}!`,
      html: `
        <h2>You have a new lead!</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Message:</strong> ${message || 'No message'}</p>
        <hr>
        <p>Log in to your dashboard to manage this lead.</p>
      `
    });
    
    // Send auto-response to lead
    await resend.emails.send({
      from: `${business.business_data.businessName} <no-reply@launchfly.ai>`,
      to: email,
      subject: `Thanks for contacting ${business.business_data.businessName}`,
      html: `
        <h2>Thank you for reaching out!</h2>
        <p>We've received your message and will get back to you within 24 hours.</p>
        <p>Best regards,<br>${business.business_data.businessName}</p>
      `
    });
    
    // Track analytics
    await supabase
      .from('analytics')
      .insert({
        business_id: businessId,
        event_type: 'lead_captured',
        event_data: { source, lead_id: lead.id }
      });
    
    return Response.json({ success: true, leadId: lead.id });
    
  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit form' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
