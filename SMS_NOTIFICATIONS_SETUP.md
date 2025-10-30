# SMS Notifications Setup Guide

Complete guide to setting up SMS notifications for sales and payouts in Launchfly.

## Overview

Users now receive instant SMS notifications for:
- 💰 **Sales** - Every time someone makes a purchase
- 🎉 **First Sale** - Special celebration message for the first sale
- 💸 **Payouts** - When cashout/payout requests are processed
- 🎯 **Milestones** - Revenue milestones ($1k, $5k, $10k, $50k, $100k)

## Prerequisites

1. **Twilio Account** - Sign up at https://www.twilio.com
2. **Twilio Phone Number** - Purchase a phone number in your Twilio console
3. **Environment Variables** - Configure in your `.env.local` file

## Step 1: Get Twilio Credentials

1. Go to https://console.twilio.com
2. Sign up or log in
3. Get your credentials from the dashboard:
   - **Account SID** - Found on the dashboard
   - **Auth Token** - Found on the dashboard (click to reveal)
   - **Phone Number** - Purchase one from "Phone Numbers" → "Buy a number"

## Step 2: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

**Important Notes:**
- `TWILIO_ACCOUNT_SID` must start with "AC"
- `TWILIO_PHONE_NUMBER` must include country code (e.g., +1 for US)
- Keep your Auth Token secure - never commit it to git

## Step 3: Database Migration

Run the SQL migration to add SMS notification tables:

```bash
# Apply the migration to your Supabase database
psql $DATABASE_URL < db/migrations/20250126_sms_notifications.sql
```

Or apply it manually in your Supabase SQL Editor:
1. Go to Supabase Dashboard
2. Click "SQL Editor"
3. Copy and paste the contents of `db/migrations/20250126_sms_notifications.sql`
4. Run the query

## Step 4: Restart Your Application

```bash
npm run dev
```

## Features

### User Settings

Users can manage SMS notifications in their Settings page:

1. **Add Phone Number** - Enter phone number in international format
2. **Enable/Disable SMS** - Toggle SMS notifications on/off
3. **Test SMS** - Send a test message to verify setup

### Notification Types

#### Sale Notifications
```
🎉 Your first sale! John Doe just purchased from My Store for $99.00. 
You're officially in business! 🚀
```

```
💰 New sale! Jane Smith purchased $49.99 from My Store. 
Total revenue: $148.99
```

#### Payout Notifications
```
💸 Payout complete! $100.00 from My Store is on its way instantly. 🎊
```

```
💸 Payout processing! $200.00 from My Store is on its way 
within 1-2 business days. 🎊
```

#### Milestone Notifications
```
🎯 Milestone reached! My Store just hit $1,000 in revenue! 
Keep up the momentum! 🚀
```

### Developer Features

#### SMS Notification Library

Located at `src/lib/sms-notifications.js`:

```javascript
import { sendSaleSms, sendPayoutSms, sendMilestoneSms } from '@/lib/sms-notifications';

// Send sale notification
await sendSaleSms({
  userId: 'user-uuid',
  businessId: 'business-uuid',
  businessName: 'My Store',
  amount: 99.99,
  customerName: 'John Doe',
  isFirstSale: true,
  totalRevenue: 99.99
});

// Send payout notification
await sendPayoutSms({
  userId: 'user-uuid',
  businessId: 'business-uuid',
  businessName: 'My Store',
  amount: 100.00,
  speed: 'instant',
  status: 'success'
});

// Send milestone notification
await sendMilestoneSms({
  userId: 'user-uuid',
  businessId: 'business-uuid',
  businessName: 'My Store',
  milestone: '1k_revenue',
  amount: 1000
});
```

## Testing

### Test SMS Functionality

Use the included test script:

```bash
node test-sms-notifications.js
```

This will:
1. Check Twilio configuration
2. Send a test SMS to your phone number
3. Verify database logging

### Manual Testing

1. **Test Sale Notification**
   - Make a test purchase through Stripe Checkout
   - Check if SMS is received

2. **Test Payout Notification**
   - Request a cashout from the dashboard
   - Verify payout SMS is sent

