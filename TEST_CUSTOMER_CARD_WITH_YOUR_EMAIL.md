# 🧪 Test Customer Card with Your Email (axpg31@gmail.com)

## Quick Test Guide

### Method 1: Manual Email Test (Recommended - 5 minutes)

#### Step 1: Add Yourself as a Test Prospect

Create a test script to add yourself:

```javascript
// test-add-prospect.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function addTestProspect() {
  const businessId = 'YOUR_BUSINESS_ID'; // Replace with your business ID
  
  const { data, error } = await supabase
    .from('prospects')
    .insert({
      business_id: businessId,
      name: 'Alex (Test)',
      email: 'axpg31@gmail.com',
      company: 'Test Company',
      status: 'discovered',
      industry: 'Technology',
      source: 'manual_test'
    })
    .select()
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Test prospect added:', data);
  }
}

addTestProspect();
```

Run it:
```bash
node test-add-prospect.js
```

#### Step 2: Send Test Email via API

```javascript
// test-send-email.js
async function sendTestEmail() {
  const businessId = 'YOUR_BUSINESS_ID';
  
  const response = await fetch('http://localhost:3000/api/outreach/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId: businessId,
      limit: 1  // Send to 1 prospect only
    })
  });

  const result = await response.json();
  console.log('Email sent:', result);
}

sendTestEmail();
```

#### Step 3: Simulate Email Events

Since Resend webhooks need to be configured, you can manually trigger events:

**A. Simulate Email Opened:**
```bash
curl -X POST http://localhost:3000/api/webhook/resend \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.opened",
    "data": {
      "email_id": "test-123",
      "to": "axpg31@gmail.com",
      "email": "axpg31@gmail.com",
      "user_agent": "Mozilla/5.0"
    }
  }'
```

**B. Simulate Email Clicked:**
```bash
curl -X POST http://localhost:3000/api/webhook/resend \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.clicked",
    "data": {
      "email_id": "test-123",
      "to": "axpg31@gmail.com",
      "email": "axpg31@gmail.com",
      "url": "https://yourdomain.com/pricing"
    }
  }'
```

**C. Simulate Email Reply:**
```bash
curl -X POST http://localhost:3000/api/webhook/resend \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.replied",
    "data": {
      "from": "axpg31@gmail.com",
      "email": "axpg31@gmail.com",
      "text": "Hey, this looks interesting! Tell me more about your service.",
      "subject": "Re: Introduction to Launchfly",
      "in_reply_to": "test-123"
    }
  }'
```

#### Step 4: Check Your Dashboard

1. Go to your dashboard: `http://localhost:3000/dashboard/[your-session-id]`
2. Look at the **Your Customers** card
3. You should see yourself listed with:
   - Name: Alex (Test)
   - Email: axpg31@gmail.com
   - Status: Should progress from "Contacted" → "Engaged" → "Converted"
   - Engagement score increasing with each action

4. Click on your customer card to see:
   - 🔥 Lead temperature
   - Activity timeline with all events
   - Engagement score
   - Suggested next action

---

### Method 2: Real Email Test (10 minutes)

If you have Resend configured:

#### Step 1: Configure Resend Webhook

