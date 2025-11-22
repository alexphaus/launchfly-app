// src/app/api/lead-magnet/capture/route.js
// Handles email capture for lead magnet funnels and delivers PDF guide

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request) {
  try {
    const { email, name, businessId, subdomain } = await request.json();

    if (!email || !businessId) {
      return Response.json({ error: 'Email and businessId are required' }, { status: 400 });
    }

    // Get business data
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('*, form_data')
      .eq('id', businessId)
      .single();

    if (bizError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Check if this is a lead magnet business
    const isLeadMagnet = business.form_data?.businessModel === 'lead_magnet' || 
                         business.form_data?.type === 'lead_magnet' ||
                         business.form_data?.template === 'lead-magnet';

    if (!isLeadMagnet) {
      return Response.json({ error: 'This endpoint is only for lead magnet businesses' }, { status: 400 });
    }

    // Store the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        business_id: businessId,
        email: email,
        name: name || null,
        source: 'lead_magnet',
        status: 'captured',
        metadata: {
          captured_at: new Date().toISOString(),
          subdomain: subdomain
        }
      })
      .select()
      .single();

    if (leadError) {
      console.error('Error storing lead:', leadError);
      // Continue anyway - we still want to deliver the PDF
    }

    // Generate the PDF guide using AI
    const guideContent = await generateLeadMagnetGuide(business, name || 'Friend');

    // Send the PDF via email
    await sendLeadMagnetEmail({
      to: email,
      name: name || 'Friend',
      businessName: business.name || business.form_data?.businessName || 'Your Coach',
      guideContent: guideContent,
      businessId: businessId
    });

    // Schedule email sequence (3 follow-up emails)
    await scheduleEmailSequence(businessId, email, name || 'Friend');

    return Response.json({ 
      success: true, 
      message: 'Check your email for your free guide!',
      leadId: lead?.id 
    });

  } catch (error) {
    console.error('Lead magnet capture error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generate lead magnet guide content using AI
 */
async function generateLeadMagnetGuide(business, recipientName) {
  const niche = business.form_data?.niche || 'coaching';
  const businessName = business.name || business.form_data?.businessName || 'Your Coach';
  
  // Determine the topic based on business niche
  const topicMap = {
    'fitness': 'Complete Fitness Transformation Guide',
    'business': 'Business Growth Blueprint',
    'life': 'Life Transformation Roadmap',
    'career': 'Career Acceleration Playbook',
    'coaching': 'Coaching Success Framework',
    'mindset': 'Mindset Mastery Guide'
  };
  
  const topic = topicMap[niche] || 'Complete Success Guide';

  const prompt = `
    Create a comprehensive, high-value lead magnet guide for ${recipientName} about "${topic}" in the ${niche} niche.
    
    This is a LEAD MAGNET - a free resource that coaches give away to grow their email list.
    It needs to be valuable enough that people will give their email address for it.
    
    Create a detailed guide (15-25 pages when formatted) that includes:
    
    1. **Introduction** (Hook them immediately)
       - Why this guide matters
       - What they'll learn
       - Who this is for
    
    2. **Core Content** (The meat)
       - Step-by-step methodologies
       - Industry insider secrets
       - Specific tactics and strategies
       - Tools and resources
       - Real examples and case studies
    
    3. **Implementation Guide**
       - How to get started TODAY
       - Week-by-week action plan
       - Common pitfalls and how to avoid them
       - Troubleshooting guide
    
    4. **Advanced Strategies**
       - Next-level tactics
       - Scaling strategies
       - Long-term success factors
    
    5. **Resources & Next Steps**
       - Recommended tools
       - Further reading
       - How to get more help from ${businessName}
    
    Make it feel like insider knowledge worth $500+.
    Include specific, actionable content - not generic advice.
    Write in a conversational, engaging tone that builds trust.
    Use examples, stories, and specific numbers where possible.
    
    Format as markdown with clear headings and sections.
    Make it professional but approachable.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { 
        role: "system", 
        content: `You are a top expert in ${niche} with 15+ years of industry experience. You create high-value lead magnets that coaches use to grow their email lists. Your guides are detailed, actionable, and worth 10x what they cost to create.` 
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  return response.choices[0].message.content;
}

/**
 * Send lead magnet email with PDF guide
 */
async function sendLeadMagnetEmail({ to, name, businessName, guideContent, businessId }) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Free Guide is Here!</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding:40px 0">
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 25px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:40px 20px;">
                  <div style="font-size:64px;margin-bottom:20px;">🎁</div>
                  <h1 style="color:#ffffff;font-size:32px;font-weight:800;margin:0 0 12px 0;">
                    Your Free Guide is Ready!
                  </h1>
                  <p style="color:#ffffff;font-size:18px;margin:0;opacity:0.95;">
                    Thank you for joining ${businessName}
                  </p>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding:40px;">
                  
                  <!-- Personal Message -->
                  <div style="margin-bottom:30px;">
                    <h2 style="color:#1f2937;font-size:24px;font-weight:700;margin:0 0 15px 0;">
                      Hi ${name}! 👋
                    </h2>
                    <p style="color:#6b7280;font-size:16px;line-height:1.6;margin:0;">
                      Thank you for downloading your free guide! I've prepared something special for you below.
                    </p>
                  </div>

                  <!-- Guide Content -->
                  <div style="background-color:#f9fafb;border-radius:12px;padding:30px;margin-bottom:25px;border-left:4px solid #10b981;">
                    <div style="white-space:pre-wrap;color:#1f2937;font-size:15px;line-height:1.8;">
                      ${guideContent.replace(/\n/g, '<br>')}
                    </div>
                  </div>

                  <!-- Next Steps -->
                  <div style="background-color:#eff6ff;border-radius:12px;padding:25px;margin-bottom:25px;">
                    <h3 style="color:#1e40af;font-size:18px;font-weight:600;margin:0 0 15px 0;">
                      💡 What's Next?
                    </h3>
                    <p style="color:#1e40af;margin:0;line-height:1.6;">
                      Over the next few days, I'll send you additional tips and strategies to help you succeed. 
                      Keep an eye on your inbox!
                    </p>
                  </div>

                  <!-- Footer -->
                  <div style="text-align:center;padding:20px;border-top:1px solid #e5e7eb;margin-top:30px;">
                    <p style="color:#6b7280;font-size:14px;margin:0 0 10px 0;">
                      Questions? Just reply to this email – I'm here to help! 🤝
                    </p>
                    <p style="color:#9ca3af;font-size:12px;margin:0;">
                      © 2025 ${businessName}. Delivered by Launchfly AI.
                    </p>
                  </div>

                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: `${businessName} <hello@launchfly.ai>`,
    to: to,
    subject: `🎁 Your Free Guide from ${businessName} - Inside!`,
    html: htmlContent
  });
}

/**
 * Schedule email sequence (3 follow-up emails)
 */
async function scheduleEmailSequence(businessId, email, name) {
  const sequence = [
    {
      delay: 1, // 1 day
      subject: 'Day 1: Quick Win Strategy',
      content: `Hi ${name}, here's a quick win you can implement today from the guide...`
    },
    {
      delay: 3, // 3 days
      subject: 'Day 3: Advanced Tip',
      content: `Hi ${name}, now that you've had time to review the guide, here's an advanced strategy...`
    },
    {
      delay: 7, // 7 days
      subject: 'Day 7: How Can I Help?',
      content: `Hi ${name}, I'd love to hear how the guide is helping you. Want to explore working together?`
    }
  ];

  // Store sequence in database for Inngest to process
  for (const seqEmail of sequence) {
    await supabase
      .from('email_sequences')
      .insert({
        business_id: businessId,
        recipient_email: email,
        recipient_name: name,
        email_subject: seqEmail.subject,
        email_content: seqEmail.content,
        scheduled_for: new Date(Date.now() + seqEmail.delay * 24 * 60 * 60 * 1000).toISOString(),
        status: 'scheduled'
      });
  }
}

