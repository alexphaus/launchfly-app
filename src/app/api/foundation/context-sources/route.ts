// GET  /api/foundation/context-sources  → the "Context sources" list
// POST /api/foundation/context-sources  → register or update a source
//
// Deliberately NOT an OAuth endpoint. This route records the *state* of a
// connection and what it buys the operator; the token dance for each provider
// belongs behind its own callback route, which then calls this one. Secrets
// never land in `config` — only a credential_ref pointing at the secret store.

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getServiceClient, logEvent, requireUser } from '@/lib/foundation/db';
import { loadOperatorContext, SOURCE_COPY, SOURCE_PRIORITY } from '@/lib/foundation/context';
import type { ContextSourceKind, ContextSourceStatus } from '@/lib/foundation/types';

export const dynamic = 'force-dynamic';

const KINDS = Object.keys(SOURCE_COPY) as ContextSourceKind[];
const STATUSES: ContextSourceStatus[] = ['disconnected', 'connecting', 'connected', 'error'];

/** Keys that must never be persisted in the non-secret config blob. */
const SECRET_KEYS = /token|secret|password|api[_-]?key|refresh|credential|authorization/i;

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const ctx = await loadOperatorContext(userId);
    const byKind = new Map(ctx.sources.map((s) => [s.kind, s]));

    // Always return the full catalogue, so the UI shows what is available to
    // connect rather than only what already exists.
    const sources = KINDS.map((kind) => {
      const existing = byKind.get(kind);
      return {
        kind,
        label: SOURCE_COPY[kind].label,
        effect: SOURCE_COPY[kind].effect,
        status: existing?.status ?? 'disconnected',
        provider: existing?.provider ?? null,
        last_synced_at: existing?.last_synced_at ?? null,
        last_error: existing?.last_error ?? null,
        recommended_order: SOURCE_PRIORITY.indexOf(kind),
      };
    }).sort((a, b) => (a.recommended_order < 0 ? 99 : a.recommended_order) - (b.recommended_order < 0 ? 99 : b.recommended_order));

    return NextResponse.json({
      sources,
      confidence: ctx.confidence,
      // The prototype's promise, kept literal so the UI can render it verbatim.
      note: ctx.sources.some((s) => s.status === 'connected')
        ? 'Each source you add sharpens ranking, it doesn\'t unlock new tabs.'
        : 'Nothing is connected yet — matches run on what you tell the copilot directly. Each source you add sharpens ranking, it doesn\'t unlock new tabs.',
    });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = await request.json();
    const kind = body.kind as ContextSourceKind;

    if (!KINDS.includes(kind)) {
      return NextResponse.json({ error: `kind must be one of: ${KINDS.join(', ')}` }, { status: 400 });
    }
    if (body.status && !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${STATUSES.join(', ')}` }, { status: 400 });
    }

    const config = (body.config ?? {}) as Record<string, unknown>;
    const leaked = Object.keys(config).filter((k) => SECRET_KEYS.test(k));
    if (leaked.length) {
      return NextResponse.json(
        { error: `config must not contain secrets (${leaked.join(', ')}); pass credential_ref instead` },
        { status: 400 },
      );
    }

    const { data, error } = await getServiceClient()
      .from('foundation_context_sources')
      .upsert(
        {
          user_id: userId,
          kind,
          provider: body.provider ?? null,
          status: body.status ?? 'connecting',
          config,
          credential_ref: body.credential_ref ?? null,
          scopes: body.scopes ?? [],
          last_error: body.status === 'error' ? String(body.error ?? 'Unknown error') : null,
        },
        { onConflict: 'user_id,kind,provider' },
      )
      .select('*')
      .single();
    if (error) throw error;

    await logEvent(userId, 'context_source_updated', { kind, status: data.status }, { kind: 'context_source', id: data.id });
    return NextResponse.json({ source: data });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