1. Go to [Resend Dashboard](https://resend.com/webhooks)
2. Add webhook: `https://your-deployed-url.vercel.app/api/webhook/resend`
3. Select all email events
4. Save

#### Step 2: Send Real Email

Use the customer acquisition system:

```javascript
// send-real-test-email.js
const { createClient } = require('@supabase/supabase-js');
const { startOutreachCampaign } = require('./src/lib/customer-acquisition');

async function sendRealEmail() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Add yourself as prospect
  const businessId = 'YOUR_BUSINESS_ID';
  
  await supabase.from('prospects').insert({
    business_id: businessId,
    name: 'Alex',
    email: 'axpg31@gmail.com',
    company: 'Launchfly',
    status: 'discovered'
  });

  // Get business data
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  // Send email
  await startOutreachCampaign(businessId, business.business_data, {
    dryRun: false,
    maxSends: 1
  });

  console.log('✅ Email sent to axpg31@gmail.com');
  console.log('📬 Check your inbox!');
}

sendRealEmail();
```

#### Step 3: Interact with the Email

1. **Check your inbox** (axpg31@gmail.com)
2. **Open the email** → Resend webhook fires → Status: "Engaged"
3. **Click a link** → Resend webhook fires → Activity logged
4. **Reply to the email** → Resend webhook fires → Reply logged with sentiment

#### Step 4: Watch Dashboard Update

Refresh your dashboard and see real-time updates!

---

### Method 3: Quick Database Insert (1 minute)

For fastest testing, directly insert test data:

```sql
-- Add test prospect
INSERT INTO prospects (business_id, name, email, company, status)
VALUES ('YOUR_BUSINESS_ID', 'Alex (Test)', 'axpg31@gmail.com', 'Launchfly', 'engaged');

-- Add test activities
INSERT INTO ai_activities (business_id, type, icon, message, metadata, created_at)
VALUES 
  ('YOUR_BUSINESS_ID', 'email_sent', '📧', 'Sent cold email to axpg31@gmail.com', 
   '{"recipientEmail": "axpg31@gmail.com", "recipientName": "Alex", "recipientCompany": "Launchfly"}', 
   NOW() - INTERVAL '2 days'),
  
  ('YOUR_BUSINESS_ID', 'email_opened', '📬', 'axpg31@gmail.com opened your email', 
   '{"recipientEmail": "axpg31@gmail.com"}', 
   NOW() - INTERVAL '1 day'),
  
  ('YOUR_BUSINESS_ID', 'email_clicked', '🖱️', 'axpg31@gmail.com clicked a link in your email', 
   '{"recipientEmail": "axpg31@gmail.com", "url": "https://example.com/pricing"}', 
   NOW() - INTERVAL '12 hours'),
  
  ('YOUR_BUSINESS_ID', 'email_replied', '💬', 'Response received! "This looks great! Tell me more."', 
   '{"recipientEmail": "axpg31@gmail.com", "sentiment": "positive", "isPositive": true}', 
   NOW() - INTERVAL '6 hours');
```

Then refresh your dashboard!

---

## Expected Results

After testing, you should see in your customer card:

```
Your Customers
1 converted • 1 total                    [Export CSV]

[🔥 Hot]  Alex (Test)           [Engaged]  85/100
          axpg31@gmail.com
```

**Click to open detail modal:**
```
┌────────────────────────────────────────┐
│ Alex (Test)                       [X]  │
│ axpg31@gmail.com                       │
│ 🔥 Hot Lead                            │
│                                        │
│ Company: Launchfly    Status: Engaged │
│ Engagement: 85/100    Value: $0       │
│                                        │
│ 💡 Suggested Next Step                │
│ → Schedule a call                      │
│                                        │
│ [📧 Send Email]  [💬 Add Note]         │
│                                        │
│ ━━━━━━━━━━━ Notes ━━━━━━━━━━━         │
│ [Type a note about yourself...]        │
│                                        │
│ ━━━━━━━ Activity History ━━━━━━━      │
│ 📧 Sent cold email          2 days ago │
│ 📬 Opened email             1 day ago  │
│ 🖱️ Clicked pricing link    12 hours ago│
│ 💬 Replied: "This looks..."  6 hours ago│
└────────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Add yourself as prospect
- [ ] See yourself in customer list
- [ ] Click to open detail modal
- [ ] View activity timeline
- [ ] Check engagement score
- [ ] See lead temperature
- [ ] Add a note to yourself
- [ ] Click "Send Email" button (opens mailto:)
- [ ] Test export CSV functionality
- [ ] Filter by status
- [ ] Search for your email

---

## Troubleshooting

### Can't find your business ID?

```bash
# In browser console on dashboard page
console.log(business.id);

# Or query database
SELECT id, name FROM businesses ORDER BY created_at DESC LIMIT 5;
```

### Webhook not working?

1. Check webhook endpoint: `curl http://localhost:3000/api/webhook/resend`
2. View logs: Check Next.js terminal for webhook events
3. Test manually with curl commands above

### Customer not showing?

1. Check database: `SELECT * FROM prospects WHERE email = 'axpg31@gmail.com';`
2. Check activities: `SELECT * FROM ai_activities WHERE metadata->>'recipientEmail' = 'axpg31@gmail.com';`
3. Refresh dashboard page

---

## What You'll Learn

By testing with your email, you'll verify:

✅ Email tracking works end-to-end
✅ Status progression is automatic
✅ Engagement scoring calculates correctly
✅ Lead temperature shows properly
✅ Activity timeline displays all events
✅ Notes system works
✅ Export functionality works
✅ Search and filters work
✅ Modal interactions work
✅ Real-time updates happen

---

## Quick Commands

```bash
# Start dev server
npm run dev

# Check webhook status
curl http://localhost:3000/api/webhook/resend

# View your customer data
curl http://localhost:3000/api/business/YOUR_BUSINESS_ID/activities

# Test email sending
node test-send-email.js

# Simulate email events
# (use curl commands from Step 3 above)
```

---

**Ready to test?** Pick Method 1 (fastest) or Method 2 (most realistic) and see your customer card in action! 🚀


