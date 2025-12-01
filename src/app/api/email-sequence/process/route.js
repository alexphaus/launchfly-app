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
// GET export moved to bottom


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
 * Build HTML email template with day-specific CTAs and offers
 * Designed like top marketing emails (HubSpot, Mailchimp style)
 */
function buildEmailHtml({ subject, body, businessName, phone, day, email, businessId }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://launchfly.ai';
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(email || '')}&businessId=${businessId || ''}`;
  
  // Different CTAs based on the day in sequence
  const ctaConfig = {
    1: { text: 'Read Your Free Guide', color: '#2563eb', urgent: false, subtext: 'Attached to this email' },
    2: { text: 'Get Your Free Quote', color: '#2563eb', urgent: false, subtext: 'No obligation, no pressure' },
    3: { text: 'Get the Same Results', color: '#2563eb', urgent: false, subtext: 'Free consultation included' },
    4: { text: 'Claim 15% Off Now', color: '#16a34a', urgent: true, subtext: 'Use code: GUIDE15' },
    5: { text: 'Last Chance - Call Now', color: '#dc2626', urgent: true, subtext: 'Expires at midnight!' }
  };
  
  const cta = ctaConfig[day] || { text: 'Contact Us', color: '#2563eb', urgent: false, subtext: '' };
  const isUrgent = cta.urgent;
  
  // Format body with proper paragraphs
  const formattedBody = body
    .split('\n\n')
    .map(para => `<p style="margin: 0 0 16px 0;">${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Preheader (hidden preview text) -->
        <div style="display: none; max-height: 0; overflow: hidden;">
          ${isUrgent ? '⏰ Limited time offer inside - ' : ''}${subject}
        </div>
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${isUrgent ? '#dc2626' : '#1e40af'} 0%, ${isUrgent ? '#f59e0b' : '#3b82f6'} 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">${businessName}</h1>
          ${isUrgent ? `
          <div style="background: #ffffff; color: #dc2626; padding: 10px 20px; border-radius: 25px; display: inline-block; margin-top: 20px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">
            ${day === 4 ? '⏰ LIMITED TIME OFFER - 72 HOURS LEFT' : '🔥 FINAL NOTICE - EXPIRES TONIGHT'}
          </div>
          ` : `
          <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px;">Your ${day === 1 ? 'free guide' : 'Expert Guide Series'} • Email ${day} of 5</p>
          `}
        </div>
        
        <!-- Main Content -->
        <div style="background: #ffffff; padding: 40px 35px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
          
          <!-- Email Body -->
          <div style="font-size: 16px; line-height: 1.8; color: #374151;">
            ${formattedBody}
          </div>
          
          <!-- Primary CTA Section -->
          <div style="text-align: center; margin: 35px 0; padding: 30px; background: ${isUrgent ? 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)' : 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)'}; border-radius: 12px; ${isUrgent ? 'border: 2px dashed #dc2626;' : 'border: 1px solid #e0e7ff;'}">
            
            ${isUrgent ? `
            <div style="background: #dc2626; color: white; padding: 6px 14px; border-radius: 20px; display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 15px;">
              ${day === 4 ? 'OFFER EXPIRES IN 72 HOURS' : 'LAST CHANCE - EXPIRES TONIGHT'}
            </div>
            ` : ''}
            
            <p style="margin: 0 0 20px 0; color: ${isUrgent ? '#b91c1c' : '#1e40af'}; font-weight: 600; font-size: 20px;">
              ${isUrgent ? "Don't let this slip away!" : 'Ready to take the next step?'}
            </p>
            
            ${phone ? `
              <a href="tel:${phone}" style="display: inline-block; background: ${cta.color}; color: #ffffff; padding: 18px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
                📞 ${cta.text}
              </a>
              
              <div style="margin-top: 15px;">
                 <a href="https://api.whatsapp.com/send?phone=${phone.replace(/[^0-9]/g, '')}" style="color: ${cta.color}; text-decoration: none; font-weight: 600; font-size: 15px;">
                   Or chat on WhatsApp 💬
                 </a>
              </div>
            ` : `
              <a href="mailto:?subject=I'm interested in your services" style="display: inline-block; background: ${cta.color}; color: #ffffff; padding: 18px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
                ✉️ Reply to Contact
              </a>
            `}
            
            <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px;">
              ${cta.subtext}
            </p>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid ${isUrgent ? '#fecaca' : '#e0e7ff'};">
              ${phone ? `
                <p style="margin: 0; color: #374151; font-size: 15px;">
                  <strong>Call now:</strong> <a href="tel:${phone}" style="color: ${cta.color}; text-decoration: none; font-weight: 600;">${phone}</a>
                </p>
              ` : ''}
              ${isUrgent && day === 4 ? `
              <p style="margin: 10px 0 0 0; background: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 6px; font-size: 14px; display: inline-block;">
                🏷️ Mention code <strong>GUIDE15</strong> for your discount
              </p>
              ` : ''}
            </div>
            
          </div>
          
          ${day >= 3 ? `
          <!-- Trust Badges -->
          <div style="display: flex; justify-content: center; gap: 20px; margin: 25px 0; flex-wrap: wrap;">
            <div style="text-align: center; padding: 10px 15px;">
              <div style="font-size: 24px; margin-bottom: 5px;">⭐</div>
              <div style="font-size: 12px; color: #64748b;">5-Star Rated</div>
            </div>
            <div style="text-align: center; padding: 10px 15px;">
              <div style="font-size: 24px; margin-bottom: 5px;">✓</div>
              <div style="font-size: 12px; color: #64748b;">Licensed & Insured</div>
            </div>
            <div style="text-align: center; padding: 10px 15px;">
              <div style="font-size: 24px; margin-bottom: 5px;">💬</div>
              <div style="font-size: 12px; color: #64748b;">100+ Happy Clients</div>
            </div>
          </div>
          ` : ''}
          
        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; padding: 25px 30px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
          <p style="margin: 0; color: #374151; font-size: 14px; font-weight: 500;">
            ${businessName}
          </p>
          <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px;">
            &copy; ${new Date().getFullYear()} All rights reserved.
          </p>
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #94a3b8; font-size: 12px;">
              You received this because you downloaded our free guide.
            </p>
            <p style="margin: 8px 0 0 0;">
              <a href="${unsubscribeUrl}" style="color: #94a3b8; font-size: 12px; text-decoration: underline;">Unsubscribe from these emails</a>
            </p>
          </div>
        </div>
        
      </div>
    </body>
    </html>
  `;
}

// Also support POST for manual triggering with options
export async function POST(request) {
  try {
    const body = await request.json();
    return processEmailSequence(request, body);
  } catch (e) {
    // If no body or invalid json, just run standard process
    return processEmailSequence(request, {});
  }
}

export async function GET(request) {
  return processEmailSequence(request, {});
}

async function processEmailSequence(request, options = {}) {
  // Verify cron secret for security (optional but recommended)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow test mode to bypass auth if explicitly requested from dashboard (with session check ideally, but keeping simple for now)
  const isTestMode = options.testMode || false;
  const targetEmail = options.targetEmail;
  
  if (!isTestMode && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

    // Build query
    let query = supabase
      .from('customers')
      .select(`
        id,
        email,
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
      .lt('email_sequence_day', 5);

    // If test mode and target email, ignore time check
    if (isTestMode && targetEmail) {
      query = query.eq('email', targetEmail);
      console.log(`🧪 Test mode: Forcing email for ${targetEmail}`);
    } else {
      // Standard mode: check time
      query = query.lte('next_email_at', now.toISOString());
    }
      
    const { data: pendingLeads, error: fetchError } = await query.limit(50); // Process in batches

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
