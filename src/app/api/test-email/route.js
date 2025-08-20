// src/app/api/test-email/route.js
/**
 * Simple email test endpoint to verify Resend is working
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { to, subject, message } = await request.json();
    
    console.log('🧪 Testing email delivery to:', to);
    
    const emailResult = await resend.emails.send({
      from: 'hello@launchfly.ai',
      to: to,
      subject: subject || 'Test Email from Launchfly',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">🧪 Email Test Successful!</h2>
          <p>This is a test email to verify that email delivery is working properly.</p>
          <p><strong>Message:</strong> ${message || 'No message provided'}</p>
          <p style="color: #6b7280; font-size: 14px;">
            Sent from Launchfly email testing system at ${new Date().toLocaleString()}
          </p>
        </div>
      `
    });
    
    console.log('✅ Email sent successfully:', emailResult);
    
    return Response.json({
      success: true,
      message: 'Test email sent successfully',
      emailId: emailResult.data?.id,
      to: to
    });
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
    
    return Response.json({
      success: false,
      error: error.message,
      details: error
    }, { status: 500 });
  }
}
