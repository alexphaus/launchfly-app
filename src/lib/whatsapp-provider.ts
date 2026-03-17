// src/lib/whatsapp-provider.ts
// ═══════════════════════════════════════════════════════════════════════════
// WhatsApp Provider Router — picks UltraMsg or Evolution based on business config
//
// Usage:
//   import { getWhatsAppProvider } from '@/lib/whatsapp-provider';
//   const wa = await getWhatsAppProvider(businessId);
//   await wa.sendWhatsApp(phone, text, businessId);
//   await wa.sendTypingPresence?.(phone, businessId); // only Evolution
//
// Multi-instance outreach:
//   import { pickOutreachInstance, getProviderForInstance } from '@/lib/whatsapp-provider';
//   const instance = await pickOutreachInstance(businessId);
//   const wa = getProviderForInstance(instance);
//   await wa.sendWhatsApp(phone, text);
//
// Falls back to UltraMsg if no provider is configured (backward-compat).
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

export type WhatsAppProviderName = 'ultramsg' | 'evolution';

export interface WhatsAppProvider {
  name: WhatsAppProviderName;
  instanceId?: string; // whatsapp_instances.id — set when using multi-instance
  sendWhatsApp: (to: string, body: string, businessId?: string) => Promise<{ sent: boolean; id?: string; error?: string }>;
  sendVoiceNote: (to: string, audioUrl: string, businessId?: string) => Promise<{ sent: boolean; error?: string }>;
  sendImage: (to: string, imageUrl: string, caption?: string, businessId?: string) => Promise<{ sent: boolean; error?: string }>;
  checkHasWhatsApp: (phone: string, businessId?: string) => Promise<boolean>;
  /** Only available on Evolution — sends "typing..." indicator */
  sendTypingPresence?: (to: string, businessId?: string) => Promise<void>;
  /** Only available on Evolution — marks message as read (blue ticks) */
  markAsRead?: (messageId: string, fromPhone: string, businessId?: string) => Promise<void>;
}

/** Row from whatsapp_instances table */
export interface WaInstance {
  id: string;
  business_id: string;
  label: string;
  provider: WhatsAppProviderName;
  instance_id: string | null;  // UltraMsg
  token: string | null;        // UltraMsg
  base_url: string | null;     // Evolution
  api_key: string | null;      // Evolution
  instance_name: string | null; // Evolution
  daily_limit: number;
  sends_today: number;
  active: boolean;
}

/** Detect which provider a business uses from whatsapp_api_config.provider */
export async function detectProvider(businessId?: string): Promise<WhatsAppProviderName> {
  if (!businessId) return 'ultramsg';

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

    if (data?.whatsapp_api_config?.provider === 'evolution') {
      return 'evolution';
    }
  } catch {
    // fall through
  }

  return 'ultramsg';
}

/** Get the right provider module for a business.
 *  Priority: whatsapp_instances table → businesses.whatsapp_api_config → env vars.
 *  This means ALL WhatsApp accounts live in the instances table once migrated. */
