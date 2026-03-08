// src/app/api/assistants/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// CRUD API for the AI Assistant configuration
// ═══════════════════════════════════════════════════════════════════════════
//
// GET  /api/assistants?businessId=xxx  → Get the active assistant
// POST /api/assistants                 → Create or update assistant config
//
// Uses Supabase service key (server-side only) — auth checked via businessId ownership.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GET — Fetch the active assistant for a business
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get('businessId');
    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: assistant, error } = await supabase
      .from('assistants')
      .select('*')
      .eq('business_id', businessId)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      console.error('[assistants] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no assistant exists yet, return a default shape (UI will show defaults)
    if (!assistant) {
      return NextResponse.json({
        assistant: null,
        defaults: {
          name: 'AI Sales Assistant',
          tone: 'friendly',
          goal: 'book_consultation',
          system_prompt: null,
          custom_rules: [],
          knowledge_base: { pricing: [], faq: [], objections: [] },
          tools_enabled: ['send_checkout_link', 'book_calendar', 'send_template', 'transfer_to_human'],
          sequence_steps: [],
          trigger_config: { whatsapp_webhook: true, missed_call: true },
        },
      });
    }

    return NextResponse.json({ assistant });
  } catch (err) {
    console.error('[assistants] GET unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST — Create or update the assistant
// ═══════════════════════════════════════════════════════════════════════════

interface AssistantPayload {
  businessId: string;
  name?: string;
  tone?: string;
  goal?: string;
  system_prompt?: string | null;
  custom_rules?: string[];
  knowledge_base?: {
    pricing?: { service: string; price: string; unit: string }[];
    faq?: { q: string; a: string }[];
    objections?: { trigger: string; response: string }[];
  };
  tools_enabled?: string[];
  sequence_steps?: {
    step: number;
    dayOffset: number;
    hour: number;
    minute: number;
    channel: string;
    message: string;
    voicemail?: string;
  }[];
  trigger_config?: Record<string, boolean>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AssistantPayload;

    if (!body.businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check if an assistant already exists
    const { data: existing } = await supabase
      .from('assistants')
      .select('id')
      .eq('business_id', body.businessId)
      .eq('active', true)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only include fields that were actually sent
    if (body.name !== undefined) payload.name = body.name;
    if (body.tone !== undefined) payload.tone = body.tone;
    if (body.goal !== undefined) payload.goal = body.goal;
    if (body.system_prompt !== undefined) payload.system_prompt = body.system_prompt;
    if (body.custom_rules !== undefined) payload.custom_rules = body.custom_rules;
    if (body.knowledge_base !== undefined) payload.knowledge_base = body.knowledge_base;
    if (body.tools_enabled !== undefined) payload.tools_enabled = body.tools_enabled;
    if (body.sequence_steps !== undefined) payload.sequence_steps = body.sequence_steps;
    if (body.trigger_config !== undefined) payload.trigger_config = body.trigger_config;

    let result;

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('assistants')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[assistants] Update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('assistants')
        .insert({
          business_id: body.businessId,
          name: body.name || 'AI Sales Assistant',
          tone: body.tone || 'friendly',
          goal: body.goal || 'book_consultation',
          system_prompt: body.system_prompt ?? null,
          custom_rules: body.custom_rules || [],
          knowledge_base: body.knowledge_base || { pricing: [], faq: [], objections: [] },
          tools_enabled: body.tools_enabled || ['send_checkout_link', 'book_calendar', 'send_template', 'transfer_to_human'],
          sequence_steps: body.sequence_steps || [],
          trigger_config: body.trigger_config || { whatsapp_webhook: true, missed_call: true },
          active: true,
          ...payload,
        })
        .select()
        .single();

      if (error) {
        console.error('[assistants] Insert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ assistant: result, ok: true });
  } catch (err) {
    console.error('[assistants] POST unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
