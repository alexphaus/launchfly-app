# 🚀 SendGrid Inbound Setup - 5 Minute Guide

## ✅ What You'll Get
- Full email reply tracking
- Real-time conversation updates
- Automatic status progression (Contacted → Engaged → Converted)

---

## 📝 Step-by-Step (15 minutes)

### **Step 1: Create SendGrid Account** (2 min)

1. Go to: [https://signup.sendgrid.com](https://signup.sendgrid.com)
2. Sign up (free tier: 100 emails/day forever)
3. Verify your email
4. Complete the setup wizard

---

### **Step 2: Get API Key** (1 min)

1. Once logged in, go to: [https://app.sendgrid.com/settings/api_keys](https://app.sendgrid.com/settings/api_keys)
2. Click **"Create API Key"**
3. Name: `Launchfly`
4. Permissions: Select **"Full Access"**
5. Click **"Create & View"**
6. **COPY THE KEY** (starts with `SG.`) - you won't see it again!

---

### **Step 3: Add to Your .env.local** (30 sec)

Open `.env.local` and add these lines:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.paste_your_key_here
SENDGRID_FROM_EMAIL=hello@launchfly.ai
```

Save the file.

---

### **Step 4: Verify Setup** (30 sec)

Run this command:

```bash
node setup-sendgrid-quick.js
```

You should see:
```
✅ SENDGRID BASIC SETUP COMPLETE!
```

---

### **Step 5: Configure Event Webhook** (3 min)

This tracks opens and clicks:

1. Go to: [https://app.sendgrid.com/settings/mail_settings](https://app.sendgrid.com/settings/mail_settings)
2. Find **"Event Webhook"**
3. Click **"Create new webhook"** (or edit existing)
4. **HTTP Post URL:** 
   ```
   https://launchfly.ai/api/webhook/sendgrid
   ```
   (Or your ngrok URL for testing: `https://d4953b897226.ngrok-free.app/api/webhook/sendgrid`)

5. **Select Events:**
   - ✅ Delivered
   - ✅ Opened
   - ✅ Clicked
   - ✅ Bounced
   - ✅ Dropped
   - ✅ Spam Report

6. **Actions to track:** All
7. Click **"Save"**
8. **Enable** the webhook (toggle to ON)

---

### **Step 6: Configure Inbound Parse (For Replies)** (5 min)

This is the key part for tracking replies!

1. Go to: [https://app.sendgrid.com/settings/parse](https://app.sendgrid.com/settings/parse)
2. Click **"Add Host & URL"**

#### **Option A: Use Subdomain (Recommended)**

**If you don't want to change main domain MX records:**

- **Subdomain:** `replies` (will create replies.launchfly.ai)
- **Domain:** `launchfly.ai`
- **URL:** `https://launchfly.ai/api/webhook/sendgrid-inbound`
- **Check spam:** ✅ Yes
- Click **"Add"**

SendGrid will show you MX records like:
```
Type: MX
Host: replies
Value: mx.sendgrid.net
Priority: 10
```

#### **Option B: Use Main Domain**

**If you have full domain control:**

- **Host:** (leave empty or use @)
- **Domain:** `launchfly.ai`
- **URL:** `https://launchfly.ai/api/webhook/sendgrid-inbound`

---

### **Step 7: Add MX Records to Your Domain** (3 min)

**Where is launchfly.ai hosted?**
- Cloudflare? Go to DNS settings
- GoDaddy? Go to DNS Management
- Namecheap? Go to Advanced DNS
- Vercel? Go to Domain settings

**Add this MX record:**
```
Type: MX
Name: replies (or @ for main domain)
Value: mx.sendgrid.net
Priority: 10
TTL: Auto or 300
```

**Example for Cloudflare:**
```
DNS → Add Record
Type: MX
Name: replies
Mail server: mx.sendgrid.net
Priority: 10
```

Click **Save**

⏱️ **Wait 5-60 minutes for DNS propagation**

---

### **Step 8: Update FROM_EMAIL** (1 min)

In `.env.local`, update:

```env
# Use the email address that matches your Inbound Parse setup
SENDGRID_FROM_EMAIL=replies@launchfly.ai

# Or if you used main domain:
SENDGRID_FROM_EMAIL=hello@launchfly.ai
```

This email must match the domain you configured in Inbound Parse!

---

### **Step 9: Test It!** (2 min)

```bash
# Send a test email
node test-real-email-tracking.js

# Check your Gmail for the email
# Reply to it
# Wait 10-30 seconds
# Refresh dashboard
# See "💬 Replied: [your message]" appear!
```

---

## 🎯 **Quick Checklist**

- [ ] Created SendGrid account
- [ ] Got API key (starts with `SG.`)
- [ ] Added to `.env.local`:
  - `SENDGRID_API_KEY=SG.xxxxx`
  - `SENDGRID_FROM_EMAIL=replies@launchfly.ai`
- [ ] Ran: `node setup-sendgrid-quick.js` (should show ✅)
- [ ] Configured Event Webhook in SendGrid
- [ ] Configured Inbound Parse in SendGrid
- [ ] Added MX record to domain DNS
- [ ] Waited for DNS propagation (5-60 min)
- [ ] Tested email reply tracking
- [ ] Saw reply appear in dashboard 🎉

---

## 🆘 **Need Help?**

### **Don't have access to launchfly.ai DNS?**

Use a subdomain like `replies.launchfly.ai` - you only need to add one MX record and it won't affect your main domain!

### **Testing without DNS setup?**

You can still test opens and clicks immediately! Reply tracking just needs to wait for DNS.

### **Stuck on a step?**

Check the full guide: `SENDGRID_SETUP_GUIDE.md`

---

## ⚡ **Testing Without Waiting for DNS**

While DNS propagates, you can test:

1. **Email Opens** - Works immediately ✅
2. **Email Clicks** - Works immediately ✅
3. **Email Bounces** - Works immediately ✅

**Email Replies** - Needs MX records (wait 5-60 min) ⏱️

---

## 🎉 **After Setup**

Your customer card will show COMPLETE customer journey:

```
Alex
axpg31@gmail.com
🔥 Hot Lead

Activity History:
📧 Sent cold email              2 days ago
📬 Email opened                 1 day ago
🖱️ Clicked pricing link        12 hours ago
💬 Replied: "Interested!"       6 hours ago
💰 Purchased Pro Plan           Just now
```

**All automatic. All real-time. Production-ready!** 🚀

---

**Start with Step 1 and work your way down. You'll be tracking replies in 15 minutes!**



