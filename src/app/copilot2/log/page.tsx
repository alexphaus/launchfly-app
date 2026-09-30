// src/app/copilot2/log/page.tsx
// Log money, the home-screen shortcut: the keypad and nothing else.
//
// The shortcut used to open the whole app — fifty reads for the Path, the
// matches, the plan and the numbers, then the book, then the sheet — seven to
// nine seconds on the owner's phone to log a coffee. This page reads the
// profile and then three things at once (bookstore.ts loadLogScreen), and draws
// the keypad in its first HTML, so the digits are there before any script runs.
import { redirect } from 'next/navigation';
import LogScreen from '../../copilot/_components/v2/LogScreen';
import { loadLogScreen } from '@/lib/copilot/money/bookstore';
import { currentProfileId } from '@/lib/copilot/session';

export const dynamic = 'force-dynamic';

export default async function LogMoneyPage() {
  const pid = await currentProfileId();
  // Signed out, the app's own front door signs in; the shortcut works after.
  if (!pid) redirect('/copilot2');
  let data;
  try {
    data = await loadLogScreen(pid);
  } catch (e) {
    return <LogScreen pid={pid} data={null} failed={e instanceof Error ? e.message : String(e)} />;
  }
  if (!data) redirect('/copilot2');
  return <LogScreen pid={pid} data={data} failed={null} />;
}
