import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { businessId, instanceId, token } = await req.json();

    if (!businessId || !instanceId || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('businesses')
      .update({
        whatsapp_api_config: {
          provider: 'ultramsg',
          instanceId,
          token,
        },
      })
      .eq('id', businessId);

    if (error) {
      console.error('[whatsapp-config] Update failed:', error);
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[whatsapp-config] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
