// POST /api/prototype/lead
// Saves an email + generated business from the landing-page prototype.
// Table: public.prototype_leads (see db/migrations/20260703_prototype_leads.sql)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const idea = String(body.idea || '').trim().slice(0, 300);
  const mode = body.mode === 'existing' ? 'existing' : 'new';
  const plan = ['free', 'pro', 'scale'].includes(String(body.plan)) ? String(body.plan) : 'free';
  const business = body.business && typeof body.business === 'object' ? body.business : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 });
  }
  if (!business) {
    return NextResponse.json({ error: 'Missing business data.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { error } = await supabase.from('prototype_leads').insert({
    email,
    idea,
    mode,
    plan,
    business,
  });

  if (error) {
    console.error('[prototype/lead] insert error:', error);
    return NextResponse.json(
      { error: 'Could not save right now. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
