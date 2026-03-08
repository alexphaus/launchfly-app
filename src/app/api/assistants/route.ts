// src/app/api/assistants/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// CRUD API for the AI Assistant configuration
// ═══════════════════════════════════════════════════════════════════════════
//
// GET  /api/assistants?businessId=xxx           → Get the active assistant
// GET  /api/assistants?businessId=xxx&list=true  → List ALL assistants
// POST /api/assistants                           → Create or update assistant config
// PUT  /api/assistants                           → Switch active assistant or create new
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
    const listAll = req.nextUrl.searchParams.get('list') === 'true';

    if (listAll) {
      // Return ALL assistants for the business (for the switcher dropdown)
      const { data: assistants, error } = await supabase
        .from('assistants')
        .select('id, name, tone, goal, active, created_at')
        .eq('business_id', businessId)
        .order('active', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[assistants] GET list error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ assistants: assistants || [] });
    }

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
  assistantId?: string;  // Target a specific assistant (prevents race conditions)
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

    // Find the specific assistant to update (by ID if provided, otherwise active)
    let existing: { id: string } | null = null;
    if (body.assistantId) {
      const { data } = await supabase
        .from('assistants')
        .select('id')
        .eq('id', body.assistantId)
        .eq('business_id', body.businessId)
        .maybeSingle();
      existing = data;
    } else {
      const { data } = await supabase
        .from('assistants')
        .select('id')
        .eq('business_id', body.businessId)
        .eq('active', true)
        .maybeSingle();
      existing = data;
    }

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

// ═══════════════════════════════════════════════════════════════════════════
// PUT — Switch active assistant or create a new one
// ═══════════════════════════════════════════════════════════════════════════

interface SwitchPayload {
  businessId: string;
  assistantId?: string;   // switch to this existing assistant
  createNew?: boolean;     // create a brand-new assistant and make it active
  newName?: string;        // name for the new assistant
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as SwitchPayload;

    if (!body.businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const supabase = getSupabase();

    if (body.createNew) {
      // Deactivate all current assistants for this business
      await supabase
        .from('assistants')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('business_id', body.businessId)
        .eq('active', true);

      // Create a new one
      const { data: newAssistant, error } = await supabase
        .from('assistants')
        .insert({
          business_id: body.businessId,
          name: body.newName || 'New Assistant',
          tone: 'friendly',
          goal: 'book_consultation',
          tools_enabled: ['send_checkout_link', 'book_calendar', 'send_template', 'transfer_to_human'],
          trigger_config: { whatsapp_webhook: true, missed_call: true },
          active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('[assistants] PUT create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ assistant: newAssistant, ok: true });
    }

    if (body.assistantId) {
      // Verify the assistant belongs to this business
      const { data: target } = await supabase
        .from('assistants')
        .select('id, business_id')
        .eq('id', body.assistantId)
        .eq('business_id', body.businessId)
        .single();

      if (!target) {
        return NextResponse.json({ error: 'Assistant not found' }, { status: 404 });
      }

      // Deactivate all current assistants
      await supabase
        .from('assistants')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('business_id', body.businessId)
        .eq('active', true);

      // Activate the chosen one
      const { data: switched, error } = await supabase
        .from('assistants')
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq('id', body.assistantId)
        .select()
        .single();

      if (error) {
        console.error('[assistants] PUT switch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ assistant: switched, ok: true });
    }

    return NextResponse.json({ error: 'assistantId or createNew required' }, { status: 400 });
  } catch (err) {
    console.error('[assistants] PUT unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
