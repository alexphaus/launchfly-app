// src/app/copilot/_components/CopilotEntry.tsx
// The server entry shared by every shell that renders the copilot. New device ->
// onboarding. Known device -> the app, with data already loaded so there is no
// loading flash. /copilot and /lifeos differ only in the theme their layout
// sets; /copilot2 renders the four-tab layout over the same load, so the data,
// the onboarding and the failure screen are all shared from here.
import { currentProfileId } from '@/lib/copilot/session';
import { loadHome } from '@/lib/copilot/store';
import type { HomeData } from '@/lib/copilot/types';
import CopilotApp from './CopilotApp';
import CopilotApp2 from './v2/CopilotApp2';
import Onboarding from './Onboarding';

export default async function CopilotEntry({ layout = 'two' }: { layout?: 'two' | 'four' }) {
  const pid = await currentProfileId();
  let home: HomeData | null = null;
  if (pid) {
    try {
      home = await loadHome(pid);
    } catch (err) {
      console.error('[copilot] loadHome failed', err);
      return (
        <div className="cp-frame">
          <div className="cp-setup">
            <h2>Copilot can&apos;t reach its database</h2>
            <p>
              Check <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SERVICE_KEY</code>, and make sure the
              migration <code>20260903_copilot_foundation.sql</code> has been applied.
            </p>
          </div>
        </div>
      );
    }
  }
  if (!home) return <Onboarding />;
  return layout === 'four' ? <CopilotApp2 initial={home} /> : <CopilotApp initial={home} />;
}
