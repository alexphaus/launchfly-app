import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// We use dynamic import for pdfkit inside the handler to avoid build issues
// import PDFDocument from 'pdfkit'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email, businessId } = await request.json();

    if (!email || !businessId) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
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

    // 2. Add to Customers
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .eq('email', email)
      .single();

    let customerId = existingCustomer?.id;

    if (!customerId) {
      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert({
          business_id: businessId,
          email: email,
          name: email.split('@')[0], // Fallback name
          status: 'lead',
          source: 'lead_magnet'
        })
        .select()
        .single();
      
      if (custError && custError.code !== '23505') { 
         console.error('Customer insert error:', custError);
      } else if (newCustomer) {
        customerId = newCustomer.id;
      }
    }

    // 3. Log Activity
    await supabase
      .from('ai_activities')
      .insert({
        business_id: businessId,
        type: 'lead_magnet',
        icon: '🧲',
        message: 'New Lead Magnet Signup',
        details: `${email} signed up to download the guide.`,
        metadata: { 
          recipientEmail: email, 
          recipientName: email.split('@')[0],
          customerId 
        }
      });

    // 4. Send Email with PDF Attachment
    const lm = business.business_data?.leadMagnet;
    if (lm) {
      let attachments = [];
      
      // Generate PDF using dynamic import for safety
      try {
        const PDFDocument = (await import('pdfkit')).default;
        const pdfBuffer = await generatePDF(lm, PDFDocument);
        const fileName = lm.lead_magnet.title 
          ? `${lm.lead_magnet.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
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
             <h1 style="color: #1e40af; margin-bottom: 10px;">${lm.lead_magnet.title}</h1>
          </div>
          
          <div style="background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              ${lm.email.body.replace(/\n/g, '<br>')}
            </p>
            
            <div style="text-align: center; padding: 20px; background: #f0f9ff; border-radius: 8px; margin: 20px 0;">
              <p style="font-weight: bold; color: #0369a1; margin-bottom: 10px;">📎 Your guide is attached to this email.</p>
              <p style="font-size: 14px; color: #0c4a6e;">Can't see the attachment? Scroll down to read it inline.</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            
            <!-- Inline backup -->
            <div style="background: #f8fafc; padding: 30px; border-radius: 12px;">
              <h2 style="margin-top: 0; text-align: center; color: #0f172a;">Your Guide (Web View)</h2>
              ${(lm.lead_magnet.content || []).map(c => `
                <div style="margin-bottom: 20px;">
                  <h3 style="color: #2563eb; margin-bottom: 10px;">${c.title}</h3>
                  <div style="line-height: 1.6; color: #374151;">${c.body}</div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
             <p>© ${new Date().getFullYear()} ${business.business_data.businessName || 'Launchfly Business'}</p>
             <p>You received this email because you signed up for our guide.</p>
          </div>
        </div>
      `;

      await resend.emails.send({
        from: 'Launchfly <hello@launchfly.ai>', 
        to: email,
        subject: lm.email.subject,
        html: html,
        attachments: attachments
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Capture error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generates a PDF buffer from the lead magnet content
 */
function generatePDF(lm, PDFDocument) {
  return new Promise((resolve, reject) => {
    try {
      // Use Courier font to avoid FS issues with Helvetica in some serverless envs, 
      // or standard fonts if supported. Standard fonts (Helvetica) are built-in to PDFKit 
      // but sometimes loading them fails in bundled envs without 'fs'.
      // Using 'Courier' is safer as it's often simpler, but standard fonts *should* work 
      // if pdfkit is configured as serverExternalPackage.
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(24).font('Helvetica-Bold').text(lm.lead_magnet.title, { align: 'center' });
      doc.moveDown(2);

      // Description
      if (lm.lead_magnet.description) {
        doc.fontSize(12).font('Helvetica-Oblique').text(lm.lead_magnet.description, { align: 'center' });
        doc.moveDown(2);
      }

      // Content
      const content = lm.lead_magnet.content || [];
      content.forEach(chapter => {
        doc.fontSize(18).font('Helvetica-Bold').text(chapter.title);
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica').text(chapter.body, {
          align: 'justify',
          lineGap: 2
        });
        doc.moveDown(1.5);
      });

      // Footer
      doc.moveDown(2);
      doc.fontSize(10).font('Helvetica-Oblique').text('Generated by Launchfly', { align: 'center', color: 'gray' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
