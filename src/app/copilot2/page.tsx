// src/app/copilot2/page.tsx
// Same entry, same load, same onboarding as /copilot — the four-tab layout is
// chosen here and nowhere else.
import CopilotEntry from '../copilot/_components/CopilotEntry';

export const dynamic = 'force-dynamic';

export default function Copilot2Page() {
  return <CopilotEntry layout="four" />;
}
