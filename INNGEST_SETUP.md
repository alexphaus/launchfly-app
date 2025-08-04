# Inngest Setup Guide for Launchfly

## Overview

Inngest has been integrated into Launchfly to provide robust AI orchestration for:
- Business generation with real-time stage updates
- Automated cold email outreach campaigns
- Growth strategy execution and experimentation
- Background job processing with retries and error handling

## Architecture

### 1. **Client Configuration** (`src/lib/inngest/client.js`)
- Centralized Inngest client instance
- Typed event constants for consistency

### 2. **Core Functions**

#### Business Generation (`generate-business.js`)
- Orchestrates the entire business creation process
- Updates session stages in real-time (analyzing → researching → building → finalizing → complete)
- Triggers growth campaigns automatically after completion
- Includes error handling and graceful failure

#### Cold Email Outreach (`cold-outreach.js`)
- Generates targeted prospect lists
- Creates personalized email templates with A/B testing
- Sends emails in batches with rate limiting
- Tracks campaign metrics
- Schedules follow-up sequences

#### Growth Engine (`growth-engine.js`)
- Orchestrates all growth strategies
- Runs experiments and tracks results
- Triggers specific campaigns based on business type
- Schedules recurring growth campaigns

### 3. **API Integration**
- `/api/inngest` - Inngest webhook handler
- `/api/generate-business` - Modified to trigger Inngest events

## Setup Instructions

### 1. Environment Variables
Add these to your `.env.local`:
```env
INNGEST_EVENT_KEY=your_event_key_here
INNGEST_SIGNING_KEY=your_signing_key_here
```

### 2. Database Schema
Run the SQL in `src/lib/inngest/schema.sql` to create required tables:
- `outreach_campaigns` - Tracks email campaigns
- `growth_sessions` - Monitors growth campaigns
- `growth_experiments` - Stores experiment results

### 3. Local Development
```bash
# Start your Next.js app
npm run dev

# In another terminal, start Inngest Dev Server
npx inngest-cli@latest dev
```

Visit http://localhost:8288 to see the Inngest Dev UI.

## Usage

### Triggering Business Generation
The existing dashboard flow works unchanged. When a user starts generation:
1. Dashboard calls `/api/generate-business`
2. API sends an Inngest event
3. Inngest function handles the async processing
4. Dashboard polls for updates as before

### Manual Event Triggers
```javascript
import { inngest, EVENTS } from '@/lib/inngest/client';

// Trigger cold outreach
await inngest.send({
  name: EVENTS.COLD_OUTREACH_REQUESTED,
  data: {
    businessId: 'uuid',
    businessData: {...},
    targetAudience: 'Small business owners',
    campaignGoal: 'Generate leads'
  }
});

// Trigger growth campaign
await inngest.send({
  name: EVENTS.GROWTH_CAMPAIGN_STARTED,
  data: {
    businessId: 'uuid',
    businessData: {...},
    campaignType: 'weekly_growth'
  }
});
```

## Benefits

1. **Reliability**: Automatic retries and error handling
2. **Scalability**: Concurrent execution limits prevent overload
3. **Observability**: Built-in monitoring and debugging
4. **Flexibility**: Easy to add new functions and workflows
5. **Performance**: Non-blocking async processing

## Monitoring

1. **Development**: Use Inngest Dev UI at http://localhost:8288
2. **Production**: Use Inngest Cloud dashboard at https://app.inngest.com
3. **Logs**: Check function runs, errors, and metrics

## Troubleshooting

### Function Not Triggering
- Check event name matches exactly
- Verify Inngest is running (`npx inngest-cli dev`)
- Check for errors in API response

### Slow Performance
- Adjust concurrency limits in function config
- Check for long-running AI API calls
- Review batch sizes for bulk operations

### Database Errors
- Ensure all required tables exist
- Check foreign key constraints
- Verify Supabase service key permissions

## Future Enhancements

1. **SMS Notifications**: Add Twilio integration for campaign alerts
2. **Advanced Analytics**: Track conversion funnels
3. **Multi-channel Outreach**: LinkedIn, Twitter automation
4. **AI Personalization**: Deeper prospect research
5. **Webhook Handlers**: Stripe, email open tracking