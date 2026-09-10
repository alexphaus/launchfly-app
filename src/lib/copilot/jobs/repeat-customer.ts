// src/lib/copilot/jobs/repeat-customer.ts
// Somebody already paid you once and has not heard from you since.
//
// The cheapest revenue in any business, and the one the app was structurally
// blind to: every adapter in supply/ looks for STRANGERS. A copilot whose only
// idea of "earn" is a cold opener to a business that has never heard of you is
// working the hardest half of the funnel exclusively.
//
// Same sensor as client-delivery — the linked Launchfly `sales` table — and the
// same discipline: no model, a template grounded in a purchase that actually
// happened, so it cannot invent a relationship that does not exist.

import { copilotDb } from '../db';
import { deepLink } from '../execution';
import type { MoveDraft } from '../moves';
import type { Profile } from '../types';
import { daysSince, firstName, greetingName, moneyLabel, shortDate, type SaleRow } from './client-delivery';
import type { Job, JobContext } from './types';

/** Younger than this and it is not dormancy, it is a customer you are still serving. */
export const DORMANT_MIN_DAYS = 30;
/** Older than this and "I have not checked in" is not a reconnect, it is a cold email. */
export const DORMANT_MAX_DAYS = 180;
export const MAX_REPEAT_MOVES = 3;

/** Group key for one customer. Email is the reliable one; a name is better than nothing. */
export function customerKey(s: SaleRow): string | null {
  const email = s.customer_email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  const name = s.customer_name?.trim().toLowerCase();
  return name ? `name:${name}` : null;
}

/**
 * The most recent sale per customer, for customers whose most recent sale is
 * old enough to count as dormant.
 *
 * Grouping matters: a customer who bought three times in March is one dormant
 * customer, and sending them three identical reconnects is how a copilot loses
 * the account it was trying to keep.
 */
export function dormantSales(sales: SaleRow[], now: Date): SaleRow[] {
  const newest = new Map<string, SaleRow>();
  for (const s of sales) {
    const key = customerKey(s);
    if (!key) continue;
    const seen = newest.get(key);
    if (!seen || new Date(s.created_at) > new Date(seen.created_at)) newest.set(key, s);
  }
  return [...newest.values()]
    .filter((s) => daysSince(s.created_at, now) >= DORMANT_MIN_DAYS)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
}

/**
 * The message. Grounded entirely in the purchase and the silence since — it
 * claims nothing about what the work did, because this job cannot see that.
 */
export function repeatMessage(profile: Pick<Profile, 'name'>, sale: SaleRow, now: Date): string {
  const who = greetingName(sale.customer_name);
  const me = firstName(profile.name) || profile.name;
  return [
    who ? `Hi ${who} — it's ${me}.` : `Hi — it's ${me}.`,
    `You bought from me ${daysSince(sale.created_at, now)} days ago and I have not checked in since, which is my fault.`,
    'Two questions: is what you got still doing its job, and is there a next piece worth doing?',
    'I have room for one more build this month if the answer to the second one is yes.',
  ].join(' ');
}

/** One dormant customer becomes one Move. Pure, so the wording is under test. */
export function repeatMove(profile: Pick<Profile, 'name' | 'timezone'>, sale: SaleRow, now: Date): MoveDraft {
  const who = greetingName(sale.customer_name);
  const paid = moneyLabel(sale.amount, sale.currency);
  const days = daysSince(sale.created_at, now);
  const body = repeatMessage(profile, sale, now);
  const email = sale.customer_email?.trim() || null;

  return {
    job: repeatCustomerJob.key,
    kind: 'earn',
    // Keyed to the sale, so buying again resets the clock rather than silencing
    // this customer forever.
    external_id: `repeat:${sale.id}`,
    headline: `${who || 'A past customer'} bought ${paid ? `${paid} ` : ''}${days} days ago and has not heard from you since`,
    why: [
      `Last paid ${shortDate(sale.created_at, profile.timezone)}${paid ? `, ${paid}` : ''}.`,
      'They have already bought once, so there is no offer to prove and no trust to build.',
      'Every match in your pipeline is a stranger. This one is not.',
    ],
    artifact: {
      kind: 'message',
      label: email ? 'Open in email' : 'Copy the message',
      value: body,
      href: email ? deepLink({ channel: 'email', recipient: email, subject: 'Checking in', body }) : null,
    },
    cost_label: '5 min',
    stake: {
      metric: 'won_amount', direction: 'up', by: sale.amount ?? 0,
      // The longer the silence the less this is worth, so the window closes as
      // it ages rather than staying politely open forever.
      withinDays: Math.max(3, DORMANT_MAX_DAYS - days),
      value: sale.amount ?? undefined,
    },
  };
}

export const repeatCustomerJob: Job = {
  key: 'repeat_customer',
  label: 'Past customers gone quiet',

  available(ctx: JobContext) {
    return !!ctx.profile.linked_business_id;
  },

  async run(ctx: JobContext): Promise<MoveDraft[]> {
    const since = new Date(ctx.now.getTime() - DORMANT_MAX_DAYS * 86_400_000).toISOString();
    const { data, error } = await copilotDb()
      .from('sales')
      .select('id, product_id, amount, currency, customer_email, customer_name, created_at')
      .eq('business_id', ctx.profile.linked_business_id)
      .eq('payment_status', 'completed')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    return dormantSales((data ?? []) as SaleRow[], ctx.now)
      .slice(0, MAX_REPEAT_MOVES)
      .map((s) => repeatMove(ctx.profile, s, ctx.now));
  },
};
