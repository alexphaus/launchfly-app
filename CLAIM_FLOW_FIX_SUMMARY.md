# Claim Flow Fix Summary

**Date:** December 12, 2025  
**Branch:** v2.1.9-polishes

## Overview

This document summarizes fixes made to the "claim funnel" flow where prospects from the Sales Prospector (`/sales`) purchase a pre-built lead magnet funnel for $97.

---

## The Problem

After a prospect paid via Stripe checkout, they were stuck on a "Building Your Business System" screen at **30% progress** and the "Go to Dashboard" button redirected to the homepage instead of their dashboard.

### Root Causes Identified

1. **Missing `session_id`** - The database record didn't have a `session_id` linking the business to a dashboard session
2. **`nanoid` import issue** - The ID generator wasn't working correctly in the API route
3. **Inngest not executing** - Events were "sent" but the `generate-lead-magnet` function never ran
4. **Missing `eventKey`** - The Inngest client at `/src/lib/inngest/client.js` was missing the `eventKey` configuration required for production

---

## Two-Phase Content Generation System

### Phase 1: Pre-Purchase (Sales Prospector)
**File:** `/src/app/api/sales/analyze/route.ts`
- Generates lightweight content when a prospect is analyzed
- Output: `lead_magnet.title`, `headline`, `subheadline`, `benefits[3]`, `preview_tips[3]`
- Cost: ~$0.03-0.05 per analysis

### Phase 2: Post-Purchase (Full Generation)
**File:** `/src/lib/inngest/functions/generate-lead-magnet.js` (Inngest)  
**File:** `/src/app/api/generate/lead-magnet/route.js` (Direct fallback)
- Generates full content after Stripe payment
- Output: Full 8-page PDF content, 5-day email sequence, enhanced landing page, conversion offer
- Cost: ~$0.15-0.25 per generation

---

## Files Modified

### 1. `/src/lib/inngest/client.js`
**Fix:** Added missing `eventKey` for production
```javascript
export const inngest = new Inngest({ 
  id: 'launchfly',
  name: 'Launchfly AI Platform',
  eventKey: process.env.INNGEST_EVENT_KEY  // <-- THIS WAS MISSING
});
```

### 2. `/src/app/api/claim/activate/route.js`
**Fixes:**
- Added custom ID generator function (replaced `nanoid`)
- Added recovery logic for missing `session_id` or content
- **Replaced Inngest with direct API call** for reliability
- Now calls `/api/generate/lead-magnet` directly instead of triggering Inngest

### 3. `/src/app/api/generate/lead-magnet/route.js` (NEW)
**Purpose:** Direct content generation endpoint that bypasses Inngest
- Uses OpenAI GPT-4-turbo directly
- Updates session progress: 35% → 85% → 100%
- Sets `maxDuration = 60` for Vercel
- Reliable fallback when Inngest fails

### 4. `/src/app/claim/[businessId]/success/ActivationStatus.js`
**Fixes:**
- Complete rewrite with 4 states: `activating` → `building` → `ready` → `error`
- Progressive UI matching manual onboarding experience
- Polls `sessions` table for progress updates
- **Added 2-minute timeout fallback** - forces `ready` state if stuck
- Fixed dashboard URL generation

### 5. `/src/app/claim/[businessId]/success/page.js`
**Fix:** Now fetches `session_id` from database and passes to `ActivationStatus`

### 6. `/src/lib/inngest/functions/generate-lead-magnet.js`
**Fixes:**
- Fixed progress updates to use `sessionId` (was incorrectly using `businessId`)
- Added extensive logging for debugging

### 7. `/src/app/api/sales/analyze/route.ts`
**Enhancement:** Added `preview_tips[3]` to pre-purchase content for better conversion

### 8. `/src/app/preview/[businessId]/page.js`
**Enhancement:** Now displays `preview_tips` on preview landing page

### 9. `/src/app/claim/[businessId]/page.js`
**Enhancement:** Shows "Sneak Peek" section with preview tips on claim page

---

## Flow After Fixes

```
1. Prospect views preview at /preview/{businessId}
   └── Shows preview_tips from Phase 1 generation

2. Prospect clicks "Claim This Funnel" → /claim/{businessId}
   └── Shows "Sneak Peek" of content + $97 CTA

3. Stripe Checkout completes
   └── Webhook at /api/webhook/stripe activates business

4. Redirect to /claim/{businessId}/success?session_id=cs_xxx
   └── ActivationStatus component:
       a. Calls POST /api/claim/activate
       b. Activate route triggers /api/generate/lead-magnet (direct, no Inngest)
       c. Polls sessions table for progress
       d. Shows "Building Your Business System" with progress bar
       e. When complete, shows "Funnel Activated!" with dashboard link

5. User clicks "Go to Dashboard" → /dashboard/{sessionId}
```

---

## Environment Variables Required

```
INNGEST_EVENT_KEY=xxx          # For Inngest (if re-enabled)
INNGEST_SIGNING_KEY=xxx        # For Inngest webhook verification
OPENAI_API_KEY=xxx             # For content generation
SUPABASE_SERVICE_KEY=xxx       # For database access
NEXT_PUBLIC_WEBSITE_BASE_URL=https://www.launchfly.ai
```

---

## Known Issues & Decisions

### Vercel Function Timeout
The `/api/generate/lead-magnet` route uses `maxDuration = 60` to allow OpenAI generation to complete. Standard Vercel free tier is 10s; this requires Pro plan.

### Polling Timeout
`ActivationStatus` has a 2-minute polling timeout. If still stuck after 120 seconds, it forces `ready` state so users aren't stuck forever.

---

## Testing

1. Create a prospect via `/sales` page
2. Go to preview link and click "Claim This Funnel"
3. Complete Stripe checkout ($97)
4. Should see "Building Your Business System" with progressing bar
5. After ~30-60s, should show "Funnel Activated!"
6. "Go to Dashboard" should link to `/dashboard/{sessionId}`

---

## Future Improvements

1. **Re-enable Inngest** once sync issues are resolved (better for background processing)
2. **Add retry logic** if direct generation fails
3. **Webhook-based completion** instead of polling (more efficient)
4. **Queue system** for high-traffic scenarios
