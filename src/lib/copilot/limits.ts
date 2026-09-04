// src/lib/copilot/limits.ts
// Fixed-window rate limiter backed by copilot_rate_limits. Good enough for a
// single-region deploy; swap for Redis if this ever runs hot.

import { copilotDb } from './db';

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; remaining: number }> {
  const db = copilotDb();
  const now = new Date();
  const { data } = await db.from('copilot_rate_limits').select('window_start, count').eq('key', key).maybeSingle();
  const expired = !data || now.getTime() - new Date(data.window_start).getTime() > windowSec * 1000;
  if (expired) {
    await db.from('copilot_rate_limits').upsert({ key, window_start: now.toISOString(), count: 1 });
    return { ok: true, remaining: limit - 1 };
  }
  if (data.count >= limit) return { ok: false, remaining: 0 };
  await db.from('copilot_rate_limits').update({ count: data.count + 1 }).eq('key', key);
  return { ok: true, remaining: limit - data.count - 1 };
}

/** Best-effort client IP behind a proxy (Coolify/Traefik set x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
