import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

interface ActivityEvent {
  id: string;
  type: 'conversation' | 'call' | 'booking' | 'quote_followup';
  icon: string;
  title: string;
  detail: string;
  phone?: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get('businessId');
    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch from all real sources in parallel
    const [chatResult, quotesResult, bookingsResult] = await Promise.all([
      // Recent WhatsApp conversations (grouped by phone, last assistant message)
      supabase
        .from('chat_history')
        .select('id, phone, role, content, created_at')
        .eq('business_id', businessId)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(30),

      // Recent quote follow-up leads (calls + sequence activity)
      supabase
        .from('quote_leads')
        .select('id, name, phone, job_type, quote_amount, status, call_outcome, sequence_step, attempts, created_at, updated_at')
        .eq('business_id', businessId)
        .order('updated_at', { ascending: false })
        .limit(20),

      // Recent bookings created by the AI
      supabase
        .from('bookings')
        .select('id, customer_name, customer_phone, slot_date, slot_time, status, estimate, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(15),
    ]);

    const events: ActivityEvent[] = [];

    // ── WhatsApp conversations → activity events ──
    if (chatResult.data) {
      // Group by phone to avoid flooding with every single message
      const seenPhones = new Set<string>();
      for (const msg of chatResult.data) {
        if (seenPhones.has(msg.phone)) continue;
        seenPhones.add(msg.phone);
        const preview = msg.content.length > 80
          ? msg.content.substring(0, 80) + '...'
          : msg.content;
        events.push({
          id: msg.id,
          type: 'conversation',
          icon: '💬',
          title: `Replied to ${formatPhone(msg.phone)}`,
          detail: preview,
          phone: msg.phone,
          created_at: msg.created_at,
        });
      }
    }

    // ── Quote follow-ups → activity events ──
    if (quotesResult.data) {
      for (const lead of quotesResult.data) {
        if (lead.call_outcome) {
          // Retell voice call happened
          const outcomeLabel = lead.call_outcome === 'no-answer' ? 'No answer'
            : lead.call_outcome === 'busy' ? 'Busy'
            : lead.call_outcome === 'agent_triggered_whatsapp' ? 'Called → sent WhatsApp'
            : lead.call_outcome === 'ended' ? 'Connected'
            : lead.call_outcome;
          events.push({
            id: `call-${lead.id}`,
            type: 'call',
            icon: '📞',
            title: `Called ${lead.name}`,
            detail: `${outcomeLabel} · ${lead.job_type}`,
            phone: lead.phone,
            created_at: lead.updated_at,
          });
        }

        if (lead.attempts > 0) {
          events.push({
            id: `seq-${lead.id}`,
            type: 'quote_followup',
            icon: '🔄',
            title: `Following up with ${lead.name}`,
            detail: `Step ${lead.sequence_step ?? lead.attempts} · ${lead.status} · ${lead.job_type}`,
            phone: lead.phone,
            created_at: lead.updated_at,
          });
        }
      }
    }

    // ── Bookings → activity events ──
    if (bookingsResult.data) {
      for (const bk of bookingsResult.data) {
        events.push({
          id: `bk-${bk.id}`,
          type: 'booking',
          icon: '📅',
          title: `Booked ${bk.customer_name || formatPhone(bk.customer_phone || '')}`,
          detail: `${bk.slot_date} ${bk.slot_time}${bk.estimate ? ` · ${bk.estimate}` : ''} · ${bk.status}`,
          phone: bk.customer_phone ?? undefined,
          created_at: bk.created_at,
        });
      }
    }

    // Sort all events by newest first
    events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ activities: events.slice(0, 50) });
  } catch (err) {
    console.error('[assistants/activity] unexpected error:', err);
    return NextResponse.json({ activities: [] });
  }
}

function formatPhone(phone: string): string {
  if (!phone) return 'unknown';
  // Show last 4 digits for privacy
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 4) return `***${clean.slice(-4)}`;
  return phone;
}
