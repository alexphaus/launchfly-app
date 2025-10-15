# 🚀 Quick Setup: Production-Ready Customer Card

## In 5 Minutes, Get Full Customer Tracking

### Step 1: Run Database Migration (2 min)

```bash
# Connect to your Supabase project
supabase db push

# Or use the SQL file directly
psql postgresql://your-connection-string -f db/migrations/20250116_customer_enhancements.sql
```

This creates:
- `customer_notes` table
- `customer_tags` table  
- Additional indexes

### Step 2: Configure Resend Webhooks (2 min)

1. Go to [Resend Webhooks](https://resend.com/webhooks)
2. Click "Add Webhook"
3. Enter URL: `https://yourdomain.com/api/webhook/resend`
4. Select ALL email events:
   - ✅ email.sent
   - ✅ email.delivered
   - ✅ email.opened
   - ✅ email.clicked
   - ✅ email.replied
   - ✅ email.bounced
   - ✅ email.complained
5. Save webhook

### Step 3: Use Enhanced Customer Card (1 min)

Replace your existing `CustomersCard` import:

```javascript
// Old way
import CustomersCard from '@/components/CustomersCard';

// New way - Enhanced with all features
import CustomersCard from '@/components/EnhancedCustomerCard';
```

### Step 4: Test It! (30 seconds)

1. Send yourself a test email
2. Open the email
3. Click a link in the email
4. Reply to the email

Watch your customer card update in real-time! 🎉

---

## What You Get

### ✅ Automatic Email Tracking
Every email interaction is tracked:
- 📤 Sent
- ✅ Delivered
- 📬 Opened
- 🖱️ Clicked
- 💬 Replied

### ✅ Smart Status Management
Status automatically updates:
- Email delivered → "Contacted"
- Email opened → "Engaged"
- Purchase made → "Converted"

### ✅ Lead Intelligence
- 🔥 Hot leads (high engagement)
- ⚡ Warm leads (moderate engagement)
- ❄️ Cold leads (low engagement)
- Engagement score (0-100)
- Suggested next actions

### ✅ Quick Actions
- Send email directly
- Add notes
- Export to CSV
- Search & filter

---

## Environment Variables Required

```env
# Email service (required)
RESEND_API_KEY=re_xxxxxxxxx
FROM_EMAIL=hello@yourdomain.com

# Database (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxxxxxxxx

# Background jobs (required)
INNGEST_EVENT_KEY=xxxxx
INNGEST_SIGNING_KEY=xxxxx
```

---

## Verify It's Working

### Test Webhook
```bash
curl https://yourdomain.com/api/webhook/resend
```

Should return:
```json
{
  "status": "Resend webhook endpoint is active",
  "env_check": {
    "supabase_url": true,
    "supabase_key": true,
    "inngest_event_key": true
  }
}
```

### Test Customer API
```bash
curl https://yourdomain.com/api/business/YOUR_BUSINESS_ID/activities
```

Should return customer activities.

---

## That's It!

Your customer card is now **production-ready** with:
- ✅ Full email tracking
- ✅ Automated status updates
- ✅ Engagement scoring
- ✅ Notes & export
- ✅ Professional UI

## Need Help?

Check the full guide: `PRODUCTION_LAUNCH_CHECKLIST.md`

---

**Setup Time:** ~5 minutes
**Complexity:** Low
**Impact:** High 🚀

