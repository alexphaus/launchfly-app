// src/app/api/retell/fallback-whatsapp/route.ts
// ─── Fallback: Send WhatsApp when the cron detects a "Called" lead with no booking ───

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/quote-followup/supabase';
import { sendWhatsApp } from '@/lib/quote-followup/whatsapp';
import { createDepositLink } from '@/lib/quote-followup/stripe-link';
import type { QuoteLead } from '@/lib/quote-followup/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { lead_id } = (await req.json()) as { lead_id?: string };
    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: lead } = await supabase
      .from('quote_leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const typedLead = lead as QuoteLead;

    if (typedLead.status !== 'Called') {
      return NextResponse.json(
        { error: `Lead status is "${typedLead.status}", expected "Called"` },
        { status: 409 }
      );
    }

    // Generate deposit link
    const depositLink = await createDepositLink({
      leadId: typedLead.id,
      customerName: typedLead.name,
      amountCents: Math.round(typedLead.quote_amount * 0.1 * 100),
      jobType: typedLead.job_type,
    });

    const cur = typedLead.currency || 'USD';
    const sym = cur === 'RM' ? 'RM' : '$';

    const msg = [
      `Hey ${typedLead.name}! 👋`,
      ``,
      `Just following up on your ${typedLead.job_type} quote (${sym}${typedLead.quote_amount.toLocaleString()}).`,
      `We'd love to get you on the schedule!`,
      ``,
      `Ready to move forward? Here's a secure deposit link:`,
      depositLink,
      ``,
      `Or just reply here with any questions — happy to help! 🏠`,
    ].join('\n');

    await sendWhatsApp(typedLead.phone, msg);

    await supabase
      .from('quote_leads')
      .update({
        status: 'WhatsApp_Nurture',
        stripe_payment_link: depositLink,
        next_action_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', lead_id);

    return NextResponse.json({ ok: true, action: 'whatsapp_sent' });
  } catch (err) {
    console.error('[retell/fallback-whatsapp] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
