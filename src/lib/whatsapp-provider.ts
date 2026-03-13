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
// Falls back to UltraMsg if no provider is configured (backward-compat).
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

export type WhatsAppProviderName = 'ultramsg' | 'evolution';

export interface WhatsAppProvider {
  name: WhatsAppProviderName;
  sendWhatsApp: (to: string, body: string, businessId?: string) => Promise<{ sent: boolean; id?: string; error?: string }>;
  sendVoiceNote: (to: string, audioUrl: string, businessId?: string) => Promise<{ sent: boolean; error?: string }>;
  sendImage: (to: string, imageUrl: string, caption?: string, businessId?: string) => Promise<{ sent: boolean; error?: string }>;
  checkHasWhatsApp: (phone: string, businessId?: string) => Promise<boolean>;
  /** Only available on Evolution — sends "typing..." indicator */
  sendTypingPresence?: (to: string, businessId?: string) => Promise<void>;
  /** Only available on Evolution — marks message as read (blue ticks) */
  markAsRead?: (messageId: string, fromPhone: string, businessId?: string) => Promise<void>;
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

/** Get the right provider module for a business */
export async function getWhatsAppProvider(businessId?: string): Promise<WhatsAppProvider> {
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
