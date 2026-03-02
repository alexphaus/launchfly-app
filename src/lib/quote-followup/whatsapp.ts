// src/lib/quote-followup/whatsapp.ts
// ─── Twilio WhatsApp helper for Quote Follow-Up ───

import twilio from 'twilio';

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  return twilio(sid, token);
}

/**
 * Send a WhatsApp message via Twilio.
 * `to` should be plain E.164 ("+1234567890") — we add the "whatsapp:" prefix.
 */
export async function sendWhatsApp(to: string, body: string): Promise<string> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  if (!from) throw new Error('Missing TWILIO_WHATSAPP_FROM');

  const msg = await client.messages.create({
    from,
    to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    body,
  });

  return msg.sid;
}
