// src/app/api/sales/send-sms/route.ts
// API to send SMS outreach to prospects when email is not available

import twilio from 'twilio';

export async function POST(request: Request) {
  try {
    const { to, message, businessName, previewUrl } = await request.json();

    if (!to) {
      return Response.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Check Twilio config
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return Response.json({ error: 'SMS service not configured' }, { status: 500 });
    }

    // Format phone number (ensure it has country code)
    let formattedPhone = to.replace(/\D/g, ''); // Remove non-digits
    
    // Add country code if missing (assume US +1 if 10 digits)
    if (formattedPhone.length === 10) {
      formattedPhone = `+1${formattedPhone}`;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+${formattedPhone}`;
    } else {
      formattedPhone = `+${formattedPhone}`;
    }

    // Build SMS message (keep it short - 160 chars for single SMS)
    const smsBody = message || 
      `Hi! I built a free lead capture tool for ${businessName || 'your business'}. See demo: ${previewUrl} - Alex from Launchfly`;

    // Truncate to 160 chars if needed
    const finalMessage = smsBody.length > 160 ? smsBody.substring(0, 157) + '...' : smsBody;

    const client = twilio(accountSid, authToken);
    
    const result = await client.messages.create({
      from: fromNumber,
      to: formattedPhone,
      body: finalMessage
    });

    console.log(`✅ SMS sent to ${formattedPhone}: ${result.sid}`);

    return Response.json({ 
      success: true, 
      messageId: result.sid,
      to: formattedPhone,
      message: finalMessage
    });

  } catch (error: any) {
    console.error('SMS send error:', error);
    
    // Handle common Twilio errors
    if (error.code === 21211) {
      return Response.json({ error: 'Invalid phone number format' }, { status: 400 });
    }
    if (error.code === 21614) {
      return Response.json({ error: 'Phone number not capable of receiving SMS' }, { status: 400 });
    }
    
    return Response.json({ error: error.message || 'Failed to send SMS' }, { status: 500 });
  }
}
