# Copilot billing

Plans, metering and Stripe subscriptions for the copilot vertical. Separate from
the wider Launchfly Stripe integration: its own endpoint, its own signing secret,
its own tables. Neither can corrupt the other's state.

## The pricing, and why it is these numbers

Two things cost real money per user: **scraping credits** for sourced matches
(Apify Google Maps, the dominant cost) and **model tokens** for briefs.
Everything metered maps to one of them. Nothing is metered that is free to serve
— which is why sending is unlimited on every plan: on the default `manual` send
mode the server only writes the draft, and the user sends from their own
WhatsApp or mail app.

| | Free | **Pro** | Operator |
|---|---|---|---|
| Price | $0 | **$29/mo** or $290/yr | $79/mo or $790/yr |
| Matches / month | 25 | **400** | 2,000 |
| Briefs / day | 1 | 3 | 10 |
| Target segments | 2 | 5 | 12 |
| Automatic day-3 follow-ups | — | yes | yes |

`emailApi` exists as an entitlement but is **not advertised**: no route sets
`send_mode`, so nothing in the app can turn it on. Build the send-mode route and
an address-verification flow before putting it back on the pricing page.

Rough cost of goods at the cap: Pro is around $2 of scraping plus $1–2 of tokens
against $29. Operator is roughly $13 against $79. Both leave room for the free
tier, which is the acquisition channel.

**Free is a real product, not a locked demo.** The whole loop works — matches,
drafts, funnel, diagnosis — there is just not enough supply to run a business
on. That is what makes it worth sending to a friend, and what makes the upgrade
obvious once it works.

**Yearly is ten months**, i.e. two free, which reads as 17% off.

Everything above lives in `src/lib/copilot/plans.ts`. Changing a price or a limit
is editing that one file; the pricing page, the enforcement path and the tests
all read it.

## What happens when someone stops paying

They drop to **free limits**, not to a locked account. Matches, funnel, outcomes
and history all stay exactly where they are; only new supply slows down. A
failed payment sets `plan_status = 'past_due'`, which stops entitling without
touching a single row of their work. This is deliberate: an account that holds
someone's pipeline hostage is not one they will come back to.

## Stripe setup

1. **Products and prices.** In the Stripe dashboard create two products,
   `Copilot Pro` and `Copilot Operator`, each with a monthly and a yearly
   recurring price ($29 / $290 and $79 / $790).

   On each price, add metadata `plan` = `pro` or `operator`. Not strictly
   required — the code falls back to matching the price id — but it makes a plan
   switch inside the Billing Portal resolve correctly no matter what.

2. **Env vars.** Copy the four price ids in:

   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PRICE_COPILOT_PRO_MONTHLY=price_...
   STRIPE_PRICE_COPILOT_PRO_YEARLY=price_...
   STRIPE_PRICE_COPILOT_OPERATOR_MONTHLY=price_...
   STRIPE_PRICE_COPILOT_OPERATOR_YEARLY=price_...
   NEXT_PUBLIC_APP_URL=https://your-domain          # Stripe redirects back here
   ```

3. **Webhook.** Add an endpoint at
   `https://your-domain/api/copilot/billing/webhook` subscribed to:

   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

   Copy **that endpoint's** signing secret into `COPILOT_STRIPE_WEBHOOK_SECRET`.
   It is not the same value as `STRIPE_WEBHOOK_SECRET`, which belongs to the
   other product's endpoint. Getting these two crossed means every copilot
   webhook fails signature verification.

4. **Billing Portal.** Enable it in Stripe under Settings → Billing → Customer
   portal, and allow plan switching and cancellation. The "Manage billing" button
   sends users there; no cancellation UI is built here on purpose.

5. **Migration.** Run `supabase/migrations/20260906_copilot_billing.sql`.

6. **Check it.** `GET /api/copilot/billing/webhook` returns which secrets it can
   see. Then use Stripe's test-mode "Send test webhook" and confirm a row lands
   in `copilot_billing_events`.

Without any of this, `billingConfigured()` is false: everybody is on free, the
upgrade buttons are disabled, and the pricing page says so plainly. Nothing
breaks.

## How the money path works

```
/copilot/pricing ──POST /api/copilot/billing/checkout──► Stripe Checkout (hosted)
                                                              │
                                    card details never touch this server
                                                              ▼
      copilot_profiles.plan ◄── applySubscription ◄── /api/copilot/billing/webhook
                    │
                    ▼
              limitsFor(profile) ──► supply quota, brief cap, segments, email API
```

Cards are handled entirely by Stripe Checkout and the Billing Portal. There is no
payment form in this codebase and no card data on this server.

### Idempotency

Stripe retries. Every event is claimed by its `evt_...` id in
`copilot_billing_events` **before** it is acted on, and `applySubscription`
writes absolute values rather than deltas — so a replayed event lands on exactly
the same row. A duplicate returns `{ received: true, duplicate: true }`.

### Metering

`copilot_usage` holds one row per profile, month and metric. The month is
computed in the **profile's own timezone**, so a user in Lisbon does not get a
fresh allowance at 1am because the server thinks it is already the first.

Increments go through the `copilot_bump_usage` Postgres function so two supply
runs finishing at once cannot both read 40 and both write 45.

Only matches the user actually **received from a billable adapter** are metered.
`SupplyAdapter.billable` marks the ones that spend money — today just
`google_maps`, which burns Apify credits. `hunter` (a shared internal table) and
`remote` (a public HTTP endpoint) are free to serve, so they are never metered
and are never stopped when the allowance runs out.

That distinction matters more than it looks: onboarding pulls the free adapters
first, so metering them spent a new user's entire free month on day one.

A failed adapter, or a run that returns nothing but duplicates, also costs
nothing. The allowance caps what billable adapters are *asked* for, not only what
is counted afterwards — scraping 400 places and discarding 380 bills the credits
anyway.

## Changing the pricing

Edit `src/lib/copilot/plans.ts`, create the matching Stripe prices, update the
env vars. `scripts/tests/copilot-core.test.ts` asserts the shape holds — every
paid plan must beat free on supply, exactly one plan is recommended, and the
yearly discount badge must match the actual arithmetic.

Existing subscribers keep the price they signed up at; Stripe does not re-price
an active subscription because a constant changed here.
