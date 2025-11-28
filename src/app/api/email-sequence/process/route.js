import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Email Sequence Processor
 * 
 * This endpoint processes scheduled emails for leads in an email nurture sequence.
 * It should be called periodically (e.g., every hour) via cron job or Vercel Cron.
 * 
 * The sequence works like this:
 * - Day 1: Sent immediately when they sign up (handled by capture route)
 * - Day 2-5: Sent automatically by this processor
 */
export async function GET(request) {
  // Verify cron secret for security (optional but recommended)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow without auth in development
    if (process.env.NODE_ENV === 'production') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const results = {
      processed: 0,
      sent: 0,
      errors: 0,
      completed: 0,
      details: []
    };

    // Find all leads who need their next email
    // They must have:
    // 1. email_sequence_day < 5 (not completed)
    // 2. next_email_at <= now (time to send)
    // 3. status = 'lead' (still a lead, not converted)
    // 4. accepts_marketing = true (not unsubscribed)
    const { data: pendingLeads, error: fetchError } = await supabase
      .from('customers')
      .select(`
        id,
        email,
        name,
        business_id,
        email_sequence_day,
        businesses (
          id,
          name,
          business_data,
          phone_number
        )
      `)
      .eq('status', 'lead')
      .eq('source', 'lead_magnet')
      .eq('accepts_marketing', true)
      .lt('email_sequence_day', 5)
      .lte('next_email_at', now.toISOString())
      .limit(50); // Process in batches

    if (fetchError) {
      console.error('Error fetching pending leads:', fetchError);
      return Response.json({ error: 'Database error', details: fetchError.message }, { status: 500 });
    }

    if (!pendingLeads || pendingLeads.length === 0) {
      return Response.json({ 
        message: 'No emails to send',
        ...results
      });
    }

    console.log(`📬 Processing ${pendingLeads.length} pending emails...`);

    for (const lead of pendingLeads) {
      results.processed++;
      
      try {
        const business = lead.businesses;
        if (!business) {
          console.log(`⚠️ No business found for lead ${lead.id}`);
          continue;
        }

        const businessData = business.business_data || {};
        const emailSequence = businessData.email_sequence || [];
        const nextDay = (lead.email_sequence_day || 1) + 1;
        
        // Find the email for this day
        const emailToSend = emailSequence.find(e => e.day === nextDay);
        
        if (!emailToSend) {
          console.log(`⚠️ No email template for day ${nextDay} for lead ${lead.id}`);
          // Mark as completed if no more emails
          await supabase
            .from('customers')
            .update({
              email_sequence_day: 5,
              email_sequence_completed_at: now.toISOString()
            })
            .eq('id', lead.id);
          results.completed++;
          continue;
        }

        // Personalize email content
        const personalizedBody = personalizeEmail(emailToSend.body, {
          name: lead.name || 'there',
          businessName: businessData.businessName || business.name,
          niche: businessData.niche || 'service',
          phone: business.phone_number || businessData.phone || ''
        });

        // Build HTML email
        const html = buildEmailHtml({
          subject: emailToSend.subject,
          body: personalizedBody,
          businessName: businessData.businessName || business.name,
          phone: business.phone_number || businessData.phone,
          day: nextDay,
          email: lead.email,
          businessId: business.id
        });

        // Send email
        await resend.emails.send({
          from: 'Launchfly <hello@launchfly.ai>',
          to: lead.email,
          subject: emailToSend.subject,
          html: html
        });

        // Update customer record
        const isLastEmail = nextDay >= 5;
        await supabase
          .from('customers')
          .update({
            email_sequence_day: nextDay,
            last_email_sent_at: now.toISOString(),
            next_email_at: isLastEmail ? null : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
            email_sequence_completed_at: isLastEmail ? now.toISOString() : null
          })
          .eq('id', lead.id);

        // Log activity
        await supabase
          .from('ai_activities')
          .insert({
            business_id: business.id,
            type: 'email_sequence',
            icon: 'M',
            message: `Email ${nextDay}/5 sent`,
            details: `Sent "${emailToSend.subject}" to ${lead.email}`,
            metadata: {
              recipientEmail: lead.email,
              recipientName: lead.name,
              customerId: lead.id,
              emailDay: nextDay
            }
          });

        results.sent++;
        results.details.push({
          email: lead.email,
          day: nextDay,
          subject: emailToSend.subject,
          status: 'sent'
        });

        console.log(`✅ Sent day ${nextDay} email to ${lead.email}`);

      } catch (emailError) {
        console.error(`❌ Error sending email to ${lead.email}:`, emailError);
        results.errors++;
        results.details.push({
          email: lead.email,
          error: emailError.message,
          status: 'failed'
        });
      }
    }

    console.log(`📊 Email sequence processing complete: ${results.sent} sent, ${results.errors} errors`);

    return Response.json({
      success: true,
      message: `Processed ${results.processed} leads, sent ${results.sent} emails`,
      ...results
    });

  } catch (error) {
    console.error('Email sequence processor error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Personalize email content with lead/business data
 */
function personalizeEmail(body, data) {
  let personalized = body;
  
  // Replace common placeholders
  personalized = personalized.replace(/\{name\}/gi, data.name);
  personalized = personalized.replace(/\{firstName\}/gi, data.name);
  personalized = personalized.replace(/\{businessName\}/gi, data.businessName);
  personalized = personalized.replace(/\{niche\}/gi, data.niche);
  personalized = personalized.replace(/\{phone\}/gi, data.phone);
  
  return personalized;
}

/**
 * Build HTML email template
 */
function buildEmailHtml({ subject, body, businessName, phone, day, email, businessId }) {
  const ctaText = day >= 4 ? 'Schedule Your Free Consultation' : 'Learn More';
  const ctaLink = phone ? `tel:${phone}` : '#';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://launchfly.ai';
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(email || '')}&businessId=${businessId || ''}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${businessName}</h1>
          <p style="color: #bfdbfe; margin: 10px 0 0 0; font-size: 14px;">Day ${day} of your Expert Guide Series</p>
        </div>
        
        <!-- Content -->
        <div style="background: #ffffff; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
          <div style="font-size: 16px; line-height: 1.7; color: #374151;">
            ${body.replace(/\n/g, '<br>')}
          </div>
          
          ${phone ? `
          <!-- CTA -->
          <div style="text-align: center; margin-top: 30px; padding: 25px; background: #f0f9ff; border-radius: 8px;">
            <p style="margin: 0 0 15px 0; color: #0369a1; font-weight: 600;">Ready to take the next step?</p>
            <a href="tel:${phone}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              ${ctaText}
            </a>
            <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px;">
              Or call us directly: <strong>${phone}</strong>
            </p>
          </div>
          ` : ''}
        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
          <p style="margin: 0; color: #64748b; font-size: 12px;">
            &copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.
          </p>
          <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 11px;">
            You're receiving this because you downloaded our free guide.
          </p>
          <p style="margin: 10px 0 0 0;">
            <a href="${unsubscribeUrl}" style="color: #94a3b8; font-size: 11px; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
}

// Also support POST for manual triggering
export async function POST(request) {
  return GET(request);
}
