# Stripe Webhook Setup Guide

## The Problem
Your successful purchases aren't creating sales records in the database because **Stripe webhooks aren't reaching your local development server**.

## Root Cause
- Stripe sends webhooks to the URL configured in your Stripe dashboard
- For local development, Stripe can't reach `localhost:3001` directly
- You need to use the Stripe CLI to forward webhooks to your local server

## Solution: Set Up Stripe CLI for Local Development

### Step 1: Install Stripe CLI
```bash
# On macOS (using Homebrew)
brew install stripe/stripe-cli/stripe

# Or download from: https://stripe.com/docs/stripe-cli#install
```

### Step 2: Login to Stripe
```bash
stripe login
```
This will open a browser to authenticate with your Stripe account.

### Step 3: Forward Webhooks to Your Local Server
```bash
# Forward webhooks to your local Next.js server
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

This command will:
- ✅ Start listening for webhook events from Stripe
- ✅ Forward them to your local development server
- ✅ Provide you with a webhook signing secret

### Step 4: Update Your Environment Variables
The `stripe listen` command will output a webhook signing secret like this:
```
> Ready! Your webhook signing secret is whsec_1234567890abcdef...
```

**Update your `.env.local` file with this new webhook secret:**
```bash
# Replace the existing STRIPE_WEBHOOK_SECRET with the one from stripe listen
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

### Step 5: Restart Your Development Server
```bash
# Stop your current server (Ctrl+C) and restart
npm run dev
```

## Testing the Fix

### Test 1: Make a Test Purchase
1. Go to your business subdomain (e.g., `cococonnoisseur.localhost:3001`)
2. Try to purchase a product
3. Complete the Stripe checkout
4. Check the terminal running `stripe listen` - you should see webhook events
5. Check your Next.js server logs - you should see webhook processing logs

### Test 2: Check Database
Run this to verify the sale was recorded:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkSales() {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
  
  console.log('Recent sales:', data);
}

checkSales();
"
```

## Alternative: Use a Tunnel Service

If Stripe CLI doesn't work, you can use ngrok or similar:

### Using ngrok:
```bash
# Install ngrok
brew install ngrok

# Create a tunnel to your local server
ngrok http 3001
```

Then update your Stripe webhook URL in the Stripe dashboard to point to the ngrok URL:
```
https://your-ngrok-id.ngrok.io/api/stripe/webhook
```

## Production Setup

For production, ensure your webhook endpoint is configured in Stripe dashboard:
```
https://yourdomain.com/api/stripe/webhook
```

And use the production webhook signing secret in your environment variables.

## Debugging Webhooks

The webhook handler now includes detailed logging. Watch your server logs to see:
- ✅ When webhooks are received
- ✅ If signature verification passes
- ✅ What event types are being processed
- ✅ If database operations succeed
- ❌ Any errors that occur

## Common Issues

1. **Wrong webhook secret**: Make sure you're using the secret from `stripe listen`, not the one from Stripe dashboard
2. **Wrong port**: Ensure you're forwarding to the correct port (3001 in this case)
3. **Server not running**: Make sure your Next.js server is running when testing
4. **Missing metadata**: Ensure your checkout session creation includes all required metadata

## Quick Fix Commands

```bash
# Terminal 1: Start your Next.js server
npm run dev

# Terminal 2: Forward Stripe webhooks
stripe listen --forward-to localhost:3001/api/stripe/webhook

# Terminal 3: Test a purchase or check database
# (Use the test commands above)
```
