# 📧 SendGrid Setup Guide - Inbound Email Tracking

## Overview

This guide will help you set up SendGrid to track email replies for your Launchfly customer acquisition system. You'll use:
- **Resend** for sending emails (current setup)
- **SendGrid** for tracking replies via Inbound Parse

---

## 🚀 Quick Setup (15 minutes)

### Step 1: Create SendGrid Account

1. Go to [SendGrid.com](https://sendgrid.com)
2. Click **"Start for Free"**
3. Sign up (free tier includes 100 emails/day)
4. Verify your email address

---

### Step 2: Get API Key

1. Go to **Settings** → **API Keys**
2. Click **"Create API Key"**
3. Name it: `Launchfly Inbound`
4. Permissions: **"Full Access"** (or minimum: Mail Send + Inbound Parse)
5. Click **"Create & View"**
6. **Copy the API key** (you won't see it again!)

---

### Step 3: Add to Environment Variables

Add to your `.env.local`:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=hello@launchfly.ai

# Keep your existing Resend config
RESEND_API_KEY=re_xxxxxxxxx
FROM_EMAIL=hello@launchfly.ai
```

---

### Step 4: Install SendGrid Package

```bash
npm install @sendgrid/mail
```

---

### Step 5: Configure Inbound Parse

#### A. In SendGrid Dashboard:

1. Go to **Settings** → **Inbound Parse**
2. Click **"Add Host & URL"**

#### B. Add Your Domain:

**If you OWN launchfly.ai domain:**
- Host: `launchfly.ai`
- URL: `https://launchfly.ai/api/webhook/sendgrid-inbound`
- Check: **"Check Incoming Emails for Spam"** ✅

**If TESTING locally with ngrok:**
- Host: `launchfly.ai` (or subdomain like `replies.launchfly.ai`)
- URL: `https://your-ngrok-url.ngrok-free.app/api/webhook/sendgrid-inbound`

#### C. Configure MX Records (IMPORTANT!)

SendGrid will show you MX records to add. Add these to your domain's DNS:

```
Type: MX
Host: @  (or subdomain if using replies.launchfly.ai)
Value: mx.sendgrid.net
Priority: 10
```

**DNS Provider Examples:**
- **Cloudflare:** DNS → Add Record → MX
- **GoDaddy:** DNS Management → Add MX Record
- **Namecheap:** Advanced DNS → Mail Settings

⏱️ **DNS propagation takes 5-60 minutes**

---

### Step 6: Configure Event Webhooks (For Opens/Clicks)

1. Go to **Settings** → **Mail Settings** → **Event Webhook**
2. Click **"Create new webhook"**
3. **Webhook URL:**
   ```
   https://launchfly.ai/api/webhook/sendgrid
   ```
   (Or ngrok URL for testing)

4. **Select Events:**
   - ✅ Delivered
   - ✅ Opened
   - ✅ Clicked
   - ✅ Bounced
   - ✅ Dropped
   - ✅ Spam Report
   - ✅ Unsubscribe

5. **Test the webhook** → Click "Test Your Integration"
6. **Enable** the webhook

---

### Step 7: Verify Setup

Test the webhooks:

```bash
# Test event webhook
curl https://launchfly.ai/api/webhook/sendgrid

# Test inbound webhook  
curl https://launchfly.ai/api/webhook/sendgrid-inbound

# Both should return: { "status": "... webhook active" }
```

---

## 🧪 Testing Inbound Emails

### Test 1: Send Email Reply

1. Send a test email:
```bash
node test-real-email-tracking.js
```

2. Reply to that email from Gmail

3. Wait 10-30 seconds (for MX routing)

4. Check your dashboard
   - Should see: **"💬 Replied: [your message]"**
   - Status should update to "Engaged"

---

### Test 2: Check SendGrid Logs

1. Go to SendGrid → **Activity Feed**
2. Look for your test email
3. Should show:
   - ✅ Delivered
   - ✅ Opened
   - ✅ Clicked
   - 💬 Reply (if MX records configured)

---

## 🔧 Troubleshooting

### Issue: "Replies not showing"

**Check MX Records:**
```bash
dig MX launchfly.ai

# Should show:
# launchfly.ai.  300  IN  MX  10 mx.sendgrid.net.
```

**Check Inbound Parse:**
- SendGrid → Settings → Inbound Parse
- Verify your domain is listed
- Check webhook URL is correct

**Check Webhook Logs:**
- SendGrid → Settings → Event Webhook → Activity
- Should show successful deliveries

### Issue: "Webhook returning errors"

Check your app logs:
```bash
# In your Next.js terminal, you should see:
=== SENDGRID INBOUND EMAIL RECEIVED ===
Inbound email from: user@example.com
✅ Inbound email processed successfully
```

### Issue: "Domain verification failed"

1. Go to SendGrid → Settings → Sender Authentication
2. Verify your domain ownership
3. Add required DNS records (SPF, DKIM)

---

## 📊 How It Works

### Email Flow:

```
1. You send email via Resend
   ↓
2. Customer receives email
   ↓
3. Customer opens email
   → SendGrid Event Webhook fires
   → /api/webhook/sendgrid receives "open" event
   → Dashboard updates: "📬 Opened"
   ↓
4. Customer clicks link
   → SendGrid Event Webhook fires
   → /api/webhook/sendgrid receives "click" event
   → Dashboard updates: "🖱️ Clicked"
   ↓
5. Customer replies to email
   → Email goes to: hello@launchfly.ai
   → MX record routes to: mx.sendgrid.net
   → SendGrid Inbound Parse receives email
   → /api/webhook/sendgrid-inbound processes reply
   → Dashboard updates: "💬 Replied: [message]"
```

---

## 💡 Alternative: Simpler Setup

### Don't have domain access? Use subdomain:

Instead of `hello@launchfly.ai`, use `replies@launchfly.ai`:

1. Create subdomain: `replies.launchfly.ai`
2. Point MX to SendGrid: `mx.sendgrid.net`
3. Use as FROM_EMAIL: `replies@launchfly.ai`

This way you don't need to change main domain's MX records!

---

## 🎯 What You Get

After setup:
- ✅ Full email tracking (sent, delivered, opened, clicked)
- ✅ Reply tracking with sentiment analysis
- ✅ Automatic status progression
- ✅ Real-time dashboard updates
- ✅ Production-ready email infrastructure

---

## 📝 Environment Variables Summary

```env
# SendGrid (for inbound + event tracking)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=hello@launchfly.ai

# Resend (keep for sending, optional)
RESEND_API_KEY=re_xxxxxxxxx
FROM_EMAIL=hello@launchfly.ai

# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxxxxxxxx

# Background jobs
INNGEST_EVENT_KEY=xxxxx
INNGEST_SIGNING_KEY=xxxxx
```

---

## 🚀 Next Steps

1. ✅ Create SendGrid account
2. ✅ Get API key
3. ✅ Install package: `npm install @sendgrid/mail`
4. ✅ Add environment variables
5. ✅ Configure Inbound Parse in SendGrid
6. ✅ Add MX records to your domain
7. ✅ Configure Event Webhook
8. ⏳ Wait for DNS propagation (5-60 min)
9. ✅ Test with real email reply
10. ✅ Celebrate! 🎉

---

## ⏱️ Time Estimates

- Account creation: 2 minutes
- API key setup: 1 minute
- Package install: 30 seconds
- Inbound Parse config: 3 minutes
- DNS/MX records: 5 minutes
- Event webhook config: 2 minutes
- DNS propagation: 5-60 minutes (varies)
- Testing: 2 minutes

**Total active time: ~15 minutes**
**Total wait time: ~5-60 minutes (DNS)**

---

## 💎 Production-Ready!

Once set up, you'll have enterprise-grade email tracking that rivals tools like HubSpot and Salesforce - all automatically integrated into your Launchfly dashboard! 🚀



