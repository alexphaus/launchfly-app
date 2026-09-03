// src/lib/foundation/db.ts
// ═══════════════════════════════════════════════════════════════════════════
// Supabase access + request auth for Foundation
//
// Rule for this module: server code uses the service client (RLS bypass) but
// EVERY query still filters on user_id from `requireUser`. RLS is the backstop,
// the explicit filter is the contract. Never take a user_id from the request
// body — an operator's whole working life is in these tables.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

let serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Foundation: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    }
    serviceClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return serviceClient;
}

export class UnauthorizedError extends Error {
  constructor(message = 'Not signed in') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Resolve the signed-in operator from the request cookies.
 *
 * Local development can pass `x-foundation-user-id` instead, but only when
 * FOUNDATION_ALLOW_DEV_USER=true AND the build is not production — so the
 * header can never become an auth bypass on a deployed environment.
 */
export async function requireUser(request?: Request): Promise<string> {
  const devHeaderAllowed =
    process.env.NODE_ENV !== 'production' && process.env.FOUNDATION_ALLOW_DEV_USER === 'true';
  if (devHeaderAllowed && request) {
    const devUser = request.headers.get('x-foundation-user-id');
    if (devUser) return devUser;
  }

  const cookieStore = await cookies();
  // @ts-expect-error - auth-helpers types lag the async cookies() API in Next 16
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new UnauthorizedError();
  return data.user.id;
}

/** Consistent error envelope for the Foundation routes. */
export function errorResponse(err: unknown): { body: { error: string }; status: number } {
  if (err instanceof UnauthorizedError) {
    return { body: { error: 'Not signed in' }, status: 401 };
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  console.error('[foundation]', message);
  return { body: { error: message }, status: 500 };
}

/** Append to the feedback log. Fire-and-forget: never fail a request over it. */
export async function logEvent(
  userId: string,
  kind: string,
  payload: Record<string, unknown> = {},
  subject?: { kind: string; id: string },
): Promise<void> {
  try {
    await getServiceClient().from('foundation_events').insert({
      user_id: userId,
      kind,
      subject_kind: subject?.kind ?? null,
      subject_id: subject?.id ?? null,
      payload,
    });
  } catch (err) {
    console.warn('[foundation] event log failed:', (err as Error).message);
  }
}
