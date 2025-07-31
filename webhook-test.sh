#!/bin/bash

# Stripe Webhook Testing Helper
# This script helps set up webhook testing for local development

echo "🚀 Launchfly Stripe Webhook Testing Helper"
echo "==========================================="
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found. Please install it first:"
    echo "   https://stripe.com/docs/stripe-cli"
    echo ""
    echo "   Quick install on macOS:"
    echo "   brew install stripe/stripe-cli/stripe"
    exit 1
fi

echo "✅ Stripe CLI found"
echo ""

# Check if user is logged in
if ! stripe auth --help &> /dev/null; then
    echo "Please login to Stripe CLI first:"
    echo "   stripe login"
    exit 1
fi

echo "🔧 Starting webhook forwarding..."
echo "This will forward Stripe webhooks to your local server"
echo ""
echo "Local server: http://localhost:3005/api/webhook/stripe"
echo ""

# Forward webhooks to local server
stripe listen --forward-to localhost:3005/api/webhook/stripe --events checkout.session.completed,payment_intent.succeeded

echo ""
echo "✅ Webhook forwarding started!"
echo ""
echo "💡 Tips:"
echo "   - Keep this terminal window open"
echo "   - Use test card: 4242 4242 4242 4242"
echo "   - Check webhook logs in Stripe dashboard"
echo "   - Monitor your app logs for webhook processing"
