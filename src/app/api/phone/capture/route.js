// src/app/api/phone/capture/route.js
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  const { sessionId, phoneNumber } = await request.json();
  
  // Update session
  await supabase
    .from('sessions')
    .update({ phone_number: phoneNumber })
    .eq('id', sessionId);
  
  // Update business
  await supabase
    .from('businesses')
    .update({ phone_number: phoneNumber })
    .eq('session_id', sessionId);
  
  // Send welcome SMS if Twilio is configured
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  const canSendSms = Boolean(accountSid && authToken && fromNumber && accountSid.startsWith('AC'));
  if (canSendSms) {
    try {
      const twilioClient = twilio(accountSid, authToken);
      await twilioClient.messages.create({
        body: '🚀 Welcome to Launchfly! You\'ll get instant alerts when someone visits your site or when you make a sale. Reply STOP to unsubscribe.',
        from: fromNumber,
        to: phoneNumber
      });
    } catch (error) {
      console.error('SMS error:', error);
    }
  }
  
  return Response.json({ success: true });
}