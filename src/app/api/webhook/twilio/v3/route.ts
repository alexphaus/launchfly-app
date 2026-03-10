// src/app/api/webhook/twilio/v3/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// V3 Messaging Webhook — Thin Router (WhatsApp + SMS)
//
// Does ONE thing: parse the incoming message, resolve the business,
// then fire 'inbound_whatsapp' through the automation engine.
// Detects SMS vs WhatsApp from Twilio's From field and passes
// the channel in metadata so AI brain replies on the same channel.
//
// The AI brain, owner notifications, templates, delays — all configured
// in the Automations tab via rules. Zero hardcoded behavior.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLastBusinessId } from '@/lib/ai-receptionist/history';
import { fireEvent } from '@/lib/automations/executor';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const EMPTY_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const twimlHeaders = { 'Content-Type': 'text/xml' };

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── POST handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Parse incoming message (WhatsApp or SMS)
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;
    const latitude = formData.get('Latitude') as string | null;
    const longitude = formData.get('Longitude') as string | null;
    const buttonPayload = formData.get('ButtonPayload') as string | null;

    // Detect channel from Twilio's From field
    const isWhatsApp = from.startsWith('whatsapp:');
    const channel = isWhatsApp ? 'whatsapp' : 'sms';
    const customerPhone = from.replace('whatsapp:', '');
    let messageText = buttonPayload || body?.trim() || '';

    // Handle location pins
    if (latitude && longitude && !messageText) {
      messageText = `📍 Location: ${latitude}, ${longitude}`;
    }

    if (!messageText) {
      return new NextResponse(EMPTY_TWIML, { headers: twimlHeaders });
    }

    console.log(`\n🚀 V3 Incoming [${channel}]: ${customerPhone}`);
    console.log(`   Message: ${messageText.substring(0, 100)}`);

    // 2. Resolve business ID
    let businessId = resolveBusinessIdFromMessage(messageText);

    if (!businessId) {
      businessId = await getLastBusinessId(customerPhone);
    }

    const supabase = getSupabase();

    if (!businessId) {
      // Try customer table
      const phoneWithPlus = customerPhone.startsWith('+')
        ? customerPhone
        : `+${customerPhone}`;
      const phoneWithoutPlus = customerPhone.replace(/^\+/, '');
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('business_id')
        .or(
          `phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`,
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingCustomer?.business_id) {
        businessId = existingCustomer.business_id;
      }
    }

    if (!businessId) {
      console.log('   ⚠️ V3: No business found — sending fallback');
      await sendFallbackReply(from, channel);
      return new NextResponse(EMPTY_TWIML, { headers: twimlHeaders });
    }

    console.log(`   🏢 Business: ${businessId}`);

    // 3. Fire automation event — all behavior is driven by rules
    const result = await fireEvent({
      businessId,
      event: 'inbound_whatsapp',
      phone: customerPhone,
      message: messageText,
      metadata: { messageSid, latitude, longitude, channel },
    });

    console.log(
      `   ✅ V3 done in ${Date.now() - startTime}ms — ${result.fired} rule(s), ${result.results.length} action(s)`,
    );

    return new NextResponse(EMPTY_TWIML, { headers: twimlHeaders });
  } catch (error) {
    console.error('❌ V3 Webhook Error:', error);
    return new NextResponse(EMPTY_TWIML, { headers: twimlHeaders });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Extract business ID from [BIZ:uuid] or (Ref: uuid/subdomain) in message text */
function resolveBusinessIdFromMessage(text: string): string | null {
  const bizMatch = text.match(/\[BIZ:([a-f0-9-]+)\]/i);
  if (bizMatch) return bizMatch[1];

  const refMatch = text.match(/\(Ref:\s*([a-zA-Z0-9-]+)\)/i);
  if (refMatch) {
    const val = refMatch[1];
    if (/^[a-f0-9-]{36}$/i.test(val)) return val;
    // Subdomain — would need DB lookup. For v3, rely on chat_history / customer table.
  }
  return null;
}

/** Generic fallback when no business could be resolved */
async function sendFallbackReply(to: string, channel: string) {
  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    const fallbackMsg = "Hi! 👋 I couldn't identify which business you're trying to reach. Could you let me know the business name?";

    if (channel === 'sms') {
      const smsFrom = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER || '';
      if (!smsFrom) return;
      const phone = to.replace(/^whatsapp:/, '');
      await client.messages.create({
        from: smsFrom.replace(/^whatsapp:/, ''),
        to: phone.startsWith('+') ? phone : `+${phone}`,
        body: fallbackMsg,
      });
    } else {
      const fromNum =
        process.env.TWILIO_WHATSAPP_FROM ||
        (process.env.TWILIO_WHATSAPP_NUMBER
          ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`
          : '');
      if (!fromNum) return;
      await client.messages.create({
        from: fromNum.startsWith('whatsapp:') ? fromNum : `whatsapp:${fromNum}`,
        to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
        body: fallbackMsg,
      });
    }
  } catch (e) {
    console.error('[v3] Fallback reply failed:', e);
  }
}

// ─── Health check ────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: 'v3-automation',
    description:
      'Messaging webhook (WhatsApp + SMS) — all behavior driven by automation rules',
  });
}
