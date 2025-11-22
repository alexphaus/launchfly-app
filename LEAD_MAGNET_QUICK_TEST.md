# Quick Test Guide - Lead Magnet Feature

## 🚀 Quick Manual Test (5 minutes)

### Step 1: Start the Server
```bash
npm run dev
```

### Step 2: Create a Lead Magnet Business

1. Go to: `http://localhost:3000/templates`
2. Click on **"Lead Magnet Funnel" (🧲)**
3. Fill in the form:
   - **Name:** Your Name
   - **Email:** your-email@example.com
   - **Password:** test123
   - **Business Name:** (auto-filled) "Lead Magnet Funnel"
   - **Topic:** "5-Minute Morning Routines for Busy Parents"
   - **Language:** English
   - **Subdomain:** (auto-filled or customize)
4. Click **"Launch My Business"**

### Step 3: Wait for Generation (30-60 seconds)
Watch the dashboard progress through:
- Analyzing → Researching → Building → Finalizing → Complete

### Step 4: View the Generated Landing Page
Once complete, visit: `http://localhost:3000/sites/{your-subdomain}`

### ✅ What You Should See:

**CORRECT Result:**
- **Hero Section:** "Transform Your Mornings: The 5-Minute Routine That Changes Everything" (or similar topic-specific headline)
- **Subheadline:** Something about busy parents and morning routines
- **Email Capture Form:** Prominent form asking for email
- **Benefits Section:** "What You'll Learn" with 5 specific benefits about morning routines
- **No Pricing Tables:** Just the email form
- **Coach-focused design:** Clean, trustworthy, professional

**WRONG Result (if bug still exists):**
- "Efficient Lead Generation for Real Estate Agents"
- Pricing plans for a lead generation service
- Generic business about helping other businesses

### Step 5: Test Email Capture
1. Enter an email in the form
2. Click "Get Instant Access" (or similar CTA)
3. Check the email inbox (or check database)

### Step 6: Verify in Dashboard
1. Go to: `http://localhost:3000/dashboard/{sessionId}`
2. Click on **"Customers"** card
3. You should see the captured email in the activity log

## 🐛 If It's Still Wrong

If you still see "AutoGuide Genie" or generic lead generation business:

1. **Check the database:**
```javascript
// In browser console or node
const { data } = await supabase
  .from('businesses')
  .select('business_data')
  .eq('subdomain', 'your-subdomain')
  .single();

console.log('businessModel:', data.business_data.businessModel);
console.log('leadMagnet:', data.business_data.leadMagnet);
```

2. **Check the session/business status:**
```javascript
const { data } = await supabase
  .from('sessions')
  .select('*, businesses(*)')
  .eq('id', 'your-session-id')
  .single();

console.log('Session stage:', data.stage);
console.log('Business status:', data.businesses.status);
console.log('Form data:', data.businesses.form_data);
```

3. **Check Inngest logs** (if using Inngest):
   - The `analyzeOpportunity` should log: "🧲 Detected Lead Magnet template"
   - The `launchBusiness` should log: "🧲 Generating Lead Magnet Content"

## 📋 Automated Test

Run the automated test:
```bash
node test-lead-magnet-e2e.js
```

This will create a test business and verify all steps automatically.

