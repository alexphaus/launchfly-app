// /api/agent/video-generate — Dedicated endpoint for long-running video tools.
// Called via Upstash Workflow context.call() so the execution is NOT bound by
// the workflow-run function's maxDuration.  Upstash will wait up to 30 min for
// the response, and the Vercel function itself gets a generous maxDuration.

import { NextRequest, NextResponse } from 'next/server';
import { executeTool, type ToolContext } from '@/lib/agent/tools';

export const maxDuration = 800; // 13 min — enough for multi-scene video

export async function POST(req: NextRequest) {
  console.log('[video-generate] Request received');

  try {
    // Auth check first (before parsing body)
    const authHeader = req.headers.get('authorization');
    const expected = `Bearer ${process.env.SUPABASE_SERVICE_KEY}`;
    if (authHeader !== expected) {
      console.error('[video-generate] Auth failed — header mismatch');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body with explicit error handling
    let toolName: string;
    let args: Record<string, unknown>;
    let toolCtx: ToolContext;
    try {
      const body = await req.json();
      toolName = body.toolName;
      args = body.args;
      toolCtx = body.toolCtx;
    } catch (parseErr) {
      console.error('[video-generate] Body parse error:', parseErr);
      return NextResponse.json({ result: `Tool error: failed to parse request body — ${parseErr instanceof Error ? parseErr.message : String(parseErr)}` });
    }

    if (!toolName || !['generate_video', 'generate_long_video'].includes(toolName)) {
      console.error(`[video-generate] Unsupported tool: ${toolName}`);
      return NextResponse.json({ error: `Unsupported tool: ${toolName}` }, { status: 400 });
    }

    console.log(`[video-generate] Executing ${toolName} for business ${toolCtx?.businessId}`);
    const startMs = Date.now();
    const result = await executeTool(toolName, args, toolCtx);
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`[video-generate] ${toolName} completed in ${elapsed}s — ${result.substring(0, 200)}`);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[video-generate] Unhandled error:', message, err instanceof Error ? err.stack : '');
    return NextResponse.json({ result: `Tool error: ${message}` });
  }
}
