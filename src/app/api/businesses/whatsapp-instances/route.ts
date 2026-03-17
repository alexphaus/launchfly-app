import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

/** GET /api/businesses/whatsapp-instances?businessId=xxx */
export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId');
  if (!businessId) return NextResponse.json({ error: 'Missing businessId' }, { status: 400 });

  let { data, error } = await supabase
    .from('whatsapp_instances')
    .select('id, label, provider, instance_id, instance_name, daily_limit, sends_today, active, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Auto-migrate: if no instances exist but business has whatsapp_api_config, create one ──
  if (!data || data.length === 0) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('whatsapp_api_config')
      .eq('id', businessId)
      .single();

    const cfg = biz?.whatsapp_api_config;
    if (cfg?.instanceId && cfg?.token) {
      // UltraMsg migration
      const { data: newInst } = await supabase
        .from('whatsapp_instances')
        .insert({
          business_id: businessId,
          label: cfg.instanceId,
          provider: cfg.provider || 'ultramsg',
          instance_id: cfg.instanceId,
          token: cfg.token,
          daily_limit: 25,
          sends_today: 0,
          active: true,
        })
        .select('id, label, provider, instance_id, instance_name, daily_limit, sends_today, active, created_at')
        .single();

      if (newInst) data = [newInst];
    } else if (cfg?.provider === 'evolution' && cfg?.baseUrl && cfg?.apiKey && cfg?.instanceName) {
      // Evolution migration
      const { data: newInst } = await supabase
        .from('whatsapp_instances')
        .insert({
          business_id: businessId,
          label: cfg.instanceName,
          provider: 'evolution',
          base_url: cfg.baseUrl,
          api_key: cfg.apiKey,
          instance_name: cfg.instanceName,
          daily_limit: 25,
          sends_today: 0,
          active: true,
        })
        .select('id, label, provider, instance_id, instance_name, daily_limit, sends_today, active, created_at')
        .single();

      if (newInst) data = [newInst];
    }
  }

  return NextResponse.json({ instances: data || [] });
}

/** POST /api/businesses/whatsapp-instances — create or update an instance */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, id, label, provider, dailyLimit, active, ...creds } = body;

    if (!businessId) return NextResponse.json({ error: 'Missing businessId' }, { status: 400 });
    if (!provider) return NextResponse.json({ error: 'Missing provider' }, { status: 400 });

    const row: Record<string, unknown> = {
      business_id: businessId,
      label: label || '',
      provider,
      daily_limit: Number(dailyLimit) || 25,
      active: active !== false,
    };

    if (provider === 'evolution') {
      if (!creds.baseUrl || !creds.apiKey || !creds.instanceName) {
        return NextResponse.json({ error: 'Missing Evolution fields' }, { status: 400 });
      }
      row.base_url = creds.baseUrl;
      row.api_key = creds.apiKey;
      row.instance_name = creds.instanceName;
    } else {
      if (!creds.instanceId || !creds.token) {
        return NextResponse.json({ error: 'Missing UltraMsg fields' }, { status: 400 });
      }
      row.instance_id = creds.instanceId;
      row.token = creds.token;
    }

    if (id) {
      // Update existing
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('business_id', businessId); // security: must own the instance
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, id });
    } else {
      // Create new
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .insert(row)
        .select('id')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, id: data.id });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PATCH /api/businesses/whatsapp-instances — toggle active, update daily_limit */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, id, active, dailyLimit } = body;
    if (!businessId || !id) return NextResponse.json({ error: 'Missing businessId or id' }, { status: 400 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof active === 'boolean') update.active = active;
    if (dailyLimit !== undefined) update.daily_limit = Number(dailyLimit);

    const { error } = await supabase
      .from('whatsapp_instances')
      .update(update)
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/businesses/whatsapp-instances?id=xxx&businessId=xxx */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const businessId = req.nextUrl.searchParams.get('businessId');
  if (!id || !businessId) return NextResponse.json({ error: 'Missing id or businessId' }, { status: 400 });

  const { error } = await supabase
    .from('whatsapp_instances')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
