# Twilio Pricing Strategy (Updated 2026)

## 💰 Real Costs Per Message

| Channel | Philippines (₱) | Malaysia (RM) | USD Equivalent |
|---------|-----------------|---------------|----------------|
| **WhatsApp Utility Template** | ₱0.17 | RM 0.15 | ~$0.003 |
| SMS | ₱3.25 | RM 0.18 | ~$0.057 |
| WhatsApp Marketing Template | ₱2.50 | RM 0.90 | ~$0.044 |

## 🎯 Key Insight

**WhatsApp Utility templates are 19x cheaper than SMS in the Philippines!**

This means:
- Previous strategy (SMS first) was wasting money
- New strategy: WhatsApp Template → SMS Fallback

## 📊 When to Use What

### WhatsApp UTILITY Templates (₱0.17)
Post-purchase service communications:
- ✅ Service reminders ("Your aircon is due for maintenance")
- ✅ Appointment confirmations
- ✅ Warranty status updates
- ✅ Order status updates

### WhatsApp MARKETING Templates (₱2.50)
Promotional content:
- ✅ Discounts and offers
- ✅ New service announcements
- ✅ Re-engagement campaigns
- ⚠️ Use sparingly (15x more expensive than utility!)

### SMS (₱3.25)
**Use as FALLBACK only:**
- ✅ When WhatsApp delivery fails
- ✅ For customers without WhatsApp
- ⚠️ 19x more expensive than WhatsApp Utility!

## 🔄 Waterfall Strategy (Implemented)

```
1. Try WhatsApp Utility Template (₱0.17)
   ↓ If fails
2. Try SMS (₱3.25)
   ↓ If fails
3. Mark for retry tomorrow
```

## 📁 Templates to Create in Twilio Console

### 1. Service Due Reminder (UTILITY)
**Content SID:** `TWILIO_TEMPLATE_SERVICE_DUE`
```
Hi {{1}}! Friendly reminder from {{2}}: Your {{3}} was last serviced on {{4}}. 
It's now due for maintenance to keep running efficiently. Reply YES to book a slot.
```

### 2. Service Overdue (UTILITY)
**Content SID:** `TWILIO_TEMPLATE_SERVICE_OVERDUE`
```
Hi {{1}}, your {{2}} maintenance is now overdue. 
Skipping service can lead to bigger issues. Reply YES to {{3}} to schedule now!
```

### 3. Promotional Offer (MARKETING)
**Content SID:** `TWILIO_TEMPLATE_PROMO`
```
Hi {{1}}! 🎉 Special offer from {{2}}: Book your {{3}} this week and get 10% OFF! Reply YES to claim.
```

## 🔧 Environment Variables

Add these to your `.env.local`:

```env
# Twilio Template SIDs (from Twilio Console > Messaging > Content Editor)
TWILIO_TEMPLATE_SERVICE_DUE=HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_TEMPLATE_SERVICE_OVERDUE=HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_TEMPLATE_PROMO=HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## 💵 ROI Calculation

For a typical ₱800 service job:

| Channel | Cost | ROI |
|---------|------|-----|
| WhatsApp Utility | ₱0.17 | **4,705x** |
| SMS | ₱3.25 | 246x |

**Every ₱0.17 WhatsApp reminder can bring back a ₱800 job!**

## 📋 Files Updated

1. `/src/lib/reminder-templates.ts` - New waterfall templates + correct pricing
2. `/src/app/api/cron/service-reminders/route.ts` - WhatsApp first, SMS fallback
3. `/FOREVER_CUSTOMER_ENGINE.md` - Updated pricing documentation

## ⚠️ Important Notes

1. **WhatsApp Templates must be pre-approved** in Twilio Console
2. **Template variables** must match exactly what's submitted for approval
3. **24-hour rule** still applies for session messages (free within window)
4. **Outside 24 hours** = must use pre-approved templates
