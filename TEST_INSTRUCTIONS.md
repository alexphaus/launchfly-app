# 🧪 Dashboard Debug & Test Instructions

## Quick Commands

```bash
# 1. Check if Inngest is running
npm run test:inngest

# 2. Quick diagnostic (environment + database)
npm run debug

# 3. Full simulation (creates test session)
npm run test:full

# 4. Check your stuck session
npm run test:session business-cu2zyotm
```

## Step-by-Step Debugging

### Step 1: Check Inngest Status
```bash
npm run test:inngest
```

**Expected Result:**
- ✅ Inngest dev server is running
- ✅ Functions registered: 7+
- ✅ Core functions found

**If Failed:**
- Open new terminal: `npx inngest-cli@latest dev`
- Wait for "Functions registered" message
- Run test again

### Step 2: Quick System Check
```bash
npm run debug
```

**What it checks:**
- Environment variables
- Database connection  
- Required tables exist
- Supabase access

**If Failed:**
- Missing env vars → Check `.env.local`
- Database errors → Run `database-migration.sql`
- Connection issues → Check Supabase credentials

### Step 3: Test Your Stuck Session
```bash
npm run test:session business-cu2zyotm
```

**This will show:**
- Session status and stage
- Business record status
- Why it's stuck
- Specific recommendations

### Step 4: Full End-to-End Test
```bash
npm run test:full
```

**What it does:**
- Creates test session + business
- Sends Inngest event
- Shows if generation would work
- Gives you a test URL to monitor

## Expected Workflow

When everything works correctly:

1. **Session Created** → Stage: `pending`
2. **Inngest Event Sent** → Business generation starts
3. **Stage Progression**: 
   - `analyzing` → Analyzing skills/market
   - `researching` → Researching niches
   - `building` → Building website
   - `finalizing` → Final touches
   - `complete` → Ready + customer acquisition starts

## Common Issues & Fixes

| Problem | Fix |
|---------|-----|
| "Inngest not running" | `npx inngest-cli@latest dev` |
| "Tables don't exist" | Run `database-migration.sql` |
| "Session not found" | Check URL/session ID |
| "Functions not registered" | Restart both dev servers |
| "Environment errors" | Check `.env.local` file |

## Manual Tests

### Test 1: Direct Session Check
```bash
curl "http://localhost:3000/api/debug/session-status?sessionId=business-cu2zyotm"
```

### Test 2: Trigger Generation Manually
```bash
curl -X POST http://localhost:3000/api/generate-business \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "business-cu2zyotm",
    "businessId": "business-business-cu2zyotm",
    "formData": {"name": "Test", "email": "test@test.com"}
  }'
```

### Test 3: Check Inngest Functions
```bash
curl http://localhost:8288/api/v1/functions
```

## Monitoring

- **Inngest Dashboard**: http://localhost:8288
- **Test Session**: http://localhost:3000/dashboard/[sessionId]
- **Browser Console**: F12 → Console for errors

## Success Indicators

✅ Both servers running (Next.js + Inngest)  
✅ 7+ functions registered in Inngest  
✅ All required database tables exist  
✅ Environment variables configured  
✅ Test session progresses through stages  
✅ Real customer acquisition starts after `complete`