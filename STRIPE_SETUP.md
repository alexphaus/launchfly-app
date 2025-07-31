# Stripe Payment Integration Setup

## Overview

This implementation adds complete payment processing to Launchfly websites. When visitors click on products, they can purchase them through Stripe Checkout.

## Features

- 🛍️ Product pages with detailed descriptions
- 💳 Secure Stripe Checkout integration  
- 📧 Automatic email notifications for sales
- 🎉 First sale celebration emails
- 📊 Sales tracking in database
- 🔒 Secure webhook handling

## Setup Instructions

### 1. Install Dependencies

```bash
npm install stripe resend
```

### 2. Configure Environment Variables

Make sure these variables are set in your `.env.local`:

```bash
# Stripe Keys (get from Stripe Dashboard)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend for emails
RESEND_API_KEY=re_...

# Your domain URLs
NEXT_PUBLIC_WEBSITE_BASE_URL=https://yourdomain.com
```

### 3. Setup Database

Run the SQL from `setup_sales_table.sql` in your Supabase SQL editor to create the sales table.

### 4. Configure Stripe Webhooks

1. Go to your Stripe Dashboard > Webhooks
2. Create a new webhook endpoint pointing to: `https://yourdomain.com/api/webhook/stripe`
3. Select the event: `checkout.session.completed`
4. Copy the webhook secret to your environment variables

### 5. Test the Integration

1. Visit a test business site: `http://localhost:3000/axceleratebusiness`
2. Click on a product to view details
3. Fill in customer info and click "Buy Now"
4. Complete the Stripe Checkout flow
5. Check that sales are recorded in the database

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── stripe/
│   │   │   └── checkout/route.js      # Creates Stripe sessions
│   │   └── webhook/
│   │       └── stripe/route.js        # Handles payments
│   └── sites/
│       └── [subdomain]/
│           ├── product/
│           │   └── [productId]/page.js # Product detail pages
│           └── success/page.js         # Purchase success page
└── components/
    └── launchfly-ui/
        ├── ProductGrid.js             # Product listing
        ├── ProductCard.js             # Individual product cards
        └── PricingTable.js            # Updated with product links
```

## How It Works

### 1. Product Display
- Products are defined in business data
- `ProductGrid` component displays them as cards
- `PricingTable` component links to product pages

### 2. Purchase Flow
1. User clicks product → redirected to product detail page
2. User enters info and clicks "Buy Now"
3. Frontend calls `/api/stripe/checkout` to create session
4. User redirected to Stripe Checkout
5. After payment, user sees success page

### 3. Backend Processing  
1. Stripe webhook calls `/api/webhook/stripe`
2. Sale recorded in database
3. Business owner gets email notification
4. First sale triggers celebration email

## Product Data Format

Products should be defined in the business data like this:

```javascript
{
  component: 'ProductGrid',
  props: {
    title: 'Our Products',
    products: [
      {
        id: 'product-id',
        name: 'Product Name',
        price: '$99',
        period: 'one-time', // or 'month', 'year'
        description: 'Product description',
        icon: '🚀',
        features: [
          'Feature 1',
          'Feature 2', 
          'Feature 3'
        ],
        ctaText: 'Buy Now',
        popular: true // optional
      }
    ]
  }
}
```

## Email Templates

The system sends two types of emails:

1. **Sale Notification**: Sent to business owner for every sale
2. **First Sale Celebration**: Special email for the first sale with extra celebration

## Security

- All webhook requests are verified using Stripe signatures
- Database operations use RLS (Row Level Security)
- Customer data is handled securely through Stripe

## Testing

Use Stripe's test card numbers:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

## Troubleshooting

1. **Webhook not working**: Check that the webhook URL is correct and the secret matches
2. **Products not showing**: Verify the product data format in the business data
3. **Emails not sending**: Check the Resend API key and that the sender domain is verified
4. **Database errors**: Ensure the sales table exists and RLS policies are correct

## Next Steps

- Add more payment methods (Apple Pay, Google Pay)
- Implement subscription billing
- Add coupon/discount system
- Create sales analytics dashboard
