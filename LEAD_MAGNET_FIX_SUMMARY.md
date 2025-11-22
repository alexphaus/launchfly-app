# Lead Magnet Implementation - Root Cause Fix

## Problem Identified
The system was generating a "Lead Generation Service" business (like AutoGuide Genie) instead of a coach's direct landing page for their specific topic.

## Root Causes

### 1. **analyze.js Not Checking Template**
**File:** `src/core/analyze.js`
**Issue:** The `analyzeOpportunity` function wasn't extracting `template`, `leadMagnetTopic`, or `leadMagnetLanguage` from userData.
**Fix:** Added special handling for `template === 'lead-magnet'` to force `businessModel: 'lead_magnet'` and pass through the topic/language.

### 2. **Missing Lead Magnet Generation in Core Flow**
**File:** `src/core/launch.js`
**Issue:** The lead magnet content generation was only triggered as fire-and-forget from `wizard/submit`, not integrated into the main Inngest flow.
**Fix:** Added `generateLeadMagnetContent()` function inline and called it during `launchBusiness()` when `opportunity.businessModel === 'lead_magnet'`.

### 3. **Products Not Tailored for Lead Magnets**
**File:** `src/core/launch.js` - `createProducts()`
**Issue:** Lead magnet businesses were getting generic service packages.
**Fix:** Added special case to return coach-appropriate upsells (Free Guide, Coaching Call, Done-For-You).

## Changes Made

### src/core/analyze.js
```javascript
// Now extracts template fields
const { name, skills, businessType, goal, preferences, template, leadMagnetTopic, leadMagnetLanguage } = userData;

// Special prompt for lead magnets
if (template === 'lead-magnet' && leadMagnetTopic) {
  // Returns opportunity with:
  // - businessModel: 'lead_magnet'
  // - leadMagnet: { topic, language }
}
```

### src/core/launch.js
```javascript
// Added inline generation function
async function generateLeadMagnetContent(topic, niche, language) {
  // Generates landing_page, lead_magnet, and email content
}

// In launchBusiness():
if (opportunity.businessModel === 'lead_magnet' && opportunity.leadMagnet) {
  const leadMagnetData = await generateLeadMagnetContent(...);
  businessData.leadMagnet = leadMagnetData;
}

// In createProducts():
if (isLeadMagnet) {
  return [
    { name: 'Free Guide', price: '$0', ... },
    { name: '1-on-1 Coaching', price: '$197', ... },
    { name: 'Done-For-You', price: '$497', ... }
  ];
}
```

### src/app/sites/[subdomain]/page.js
Already had the correct logic to check for `businessData.leadMagnet` and render the coach-specific layout.

## Testing

Run the end-to-end test:
```bash
# Ensure server is running
npm run dev

# In another terminal
node test-lead-magnet-e2e.js
```

This will:
1. Create a business with template='lead-magnet'
2. Wait for generation to complete
3. Verify leadMagnet content exists
4. Test email capture
5. Verify customer and activity records

## Expected Result

When you create a lead magnet business with topic "Time Management for Busy Entrepreneurs", you should now get:

**Landing Page:**
- Clean, coach-focused design
- Hero with topic-specific headline
- "What You'll Learn" benefits section
- Email capture form
- Testimonials about the guide
- No pricing tables or service offerings (just the capture form)

**Generated Content:**
- `leadMagnet.landing_page.hero_headline`: Topic-specific headline
- `leadMagnet.landing_page.benefits`: 5 key benefits
- `leadMagnet.lead_magnet.content`: 5 chapters of guide content
- `leadMagnet.email`: Email template for delivery

## Manual Testing Steps

1. Go to `/templates`
2. Click "Lead Magnet Funnel" (🧲)
3. Fill in:
   - Email/Password
   - Business Name: "Productivity Coach Pro"
   - Topic: "Time Management for Busy Entrepreneurs"
   - Language: English
4. Submit and wait for generation
5. Visit the generated site at `{subdomain}.launchfly.com`
6. You should see a coach-specific landing page about Time Management
7. Enter an email to test capture
8. Check the Customers card in dashboard for the new lead

## Key Differences Now

**BEFORE (Wrong):**
- Generated "AutoGuide Genie" - a lead generation service
- Landing page about "lead generation for real estate agents"
- Pricing plans for the service

**AFTER (Correct):**
- Generates "Productivity Coach Pro" - the coach's business
- Landing page about "Time Management for Busy Entrepreneurs"
- Email capture form to get the free guide
- No pricing (just upsells in products array for future use)

