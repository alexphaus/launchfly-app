import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { businessId, apiToken, defaultLocation } = await req.json();

    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('businesses')
      .update({
        prospecting_config: {
          apifyToken: apiToken || null,
          defaultLocation: defaultLocation || null,
        },
      })
      .eq('id', businessId);

    if (error) {
      console.error('[prospecting-config] Update failed:', error);
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[prospecting-config] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
