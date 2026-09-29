import { loadHome, setFinance } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);

/** Two numbers: monthly burn and cash. Runway = cash / burn. Typed here, or read off a statement (money/). */
export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const monthly_burn = num(b.monthly_burn); const cash = num(b.cash);
  if (monthly_burn != null && monthly_burn < 0) return fail('Burn must be positive');
  if (cash != null && cash < 0) return fail('Cash must be positive');
  try {
    await setFinance(auth.pid, { monthly_burn, cash, currency: typeof b.currency === 'string' ? b.currency.slice(0, 8) : undefined });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save runway', 500);
  }
  return json({ ok: true, home: await loadHome(auth.pid) });
}
