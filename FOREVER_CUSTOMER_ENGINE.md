# 🔄 Forever Customer Engine - Implementation Plan

## Strategic Pivot Summary

**From:** Reactive Booking Bot (replying to new inquiries)  
**To:** Proactive Retention Engine (maximizing lifetime value from existing customers)

### The Blue Ocean Opportunity
Most independent technicians treat every job as a one-off transaction, leaving massive revenue on the table because they forget to follow up. This system turns single jobs into **guaranteed 6-month recurring contracts**.

---

## 🎯 Core Value Proposition

**For the Technician:**
> "Stop chasing strangers. Start earning automatic repeat income."
> *Our system automatically texts your past clients when they are due for service, filling your schedule with zero effort.*

**For the Customer:**
> "Never worry about your home appliances again."
> *Book once, and we'll remind you exactly when maintenance is due.*

---

## 📋 The MVP Loop: "Warranty Register → 6-Month Reminder → 1-Tap Booking"

### Flow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  AFTER SERVICE: Tech sticks QR on appliance                        │
│                                                                     │
│  Customer scans → "Activate 30-Day Warranty"                        │
│        ↓                                                            │
│  Bot captures: Name, Phone, Address, Service Type, Date (auto)      │
│        ↓                                                            │
│  System schedules reminder (5-6 months)                             │
│        ↓                                                            │
│  SMS Reminder: "It's time for cleaning! Reply Hi to book"           │
│        ↓                                                            │
│  Customer re-initiates WhatsApp → Book with 1 tap                   │
│        ↓                                                            │
│  Tech gets notified → REPEAT REVENUE ✅                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Why SMS for Reminders (not WhatsApp)?

WhatsApp Marketing templates cost ₱1-4 / RM 0.20-0.50 per message sent outside 24h window. 

**MVP Approach:**
1. Send reminder via **SMS** (cheaper, no opt-in required)
2. SMS says: "Hi [Name]! Your aircon is due for cleaning. Reply 'Hi' on WhatsApp to book: wa.me/13203627874"
3. Customer initiates WhatsApp → Now we're in free 24h window → Book easily

**Upgrade Path:** Once paying customers, add full WhatsApp template reminders.

---

## 🗄️ Database Schema Changes

### 1. New Table: `service_records` (Warranty/Service History)

```sql
CREATE TABLE public.service_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  
  -- Service Details
  service_type text NOT NULL, -- 'cleaning', 'repair', 'installation'
  service_name text, -- 'Aircon General Cleaning', 'AC Not Cooling Fix'
  appliance_type text, -- 'aircon', 'washing_machine', 'water_heater'
  units_serviced integer DEFAULT 1,
  
  -- Pricing
  amount numeric,
  currency text DEFAULT 'RM',
  
  -- Location (for clustering jobs)
  address text,
  building_name text, -- For condo clustering
  
  -- Warranty Info
  warranty_days integer DEFAULT 30,
  warranty_expires_at timestamp with time zone,
  
  -- Reminder Scheduling
  next_service_due_at timestamp with time zone, -- Auto-set to service_date + 6 months
  reminder_sent boolean DEFAULT false,
  reminder_sent_at timestamp with time zone,
  
  -- Booking Loop
  rebooking_initiated boolean DEFAULT false,
  rebooked_at timestamp with time zone,
  rebooked_service_id uuid, -- Links to the new service record
  
  -- Meta
  registered_via text DEFAULT 'sticker_scan', -- 'sticker_scan', 'manual', 'import'
  service_date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT service_records_pkey PRIMARY KEY (id),
  CONSTRAINT service_records_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT service_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

-- Indexes for cron job efficiency
CREATE INDEX service_records_next_due_idx ON public.service_records(next_service_due_at) WHERE reminder_sent = false;
CREATE INDEX service_records_business_idx ON public.service_records(business_id);
CREATE INDEX service_records_customer_idx ON public.service_records(customer_id);
```

### 2. Update `customers` Table

```sql
-- Add retention-related fields
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS
  service_count integer DEFAULT 0,
  last_service_date timestamp with time zone,
  next_reminder_due timestamp with time zone,
  reminder_preference text DEFAULT 'sms', -- 'sms', 'whatsapp', 'both'
  building_name text, -- For neighbor clustering
  is_repeat_customer boolean DEFAULT false;
```

