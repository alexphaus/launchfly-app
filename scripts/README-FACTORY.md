# 🏭 Client Asset Factory - Quick Start Guide

## What This Does

This script lets you generate high-value lead magnets, guides, and content for your **$297 "24-Hour Lead Magnet Funnel"** service.

**You can create $500+ value content in 30 seconds.**

---

## Setup

1. **Make sure you have Node.js installed**
   ```bash
   node --version
   ```

2. **Set your OpenAI API key**
   ```bash
   export OPENAI_API_KEY=your-key-here
   ```
   
   Or add to your `.env` file:
   ```
   OPENAI_API_KEY=your-key-here
   ```

3. **Install dependencies** (if not already installed)
   ```bash
   npm install
   ```

---

## Usage

### Basic Command

```bash
node scripts/generate-client-asset.js --type <type> --topic "<topic>" [--niche <niche>] [--client "<name>"]
```

### Types Available

1. **`expert-guide`** - Perfect for Lead Magnets (15-25 pages)
2. **`action-plan`** - Perfect for Roadmaps (12-week plans)
3. **`business-audit`** - Perfect for Consultants (diagnostic reports)
4. **`personalized-routine`** - Perfect for Wellness/Fitness (custom routines)

---

## Examples

### Example 1: Lead Magnet for Fitness Coach

```bash
node scripts/generate-client-asset.js \
  --type expert-guide \
  --topic "Weight Loss for Busy Moms" \
  --niche fitness \
  --client "Sarah's Fitness Coaching"
```

**Output:** A 15-25 page guide about weight loss for busy moms, perfect for a lead magnet.

---

### Example 2: Action Plan for Business Coach

```bash
node scripts/generate-client-asset.js \
  --type action-plan \
  --topic "Starting a 6-Figure Coaching Business" \
  --niche business \
  --client "Mike's Business Coaching"
```

**Output:** A 12-week strategic action plan for starting a coaching business.

---

### Example 3: Business Audit for Consultant

```bash
node scripts/generate-client-asset.js \
  --type business-audit \
  --topic "Marketing Strategy Audit" \
  --niche marketing \
  --client "ABC Consulting"
```

**Output:** A comprehensive business audit report worth $1000+.

---

### Example 4: Personalized Routine for Wellness Coach

```bash
node scripts/generate-client-asset.js \
  --type personalized-routine \
  --topic "Morning Energy Routine" \
  --niche wellness \
  --client "Wellness with Jane"
```

**Output:** A personalized daily routine for morning energy.

---

## Output

Content is saved to `scripts/output/[type]-[timestamp].md`

**Example:** `scripts/output/expert-guide-2025-01-15T10-30-00.md`

---

## Workflow for $297 Funnel Service

### Step 1: Generate the Lead Magnet

```bash
node scripts/generate-client-asset.js \
  --type expert-guide \
  --topic "Weight Loss for Dads" \
  --niche fitness \
  --client "Fitness Coach John"
```

**Time:** 30 seconds  
**Cost:** ~$0.10 (OpenAI API)

---

### Step 2: Format & Polish

1. Open the generated `.md` file
2. Copy content to Google Docs or Canva
3. Add branding, images, formatting
4. Export as PDF

**Time:** 30 minutes  
**Cost:** $0 (free tools)

---

### Step 3: Generate Landing Page

Use Launchfly dashboard to create a landing page:
1. Go to Launchfly dashboard
2. Click "Launch Business"
3. Enter client details
4. Select "Lead Magnet" template
5. Customize with their brand colors
6. Publish

**Time:** 5 minutes  
**Cost:** $0 (your platform)

---

### Step 4: Deliver to Client

1. Send PDF via email
2. Send landing page link
3. Include setup instructions
4. Ask for testimonial

**Time:** 10 minutes  
**Total Time:** ~45 minutes  
**Total Cost:** ~$0.10  
**Revenue:** $297  
**Profit:** $296.90 ✅

---

## Pricing Your Service

### Beta Pricing (Week 1-2)

**$150** - "I'm testing this, need a case study"

**Why:** Lower barrier, easier to get first clients

---

### Regular Pricing (Week 3+)

**$297** - "24-Hour Lead Magnet Funnel"

**Includes:**
- ✅ Custom 15-25 page guide (worth $500+)
- ✅ High-converting landing page
- ✅ Email capture form
- ✅ Delivery in 24 hours
- ✅ 1 round of revisions

---

### Premium Pricing (Month 2+)

**$497** - "Complete Lead Magnet System"

**Includes:**
- ✅ Everything in $297 package
- ✅ Email nurture sequence (5 emails)
- ✅ Social media graphics
- ✅ Setup in their email provider
- ✅ Analytics dashboard

---

## Cost Analysis

**Per Client:**
- OpenAI API: ~$0.10-0.50 (depending on length)
- Your time: 45 minutes
- Total cost: ~$0.50

**Revenue:** $297  
**Profit:** $296.50  
**Profit Margin:** 99.8% ✅

---

## Scaling Tips

### Week 1-2: Manual (5 clients)

- Generate content manually
- Format manually
- Create landing pages manually
- **Goal:** $1,485 revenue

---

### Week 3-4: Semi-Automated (10 clients)

- Use script for content generation
- Template for formatting
- Faster landing page creation
- **Goal:** $2,970 revenue

---

### Month 2+: Fully Automated (20+ clients)

- Automated content generation
- Template-based formatting
- Automated landing page creation
- Hire VA for polish
- **Goal:** $5,940+ revenue

---

## Pro Tips

1. **Save Templates:** Keep successful guides as templates
2. **Batch Work:** Generate multiple guides at once
3. **Reuse Content:** Adapt successful guides for similar niches
4. **Upsell:** Offer email sequences, social graphics, etc.
5. **Testimonials:** Get testimonials from every client

---

## Troubleshooting

### Error: OPENAI_API_KEY not set

```bash
export OPENAI_API_KEY=your-key-here
```

### Error: Module not found

```bash
npm install
```

### Content too short?

Increase `max_tokens` in the script (default: 4000)

### Content not good enough?

- Try `gpt-4` instead of `gpt-4o-mini` (more expensive but better quality)
- Add more specific instructions in the prompt
- Provide examples of what you want

---

## Next Steps

1. ✅ Test the script with a sample topic
2. ✅ Create your first portfolio example
3. ✅ Start outreach to coaches
4. ✅ Get your first client
5. ✅ Deliver and get testimonial
6. ✅ Scale!

---

**Ready to make $297 per client? Let's go!** 🚀

