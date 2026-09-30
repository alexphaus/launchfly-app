// src/app/copilot2/page.tsx
// Same entry, same load, same onboarding as /copilot — the four-tab layout is
// chosen here and nowhere else.
import { redirect } from 'next/navigation';
import CopilotEntry from '../copilot/_components/CopilotEntry';

export const dynamic = 'force-dynamic';

export default async function Copilot2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The Log money shortcut as installed before it had its own page: sent there
  // before the whole home loads, which is the wait the page exists to skip.
  // Chrome moves the installed shortcut to /copilot2/log when it next refreshes the app.
  if ((await searchParams).add === '1') redirect('/copilot2/log');
  return <CopilotEntry layout="four" />;
}
