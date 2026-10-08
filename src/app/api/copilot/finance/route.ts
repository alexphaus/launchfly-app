import { loadHome, setFinance } from '@/lib/copilot/store';
import { fail, json, profileIdOr401, readJson } from '@/lib/copilot/http';

export const runtime = 'nodejs';
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);

/**
 * Two numbers, monthly burn and cash — runway is cash / burn — typed in any
 * currency and counted in the main one (money/fx.ts); or the main currency
 * itself, chosen in Settings. A statement supplies both otherwise (money/).
 */
export async function POST(req: Request) {
  const auth = await profileIdOr401();
  if ('res' in auth) return auth.res;
  const b = await readJson(req);
  const monthly_burn = num(b.monthly_burn); const cash = num(b.cash);
  if (monthly_burn != null && monthly_burn < 0) return fail('Burn must be positive');
  if (cash != null && cash < 0) return fail('Cash must be positive');
  // The whole app's currency (Settings), and the one these numbers were typed in (the Runway sheet). Codes: a rate is looked up by one.
  const code = (v: unknown) => (typeof v === 'string' && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : undefined);
  const main_currency = code(b.main_currency);
  if (b.main_currency != null && !main_currency) return fail('A currency is three letters: USD, PHP, EUR.');
  const cash_currency = code(b.cash_currency);
  const burn_currency = code(b.burn_currency);
  if ((b.cash_currency != null && !cash_currency) || (b.burn_currency != null && !burn_currency)) return fail('A currency is three letters: USD, PHP, EUR.');
  try {
    // The monthly spend handed back to the rows: what was typed is forgotten and the estimate takes its place.
    if (b.burn === 'rows') await setFinance(auth.pid, { burn_from_rows: true });
    else await setFinance(auth.pid, { monthly_burn, cash, cash_currency, burn_currency, main_currency });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Could not save runway', 500);
  }
  return json({ ok: true, home: await loadHome(auth.pid) });
}
