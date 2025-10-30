# SMS Notifications - Quick Start Guide

Get SMS notifications working in 5 minutes! 🚀

## ⚡ Quick Setup (5 Minutes)

### 1. Get Twilio Credentials (2 minutes)

1. Go to https://www.twilio.com/try-twilio
2. Sign up for free account
3. Get $15 free credit
4. Note your **Account SID** and **Auth Token** from dashboard
5. Buy a phone number: Console → Phone Numbers → Buy a number (~$1/month)

### 2. Add Environment Variables (1 minute)

Add to your `.env.local` file:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

### 3. Run Database Migration (1 minute)

Copy and run this in your Supabase SQL Editor:

```sql
-- Add SMS settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sms_notifications_enabled boolean DEFAULT true;

-- Create SMS notifications log table
CREATE TABLE IF NOT EXISTS public.sms_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid,
  user_id uuid,
  phone_number text NOT NULL,
  message_type text NOT NULL,
  message_content text NOT NULL,
  twilio_message_id text,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'delivered', 'undelivered')),
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  delivered_at timestamp with time zone,
  CONSTRAINT sms_notifications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS sms_notifications_business_id_idx ON public.sms_notifications(business_id);
```

### 4. Test It (1 minute)

```bash
# Restart your app
npm run dev

# Run test script
node test-sms-notifications.js
```

## 📱 User Setup

1. Go to **Settings** in your dashboard
2. Add your phone number (e.g., +15551234567)
3. Click **Save**
4. SMS notifications are enabled by default! ✅

## 🎉 You're Done!

You'll now receive SMS for:
- 💰 Every sale
- 💸 Every payout
- 🎯 Revenue milestones ($1k, $5k, $10k, etc.)

## 💡 Example Messages

**First Sale:**
```
🎉 Your first sale! John Doe just purchased from My Store for $99.00. 
You're officially in business! 🚀
```

**Regular Sale:**
```
💰 New sale! Jane Smith purchased $49.99 from My Store. 
Total revenue: $148.99
```

**Payout:**
```
💸 Payout complete! $100.00 from My Store is on its way instantly. 🎊
```

**Milestone:**
```
🎯 Milestone reached! My Store just hit $1,000 in revenue! 
Keep up the momentum! 🚀
```

## 💰 Costs

- **SMS**: ~$0.0079 per message (US)
- **Phone Number**: ~$1.00/month
- **Free Credits**: Twilio gives you $15 to start

**Example**: 100 sales/month = $0.79 + $1.00 = **$1.79/month**

## 🔧 Troubleshooting

**Not receiving SMS?**
1. Check phone number is in international format (+15551234567)
2. Verify SMS is enabled in Settings
3. Check Twilio balance: https://console.twilio.com

**Environment variables not working?**
```bash
# Verify they're set
echo $TWILIO_ACCOUNT_SID
echo $TWILIO_AUTH_TOKEN
echo $TWILIO_PHONE_NUMBER

# Restart your app
npm run dev
```

## 📚 Full Documentation

For detailed docs, see: [SMS_NOTIFICATIONS_SETUP.md](./SMS_NOTIFICATIONS_SETUP.md)

## ✨ That's It!

SMS notifications are now working! Users will get instant alerts for all important events.

