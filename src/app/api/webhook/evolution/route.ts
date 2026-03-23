// src/app/api/webhook/evolution/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Evolution API Inbound Webhook — Receives incoming WhatsApp messages
//
// Evolution sends a POST with JSON:
//   { event: 'messages.upsert', data: { key, pushName, message, ... } }
//
// Mirrors the UltraMsg webhook flow: resolve business → fire automation.
// Adds: typing indicator + read receipts for realism.
//
// Also handles outgoing messages (fromMe):
//   - If message contains 📝 or #q → detected as a quote, fires quote_sent
//   - Otherwise → human handoff, pauses AI for that customer for 24h
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
import OpenAI from 'openai';

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

    // ── Handle outgoing messages (fromMe) ──────────────────────────
    if (data.key?.fromMe) {
      const instanceName = json.instance || json.instanceName || '';
      const remoteJid = data.key?.remoteJid || '';
      if (remoteJid.includes('@g.us')) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'outgoing_group' });
      }

      const outText =
        data.message?.conversation ||
        data.message?.extendedTextMessage?.text ||
        '';
      const customerPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      if (!outText.trim() || !customerPhone) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'outgoing_no_text' });
      }

      // Resolve which business this instance belongs to
      let bizId: string | null = null;
      if (instanceName) bizId = await resolveBusinessByInstance(instanceName);
      if (!bizId) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'outgoing_no_business' });
      }

      const supabase = getSupabase();

      // ── Bot echo filter: skip messages sent by our own API ──
      const msgId = data.key?.id;
      if (msgId) {
        const { data: botMsg } = await supabase
          .from('_bot_message_ids')
          .delete()
          .eq('message_id', msgId)
          .select('message_id')
          .maybeSingle();
        if (botMsg) {
          return NextResponse.json({ ok: true, skipped: true, reason: 'bot_echo' });
        }
      }

      // Look up the DB instance ID for routing follow-ups to the correct instance
      let waInstanceId: string | undefined;
      if (instanceName) {
        const { data: inst } = await supabase
          .from('whatsapp_instances')
          .select('id')
          .eq('instance_name', instanceName)
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        waInstanceId = inst?.id;
      }

      const QUOTE_TAG = /📝|#q\b/i;
      const isQuote = QUOTE_TAG.test(outText);

      // Phone normalization for DB queries
      const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
      const phoneWithoutPlus = customerPhone.replace(/^\+/, '');

      // ── Ensure customer record exists so handoff/disable always works ──
      await supabase.from('customers').upsert(
        {
          business_id: bizId,
          phone: phoneWithPlus,
          name: 'Unknown',
          email: `${phoneWithoutPlus}@wa.placeholder`,
          status: 'lead',
          source: 'whatsapp_outbound',
        },
        { onConflict: 'business_id,phone', ignoreDuplicates: true },
      );

      // ── Per-contact bot control: #off / #on ──
      const OFF_TAG = /\b#off\b/i;
      const ON_TAG = /\b#on\b/i;

      if (OFF_TAG.test(outText)) {
        // Permanently disable bot for this contact
        await supabase
          .from('customers')
          .update({ ai_paused_until: '2099-12-31T23:59:59Z' })
          .eq('business_id', bizId)
          .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`);
        console.log(`\n🚫 Bot disabled for +${customerPhone} (business ${bizId}) via #off`);
        return NextResponse.json({ ok: true, bot_disabled: true });
      }

      if (ON_TAG.test(outText)) {
        // Re-enable bot for this contact
        await supabase
          .from('customers')
          .update({ ai_paused_until: null })
          .eq('business_id', bizId)
          .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`);
        console.log(`\n✅ Bot re-enabled for +${customerPhone} (business ${bizId}) via #on`);
        return NextResponse.json({ ok: true, bot_enabled: true });
      }

      if (isQuote) {
        // ── Quote Detection: contractor tagged this message as a quote ──
        console.log(`\n📝 Quote detected from contractor (business ${bizId}) to +${customerPhone}`);
        const cleanText = outText.replace(/📝/g, '').replace(/#q\b/gi, '').trim();

        // Extract quote details via fast LLM
        let quoteAmount: number | undefined;
        let jobType: string | undefined;
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const extraction = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0,
            max_tokens: 150,
            messages: [{
              role: 'user',
              content: `Extract from this contractor quote message:\n- quote_amount (number only, no currency symbol)\n- job_type (short description)\n\nMessage: "${cleanText}"\n\nReturn JSON only: {"quote_amount": number|null, "job_type": string|null}`,
            }],
          });
          const parsed = JSON.parse(extraction.choices[0]?.message?.content || '{}');
          quoteAmount = parsed.quote_amount ?? undefined;
          jobType = parsed.job_type ?? undefined;
        } catch (e) {
          console.warn('   ⚠️ Quote extraction failed (non-fatal):', e);
        }

        // Fire quote_sent event → triggers assistant's quote follow-up sequence
        const result = await fireEvent({
          businessId: bizId,
          event: 'quote_sent',
          phone: customerPhone,
          amount: quoteAmount,
          metadata: {
            quoteAmount,
            jobType,
            source: 'whatsapp_tag',
            rawMessage: cleanText.substring(0, 500),
            ...(waInstanceId && { wa_instance_id: waInstanceId }),
          },
        });

        console.log(`   ✅ Quote event fired: ${result.fired} rule(s)`);
        return NextResponse.json({ ok: true, quote_detected: true, fired: result.fired });
      } else {
        // ── Human Handoff: contractor manually replied → pause AI for this customer ──
        const pauseUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        await supabase
          .from('customers')
          .update({ ai_paused_until: pauseUntil })
          .eq('business_id', bizId)
          .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`);

        console.log(`\n🤝 Human handoff: contractor (${bizId}) replied to +${customerPhone} — AI paused until ${pauseUntil}`);

        return NextResponse.json({ ok: true, human_handoff: true, paused_until: pauseUntil });
      }
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

    // ─── Ensure customer record exists (upsert on business_id+phone) ──
    const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
    const phoneWithoutPlus = customerPhone.replace(/^\+/, '');
    await supabase.from('customers').upsert(
      {
        business_id: businessId,
        phone: phoneWithPlus,
        name: pushname || 'Unknown',
        email: `${phoneWithoutPlus}@wa.placeholder`,
        status: 'lead',
        source: 'whatsapp_inbound',
      },
      { onConflict: 'business_id,phone', ignoreDuplicates: true },
    );

    // ─── OPT-OUT CHECK ──────────────────────────────────────────────
    const isOptOut = /^(stop|unsubscribe|cancel|quit|end|no\s*more|opt\s*out)$/i.test(messageText.trim());
    if (isOptOut) {
      console.log(`   🛑 User ${customerPhone} opted out via WhatsApp.`);

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

    // ─── HUMAN HANDOFF CHECK ────────────────────────────────────────
    // If the contractor recently replied to this customer, skip AI response
    {

      const { data: cust } = await supabase
        .from('customers')
        .select('ai_paused_until')
        .eq('business_id', businessId)
        .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
        .maybeSingle();

      if (cust?.ai_paused_until && new Date(cust.ai_paused_until) > new Date()) {
        console.log(`   🤝 AI paused for +${customerPhone} until ${cust.ai_paused_until} (human handoff). Skipping.`);
        return NextResponse.json({ ok: true, skipped: true, reason: 'human_handoff' });
      }
    }

    // ─── Resolve instance ID for correct follow-up routing ────────
    let waInstanceId: string | undefined;
    if (instanceName) {
      const { data: inst } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('instance_name', instanceName)
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      waInstanceId = inst?.id;
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
        ...(waInstanceId && { wa_instance_id: waInstanceId }),
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
