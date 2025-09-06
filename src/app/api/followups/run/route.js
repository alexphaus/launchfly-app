// src/app/api/followups/run/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId } = await request.json();
    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

    // Find due follow-ups for this business
    const { data: dueTasks, error } = await supabase
      .from('follow_up_tasks')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'scheduled')
      .lte('follow_up_date', new Date().toISOString());

    if (error) throw error;

    // If none due, still trigger scheduler globally as a fallback
    if (!dueTasks || dueTasks.length === 0) {
      await inngest.send({ name: 'cron/daily', data: { reason: 'manual_trigger', businessId } });
      return NextResponse.json({ success: true, tasksTriggered: 0 });
    }

    // Trigger follow-up for each due task
    for (const task of dueTasks) {
      await inngest.send({
        name: 'follow-up/due',
        data: {
          businessId: task.business_id,
          prospectEmail: task.prospect_email,
          objectionType: task.objection_type,
          taskId: task.id
        }
      });
    }

    return NextResponse.json({ success: true, tasksTriggered: dueTasks.length });
  } catch (error) {
    console.error('followups/run error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


