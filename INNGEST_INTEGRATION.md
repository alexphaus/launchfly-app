# Inngest Integration for Launchfly

## Overview

This document outlines the comprehensive Inngest integration implemented for Launchfly, providing robust AI orchestration for business generation and growth strategies.

## Architecture

### Core Components

1. **Inngest Client** (`src/lib/inngest.js`)
   - Central configuration and event management
   - Type-safe event definitions
   - Retry logic and error handling

2. **Business Generation Functions** (`src/lib/inngest/functions/business-generation.js`)
   - Orchestrates the complete business creation workflow
   - Handles stages: queued → analyzing → researching → building → complete
   - Automatic error recovery and status updates

3. **Growth Strategy Functions** (`src/lib/inngest/functions/growth-strategies.js`)
   - Customer acquisition campaigns
   - Cold email outreach automation
   - Growth experiment orchestration

4. **API Endpoints**
   - `/api/inngest` - Main Inngest endpoint serving all functions
   - `/api/generate-business` - Triggers business generation (now via Inngest)
   - `/api/growth/start` - Triggers growth strategies
   - `/api/test-inngest` - Testing and debugging

## Key Features

### 🚀 Business Generation Orchestration

The system now handles business generation through a robust workflow:

```
User Request → API → Inngest Event → Orchestrator → Core Functions → Database Updates
```

**Stages:**
- `queued` - Request received and queued for processing
- `analyzing` - AI analyzing user data and market opportunity
- `researching` - Researching market and competitive landscape
- `building` - Creating website, products, and business assets
- `complete` - Business ready and live

### 📈 Growth Strategy Automation

**Customer Acquisition:**
- Multi-channel campaign orchestration
- Lead magnet creation
- Performance tracking and optimization

**Cold Email Outreach:**
- AI-powered prospect generation
- Personalized email sequences
- Automated follow-up campaigns
- Response tracking and analytics

### 🔄 Error Handling & Reliability

- **Automatic Retries** - Failed jobs are automatically retried with exponential backoff
- **Error Recovery** - System gracefully handles failures and updates status accordingly
- **Monitoring** - Comprehensive logging and status tracking
- **Concurrency Control** - Prevents resource conflicts with intelligent queuing

## Event Types

```javascript
// Business Generation
BUSINESS_GENERATION_STARTED
BUSINESS_ANALYSIS_COMPLETED
BUSINESS_RESEARCH_COMPLETED
BUSINESS_CREATION_COMPLETED
BUSINESS_GENERATION_COMPLETED

// Growth Strategies
GROWTH_STRATEGY_STARTED
CUSTOMER_ACQUISITION_STARTED
COLD_EMAIL_CAMPAIGN_STARTED
COLD_EMAIL_BATCH_SENT
GROWTH_EXPERIMENT_COMPLETED

// System Events
PROCESS_FAILED
RETRY_REQUIRED
```

## Database Schema

New tables added to support Inngest workflows:

- `marketing_campaigns` - Track multi-channel marketing campaigns
- `email_outreach` - Store cold email sequences and responses
- `growth_experiments` - Track growth experiment results
- `inngest_jobs` - Monitor Inngest job status and performance

## Configuration

Required environment variables:

```bash
INNGEST_EVENT_KEY=your_event_key_here
INNGEST_SIGNING_KEY=your_signing_key_here
```

## Usage Examples

### Trigger Business Generation

```javascript
import { sendEvent, EventTypes } from '@/lib/inngest';

await sendEvent(EventTypes.BUSINESS_GENERATION_STARTED, {
  sessionId: 'session_123',
  businessId: 'business_456', 
  userData: { name: 'John', skills: 'Marketing' },
  formData: { /* form data */ }
});
```

### Start Growth Strategies

```javascript
await sendEvent(EventTypes.GROWTH_STRATEGY_STARTED, {
  businessId: 'business_456',
  businessData: { /* business data */ },
  strategies: ['customer-acquisition', 'cold-outreach']
});
```

### Launch Cold Email Campaign

```javascript
await sendEvent(EventTypes.COLD_EMAIL_CAMPAIGN_STARTED, {
  businessId: 'business_456',
  businessData: { /* business data */ },
  campaign: {
    type: 'initial-outreach',
    targetSize: 100,
    industry: 'Technology'
  }
});
```

## Testing

### Test Business Generation
```bash
curl -X POST http://localhost:3000/api/test-inngest \
  -H "Content-Type: application/json" \
  -d '{"action": "test-business-generation", "businessId": "test_business_123"}'
```

### Test Growth Strategies
```bash
curl -X POST http://localhost:3000/api/test-inngest \
  -H "Content-Type: application/json" \
  -d '{"action": "test-growth-strategy", "businessId": "test_business_123"}'
```

### Test Cold Email Campaign
```bash
curl -X POST http://localhost:3000/api/test-inngest \
  -H "Content-Type: application/json" \
  -d '{"action": "test-cold-email", "businessId": "test_business_123"}'
```

## Dashboard Integration

The LaunchflyDashboard component has been updated to support the new stages:

- Shows real-time progress through all stages
- Handles the new `queued` stage
- Maintains compatibility with existing functionality

## Cold Email System

The automated cold email outreach system includes:

1. **AI Prospect Generation** - Creates targeted prospect lists based on business type
2. **Email Template Creation** - AI-generated, personalized email sequences
3. **Staged Delivery** - Initial email → Follow-up 1 (3 days) → Follow-up 2 (7 days)
4. **Response Tracking** - Monitors opens, clicks, and responses
5. **Performance Analytics** - Campaign metrics and optimization suggestions

## Future Enhancements

Planned improvements for the Inngest integration:

1. **Advanced Email Integration** - Real email sending via Resend/SendGrid
2. **LinkedIn Automation** - Automated LinkedIn outreach
3. **Content Marketing** - Automated blog post and social media content creation
4. **SEO Optimization** - Automated website optimization for search engines
5. **Analytics Dashboard** - Real-time campaign performance monitoring
6. **A/B Testing** - Automated testing of different strategies
7. **Customer Feedback Loop** - Automated customer satisfaction surveys

## Monitoring & Debugging

- Check Inngest logs in your Inngest dashboard
- Use `/api/test-inngest` endpoint for testing
- Monitor database tables for job status
- Review console logs for detailed execution traces

## Benefits

1. **Scalability** - Handle multiple business generations simultaneously
2. **Reliability** - Automatic retries and error recovery
3. **Visibility** - Real-time progress tracking and monitoring
4. **Modularity** - Easy to add new growth strategies and experiments
5. **Performance** - Background processing doesn't block user interface
6. **Maintainability** - Clear separation of concerns and organized codebase

## Support

For issues or questions about the Inngest integration:

1. Check the Inngest dashboard for job status
2. Review the console logs for error details
3. Test individual components using the test API
4. Verify environment variables are correctly set

The system is designed to be robust and self-healing, but monitoring is recommended for production deployments.
