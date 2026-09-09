// scripts/copilot-cron.mjs
// The daily loop, run from inside the container.
//
// Coolify scheduled tasks execute a command in the running container, which
// means this reaches the app on localhost and never touches Traefik. That
// matters: the proxy is what turns a long brief into a 504, and the cron has
// minutes of legitimate work to do. Going direct removes that ceiling entirely.
//
// Set it up as a Coolify Scheduled Task:
//     Command:  node scripts/copilot-cron.mjs
//     Schedule: 0 21 * * *
//
// No curl dependency — a Nixpacks node image may not have it, and node is
// definitionally present. Exits non-zero on failure so Coolify shows it red
// rather than silently succeeding.

const secret = process.env.CRON_SECRET || process.env.COPILOT_CRON_SECRET;
const port = process.env.PORT || 3000;
const url = process.env.COPILOT_CRON_URL || `http://127.0.0.1:${port}/api/copilot/cron/daily`;

if (!secret) {
  console.error('copilot-cron: neither CRON_SECRET nor COPILOT_CRON_SECRET is set. The endpoint fails closed without one, so this would 503.');
  process.exit(1);
}

const started = Date.now();
try {
  const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
  const took = ((Date.now() - started) / 1000).toFixed(1);
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`copilot-cron: ${res.status} after ${took}s`, JSON.stringify(body));
    process.exit(1);
  }

  // Summarise rather than dump: this lands in a Coolify log somebody reads at a
  // glance, and the useful question is "did anything actually happen".
  const runs = Array.isArray(body.results) ? body.results : [];
  const ok = runs.filter((r) => r.ok).length;
  const moves = runs.reduce((n, r) => n + (r.moves ?? 0), 0);
  console.log(`copilot-cron: ${res.status} in ${took}s — ${ok}/${runs.length} profiles ok${moves ? `, ${moves} new moves` : ''}${body.skipped ? `, ${body.skipped} skipped` : ''}`);
  for (const r of runs.filter((r) => !r.ok)) console.error(`  failed ${r.id}: ${r.error ?? 'unknown'}`);
  if (runs.length && ok === 0) process.exit(1);
} catch (e) {
  console.error(`copilot-cron: could not reach ${url} after ${((Date.now() - started) / 1000).toFixed(1)}s —`, e instanceof Error ? e.message : e);
  process.exit(1);
}
