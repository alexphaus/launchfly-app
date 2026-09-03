// src/app/copilot/page.tsx
// Server entry point. New device -> onboarding. Known device -> the app,
// rendered with data already loaded so there is no loading flash.
import { currentProfileId } from '@/lib/copilot/session';
import { loadHome } from '@/lib/copilot/store';
import type { HomeData } from '@/lib/copilot/types';
import CopilotApp from './_components/CopilotApp';
import Onboarding from './_components/Onboarding';

export const dynamic = 'force-dynamic';

export default async function CopilotPage() {
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
  return <CopilotApp initial={home} />;
}
