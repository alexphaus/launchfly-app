import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, provider } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 });
    }

    let config: Record<string, string>;

    if (provider === 'evolution') {
      // Evolution API: { provider, baseUrl, apiKey, instanceName }
      const { baseUrl, apiKey, instanceName } = body;
      if (!baseUrl || !apiKey || !instanceName) {
        return NextResponse.json({ error: 'Missing Evolution fields: baseUrl, apiKey, instanceName' }, { status: 400 });
      }
      config = { provider: 'evolution', baseUrl, apiKey, instanceName };
    } else {
      // UltraMsg (default): { provider, instanceId, token }
      const { instanceId, token } = body;
      if (!instanceId || !token) {
        return NextResponse.json({ error: 'Missing UltraMsg fields: instanceId, token' }, { status: 400 });
      }
      config = { provider: 'ultramsg', instanceId, token };
    }

    const { error } = await supabase
      .from('businesses')
      .update({ whatsapp_api_config: config })
      .eq('id', businessId);

    if (error) {
      console.error('[whatsapp-config] Update failed:', error);
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, provider: config.provider });
  } catch (err: any) {
    console.error('[whatsapp-config] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
