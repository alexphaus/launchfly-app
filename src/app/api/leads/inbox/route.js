// src/app/api/leads/inbox/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const limit = Number(searchParams.get('limit') || 50);
    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

    // Aggregate conversations, latest reply, prospect details, and status
    const { data: conversations } = await supabase
      .from('email_conversations')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: prospects } = await supabase
      .from('prospects')
      .select('id, email, name, company, status, engagement_score, last_engagement')
      .eq('business_id', businessId);

    // Group by email
    const byEmail = new Map();
    for (const conv of conversations || []) {
      const list = byEmail.get(conv.prospect_email) || [];
      list.push(conv);
      byEmail.set(conv.prospect_email, list);
    }

    const prospectByEmail = new Map((prospects || []).map(p => [p.email, p]));

    const inbox = Array.from(byEmail.entries()).map(([email, msgs]) => {
      const sorted = msgs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      const last = sorted[0];
      const p = prospectByEmail.get(email) || {};
      return {
        email,
        lastMessage: last?.content || '',
        lastType: last?.message_type || 'unknown',
        lastAt: last?.created_at,
        prospect: {
          name: p.name || null,
          company: p.company || null,
          status: p.status || 'discovered',
          engagement: p.engagement_score || 0,
          last_engagement: p.last_engagement || null,
        },
        totalMessages: msgs.length
      };
    });

    return NextResponse.json({ success: true, inbox });
  } catch (error) {
    console.error('leads/inbox error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


