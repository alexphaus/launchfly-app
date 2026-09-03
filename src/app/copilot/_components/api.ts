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
export const del = <T = Record<string, unknown>>(path: string) => api<T>(path, { method: 'DELETE' });
