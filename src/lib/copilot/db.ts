// src/lib/copilot/db.ts
// Service-role Supabase client for the copilot vertical. Server only.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function copilotDb(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Copilot: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function todayIso(timezone = 'UTC'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Shift a YYYY-MM-DD day. Dates are compared as days, never as instants, so
 *  this stays in UTC and never drifts by an hour across a DST boundary. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Turn a Postgres/PostgREST failure into something the person reading the screen
 * can act on.
 *
 * The generic "check the database migration" this replaces was a guess, and it
 * sent us looking in the wrong place: the code is the whole diagnosis. 42703 and
 * 42P01 really are an unapplied migration; 23505 means the row already exists
 * and the answer is to sign in, not to run SQL.
 */
export function describeDbError(e: unknown, fallback = 'Something went wrong.'): string {
  const err = (e ?? null) as { code?: string; message?: string } | null;
  const code = typeof err?.code === 'string' ? err.code : undefined;
  const msg = typeof err?.message === 'string' ? err.message.trim() : '';
  switch (code) {
    case '42703':
    case '42P01':
      return `The database is missing something this needs — ${msg || 'an unknown column or table'}. Apply the outstanding files in supabase/migrations and try again.`;
    case '23505':
      return 'That already exists. Sign in instead of creating a second copilot.';
    case '23502':
      return `A required field was empty${msg ? ` — ${msg}` : ''}.`;
    case '23503':
      return `A record this links to is missing${msg ? ` — ${msg}` : ''}.`;
    case '42501':
      return 'The database refused the write. Check that the service key is set, not the anon key.';
    default:
      return code ? `${fallback} (database error ${code})` : fallback;
  }
}
