// src/app/api/webhook/evolution/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Evolution API Inbound Webhook — Receives incoming WhatsApp messages
//
// Evolution sends a POST with JSON:
//   { event: 'messages.upsert', data: { key, pushName, message, ... } }
//
// Mirrors the UltraMsg webhook flow: resolve business → fire automation.
// Adds: typing indicator + read receipts for realism.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLastBusinessId } from '@/lib/ai-receptionist/history';
import { fireEvent } from '@/lib/automations/executor';
import {
  resolveBusinessByInstance,
  sendTypingPresence,
  markAsRead,
} from '@/lib/evolution';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

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
    const json = await request.json();

    // Evolution sends different event types — we only care about incoming messages
    const event = json.event;
    if (event !== 'messages.upsert') {
      return NextResponse.json({ ok: true, skipped: true, reason: `event:${event}` });
    }

    const data = json.data;
    if (!data) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_data' });
    }

    // Skip outgoing messages (fromMe = true)
    if (data.key?.fromMe) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'outgoing' });
    }

    // Extract fields
    const remoteJid = data.key?.remoteJid || '';
    const messageId = data.key?.id || '';
    const pushname = data.pushName || '';
    const instanceName = json.instance || json.instanceName || '';

    // Skip group messages
    if (remoteJid.includes('@g.us')) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'group' });
    }

    // Extract message text from different message types
    const messageText =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      '';

    const customerPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');

    if (!messageText.trim() || !customerPhone) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    console.log(`\n🟢 Evolution Incoming: +${customerPhone}`);
    console.log(`   Message: ${messageText.substring(0, 100)}`);
    if (pushname) console.log(`   Name: ${pushname}`);

    // ─── Resolve Business ID ────────────────────────────────────────
    let businessId: string | null =
      request.nextUrl.searchParams.get('businessId') || null;

    if (!businessId && instanceName) {
      businessId = await resolveBusinessByInstance(instanceName);
    }

    if (!businessId) {
      businessId = resolveBusinessIdFromMessage(messageText);
    }

    if (!businessId) {
      businessId = await getLastBusinessId(customerPhone);
    }

    const supabase = getSupabase();

    if (!businessId) {
      const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
      const phoneWithoutPlus = customerPhone.replace(/^\+/, '');
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('business_id')
        .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingCustomer?.business_id) {
        businessId = existingCustomer.business_id;
      }
    }

    if (!businessId) {
      console.log('   ⚠️ Evolution: No business found — sending fallback');
      const { sendWhatsApp } = await import('@/lib/evolution');
      await sendWhatsApp(
        customerPhone,
        "Hi! 👋 I couldn't identify which business you're trying to reach. Could you let me know the business name?",
      );
      return NextResponse.json({ ok: true, fallback: true });
    }

    console.log(`   🏢 Business: ${businessId}`);

    // ─── Immediately: Read receipt + typing indicator (fire-and-forget) ──
    markAsRead(messageId, customerPhone, businessId).catch(() => {});
    sendTypingPresence(customerPhone, businessId).catch(() => {});

    // ─── OPT-OUT CHECK ──────────────────────────────────────────────
    const isOptOut = /^(stop|unsubscribe|cancel|quit|end|no\s*more|opt\s*out)$/i.test(messageText.trim());
    if (isOptOut) {
      console.log(`   🛑 User ${customerPhone} opted out via WhatsApp.`);
      const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
      const phoneWithoutPlus = customerPhone.replace(/^\+/, '');

      const { sendWhatsApp } = await import('@/lib/evolution');
      await sendWhatsApp(customerPhone, "You've been successfully unsubscribed and won't receive more automated messages from us.", businessId);

      await supabase
        .from('customers')
        .update({ accepts_marketing: false })
        .eq('business_id', businessId)
        .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`);

      return NextResponse.json({ ok: true, opted_out: true });
    }

    // ─── AUTO-REPLY DETECTOR ────────────────────────────────────────
    const autoReplyRegex = /thank you for contacting|thanks for contacting|automated message|auto-?reply|out of (the )?office|currently closed|will get back to you|we are away|not in the office/i;
    if (autoReplyRegex.test(messageText)) {
      console.log(`   🤖 Detected Auto-Reply from +${customerPhone}. Ignoring to prevent AI loop.`);
      return NextResponse.json({ ok: true, skipped: true, reason: 'auto_reply' });
    }

    // ─── DEDUPLICATION CHECK ────────────────────────────────────────
    const duplicateWindowMs = 30 * 1000;
    const { data: recentDups } = await supabase
      .from('chat_history')
      .select('id')
      .eq('phone', customerPhone.replace(/^\+/, ''))
      .eq('role', 'user')
      .eq('content', messageText)
      .gte('created_at', new Date(Date.now() - duplicateWindowMs).toISOString())
      .limit(1);

    if (recentDups && recentDups.length > 0) {
      console.log(`   🔄 Detected duplicate webhook for ${customerPhone}. Skipping.`);
      return NextResponse.json({ ok: true, skipped: true, reason: 'duplicate_retry' });
    }

    // ─── Fire automation event ──────────────────────────────────────
    const result = await fireEvent({
      businessId,
      event: 'inbound_whatsapp',
      phone: customerPhone,
      message: messageText,
      metadata: {
        channel: 'whatsapp',
        pushname,
        source: 'evolution',
        messageId,
      },
    });

    console.log(
      `   ✅ Evolution done in ${Date.now() - startTime}ms — ${result.fired} rule(s), ${result.results.length} action(s)`,
    );

    return NextResponse.json({ ok: true, fired: result.fired });
  } catch (error) {
    console.error('❌ Evolution Webhook Error:', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function resolveBusinessIdFromMessage(text: string): string | null {
  const bizMatch = text.match(/\[BIZ:([a-f0-9-]+)\]/i);
  if (bizMatch) return bizMatch[1];

  const refMatch = text.match(/\(Ref:\s*([a-zA-Z0-9-]+)\)/i);
  if (refMatch) {
    const val = refMatch[1];
    if (/^[a-f0-9-]{36}$/i.test(val)) return val;
  }
  return null;
}

// ─── Health check ────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: 'evolution-v1',
    description: 'Evolution API WhatsApp webhook — typing indicators + read receipts',
    features: ['typing_indicator', 'read_receipts', 'self_hosted'],
  });
}
