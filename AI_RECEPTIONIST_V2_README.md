# V2 AI Receptionist - Agentic Architecture

## 🧠 Overview

The V2 AI Receptionist replaces the 2,500+ line state machine with an **LLM-powered agentic architecture** using the Vercel AI SDK. Instead of hardcoded if/else flows, the AI decides which tools to call based on conversation context.

## 📁 Files

```
src/
├── lib/ai-receptionist/
│   ├── tools.ts           # 9 LLM-callable database operations
│   ├── system-prompt.ts   # Dynamic prompt with business context
│   └── history.ts         # Conversation history manager
└── app/api/webhook/twilio/
    ├── route.ts           # V1 - Current production (state machine)
    └── v2/route.ts        # V2 - New agentic architecture (~150 lines)
```

## 🔧 Tools Available to the AI

| Tool | Description |
|------|-------------|
| `lookupCustomer` | Find customer by phone, get warranty status |
| `getBusinessConfig` | Get business pricing & settings |
| `checkAvailability` | Check if specific slot is available |
| `getAvailableSlots` | Get next 4 available time windows |
| `activateWarranty` | Register warranty after sticker scan |
| `createBooking` | Create booking once address + slot confirmed |
| `updateCustomer` | Update customer address/status |
| `notifyOwner` | Send WhatsApp to business owner |
| `calculatePrice` | Calculate total for N units |

## 🚀 Setup

### 1. Install Dependencies

```bash
npm install ai @ai-sdk/openai
```

### 2. Add OpenAI API Key

Add to `.env.local`:
```
OPENAI_API_KEY=sk-...
```

### 3. Run Database Migration

Execute `create-chat-history-table.sql` in Supabase:
```sql
-- Creates chat_history table for conversation context
```

### 4. Test the V2 Endpoint

```bash
# Check health
curl https://your-domain.com/api/webhook/twilio/v2
```

### 5. Switch Webhook URL (When Ready)

In Meta/Twilio Console, change webhook from:
```
/api/webhook/twilio
```
To:
```
/api/webhook/twilio/v2
```

## 💰 Cost Analysis

| Model | Cost per 1K tokens | ~Cost per conversation |
|-------|-------------------|----------------------|
| GPT-4o-mini | $0.00015 input, $0.0006 output | ~$0.005 (RM 0.02) |
| GPT-4o | $0.005 input, $0.015 output | ~$0.05 (RM 0.20) |

**ROI**: Each conversation costs ~RM 0.02 but books RM 150+ services.

## 🎯 Why V2?

### Before (V1 State Machine)
- 2,500+ lines of hardcoded flows
- Every bug = new if/else branch
- "123 Main Street" confused as 123 units
- Double messages when flows overlap
- Adding features = exponential complexity

### After (V2 Agentic)
- ~150 lines in route handler
- AI understands context naturally
- Addresses vs quantities handled correctly
- Single coherent response always
- Adding features = new lines in system prompt

## 📝 System Prompt Structure

The AI is given dynamic context:
- Business pricing (cleaning RM 120/unit, repair inspection RM 80)
- Customer history (warranty active, last service date)
- Operating hours
- Conversation examples

```typescript
const systemPrompt = generateSystemPrompt(business, customer);
```

## 🔄 Migration Strategy

1. ✅ Deploy V2 alongside V1 (different URL)
2. ⏳ Test with your personal number pointing to V2
3. ⏳ Monitor logs for 1 week
4. ⏳ Gradually migrate businesses to V2
5. ⏳ Eventually deprecate V1

## 📊 Logging

V2 logs every interaction:
```
🤖 V2 Incoming: +60123456789
   Message: "Hi, I need to book aircon cleaning"
   🧠 Calling AI with 3 history messages...
   🔧 Step 1 tool calls: getBusinessConfig, lookupCustomer
   ✅ AI Response (847ms): "Hi Ahmad! I can help you book..."
   📤 Sent response to customer
```

## 🛠️ Customization

### Adding a New Tool

1. Define schema in `tools.ts`:
```typescript
const myNewToolSchema = z.object({
    param1: z.string().describe('Description for AI'),
});
```

2. Add tool:
```typescript
myNewTool: tool({
    description: 'What this tool does - when to use it',
    inputSchema: myNewToolSchema,
    execute: async (input) => {
        // Database operation
        return { success: true, data: '...' };
    },
}),
```

### Modifying AI Behavior

Edit `system-prompt.ts` to:
- Change conversation style
- Add new flow examples
- Adjust business rules

## 🐛 Debugging

### Check Recent History
```sql
SELECT * FROM chat_history 
WHERE phone = '60123456789' 
ORDER BY created_at DESC 
LIMIT 20;
```

### Test Tool Directly
```typescript
const result = await receptionistTools.lookupCustomer.execute({
    phone: '+60123456789'
});
console.log(result);
```

## ⚠️ Rollback

If issues occur, simply change the webhook URL back to V1:
```
/api/webhook/twilio  (V1 - stable)
```

V1 remains untouched and production-ready.
