// src/app/copilot2/share/route.ts
// Something shared to Copilot from another app, when the service worker has not
// taken it (public/sw.js does, once it is active).
//
// A file is imported here, then the Money tab opens and says how it went (`why`,
// both ways). Words with no file — a reply from Claude or Grok — are kept by a
// page this answers with and open Proof as the start of a bet (seed.ts), because
// a worker is the only thing that could keep them for the page, and there is none
// yet.
//
// The phone opens the share as a top-level navigation, so the session cookie
// (SameSite=lax) comes with it and the import route runs as the person. Not
// signed in, the screen says so rather than the share disappearing.
import { POST as importStatement } from '@/app/api/copilot/money/import/route';
import { importLine, type MoneyImport } from '@/lib/copilot/money/ledger';
import { seedOf, seedPage } from '@/lib/copilot/seed';
import { currentProfileId } from '@/lib/copilot/session';

export const runtime = 'nodejs';
export const maxDuration = 300;

// A relative Location, not one built on req.url: behind the proxy that is the
// container's own address, and locally Next reports localhost for 127.0.0.1 —
// either way the redirect lands on a host the session cookie is not for.
const back = (_req: Request, q: Record<string, string>, tab = 'money') =>
  new Response(null, { status: 303, headers: { location: `/copilot2?${new URLSearchParams({ tab, ...q })}` } });

export async function POST(req: Request) {
  const signedIn = !!(await currentProfileId());
  let file: File | null = null;
  const said: Record<string, string> = {};
  try {
    const form = await req.formData();
    file = form.getAll('file').find((f): f is File => f instanceof File && f.size > 0) ?? null;
    for (const k of ['title', 'text', 'url']) { const v = form.get(k); if (typeof v === 'string') said[k] = v; }
  } catch {
    return back(req, { shared: 'error', why: 'The shared file could not be read. Share it again.' });
  }
  if (!file && seedOf(said)) {
    if (!signedIn) return back(req, { shared: 'text', why: 'Sign in, then share it again.' }, 'proof');
    return new Response(seedPage(said), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (!signedIn) return back(req, { shared: 'error', why: 'Sign in, then share the file again.' });
  if (!file) return back(req, { shared: 'error', why: 'That share had no file in it. Export the CSV and share the file itself.' });

  // The upload route itself, so a shared file is read exactly as an uploaded one.
  const form = new FormData();
  form.set('file', file);
  const res = await importStatement(new Request(req.url, { method: 'POST', body: form }));
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; import?: MoneyImport };
  if (!res.ok || body.ok === false || !body.import) return back(req, { shared: 'error', why: body.error || `Could not import ${file.name || 'that file'} (${res.status}).` });
  // What an upload says — "2 new rows", "nothing new" — rather than a bare "imported".
  return back(req, { shared: 'done', why: importLine(body.import) ?? `Read ${file.name || 'the shared file'}.` });
}
