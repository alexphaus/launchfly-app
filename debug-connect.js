// debug-connect.js - Test Stripe Connect Express functionality
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testStripeConnect() {
  try {
    console.log('🧪 Testing Stripe Connect Express functionality...\n');

    // Test 1: Check Stripe configuration
    console.log('1️⃣ Checking Stripe configuration...');
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('❌ STRIPE_SECRET_KEY missing');
      return;
    }
    console.log('✅ Stripe secret key configured');
    console.log(`🔑 Key starts with: ${process.env.STRIPE_SECRET_KEY.substring(0, 12)}...`);

    // Test 2: Get a real business from database
    console.log('\n2️⃣ Getting business from database...');
    const { data: businesses, error: bizError } = await supabase
      .from('businesses')
      .select('id, name, form_data, stripe_connect_account_id, available_balance')
      .limit(1);

    if (bizError || !businesses?.length) {
      console.log('❌ No businesses found:', bizError?.message);
      return;
    }

    const business = businesses[0];
    console.log('✅ Found business:', business.id);
    console.log('📧 Email from form_data:', business.form_data?.email);
    console.log('💰 Available balance:', business.available_balance);
    console.log('🏦 Existing Connect account:', business.stripe_connect_account_id || 'None');

    // Test 3: Try creating a Stripe Connect Express account
    console.log('\n3️⃣ Testing Stripe Connect Express account creation...');
    
    const testEmail = business.form_data?.email || 'test@example.com';
    console.log('📧 Using email:', testEmail);

    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: testEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          business_id: business.id,
          business_name: business.name || 'Test Business',
          launchfly_test: 'true'
        }
      });

      console.log('✅ Successfully created Connect account:', account.id);

      // Test 4: Try creating account link
      console.log('\n4️⃣ Testing account link creation...');
      
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: 'http://localhost:3000/dashboard/test/settings?connect=refresh',
        return_url: 'http://localhost:3000/dashboard/test/settings?connect=success',
        type: 'account_onboarding',
      });

      console.log('✅ Successfully created account link');
      console.log('🔗 Onboarding URL:', accountLink.url);

      // Test 5: Clean up test account
      console.log('\n5️⃣ Cleaning up test account...');
      await stripe.accounts.del(account.id);
      console.log('✅ Test account deleted');

      console.log('\n🎉 All tests passed! Stripe Connect Express is working correctly.');
      
    } catch (stripeError) {
      console.log('❌ Stripe error:', stripeError.message);
      console.log('📋 Error details:', stripeError);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testStripeConnect();
