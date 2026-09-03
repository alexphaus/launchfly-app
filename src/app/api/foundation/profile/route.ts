// GET /api/foundation/profile  → operator profile + declared skills
// PUT /api/foundation/profile  → update positioning, skills, rate floor, timezone
//
// Changing positioning or skills invalidates the operator embedding, so this
// route marks it stale; the next match recompute refreshes it. Doing the
// embedding call here would make a text edit wait on OpenAI for no reason.

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getServiceClient, logEvent, requireUser } from '@/lib/foundation/db';
import { ensureProfile } from '@/lib/foundation/context';

export const dynamic = 'force-dynamic';

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const profile = await ensureProfile(userId);
    const { data: skills } = await getServiceClient()
      .from('foundation_skills')
      .select('slug, label, proficiency, source, demand_count, matched_count')
      .eq('user_id', userId)
      .order('proficiency', { ascending: false });
    return NextResponse.json({ profile, skills: skills ?? [] });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = await request.json();
    const supabase = getServiceClient();
    await ensureProfile(userId);

    const update: Record<string, unknown> = {};
    let embeddingAffected = false;

    if (typeof body.display_name === 'string') update.display_name = body.display_name.slice(0, 120);
    if (typeof body.headline === 'string') {
      update.headline = body.headline.slice(0, 240);
      embeddingAffected = true;
    }
    if (typeof body.positioning === 'string') {
      update.positioning = body.positioning.slice(0, 4000);
      embeddingAffected = true;
    }
    if (typeof body.timezone === 'string') update.timezone = body.timezone;
    if (typeof body.currency === 'string') update.currency = body.currency.slice(0, 8);
    if (Number.isFinite(body.weekly_hours)) update.weekly_hours = Math.max(0, Number(body.weekly_hours));
    if (Number.isFinite(body.min_deal_value)) update.min_deal_value = Math.max(0, Number(body.min_deal_value));
    if (Number.isFinite(body.brief_hour)) {
      update.brief_hour = Math.min(23, Math.max(0, Math.round(Number(body.brief_hour))));
    }
    if (typeof body.onboarding_complete === 'boolean') update.onboarding_complete = body.onboarding_complete;

    if (Array.isArray(body.skills)) {
      const rows = body.skills
        .filter((s: { label?: string }) => s && typeof s.label === 'string' && s.label.trim())
        .slice(0, 50)
        .map((s: { label: string; proficiency?: number; evidence?: unknown[] }) => ({
          user_id: userId,
          slug: slugify(s.label),
          label: s.label.trim(),
          proficiency: Math.min(100, Math.max(0, Math.round(Number(s.proficiency) || 0))),
          source: 'declared' as const,
          evidence: Array.isArray(s.evidence) ? s.evidence : [],
        }));
      if (rows.length) {
        const { error } = await supabase
          .from('foundation_skills')
          .upsert(rows, { onConflict: 'user_id,slug' });
        if (error) throw error;
        embeddingAffected = true;
      }
    }

    if (embeddingAffected) update.embedding_stale = true;

    if (Object.keys(update).length) {
      const { error } = await supabase.from('foundation_profiles').update(update).eq('user_id', userId);
      if (error) throw error;
    }

    await logEvent(userId, 'profile_updated', { fields: Object.keys(update) });
    const profile = await ensureProfile(userId);
    return NextResponse.json({ profile, embedding_stale: embeddingAffected });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
