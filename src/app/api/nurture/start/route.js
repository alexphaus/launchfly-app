// src/app/api/nurture/start/route.js
import { NextResponse } from 'next/server';
import { inngest, EVENTS } from '@/lib/inngest/client';

export async function POST(request) {
  try {
    const { businessId, theme, max = 25 } = await request.json();
    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

    await inngest.send({
      name: EVENTS.NURTURE_SCHEDULED,
      data: { businessId, theme: theme || 'education', max }
    });

    return NextResponse.json({ success: true, scheduled: true });
  } catch (error) {
    console.error('nurture/start error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


