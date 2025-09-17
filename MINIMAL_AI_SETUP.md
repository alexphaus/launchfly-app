# Minimal AI Cofounder Setup Guide

## 🚀 Quick Start (5 minutes)

### 1. Enable the Minimal System
Add to your `.env`:
```bash
DISABLE_EXPENSIVE_AI_FUNCTIONS=true
AI_DAILY_BUDGET=1.00
ENABLE_IMAGE_GENERATION=false
```

### 2. Run Migration
```bash
node migrate-to-minimal-ai.js
```

### 3. Restart Your App
```bash
npm run dev  # or your start command
```

### 4. Test the New AI
```bash
# Check status
curl "http://localhost:3000/api/ai?businessId=YOUR_BUSINESS_ID"

# Chat with AI
curl -X POST "http://localhost:3000/api/ai" \
  -H "Content-Type: application/json" \
  -d '{"businessId":"YOUR_BUSINESS_ID","action":"chat","data":{"message":"How can you help me grow my business?"}}'
```

## 📊 Cost Comparison

| System | Hourly Cost | Daily Cost | Monthly Cost |
|--------|-------------|------------|--------------|
| **Old System** | $2-5/hour | $48-120/day | $1,440-3,600/month |
| **New Minimal** | $0.05-0.50/hour | $1.20-12/day | $36-360/month |
| **Savings** | **90-95%** | **90-95%** | **90-95%** |

## 🎯 What Changed

### ✅ Kept (Revenue-Focused)
- Event-driven responses to checkout, cart abandonment, payments
- Smart lead nurturing and email replies
- Performance alerts for real issues
- Expandable tool system
- Memory for important learnings

### ❌ Removed (Cost Drains)
- Continuous "thinking" loops
- Scheduled cron jobs (hourly, daily, weekly)
- Vector embeddings for memory
- Automatic image generation
- Complex multi-system orchestration

## 🛠 Available Actions

### Chat & Analysis
```javascript
// Simple chat
POST /api/ai
{
  "businessId": "xxx",
  "action": "chat",
  "data": { "message": "How's my business doing?" }
}

// Analyze metrics
POST /api/ai
{
  "businessId": "xxx", 
  "action": "analyze",
  "data": { "type": "metrics", "timeframe": "7d" }
}
```

### Content Generation
```javascript
// Generate email copy
POST /api/ai
{
  "businessId": "xxx",
  "action": "generate", 
  "data": {
    "type": "email",
    "topic": "follow up with prospect",
    "tone": "friendly"
  }
}
```

### Tool Execution
```javascript
// Send an email
POST /api/ai
{
  "businessId": "xxx",
  "action": "execute",
  "data": {
    "tool": "send_email",
    "params": {
      "to": "customer@example.com",
      "subject": "Thanks for your purchase!",
      "message": "We appreciate your business..."
    }
  }
}
```

### Budget Management
```javascript
// Check remaining budget
POST /api/ai
{
  "businessId": "xxx",
  "action": "budget",
  "data": { "operation": "check" }
}

// Set daily budget
POST /api/ai
{
  "businessId": "xxx",
  "action": "budget", 
  "data": { "operation": "set", "amount": 2.00 }
}
```

## 🔧 Available Tools

The AI can use these tools automatically:

1. **send_email** - Send emails via Resend
2. **update_website** - Update website content
3. **analyze_metrics** - Analyze business performance
4. **generate_content** - Create marketing content
5. **database** - Query/update records
6. **generate_image** - DALL-E (if enabled)

## 📈 Triggering AI Events

Trigger AI responses from your app:

```javascript
import { triggerAIEvent } from '@/lib/inngest/functions/minimal-functions';

// When checkout starts
await triggerAIEvent('checkout.started', {
  businessId: 'xxx',
  productName: 'Pro Plan',
  price: 297,
  customerEmail: 'buyer@example.com'
});

// When cart abandoned
await triggerAIEvent('cart.abandoned', {
  businessId: 'xxx',
  sessionId: 'session_123',
  email: 'prospect@example.com',
  productName: 'Starter Plan'
});

// When payment completed
await triggerAIEvent('payment.completed', {
  businessId: 'xxx',
  amount: 297,
  productName: 'Pro Plan',
  customerEmail: 'buyer@example.com',
  acquisitionChannel: 'organic'
});
```

## 🎛 Environment Variables

### Cost Control
- `AI_DAILY_BUDGET` - Daily budget per business (default: $1.00)
- `DISABLE_EXPENSIVE_AI_FUNCTIONS` - Use minimal system (default: false)
- `ENABLE_IMAGE_GENERATION` - Allow DALL-E usage (default: false)

### Model Selection (Optional)
- `AI_DEFAULT_MODEL` - Fallback model (default: gpt-3.5-turbo)
- `AI_ANALYZE_MODEL` - Analysis tasks (default: gpt-4o-mini)
- `AI_CLOSE_MODEL` - High-value sales (default: gpt-4o)

## 🔍 Monitoring

### Check Usage
```bash
curl "http://localhost:3000/api/ai?businessId=YOUR_ID&includeStats=true"
```

### View Logs
The AI logs all operations and costs to your database:
- `ai_usage` - Daily cost tracking
- `ai_memories_simple` - Important learnings
- `tool_usage` - Tool usage analytics

## 🚨 Troubleshooting

### High Costs?
1. Check `AI_DAILY_BUDGET` is set appropriately
2. Verify `DISABLE_EXPENSIVE_AI_FUNCTIONS=true`
3. Monitor usage: `GET /api/ai?businessId=xxx&includeStats=true`

### AI Not Responding?
1. Check business has `ai_enabled=true` in database
2. Verify budget hasn't been exceeded
3. Check logs for error messages

### Missing Tools?
Tools are registered automatically but some require API keys:
- Email tool needs `RESEND_API_KEY`
- Image tool needs `ENABLE_IMAGE_GENERATION=true`

## 🔄 Expanding the System

### Adding New Tools
```javascript
// In tool-registry.js
class CustomTool extends Tool {
  constructor() {
    super('custom_action', 'Description of what this tool does');
  }
  
  async execute(params) {
    // Your custom logic here
    return { success: true, result: 'Done!' };
  }
}

// Register in ToolRegistry constructor
this.register(new CustomTool());
```

### Adding New Events
```javascript
// In minimal-functions.js
export const handleCustomEvent = inngest.createFunction(
  { id: 'custom-event-handler' },
  { event: 'custom.event' },
  async ({ event, step }) => {
    const ai = getMinimalAICofounder(event.data.businessId);
    return await ai.handleRevenueEvent('custom.event', event.data);
  }
);
```

The system is designed to be easily expandable while maintaining cost efficiency.

## 📞 Support

If you need help:
1. Check the logs in your database
2. Test with the curl commands above
3. Verify your environment variables
4. Check that migration completed successfully

The minimal AI system gives you 80% of the value with 20% of the cost and complexity!

