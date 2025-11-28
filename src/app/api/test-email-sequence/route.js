import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

// Sample high-converting email content (used when business doesn't have detailed emails)
const SAMPLE_EMAIL_SEQUENCE = [
  {
    day: 1,
    subject: "Your free guide is ready - here's what's inside",
    body: `Hey there!

Thank you so much for downloading our guide. I'm genuinely excited to share this with you.

Here's what you'll discover inside:

📖 **The 5 biggest mistakes** that cost homeowners thousands (and how to avoid them)
📖 **Insider pricing secrets** so you never overpay for services
📖 **Our simple checklist** that saves you time and headaches

I created this guide because I've seen too many people in our area get overcharged or end up with subpar work. It doesn't have to be that way.

**Your guide is attached to this email** - save it somewhere handy so you can reference it when you need it.

Got questions? Just hit reply - I read every message personally.

Looking forward to helping you,

The Team`
  },
  {
    day: 2,
    subject: "The 3 questions you MUST ask before hiring anyone",
    body: `Before you hire anyone, read this first...

I've been in this industry for years, and I've heard countless stories of homeowners who wished they'd asked these questions upfront.

**Question #1: "Can I see your license and insurance certificate?"**
This sounds basic, but you'd be shocked how many people skip it. If something goes wrong on your property and they're not insured, YOU could be liable.

**Question #2: "Can you provide 3 references from jobs in the last 6 months?"**
Old references don't count. You want to know what their recent work looks like and whether customers were happy.

**Question #3: "What exactly is included in your quote, and what's NOT included?"**
This is where hidden fees live. Get everything in writing before work begins.

*Quick story:* Last month, a customer called us after getting burned by another company. They quoted $800, but the final bill was $2,100 because of "unexpected issues." That never happens with us - we give you the real price upfront.

We're happy to answer these questions for you. Give us a call at {phone} for a free, no-pressure consultation.

Talk soon!`
  },
  {
    day: 3,
    subject: "[Case Study] How we helped Maria save $2,400",
    body: `I wanted to share a quick story with you...

**Meet Maria from downtown.**

Maria came to us after getting quotes from three other companies. The lowest quote she got was $4,200 for a job that seemed pretty straightforward.

Something felt off to her, so she called us for a second opinion.

**What we found:** The other companies were recommending a full replacement when all Maria needed was a targeted repair. Classic case of upselling.

**What we did:** Our team completed the repair in one afternoon - no unnecessary replacements, no surprise fees.

**The result:** Maria paid $1,800 instead of $4,200. That's **$2,400 saved** that she put toward her kitchen renovation instead.

Here's what Maria said:

*"I almost fell for it. Thank goodness I got a second opinion. These guys are honest and actually care about doing right by their customers."*

**Want results like Maria?**

We'd love to help you too. Call us at {phone} or just reply to this email - let's chat about what you need.

Cheers!`
  },
  {
    day: 4,
    subject: "🎁 Special offer: 15% off (expires in 72 hours)",
    body: `I wanted to reach out with something special for you...

Since you downloaded our guide, I know you're serious about making a smart decision for your home. So I've arranged an exclusive offer just for guide readers:

**🏷️ Get 15% OFF your first service with us.**

Why am I offering this? Honestly, we have some availability this week and I'd rather fill those spots with people like you who've already taken the time to educate themselves.

Here's what you get:
✅ 15% off any service (no minimum required)
✅ Free, no-obligation estimate
✅ Our satisfaction guarantee
✅ Priority scheduling this week

**⏰ But here's the catch:** This offer expires in 72 hours.

After that, I can't guarantee the same discount - our schedule fills up fast.

**To claim your discount:**
📞 Call us at {phone}
🏷️ Mention code **GUIDE15**

That's it. One quick call and you're locked in.

Talk soon,

P.S. - This offer expires on ${new Date(Date.now() + 72*60*60*1000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at midnight. Don't let it slip away!`
  },
  {
    day: 5,
    subject: "⚠️ Final notice: Your 15% discount expires TONIGHT",
    body: `This is it...

Your **15% discount expires at midnight tonight**, and I didn't want you to miss out.

I know life gets busy. But if you've been thinking about getting this done, now is the time to lock in your savings.

**Quick recap of what you're getting:**
✅ 15% off your first service
✅ Priority scheduling (we can often get you in within 48 hours)
✅ Free estimate - no pressure, no obligation
✅ Our 100% satisfaction guarantee

**17 other guide readers** have already claimed this offer this week. Don't be the one who misses out.

**Here's all you need to do:**
📞 Call {phone}
🏷️ Say "I have the GUIDE15 discount"

That's it. One quick call. Five minutes.

After midnight tonight, this offer is gone and the price goes back to normal.

Your move.

P.S. - Seriously, just pick up the phone. You'll thank yourself later. {phone}`
  }
];

/**
 * Test Email Sequence Endpoint
 * 
 * Sends all 5 emails from the sequence to a test email address
 * so you can preview how they look
 */
