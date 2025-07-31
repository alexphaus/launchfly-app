import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Initialize Twilio client only when needed and with proper validation
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
    return null;
  }
  
  try {
    const twilio = require('twilio');
    return twilio(accountSid, authToken);
  } catch (error) {
    console.warn('Failed to initialize Twilio client:', error.message);
    return null;
  }
}

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
  const twilioClient = getTwilioClient();
  if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
    try {
      await twilioClient.messages.create({
        body: '🚀 Welcome to Launchfly! You\'ll get instant alerts when someone visits your site or when you make a sale. Reply STOP to unsubscribe.',
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
    } catch (error) {
      console.error('SMS error:', error);
    }
  }
  
  return Response.json({ success: true });
}