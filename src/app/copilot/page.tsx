// src/app/copilot/page.tsx
// The bold shell. Everything it renders lives in CopilotEntry, which /lifeos
// renders too.
import CopilotEntry from './_components/CopilotEntry';

export const dynamic = 'force-dynamic';

export default function CopilotPage() {
  return <CopilotEntry />;
}
