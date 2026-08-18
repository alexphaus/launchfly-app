import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Agent-facing endpoint for the personal tracker.
 *
 * Designed so an agent can be handed one URL and work out the rest on its own:
 * GET without a key returns usage instructions, GET with a key returns the
 * current state alongside them. Everything lives in the same single-row JSON
 * store the tracker page already uses - no other tables are touched.
 */

const TRACKER_ID = 'default';
const MRR_GOAL = 3300;
const MAX_ACTIONS = 8;
const MAX_TEXT = 200;

// Built per-request rather than at module scope: a missing env var here would
// otherwise throw while Next collects page data and fail the whole build.
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

type Action = { id: string; text: string; value: string | null; done: boolean };

function usage() {
  return {
    what: 'Personal revenue + todo tracker. Send JSON with any of the fields below.',
    auth: "Add ?key=YOUR_KEY to the URL, or send an 'x-tracker-key' header.",
    post: {
      revenue: `Number 0-${MRR_GOAL}. Revenue closed today, in euros.`,
      actions: `Replaces today's list (max ${MAX_ACTIONS}). Either ["Do this", "Then this"] or [{"text":"Follow up 5 trials","value":"~300/day"}].`,
      done: 'Mark one action complete: its id, its 0-based index, or its exact text.',
      undone: 'Same accepted forms as "done", but marks it incomplete again.',
    },
    examples: [
      { revenue: 450 },
      { actions: ['Follow up 5 trials', 'Ship the pricing page', 'Call 3 churned accounts'] },
      { actions: [{ text: 'Follow up 5 trials', value: '~300/day' }] },
      { done: 0 },
    ],
    notes: [
      'Three actions is the useful maximum; more becomes noise.',
      'Posting "actions" replaces the whole list, so send the full set each time.',
      'Actions persist until replaced - they are not cleared overnight.',
    ],
  };
}

function authorize(request: NextRequest) {
  const expected = process.env.TRACKER_AGENT_KEY;
  if (!expected) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            'TRACKER_AGENT_KEY is not set on the server. Add it to the environment to enable agent access.',
        },
        { status: 503 }
      ),
    };
  }

  const provided =
    request.headers.get('x-tracker-key') ||
    new URL(request.url).searchParams.get('key') ||
    '';

  if (!provided) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Missing key', usage: usage() }, { status: 401 }),
    };
  }
  if (provided !== expected) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Invalid key' }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

function clampRevenue(raw: unknown) {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), MRR_GOAL);
}

function normalizeActions(raw: unknown): Action[] {
  if (!Array.isArray(raw)) return [];
  const out: Action[] = [];
  for (const entry of raw.slice(0, MAX_ACTIONS)) {
    const text =
      typeof entry === 'string'
        ? entry
        : entry && typeof entry === 'object' && typeof (entry as { text?: unknown }).text === 'string'
          ? (entry as { text: string }).text
          : null;
    if (!text || !text.trim()) continue;

    const rawValue =
      entry && typeof entry === 'object' ? (entry as { value?: unknown }).value : undefined;
    const rawDone =
      entry && typeof entry === 'object' ? (entry as { done?: unknown }).done : undefined;

    out.push({
      id: `a${out.length + 1}`,
      text: text.trim().slice(0, MAX_TEXT),
      value:
        typeof rawValue === 'string' && rawValue.trim()
          ? rawValue.trim().slice(0, 40)
          : typeof rawValue === 'number'
            ? String(rawValue)
            : null,
      done: rawDone === true,
    });
  }
  return out;
}

