// src/lib/quote-followup/whatsapp.ts
// ─── WhatsApp helper for Quote Follow-Up (Evolution API) ───

import { getWhatsAppProvider } from '@/lib/whatsapp-provider';

/**
 * Send a WhatsApp message via Evolution API (through whatsapp-provider).
 * `to` should be plain E.164 ("+1234567890").
 */
export async function sendWhatsApp(to: string, body: string, businessId?: string): Promise<string> {
  const provider = await getWhatsAppProvider(businessId);
  const result = await provider.sendWhatsApp(to, body, businessId);
  if (!result.sent) {
    throw new Error(result.error || 'WhatsApp send failed');
  }
  return result.id || 'sent';
}
