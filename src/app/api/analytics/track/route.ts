import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

interface TrackingPayload {
  sessionId: string;
  events: AnalyticsEvent[];
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, events }: TrackingPayload = await request.json();

    if (!sessionId || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Invalid payload: sessionId and events array required' },
        { status: 400 }
      );
    }

    // Process each event
    const processedEvents = events.map(event => ({
      session_id: sessionId,
      event_name: event.event,
      event_properties: event.properties || {},
      timestamp: new Date(event.timestamp || Date.now()).toISOString(),
      created_at: new Date().toISOString()
    }));

    // Store events in Supabase
    const { error } = await supabase
      .from('onboarding_analytics')
      .insert(processedEvents);

    if (error) {
      console.error('Failed to store analytics events:', error);
      return NextResponse.json(
        { error: 'Failed to store events' },
        { status: 500 }
      );
    }

    // Also log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Onboarding Analytics:', {
        sessionId,
        eventCount: events.length,
        events: events.map(e => ({ event: e.event, ...e.properties }))
      });
    }

    return NextResponse.json({ 
      success: true, 
      eventsProcessed: events.length 
    });

  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
