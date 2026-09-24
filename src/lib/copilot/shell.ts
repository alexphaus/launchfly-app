// src/lib/copilot/shell.ts
// Three shells render the same app. /copilot is bold and /lifeos is calm — one
// component tree, two themes. /copilot2 is the four-tab layout (Today, Matches,
// Work, You) in the calm theme: a second component tree over the same data,
// the same routes and the same actions, so it can be lived with beside the
// original instead of replacing it on a guess. They share one session and one
// database. Anything that builds a link or a redirect has to keep the viewer
// inside the shell they opened, or a tap on "Plans" silently changes the app.
// The legal set lives here and nowhere else so a client can never redirect
// through this to somewhere it likes.
export const SHELLS = ['/copilot', '/lifeos', '/copilot2'] as const;
export type Shell = (typeof SHELLS)[number];
export const DEFAULT_SHELL: Shell = '/copilot';

/** A client-supplied shell, narrowed to the ones that exist. */
export function toShell(v: unknown): Shell {
  return typeof v === 'string' && (SHELLS as readonly string[]).includes(v) ? (v as Shell) : DEFAULT_SHELL;
}

/** Which shell a pathname belongs to. */
export function shellOf(pathname: string | null | undefined): Shell {
  if (pathname?.startsWith('/lifeos')) return '/lifeos';
  // Exact, or a path under it. `startsWith('/copilot2')` alone would also claim
  // '/copilot20', and '/copilot' is a prefix of this one, so the order and the
  // boundary are both load-bearing.
  if (pathname === '/copilot2' || pathname?.startsWith('/copilot2/')) return '/copilot2';
  return DEFAULT_SHELL;
}