export async function POST(request) {
  try {
    const { businessId, testEmail } = await request.json();

    if (!businessId || !testEmail) {
      return Response.json({ error: 'Missing businessId or testEmail' }, { status: 400 });
    }

    // Get business data
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (bizError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessData = business.business_data || {};
    const businessName = businessData.businessName || business.name;
    const phone = business.phone_number || businessData.phone || '(555) 123-4567';
    const niche = businessData.niche || 'service';

    const results = [];

    // Send each email in the sequence
    for (let day = 1; day <= 5; day++) {
      // Use sample emails for testing (they're more compelling)
      const sampleEmail = SAMPLE_EMAIL_SEQUENCE.find(e => e.day === day);
      
      if (!sampleEmail) {
        results.push({ day, status: 'skipped', reason: 'No email template for this day' });
        continue;
      }

      // Personalize content
      const personalizedBody = sampleEmail.body
        .replace(/\{name\}/gi, 'there')
        .replace(/\{firstName\}/gi, 'there')
        .replace(/\{businessName\}/gi, businessName)
        .replace(/\{niche\}/gi, niche)
        .replace(/\{phone\}/gi, phone);

      const personalizedSubject = sampleEmail.subject
        .replace(/\{businessName\}/gi, businessName)
        .replace(/\{niche\}/gi, niche);

      // Build HTML
      const html = buildEmailHtml({
        subject: personalizedSubject,
        body: personalizedBody,
        businessName,
        phone,
        day,
        email: testEmail,
        businessId
      });

      // Send email
      try {
        await resend.emails.send({
          from: 'Launchfly <hello@launchfly.ai>',
          to: testEmail,
          subject: `[TEST Day ${day}] ${personalizedSubject}`,
          html: html
        });

        results.push({ day, status: 'sent', subject: personalizedSubject });
      } catch (emailError) {
        results.push({ day, status: 'failed', error: emailError.message });
      }

      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return Response.json({
      success: true,
      message: `Test emails sent to ${testEmail}`,
      results
    });

  } catch (error) {
    console.error('Test email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
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
  
  // Format body with proper paragraphs and markdown-like formatting
  const formattedBody = body
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .split('\n\n')
    .map(para => {
      // Handle bullet points
      if (para.includes('\n') && (para.includes('📖') || para.includes('✅') || para.includes('Question'))) {
        const lines = para.split('\n').map(line => 
          `<div style="margin: 8px 0; padding-left: 5px;">${line}</div>`
        ).join('');
        return `<div style="margin: 16px 0;">${lines}</div>`;
      }
      return `<p style="margin: 0 0 18px 0;">${para.replace(/\n/g, '<br>')}</p>`;
    })
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
          <div style="font-size: 16px; line-height: 1.75; color: #374151;">
            ${formattedBody}
          </div>
          
          ${phone ? `
          <!-- Primary CTA Section -->
          <div style="text-align: center; margin: 35px 0 0 0; padding: 30px; background: ${isUrgent ? 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)' : 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)'}; border-radius: 12px; ${isUrgent ? 'border: 2px dashed #dc2626;' : 'border: 1px solid #e0e7ff;'}">
            
            ${isUrgent ? `
            <div style="background: #dc2626; color: white; padding: 6px 14px; border-radius: 20px; display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 15px;">
              ${day === 4 ? 'OFFER EXPIRES IN 72 HOURS' : 'LAST CHANCE - EXPIRES TONIGHT'}
            </div>
            ` : ''}
            
            <p style="margin: 0 0 20px 0; color: ${isUrgent ? '#b91c1c' : '#1e40af'}; font-weight: 600; font-size: 20px;">
              ${isUrgent ? "Don't let this slip away!" : 'Ready to take the next step?'}
            </p>
            
            <a href="tel:${phone}" style="display: inline-block; background: ${cta.color}; color: #ffffff; padding: 18px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
              📞 ${cta.text}
            </a>
            
            <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px;">
              ${cta.subtext}
            </p>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid ${isUrgent ? '#fecaca' : '#e0e7ff'};">
              <p style="margin: 0; color: #374151; font-size: 15px;">
                <strong>Call now:</strong> <a href="tel:${phone}" style="color: ${cta.color}; text-decoration: none; font-weight: 600;">${phone}</a>
              </p>
              ${isUrgent && day === 4 ? `
              <p style="margin: 10px 0 0 0; background: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 6px; font-size: 14px; display: inline-block;">
                🏷️ Mention code <strong>GUIDE15</strong> for your discount
              </p>
              ` : ''}
            </div>
            
          </div>
          ` : ''}
          
          ${day >= 3 ? `
          <!-- Trust Badges -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
            <tr>
              <td align="center">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="text-align: center; padding: 10px 20px;">
                      <div style="font-size: 24px; margin-bottom: 5px;">⭐</div>
                      <div style="font-size: 12px; color: #64748b;">5-Star Rated</div>
                    </td>
                    <td style="text-align: center; padding: 10px 20px;">
                      <div style="font-size: 24px; margin-bottom: 5px;">✓</div>
                      <div style="font-size: 12px; color: #64748b;">Licensed & Insured</div>
                    </td>
                    <td style="text-align: center; padding: 10px 20px;">
                      <div style="font-size: 24px; margin-bottom: 5px;">💬</div>
                      <div style="font-size: 12px; color: #64748b;">100+ Happy Clients</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
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