3. **Test Settings**
   - Navigate to Settings page
   - Toggle SMS notifications on/off
   - Verify settings are saved

## Database Schema

### `profiles` table additions:
```sql
- phone_number (text): User's phone number
- sms_notifications_enabled (boolean): SMS notification preference (default: true)
```

### `sms_notifications` table:
```sql
- id (uuid): Primary key
- business_id (uuid): Reference to business
- user_id (uuid): Reference to user
- phone_number (text): Recipient phone number
- message_type (text): Type of notification (sale, payout, milestone, etc.)
- message_content (text): SMS message content
- twilio_message_id (text): Twilio message SID
- status (text): Delivery status (sent, failed, delivered, undelivered)
- error_message (text): Error details if failed
- created_at (timestamp): When SMS was sent
- delivered_at (timestamp): When SMS was delivered
```

## Troubleshooting

### SMS Not Sending

1. **Check Twilio Credentials**
   ```bash
   echo $TWILIO_ACCOUNT_SID
   echo $TWILIO_AUTH_TOKEN
   echo $TWILIO_PHONE_NUMBER
   ```

2. **Verify Phone Number Format**
   - Must include country code (e.g., +1 for US)
   - Example: +15551234567

3. **Check Twilio Console**
   - Log in to https://console.twilio.com
   - Check "Monitor" → "Logs" → "Messaging"
   - Look for error messages

### SMS Not Received

1. **Check Phone Number**
   - Verify it's saved correctly in Settings
   - Check it's in international format

2. **Check SMS Enabled**
   - Verify SMS notifications are enabled in Settings

3. **Check Twilio Balance**
   - Ensure you have sufficient Twilio credits

### Database Errors

1. **Check Migration**
   ```sql
   -- Verify tables exist
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'sms_notifications';
   ```

2. **Check Columns**
   ```sql
   -- Verify columns exist
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' 
   AND column_name IN ('phone_number', 'sms_notifications_enabled');
   ```

## Cost Considerations

### Twilio Pricing (as of 2025)
- **SMS (US)**: ~$0.0079 per message
- **SMS (International)**: Varies by country
- **Phone Number**: ~$1.00/month

### Estimated Monthly Costs

For a business with:
- 100 sales/month
- 10 payouts/month
- 2 milestones/month

**Total SMS**: 112 messages × $0.0079 = **~$0.89/month**

**Plus phone number**: $1.00/month

**Total**: **~$1.89/month per user**

## Best Practices

1. **Rate Limiting**
   - SMS notifications are not rate-limited by default
   - Consider adding rate limits for high-volume scenarios

2. **Opt-In/Opt-Out**
   - Users can disable SMS in Settings
   - All SMS include unsubscribe information

3. **Testing**
   - Use Twilio test credentials for development
   - Test with your own phone number first

4. **Monitoring**
   - Check `sms_notifications` table for delivery status
   - Monitor Twilio console for issues

## Integration Points

SMS notifications are automatically triggered at:

1. **Sales** - `src/app/api/webhook/stripe/route.js`
   - After successful Stripe checkout
   - After revenue is recorded

2. **Payouts** - `src/app/api/cashout/request/route.js`
   - After successful payout initiation
   - After failed payout attempts

3. **Milestones** - `src/app/api/webhook/stripe/route.js`
   - When crossing revenue thresholds
   - After sale is processed

## Security

1. **Environment Variables**
   - Never commit Twilio credentials to git
   - Use `.env.local` for local development
   - Use environment variables in production

2. **Phone Number Privacy**
   - Phone numbers are stored securely in database
   - Not exposed in API responses
   - Only accessible to the user

3. **SMS Content**
   - Does not include sensitive data
   - Does not include full credit card numbers
   - Does not include passwords

## Support

For issues or questions:
1. Check Twilio documentation: https://www.twilio.com/docs
2. Review database logs: `SELECT * FROM sms_notifications ORDER BY created_at DESC LIMIT 10`
3. Check application logs for SMS-related errors

## Changelog

### v1.0.0 (2025-01-26)
- Initial SMS notification system
- Sale notifications
- Payout notifications
- Milestone notifications
- Settings UI for SMS preferences
- Test script for verification

