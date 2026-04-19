// /api/agent/video-generate — Dedicated endpoint for long-running video tools.
// Called via Upstash Workflow context.call() so the execution is NOT bound by
// the workflow-run function's maxDuration.  Upstash will wait up to 2 hours for
// the response, and the Vercel function itself gets a generous maxDuration.

import { NextRequest, NextResponse } from 'next/server';
import { executeTool, type ToolContext } from '@/lib/agent/tools';

export const maxDuration = 800; // 13 min — enough for multi-scene video

export async function POST(req: NextRequest) {
  // Simple shared-secret auth so only our workflow can call this
  const authHeader = req.headers.get('authorization');
  const expected = `Bearer ${process.env.SUPABASE_SERVICE_KEY}`;
  if (authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { toolName, args, toolCtx } = (await req.json()) as {
    toolName: string;
    args: Record<string, unknown>;
    toolCtx: ToolContext;
  };

  if (!['generate_video', 'generate_long_video'].includes(toolName)) {
    return NextResponse.json({ error: `Unsupported tool: ${toolName}` }, { status: 400 });
  }

  try {
    const result = await executeTool(toolName, args, toolCtx);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ result: `Tool error: ${message}` });
  }
}
