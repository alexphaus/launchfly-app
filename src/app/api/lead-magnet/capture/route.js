import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generatePDF } from '@/core/pdf-generator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

// Email validation regex - enhanced with common typo detection
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Common email domain typos
const DOMAIN_CORRECTIONS = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'outloo.com': 'outlook.com',
  'outlok.com': 'outlook.com'
};

// Helper: Suggest email correction
function suggestEmailCorrection(email) {
  const [localPart, domain] = email.toLowerCase().split('@');
  if (domain && DOMAIN_CORRECTIONS[domain]) {
    return `${localPart}@${DOMAIN_CORRECTIONS[domain]}`;
  }
  return null;
}

// Helper: Send SMS notification to business owner (Speed-to-Lead)
async function sendLeadSMS(business, leadEmail) {
  const phoneNumber = business.phone_number || business.business_data?.phone;
  
  if (!phoneNumber || !process.env.TWILIO_ACCOUNT_SID) {
    console.log('📱 SMS skipped: No phone number or Twilio not configured');
    return null;
  }

  try {
    // Dynamic import Twilio only when needed
    const twilio = await import('twilio');
    const client = twilio.default(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const businessName = business.business_data?.businessName || business.name || 'Your Business';
    const landingPageUrl = business.subdomain 
      ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://launchfly.app'}/sites/${business.subdomain}`
      : '';

    const message = await client.messages.create({
      body: `🔥 NEW LEAD: Someone just downloaded your guide!\n\nEmail: ${leadEmail}\n\n⚡ Speed wins! Call back within 5 mins for best results.\n\n${landingPageUrl ? `View: ${landingPageUrl}` : ''}\n\n- ${businessName} Lead System`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`
    });

    console.log('📱 SMS sent to business owner:', message.sid);
    return message.sid;
  } catch (smsError) {
    console.error('📱 SMS send failed (non-blocking):', smsError.message);
    return null;
  }
}

export async function POST(request) {
  try {
    const { email, businessId } = await request.json();

    console.log('📧 Lead capture request:', { email, businessId });

    if (!email || !businessId) {
      console.error('❌ Missing required fields:', { email, businessId });
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Enhanced email validation
    if (!EMAIL_REGEX.test(email)) {
      console.error('❌ Invalid email format:', email);
      return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Check for common typos and suggest correction
    const suggestedEmail = suggestEmailCorrection(email);
    if (suggestedEmail) {
      console.log(`💡 Possible typo detected: ${email} → ${suggestedEmail}`);
      // Still accept the email but log for monitoring
    }

    // 1. Get Business Data
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (bizError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // 2. Add to Customers (or get existing)
    let customerId = null;
    let isNewLead = false;
    
    // Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, email_sequence_day')
      .eq('business_id', businessId)
      .eq('email', email)
      .single();

    if (existingCustomer?.id) {
      customerId = existingCustomer.id;
      console.log(`📧 Existing customer found: ${email}`);
    } else {
      // Create new customer with email sequence tracking
      const customerData = {
        business_id: businessId,
        email: email,
        status: 'lead',
        source: 'lead_magnet',
        email_sequence_day: 1,
        email_sequence_started_at: new Date().toISOString(),
        next_email_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single();
      
      if (custError) {
        // Handle duplicate key error gracefully
        if (custError.code === '23505') {
          console.log(`📧 Customer already exists (race condition): ${email}`);
          const { data: retry } = await supabase
            .from('customers')
            .select('id')
            .eq('business_id', businessId)
            .eq('email', email)
            .single();
          customerId = retry?.id;
        } else {
          console.error('Customer insert error:', custError);
        }
      } else if (newCustomer) {
        customerId = newCustomer.id;
        isNewLead = true;
        console.log(`✅ New lead created:`, {
          email,
          customerId,
          businessId,
          source: 'lead_magnet',
          status: 'lead'
        });
      } else {
        console.error('❌ Customer creation failed but no error returned');
      }
    }

    // 3. Log Activity & Send SMS Alert (Speed-to-Lead)
    if (isNewLead) {
      await supabase
        .from('ai_activities')
        .insert({
          business_id: businessId,
          type: 'lead_magnet',
          icon: 'M',
          message: 'New Lead Magnet Signup',
          details: `${email} signed up to download the guide.`,
          metadata: { 
            email,
            customer_id: customerId 
          }
        });

      // 🔥 SPEED-TO-LEAD: Send SMS to business owner immediately
      // This feature alone is worth $97 - helps them respond within 5 minutes
      sendLeadSMS(business, email).catch(err => {
        console.error('SMS notification failed (non-blocking):', err);
      });
    }

    // 4. Send Email with PDF Attachment
    // Handle both nested 'leadMagnet' structure and flat structure from launch.js
    const flatData = business.business_data;
    const nestedData = business.business_data?.leadMagnet;
    
    // Normalize data
    const title = flatData.lead_magnet_title || nestedData?.lead_magnet?.title || 'Expert Guide';
    const content = flatData.lead_magnet_content || nestedData?.lead_magnet?.content || [];
    const pdfContent = flatData.lead_magnet_pdf || nestedData?.lead_magnet_pdf || {};
    const emailSequence = flatData.email_sequence || nestedData?.email_sequence || [];
    const firstEmail = emailSequence.find(e => e.day === 1) || { subject: 'Your Guide', body: 'Here is your guide.' };
    
    // Prepare business data for PDF (using shared pdf-generator from dashboard)
    const businessDataForPdf = {
      businessName: flatData.businessName || business.name || 'Local Business',
      niche: flatData.niche || 'Service',
      phone: business.phone_number || flatData.phone || '',
      email: business.email || flatData.email || '',
      city: flatData.city || flatData.location || 'your area',
      address: flatData.address || '',
      hours: flatData.hours || '',
      bookingUrl: business.booking_url || flatData.booking_url || '',
      subdomain: business.subdomain || '',
      landingPageUrl: business.subdomain ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://launchfly.app'}/sites/${business.subdomain}` : ''
    };
    
    if (title) {
      let attachments = [];
      
      // Generate PDF using shared pdf-generator (same as dashboard)
      try {
        const PDFDocument = (await import('pdfkit')).default;
        const pdfBuffer = await generatePDF({ title, content, pdfContent }, PDFDocument, businessDataForPdf);
        const fileName = title 
          ? `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
          : 'expert-guide.pdf';
          
        attachments.push({
          content: pdfBuffer,
          filename: fileName,
        });
      } catch (pdfError) {
        console.error('PDF Generation failed:', pdfError);
        // Continue without PDF
      }

      const html = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; color: #333;">
          <div style="text-align: center; padding: 20px 0;">
             <h1 style="color: #1e40af; margin-bottom: 10px;">${title}</h1>
          </div>
          
          <div style="background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              ${firstEmail.body.replace(/\n/g, '<br>')}
            </p>
            
                  <div style="text-align: center; padding: 20px; background: #f0f9ff; border-radius: 8px; margin: 20px 0;">
                     <p style="font-weight: bold; color: #0369a1; margin-bottom: 10px;">Attachment: Your guide is included with this email.</p>
              <p style="font-size: 14px; color: #0c4a6e;">Can't see the attachment? Scroll down to read it inline.</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            
            <!-- Inline backup -->
            <div style="background: #f8fafc; padding: 30px; border-radius: 12px;">
              <h2 style="margin-top: 0; text-align: center; color: #0f172a;">Your Guide (Web View)</h2>
              ${(content || []).map(c => `
                <div style="margin-bottom: 20px;">
                  <h3 style="color: #2563eb; margin-bottom: 10px;">${c.title}</h3>
                  <div style="line-height: 1.6; color: #374151;">${c.body}</div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
             <p>&copy; ${new Date().getFullYear()} ${business.business_data.businessName || 'Launchfly Business'}</p>
             <p>You received this email because you signed up for our guide.</p>
             <p style="margin-top: 10px;">
               <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://launchfly.ai'}/api/unsubscribe?email=${encodeURIComponent(email)}&businessId=${businessId}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
             </p>
          </div>
        </div>
      `;

      await resend.emails.send({
        from: 'Launchfly <hello@launchfly.ai>', 
        to: email,
        subject: firstEmail.subject,
        html: html,
        attachments: attachments
      });
    }
    
    // 5. Increment Lead Count (only for new leads)
    if (isNewLead) {
      const { data: currentBiz, error: bizReadError } = await supabase
        .from('businesses')
        .select('total_leads')
        .eq('id', businessId)
        .single();
      
      if (!bizReadError) {
        const newCount = (currentBiz?.total_leads || 0) + 1;
        const { error: updateError } = await supabase
          .from('businesses')
          .update({ total_leads: newCount })
          .eq('id', businessId);
        
        if (updateError) {
          console.error('Failed to update lead count:', updateError);
        } else {
          console.log(`📊 Lead count updated to ${newCount} for business ${businessId}`);
        }
      }
    }

    return Response.json({ 
      success: true, 
      customerId,
      isNewLead,
      message: isNewLead ? 'Lead captured successfully!' : 'Welcome back!'
    });
  } catch (error) {
    console.error('Capture error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
