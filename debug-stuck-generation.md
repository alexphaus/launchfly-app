# Debug: Dashboard Stuck at "Starting AI Systems"

## 🔍 **Diagnosis**

The dashboard shows "Starting AI systems..." which means:
- Session stage is stuck at `'pending'` 
- Inngest business generation function is not progressing
- No stage transitions are happening (analyzing → researching → building → etc.)

## 🚨 **Most Likely Causes**

### 1. **Inngest Dev Server Not Running**
The most common cause - Inngest needs to be running to process events.

**Check:**
```bash
# Is Inngest dev server running?
curl http://localhost:8288/health
```

**Fix:**
```bash
# Start Inngest dev server in separate terminal
npx inngest-cli@latest dev
```

### 2. **Database Migration Not Applied**
New tables are required for the customer acquisition system.

**Check in Supabase SQL Editor:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ai_activities', 'prospects', 'outreach_campaigns');
```

**Fix:**
Run the `database-migration.sql` file in your Supabase SQL editor.

### 3. **Missing Environment Variables**
Inngest requires specific environment variables.

**Check your `.env.local`:**
```bash
INNGEST_EVENT_KEY=your_event_key
INNGEST_SIGNING_KEY=your_signing_key
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

### 4. **Inngest Function Registration Issues**
Functions might not be registering properly.

**Check Inngest Dashboard:**
Go to http://localhost:8288 and verify you see these functions:
- `generate-business`
- `growth-engine` 
- `customer-acquisition-orchestrator`

## 🛠️ **Quick Debug Steps**

### Step 1: Check Inngest Status
```bash
# Terminal 1: Make sure Next.js is running
npm run dev

# Terminal 2: Start Inngest dev server
npx inngest-cli@latest dev

# Terminal 3: Check if functions are registered
curl http://localhost:8288/api/v1/functions
```

### Step 2: Check Database Connection
```bash
# Test your API can connect to database
curl -X GET "http://localhost:3000/api/sessions/test123"
```

### Step 3: Check Session Status
In your browser console on the dashboard, run:
```javascript
// Get session ID from URL
const sessionId = window.location.pathname.split('/').pop();
console.log('Session ID:', sessionId);

// Check session status
fetch(`/api/sessions/${sessionId}`)
  .then(r => r.json())
  .then(data => console.log('Session data:', data));
```

### Step 4: Manually Trigger Generation
If Inngest is running but generation isn't starting:
```bash
# Get your business ID and session ID from the database or URL
curl -X POST http://localhost:3000/api/generate-business \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-id",
    "businessId": "your-business-id", 
    "formData": {"name": "Test", "email": "test@test.com"}
  }'
```

## 🔧 **Common Solutions**

### Solution 1: Restart Everything
```bash
# Stop all processes (Ctrl+C)
# Then restart in this order:

# Terminal 1
npm run dev

# Terminal 2  
npx inngest-cli@latest dev

# Wait for both to be fully running, then test
```

### Solution 2: Check Console for Errors
1. Open browser dev tools (F12)
2. Check Console tab for any errors
3. Check Network tab for failed requests
4. Look for any red errors in the terminal running `npm run dev`

### Solution 3: Verify Function Registration
Visit http://localhost:8288 and check:
- Are functions showing up?
- Are there any error messages?
- Can you see event history?

### Solution 4: Test with Fresh Session
```bash
# Generate a new test session
npm run simulate
```

## 📊 **Expected Behavior**

When working correctly, you should see:
1. "Starting AI systems..." (stage: pending)
2. "Analyzing your skills and market opportunity" (stage: analyzing) 
3. "Researching profitable niches..." (stage: researching)
4. "Building your website..." (stage: building)
5. "Optimizing for conversions..." (stage: finalizing)
6. "Your business is ready!" (stage: complete)
7. Real customer acquisition activities start appearing

## 🚨 **If Still Stuck**

Check these logs for errors:

1. **Next.js Console:** Look for any red errors
2. **Inngest Dashboard:** http://localhost:8288 - check for failed function runs
3. **Browser Console:** F12 → Console tab for JavaScript errors
4. **Supabase Logs:** Check your Supabase dashboard for database errors

The most likely fix is just starting the Inngest dev server! 🚀