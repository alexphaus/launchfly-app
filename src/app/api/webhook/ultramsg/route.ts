// src/app/api/webhook/ultramsg/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// UltraMsg Inbound Webhook — Receives incoming WhatsApp messages
//
// UltraMsg sends a POST with form data containing:
//   from, body, type, media, pushname, etc.
//
// This mirrors the v3 Twilio webhook logic: resolve the business,
// then fire 'inbound_whatsapp' through the automation engine.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLastBusinessId } from '@/lib/ai-receptionist/history';
import { fireEvent } from '@/lib/automations/executor';
import { resolveBusinessByInstance } from '@/lib/ultramsg';

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
    // UltraMsg can send JSON or form-encoded depending on config
    let from = '';
    let body = '';
    let pushname = '';
    let instanceId = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const json = await request.json();
      // UltraMsg JSON webhook structure
      const data = json.data || json;
      from = data.from || '';
      body = data.body || '';
      pushname = data.pushname || data.notifyName || '';
      instanceId = data.instanceId || json.instanceId || '';
    } else {
      const formData = await request.formData();
      from = (formData.get('from') as string) || '';
      body = (formData.get('body') as string) || '';
      pushname = (formData.get('pushname') as string) || '';
      instanceId = (formData.get('instanceId') as string) || '';
    }

    // Normalize phone: UltraMsg sends "639XXXXXXXXX@c.us"
    const customerPhone = from
      .replace('@c.us', '')
      .replace('@s.whatsapp.net', '')
      .replace(/^whatsapp:/, '');

    const messageText = body?.trim() || '';

    // Skip empty messages and status updates
    if (!messageText || !customerPhone) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Skip outgoing messages (from self)
    if (from.includes('@g.us')) {
      // Group message — skip for now
      return NextResponse.json({ ok: true, skipped: true, reason: 'group' });
    }

    console.log(`\n🟢 UltraMsg Incoming: +${customerPhone}`);
    console.log(`   Message: ${messageText.substring(0, 100)}`);
    if (pushname) console.log(`   Name: ${pushname}`);

    // Resolve business ID:
    // 1. Query param ?businessId=xxx (set when configuring webhook URL per business)
    // 2. Match UltraMsg instance ID → businesses.whatsapp_api_config.instanceId
    // 3. [BIZ:uuid] in message text
    // 4. Chat history / customer table fallback
    let businessId: string | null =
      request.nextUrl.searchParams.get('businessId') || null;

    if (!businessId && instanceId) {
      businessId = await resolveBusinessByInstance(instanceId);
    }

    if (!businessId) {
      businessId = resolveBusinessIdFromMessage(messageText);
    }

    if (!businessId) {
      businessId = await getLastBusinessId(customerPhone);
    }

    const supabase = getSupabase();

    if (!businessId) {
      const phoneWithPlus = customerPhone.startsWith('+')
        ? customerPhone
        : `+${customerPhone}`;
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
      console.log('   ⚠️ UltraMsg: No business found — sending fallback');
      const { sendWhatsApp } = await import('@/lib/ultramsg');
      await sendWhatsApp(
        customerPhone,
        "Hi! 👋 I couldn't identify which business you're trying to reach. Could you let me know the business name?",
      );
      return NextResponse.json({ ok: true, fallback: true });
    }

    console.log(`   🏢 Business: ${businessId}`);

    // ─── HARD STOP / OPT-OUT CHECK (after full business resolution) ───
    const isOptOut = /^(stop|unsubscribe|cancel|quit|end|no\s*more|opt\s*out)$/i.test(messageText.trim());
    if (isOptOut) {
      console.log(`   🛑 User ${customerPhone} opted out via WhatsApp.`);
      const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
      const phoneWithoutPlus = customerPhone.replace(/^\+/, '');

      // Send confirmation FIRST (before blacklisting, otherwise our own check blocks it)
      const { sendWhatsApp } = await import('@/lib/ultramsg');
      await sendWhatsApp(customerPhone, "You've been successfully unsubscribed and won't receive more automated messages from us.", businessId);

      // Now blacklist — scoped to this business so other businesses aren't affected
      await supabase
        .from('customers')
        .update({ accepts_marketing: false })
        .eq('business_id', businessId)
        .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`);

      return NextResponse.json({ ok: true, opted_out: true });
    }

    // Fire automation event — all behavior driven by rules
    const result = await fireEvent({
      businessId,
      event: 'inbound_whatsapp',
      phone: customerPhone,
      message: messageText,
      metadata: {
        channel: 'whatsapp',
        pushname,
        source: 'ultramsg',
      },
    });

    console.log(
      `   ✅ UltraMsg done in ${Date.now() - startTime}ms — ${result.fired} rule(s), ${result.results.length} action(s)`,
    );

    return NextResponse.json({ ok: true, fired: result.fired });
  } catch (error) {
    console.error('❌ UltraMsg Webhook Error:', error);
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
    version: 'ultramsg',
    description: 'UltraMsg WhatsApp webhook — template-free, no 24h window',
    webhook_url: 'Set this URL in your UltraMsg dashboard under Webhook Settings',
  });
}
