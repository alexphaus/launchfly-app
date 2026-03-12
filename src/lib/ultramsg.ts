// src/lib/ultramsg.ts
// UltraMsg WhatsApp API — template-free, no 24h window restrictions
// Each business has its own instance (QR-code-linked phone).
// Credentials stored in businesses.whatsapp_api_config jsonb:
//   { provider: 'ultramsg', instanceId: '...', token: '...' }
// Falls back to env vars ULTRAMSG_INSTANCE_ID / ULTRAMSG_TOKEN for your own number.

import { createClient } from '@supabase/supabase-js';

const ULTRAMSG_BASE = 'https://api.ultramsg.com';

export interface UltramsgCredentials {
  instanceId: string;
  token: string;
}

/** Look up a business's UltraMsg credentials from the DB, fallback to env vars */
export async function getCredentials(businessId?: string): Promise<UltramsgCredentials> {
  if (businessId) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
      );
      const { data } = await supabase
        .from('businesses')
        .select('whatsapp_api_config')
        .eq('id', businessId)
        .single();

      const cfg = data?.whatsapp_api_config;
      if (cfg?.instanceId && cfg?.token) {
        return { instanceId: cfg.instanceId, token: cfg.token };
      }
    } catch {
      // Fall through to env vars
    }
  }

  // Fallback: global env vars (your own test instance)
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instanceId || !token) {
    throw new Error('No UltraMsg credentials found — set per-business config or ULTRAMSG_INSTANCE_ID/ULTRAMSG_TOKEN env vars');
  }
  return { instanceId, token };
}

/** Normalize phone to international format without whatsapp: prefix */
function normalizePhone(phone: string): string {
  let p = phone.replace(/^whatsapp:/, '');
  // Strip spaces, dashes, parentheses — keep only digits and leading +
  const digits = p.replace(/[^\d]/g, '');
  return `+${digits}`;
}

/** Helper to block execution to simulate human typing delays (varies by message length) */
async function simulateHumanTyping(text: string) {
  // Base delay of 2 seconds, plus ~50ms per character to pretend to type, up to max 8 seconds
  const typingTimeMs = Math.min(2000 + (text.length * 50), 8000);
  // Add random jitter of 1-3 seconds so it's never exact
  const jitterMs = Math.floor(Math.random() * 2000) + 1000;
  const totalDelayMs = typingTimeMs + jitterMs;
  
  await new Promise(resolve => setTimeout(resolve, totalDelayMs));
}

/** Check if number is blacklisted (has opted out) — scoped to business when provided */
async function isBlacklisted(phone: string, businessId?: string): Promise<boolean> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
    const p1 = phone.startsWith('+') ? phone : `+${phone}`;
    const p2 = phone.replace(/^\+/, '');
    
    let query = supabase
      .from('customers')
      .select('accepts_marketing')
      .or(`phone.eq.${p1},phone.eq.${p2}`)
      .eq('accepts_marketing', false);

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data } = await query.limit(1);

    return Array.isArray(data) && data.length > 0;
  } catch {
    return false; // if err or not found, assume not blacklisted
  }
}

/** Send a plain WhatsApp text message */
export async function sendWhatsApp(
  to: string,
  body: string,
  businessId?: string,
): Promise<{ sent: boolean; id?: string; error?: string }> {
  // 1) HARD BLACKLIST CHECK - Prevent sending if customer opted out
  if (await isBlacklisted(to, businessId)) {
    console.log(`[UltraMsg] 🚫 Blocked: ${to} is blacklisted (opted out).`);
    return { sent: false, error: 'Recipient is blacklisted from receiving automated messages.' };
  }

  // 2) HUMAN TYPING DELAY - Anti-spam mechanism
  await simulateHumanTyping(body);

  const { instanceId, token } = await getCredentials(businessId);
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
export async function sendVoiceNote(
  to: string,
  audioUrl: string,
  businessId?: string,
): Promise<{ sent: boolean; error?: string }> {
  if (await isBlacklisted(to, businessId)) {
    return { sent: false, error: 'Recipient opted out.' };
  }
  const { instanceId, token } = await getCredentials(businessId);
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
export async function sendImage(
  to: string,
  imageUrl: string,
  caption?: string,
  businessId?: string,
): Promise<{ sent: boolean; error?: string }> {
  if (await isBlacklisted(to, businessId)) {
    return { sent: false, error: 'Recipient opted out.' };
  }
  const { instanceId, token } = await getCredentials(businessId);
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

/** Resolve which business owns a given UltraMsg instance ID */
export async function resolveBusinessByInstance(instanceId: string): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('whatsapp_api_config->>instanceId', instanceId)
      .limit(1)
      .single();
    return data?.id || null;
  } catch {
    return null;
  }
}