### 3. New Table: `service_reminders` (Reminder Queue)

```sql
CREATE TABLE public.service_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_record_id uuid NOT NULL,
  business_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  
  -- Scheduling
  scheduled_for timestamp with time zone NOT NULL,
  reminder_type text NOT NULL, -- 'due_soon', 'overdue', 'warranty_expiring'
  
  -- Delivery
  channel text DEFAULT 'sms', -- 'sms', 'whatsapp_template'
  status text DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'clicked', 'booked'
  sent_at timestamp with time zone,
  clicked_at timestamp with time zone,
  booked_at timestamp with time zone,
  
  -- Message
  message_template text,
  message_sent text,
  
  -- Cost Tracking
  cost numeric DEFAULT 0,
  
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT service_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT service_reminders_service_record_fkey FOREIGN KEY (service_record_id) REFERENCES public.service_records(id),
  CONSTRAINT service_reminders_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT service_reminders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

CREATE INDEX service_reminders_scheduled_idx ON public.service_reminders(scheduled_for) WHERE status = 'pending';
```

---

## 🔧 Implementation Phases

### Phase 1: Warranty Registration Flow (Week 1-2)

**Goal:** Enable "Tech scans sticker to register warranty" - zero data entry

#### 1.1 New QR Mode: Tech Registration Scan

When tech scans the sticker themselves (not customer):
- Link: `wa.me/13203627874?text=REGISTER_SERVICE [BIZ:uuid]`
- Bot asks: "Registering completed service. Customer phone number?"
- Tech replies with customer phone
- Bot: "Service logged! Warranty activated until [date]. Customer will get auto-reminder in 5 months."

#### 1.2 Customer Warranty Scan Mode

When customer scans sticker:
- Bot recognizes [BIZ:id] 
- **IF returning customer:** "Welcome back Sarah! 👋 Need service again?"
- **IF new customer:** "Scan to activate your 30-Day Warranty! Please share your name."

#### 1.3 Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/warranty-flow.ts` | CREATE | Warranty registration templates & logic |
| `src/app/api/service-records/route.ts` | CREATE | CRUD for service records |
| `src/app/api/webhook/twilio/route.ts` | MODIFY | Add WARRANTY_REGISTER intent handler |
| `src/lib/ai-intent.ts` | MODIFY | Add REGISTER_SERVICE pattern |
| `db/migrations/20260121_service_records.sql` | CREATE | Database migration |

### Phase 2: Smart Nag Cron Job (Week 2-3)

**Goal:** Auto-send SMS reminders at 5 months, nudging customers to WhatsApp

#### 2.1 Cron Job: `/api/cron/service-reminders`

Runs daily at 9 AM (SEA timezone):

```typescript
// Pseudocode
1. Find service_records WHERE next_service_due_at <= NOW() + 7 days AND reminder_sent = false
2. For each record:
   a. Get customer phone
   b. Send SMS: "Hi {name}! Your {appliance} is due for cleaning. Book now: wa.me/13203627874?text=BOOK_{serviceId}"
   c. Mark reminder_sent = true
   d. Log to service_reminders table
```

#### 2.2 Cost Reality (Updated 2026)

| Channel | Philippines | Malaysia | Recommendation |
|---------|-------------|----------|----------------|
| **WhatsApp Utility** | ₱0.17 | RM 0.15 | **PRIMARY!** |
| SMS | ₱3.25 | RM 0.18 | Fallback only |
| WhatsApp Marketing | ₱2.50 | RM 0.90 | Promos only |

**IMPORTANT:** WhatsApp Utility templates are **19x cheaper** than SMS in the Philippines!

**Strategy:** WhatsApp Template first → SMS fallback if WA fails

**ROI Pitch to Tech:** "This reminder costs ₱0.17. It brings you a ₱1,500 cleaning job. That's 8,800x ROI!"

#### 2.3 Files to Create

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/cron/service-reminders/route.ts` | CREATE | Main cron handler |
| `src/lib/reminder-templates.ts` | CREATE | SMS message templates |
| `vercel.json` | MODIFY | Add cron schedule |

### Phase 3: Returning Customer Recognition (Week 3-4)

**Goal:** Bot recognizes repeat customers and personalizes experience

#### 3.1 Customer Lookup Enhancement

In Twilio webhook, after getting customer phone:

```typescript
// Check if returning customer
const { data: serviceHistory } = await supabase
  .from('service_records')
  .select('*, customers(name)')
  .eq('customer_id', customer.id)
  .order('service_date', { ascending: false });

