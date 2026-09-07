// src/lib/copilot/shell.ts
// Two shells render the same app: /copilot is bold, /lifeos is calm. They share
// one session, one database and one component tree — the only thing that
// differs is the theme the layout sets on .cp-root. Anything that builds a link
// or a redirect has to keep the viewer inside the shell they opened, or a tap
// on "Plans" silently changes the theme. The legal set lives here and nowhere
// else so a client can never redirect through this to somewhere it likes.
export const SHELLS = ['/copilot', '/lifeos'] as const;
export type Shell = (typeof SHELLS)[number];
export const DEFAULT_SHELL: Shell = '/copilot';

/** A client-supplied shell, narrowed to the two that exist. */
export function toShell(v: unknown): Shell {
  return typeof v === 'string' && (SHELLS as readonly string[]).includes(v) ? (v as Shell) : DEFAULT_SHELL;
}

/** Which shell a pathname belongs to. */
export function shellOf(pathname: string | null | undefined): Shell {
  return pathname?.startsWith('/lifeos') ? '/lifeos' : DEFAULT_SHELL;
}
