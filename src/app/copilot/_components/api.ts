// Client-side fetch helpers for the copilot API.
export async function api<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/copilot${path}`, {
    cache: 'no-store',
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const post = <T = Record<string, unknown>>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
export const get = <T = Record<string, unknown>>(path: string) => api<T>(`${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}`);
/** DELETE, optionally with a body — account deletion sends a typed confirmation. */
export const del = <T = Record<string, unknown>>(path: string, init: RequestInit = {}) => api<T>(path, { ...init, method: 'DELETE' });

/**
 * A file, as multipart. Not through `api`: that sets a JSON content type, and a
 * browser has to write its own multipart boundary. Resolves the body whatever
 * the status, since an upload that failed to read still returns the screen.
 */
export async function upload<T = Record<string, unknown>>(path: string, file: File): Promise<{ status: number; body: T & { error?: string } }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/copilot${path}`, { method: 'POST', body: form, cache: 'no-store' });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { status: res.status, body };
}
