// src/app/api/outreach/send/route.js
import { createClient } from '@supabase/supabase-js';
import { generatePersonalizedEmail, sendEmail } from '@/lib/customer-acquisition';
import { buildMicroOfferAudit } from '@/lib/playbooks/b2bOutbound';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, limit = 25 } = await request.json();
    if (!businessId) return Response.json({ error: 'businessId required' }, { status: 400 });

    // Get plan + business
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    if (bizErr || !business) return Response.json({ error: 'Business not found' }, { status: 404 });

    const plan = business.strategy_plan || { playbook: 'B2BOutbound', channels: [{ name: 'Outreach', cap: 25 }] };
    const outreachChannel = plan.channels.find((c) => (c.name || '').toLowerCase() === 'outreach');
    const cap = Math.max(1, Math.min(Number(outreachChannel?.cap || limit), 50));

    // Fetch prospects to email
    const { data: prospects } = await supabase
      .from('prospects')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'discovered')
      .order('created_at', { ascending: true })
      .limit(cap);

    if (!prospects || prospects.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'No prospects available' });
    }

    const template = buildMicroOfferAudit({ vertical: business.business_data?.niche || business.name });
    const results = [];
    for (const p of prospects) {
      try {
        // Use existing generator for personalization; fallback to template subject/body if needed
        const email = await generatePersonalizedEmail(p, business.business_data || {});
        email.subject = email.subject || template.subject;
        email.body = email.body || template.body.replace('{{name}}', p.name || 'there');
        const res = await sendEmail(email);
        results.push({ success: res.success, to: p.email, id: res.emailId });
        await supabase
          .from('prospects')
          .update({ status: 'contacted', contacted_at: new Date().toISOString() })
          .eq('id', p.id);
      } catch (e) {
        results.push({ success: false, to: p.email, error: e.message });
      }
    }

    return Response.json({ success: true, sent: results.filter((r) => r.success).length, results });
  } catch (error) {
    console.error('Outreach send error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ title: 'Outreach Send API', method: 'POST', body: { businessId: 'uuid', limit: 25 } });
}


