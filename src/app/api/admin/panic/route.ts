import { NextResponse } from 'next/server';
import { emergencyStopAllTasks } from '@/lib/agent/runner';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  // Hardcode a simple token to prevent completely open access,
  // or use the Supabase Service Key if none provided (for script ease).
  if (token !== process.env.SUPABASE_SERVICE_KEY?.substring(0, 10)) {
    return NextResponse.json({ error: 'Unauthorized. Pass ?token=first_10_chars_of_service_key' }, { status: 401 });
  }

  const count = await emergencyStopAllTasks();

  return NextResponse.json({
    status: 'SYSTEM_HALTED',
    tasks_killed: count,
    message: 'Global kill switch activated successfully.'
  });
}
