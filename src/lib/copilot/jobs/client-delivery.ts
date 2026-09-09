// src/lib/copilot/jobs/client-delivery.ts
// Somebody paid. Nothing has happened since.
//
// The first Job that is not outbound, and it was chosen because it needs no new
// integration at all: Launchfly's `sales` table lives in the same Supabase
// project the copilot already connects to. The sensor was always there.
//
// This is also the shape every later Job should copy — a real event in data the
// user already owns, turned into one finished thing they can act on in a tap.
// It uses no model: the message is a template, so it is deterministic, free,
// testable, and cannot hallucinate a purchase that did not happen.

import { copilotDb } from '../db';
import { deepLink } from '../execution';
import type { MoveDraft } from '../moves';
import type { Profile } from '../types';
import type { Job, JobContext } from './types';

/** How far back to look for a sale with nothing recorded after it. */
export const DELIVERY_LOOKBACK_DAYS = 21;
/** Below this, the sale is too fresh to nag about — they may still be reading the receipt. */
export const DELIVERY_MIN_AGE_HOURS = 2;
export const MAX_DELIVERY_MOVES = 5;

export interface SaleRow {
  id: string;
  product_id: string | null;
  amount: number | null;
  currency: string | null;
  customer_email: string | null;
  customer_name: string | null;
  created_at: string;
}

/** Placeholders the manual-sale form and Stripe both write. Never greet these. */
const PLACEHOLDER_NAMES = new Set(['unknown', 'manual', 'customer', 'guest', '']);

/** First token, for a person. "Hi Maria Santos" reads like a form letter. */
export function firstName(full: string | null | undefined): string {
  const n = (full ?? '').trim().split(/\s+/)[0] ?? '';
  return PLACEHOLDER_NAMES.has(n.toLowerCase()) ? '' : n;
}

/**
 * Who to address, and it is not always a person.
 *
 * "Cebu Pest Pros" first-named to "Cebu" produced "Hi Cebu — thanks for your
 * order", which reads as a mistake to the one person who matters. Three or more
 * words is a business; greet it whole. Two or fewer is a person; greet the
 * first name. Wrong occasionally, never embarrassing.
 */
export function greetingName(full: string | null | undefined): string {
  const clean = (full ?? '').trim().replace(/\s+/g, ' ');
  if (!clean || PLACEHOLDER_NAMES.has(clean.toLowerCase())) return '';
  const words = clean.split(' ');
  return words.length >= 3 ? clean.slice(0, 60) : (firstName(clean) || '');
}

export function moneyLabel(amount: number | null, currency: string | null): string {
  if (amount == null || !Number.isFinite(amount)) return '';
  const cur = (currency || 'usd').toUpperCase();
  return `${cur} ${Math.round(amount).toLocaleString('en-US')}`;
}

/** "8 Sep", in the profile's own timezone. Bad tz falls back rather than throwing. */
export function shortDate(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: timezone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso));
  }
}

export function daysSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

/**
 * The message itself.
 *
 * Note this is NOT gated by offerIsEmpty. Invariant 1 exists because an opener
 * to a stranger written from a blank offer describes a business the user never
 * described. This message is grounded in a purchase that actually happened —
 * the recipient already knows what they bought — so there is nothing to invent.
 */
export function deliveryMessage(profile: Pick<Profile, 'name'>, sale: SaleRow): string {
  const who = greetingName(sale.customer_name);
  const me = firstName(profile.name) || profile.name;
  return [
    who ? `Hi ${who} — thanks for your order.` : 'Hi — thanks for your order.',
    `It's ${me}. I'll get you set up so it's actually running, not just paid for.`,
    'What time works this week for a quick 10 minutes? I can do it while we talk.',
  ].join(' ');
}

/** One sale becomes one Move. Pure, so the wording is under test. */
export function deliveryMove(profile: Pick<Profile, 'name' | 'timezone'>, sale: SaleRow, now: Date): MoveDraft {
  const who = greetingName(sale.customer_name);
  const paid = moneyLabel(sale.amount, sale.currency);
  const days = daysSince(sale.created_at, now);
  const body = deliveryMessage(profile, sale);
  const email = sale.customer_email?.trim() || null;

  return {
    job: clientDeliveryJob.key,
    kind: 'build',
    external_id: `sale:${sale.id}`,
    headline: `${who || 'A customer'} paid${paid ? ` ${paid}` : ''} — send them the setup steps`,
    why: [
      `Paid on ${shortDate(sale.created_at, profile.timezone)}${paid ? `, ${paid}` : ''}.`,
      days === 0 ? 'Nothing recorded here since the sale.' : `${days} day${days === 1 ? '' : 's'} ago, and nothing recorded here since.`,
      // Money already collected is the cheapest revenue in the business, and
      // the fastest way to lose it is silence after the payment.
      'Paid and undelivered is the most expensive kind of quiet.',
    ],
    artifact: {
      kind: 'message',
      label: email ? 'Open in email' : 'Copy the message',
      value: body,
      href: email ? deepLink({ channel: 'email', recipient: email, subject: 'Getting you set up', body }) : null,
    },
    cost_label: '10 min',
  };
}

export const clientDeliveryJob: Job = {
  key: 'client_delivery',
  label: 'Paid, not delivered',

  // The sensor is a linked Launchfly business. Without one there is no sales
  // table to read, which is a missing sensor rather than an empty result.
  available(ctx: JobContext) {
    return !!ctx.profile.linked_business_id;
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const since = new Date(ctx.now.getTime() - DELIVERY_LOOKBACK_DAYS * 86_400_000).toISOString();
    const until = new Date(ctx.now.getTime() - DELIVERY_MIN_AGE_HOURS * 3_600_000).toISOString();
    const { data, error } = await copilotDb()
      .from('sales')
      .select('id, product_id, amount, currency, customer_email, customer_name, created_at')
      .eq('business_id', ctx.profile.linked_business_id)
      .eq('payment_status', 'completed')
      .gte('created_at', since)
      .lte('created_at', until)
      .order('created_at', { ascending: false })
      .limit(MAX_DELIVERY_MOVES);
    if (error) throw error;

    return ((data ?? []) as SaleRow[]).map((s) => deliveryMove(ctx.profile, s, ctx.now));
  },
};
