// src/app/lifeos/page.tsx
// Same entry as /copilot. The theme comes from the layout, not from here.
import CopilotEntry from '../copilot/_components/CopilotEntry';

export const dynamic = 'force-dynamic';

export default function LifeosPage() {
  return <CopilotEntry />;
}
