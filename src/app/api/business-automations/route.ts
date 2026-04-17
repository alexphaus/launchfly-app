// src/app/api/business-automations/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Business-level Automation Rules API
// ═══════════════════════════════════════════════════════════════════════════
//
// Automation rules are stored at the business level (businesses.automation_rules)
// so they remain active regardless of which assistant persona is selected.
//
// GET  /api/business-automations?businessId=xxx  → Return automation_rules
// POST /api/business-automations                  → Save rules & sync QStash CRONs

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncBusinessCrons } from '@/lib/automations/cron';
import type { AutomationRule } from '@/lib/automations/cron';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GET — Return the business's automation rules
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get('businessId');
    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('businesses')
      .select('automation_rules')
      .eq('id', businessId)
      .maybeSingle();

    if (error) {
      console.error('[business-automations] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rules: (data?.automation_rules as AutomationRule[]) || [] });
  } catch (err) {
    console.error('[business-automations] GET unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST — Save automation rules and sync QStash CRONs
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { businessId: string; rules: AutomationRule[] };

    if (!body.businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }
    if (!Array.isArray(body.rules)) {
      return NextResponse.json({ error: 'rules must be an array' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify business exists
    const { data: biz, error: bizErr } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', body.businessId)
      .maybeSingle();

    if (bizErr || !biz) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Sync QStash CRONs and get back rules with updated qstashScheduleId values
    const syncedRules = await syncBusinessCrons(body.businessId, body.rules);

    // Save to DB
    const { error: saveErr } = await supabase
      .from('businesses')
      .update({ automation_rules: syncedRules })
      .eq('id', body.businessId);

    if (saveErr) {
      console.error('[business-automations] POST save error:', saveErr);
      return NextResponse.json({ error: saveErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rules: syncedRules });
  } catch (err) {
    console.error('[business-automations] POST unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
