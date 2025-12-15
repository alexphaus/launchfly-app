import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  try {
    // 1. Fetch Key Metrics
    const { count: prospectCount } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'prospect');

    const { count: customerCount } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ready');

    // Count businesses with sent emails (outreach)
    const { count: outreachCount } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .not('latest_email_campaign', 'is', null);

    const { data: revenueData } = await supabase
      .from('businesses')
      .select('total_revenue, total_leads');

    const totalRevenue = revenueData?.reduce((sum, biz) => sum + (biz.total_revenue || 0), 0) || 0;
    const totalLeads = revenueData?.reduce((sum, biz) => sum + (biz.total_leads || 0), 0) || 0;

    // 2. Fetch Recent Activity
    const { data: recentActivity } = await supabase
      .from('businesses')
      .select('id, name, status, created_at, form_data')
      .order('created_at', { ascending: false })
      .limit(10);

    // 3. Generate AI Insights
    const metrics = {
      prospects: prospectCount || 0,
      outreach: outreachCount || 0,
      customers: customerCount || 0,
      revenue: totalRevenue,
      leads: totalLeads,
      conversionRate: outreachCount ? ((customerCount || 0) / outreachCount * 100).toFixed(1) : '0'
    };

    let insights = [];
    try {
        const prompt = `
            Analyze these business metrics for a Lead Generation Agency:
            - Prospects Identified: ${metrics.prospects}
            - Outreach Sent: ${metrics.outreach}
            - Active Clients: ${metrics.customers}
            - Total Revenue: $${metrics.revenue}
            - Leads Generated for Clients: ${metrics.leads}
            - Conversion Rate (Outreach -> Client): ${metrics.conversionRate}%

            Provide 3 short, actionable strategic insights (max 1 sentence each) for the agency founder.
            Focus on growth, efficiency, or revenue.
            Format as JSON object with key "insights" which is an array of strings.
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'gpt-4-turbo-preview',
            response_format: { type: 'json_object' },
        });
        
        const result = JSON.parse(completion.choices[0].message.content || '{"insights": []}');
        insights = result.insights || [];
    } catch (e) {
        console.error("AI Insight generation failed", e);
        insights = [
            "Focus on converting more prospects to active clients to boost revenue.",
            "Increase outreach volume to generate more prospects.",
            "Optimize your lead magnets to improve client results."
        ];
    }

    return NextResponse.json({
      metrics,
      recentActivity,
      insights
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
