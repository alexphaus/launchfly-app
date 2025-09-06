// src/app/api/leads/flag/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { routeHotLead } from '@/lib/lead-router';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, email, reason } = await request.json();
    if (!businessId || !email) return NextResponse.json({ error: 'businessId and email required' }, { status: 400 });

    await supabase
      .from('prospects')
      .update({ conversion_status: 'qualified', engagement_score: 100, updated_at: new Date().toISOString() })
      .eq('business_id', businessId)
      .eq('email', email);

    if (process.env.FOUNDER_EMAIL || process.env.FOUNDER_PHONE) {
      await routeHotLead({
        toEmail: process.env.FOUNDER_EMAIL,
        toPhone: process.env.FOUNDER_PHONE,
        subject: 'Hot Prospect Flagged',
        text: `${email} flagged as hot. ${reason || ''}`.slice(0, 240)
      });
    }

    await supabase.from('ai_activities').insert({
      business_id: businessId,
      type: 'metrics_update',
      icon: '🔥',
      message: `Prospect flagged as hot: ${email}`,
      details: reason || 'High intent detected',
      metadata: { email }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('leads/flag error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


