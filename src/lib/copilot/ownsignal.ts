// src/lib/copilot/ownsignal.ts
// The operator's own count link, when the app is what they sell.
//
// The owner sells this app to people starting out, found online, and every
// account made here is a sign-up for that business — a row this database already
// holds, which its owner's own Proof could not see. COPILOT_OWN_COUNT_LINK names
// their count link (You → Records → Sign-ups and sales); each new account then
// counts as one sign-up there, recorded directly rather than over HTTP, under
// the new account's id so a repeat is one sign-up. Nothing about the new account
// goes with it — not its name, not its email (signal.ts).

import { readSignalToken, tokenOfLink } from './signalkey';
import { signalKey } from './session';
import { recordSignal, signalGeneration } from './store';

/** Whether COPILOT_OWN_COUNT_LINK names a link this server made and still counts: null when unset, else the problem or ''. */
export async function ownLinkProblem(): Promise<string | null> {
  const token = tokenOfLink(process.env.COPILOT_OWN_COUNT_LINK);
  if (!token) return null;
  const who = readSignalToken(token, signalKey());
  if (!who) return 'COPILOT_OWN_COUNT_LINK is not a count link this server made (or COPILOT_SESSION_SECRET changed since)';
  const gen = await signalGeneration(who.pid);
  return gen === who.gen ? '' : 'COPILOT_OWN_COUNT_LINK was replaced by a newer link in the app: copy the new one';
}

/** One sign-up on the operator's link for the account just made. Throws with why; the caller runs it after answering. */
export async function countOwnSignup(newAccount: string): Promise<void> {
  const token = tokenOfLink(process.env.COPILOT_OWN_COUNT_LINK);
  if (!token) return;
  const who = readSignalToken(token, signalKey());
  if (!who) throw new Error('COPILOT_OWN_COUNT_LINK is not a count link this server made');
  // The operator's own account is not a sign-up for their own business.
  if (who.pid === newAccount) return;
  if ((await signalGeneration(who.pid)) !== who.gen) throw new Error('COPILOT_OWN_COUNT_LINK was replaced by a newer link in the app');
  await recordSignal(who.pid, { kind: 'signup', amount: null, currency: null, ref: `account:${newAccount}`, from: 'app', what: 'a new account' });
}
