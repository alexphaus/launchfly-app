import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TRACKER_ID = 'default';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const SAVINGS_TOTAL = 50;

const DEFAULT_DATA = {
  filled: new Array(SAVINGS_TOTAL).fill(false),
  fillDates: {},
  milestonesShown: {},
  lastSaveDate: null,
  streak: 0,
};

function dbErrorResponse(action: 'load' | 'initialize' | 'save', error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message;

  if (code === '42P01') {
    return NextResponse.json(
      {
        error:
          'Savings tracker table is missing. Run db/migrations/20260619_personal_savings_tracker.sql in Supabase.',
      },
      { status: 500 }
    );
  }

  if (code === '42501') {
    return NextResponse.json(
      {
        error:
          'Savings tracker database permissions are blocked. Ensure the server uses SUPABASE_SERVICE_KEY.',
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: `Failed to ${action} tracker data`, details: message ?? null },
    { status: 500 }
  );
}

function normalizeData(raw: unknown) {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const filled = Array.isArray(parsed.filled) ? parsed.filled : DEFAULT_DATA.filled;

  return {
    filled: filled.length === SAVINGS_TOTAL ? filled.map(Boolean) : [...DEFAULT_DATA.filled],
    fillDates:
      parsed.fillDates && typeof parsed.fillDates === 'object' && !Array.isArray(parsed.fillDates)
        ? (parsed.fillDates as Record<string, string>)
        : {},
    milestonesShown:
      parsed.milestonesShown &&
      typeof parsed.milestonesShown === 'object' &&
      !Array.isArray(parsed.milestonesShown)
        ? (parsed.milestonesShown as Record<string, boolean>)
        : {},
    lastSaveDate: typeof parsed.lastSaveDate === 'string' ? parsed.lastSaveDate : null,
    streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
  };
}

export async function GET() {
  const { data: row, error } = await supabase
    .from('personal_savings_tracker')
    .select('data, updated_at')
    .eq('id', TRACKER_ID)
    .maybeSingle();

  if (error) {
    console.error('Savings tracker fetch error:', error);
    return dbErrorResponse('load', error);
  }

  if (!row) {
    const { data: inserted, error: insertError } = await supabase
      .from('personal_savings_tracker')
      .insert({ id: TRACKER_ID, data: DEFAULT_DATA })
      .select('data, updated_at')
      .single();

    if (insertError) {
      console.error('Savings tracker init error:', insertError);
      return dbErrorResponse('initialize', insertError);
    }

    return NextResponse.json({
      data: normalizeData(inserted.data),
      updated_at: inserted.updated_at,
    });
  }

  return NextResponse.json({
    data: normalizeData(row.data),
    updated_at: row.updated_at,
  });
}

export async function PUT(request: NextRequest) {
  let body: { data?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.data) {
    return NextResponse.json({ error: 'Missing data field' }, { status: 400 });
  }

  const normalized = normalizeData(body.data);

  const { data: row, error } = await supabase
    .from('personal_savings_tracker')
    .upsert(
      {
        id: TRACKER_ID,
        data: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('data, updated_at')
    .single();

  if (error) {
    console.error('Savings tracker save error:', error);
    return dbErrorResponse('save', error);
  }

  return NextResponse.json({
    data: normalizeData(row.data),
    updated_at: row.updated_at,
  });
}

export const runtime = 'nodejs';
