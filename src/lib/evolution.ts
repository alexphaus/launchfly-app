// src/lib/evolution.ts
// Evolution API WhatsApp Client — self-hosted, supports typing indicators & read receipts
//
// Each business stores credentials in businesses.whatsapp_api_config jsonb:
//   { provider: 'evolution', instanceName: '...', apiKey: '...', baseUrl: '...' }
// Falls back to env vars EVOLUTION_BASE_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE for dev.

import { createClient } from '@supabase/supabase-js';

export interface EvolutionCredentials {
  baseUrl: string;      // e.g. https://evo.yourdomain.com
  apiKey: string;
  instanceName: string;
}

/** Look up a business's Evolution API credentials from the DB, fallback to env vars */
export async function getCredentials(businessId?: string): Promise<EvolutionCredentials> {
  if (businessId) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
      );

      // 1. Check whatsapp_instances table first (new unified model)
      const { data: inst } = await supabase
        .from('whatsapp_instances')
        .select('base_url, api_key, instance_name')
        .eq('business_id', businessId)
        .eq('provider', 'evolution')
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      if (inst?.base_url && inst?.api_key && inst?.instance_name) {
        return { baseUrl: inst.base_url, apiKey: inst.api_key, instanceName: inst.instance_name };
      }

      // 2. Fallback: legacy businesses.whatsapp_api_config
      const { data } = await supabase
        .from('businesses')
        .select('whatsapp_api_config')
        .eq('id', businessId)
        .single();

      const cfg = data?.whatsapp_api_config;
      if (cfg?.provider === 'evolution' && cfg?.baseUrl && cfg?.apiKey && cfg?.instanceName) {
        return { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, instanceName: cfg.instanceName };
      }
    } catch {
      // Fall through to env vars
    }
  }

  const baseUrl = process.env.EVOLUTION_BASE_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE;
  if (!baseUrl || !apiKey || !instanceName) {
    throw new Error('No Evolution API credentials found — set per-business config or EVOLUTION_BASE_URL/EVOLUTION_API_KEY/EVOLUTION_INSTANCE env vars');
  }
  return { baseUrl, apiKey, instanceName };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Normalize phone to the format Evolution expects: countrycode + number (no + prefix) */
function normalizePhone(phone: string): string {
  return phone.replace(/^whatsapp:/, '').replace(/[^\d]/g, '');
}

