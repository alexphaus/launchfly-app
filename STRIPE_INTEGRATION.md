# Stripe Payment Integration for Launchfly

This integration allows users to purchase products directly from their generated business landing pages using Stripe.

## Features

- 🛒 **One-click purchasing** from any PricingTable component
- 💳 **Secure Stripe Checkout** with card payments
- 📧 **Automatic sale notifications** to business owners
- 🎉 **First sale celebration emails** with special messaging
- 📊 **Sales tracking** in the database
- 💰 **Revenue analytics** in the dashboard

## Setup Instructions

### 1. Database Migration

Run the migration to create the sales table:

```bash
# The migration SQL is in migrations/create_sales_table.sql
# You can run it manually in your Supabase dashboard, or use our script:
node scripts/migrate.js
```

### 2. Stripe Configuration

Your Stripe keys are already configured in `.env.local`:

- `STRIPE_PUBLISHABLE_KEY` - For frontend checkout
- `STRIPE_SECRET_KEY` - For backend API calls  
- `STRIPE_WEBHOOK_SECRET` - For webhook verification

### 3. Webhook Setup

1. Go to your Stripe Dashboard → Webhooks
2. Add a new webhook endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select event: `checkout.session.completed`
4. Copy the webhook secret to your `.env.local` file

## How It Works

### For Mock Businesses
- Visit `http://localhost:3006/sites/axceleratebusiness` or `http://localhost:3006/sites/innovativesolutionshub`
- Click "Get Started" or similar buttons on the pricing cards
- Mock businesses won't process payments (no businessId) but show the UI

### For Generated Businesses
1. User fills out the Tally form
2. Business is generated with products
3. Products are converted to pricing plans in the PricingTable
4. When a user clicks a pricing button, they're taken to Stripe Checkout
5. After successful payment, they're redirected to `/success`
6. The webhook processes the payment and:
   - Records the sale in the database
   - Updates business revenue
   - Sends celebration email to the business owner

### Email Notifications

Business owners receive:
- 🎉 **First Sale Email**: Special congratulations with celebration styling
- 💰 **Regular Sale Emails**: For subsequent sales
- 📧 **Customer Details**: Name, email, product purchased, amount

### Payment Flow

```
Landing Page → Click Price Button → Stripe Checkout → Payment → Success Page
                    ↓
               Webhook Triggered → Sale Recorded → Email Sent
```

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── checkout/route.js          # Create checkout sessions
│   │   │   └── webhook/route.js           # Handle payment completion
│   │   └── businesses/[businessId]/
│   │       └── sales/route.js             # Get sales data
│   ├── sites/[subdomain]/page.js          # Landing pages with payment integration
│   └── success/page.js                    # Payment success page
├── components/
│   └── launchfly-ui/
│       └── PricingTable.js                # Enhanced with Stripe integration
├── core/
│   └── launch.js                          # Updated to generate pricing plans
├── migrations/
│   └── create_sales_table.sql             # Database schema
└── scripts/
    └── migrate.js                         # Migration runner
```

## Testing

### Local Testing
1. Use Stripe test cards: `4242 4242 4242 4242`
2. Check webhook logs in Stripe Dashboard
3. Verify emails in your email service logs
4. Check sales data in Supabase

### Production
1. Replace test keys with live Stripe keys
2. Update webhook URL to production domain
3. Test with real card (small amount)

## Sales Tracking

Sales are tracked in the `sales` table with:
- Customer email and name
- Product purchased
- Amount paid
- Stripe session ID
- Business ID reference

## Revenue Analytics

Business revenue is automatically updated:
- `total_revenue` field tracks cumulative sales
- `first_sale_date` marks the first successful transaction
- Dashboard displays real-time revenue data

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**
   - Check webhook URL is publicly accessible
   - Verify webhook secret matches
   - Check Stripe Dashboard webhook logs

2. **Payment not processing**
   - Verify Stripe keys are correct
   - Check browser console for errors
   - Ensure business ID is being passed

3. **Emails not sending**
   - Check Resend API key
   - Verify email templates
   - Check email service logs

### Debug Tips

- Check browser Network tab for API calls
- Monitor server logs during payment flow
- Use Stripe Dashboard event logs
- Verify database records after successful payments

## Security Notes

- All payments processed securely by Stripe
- No card details stored in your database
- Webhook signatures verified for security
- Row Level Security enabled on sales table

## Future Enhancements

- [ ] Subscription billing support
- [ ] Multiple payment methods (Apple Pay, Google Pay)
- [ ] Invoice generation
- [ ] Refund processing
- [ ] Advanced analytics dashboard
- [ ] Customer portal for purchase history
