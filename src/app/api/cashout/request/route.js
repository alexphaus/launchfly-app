// src/app/api/cashout/request/route.js
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { businessId, amount, speed } = await request.json(); // speed: 'instant' | 'standard'

    if (!businessId || !amount || amount <= 0) {
      return Response.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    const payoutSpeed = speed === 'instant' ? 'instant' : 'standard';

    console.log('Processing cashout request:', { businessId, amount, payoutSpeed });

    // Rate limiting: Check recent cashout attempts
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentCashouts, error: rateLimitError } = await supabase
      .from('cashout_transactions')
      .select('id, created_at')
      .eq('business_id', businessId)
      .gte('created_at', oneHourAgo);

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    } else if (recentCashouts && recentCashouts.length >= 5) {
      return Response.json({ 
        error: 'Too many cashout requests. Please wait before trying again.',
        code: 'rate_limited'
      }, { status: 429 });
    }

    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      console.error('Business not found:', businessError);
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Check available balance
    const availableBalance = parseFloat(business.available_balance || 0);
    if (availableBalance < amount) {
      return Response.json({ 
        error: 'Insufficient funds', 
        available: availableBalance,
        requested: amount 
      }, { status: 400 });
    }

    // Check if business has Stripe Connect account
    if (!business.stripe_connect_account_id) {
      return Response.json({ 
        error: 'Bank account not connected. Please connect your bank account first.',
        action: 'connect_bank'
      }, { status: 400 });
    }

    // If instant, verify eligibility and compute fee (~1.5%)
    let fee = 0;
    let instantUsd = 0;
    let hasInstantMethod = false;
    if (payoutSpeed === 'instant') {
      // Production limits for instant payouts
      const DAILY_INSTANT_LIMIT = 50000; // $50k daily
      const MONTHLY_INSTANT_LIMIT = 1000000; // $1M monthly
      const INSTANT_FEE_RATE = 0.015; // 1.5%
      const INSTANT_FEE_MIN = 0.50; // $0.50 minimum

      // Check daily instant payout limit
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: dailyCashouts } = await supabase
        .from('cashout_transactions')
        .select('amount')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .like('payment_method_details', '%"speed":"instant"%')
        .gte('created_at', oneDayAgo);

      const dailyTotal = (dailyCashouts || []).reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
      if (dailyTotal + amount > DAILY_INSTANT_LIMIT) {
        return Response.json({ 
          error: `Daily instant payout limit exceeded. Limit: $${DAILY_INSTANT_LIMIT.toLocaleString()}, used today: $${dailyTotal.toFixed(2)}`,
          code: 'daily_limit_exceeded'
        }, { status: 400 });
      }

      // 1. available_payout_methods check on external accounts
      try {
        const [cards, banks] = await Promise.all([
          stripe.accounts.listExternalAccounts(business.stripe_connect_account_id, { object: 'card', limit: 100 }),
          stripe.accounts.listExternalAccounts(business.stripe_connect_account_id, { object: 'bank_account', limit: 100 })
        ]);
        const all = [...(cards?.data || []), ...(banks?.data || [])];
        hasInstantMethod = all.some((a) => Array.isArray(a.available_payout_methods) && a.available_payout_methods.includes('instant'));
      } catch (e) {
        hasInstantMethod = false;
      }
      if (!hasInstantMethod) {
        return Response.json({ 
          error: 'To enable instant payouts, please add a debit card in your account settings. Bank-only accounts typically receive standard payouts (1-2 business days).',
          code: 'instant_not_supported',
          action: 'add_debit_card'
        }, { status: 400 });
      }

      // 2. Instant balance sufficiency
      try {
        const balance = await stripe.balance.retrieve({ stripeAccount: business.stripe_connect_account_id });
        instantUsd = (balance.instant_available || [])
          .filter((b) => b.currency === 'usd')
          .reduce((s, b) => s + (b.amount || 0), 0) / 100;
      } catch (e) {
        instantUsd = 0;
      }
      
      const effectiveInstantLimit = Math.min(instantUsd, DAILY_INSTANT_LIMIT - dailyTotal);
      if (amount > effectiveInstantLimit) {
        return Response.json({ 
          error: `Amount exceeds instant payout availability. Available for instant: $${effectiveInstantLimit.toFixed(2)}`,
          instantAvailable: effectiveInstantLimit,
          code: 'instant_limit_exceeded'
        }, { status: 400 });
      }

      // 3. Fee calculation with production constants
      fee = Math.max(INSTANT_FEE_MIN, Math.round(amount * INSTANT_FEE_RATE * 100) / 100);
      if (availableBalance < amount + fee) {
        return Response.json({ 
          error: `Insufficient funds to cover instant payout fee. Available: $${availableBalance.toFixed(2)}, needed: $${(amount + fee).toFixed(2)} (includes $${fee.toFixed(2)} instant fee)`,
          fee,
          code: 'insufficient_funds_with_fee'
        }, { status: 400 });
      }
    }

    // Create cashout transaction record
    const { data: cashoutTransaction, error: transactionError } = await supabase
      .from('cashout_transactions')
      .insert({
        business_id: businessId,
        amount: amount,
        status: 'pending',
        processor: 'stripe',
        payment_method_details: {
          stripe_connect_account_id: business.stripe_connect_account_id,
          speed: payoutSpeed,
          fee
        }
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating cashout transaction:', transactionError);
      return Response.json({ error: 'Failed to create cashout transaction' }, { status: 500 });
    }

    try {
      // Create Stripe transfer to connected account (move funds from platform to connected)
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100), // cents
        currency: 'usd',
        destination: business.stripe_connect_account_id,
        description: `Launchfly Cashout Transfer - ${business.name}`,
        metadata: {
          business_id: businessId,
          cashout_transaction_id: cashoutTransaction.id
        }
      });

      // If instant, trigger an instant payout from the connected account to external account
      let payout = null;
      if (payoutSpeed === 'instant') {
        payout = await stripe.payouts.create({
          amount: Math.round(amount * 100),
          currency: 'usd',
          method: 'instant'
        }, { stripeAccount: business.stripe_connect_account_id });
      }

      // Deduct amount and any fee from available_balance
      const newAvailableBalance = availableBalance - amount - fee;
      await supabase
        .from('businesses')
        .update({ available_balance: newAvailableBalance })
        .eq('id', businessId);

      // Update cashout transaction
      await supabase
        .from('cashout_transactions')
        .update({
          processor_transaction_id: transfer.id,
          status: 'processing',
          processed_at: new Date().toISOString(),
          payment_method_details: {
            stripe_connect_account_id: business.stripe_connect_account_id,
            speed: payoutSpeed,
            fee,
            transfer_id: transfer.id,
            payout_id: payout?.id || null
          }
        })
        .eq('id', cashoutTransaction.id);

      // Log activity
      await supabase
        .from('ai_activities')
        .insert({
          business_id: businessId,
          type: 'cashout_requested',
          icon: '💰',
          message: `Cashout initiated: $${amount.toFixed(2)} (${payoutSpeed === 'instant' ? 'Instant' : 'Standard'})`,
          details: payoutSpeed === 'instant' ? `Instant payout fee $${fee.toFixed(2)} deducted` : 'Funds will be transferred within 1-2 business days',
          metadata: {
            amount: amount,
            transfer_id: transfer.id,
            payout_id: payout?.id || null,
            speed: payoutSpeed,
            fee,
            remaining_balance: newAvailableBalance
          }
        });

      console.log('✅ Cashout request processed successfully:', transfer.id, payout?.id);

      return Response.json({
        success: true,
        cashoutId: cashoutTransaction.id,
        transferId: transfer.id,
        payoutId: payout?.id || null,
        amount: amount,
        fee,
        newAvailableBalance: newAvailableBalance,
        message: payoutSpeed === 'instant'
          ? 'Instant cashout initiated. You will see funds momentarily.'
          : 'Cashout initiated. Funds will be transferred within 1-2 business days.'
      });

    } catch (stripeError) {
      console.error('Stripe transfer/payout failed:', stripeError);
      
      // Enhanced error logging
      await supabase
        .from('cashout_transactions')
        .update({ 
          status: 'failed', 
          failure_reason: stripeError.message,
          processed_at: new Date().toISOString(),
          payment_method_details: {
            ...cashoutTransaction.payment_method_details,
            error_code: stripeError.code,
            error_type: stripeError.type
          }
        })
        .eq('id', cashoutTransaction.id);

      // Log failed cashout activity
      await supabase
        .from('ai_activities')
        .insert({
          business_id: businessId,
          type: 'cashout_failed',
          icon: '❌',
          message: `Cashout failed: $${amount.toFixed(2)}`,
          details: `Error: ${stripeError.message}`,
          metadata: {
            amount,
            speed: payoutSpeed,
            error_code: stripeError.code,
            error_type: stripeError.type
          }
        });

      // User-friendly error messages
      const userFriendlyErrors = {
        'account_invalid': 'Your bank account setup is incomplete. Please update your account information.',
        'insufficient_funds': 'Insufficient funds in your Stripe account. Please try a smaller amount.',
        'payout_method_unavailable': 'This payout method is temporarily unavailable. Please try again later.',
        'instant_payouts_unsupported': 'Instant payouts are not available for your account type. Please use standard payouts.',
        'balance_insufficient': 'Insufficient balance for instant payout. Please try a smaller amount or use standard payout.'
      };

      const userMessage = userFriendlyErrors[stripeError.code] || 'Payment processing failed. Please try again or contact support.';

      return Response.json({ 
        error: userMessage,
        code: stripeError.code,
        technical_details: stripeError.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Cashout request error:', error);
    
    // Log system errors
    await supabase
      .from('ai_activities')
      .insert({
        business_id: businessId,
        type: 'cashout_system_error',
        icon: '🚨',
        message: 'Cashout system error occurred',
        details: error.message,
        metadata: {
          error_stack: error.stack,
          timestamp: new Date().toISOString()
        }
      }).catch(() => {}); // Don't fail if logging fails

    return Response.json({ 
      error: 'Internal server error. Our team has been notified.',
      code: 'system_error'
    }, { status: 500 });
  }
}