/** Generic Evolution API fetch wrapper */
async function evoFetch(
  creds: EvolutionCredentials,
  path: string,
  body: Record<string, unknown>,
): Promise<any> {
  const url = `${creds.baseUrl.replace(/\/$/, '')}/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: creds.apiKey,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Typing Indicators ──────────────────────────────────────────────────

/** Send "typing..." presence to the chat — auto-expires when a message is sent */
export async function sendTypingPresence(to: string, businessId?: string): Promise<void> {
  try {
    const creds = await getCredentials(businessId);
    const number = normalizePhone(to);
    await evoFetch(creds, `chat/sendPresence/${creds.instanceName}`, {
      number,
      delay: 5000, // Evolution uses this to hold the composing state
      presence: 'composing',
    });
  } catch (err) {
    console.warn('[Evolution] Failed to send typing presence:', err);
  }
}

/** Mark a message as read (blue ticks) */
export async function markAsRead(messageId: string, fromPhone: string, businessId?: string): Promise<void> {
  try {
    const creds = await getCredentials(businessId);
    await evoFetch(creds, `chat/markMessageAsRead/${creds.instanceName}`, {
      readMessages: [{ remoteJid: `${normalizePhone(fromPhone)}@s.whatsapp.net`, id: messageId }],
    });
  } catch (err) {
    console.warn('[Evolution] Failed to mark as read:', err);
  }
}

// ─── Blacklist Check ─────────────────────────────────────────────────────

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
    return false;
  }
}

// ─── Send Messages ───────────────────────────────────────────────────────

/** Send a plain WhatsApp text message via Evolution API */
export async function sendWhatsApp(
  to: string,
  body: string,
  businessId?: string,
): Promise<{ sent: boolean; id?: string; error?: string }> {
  if (await isBlacklisted(to, businessId)) {
    console.log(`[Evolution] 🚫 Blocked: ${to} is blacklisted (opted out).`);
    return { sent: false, error: 'Recipient is blacklisted from receiving automated messages.' };
  }

  const creds = await getCredentials(businessId);
  const number = normalizePhone(to);

  try {
    const json = await evoFetch(creds, `message/sendText/${creds.instanceName}`, {
      number,
      text: body,
    });

    if (json?.key?.id) {
      return { sent: true, id: json.key.id };
    }
    return { sent: false, error: json?.error || json?.message || JSON.stringify(json) };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
}

/** Send a voice note (.ogg opus) */
export async function sendVoiceNote(
  to: string,
  audioUrl: string,
  businessId?: string,
): Promise<{ sent: boolean; error?: string }> {
  if (await isBlacklisted(to, businessId)) {
    return { sent: false, error: 'Recipient opted out.' };
  }

  const creds = await getCredentials(businessId);
  const number = normalizePhone(to);

  try {
    const json = await evoFetch(creds, `message/sendWhatsAppAudio/${creds.instanceName}`, {
      number,
      audio: audioUrl,
    });
    if (json?.key?.id) return { sent: true };
    return { sent: false, error: json?.error || JSON.stringify(json) };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
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

  const creds = await getCredentials(businessId);
  const number = normalizePhone(to);

  try {
    const json = await evoFetch(creds, `message/sendMedia/${creds.instanceName}`, {
      number,
      mediatype: 'image',
      media: imageUrl,
      caption: caption || '',
    });
    if (json?.key?.id) return { sent: true };
    return { sent: false, error: json?.error || JSON.stringify(json) };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
}

/** Check if a number has WhatsApp */
export async function checkHasWhatsApp(phone: string, businessId?: string): Promise<boolean> {
  try {
    const creds = await getCredentials(businessId);
    const number = normalizePhone(phone);
    const json = await evoFetch(creds, `chat/whatsappNumbers/${creds.instanceName}`, {
      numbers: [`${number}`],
    });
    // Evolution returns array with exists: true/false
    return Array.isArray(json) && json.some((r: any) => r.exists === true);
  } catch {
    return true; // fail-open
  }
}

// ─── WithCreds variants (for multi-instance outreach) ─────────────────
// These accept explicit credentials instead of looking up by businessId,
// so the outreach load-balancer can route to a specific phone instance.

export async function sendWhatsAppWithCreds(
  to: string,
  body: string,
  creds: EvolutionCredentials,
): Promise<{ sent: boolean; id?: string; error?: string }> {
  if (await isBlacklisted(to)) {
    return { sent: false, error: 'Recipient is blacklisted from receiving automated messages.' };
  }
  const number = normalizePhone(to);
  try {
    const json = await evoFetch(creds, `message/sendText/${creds.instanceName}`, { number, text: body });
    if (json?.key?.id) return { sent: true, id: json.key.id };
    return { sent: false, error: json?.error || json?.message || JSON.stringify(json) };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
}

export async function sendVoiceNoteWithCreds(
  to: string,
  audioUrl: string,
  creds: EvolutionCredentials,
): Promise<{ sent: boolean; error?: string }> {
  const number = normalizePhone(to);
  try {
    const json = await evoFetch(creds, `message/sendWhatsAppAudio/${creds.instanceName}`, { number, audio: audioUrl });
    if (json?.key?.id) return { sent: true };
    return { sent: false, error: json?.error || JSON.stringify(json) };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
}

export async function sendImageWithCreds(
  to: string,
  imageUrl: string,
  creds: EvolutionCredentials,
  caption?: string,
): Promise<{ sent: boolean; error?: string }> {
  const number = normalizePhone(to);
  try {
    const json = await evoFetch(creds, `message/sendMedia/${creds.instanceName}`, {
      number, mediatype: 'image', media: imageUrl, caption: caption || '',
    });
    if (json?.key?.id) return { sent: true };
    return { sent: false, error: json?.error || JSON.stringify(json) };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
}

export async function checkHasWhatsAppWithCreds(
  phone: string,
  creds: EvolutionCredentials,
): Promise<boolean> {
  try {
    const number = normalizePhone(phone);
    const json = await evoFetch(creds, `chat/whatsappNumbers/${creds.instanceName}`, {
      numbers: [`${number}`],
    });
    return Array.isArray(json) && json.some((r: any) => r.exists === true);
  } catch {
    return true; // fail-open
  }
}

/** Resolve which business owns a given Evolution instance name */
export async function resolveBusinessByInstance(instanceName: string): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );

    // 1. Check whatsapp_instances table first (new unified model)
    const { data: inst } = await supabase
      .from('whatsapp_instances')
      .select('business_id')
      .eq('instance_name', instanceName)
      .eq('provider', 'evolution')
      .eq('active', true)
      .limit(1)
      .single();
    if (inst?.business_id) return inst.business_id;

    // 2. Fallback: legacy businesses.whatsapp_api_config
    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('whatsapp_api_config->>provider', 'evolution')
      .eq('whatsapp_api_config->>instanceName', instanceName)
      .limit(1)
      .single();
    return data?.id || null;
  } catch {
    return null;
  }
}