if (serviceHistory?.length > 0) {
  // RETURNING CUSTOMER PATH
  const lastService = serviceHistory[0];
  sendMessage(`Welcome back ${customer.name}! 👋
  
I see your last ${lastService.service_name} was on ${formatDate(lastService.service_date)}.

How can I help today?
1️⃣ Book Another Cleaning
2️⃣ Report an Issue
3️⃣ View My Service History`);
} else {
  // NEW CUSTOMER PATH (existing flow)
}
```

#### 3.2 Service History View

Add "View Service History" option showing:
- Past services with dates
- Warranty status
- Next due date

### Phase 4: Refer-a-Neighbor (Week 4+, Optional)

**Goal:** Viral loop for condo/subdivision clustering

#### 4.1 Post-Service Referral Flow

24 hours after booking:
```
SMS: "Thanks for choosing {business}! Share this voucher with your neighbor:

🎁 10% off for both of you when booked on the same day!
Share: {referral_link}"
```

#### 4.2 Implementation

- Generate unique referral codes per customer
- Track referrals in `referrals` table
- Apply discount on checkout

---

## 📱 WhatsApp Message Templates to Register

### Template 1: Service Reminder (Utility)
```
Name: service_reminder_due
Category: Utility
Body: Hi {{1}}! Your {{2}} is due for {{3}} to stay efficient. Book your next visit: {{4}}
Variables: name, appliance_type, service_type, booking_link
```

### Template 2: Warranty Expiring (Utility)
```
Name: warranty_expiring
Category: Utility
Body: Reminder: Your {{1}} service warranty expires on {{2}}. Questions? Reply here!
Variables: service_type, expiry_date
```

---

## 🎯 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Service Records Created/Month | 100+ | Count of warranty scans |
| Reminder SMS Sent | 80% of due services | Cron job logs |
| Rebooking Rate | 30%+ | Clicked reminder → Booked |
| Revenue per Customer | +50% YoY | LTV calculation |
| Tech Retention | 90% | Monthly active users |

---

## 💬 New Sales Pitch Script

**Forget "Auto-reply". Sell "Future Cash Flow":**

> "Boss, the problem isn't getting new customers. The problem is **remembering** the old ones.
> 
> You clean an AC today. 6 months later, it gets dirty.
> 
> **The problem:** You forget to call them. They forget to call you. They scroll Facebook and hire a *competitor*. 😡
> 
> **My System (The Revenue Repeater):**
> 1. You put this Sticker on the unit
> 2. My system counts 6 months automatically
> 3. On exactly Month 6, it messages the customer: *'Hi Ma'am, time for cleaning. Reply YES to book.'*
> 
> It fills your schedule automatically with **Repeat Customers** so you don't have to hunt for strangers.
> 
> Want to turn your one-time customers into 'Forever Customers'?"

---

## 🚀 Immediate Next Steps

1. **Run Database Migration** - Create `service_records` and `service_reminders` tables
2. **Build Warranty Registration Flow** - Tech scan → Customer phone → Warranty activated
3. **Deploy Service Reminder Cron** - Daily 9 AM SMS job
4. **Test E2E Loop** - Simulate 6-month cycle with test date
5. **Update QR Sticker Copy** - "Scan to Activate Warranty" instead of "Scan to Book"

---

## 📁 Files to Create

```
src/
├── lib/
│   ├── warranty-flow.ts          # Warranty registration templates
│   ├── reminder-templates.ts     # SMS reminder message templates
│   └── customer-lifecycle.ts     # LTV calculations, history lookup
├── app/api/
│   ├── service-records/
│   │   └── route.ts              # CRUD for service records
│   ├── cron/
│   │   └── service-reminders/
│   │       └── route.ts          # Daily reminder cron job
│   └── customer/
│       └── history/
│           └── route.ts          # Get customer service history
└── components/
    └── TechDashboard/
        └── ServiceHistory.js     # View for tech to see client history

db/migrations/
└── 20260121_forever_customer.sql # Database schema changes
```

---

*Document created: January 21, 2026*
*Based on: Blue Ocean Strategy Analysis for MY/PH Technician Market*
