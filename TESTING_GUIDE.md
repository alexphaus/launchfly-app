# Stripe Payment Integration - Test Checklist

## Testing the Complete Payment Flow

### 1. Test Business Site
- Visit: http://localhost:3003/axceleratebusiness
- ✅ Should see updated site with ProductGrid
- ✅ Should see 3 AI products with pricing

### 2. Test Product Pages
- Click on "AI Professional" product (the popular one)
- Should redirect to: http://localhost:3003/axceleratebusiness/product/ai-pro
- ✅ Should see detailed product page with form

### 3. Test Stripe Checkout (Test Mode)
- Fill in customer information:
  - Name: Test Customer
  - Email: test@example.com
- Click "Buy Now - $699"
- Should redirect to Stripe Checkout
- Use test card: 4242 4242 4242 4242
- ✅ Should complete payment and redirect to success page

### 4. Test Success Page
- After payment, should redirect to success page
- ✅ Should show confirmation with transaction ID

### 5. Database Verification
In Supabase, check:
- `sales` table should have new record
- `businesses` table should update `total_revenue` and `first_sale_date`

### 6. Email Notifications
Business owner should receive:
- Sale notification email
- First sale celebration email (if first sale)

## Required Setup Before Testing

1. **Database Setup**
   ```sql
   -- Run setup_sales_table.sql in Supabase
   ```

2. **Stripe Configuration**
   - Set webhook endpoint: http://localhost:3003/api/webhook/stripe
   - Enable checkout.session.completed event
   - Update STRIPE_WEBHOOK_SECRET in .env.local

3. **Environment Variables**
   ```bash
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   RESEND_API_KEY=re_...
   ```

## Test Card Numbers

- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002  
- **Requires Auth**: 4000 0025 0000 3155

## Expected Results

1. ✅ Products display correctly on business site
2. ✅ Product detail pages work
3. ✅ Stripe checkout opens correctly
4. ✅ Payment processes successfully
5. ✅ Success page displays
6. ✅ Sale recorded in database
7. ✅ Email notifications sent
8. ✅ Revenue tracking updated

## Troubleshooting

- **Webhook issues**: Use ngrok for local testing
- **Product not found**: Check product ID matches URL param
- **Payment fails**: Verify Stripe keys are correct
- **No emails**: Check RESEND_API_KEY and sender domain
