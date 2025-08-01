# Payment Processing System

This document details the Stripe payment integration for Launchfly sites.

## Overview

The payment system enables visitors to purchase products through a seamless checkout experience with Stripe. The system includes:

1. **Product detail pages** with "Buy Now" buttons
2. **Stripe Checkout integration** for secure payment processing
3. **Success/confirmation pages** for post-purchase experience
4. **Email notifications** to both customers and business owners
5. **Dashboard analytics** for sales tracking and reporting

## Technical Implementation

### Database Schema

The payment system relies on two main database tables:

1. **Sales Table**: Records each successful transaction
   - `id`: Unique identifier (UUID)
   - `business_id`: Foreign key to businesses table
   - `product_id`: Product identifier
   - `product_name`: Product name (for display)
   - `amount`: Sale amount (decimal)
   - `customer_email`: Customer's email address
   - `customer_name`: Customer's name
   - `stripe_session_id`: Stripe checkout session ID
   - `payment_status`: Payment status (typically "paid")
   - `customer_address`: JSON object with shipping/billing address
   - `created_at`: Timestamp of the transaction

2. **Business Table Additions**:
   - `total_revenue`: Total revenue from all sales
   - `first_sale_date`: Date of the first sale
   - `last_sale_date`: Date of the most recent sale
   - `sales_count`: Total number of sales

### Process Flow

1. **Visitor views product** on the Launchfly site
2. **Visitor clicks "Buy Now"** button
3. **Server creates Stripe checkout session** via `/api/stripe/checkout`
4. **Visitor is redirected to Stripe** to complete purchase
5. **Stripe processes payment** and redirects to success page
6. **Webhook receives confirmation** from Stripe via `/api/stripe/webhook`
7. **Server records sale** in database and updates business metrics
8. **Emails are sent** to both customer and business owner
9. **Success page shows confirmation** to the customer
10. **Dashboard updates** with new sale information

## Configuration

To set up the payment system:

1. **Set environment variables**:
   ```
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   RESEND_API_KEY=your_resend_api_key
   ```

2. **Run database migration**:
   ```bash
   node setup-sales-schema.js
   ```

3. **Configure Stripe webhook** to point to:
   ```
   https://your-domain.com/api/stripe/webhook
   ```

## Testing

To test the payment flow:

1. Use Stripe test cards (e.g., `4242 4242 4242 4242`) for payments
2. Check webhook delivery in the Stripe dashboard
3. Verify sales records in the database
4. Confirm email delivery to both parties

## Troubleshooting

Common issues:

1. **Webhook failures**: Check Stripe dashboard for delivery attempts and errors
2. **Missing sales records**: Verify webhook secret and event handling
3. **Email delivery issues**: Check Resend API logs

For additional help, see the [Stripe documentation](https://stripe.com/docs/payments/checkout) and [Resend documentation](https://resend.com/docs).
