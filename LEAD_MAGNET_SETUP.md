# 🎯 Lead Magnet Funnel Setup - Complete Guide

## ✅ What's Been Implemented

### 1. **Lead Magnet Template Added**
- ✅ Added "Lead Magnet Funnel for Coaches" template to `/templates` page
- ✅ Added to onboarding flow (`/onboarding/quick-start`)
- ✅ Featured template with high conversion metrics

### 2. **Database & Plan Tier Fixes**
- ✅ Fixed `plan_tier` constraint error (maps 'growth' → 'pro')
- ✅ Template detection in business creation flow
- ✅ Proper businessModel assignment for lead magnets

### 3. **Landing Page Generation**
- ✅ Coach-specific landing page generator in `src/core/launch.js`
- ✅ High-converting squeeze page layout
- ✅ Email capture form integrated
- ✅ Beautiful, conversion-optimized design

### 4. **Email Capture & PDF Delivery**
- ✅ API endpoint: `/api/lead-magnet/capture`
- ✅ Automatic PDF guide generation using GPT-4o
- ✅ Email delivery with beautiful HTML template
- ✅ Email sequence scheduling (3 follow-up emails)

## 🚀 How to Use

### Step 1: Create a Lead Magnet Business

1. Go to `/templates` page
2. Click on **"Lead Magnet Funnel for Coaches"**
3. Complete onboarding:
   - Sign up / Login
   - Enter business name
   - Choose subdomain
   - Launch!

### Step 2: The System Automatically:

1. **Generates Landing Page** - High-converting squeeze page with email capture
2. **Sets Up Email Capture** - Form ready to collect emails
3. **Prepares PDF Generation** - AI system ready to create guides

### Step 3: When Someone Submits Email

The system automatically:
1. ✅ Captures email and stores in `leads` table
2. ✅ Generates personalized PDF guide using GPT-4o
3. ✅ Sends beautiful email with guide content
4. ✅ Schedules 3 follow-up emails (Day 1, Day 3, Day 7)

## 📧 Email Capture Integration

To integrate the email capture form on your landing page, add this to your Hero component:

```javascript
// In your landing page component
const handleEmailCapture = async (email, name) => {
  const response = await fetch('/api/lead-magnet/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      name,
      businessId: business.id,
      subdomain: business.subdomain
    })
  });
  
  const result = await response.json();
  if (result.success) {
    // Show success message
    alert('Check your email for your free guide!');
  }
};
```

## 🎨 Landing Page Features

The generated landing page includes:
- **Hero Section** with email capture form
- **Feature Grid** showing guide benefits
- **Testimonials** for social proof
- **Clean Design** optimized for conversions
- **Mobile Responsive** design

## 📊 Database Tables Needed

Make sure these tables exist:

```sql
-- Leads table (should already exist)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id),
  email TEXT NOT NULL,
  name TEXT,
  source TEXT,
  status TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email sequences table (for follow-up emails)
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  email_subject TEXT NOT NULL,
  email_content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔧 Configuration

### Environment Variables Required:
- `OPENAI_API_KEY` - For PDF guide generation
- `RESEND_API_KEY` - For sending emails
- `NEXT_PUBLIC_SUPABASE_URL` - Database connection
- `SUPABASE_SERVICE_KEY` - Database service key

## 🎯 Next Steps

1. **Test the Flow:**
   - Create a lead magnet business
   - Submit a test email
   - Verify PDF generation and delivery

2. **Customize Email Templates:**
   - Edit `src/app/api/lead-magnet/capture/route.js`
   - Modify the `sendLeadMagnetEmail` function
   - Adjust email sequence content

3. **Set Up Email Sequence Automation:**
   - Create Inngest function to send scheduled emails
   - Or use cron job to check `email_sequences` table

## 🐛 Troubleshooting

### Error: "plan_tier constraint violation"
- ✅ Fixed! The system now maps 'growth' → 'pro' automatically

### PDF Not Generating
- Check `OPENAI_API_KEY` is set
- Verify API quota/limits
- Check server logs for errors

### Emails Not Sending
- Verify `RESEND_API_KEY` is set
- Check Resend dashboard for delivery status
- Ensure email domain is verified in Resend

## 📈 Success Metrics

Track these metrics:
- Email capture rate (visitors → leads)
- PDF delivery success rate
- Email open rates (follow-up sequence)
- Conversion rate (leads → customers)

---

**Ready to launch your lead magnet funnel?** 🚀

Go to `/templates` and select "Lead Magnet Funnel for Coaches"!

