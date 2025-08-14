## Revenue Engine (v1)

New modules added under `src/lib/**` to support a compliant cold email revenue loop with SPF/DKIM/DMARC checks, suppression list, Resend sending with caps, Stripe webhook idempotency, and metrics endpoints.

Environment variables (see `.env.example` in repo root):

```
RESEND_API_KEY=
SENDER_EMAIL=noreply@launchfly.ai
DAILY_SEND_CAP=10
DKIM_SELECTORS=default
SKIP_DNS_CHECKS=false
NEXT_PUBLIC_WEBSITE_BASE_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PHYSICAL_MAILING_ADDRESS="Launchfly, 548 Market St PMB 87532, San Francisco, CA 94104"
```

Run seed:

```
npm run e2e:seed
```


