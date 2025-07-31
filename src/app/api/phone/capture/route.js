import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const twilioClient = process.env.TWILIO_ACCOUNT_SID ? 
  twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : 
  null;

export async function POST(request) {
  try {
    const { sessionId, phoneNumber } = await request.json();
    
    if (!sessionId || !phoneNumber) {
      return new Response(JSON.stringify({ error: 'Session ID and phone number are required' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the business associated with this session
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('session_id', sessionId)
      .single();
      
    if (businessError) {
      console.error('Business lookup error:', businessError);
      return new Response(JSON.stringify({ error: 'Business not found' }), { 
        status: 404, 
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update the business with the phone number
    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        phone_number: phoneNumber
      })
      .eq('id', business.id);
    
    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to save phone number' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Send welcome SMS if Twilio is configured
    if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: 'Thanks for providing your phone number! Your business is being created.',
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });
      } catch (error) {
        console.error('SMS error:', error);
        // Don't fail the request if SMS fails
      }
    }
    
    return Response.json({
      success: true,
      message: 'Phone number saved successfully'
    });
    
  } catch (error) {
    console.error('Phone capture error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}