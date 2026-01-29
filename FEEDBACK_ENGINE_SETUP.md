# 7-Day Feedback + Referral Engine Setup Guide

## Overview

The **Reputation Engine** automatically follows up with customers 7 days after service to:

1. **Check Quality**: "Is your AC still cooling well?"
2. **Get Social Proof**: If happy → Ask for Google Review
3. **Generate Referrals**: If happy → Give them a shareable referral link
4. **Handle Issues**: If not happy → Route to warranty support

### Cost per message: ₱0.17 (WhatsApp Utility Template)

---

## Setup Steps

### 1. Run Database Migration

Copy this SQL and run it in Supabase SQL Editor:

```sql
-- 7-Day Feedback Engine columns
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS feedback_request_sent_at timestamptz;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS feedback_score integer;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS feedback_status text;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS feedback_text text;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS feedback_received_at timestamptz;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS referral_asked_at timestamptz;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS google_review_asked_at timestamptz;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_outbound_type text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_service_record_id uuid;

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_token text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_message_sent_at timestamptz;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS google_review_link_sent boolean DEFAULT false;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_service_records_feedback_due
ON service_records(service_date, feedback_request_sent_at)
WHERE feedback_request_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_token
ON referrals(referral_token)
WHERE referral_token IS NOT NULL;
```

### 2. Create WhatsApp Template in Twilio Console

Go to: **Twilio Console → Messaging → Content Template Builder**

Create a new template:
- **Name**: `feedback_7d_followup`
- **Category**: `UTILITY` (Post-purchase update)
- **Language**: `en`
- **Body**:
```
Hi {{1}}, it's {{2}}! 👋

It's been a week since our service. Is your unit still cooling well? ❄️

Reply:
1️⃣ Great ✅
2️⃣ Not good ❌
```

Wait for approval (usually 1-2 hours for Utility templates).

### 3. Set Environment Variables

Add to your `.env.local`:

```bash
# 7-Day Feedback Template (get SID from Twilio after approval)
TWILIO_TEMPLATE_FEEDBACK_7D=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# App URL for referral links
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### 4. Deploy to Vercel

The cron job is already configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/feedback-trigger",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This runs daily at 2 AM UTC.

---

## How It Works

### Cron Flow (Daily)

```
1. Cron triggers at 2 AM UTC
2. Query: Find service_records WHERE service_date = (today - 7 days)
3. Filter: feedback_request_sent_at IS NULL
4. For each service:
   a. Skip if customer opted out
   b. Skip if messaged in last 24h (rate limit)
   c. Send WhatsApp template
   d. Update: feedback_request_sent_at, customer.last_outbound_type = 'FEEDBACK_7D'
```

### Customer Reply Flow (AI V2)

```
Customer receives: "Is your unit still cooling well? 1) Great 2) Not good"

IF customer replies "1" or "Great":
├─ AI recognizes feedback context (last_outbound_type = 'FEEDBACK_7D')
├─ AI calls saveFeedback(score: 5, status: 'positive')
├─ AI calls getReferralLink()
├─ AI responds:
│   "Great to hear! 🎉
│    If you have 20 seconds, an honest review helps us:
│    👉 [Google Review Link]
│    
│    Know someone who needs AC service? Share this link:
│    👉 [Referral Link]"
└─ Database: feedback_score=5, referral_asked_at=now()

IF customer replies "2" or "Not good":
├─ AI recognizes feedback context
├─ AI calls saveFeedback(score: 2, status: 'negative')
├─ AI calls notifyOwner()
├─ AI responds:
│   "Sorry to hear that. 😔 What's the issue?
│    Since it's been less than 30 days, this is covered by warranty.
│    I've alerted the team - they'll contact you to fix it."
└─ Database: feedback_score=2, customer.status='needs_followup'
```

### Referral Link Flow

```
1. Happy customer gets link: https://app.launchfly.com/r/XYZ789
2. Customer shares with friend
3. Friend clicks → /r/[token]/route.ts
4. Route tracks click_at, redirects to WhatsApp
5. Friend messages: "Hi! I was referred by [Name] (code: REF-XXXXX)"
6. AI recognizes referral code → applies discount
```

---

## Testing

### Manual Trigger (for testing)

```bash
curl -X GET "https://your-domain.vercel.app/api/cron/feedback-trigger" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Simulate a 7-day-old service

```sql
-- Create a service record from 7 days ago
INSERT INTO service_records (
  business_id, customer_id, service_date, service_name, feedback_request_sent_at
) VALUES (
  'your-business-id',
  'your-customer-id',
  NOW() - INTERVAL '7 days',
  'Aircon Cleaning',
  NULL  -- This is what the cron looks for
);
```

---

## Monitoring

Check the cron job logs in Vercel Dashboard → Logs.

Look for:
- `📣 Starting 7-Day Feedback Trigger Cron`
- `📋 Found X services from YYYY-MM-DD for feedback`
- `✅ Sent template to [Name] (+phone)`

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/cron/feedback-trigger/route.ts` | Cron job that finds and messages customers |
| `src/app/r/[token]/route.ts` | Referral link redirect handler |
| `src/lib/referral-system.ts` | Referral token generation & tracking |
| `src/lib/ai-receptionist/tools.ts` | `saveFeedback` and `getReferralLink` tools |
| `src/lib/ai-receptionist/system-prompt.ts` | Rule 17: Feedback loop handling |
| `db/migrations/20260129_feedback_engine.sql` | Full migration with functions |

---

## Why This Matters

- **ROI**: Each feedback request costs ₱0.17, but can generate:
  - Google reviews (social proof → more customers)
  - Referrals (10% discount → new customers)
  - Quality issues caught early (warranty claims → retention)

- **Automation**: Technician does nothing. System runs automatically.

- **Timing**: 7 days = perfect moment. Customer has used AC enough to know if it works, but recently enough to remember the service.
