import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assistants/activity/call?callId=...
 * Fetches the call transcript from Retell AI's API.
 * callId = the retell_call_id stored in quote_leads.
 */
export async function GET(req: NextRequest) {
  const callId = req.nextUrl.searchParams.get('callId');

  if (!callId) {
    return NextResponse.json({ error: 'callId required' }, { status: 400 });
  }

  const retellApiKey = process.env.RETELL_API_KEY;
  if (!retellApiKey) {
    return NextResponse.json({ error: 'RETELL_API_KEY not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.retellai.com/v2/get-call/${encodeURIComponent(callId)}`, {
      headers: {
        Authorization: `Bearer ${retellApiKey}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[activity/call] Retell API ${res.status}:`, errText);
      return NextResponse.json({ error: 'Failed to fetch call details', status: res.status }, { status: 502 });
    }

    const call = await res.json();

    // Extract transcript array — Retell returns transcript as an array of utterances
    // Each utterance: { role: "agent"|"user", content: string, words: [...] }
    const transcript = (call.transcript_object || call.transcript || []).map(
      (u: { role: string; content: string }) => ({
        role: u.role === 'agent' ? 'assistant' : 'user',
        content: u.content,
      }),
    );

    const analysis = call.call_analysis || {};

    return NextResponse.json({
      transcript,
      summary: analysis.call_summary || null,
      sentiment: analysis.user_sentiment || null,
      duration: call.end_timestamp && call.start_timestamp
        ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
        : null,
      status: call.call_status || call.status || null,
    });
  } catch (err) {
    console.error('[activity/call] unexpected error:', err);
    return NextResponse.json({ error: 'Failed to fetch call transcript' }, { status: 500 });
  }
}