export async function getWhatsAppProvider(businessId?: string): Promise<WhatsAppProvider> {
  // ── 1. Check whatsapp_instances table first (unified model) ──
  if (businessId) {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('business_id', businessId)
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1);

      if (data && data.length > 0) {
        return getProviderForInstance(data[0] as WaInstance);
      }
    } catch {
      // fall through to legacy path
    }
  }

  // ── 2. Fallback: legacy businesses.whatsapp_api_config (backward compat) ──
  const providerName = await detectProvider(businessId);

  if (providerName === 'evolution') {
    const evo = await import('@/lib/evolution');
    return {
      name: 'evolution',
      sendWhatsApp: evo.sendWhatsApp,
      sendVoiceNote: evo.sendVoiceNote,
      sendImage: evo.sendImage,
      checkHasWhatsApp: evo.checkHasWhatsApp,
      sendTypingPresence: evo.sendTypingPresence,
      markAsRead: evo.markAsRead,
    };
  }

  const ultra = await import('@/lib/ultramsg');
  return {
    name: 'ultramsg',
    sendWhatsApp: ultra.sendWhatsApp,
    sendVoiceNote: ultra.sendVoiceNote,
    sendImage: ultra.sendImage,
    checkHasWhatsApp: ultra.checkHasWhatsApp,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Multi-Instance Outreach Load Balancing
// ═══════════════════════════════════════════════════════════════════════════

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

/**
 * Pick the least-loaded active WhatsApp instance for a business that still
 * has capacity today. Returns null if no instances are configured (falls back
 * to the single-instance path) or all are at their daily limit.
 */
export async function pickOutreachInstance(businessId: string): Promise<WaInstance | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('business_id', businessId)
    .eq('active', true)
    .order('sends_today', { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  const inst = data[0] as WaInstance;
  if (inst.sends_today >= inst.daily_limit) return null; // all maxed out
  return inst;
}

/**
 * Get all active instances for a business, ordered by sends_today ASC.
 * Used by the outreach action to distribute leads across multiple instances.
 */
export async function getOutreachInstances(businessId: string): Promise<WaInstance[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('business_id', businessId)
    .eq('active', true)
    .order('sends_today', { ascending: true });

  if (error || !data) return [];
  return data as WaInstance[];
}

/**
 * Increment the sends_today counter for an instance. Called after each send.
 */
export async function incrementInstanceCounter(instanceId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.rpc('increment_wa_sends', { instance_id: instanceId }).then(() => {});
}

/**
 * Get a WhatsApp provider wired to a specific instance's credentials.
 * The provider functions do NOT look up credentials from the business table —
 * they use the instance's stored creds directly.
 */
export function getProviderForInstance(instance: WaInstance): WhatsAppProvider {
  if (instance.provider === 'evolution') {
    // Dynamically import evolution and bind to instance credentials
    const makeProvider = async () => {
      const evo = await import('@/lib/evolution');
      return evo;
    };
    const creds = {
      baseUrl: instance.base_url!,
      apiKey: instance.api_key!,
      instanceName: instance.instance_name!,
    };

    return {
      name: 'evolution',
      instanceId: instance.id,
      sendWhatsApp: async (to, body) => {
        const evo = await makeProvider();
        // Use getCredentials override via env-var style — but we need direct creds
        // Evolution's functions take businessId, so we override by setting instance creds
        // Simplest: call evoFetch directly-ish. But evolution.ts functions use getCredentials(businessId).
        // Instead, use the raw Evolution API via fetch, same as the module does internally.
        return evo.sendWhatsAppWithCreds(to, body, creds);
      },
      sendVoiceNote: async (to, audioUrl) => {
        const evo = await makeProvider();
        return evo.sendVoiceNoteWithCreds(to, audioUrl, creds);
      },
      sendImage: async (to, imageUrl, caption) => {
        const evo = await makeProvider();
        return evo.sendImageWithCreds(to, imageUrl, creds, caption);
      },
      checkHasWhatsApp: async (phone) => {
        const evo = await makeProvider();
        return evo.checkHasWhatsAppWithCreds(phone, creds);
      },
    };
  }

  // UltraMsg
  const ultramsgCreds = {
    instanceId: instance.instance_id!,
    token: instance.token!,
  };

  return {
    name: 'ultramsg',
    instanceId: instance.id,
    sendWhatsApp: async (to, body) => {
      const ultra = await import('@/lib/ultramsg');
      return ultra.sendWhatsAppWithCreds(to, body, ultramsgCreds);
    },
    sendVoiceNote: async (to, audioUrl) => {
      const ultra = await import('@/lib/ultramsg');
      return ultra.sendVoiceNoteWithCreds(to, audioUrl, ultramsgCreds);
    },
    sendImage: async (to, imageUrl, caption) => {
      const ultra = await import('@/lib/ultramsg');
      return ultra.sendImageWithCreds(to, imageUrl, ultramsgCreds, caption);
    },
    checkHasWhatsApp: async (phone) => {
      const ultra = await import('@/lib/ultramsg');
      return ultra.checkHasWhatsAppWithCreds(phone, ultramsgCreds);
    },
  };
}

/**
 * Get a provider for a specific instance ID (used by follow-ups that are
 * pinned to an instance). Falls back to the business default if not found.
 */
export async function getProviderByInstanceId(instanceId: string, businessId: string): Promise<WhatsAppProvider> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('id', instanceId)
    .eq('active', true)
    .single();

  if (data) return getProviderForInstance(data as WaInstance);

  // Fallback to default business provider
  return getWhatsAppProvider(businessId);
}
