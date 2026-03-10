// src/lib/ultramsg.ts
// UltraMsg WhatsApp API — template-free, no 24h window restrictions
// Replaces Twilio WhatsApp. SMS still goes through Twilio.

const ULTRAMSG_BASE = 'https://api.ultramsg.com';

function getInstanceId(): string {
  const id = process.env.ULTRAMSG_INSTANCE_ID;
  if (!id) throw new Error('Missing ULTRAMSG_INSTANCE_ID env var');
  return id;
}

function getToken(): string {
  const token = process.env.ULTRAMSG_TOKEN;
  if (!token) throw new Error('Missing ULTRAMSG_TOKEN env var');
  return token;
}

/** Normalize phone to international format without whatsapp: prefix */
function normalizePhone(phone: string): string {
  let p = phone.replace(/^whatsapp:/, '');
  if (!p.startsWith('+')) p = `+${p}`;
  return p;
}

/** Send a plain WhatsApp text message */
export async function sendWhatsApp(to: string, body: string): Promise<{ sent: boolean; id?: string; error?: string }> {
  const instanceId = getInstanceId();
  const token = getToken();
  const phone = normalizePhone(to);

  const payload = new URLSearchParams();
  payload.append('token', token);
  payload.append('to', phone);
  payload.append('body', body);

  const res = await fetch(`${ULTRAMSG_BASE}/${instanceId}/messages/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload,
  });

  const json = await res.json();

  if (json.sent === 'true' || json.sent === true || json.id) {
    return { sent: true, id: json.id };
  }
  return { sent: false, error: json.error || JSON.stringify(json) };
}

/** Send a WhatsApp voice note from a URL (.ogg recommended) */
export async function sendVoiceNote(to: string, audioUrl: string): Promise<{ sent: boolean; error?: string }> {
  const instanceId = getInstanceId();
  const token = getToken();
  const phone = normalizePhone(to);

  const payload = new URLSearchParams();
  payload.append('token', token);
  payload.append('to', phone);
  payload.append('audio', audioUrl);

  const res = await fetch(`${ULTRAMSG_BASE}/${instanceId}/messages/voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload,
  });

  const json = await res.json();
  if (json.sent === 'true' || json.sent === true || json.id) {
    return { sent: true };
  }
  return { sent: false, error: json.error || JSON.stringify(json) };
}

/** Send an image with optional caption */
export async function sendImage(to: string, imageUrl: string, caption?: string): Promise<{ sent: boolean; error?: string }> {
  const instanceId = getInstanceId();
  const token = getToken();
  const phone = normalizePhone(to);

  const payload = new URLSearchParams();
  payload.append('token', token);
  payload.append('to', phone);
  payload.append('image', imageUrl);
  if (caption) payload.append('caption', caption);

  const res = await fetch(`${ULTRAMSG_BASE}/${instanceId}/messages/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload,
  });

  const json = await res.json();
  if (json.sent === 'true' || json.sent === true || json.id) {
    return { sent: true };
  }
  return { sent: false, error: json.error || JSON.stringify(json) };
}
