// src/app/api/r/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emit, Event } from '@/lib/events';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const slug = params.slug;
    if (!slug) return new NextResponse('Invalid', { status: 400 });

    const { data: click } = await supabase
      .from('clicks')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (!click) return new NextResponse('Not found', { status: 404 });

    await supabase
      .from('emails')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', click.email_id);

    await emit(Event.LeadClicked, { businessId: click.business_id, emailId: click.email_id, slug });

    const dest = click.dest_url as string;
    const url = new URL(dest);
    url.searchParams.set('utm_source', 'email');
    url.searchParams.set('utm_medium', 'cold');
    url.searchParams.set('utm_campaign', click.campaign_id || 'default');

    return NextResponse.redirect(url.toString(), 302);
  } catch (e: any) {
    return new NextResponse(`Server error: ${e?.message || 'unknown'}`, { status: 500 });
  }
}

export const runtime = 'nodejs';


