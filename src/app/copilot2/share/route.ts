// src/app/copilot2/share/route.ts
// A file shared to Copilot from another app, when the service worker has not
// taken it (public/sw.js does, once it is active): imported here, then the
// Money tab opens and says how it went (`why`, both ways).
//
// The phone opens the share as a top-level navigation, so the session cookie
// (SameSite=lax) comes with it and the import route runs as the person. Not
// signed in, the Money tab says so rather than the file disappearing.
import { POST as importStatement } from '@/app/api/copilot/money/import/route';
import { importLine, type MoneyImport } from '@/lib/copilot/money/ledger';
import { currentProfileId } from '@/lib/copilot/session';

export const runtime = 'nodejs';
export const maxDuration = 300;

// A relative Location, not one built on req.url: behind the proxy that is the
// container's own address, and locally Next reports localhost for 127.0.0.1 —
// either way the redirect lands on a host the session cookie is not for.
const back = (_req: Request, q: Record<string, string>) =>
  new Response(null, { status: 303, headers: { location: `/copilot2?${new URLSearchParams({ tab: 'money', ...q })}` } });

export async function POST(req: Request) {
  if (!(await currentProfileId())) return back(req, { shared: 'error', why: 'Sign in, then share the file again.' });
  let file: File | null = null;
  try {
    const form = await req.formData();
    file = form.getAll('file').find((f): f is File => f instanceof File && f.size > 0) ?? null;
  } catch {
    return back(req, { shared: 'error', why: 'The shared file could not be read. Share it again.' });
  }
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
