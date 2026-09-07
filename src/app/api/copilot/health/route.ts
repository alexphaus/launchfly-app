// src/app/api/copilot/health/route.ts
// What is actually wired up in THIS deployment.
//
// Every capability here fails closed by design — a missing secret means the
// feature refuses to run rather than running wrong. That is correct, and it is
// also silent: the cron returns 503 to a caller nobody reads, the Stripe webhook
// rejects events Stripe retries into a void, and the only symptom is a feature
// that never seems to happen. Three separate outages in this project were one
// unset variable, and each took a conversation to find.
//
// So: one page that says which ones are missing. Names and booleans only, never
// a value. Signed-in users and the cron may read it; nobody else, because the
// list of variables a deployment lacks is a map of what to try next.
import { copilotDb } from '@/lib/copilot/db';
import { NO_STORE, fail } from '@/lib/copilot/http';
import { priceIdFor } from '@/lib/copilot/plans';
import { currentProfileId } from '@/lib/copilot/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const has = (...names: string[]) => names.some((n) => !!process.env[n]);

/** One late column per migration. Probing the running app answers the question
 *  the local schema cannot: what does *production* actually have? */
const PROBES: Array<{ table: string; column: string; migration: string }> = [
  { table: 'copilot_profiles', column: 'target_segments', migration: '20260904_copilot_close_the_loop.sql' },
  { table: 'copilot_profiles', column: 'offer', migration: '20260905_copilot_multi_user.sql' },
  { table: 'copilot_profiles', column: 'plan', migration: '20260906_copilot_billing.sql' },
  { table: 'copilot_executions', column: 'cancel_reason', migration: '20260908_copilot_signals.sql' },
  { table: 'copilot_insights', column: 'kind', migration: '20260908_copilot_signals.sql' },
  { table: 'copilot_decisions', column: 'headline', migration: '20260909_copilot_decisions.sql' },
];

export async function GET(req: Request) {
  const cron = process.env.CRON_SECRET;
  const authorised = (await currentProfileId()) !== null
    || (!!cron && req.headers.get('authorization') === `Bearer ${cron}`);
  if (!authorised) return fail('Not signed in', 401);

  const db = copilotDb();
  // Reach the database before drawing conclusions about it. Without this, an
  // unreachable database fails every probe and the page confidently reports
  // that no migration has ever been applied — a conclusion from an observation
  // that never happened.
  const reachable = !(await db.from('copilot_profiles').select('id').limit(1)).error;
  const schema: Array<{ migration: string; missing: string }> = [];
  if (reachable) {
    for (const p of PROBES) {
      const { error } = await db.from(p.table).select(p.column).limit(1);
      if (error) schema.push({ migration: p.migration, missing: `${p.table}.${p.column} — ${error.message}` });
    }
  }

  // Each entry is "the feature is on" plus, when it is not, the variable to set.
  const capabilities = {
    sessions: { ok: has('COPILOT_SESSION_SECRET'), needs: ['COPILOT_SESSION_SECRET'] },
    signInEmail: { ok: has('RESEND_API_KEY') && has('COPILOT_EMAIL_FROM', 'FROM_EMAIL'), needs: ['RESEND_API_KEY', 'COPILOT_EMAIL_FROM (or FROM_EMAIL)'] },
    // Reads CRON_SECRET specifically. COPILOT_CRON_SECRET is a different name and
    // will not be seen — this deployment has had exactly that mismatch.
    scheduledLoop: { ok: has('CRON_SECRET'), needs: ['CRON_SECRET'], note: has('COPILOT_CRON_SECRET') && !has('CRON_SECRET') ? 'COPILOT_CRON_SECRET is set but the route reads CRON_SECRET' : undefined },
    checkout: { ok: has('STRIPE_SECRET_KEY') && !!priceIdFor('pro', 'monthly'), needs: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_COPILOT_PRO_MONTHLY', 'STRIPE_PRICE_COPILOT_PRO_YEARLY', 'STRIPE_PRICE_COPILOT_OPERATOR_MONTHLY', 'STRIPE_PRICE_COPILOT_OPERATOR_YEARLY'] },
    // Without this a paid checkout completes and the plan never upgrades: Stripe
    // retries into a 503 and the profile stays on free limits.
    billingWebhook: { ok: has('COPILOT_STRIPE_WEBHOOK_SECRET'), needs: ['COPILOT_STRIPE_WEBHOOK_SECRET'], note: has('STRIPE_WEBHOOK_SECRET') && !has('COPILOT_STRIPE_WEBHOOK_SECRET') ? 'STRIPE_WEBHOOK_SECRET is the wider Launchfly one; the copilot has its own endpoint and its own secret' : undefined },
    push: { ok: has('COPILOT_VAPID_PUBLIC_KEY') && has('COPILOT_VAPID_PRIVATE_KEY'), needs: ['COPILOT_VAPID_PUBLIC_KEY', 'COPILOT_VAPID_PRIVATE_KEY', 'COPILOT_VAPID_SUBJECT'] },
    agent: { ok: has('COPILOT_AI_API_KEY', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY'), needs: ['COPILOT_AI_API_KEY'], note: 'Falls back to the deterministic starter brief when absent — degraded, not broken.' },
    mapsSupply: { ok: has('APIFY_API_TOKEN'), needs: ['APIFY_API_TOKEN'], note: 'Without it only the free adapters run.' },
  };

  const missing = Object.entries(capabilities).filter(([, v]) => !v.ok).map(([k]) => k);
  return Response.json({
    ok: reachable && missing.length === 0 && schema.length === 0,
    database: reachable ? 'reachable' : 'unreachable — check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY',
    missingCapabilities: missing,
    unappliedMigrations: reachable ? [...new Set(schema.map((s) => s.migration))] : null,
    schema: reachable ? schema : null,
    capabilities,
  }, { headers: NO_STORE });
}
