// src/app/api/email/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { routeHotLead } from '@/lib/lead-router';
import { emit, Event } from '@/lib/events';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: NextRequest) {
  const body: any = await req.json();
  const from = (body.from || body.sender) as string | undefined;
  const text = (body.text || body.html || '').toString();
  const inReplyTo = body.headers?.['In-Reply-To'] || body.in_reply_to || null;

  let emailRow: any = null;
  if (inReplyTo) {
    const { data } = await supabase
      .from('emails')
      .select('*')
      .eq('provider_message_id', inReplyTo)
      .maybeSingle();
    emailRow = data;
  }
  if (!emailRow && from) {
    const { data } = await supabase
      .from('emails')
      .select('*')
      .eq('to_email', from)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    emailRow = data;
  }

  if (!emailRow) return NextResponse.json({ ok: true });

  await supabase.from('email_replies').insert({
    email_id: emailRow.id,
    business_id: emailRow.business_id,
    from_email: from || null,
    body: text
  });

  await routeHotLead({
    toEmail: process.env.FOUNDER_EMAIL,
    toPhone: process.env.FOUNDER_PHONE,
    subject: 'New reply from prospect',
    text: text.slice(0, 240)
  });

  await emit(Event.LeadReplied, { businessId: emailRow.business_id, emailId: emailRow.id });

  return NextResponse.json({ ok: true });
}


