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
