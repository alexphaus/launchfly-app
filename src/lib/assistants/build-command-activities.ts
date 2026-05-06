/**
 * Builds the unified Command Center activity feed (chat, quote follow-ups, bookings).
 * Used by the server command page (RLS) and `/api/assistants/activity` (service role).
 */

export interface ActivityEvent {
  id: string;
  type: 'conversation' | 'call' | 'booking' | 'quote_followup';
  icon: string;
  title: string;
  detail: string;
  phone?: string;
  leadId?: string;
  retellCallId?: string;
  created_at: string;
}

function formatPhone(phone: string): string {
  if (!phone) return 'unknown';
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 4) return `***${clean.slice(-4)}`;
  return phone;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildCommandActivities(supabase: any, businessId: string, maxEvents = 50): Promise<ActivityEvent[]> {
  const [chatResult, quotesResult, bookingsResult] = await Promise.all([
    supabase
      .from('chat_history')
      .select('id, phone, role, content, created_at')
      .eq('business_id', businessId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(30),

    supabase
      .from('quote_leads')
      .select(
        'id, name, phone, job_type, quote_amount, status, call_outcome, retell_call_id, sequence_step, attempts, created_at, updated_at',
      )
      .eq('business_id', businessId)
      .order('updated_at', { ascending: false })
      .limit(20),

    supabase
      .from('bookings')
      .select('id, customer_name, customer_phone, slot_date, slot_time, status, estimate, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const events: ActivityEvent[] = [];

  if (chatResult.data) {
    const seenPhones = new Set<string>();
    for (const msg of chatResult.data as {
      id: string;
      phone: string;
      content: string;
      created_at: string;
    }[]) {
      if (seenPhones.has(msg.phone)) continue;
      seenPhones.add(msg.phone);
      const preview =
        msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content;
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

  if (quotesResult.data) {
    for (const lead of quotesResult.data as {
      id: string;
      name: string;
      phone: string;
      job_type: string;
      status: string;
      call_outcome: string | null;
      retell_call_id: string | null;
      sequence_step: number | null;
      attempts: number;
      updated_at: string;
    }[]) {
      if (lead.call_outcome) {
        const outcomeLabel =
          lead.call_outcome === 'no-answer'
            ? 'No answer'
            : lead.call_outcome === 'busy'
              ? 'Busy'
              : lead.call_outcome === 'agent_triggered_whatsapp'
                ? 'Called → sent WhatsApp'
                : lead.call_outcome === 'ended'
                  ? 'Connected'
                  : lead.call_outcome;
        events.push({
          id: `call-${lead.id}`,
          type: 'call',
          icon: '📞',
          title: `Called ${lead.name}`,
          detail: `${outcomeLabel} · ${lead.job_type}`,
          phone: lead.phone,
          leadId: lead.id,
          retellCallId: lead.retell_call_id ?? undefined,
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

  if (bookingsResult.data) {
    for (const bk of bookingsResult.data as {
      id: string;
      customer_name: string | null;
      customer_phone: string | null;
      slot_date: string;
      slot_time: string;
      status: string;
      estimate: string | null;
      created_at: string;
    }[]) {
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

  events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return events.slice(0, maxEvents);
}

export { formatPhone as formatPhoneForActivity };
