import type { Goal, OpportunityType, OutcomeKind } from '@/lib/copilot/types';

export const TYPE_LABEL: Record<OpportunityType, string> = { client: 'Client', people: 'People', service: 'Service', community: 'Community', signal: 'Signal' };
export const TYPE_PLURAL: Record<OpportunityType, string> = { client: 'Clients', people: 'People', service: 'Services', community: 'Communities', signal: 'Signals' };
export const OUTCOME_LABEL: Record<OutcomeKind, string> = { reply: 'Replied', meeting: 'Meeting', proposal: 'Proposal', won: 'Won', lost: 'Lost', no_reply: 'No reply' };
const SOURCE_LABEL: Record<string, string> = { hunter: 'Pipeline', google_maps: 'Google Maps', inferred: 'Inferred' };
export const sourceLabel = (s: string | null | undefined) => (s ? SOURCE_LABEL[s] ?? s.replace(/_/g, ' ') : 'unknown');

export function greeting(timezone: string, name: string): string {
  let hour = new Date().getHours();
  try { hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(new Date())) % 24; } catch { /* keep local */ }
  const part = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name.split(' ')[0]}`;
}

export function goalProgress(g: Goal): { pct: number | null; label: string } {
  const cur = g.current_value ?? 0;
  if (g.target_value && g.target_value > 0) {
    const pct = Math.max(0, Math.min(100, Math.round((cur / g.target_value) * 100)));
    return { pct, label: `${fmtValue(cur, g)} of ${fmtValue(g.target_value, g)} target` };
  }
  return { pct: null, label: g.note || (g.horizon_days ? `${g.horizon_days}-day horizon` : 'No target set') };
}

export function fmtValue(v: number, g: Pick<Goal, 'metric' | 'unit'>): string {
  const n = v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (g.metric === 'currency') return `${g.unit || '$'}${n}`;
  if (g.metric === 'percent') return `${n}%`;
  return g.unit ? `${n} ${g.unit}` : n;
}

export function money(v: number, currency = '$'): string {
  const n = Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v.toLocaleString();
  return `${currency}${n}`;
}

export function pct(r: number | null): string {
  return r == null ? '—' : `${Math.round(r * 100)}%`;
}

export function maskPhone(p?: string): string | undefined {
  if (!p) return undefined;
  return p.length > 6 ? `+${p.slice(0, p.length - 4).replace(/\d/g, (d, i) => (i < 3 ? d : '•'))}${p.slice(-4)}` : p;
}

export function relTime(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Convert a base64url VAPID key for PushManager.subscribe. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
