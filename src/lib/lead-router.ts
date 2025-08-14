// src/lib/lead-router.ts
import twilio from 'twilio';
import { Resend } from 'resend';

export async function routeHotLead({ toEmail, toPhone, subject, text }:
  { toEmail?: string; toPhone?: string; subject: string; text: string }) {
  if (toEmail && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: process.env.SENDER_EMAIL || 'noreply@launchfly.ai', to: toEmail, subject, text });
  }
  if (toPhone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({ from: process.env.TWILIO_FROM, to: toPhone, body: `${subject}: ${text}` });
  }
}


