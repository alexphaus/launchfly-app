# Stripe Payment Integration Documentation

## Overview
This document outlines the comprehensive Stripe payment processing system integrated into the Launchfly app. The system provides a complete payment experience for visitors purchasing products from user-generated landing pages.

## System Architecture

### 1. Payment Flow Components

#### Frontend Components:
- **PricingTable.js** - Displays pricing plans with integrated checkout
- **ProductCard.js** - Individual product cards with buy now functionality  
- **ProductGrid.js** - Grid layout for multiple products
- **SalesWidget.js** - Real-time sales dashboard for business owners

#### API Endpoints:
- **`/api/stripe/create-checkout-session`** - Creates Stripe checkout sessions
- **`/api/stripe/webhook`** - Handles Stripe webhook events
- **`/api/stripe/session/[sessionId]`** - Retrieves session details
- **`/api/sales/[businessId]`** - Fetches sales data and analytics
- **`/api/notifications/send`** - Sends instant sale notifications
- **`/api/test/create-sale`** - Creates test sales for demonstration

### 2. Payment Process Flow

```
1. Visitor clicks "Buy Now" on product
2. Customer enters email/name
3. Creates Stripe checkout session
4. Redirects to Stripe hosted checkout
5. Customer completes payment
6. Stripe sends webhook notification
7. System records sale in database
8. Sends notifications to business owner
9. Redirects customer to success page
10. Updates dashboard with real-time data
```

### 3. Database Schema

#### Sales Table:
```sql
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  product_id text,
  amount numeric NOT NULL,
  currency text DEFAULT 'usd',
  customer_email text,
  customer_name text,
  stripe_session_id text UNIQUE,
  created_at timestamp DEFAULT now()
);
```

#### Updated Business Table:
```sql
-- Added fields for revenue tracking
ALTER TABLE businesses ADD COLUMN total_revenue numeric DEFAULT 0;
ALTER TABLE businesses ADD COLUMN first_sale_date timestamp;
ALTER TABLE businesses ADD COLUMN last_sale_date timestamp;
```

### 4. Product Structure

Products are generated with the following structure:
```javascript
{
  id: 'product_[timestamp]_[index]',
  name: 'Product Name',
  price: '$297',
  description: 'Product description',
  features: ['Feature 1', 'Feature 2', 'Feature 3']
}
```

### 5. Notification System

#### Email Notifications:
- **Customer Receipt** - Sent immediately after purchase
- **Business Owner Alert** - Instant sale notification with dashboard link
- **Instant Notification** - Additional real-time alert system

#### SMS Notifications (optional):
- Requires Twilio configuration
- Sends instant sale alerts to business owner's phone

### 6. Real-time Dashboard Updates

The SalesWidget component:
- Polls for new data every 30 seconds
- Shows total revenue, sales count, today's revenue
- Displays recent sales with customer information
- Updates automatically when new sales occur

### 7. Security Features

- Webhook signature verification
- Secure API endpoints with proper error handling  
- Database transactions for data consistency
- Customer data protection (PII handling)

### 8. Testing

#### Test Sale Creation:
Use the test button in the dashboard or call:
```javascript
POST /api/test/create-sale
{
  "businessId": "business-uuid",
  "productId": "test_product", 
  "amount": 99.99
}
```

#### Stripe Test Mode:
- Uses test API keys from environment variables
- No real money transactions
- Full webhook simulation

### 9. Environment Variables Required

```bash
# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Resend)
RESEND_API_KEY=re_...

# SMS (Optional - Twilio)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# App URLs
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_WEBSITE_BASE_URL=https://app.launchfly.ai
```

### 10. Integration Points

#### With Dynamic Sites:
- Products automatically display on user landing pages
- Business ID passed to components for payment processing
- Subdomain routing for success pages

#### With Dashboard:
- Real-time sales widget
- Revenue tracking and analytics
- Customer information display
- Growth metrics integration

### 11. Success Page Features

- Payment confirmation display
- Customer receipt information
- Return links to business website
- Support contact information

### 12. Error Handling

- Stripe API error management
- Database transaction rollbacks
- User-friendly error messages
- Webhook retry logic
- Notification failure graceful degradation

## Usage Examples

### Creating a Checkout Session:
```javascript
const response = await fetch('/api/stripe/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'product_123',
    businessId: 'business_uuid',
    customerEmail: 'customer@example.com',
    customerName: 'John Doe',
    subdomain: 'mybusiness'
  })
});
```

### Fetching Sales Data:
```javascript
const response = await fetch(`/api/sales/${businessId}`);
const salesData = await response.json();
// Returns: { summary: {...}, sales: [...], allSales: [...] }
```

## Future Enhancements

1. **Subscription Support** - Recurring payments
2. **Multi-currency** - International payment support  
3. **Advanced Analytics** - Revenue forecasting
4. **Coupon System** - Discount codes
5. **Tax Calculation** - Automatic tax handling
6. **Refund Management** - Built-in refund system

## Troubleshooting

### Common Issues:
1. **Webhook not receiving events** - Check endpoint URL and signature
2. **Payment not recording** - Verify database permissions
3. **Notifications not sending** - Check API keys and service status
4. **Products not displaying** - Ensure business has products in business_data

### Debug Tools:
- Check Stripe dashboard for webhook delivery
- Monitor server logs for API errors
- Use test sale button for system verification
- Verify environment variables are set correctly
