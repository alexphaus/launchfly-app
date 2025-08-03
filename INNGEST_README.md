# Inngest Implementation for Launchfly AI

This document outlines the Inngest implementation for AI orchestration and background processing in Launchfly.

## 🎯 What's Implemented

### ✅ Core Setup
- **Inngest Client**: Configured with production-ready settings
- **API Route**: Proper Next.js App Router integration at `/api/inngest`
- **Background Processing**: Business generation runs in background with retries
- **Error Handling**: Comprehensive error recovery and notification system

### ✅ Functions Implemented

1. **`generateBusinessFunction`** - Main business generation workflow
   - Analyzes opportunities
   - Builds websites 
   - Updates database with results
   - Includes progress tracking and logging

2. **`errorHandlerFunction`** - Handles failed generations
   - Updates session/business status on errors
   - Provides error notifications
   - Ensures clean error states

3. **`validateBusinessFunction`** - Validates generated data
   - Checks required fields
   - Validates subdomain format
   - Updates validation status

4. **`enhanceBusinessFunction`** - Adds AI enhancements
   - SEO optimizations
   - Marketing materials
   - Analytics setup

### ✅ Utilities
- **Trigger Functions**: Clean APIs for sending events
- **Error Recovery**: Automatic error event triggering
- **Batch Operations**: Support for bulk processing

## 🚀 How It Works

### 1. Request Flow
```
POST /api/generate-business
  ↓
Immediate response with eventId
  ↓
Inngest processes in background
  ↓
Database updated with progress
  ↓
Frontend polls for status
```

### 2. Background Processing
- **Step-based execution** with independent retries
- **Progress tracking** with real-time updates
- **Automatic error recovery** with fallback handling
- **Concurrency limits** to prevent resource exhaustion

### 3. Error Handling
- Failed steps retry automatically (3 attempts)
- Unrecoverable errors trigger error handler function
- Database always updated with current status
- Users see appropriate error messages

## 📋 Setup Instructions

### 1. Environment Variables
Copy `.env.inngest.example` to your `.env.local`:
```bash
cp .env.inngest.example .env.local
```

Add your Inngest credentials (optional for development):
```env
INNGEST_EVENT_KEY=your_event_key
INNGEST_SIGNING_KEY=your_signing_key
```

### 2. Development
Start your Next.js app and Inngest will automatically work:
```bash
npm run dev
```

For local Inngest dashboard (optional):
```bash
npx inngest-cli@latest dev
```

### 3. Production Deployment
1. Add environment variables to your deployment platform
2. Ensure `/api/inngest` is accessible 
3. Configure Inngest webhook in dashboard to point to your API

## 🔧 Usage Examples

### Trigger Business Generation
```javascript
import { triggerBusinessGeneration } from '@/lib/inngest-utils';

const result = await triggerBusinessGeneration(sessionId, businessId, formData);
console.log('Event ID:', result.eventId);
```

### Trigger Enhancements
```javascript
import { triggerBusinessEnhancement } from '@/lib/inngest-utils';

await triggerBusinessEnhancement(businessId, 'seo');
```

### Batch Operations
```javascript
import { triggerBatchOperations } from '@/lib/inngest-utils';

await triggerBatchOperations([
  { eventName: 'business/validation.requested', data: { businessId: '1' }},
  { eventName: 'business/enhancement.requested', data: { businessId: '1', enhancementType: 'seo' }}
]);
```

## 📊 Monitoring & Observability

### Built-in Logging
- All functions include structured logging
- Session IDs tracked through entire workflow
- Error details captured and stored

### Inngest Dashboard
- Real-time function execution monitoring
- Retry attempt visibility
- Performance metrics
- Error rate tracking

### Database Tracking
- Session progress updates in real-time
- Business status changes logged
- Error messages stored for debugging

## 🔒 Security & Reliability

### Security Features
- Event signing for webhook verification
- Environment-based configuration
- No sensitive data in event payloads

### Reliability Features
- Automatic retries (3 attempts per step)
- Independent step execution
- Graceful error handling
- Database consistency checks

### Performance Features
- Concurrency limits (5 concurrent generations)
- Step-based execution for efficiency
- Background processing for fast API responses
- Progress tracking for UX

## 🛠 Extending the System

### Adding New Functions
1. Create function in `/src/lib/inngest/`
2. Import in `/src/app/api/inngest/route.js`
3. Add utility trigger function if needed

### Adding New Events
1. Define event name pattern: `category/action.status`
2. Add trigger utility in `inngest-utils.js`
3. Implement handler function

## 🐛 Troubleshooting

### Common Issues
1. **Functions not registering**: Check `/api/inngest` route is accessible
2. **Events not triggering**: Verify event names match exactly
3. **Environment issues**: Ensure all required env vars are set
4. **Database errors**: Check Supabase connection and permissions

### Debug Mode
Set `NODE_ENV=development` for detailed logging and debug information.

## 📈 Performance Considerations

- **Memory**: Each function runs in its own context
- **Timeouts**: Functions have 15-minute default timeout
- **Concurrency**: Limited to 5 concurrent business generations
- **Database**: Uses connection pooling via Supabase client

This implementation provides a robust, scalable foundation for AI orchestration with excellent error handling and observability.
