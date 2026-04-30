import { NextResponse } from 'next/server';
import { pruneMemories } from '@/lib/agent/memory-pruner';

export const maxDuration = 300; // Allow up to 5 minutes for execution on Vercel

export async function GET(req: Request) {
  // Basic security to ensure this is only called by our trusted cron provider (e.g. Vercel Cron, QStash)
  const authHeader = req.headers.get('authorization');
  const CRON_SECRET = process.env.CRON_SECRET;
  
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    await pruneMemories();
    return NextResponse.json({ success: true, message: 'Nightly dream (memory prune) completed successfully.' });
  } catch (error) {
    console.error('[cron/nightly-dream] Execution error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
