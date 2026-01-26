# Twilio WhatsApp Template Setup Guide

## 📍 Where to Create Templates

1. Go to **Twilio Console** → https://console.twilio.com
2. Navigate to **Messaging** → **Content Editor**
3. Click **Create new content**

---

## Template 1: Service Due Reminder

### Basic Info
| Field | Value |
|-------|-------|
| **Content Name** | `service_due_reminder` |
| **Language** | English (en) |
| **Category** | `UTILITY` ⚠️ Important! |

### Content Body
```
Hi {{1}}! 👋

Friendly reminder from *{{2}}*: Your {{3}} was last serviced on {{4}}.

It's now due for maintenance to keep running efficiently.

Reply *YES* to book a slot.
```

### Variables
| Variable | Sample Value | Description |
|----------|--------------|-------------|
| `{{1}}` | `Juan` | Customer name |
| `{{2}}` | `CoolTech Aircon Services` | Business name |
| `{{3}}` | `aircon` | Appliance type |
| `{{4}}` | `26 Jul` | Last service date |

### After Approval
Add to `.env.local`:
```env
TWILIO_TEMPLATE_SERVICE_DUE=HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## Template 2: Service Overdue

### Basic Info
| Field | Value |
|-------|-------|
| **Content Name** | `service_overdue_reminder` |
| **Language** | English (en) |
| **Category** | `UTILITY` ⚠️ Important! |

### Content Body
```
Hi {{1}}, this is *{{2}}*. ⚠️

Your {{3}} is *{{4}} days past* its recommended service date.

Skipping maintenance can lead to:
• Higher electricity bills
• Unexpected breakdowns
• Costly repairs

Reply *YES* to check available slots.
```

### Variables
| Variable | Sample Value | Description |
|----------|--------------|-------------|
| `{{1}}` | `Maria` | Customer name |
| `{{2}}` | `CoolTech Aircon Services` | Business name |
| `{{3}}` | `aircon` | Appliance type |
| `{{4}}` | `14` | Days overdue |

### After Approval
Add to `.env.local`:
```env
TWILIO_TEMPLATE_SERVICE_OVERDUE=HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## Template 3: Promotional Offer (Optional)

### Basic Info
| Field | Value |
|-------|-------|
| **Content Name** | `promo_offer` |
| **Language** | English (en) |
| **Category** | `MARKETING` ⚠️ More expensive! |

### Content Body
```
Hi {{1}}! 🎉

Special offer from *{{2}}*:

Book your {{3}} service this week and get *10% OFF*!

Limited slots available. Reply *YES* to claim your discount.
```

### Variables
| Variable | Sample Value | Description |
|----------|--------------|-------------|
| `{{1}}` | `Juan` | Customer name |
| `{{2}}` | `CoolTech Aircon Services` | Business name |
| `{{3}}` | `aircon` | Service type |

### After Approval
Add to `.env.local`:
```env
TWILIO_TEMPLATE_PROMO=HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 📋 Submission Tips for Faster Approval

### ✅ DO
- Use `UTILITY` category for reminders (cheaper + faster approval)
- Mention it's a post-purchase follow-up
- Include sample values that match your use case
- Keep messages under 1024 characters

### ❌ DON'T
- Include URLs in UTILITY templates
- Use aggressive marketing language in UTILITY
- Include pricing/discounts in UTILITY (use MARKETING)

---

## 🎯 Sample Submission for "Service Due Reminder"

When Twilio asks for **use case description**, paste this:

> **Use Case:** Post-service maintenance reminder
> 
> **Context:** After we service a customer's appliance (aircon, washing machine, etc.), we register their warranty and schedule future maintenance reminders. This template is sent when their service is due (typically 6 months after the last service).
> 
> **Why UTILITY:** This is a post-purchase service update for customers who have an existing service relationship with the business. It's not promotional - it's a scheduled maintenance reminder based on their service history.
> 
> **Sample Message:**
> Hi Juan! 👋
> Friendly reminder from CoolTech Aircon Services: Your aircon was last serviced on 26 Jul. It's now due for maintenance to keep running efficiently.
> Reply YES to book a slot.

---

## 📱 Testing After Approval

Once templates are approved, test with:

```bash
# In your project directory
node -e "
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

client.messages.create({
  contentSid: 'HXXXXXXXXXX', // Your template SID
  contentVariables: JSON.stringify({
    '1': 'Test User',
    '2': 'Test Business',
    '3': 'aircon',
    '4': '26 Jul'
  }),
  from: 'whatsapp:+13203627874',
  to: 'whatsapp:+639XXXXXXXXX' // Your test number
}).then(msg => console.log('Sent:', msg.sid));
"
```

---

## ⏱️ Approval Timeline

| Category | Typical Approval Time |
|----------|----------------------|
| UTILITY | 24-48 hours |
| MARKETING | 3-7 days (more scrutiny) |

---

## 💰 Cost Comparison

| Template Category | Philippines | Malaysia |
|-------------------|-------------|----------|
| **UTILITY** | ₱0.17 | RM 0.15 |
| **MARKETING** | ₱2.50 | RM 0.90 |
| SMS (fallback) | ₱3.25 | RM 0.18 |

**UTILITY is 19x cheaper than SMS!** Always prefer UTILITY when possible.