// Agents are inconsistent about identifiers, so accept id, index, or exact text.
function findAction(actions: Action[], ref: unknown) {
  if (typeof ref === 'number' && Number.isInteger(ref)) {
    return ref >= 0 && ref < actions.length ? ref : -1;
  }
  if (typeof ref === 'string') {
    const byId = actions.findIndex((a) => a.id === ref);
    if (byId !== -1) return byId;
    const asIndex = Number(ref);
    if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < actions.length) return asIndex;
    return actions.findIndex((a) => a.text.toLowerCase() === ref.trim().toLowerCase());
  }
  return -1;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function readData() {
  const { data: row, error } = await getSupabase()
    .from('personal_savings_tracker')
    .select('data')
    .eq('id', TRACKER_ID)
    .maybeSingle();

  if (error) throw error;
  return (row?.data ?? {}) as Record<string, unknown>;
}

function summarize(data: Record<string, unknown>) {
  const actions = normalizeActions(data.actions);
  const filled = Array.isArray(data.filled) ? data.filled.filter(Boolean).length : 0;
  return {
    revenue_today: clampRevenue(data.mrr),
    goal_per_day: MRR_GOAL,
    actions,
    actions_set_on: typeof data.actionsSetAt === 'string' ? data.actionsSetAt : null,
    banked_eur: filled * 500,
    banked_goal_eur: 25000,
  };
}

export async function GET(request: NextRequest) {
  const expected = process.env.TRACKER_AGENT_KEY;
  const provided =
    request.headers.get('x-tracker-key') || new URL(request.url).searchParams.get('key') || '';

  // A bare link, with no key, still explains itself - but reveals no data.
  if (!expected || provided !== expected) {
    return NextResponse.json({ usage: usage() }, { status: expected ? 401 : 503 });
  }

  try {
    return NextResponse.json({ state: summarize(await readData()), usage: usage() });
  } catch (error) {
    console.error('Tracker agent read error:', error);
    return NextResponse.json({ error: 'Failed to read tracker' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', usage: usage() }, { status: 400 });
  }

  const hasRevenue = 'revenue' in body;
  const hasActions = 'actions' in body;
  const hasDone = 'done' in body;
  const hasUndone = 'undone' in body;

  if (!hasRevenue && !hasActions && !hasDone && !hasUndone) {
    return NextResponse.json(
      { error: 'Nothing to update. Send revenue, actions, done, or undone.', usage: usage() },
      { status: 400 }
    );
  }

  try {
    const data = await readData();
    const applied: string[] = [];

    if (hasRevenue) {
      const value = clampRevenue(body.revenue);
      data.mrr = value;
      data.mrrUnit = 'day';
      data.mrrPeak = Math.max(clampRevenue(data.mrrPeak), value);

      const history = Array.isArray(data.mrrHistory) ? [...data.mrrHistory] : [];
      const last = history[history.length - 1] as { d?: string; v?: number } | undefined;
      if (last && last.d === todayStr()) {
        history[history.length - 1] = { d: todayStr(), v: value };
      } else {
        history.push({ d: todayStr(), v: value });
      }
      data.mrrHistory = history.slice(-180);
      applied.push(`revenue=${value}`);
    }

    if (hasActions) {
      const actions = normalizeActions(body.actions);
      data.actions = actions;
      data.actionsSetAt = todayStr();
      applied.push(`actions=${actions.length}`);
    }

    if (hasDone || hasUndone) {
      const actions = normalizeActions(data.actions);
      const ref = hasDone ? body.done : body.undone;
      const index = findAction(actions, ref);
      if (index === -1) {
        return NextResponse.json(
          { error: `No action matching ${JSON.stringify(ref)}`, state: summarize(data) },
          { status: 404 }
        );
      }
      actions[index].done = hasDone;
      data.actions = actions;
      applied.push(`${hasDone ? 'done' : 'undone'}="${actions[index].text}"`);
    }

    const { error } = await getSupabase()
      .from('personal_savings_tracker')
      .upsert(
        { id: TRACKER_ID, data, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );

    if (error) throw error;

    return NextResponse.json({ ok: true, applied, state: summarize(data) });
  } catch (error) {
    console.error('Tracker agent write error:', error);
    return NextResponse.json({ error: 'Failed to update tracker' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
