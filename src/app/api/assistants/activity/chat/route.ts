import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

/**
 * GET /api/assistants/activity/chat?businessId=...&phone=...
 * Returns the full chat history between the AI and a customer phone number.
 */
export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId');
  const phone = req.nextUrl.searchParams.get('phone');

  if (!businessId || !phone) {
    return NextResponse.json({ error: 'businessId and phone required' }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('chat_history')
    .select('id, role, content, created_at')
    .eq('business_id', businessId)
    .eq('phone', phone)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[activity/chat] error:', error);
    return NextResponse.json({ messages: [] });
  }

  return NextResponse.json({ messages: data || [] });
}
