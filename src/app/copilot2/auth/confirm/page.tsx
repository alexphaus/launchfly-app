// src/app/copilot2/auth/confirm/page.tsx
// The same confirmation, for a link requested from /copilot2. The button on it
// is still the only thing that spends the token — see ConfirmSignIn.
import ConfirmSignIn from '../../../copilot/_components/ConfirmSignIn';

export default function Copilot2ConfirmPage() {
  return <ConfirmSignIn />;
}
